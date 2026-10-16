// FR-A-03/M-02/07: private hand display, not identity, clinical angles or pose success.
import { type Bone, Matrix4, type Object3D, Quaternion, Vector3 } from 'three'
import type { ResourceContext } from '../coaching/resources'
import type { Point } from '../posture/landmarks'
import { similarityRotation } from './headOrientationRig'

type Side = 'left' | 'right'
export type HandObservation = Readonly<{
  side: Side
  landmarks: readonly Point[]
  worldLandmarks: readonly Point[]
}>
export type HandDisplayAlignment = Readonly<{
  cameraReferences: Readonly<Record<Side, readonly number[]>>
  sceneFromCamera: readonly number[]
}>
type Options = HandDisplayAlignment &
  Readonly<{
    context: ResourceContext
    mirror: boolean
    halfLifeMs: number
    maxAgeMs: number
  }>
type Stamp = Readonly<{ generation: number; sequence: number; at: number }>
const sides = ['left', 'right'] as const
// Actual A37 Blender rest tail is local +Y, including distal leaf bones.
// Verified read-only from both authored rigs, not fabricated child anchors.
export const HAND_RIG_BINDINGS = Object.freeze(
  sides.flatMap((side) => {
    const suffix = side === 'left' ? 'L' : 'R'
    return Array.from({ length: 15 }, (_, i) =>
      Object.freeze({
        side,
        bone: `finger${Math.floor(i / 3) + 1}-${(i % 3) + 1}${suffix}`,
        parent:
          i % 3
            ? `finger${Math.floor(i / 3) + 1}-${i % 3}${suffix}`
            : i < 3
              ? `wrist${suffix}`
              : `metacarpal${Math.floor(i / 3)}${suffix}`,
        from: Math.floor(i / 3) * 4 + 1 + (i % 3),
        to: Math.floor(i / 3) * 4 + 2 + (i % 3),
      }),
    )
  }),
)
const invalid = () => new Error('Invalid hand avatar rig')
const unit = (value: readonly number[]) => {
  if (!Array.isArray(value) || value.length !== 4) throw invalid()
  const copy = Array.from(value)
  if (!copy.every(Number.isFinite) || Math.abs(Math.hypot(...copy) - 1) > 1e-5) throw invalid()
  return Object.freeze(new Quaternion().fromArray(copy).normalize().toArray())
}
export function copyHandAlignment(value: HandDisplayAlignment): HandDisplayAlignment {
  try {
    const references = value.cameraReferences
    return Object.freeze({
      cameraReferences: Object.freeze({
        left: unit(references.left),
        right: unit(references.right),
      }),
      sceneFromCamera: unit(value.sceneFromCamera),
    })
  } catch {
    throw invalid()
  }
}
const reflected = (q: Quaternion) => new Quaternion(q.x, -q.y, -q.z, q.w)
const finite = (point: Point | undefined) =>
  point && [point.x, point.y, point.z].every(Number.isFinite)
const inFrame = (point: Point | undefined) =>
  !!finite(point) && !!point && point.x > 0 && point.x < 1 && point.y > 0 && point.y < 1

export function copyHandObservations(
  value: readonly HandObservation[] | undefined,
): readonly HandObservation[] {
  if (!Array.isArray(value) || value.length > 2) return Object.freeze([])
  const copied: HandObservation[] = []
  const seen = new Set<Side>()
  for (const hand of value) {
    const side = hand?.side
    if (!sides.includes(side) || seen.has(side)) return Object.freeze([])
    seen.add(side)
    const image = hand.landmarks,
      world = hand.worldLandmarks
    if (
      !Array.isArray(image) ||
      !Array.isArray(world) ||
      image.length !== 21 ||
      world.length !== 21
    )
      continue
    const points = (array: readonly Point[]) =>
      Object.freeze(
        Array.from(array, (p) =>
          Object.freeze(p ? { x: p.x, y: p.y, z: p.z } : { x: NaN, y: NaN, z: NaN }),
        ),
      )
    copied.push(Object.freeze({ side, landmarks: points(image), worldLandmarks: points(world) }))
  }
  return Object.freeze(copied)
}

/** Only plain bounded copies leave a foreign point boundary. Side labels are supplied,
 * NOT proved by the points and not cross-provider person matching. No personal data leaves memory. */
