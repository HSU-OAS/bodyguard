// FR-A-01/03·FR-M-02/07: one provider result, private directional display only.
import { type Object3D, Quaternion, Vector3 } from 'three'
import type { CapturedImage } from '../posture/capturedImage'
import { JOINT_COUNT, type Point } from '../posture/landmarks'
import {
  createDirectionalRig,
  OBSERVED_LIMB_BINDINGS,
  observedLimbDirections,
} from './directionalRig'
import { createHeadRotationRig, type HeadDisplayAlignment } from './headOrientationRig'
import { shapeHinges } from './hingeLimits'
import { createMotionFilter } from './motionFilter'
import {
  copyHandObservations,
  createObservedHandRig,
  type HandDisplayAlignment,
  type HandObservation,
} from './observedHandRig'
import {
  type ClavicleBone,
  createShoulderElevationRig,
  elevationAngle,
  OBSERVED_CLAVICLES,
  observedShoulderOffsets,
} from './observedShoulders'
import {
  OBSERVED_TRUNK_BINDING,
  observedShoulderLine,
  observedTrunkDirection,
} from './observedTrunk'
import type { ProjectedSurfaceRegion } from './projectedSurfaceRegions'

export type PoseRigFrame = Readonly<{
  generation: number
  sequence: number
  at: number
  // Optional original input geometry; never CSS dimensions or avatar display mirroring.
  image?: CapturedImage
  result: Readonly<{
    landmarks: readonly (readonly Point[])[]
    worldLandmarks: readonly (readonly Point[])[]
    // Optional private face orientation from the same input, NOT matched identity/neck pose.
    headOrientation?: readonly number[] | null
    hands?: readonly HandObservation[]
  }>
}>
// FR-A-01: copied technical coverage, not a pose-error or same-person verdict.
export type PoseCoverage = Readonly<{
  generation: number
  sequence: number
  at: number
  bones: readonly string[]
  // Separate projected region evidence; never promote it to observed bone rotations.
  projectedRegions?: readonly ProjectedSurfaceRegion[]
}>
// FR-A-01/03: a user-requested upright reference removes the shared camera/depth tilt that a
// single webcam bakes into every world direction (measured ~13-15° with a desk laptop camera).
// Display alignment only: never a posture verdict, never applied without an explicit request.
export const UPRIGHT_SAMPLES = 8
export const MAX_UPRIGHT_TILT_DEG = 30
export type UprightCalibration = 'none' | 'pending' | 'applied' | 'rejected'
const UP = Object.freeze(new Vector3(0, 1, 0))

type Options = Parameters<typeof createDirectionalRig>[1] &
  Readonly<{
    mirror: boolean
    head?: HeadDisplayAlignment
    hands?: HandDisplayAlignment
    // FR-A-01: show shrugs on the clavicles once an upright reference exists.
    shoulders?: boolean
    // FR-A-01: adaptive smoothing and elbow/knee shaping for natural display. Off keeps raw input.
    natural?: boolean
  }>
const rotate = (value: readonly number[], rotation: Quaternion) => {
  const v = new Vector3(value[0], value[1], value[2]).applyQuaternion(rotation)
  return [v.x, v.y, v.z]
}
/** One detectForVideo result owns both arrays. Caller preserves its capture stamps;
 * this adapter does not verify a detector, turn coverage into success, or own GPU resources.
 * A fresh empty/ambiguous result revokes coverage immediately, without resetting to a correct pose.
 */
