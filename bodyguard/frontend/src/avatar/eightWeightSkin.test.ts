import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  MeshStandardMaterial,
  ShaderLib,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  Vector4,
} from 'three'
import { describe, expect, it } from 'vitest'
import { cloneEightWeightPair, eightWeightGeometry, eightWeightShader } from './eightWeightSkin'

// FR-A-03/04: deterministic artist-weight fixture; not webcam motion validation.
function fixture() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([1, 2, 3], 3))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 1, 2, 3], 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([0.4, 0.3, 0.2, 0.1], 4))
  geometry.setAttribute('joints_1', new Uint16BufferAttribute([4, 5, 6, 7], 4))
  geometry.setAttribute('weights_1', new Float32BufferAttribute([0.1, 0.05, 0.03, 0.02], 4))
  const bones = Array.from({ length: 8 }, () => new Bone())
  const mesh = new SkinnedMesh(geometry, new MeshStandardMaterial())
  for (const bone of bones) mesh.add(bone)
  mesh.bind(new Skeleton(bones))
  const scene = new Group()
  scene.add(mesh)
  return { scene, mesh, geometry }
}

describe('eight-weight asset skinning', () => {
  it('restores the first four share without changing the cached GLB or extra weights', () => {
    const { geometry } = fixture()
    const fixed = eightWeightGeometry(geometry, 8)
    expect(fixed.getAttribute('skinWeight').getX(0)).toBeCloseTo(0.32, 6)
    expect(fixed.getAttribute('skinWeight1').getX(0)).toBeCloseTo(0.1, 6)
    expect(geometry.getAttribute('skinWeight').getX(0)).toBeCloseTo(0.4, 6)
    expect(geometry.hasAttribute('skinWeight1')).toBe(false)
    fixed.dispose()
  })

  it.each([
    'missing-extra-indices',
    'invalid-shape',
    'nine-influences',
    'later-extra-set',
    'negative-weight',
    'nonfinite-weight',
    'out-of-range-joint',
    'duplicate-joint',
    'unnormalized-first',
    'unordered-extra',
  ])('rejects malformed %s rather than rendering a partial skin', (fault) => {
    const { geometry } = fixture()
    if (fault === 'missing-extra-indices') geometry.deleteAttribute('joints_1')
    if (fault === 'invalid-shape')
      geometry.setAttribute('weights_1', new Float32BufferAttribute([1, 0, 0], 3))
    if (fault === 'nine-influences')
      geometry.setAttribute('weights_2', new Float32BufferAttribute([0, 0, 0, 0], 4))
    if (fault === 'later-extra-set')
      geometry.setAttribute('joints_10', new Uint16BufferAttribute([0, 0, 0, 0], 4))
    if (fault === 'negative-weight') geometry.getAttribute('weights_1').setX(0, -0.1)
    if (fault === 'nonfinite-weight') geometry.getAttribute('weights_1').setX(0, Number.NaN)
    if (fault === 'out-of-range-joint') geometry.getAttribute('joints_1').setX(0, 8)
    if (fault === 'duplicate-joint') geometry.getAttribute('joints_1').setX(0, 0)
    if (fault === 'unnormalized-first') geometry.getAttribute('skinWeight').setX(0, 0.8)
    if (fault === 'unordered-extra') geometry.getAttribute('weights_1').setX(0, 0.6)
    expect(() => eightWeightGeometry(geometry, 8)).toThrow()
  })

  it('uses all eight weights for CPU positions, direction vectors and independent clones', () => {
    const { scene, geometry, mesh: source } = fixture()
    const pair = cloneEightWeightPair(scene)
    const meshes = pair.copies.map((copy) => copy.children[0] as SkinnedMesh)
    expect(meshes[0].geometry).toBe(meshes[1].geometry)
    expect(meshes[0].geometry).not.toBe(geometry)
    expect(meshes[0].material).not.toBe(source.material)
    expect(meshes[0].skeleton.bones[4]).not.toBe(meshes[1].skeleton.bones[4])
    meshes[1].skeleton.bones[4].position.x = 10
    for (const copy of pair.copies) copy.updateMatrixWorld(true)
    const unchanged = meshes[0].applyBoneTransform(0, new Vector3(1, 2, 3))
    const moved = meshes[1].applyBoneTransform(0, new Vector3(1, 2, 3))
    expect(unchanged.x).toBeCloseTo(1, 6)
    expect(moved.x).toBeCloseTo(2, 6)
    expect(moved.y).toBeCloseTo(2, 6)
    const direction = meshes[1].applyBoneTransform(0, new Vector4(1, 0, 0, 0))
    expect(direction.x).toBeCloseTo(1, 6)
    expect(direction.w).toBe(0)
    const homogeneous = meshes[1].applyBoneTransform(0, new Vector4(1, 2, 3, 1))
    expect(homogeneous.x).toBeCloseTo(2, 6)
    expect(homogeneous.w).toBe(1)
    pair.dispose()
    expect(geometry.getAttribute('skinWeight').getX(0)).toBeCloseTo(0.4, 6)
  })

  it('includes extra positions and normals before conversion, and patches native depth shaders', () => {
    const standard = eightWeightShader(ShaderLib.standard.vertexShader)
    expect(standard).toContain('getBoneMatrix(skinIndex1.w)')
    expect(standard).toContain('skinned += extraBone3 * skinVertex * skinWeight1.w')
    expect(standard.indexOf('skinMatrix += skinWeight1.w')).toBeLessThan(
      standard.indexOf('skinMatrix = bindMatrixInverse'),
    )
    expect(standard.indexOf('skinned += extraBone3')).toBeLessThan(
      standard.indexOf('transformed = ( bindMatrixInverse'),
    )
    expect(eightWeightShader(ShaderLib.depth.vertexShader)).toContain('skinned += extraBone3')
    expect(() => eightWeightShader('void main() {}')).toThrow()
  })

  it('matches eight-influence affine sums for each vertex and fresh transforms/attributes', () => {
    const { scene, mesh: source } = fixture()
    const vertices = [1, 2, 3, -2, 0.5, 4, 0, -3, 0.25]
    source.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    for (const name of ['skinIndex', 'skinWeight', 'joints_1', 'weights_1']) {
      const attribute = source.geometry.getAttribute(name)
      const values = Array.from({ length: 3 }, () => Array.from(attribute.array)).flat()
      source.geometry.setAttribute(
        name,
        name.includes('Index') || name.includes('joints')
          ? new Uint16BufferAttribute(values, 4)
          : new Float32BufferAttribute(values, 4),
      )
    }
    source.position.set(0.5, -1, 0.25)
    source.scale.set(1.2, 0.8, 1.1)
    source.updateMatrixWorld(true)
    source.bind(source.skeleton)
    const pair = cloneEightWeightPair(scene)
    const meshes = pair.copies.map((copy) => copy.children[0] as SkinnedMesh)
    const transforms = meshes[0].skeleton.bones.map((bone) => bone.matrixWorld.toArray())
    const sum = (mesh: SkinnedMesh, index: number, input: Vector4) => {
      const base = input.clone().applyMatrix4(mesh.bindMatrix)
      const result = new Vector4(0, 0, 0, 0)
      for (let component = 0; component < 8; component++) {
        const suffix = component < 4 ? '' : '1'
        const joint = mesh.geometry
          .getAttribute(`skinIndex${suffix}`)
          .getComponent(index, component % 4)
        const weight = mesh.geometry
          .getAttribute(`skinWeight${suffix}`)
          .getComponent(index, component % 4)
        const point = base
          .clone()
          .applyMatrix4(
            new Matrix4().multiplyMatrices(
              mesh.skeleton.bones[joint].matrixWorld,
              mesh.skeleton.boneInverses[joint],
            ),
          )
        result.addScaledVector(point, weight)
      }
      result.w = base.w
      return result.applyMatrix4(mesh.bindMatrixInverse)
    }
    try {
      for (let step = 1; step <= 2; step++) {
        meshes[1].skeleton.bones.forEach((bone, i) => {
          bone.position.set(i * step * 0.02, -i * 0.03, step * 0.04)
          bone.rotation.set(i * 0.07, step * 0.13, -i * 0.11)
          bone.scale.set(1 + i * 0.02, 0.9 + step * 0.1, 1.1)
        })
        if (step === 2) {
          const geometry = meshes[1].geometry
          const extra = geometry.getAttribute('skinWeight1').clone()
          const first = geometry.getAttribute('skinWeight').clone()
          extra.setX(1, extra.getX(1) + 0.05)
          first.setX(1, first.getX(1) - 0.05)
          geometry.setAttribute('skinWeight1', extra)
          geometry.setAttribute('skinWeight', first)
        }
        for (const copy of pair.copies) copy.updateMatrixWorld(true)
        for (const mesh of meshes)
          for (let vertex = 0; vertex < 3; vertex++) {
            const input = new Vector4(
              vertices[vertex * 3],
              vertices[vertex * 3 + 1],
              vertices[vertex * 3 + 2],
              1,
            )
            const expected = sum(mesh, vertex, input)
            const position = mesh.applyBoneTransform(vertex, new Vector3(input.x, input.y, input.z))
            expect(
              position.distanceTo(new Vector3(expected.x, expected.y, expected.z)),
            ).toBeLessThan(1e-10)
            for (const w of [0, 1]) {
              input.w = w
              const result = mesh.applyBoneTransform(vertex, input.clone())
              const correct = sum(mesh, vertex, input)
              result.toArray().forEach((value, component) => {
                expect(Math.abs(value - correct.getComponent(component))).toBeLessThan(1e-10)
              })
            }
          }
      }
      expect(meshes[0].skeleton.bones.map((bone) => bone.matrixWorld.toArray())).toEqual(transforms)
    } finally {
      pair.dispose()
    }
  })
  it('disposes owned clone skeleton textures once, without disposing source assets', () => {
    const { scene, mesh: source, geometry } = fixture()
    const pair = cloneEightWeightPair(scene)
    const disposed = [0, 0]
    const meshes = pair.copies.map((copy) => copy.children[0] as SkinnedMesh)
    meshes.forEach((mesh, index) => {
      mesh.skeleton.computeBoneTexture()
      mesh.skeleton.boneTexture?.addEventListener('dispose', () => {
        disposed[index]++
      })
    })
    let geometryDisposed = 0
    meshes[0].geometry.addEventListener('dispose', () => {
      geometryDisposed++
    })
    let originalDisposed = 0
    geometry.addEventListener('dispose', () => {
      originalDisposed++
    })
    source.skeleton.computeBoneTexture()
    source.skeleton.boneTexture?.addEventListener('dispose', () => {
      originalDisposed++
    })
    pair.dispose()
    pair.dispose()
    expect(disposed).toEqual([1, 1])
    expect(geometryDisposed).toBe(1)
    expect(originalDisposed).toBe(0)
    expect(meshes.every((mesh) => !mesh.frustumCulled)).toBe(true)
  })

  it('reclaims a temporary geometry even when weight validation throws', () => {
    const { geometry } = fixture()
    geometry.getAttribute('weights_1').setX(0, -0.1)
    const nativeClone = geometry.clone.bind(geometry)
    let reclaimed = 0
    geometry.clone = () => {
      const copy = nativeClone()
      copy.addEventListener('dispose', () => {
        reclaimed++
      })
      return copy
    }
    expect(() => eightWeightGeometry(geometry, 8)).toThrow()
    expect(reclaimed).toBe(1)
  })

  it('reclaims earlier patched geometry/material when a later mesh fails preparation', () => {
    const f = fixture(),
      invalid = fixture()
    invalid.geometry.deleteAttribute('joints_1')
    f.scene.add(invalid.mesh)
    const nativeGeometryClone = f.geometry.clone.bind(f.geometry)
    let geometryClosed = 0,
      materialClosed = 0,
      originalClosed = 0
    f.geometry.clone = () => {
      const copy = nativeGeometryClone()
      copy.addEventListener('dispose', () => {
        geometryClosed++
      })
      return copy
    }
    const material = f.mesh.material as MeshStandardMaterial
    const nativeMaterialClone = material.clone.bind(material)
    material.clone = () => {
      const copy = nativeMaterialClone()
      copy.addEventListener('dispose', () => {
        materialClosed++
      })
      return copy
    }
    f.geometry.addEventListener('dispose', () => {
      originalClosed++
    })
    expect(() => cloneEightWeightPair(f.scene)).toThrow()
    expect({ geometryClosed, materialClosed, originalClosed }).toEqual({
      geometryClosed: 1,
      materialClosed: 1,
      originalClosed: 0,
    })
  })
})