function candidates(
  hands: readonly HandObservation[] | undefined,
  mirror: boolean,
  basis: Quaternion,
) {
  const result = new Map<Side, { palm: Quaternion; directions: Map<string, Vector3> }>()
  if (!Array.isArray(hands) || hands.length > 2) return result
  const seen = new Set<Side>()
  for (const hand of hands) {
    const side = hand.side
    if (!sides.includes(side) || seen.has(side))
      return new Map<Side, { palm: Quaternion; directions: Map<string, Vector3> }>()
    seen.add(side)
    const image = hand.landmarks,
      world = hand.worldLandmarks
    if (
      !Array.isArray(image) ||
      !Array.isArray(world) ||
      image.length !== 21 ||
      world.length !== 21
    )
      continue
    const copiedImage = Array.from(image, (p) => (p ? { x: p.x, y: p.y, z: p.z } : undefined))
    const copiedWorld = Array.from(world, (p) => (p ? { x: p.x, y: p.y, z: p.z } : undefined))
    const points = copiedWorld.map((p) =>
      finite(p) && p ? new Vector3(p.x * (mirror ? -1 : 1), -p.y, -p.z) : null,
    )
    if (![0, 5, 9, 17].every((i) => inFrame(copiedImage[i]) && points[i])) continue
    const origin = points[0],
      middle = points[9],
      index = points[5],
      little = points[17]
    if (!origin || !middle || !index || !little) continue
    const y = middle.clone().sub(origin),
      across = index.clone().sub(little)
    if (
      !Number.isFinite(y.length()) ||
      y.length() === 0 ||
      !Number.isFinite(across.length()) ||
      across.length() === 0
    )
      continue
    y.normalize()
    across.normalize()
    const z = across.cross(y)
    // Numeric degeneracy only, not a clinically acceptable palm angle.
    if (!Number.isFinite(z.length()) || z.length() <= Number.EPSILON) continue
    z.normalize()
    const x = y.clone().cross(z).normalize()
    // Reflection changes handedness. Restore a proper basis so S R S matches
    // the explicitly mirrored reference; do not introduce a spurious half turn.
    if (mirror) {
      x.negate()
      z.negate()
    }
    const palm = new Quaternion()
      .setFromRotationMatrix(new Matrix4().makeBasis(x, y, z))
      .normalize()
    const directions = new Map<string, Vector3>()
    for (const binding of HAND_RIG_BINDINGS) {
      if (binding.side !== side) continue
      const a = points[binding.from],
        b = points[binding.to]
      if (!a || !b || !inFrame(copiedImage[binding.from]) || !inFrame(copiedImage[binding.to]))
        continue
      const direction = b.clone().sub(a),
        length = direction.length()
      if (!Number.isFinite(length) || length === 0) continue
      directions.set(binding.bone, direction.divideScalar(length).applyQuaternion(basis))
    }
    result.set(side, { palm, directions })
  }
  return result
}

// FR-A-01/03: explicit display alignment only; never sampled as a correct hand pose.
export function readHandCameraReferences(
  hands: readonly HandObservation[] | undefined,
): HandDisplayAlignment['cameraReferences'] | null {
  try {
    const palms = candidates(copyHandObservations(hands), false, new Quaternion())
    const left = palms.get('left'),
      right = palms.get('right')
    if (!left || !right) return null
    return Object.freeze({
      left: Object.freeze(left.palm.toArray()),
      right: Object.freeze(right.palm.toArray()),
    })
  } catch {
    return null
  }
}

/** Explicit display reference, never auto-neutral calibration. Wrist uses a palm plane;
 * each finger segment uses swing only and retains authored twist. Missing joints freeze
 * local pose (moving parents may still move world pose), with zero observation coverage.
 * No metacarpal rotation, scale/translation change or inferred anatomical joint limits. */
