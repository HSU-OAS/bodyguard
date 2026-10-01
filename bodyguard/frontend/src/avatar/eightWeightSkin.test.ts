import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
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
})
