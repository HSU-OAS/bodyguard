// FR-A-01/03: display-only shoulder elevation (shrug) from ear-relative shoulder height.
// Never a posture measurement, verdict or success signal. Needs an upright reference first.
import { type Bone, type Object3D, Quaternion, Vector3 } from 'three'
import type { ResourceContext } from '../coaching/resources'
import { type Point, trustedJoints } from '../posture/landmarks'

export const OBSERVED_CLAVICLES = Object.freeze(['clavicleL', 'clavicleR'] as const)
export type ClavicleBone = (typeof OBSERVED_CLAVICLES)[number]
// Avatar bone ← same-side shoulder landmark, matching the limb bindings (L ← 11, R ← 12).
const SIDES = [
  ['clavicleL', 11],
  ['clavicleR', 12],
] as const
const EARS = [7, 8] as const
// Shoulder girdle range shown on the avatar; larger values are depth/visibility noise.
export const MAX_ELEVATION_DEG = 35
export const MIN_ELEVATION_DEG = -10

/** Ear midpoint → each trusted shoulder, flipped to avatar space like limb directions.
 * Both ears must be trusted; a side is omitted when its shoulder is not. */
export function observedShoulderOffsets(
  image: readonly Point[] | null,
  world: readonly Point[] | null,
  mirror: boolean,
): Readonly<Partial<Record<ClavicleBone, readonly number[]>>> {
  const trusted = trustedJoints(image)
  const result: Partial<Record<ClavicleBone, readonly number[]>> = {}
  const ears = EARS.map((index) => world?.[index])
  const [leftEar, rightEar] = ears
  if (!leftEar || !rightEar || !EARS.every((index) => trusted[index])) return Object.freeze(result)
  const mid = (['x', 'y', 'z'] as const).map((key) => leftEar[key] / 2 + rightEar[key] / 2)
  for (const [bone, index] of SIDES) {
    const shoulder = world?.[index]
    if (!trusted[index] || !shoulder) continue
    const value = [
      (shoulder.x - mid[0]) * (mirror ? -1 : 1),
      -(shoulder.y - mid[1]),
      -(shoulder.z - mid[2]),
    ]
    if (value.every(Number.isFinite)) result[bone] = Object.freeze(value)
  }
  return Object.freeze(result)
}

/** Elevation angle (radians) of a shoulder that sits `raised` metres above its upright
 * reference, on a clavicle spanning `span` metres. Clamped to the shown range. */
export function elevationAngle(raised: number, span: number) {
  if (!Number.isFinite(raised) || !Number.isFinite(span) || span <= 0) return null
  const degrees = (Math.atan2(raised, span) * 180) / Math.PI
  return (Math.max(MIN_ELEVATION_DEG, Math.min(MAX_ELEVATION_DEG, degrees)) * Math.PI) / 180
}

type Options = Readonly<{
  context: ResourceContext
  halfLifeMs: number
  maxAgeMs: number
  relaxAfterMs?: number
  relaxHalfLifeMs?: number
}>
type Frame = Readonly<{
  generation: number
  sequence: number
  at: number
  angles: Readonly<Partial<Record<ClavicleBone, number>>>
}>

/** Rotates each clavicle about the trunk's forward axis so its outer end rises. Caller owns the
 * private rig clone. Missing input holds, then eases back to the authored rest pose. */
export function createShoulderElevationRig(model: Object3D, options: Options) {
  const { halfLifeMs, maxAgeMs, relaxAfterMs } = options
  const relaxHalfLifeMs = options.relaxHalfLifeMs ?? 250
  const { generation, signal } = options.context
  const invalid = () => new Error('Invalid shoulder elevation rig')
  if (
    !Number.isSafeInteger(generation) ||
    generation <= 0 ||
    !signal ||
    !(Number.isFinite(halfLifeMs) && halfLifeMs > 0) ||
    !(Number.isFinite(maxAgeMs) && maxAgeMs > 0) ||
    (relaxAfterMs !== undefined && !(Number.isFinite(relaxAfterMs) && relaxAfterMs >= 0)) ||
    !(Number.isFinite(relaxHalfLifeMs) && relaxHalfLifeMs > 0)
  )
    throw invalid()
  model.updateWorldMatrix(true, true)
  const modelRotation = model.getWorldQuaternion(new Quaternion())
  const modelInverse = model.matrixWorld.clone().invert()
  const rigs = OBSERVED_CLAVICLES.map((name) => {
    const found: Bone[] = []
    model.traverse((node) => {
      if (node.name === name && (node as Bone).isBone) found.push(node as Bone)
    })
    const bone = found[0]
    const child = bone?.children.find((node) => (node as Bone).isBone)
    if (found.length !== 1 || !bone.parent || !child) throw invalid()
    // Lateral side of the rest clavicle decides which roll direction raises its outer end.
    const outward = child
      .getWorldPosition(new Vector3())
      .applyMatrix4(modelInverse)
      .sub(bone.getWorldPosition(new Vector3()).applyMatrix4(modelInverse))
    if (!Number.isFinite(outward.x) || outward.x === 0) throw invalid()
    const axis = new Vector3(0, 0, 1)
      .applyQuaternion(modelRotation)
      .applyQuaternion(bone.parent.getWorldQuaternion(new Quaternion()).invert())
      .normalize()
    return {
      name,
      bone,
      axis,
      sign: Math.sign(outward.x),
      rest: bone.quaternion.clone(),
      seenAt: -Infinity,
    }
  })
  let closed = false
  let latest: { sequence: number; at: number; angles: Map<ClavicleBone, number> } | null = null
  let lastNow = -Infinity
  const lift = new Quaternion()
  const target = new Quaternion()
  function dispose() {
    if (closed) return
    closed = true
    latest = null
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  if (signal.aborted) dispose()
  function push(frame: Frame) {
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
      !frame.angles ||
      typeof frame.angles !== 'object'
    )
      return false
    const angles = new Map<ClavicleBone, number>()
    for (const [name, value] of Object.entries(frame.angles)) {
      if (!OBSERVED_CLAVICLES.includes(name as ClavicleBone) || !Number.isFinite(value))
        return false
      angles.set(name as ClavicleBone, value as number)
    }
    latest = { sequence: frame.sequence, at: frame.at, angles }
    return true
  }
  function render(now: number, deltaMs: number) {
    if (closed || signal.aborted) return 0
    if (!Number.isFinite(now) || now < lastNow || !Number.isFinite(deltaMs) || deltaMs < 0) return 0
    lastNow = now
    const fresh = latest && now >= latest.at && now - latest.at <= maxAgeMs ? latest : null
    const alpha = 1 - 2 ** (-deltaMs / halfLifeMs)
    const relaxAlpha = 1 - 2 ** (-deltaMs / relaxHalfLifeMs)
    let tracked = 0
    for (const rig of rigs) {
      const angle = fresh?.angles.get(rig.name)
      if (angle === undefined) {
        if (relaxAfterMs !== undefined && now - rig.seenAt > relaxAfterMs) {
          rig.bone.quaternion.slerp(rig.rest, relaxAlpha)
          rig.bone.updateWorldMatrix(false, true)
        }
        continue
      }
      rig.seenAt = now
      tracked++
      lift.setFromAxisAngle(rig.axis, rig.sign * angle)
      target.copy(lift).multiply(rig.rest).normalize()
      rig.bone.quaternion.slerp(target, alpha)
      rig.bone.updateWorldMatrix(false, true)
    }
    return tracked
  }
  return Object.freeze({ push, render, dispose })
}