export function createObservedPoseRig(model: Object3D, options: Options) {
  const { mirror, maxAgeMs } = options
  const { generation, signal } = options.context
  if (
    typeof mirror !== 'boolean' ||
    (options.head && options.head.bone !== 'head') ||
    options.bindings.some(
      ({ bone, anchor }) =>
        ![...OBSERVED_LIMB_BINDINGS, OBSERVED_TRUNK_BINDING].some(
          (binding) => binding.bone === bone && binding.anchor === anchor,
        ),
    )
  )
    throw new Error('Invalid observed pose rig')
  const driver = createDirectionalRig(model, options)
  let head: ReturnType<typeof createHeadRotationRig> | undefined
  let hands: ReturnType<typeof createObservedHandRig> | undefined
  let shoulders: ReturnType<typeof createShoulderElevationRig> | undefined
  try {
    if (options.shoulders)
      shoulders = createShoulderElevationRig(model, {
        context: options.context,
        halfLifeMs: options.halfLifeMs,
        maxAgeMs,
        relaxAfterMs: options.relaxAfterMs,
      })
    if (options.head)
      head = createHeadRotationRig(model, {
        ...options.head,
        context: options.context,
        mirror,
        halfLifeMs: options.halfLifeMs,
        maxAgeMs,
      })
    if (options.hands)
      hands = createObservedHandRig(model, {
        ...options.hands,
        context: options.context,
        mirror,
        halfLifeMs: options.halfLifeMs,
        maxAgeMs,
      })
  } catch {
    driver.dispose()
    head?.dispose()
    shoulders?.dispose()
    throw new Error('Invalid observed pose rig')
  }
  const permitted = new Set(options.bindings.map(({ bone }) => bone))
  let closed = false
  let lastSequence = 0
  let lastAt = -Infinity
  let lastNow = -Infinity
  let pending: object | undefined
  let coverage: PoseCoverage | null = null
  let upright: UprightCalibration = 'none'
  let correction: Quaternion | null = null
  let samples: { sum: Vector3; count: number } | null = null
  // Upright ear→shoulder offsets (raw avatar space); heights are read through `correction`.
  type ShoulderSamples = Record<ClavicleBone, { sum: Vector3; count: number }>
  let shoulderSamples: ShoulderSamples | null = null
  let shoulderReference: Record<ClavicleBone, Vector3> | null = null
  const filter = options.natural ? createMotionFilter() : null

  function dispose() {
    if (closed) return
    closed = true
    pending = undefined
    coverage = null
    samples = null
    correction = null
    shoulderSamples = null
    shoulderReference = null
    filter?.clear()
    driver.dispose()
    head?.dispose()
    hands?.dispose()
    shoulders?.dispose()
  }
  function observe(frame: PoseRigFrame): boolean {
    if (closed || signal.aborted) return false
    try {
      // Capture metadata once, before accessing potentially foreign raw result values.
      const suppliedGeneration = frame?.generation
      const sequence = frame?.sequence
      const at = frame?.at
      if (
        suppliedGeneration !== generation ||
        !Number.isSafeInteger(sequence) ||
        sequence <= lastSequence ||
        !Number.isFinite(at) ||
        at < 0 ||
        at < lastAt ||
        ((head || hands) && at === lastAt) ||
        lastNow - at > maxAgeMs
      )
        return false
      // Reserve before foreign payload access. Both drivers receive only owned copies
      // after this token survives reentry/abort; a newer frame cannot be overwritten.
      const token = {}
      pending = token
      lastSequence = sequence
      lastAt = at
      const result = frame.result
      const images = result?.landmarks
      const worlds = result?.worldLandmarks
      const single =
        Array.isArray(images) &&
        Array.isArray(worlds) &&
        images.length === 1 &&
        worlds.length === 1 &&
        Array.isArray(images[0]) &&
        Array.isArray(worlds[0]) &&
        images[0].length === JOINT_COUNT &&
        worlds[0].length === JOINT_COUNT
      const trunk = single ? observedTrunkDirection(images[0], worlds[0], mirror) : {}
      const laterals: Record<string, readonly number[]> =
        options.natural && single && permitted.has(OBSERVED_TRUNK_BINDING.bone)
          ? { ...observedShoulderLine(images[0], worlds[0], mirror) }
          : {}
      const offsets: Partial<Record<ClavicleBone, readonly number[]>> =
        shoulders && single ? { ...observedShoulderOffsets(images[0], worlds[0], mirror) } : {}
      const directions = single
        ? {
            ...observedLimbDirections(images[0], worlds[0], mirror),
            ...(permitted.has(OBSERVED_TRUNK_BINDING.bone) ? trunk : {}),
          }
        : {}
      const selected: Record<string, readonly number[]> = {}
      for (const [name, value] of Object.entries(directions)) {
        const length = Math.hypot(...value)
        if (permitted.has(name) && Number.isFinite(length) && length > 0)
          selected[name] = value.map((component) => component / length)
      }
      const completeBody =
        !!(head || hands) &&
        single &&
        [images[0], worlds[0]].every((points) =>
          Array.from<Point>(points).every(
            (point) => point && [point.x, point.y, point.z].every(Number.isFinite),
          ),
        )
      // Absent face revokes coverage. It never samples a neutral reference or chooses
      // a face for an ambiguous body; even a valid tuple is not identity proof.
      const supplied = head && completeBody ? result.headOrientation : null
      const rotation = Array.isArray(supplied) ? Array.from(supplied) : null
      const copiedHands = hands && completeBody ? copyHandObservations(result.hands) : []
      if (closed || signal.aborted || pending !== token) return false
      const trunkSample = trunk[OBSERVED_TRUNK_BINDING.bone]
      if (samples && trunkSample) {
        samples.sum.add(new Vector3(trunkSample[0], trunkSample[1], trunkSample[2]).normalize())
        if (++samples.count >= UPRIGHT_SAMPLES) {
          const mean = samples.sum.normalize()
          samples = null
          // Minimal swing to vertical: removes pitch/roll only, never the user's facing (yaw).
          if (mean.lengthSq() > 0 && (mean.angleTo(UP) * 180) / Math.PI <= MAX_UPRIGHT_TILT_DEG) {
            correction = new Quaternion().setFromUnitVectors(mean, UP)
            upright = 'applied'
          } else upright = 'rejected'
        }
      }
      if (shoulderSamples) {
        for (const bone of OBSERVED_CLAVICLES) {
          const offset = offsets[bone]
          if (!offset) continue
          shoulderSamples[bone].sum.add(new Vector3(offset[0], offset[1], offset[2]))
          shoulderSamples[bone].count++
        }
        const done = shoulderSamples
        if (OBSERVED_CLAVICLES.every((bone) => done[bone].count >= UPRIGHT_SAMPLES)) {
          shoulderReference = {
            clavicleL: done.clavicleL.sum.divideScalar(done.clavicleL.count),
            clavicleR: done.clavicleR.sum.divideScalar(done.clavicleR.count),
          }
          shoulderSamples = null
        }
      }
      if (correction) {
        for (const [name, value] of Object.entries(selected))
          selected[name] = rotate(value, correction)
        for (const [name, value] of Object.entries(laterals))
          laterals[name] = rotate(value, correction)
      }
      if (filter) {
        shapeHinges(selected)
        for (const [name, value] of Object.entries(selected))
          selected[name] = filter.apply(`d:${name}`, at, value)
        for (const [name, value] of Object.entries(laterals))
          laterals[name] = filter.apply(`l:${name}`, at, value)
      }
      const angles: Partial<Record<ClavicleBone, number>> = {}
      if (shoulderReference) {
        const reference = shoulderReference
        const level = correction ?? new Quaternion()
        const height = (value: readonly number[]) => -rotate(value, level)[1]
        const span = reference.clavicleL.distanceTo(reference.clavicleR) / 2
        for (const bone of OBSERVED_CLAVICLES) {
          const offset = offsets[bone]
          if (!offset) continue
          const raised = height(reference[bone].toArray()) - height(offset)
          const angle = elevationAngle(raised, span)
          if (angle === null) continue
          angles[bone] = filter ? filter.apply(`c:${bone}`, at, [angle])[0] : angle
        }
      }
      const accepted = driver.push({
        generation: suppliedGeneration,
        sequence,
        at,
        directions: selected,
        ...(Object.keys(laterals).length ? { laterals } : {}),
      })
      if (
        shoulders &&
        (!accepted || !shoulders.push({ generation: suppliedGeneration, sequence, at, angles }))
      ) {
        dispose()
        return false
      }
      if (
        head &&
        (!accepted || !head.push({ generation: suppliedGeneration, sequence, at, rotation }))
      ) {
        dispose()
        return false
      }
      if (
        hands &&
        (!accepted ||
          !hands.push({ generation: suppliedGeneration, sequence, at, hands: copiedHands }))
      ) {
        dispose()
        return false
      }
      if (accepted && !closed && !signal.aborted && pending === token)
        coverage = Object.freeze({
          generation: suppliedGeneration,
          sequence,
          at,
          bones: Object.freeze(Object.keys(selected)),
        })
      return accepted
    } catch {
      // No provider/native exception or point data escapes this boundary.
      dispose()
      return false
    }
  }
  function render(now: number, deltaMs: number) {
    if (Number.isFinite(now) && now >= lastNow && Number.isFinite(deltaMs) && deltaMs >= 0)
      lastNow = now
    const body = driver.render(now, deltaMs)
    shoulders?.render(now, deltaMs)
    return Object.freeze({
      ...body,
      ...(head ? { head: head.render(now, deltaMs) } : {}),
      ...(hands ? { hands: hands.render(now, deltaMs) } : {}),
    })
  }
  /** Samples the next trusted trunk directions as "standing upright"; earlier correction is kept
   * until that completes, and kept again if the sampled body is too tilted to be upright. */
  function calibrateUpright() {
    if (closed || signal.aborted) return false
    samples = { sum: new Vector3(), count: 0 }
    if (shoulders)
      shoulderSamples = {
        clavicleL: { sum: new Vector3(), count: 0 },
        clavicleR: { sum: new Vector3(), count: 0 },
      }
    upright = 'pending'
    return true
  }
  return Object.freeze({
    observe,
    render,
    calibrateUpright,
    getUprightCalibration: () => upright,
    getCoverage: () => (closed || signal.aborted ? null : coverage),
    dispose,
  })
}
