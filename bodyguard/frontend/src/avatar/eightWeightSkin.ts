import {
  type BufferGeometry,
  type Material,
  Matrix4,
  MeshDepthMaterial,
  type Object3D,
  RGBADepthPacking,
  ShaderChunk,
  type SkinnedMesh,
  type Vector3,
  Vector4,
} from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

// FR-A-03/04: authored eight-weight GLBs; default Three skinning drops JOINTS_1.
// Only the development asset review uses this path. No camera/clinical data.
export function eightWeightShader(source: string) {
  for (const marker of ['skinning_pars_vertex', 'skinbase_vertex', 'skinning_vertex'])
    if (!source.includes(`#include <${marker}>`)) throw new Error('지원하지 않는 스킨 셰이더입니다')
  const extraBones = ['x', 'y', 'z', 'w']
    .map((component, i) => `mat4 extraBone${i} = getBoneMatrix(skinIndex1.${component});`)
    .join('\n')
  const extraPosition = ['x', 'y', 'z', 'w']
    .map((component, i) => `skinned += extraBone${i} * skinVertex * skinWeight1.${component};`)
    .join('\n')
  const extraNormal = ['x', 'y', 'z', 'w']
    .map((component, i) => `skinMatrix += skinWeight1.${component} * extraBone${i};`)
    .join('\n')
  return source
    .replace(
      '#include <skinning_pars_vertex>',
      '#include <skinning_pars_vertex>\nattribute vec4 skinIndex1;\nattribute vec4 skinWeight1;',
    )
    .replace(
      '#include <skinbase_vertex>',
      ShaderChunk.skinbase_vertex.replace('#endif', `${extraBones}\n#endif`),
    )
    .replace(
      '#include <skinning_vertex>',
      ShaderChunk.skinning_vertex.replace('transformed =', `${extraPosition}\ntransformed =`),
    )
    .replace(
      '#include <skinnormal_vertex>',
      ShaderChunk.skinnormal_vertex.replace(
        'skinMatrix = bindMatrixInverse',
        `${extraNormal}\nskinMatrix = bindMatrixInverse`,
      ),
    )
}

function patchMaterial(material: Material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = eightWeightShader(shader.vertexShader)
  }
  material.customProgramCacheKey = () => 'bodyguard-eight-weight-v1'
}

export function eightWeightGeometry(source: BufferGeometry, boneCount: number) {
  const result = source.clone()
  const first = result.getAttribute('skinWeight')
  const extra = result.getAttribute('weights_1')
  const indices = [result.getAttribute('skinIndex'), result.getAttribute('joints_1')]
  if (
    !first ||
    !extra ||
    indices.some((value) => !value) ||
    [first, extra, ...indices].some(
      (value) => value.itemSize !== 4 || value.count !== first.count,
    ) ||
    Object.keys(source.attributes).some((name) => /^(joints|weights)_(?:[2-9]|\d{2,})$/.test(name))
  )
    throw new Error('여덟 관절 가중치가 완전하지 않습니다')
  for (let vertex = 0; vertex < first.count; vertex++) {
    let firstSum = 0
    let extraSum = 0
    const seen = new Set<number>()
    for (let set = 0; set < 2; set++) {
      const weights = set === 0 ? first : extra
      for (let component = 0; component < 4; component++) {
        const weight = weights.getComponent(vertex, component)
        const joint = indices[set].getComponent(vertex, component)
        if (
          !Number.isFinite(weight) ||
          weight < 0 ||
          !Number.isInteger(joint) ||
          joint < 0 ||
          joint >= boneCount ||
          (weight > 0 && seen.has(joint))
        )
          throw new Error('잘못된 관절 가중치입니다')
        if (weight > 0) seen.add(joint)
        if (set === 0) firstSum += weight
        else extraSum += weight
      }
    }
    // GLTFLoader 0.186 normalizes WEIGHTS_0 alone. Recover its original share
    // from untouched WEIGHTS_1; the native export orders descending weights.
    if (Math.abs(firstSum - 1) > 0.00001 || extraSum > 0.50001)
      throw new Error('지원하지 않는 GLB 가중치 정규화입니다')
    for (let component = 0; component < 4; component++)
      first.setComponent(
        vertex,
        component,
        (first.getComponent(vertex, component) * (1 - extraSum)) / firstSum,
      )
  }
  result.setAttribute('skinIndex1', indices[1])
  result.setAttribute('skinWeight1', extra)
  return result
}

function patchCpuSkin(mesh: SkinnedMesh) {
  const base = new Vector4()
  const moved = new Vector4()
  const matrix = new Matrix4()
  mesh.applyBoneTransform = <T extends Vector3 | Vector4>(index: number, target: T): T => {
    base.set(target.x, target.y, target.z, target instanceof Vector4 ? target.w : 1)
    base.applyMatrix4(mesh.bindMatrix)
    if (target instanceof Vector4) target.set(0, 0, 0, 0)
    else target.set(0, 0, 0)
    for (const [jointName, weightName] of [
      ['skinIndex', 'skinWeight'],
      ['skinIndex1', 'skinWeight1'],
    ]) {
      const joints = mesh.geometry.getAttribute(jointName)
      const weights = mesh.geometry.getAttribute(weightName)
      for (let component = 0; component < 4; component++) {
        const weight = weights.getComponent(index, component)
        if (!weight) continue
        const joint = joints.getComponent(index, component)
        matrix.multiplyMatrices(
          mesh.skeleton.bones[joint].matrixWorld,
          mesh.skeleton.boneInverses[joint],
        )
        moved.copy(base).applyMatrix4(matrix)
        target.x += moved.x * weight
        target.y += moved.y * weight
        target.z += moved.z * weight
      }
    }
    if (target instanceof Vector4) target.w = base.w
    target.applyMatrix4(mesh.bindMatrixInverse)
    return target
  }
}

export function cloneEightWeightPair(scene: Object3D) {
  const copies = [clone(scene), clone(scene)]
  const geometries = new Map<BufferGeometry, BufferGeometry>()
  const materials = new Map<Material, Material>()
  const depths: Material[] = []
  const skeletons = new Set<SkinnedMesh['skeleton']>()
  for (const copy of copies)
    copy.traverse((object) => {
      const mesh = object as SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      skeletons.add(mesh.skeleton)
      mesh.castShadow = true
      // Rest-pose bounds cannot cull animated limbs. Two private review avatars are intentionally
      // always submitted; actual notebook performance remains a separate release gate.
      mesh.frustumCulled = false
      if (mesh.geometry.hasAttribute('joints_1') !== mesh.geometry.hasAttribute('weights_1'))
        throw new Error('추가 관절 가중치가 누락됐습니다')
      if (!mesh.geometry.hasAttribute('weights_1')) return
      let geometry = geometries.get(mesh.geometry)
      if (!geometry) {
        geometry = eightWeightGeometry(mesh.geometry, mesh.skeleton.bones.length)
        geometries.set(mesh.geometry, geometry)
      }
      mesh.geometry = geometry
      patchCpuSkin(mesh)
      const patched = (source: Material) => {
        let result = materials.get(source)
        if (!result) {
          result = source.clone()
          patchMaterial(result)
          materials.set(source, result)
        }
        return result
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(patched)
        : patched(mesh.material)
      const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
      patchMaterial(depth)
      mesh.customDepthMaterial = depth
      depths.push(depth)
    })
  let disposed = false
  return {
    copies,
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const skeleton of skeletons) skeleton.dispose()
      for (const geometry of geometries.values()) geometry.dispose()
      for (const material of materials.values()) material.dispose()
      for (const material of depths) material.dispose()
    },
  }
}
