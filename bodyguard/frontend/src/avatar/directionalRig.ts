// FR-A-01/03·FR-M-07/NFR-07/08: private directional display, never a classifier or success signal.
import { type Bone, Matrix4, type Object3D, Quaternion, Vector3 } from 'three'
import type { ResourceContext } from '../coaching/resources'
import { type Point, trustedJoints } from '../posture/landmarks'

type Directions = Readonly<Record<string, readonly number[]>>
type Frame = Readonly<{ generation: number; sequence: number; at: number; directions: Directions }>
type Binding = Readonly<{ bone: string; anchor: string }>
type Options = Readonly<{
  context: ResourceContext
  bindings: readonly Binding[]
  halfLifeMs: number
  maxAgeMs: number
}>
type State = Readonly<{
  status: 'tracking' | 'partial' | 'untracked' | 'closed'
  tracked: number
  total: number
}>

// Explicit GLTFLoader names for the existing MPFB rig. Not guessed from substring matches.
const LIMBS = [
  ['upperarm01L', 11, 13],
  ['lowerarm01L', 13, 15],
  ['upperarm01R', 12, 14],
  ['lowerarm01R', 14, 16],
  ['upperleg01L', 23, 25],
  ['lowerleg01L', 25, 27],
  ['upperleg01R', 24, 26],
  ['lowerleg01R', 26, 28],
] as const

/** Both arrays must be from one provider observation. This only converts accepted limb endpoints;
 * trust scores are model estimates, not proof of real camera accuracy. No head/twist is inferred.
 */
export function observedLimbDirections(
  image: readonly Point[] | null,
  world: readonly Point[] | null,
  mirror: boolean,
): Directions {
  const trusted = trustedJoints(image)
  const result: Record<string, readonly number[]> = {}
  for (const [name, from, to] of LIMBS) {
    const a = world?.[from]
    const b = world?.[to]
    if (!trusted[from] || !trusted[to] || !a || !b) continue
    const value = [(b.x - a.x) * (mirror ? -1 : 1), -(b.y - a.y), -(b.z - a.z)]
    if (value.every(Number.isFinite) && Math.hypot(...value) > 0)
      result[name] = Object.freeze(value)
  }
  return Object.freeze(result)
}

/** Caller owns a private cloned rig and its GPU resources. Coordinates remain in this closure.
 * Only swing is constrained by a direction; rest twist is retained, not measured.
 * Missing input freezes local rotations. Any parent may still move the missing child's world pose;
 * callers must use tracked coverage, never regard that inherited pose as a valid observation.
 */