export function createObservedHandRig(model: Object3D, options: Options) {
  const {
    context: { generation, signal },
    mirror,
    halfLifeMs,
    maxAgeMs,
  } = options
  const alignment = copyHandAlignment(options)
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    !signal ||
    typeof mirror !== 'boolean' ||
    !Number.isFinite(halfLifeMs) ||
    halfLifeMs <= 0 ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs <= 0
  )
    throw invalid()
  const objects = new Map<string, Object3D[]>()
  model.traverse((node) => {
    const found = objects.get(node.name) ?? []
    found.push(node)
    objects.set(node.name, found)
  })
  function exact(name: string): Bone {
    const found = objects.get(name)
    if (found?.length !== 1 || !(found[0] as Bone).isBone) throw invalid()
    return found[0] as Bone
  }
  model.updateWorldMatrix(true, true)
  const ancestors = new Map<Object3D, Object3D | null>()
  const fingers = HAND_RIG_BINDINGS.map((binding) => {
    const bone = exact(binding.bone)
    if (bone.parent !== exact(binding.parent)) throw invalid()
    return { ...binding, bone, rest: bone.quaternion.clone(), initialized: false }
  })
  const wrists = sides.map((side) => {
    const suffix = side === 'left' ? 'L' : 'R',
      bone = exact(`wrist${suffix}`)
    if (bone.parent !== exact(`lowerarm02${suffix}`)) throw invalid()
    const rest = similarityRotation(bone.matrixWorld)
    if (!rest) throw invalid()
    const supplied = new Quaternion().fromArray(alignment.cameraReferences[side])
    return {
      side,
      bone,
      rest,
      inverseReference: (mirror ? reflected(supplied) : supplied).invert(),
      initialized: false,
    }
  })
  for (const { bone } of [...wrists, ...fingers]) {
    for (let node: Object3D | null = bone; node; node = node.parent) {
      ancestors.set(node, node.parent)
      if (node === model) break
    }
  }
  const valid = () =>
    [...ancestors].every(
      ([node, parent]) =>
        (node === model || node.parent === parent) &&
        node.matrixAutoUpdate &&
        [...node.position.toArray(), ...node.scale.toArray(), ...node.quaternion.toArray()].every(
          Number.isFinite,
        ) &&
        node.scale.toArray().every((v) => v > 0) &&
        Math.abs(node.quaternion.lengthSq() - 1) <= 1e-5 &&
        similarityRotation(node.matrixWorld) !== null,
    )
  if (!valid()) throw invalid()
  const basis = new Quaternion().fromArray(alignment.sceneFromCamera),
    inverseBasis = basis.clone().invert()
  let closed = false,
    lastNow = -Infinity
  let latest: { sequence: number; at: number; hands: ReturnType<typeof candidates> } | null = null
  const state = (status: 'tracking' | 'partial' | 'untracked' | 'closed', tracked = 0) =>
    Object.freeze({ status, tracked, total: 32 })
  function dispose() {
    closed = true
    latest = null
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  if (signal.aborted) dispose()
  function push(frame: Stamp & Readonly<{ hands?: readonly HandObservation[] }>): boolean {
    if (closed || signal.aborted) return false
    try {
      const g = frame?.generation,
        sequence = frame?.sequence,
        at = frame?.at
      if (
        g !== generation ||
        !Number.isSafeInteger(sequence) ||
        sequence <= 0 ||
        !Number.isFinite(at) ||
        at < 0 ||
        (latest && (sequence <= latest.sequence || at <= latest.at)) ||
        lastNow - at > maxAgeMs
      )
        return false
      const accepted = { sequence, at, hands: new Map() as ReturnType<typeof candidates> }
      latest = accepted
      const copied = candidates(frame.hands, mirror, basis)
      if (closed || signal.aborted || latest !== accepted) return false
      accepted.hands = copied
      return true
    } catch {
      dispose()
      return false
    }
  }
  function render(now: number, deltaMs: number) {
    if (closed || signal.aborted) return state('closed')
    if (!Number.isFinite(now) || now < lastNow || !Number.isFinite(deltaMs) || deltaMs < 0)
      return state('untracked')
    lastNow = now
    model.updateWorldMatrix(true, true)
    if (!latest || now < latest.at || now - latest.at > maxAgeMs || !valid())
      return state('untracked')
    const alpha = 1 - 2 ** (-deltaMs / halfLifeMs)
    let count = 0
    for (const wrist of wrists) {
      const observed = latest.hands.get(wrist.side)
      if (!observed) {
        wrist.initialized = false
        continue
      }
      const parent = wrist.bone.parent
        ? similarityRotation(wrist.bone.parent.matrixWorld)
        : new Quaternion()
      if (!parent) return state('untracked')
      const target = basis
        .clone()
        .multiply(observed.palm)
        .multiply(wrist.inverseReference)
        .multiply(inverseBasis)
        .multiply(wrist.rest)
      target.premultiply(parent.invert()).normalize()
      if (wrist.initialized) wrist.bone.quaternion.slerp(target, alpha)
      else wrist.bone.quaternion.copy(target)
      wrist.initialized = true
      wrist.bone.updateWorldMatrix(false, true)
      count++
    }
    for (const finger of fingers) {
      const direction = latest.hands.get(finger.side)?.directions.get(finger.bone.name)
      if (!direction) {
        finger.initialized = false
        continue
      }
      const inverse = finger.bone.parent
        ? new Matrix4().copy(finger.bone.parent.matrixWorld).invert()
        : new Matrix4()
      const local = direction.clone().transformDirection(inverse)
      const restAxis = new Vector3(0, 1, 0).applyQuaternion(finger.rest).normalize()
      const target = new Quaternion()
        .setFromUnitVectors(restAxis, local)
        .multiply(finger.rest)
        .normalize()
      if (finger.initialized) finger.bone.quaternion.slerp(target, alpha)
      else finger.bone.quaternion.copy(target)
      finger.initialized = true
      finger.bone.updateWorldMatrix(false, true)
      count++
    }
    return state(count === 32 ? 'tracking' : count ? 'partial' : 'untracked', count)
  }
  return Object.freeze({ push, render, dispose })
}
