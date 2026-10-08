// FR-A-01/03·FR-M-02/07: one provider result, private directional display only.
import type { Object3D } from 'three'
import { JOINT_COUNT, type Point } from '../posture/landmarks'
import {
  createDirectionalRig,
  OBSERVED_LIMB_BINDINGS,
  observedLimbDirections,
} from './directionalRig'
import { createHeadRotationRig, type HeadDisplayAlignment } from './headOrientationRig'

export type PoseRigFrame = Readonly<{
  generation: number
  sequence: number
  at: number
  result: Readonly<{
    landmarks: readonly (readonly Point[])[]
    worldLandmarks: readonly (readonly Point[])[]
    // Optional private face orientation from the same input, NOT matched identity/neck pose.
    headOrientation?: readonly number[] | null
  }>
}>
type Options = Parameters<typeof createDirectionalRig>[1] &
  Readonly<{ mirror: boolean; head?: HeadDisplayAlignment }>
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
        !OBSERVED_LIMB_BINDINGS.some(
          (binding) => binding.bone === bone && binding.anchor === anchor,
        ),
    )
  )
    throw new Error('Invalid observed pose rig')
  const driver = createDirectionalRig(model, options)
  let head: ReturnType<typeof createHeadRotationRig> | undefined
  try {
    if (options.head)
      head = createHeadRotationRig(model, {
        ...options.head,
        context: options.context,
        mirror,
        halfLifeMs: options.halfLifeMs,
        maxAgeMs,
      })
  } catch {
    driver.dispose()
    throw new Error('Invalid observed pose rig')
  }
  const permitted = new Set(options.bindings.map(({ bone }) => bone))
  let closed = false
  let lastSequence = 0
  let lastAt = -Infinity
  let lastNow = -Infinity
  let pending: object | undefined

  function dispose() {
    if (closed) return
    closed = true
    pending = undefined
    driver.dispose()
    head?.dispose()
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
        (head && at === lastAt) ||
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
      const directions = single ? observedLimbDirections(images[0], worlds[0], mirror) : {}
      const selected: Record<string, readonly number[]> = {}
      for (const [name, value] of Object.entries(directions)) {
        const length = Math.hypot(...value)
        if (permitted.has(name) && Number.isFinite(length) && length > 0)
          selected[name] = value.map((component) => component / length)
      }
      const completeBody =
        !!head &&
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
      if (closed || signal.aborted || pending !== token) return false
      const accepted = driver.push({
        generation: suppliedGeneration,
        sequence,
        at,
        directions: selected,
      })
      if (
        head &&
        (!accepted || !head.push({ generation: suppliedGeneration, sequence, at, rotation }))
      ) {
        dispose()
        return false
      }
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
    return Object.freeze({ ...body, ...(head ? { head: head.render(now, deltaMs) } : {}) })
  }
  return Object.freeze({ observe, render, dispose })
}