export function createDirectionalRig(model: Object3D, options: Options) {
  const { halfLifeMs, maxAgeMs } = options
  const { generation, signal } = options.context
  const invalid = () => new Error('Invalid directional avatar rig')
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    !signal ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0 ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs <= 0 ||
    options.bindings.length === 0
  )
    throw invalid()
  const objects = new Map<string, Object3D[]>()
  model.traverse((node) => {
    if (!node.name) return
    const group = objects.get(node.name) ?? []
    group.push(node)
    objects.set(node.name, group)
  })
  function exact(name: string): Bone {
    const list = objects.get(name)
    if (list?.length !== 1 || !(list[0] as Bone).isBone) throw invalid()
    return list[0] as Bone
  }
  const seen = new Set<string>()
  const transformNodes = new Set<Object3D>()
  function validTransform(node: Object3D) {
    return (
      [...node.position.toArray(), ...node.scale.toArray(), ...node.quaternion.toArray()].every(
        Number.isFinite,
      ) &&
      node.scale.toArray().every((value) => value > 0) &&
      node.quaternion.lengthSq() > 0
    )
  }
  model.updateWorldMatrix(true, true)
  const bindings = options.bindings
    .map(({ bone: name, anchor: anchorName }) => {
      if (seen.has(name)) throw invalid()
      seen.add(name)
      const bone = exact(name)
      const anchor = exact(anchorName)
      let node: Object3D | null = anchor.parent
      while (node && node !== bone) node = node.parent
      if (node !== bone || bone === anchor) throw invalid()
      let depth = 0
      for (let parent: Object3D | null = anchor; parent; parent = parent.parent) {
        if (!validTransform(parent)) throw invalid()
        transformNodes.add(parent)
      }
      for (let parent = bone.parent; parent; parent = parent.parent) depth++
      const localDirection = anchor
        .getWorldPosition(new Vector3())
        .applyMatrix4(new Matrix4().copy(bone.matrixWorld).invert())
        .multiply(bone.scale)
      if (
        ![localDirection.x, localDirection.y, localDirection.z].every(Number.isFinite) ||
        localDirection.length() === 0
      )
        throw invalid()
      return {
        name,
        bone,
        depth,
        localDirection: localDirection.normalize(),
        rest: bone.quaternion.clone(),
        initialized: false,
      }
    })
    .sort((a, b) => a.depth - b.depth)
  let closed = false
  let latest: { sequence: number; at: number; directions: Map<string, Vector3> } | null = null
  let lastNow = -Infinity
  const parentInverse = new Matrix4()
  const localTarget = new Vector3()
  const target = new Quaternion()
  const swing = new Quaternion()
  const baseline = new Vector3()
  const state = (status: State['status'], tracked = 0): State =>
    Object.freeze({ status, tracked, total: bindings.length })
  function dispose() {
    if (closed) return
    closed = true
    latest = null
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  if (signal.aborted) dispose()
  function push(frame: Frame): boolean {
    if (
      closed ||
      signal.aborted ||
      !frame ||
      frame.generation !== generation ||
      !Number.isSafeInteger(frame.sequence) ||
      frame.sequence < 1 ||
      !Number.isFinite(frame.at) ||
      frame.at < 0 ||
      (latest && (frame.sequence <= latest.sequence || frame.at < latest.at)) ||
      lastNow - frame.at > maxAgeMs ||
      !frame.directions ||
      typeof frame.directions !== 'object'
    )
      return false
    const directions = new Map<string, Vector3>()
    for (const [name, value] of Object.entries(frame.directions)) {
      if (
        !seen.has(name) ||
        !Array.isArray(value) ||
        value.length !== 3 ||
        !value.every(Number.isFinite)
      )
        return false
      const vector = new Vector3(value[0], value[1], value[2])
      // Reject overflow and zero directions; no arbitrary anatomical angle or length clamp.
      const length = vector.length()
      if (!Number.isFinite(length) || length === 0) return false
      directions.set(name, vector.divideScalar(length))
    }
    latest = { sequence: frame.sequence, at: frame.at, directions }
    return true
  }
  function render(now: number, deltaMs: number): State {
    if (closed || signal.aborted) return state('closed')
    if (!Number.isFinite(now) || now < lastNow || !Number.isFinite(deltaMs) || deltaMs < 0)
      return state('untracked')
    lastNow = now
    if (!latest || now < latest.at || now - latest.at > maxAgeMs) return state('untracked')
    if ([...transformNodes].some((node) => !validTransform(node))) return state('untracked')
    const alpha = 1 - 2 ** (-deltaMs / halfLifeMs)
    for (const binding of bindings) {
      const direction = latest.directions.get(binding.name)
      if (!direction) continue
      binding.bone.parent?.updateWorldMatrix(true, false)
      if (binding.bone.parent) parentInverse.copy(binding.bone.parent.matrixWorld)
      else parentInverse.identity()
      // Full affine inverse, not decomposed world quaternion: authored positive nonuniform
      // scale and ancestor shear must be preserved, not treated as acceptable orientation error.
      if (!parentInverse.elements.every(Number.isFinite) || parentInverse.determinant() === 0)
        return state('untracked')
      parentInverse.invert()
      localTarget.copy(direction).transformDirection(parentInverse)
      baseline.copy(binding.localDirection).applyQuaternion(binding.rest).normalize()
      swing.setFromUnitVectors(baseline, localTarget)
      target.copy(swing).multiply(binding.rest).normalize()
      if (binding.initialized) binding.bone.quaternion.slerp(target, alpha)
      else {
        binding.bone.quaternion.copy(target)
        binding.initialized = true
      }
      binding.bone.updateWorldMatrix(false, true)
    }
    const count = latest.directions.size
    return state(
      count === bindings.length ? 'tracking' : count === 0 ? 'untracked' : 'partial',
      count,
    )
  }
  return Object.freeze({ push, render, dispose })
}
