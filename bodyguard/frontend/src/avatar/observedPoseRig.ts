// FR-A-01/03·FR-M-02/07: one provider result, private directional display only.
import type { Object3D } from 'three'
import { JOINT_COUNT, type Point } from '../posture/landmarks'
import {
  createDirectionalRig,
  OBSERVED_LIMB_BINDINGS,
  observedLimbDirections,
} from './directionalRig'

export type PoseRigFrame = Readonly<{
  generation: number
  sequence: number
  at: number
  result: Readonly<{
    landmarks: readonly (readonly Point[])[]
    worldLandmarks: readonly (readonly Point[])[]
  }>
}>
type Options = Parameters<typeof createDirectionalRig>[1] & Readonly<{ mirror: boolean }>
/** One detectForVideo result owns both arrays. Caller preserves its capture stamps;
 * this adapter does not verify a detector, turn coverage into success, or own GPU resources.
 * A fresh empty/ambiguous result revokes coverage immediately, without resetting to a correct pose.
 */
export function createObservedPoseRig(model: Object3D, options: Options) {
  const { mirror, maxAgeMs } = options
  const { generation, signal } = options.context
  if (
    typeof mirror !== 'boolean' ||
    options.bindings.some(
      ({ bone, anchor }) =>
        !OBSERVED_LIMB_BINDINGS.some(
          (binding) => binding.bone === bone && binding.anchor === anchor,
        ),
    )
  )
    throw new Error('Invalid observed pose rig')
  const driver = createDirectionalRig(model, options)
  const permitted = new Set(options.bindings.map(({ bone }) => bone))
  let closed = false
  let lastSequence = 0
  let lastAt = -Infinity
  let lastNow = -Infinity

  function dispose() {
    if (closed) return
    closed = true
    driver.dispose()
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
        lastNow - at > maxAgeMs
      )
        return false
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
      const accepted = driver.push({
        generation: suppliedGeneration,
        sequence,
        at,
        directions: selected,
      })
      if (accepted) {
        lastSequence = sequence
        lastAt = at
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
    return driver.render(now, deltaMs)
  }
  return Object.freeze({ observe, render, dispose })
}
