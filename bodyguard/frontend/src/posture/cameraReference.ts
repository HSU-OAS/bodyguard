// FR-M-03/FR-M-07: a three-second image-plane reference draft, not a correct-pose verdict.
import { MIN_VISIBILITY } from './landmarks'
import { observeCapturedNeckSide } from './neckSideObservation'

type Frame = Parameters<typeof observeCapturedNeckSide>[0]['frame']
export type CameraReferenceDraft = Readonly<{
  method: 'image-plane-shoulder-axial-v1'
  unit: 'deg'
  value: number
  observedRangeDeg: number
  sampleCount: number
}>
export type CameraReferenceState = Readonly<
  | { phase: 'idle' }
  | { phase: 'collecting'; elapsedMs: number }
  | { phase: 'review'; draft: CameraReferenceDraft }
  | { phase: 'error' }
>
const DURATION_MS = 3000
// Same existing development input bound/confidence, not clinical stability thresholds.
const INPUT_AGE_MS = 1000
const angle = (value: number) => ((((value + 90) % 180) + 180) % 180) - 90

/** Stores bounded scalar sums only. Never keeps a frame, coordinate list or sample history.
 * Review is NOT automatic calibration acceptance: the user sees the observed variation.
 * No anatomical neck/trunk metric, stability cut-off or positive coaching gate is invented.
 */
export function createCameraReference() {
  let state: CameraReferenceState = Object.freeze({ phase: 'idle' })
  let generation: number | null = null,
    sequence = -1,
    firstAt: number | null = null,
    lastAt = -1,
    startedAt = -1,
    firstAngle = 0,
    low = 0,
    high = 0,
    sin = 0,
    cos = 0,
    count = 0
  function clear() {
    generation = null
    sequence = -1
    firstAt = null
    lastAt = -1
    startedAt = -1
    firstAngle = low = high = sin = cos = count = 0
  }
  function reset() {
    clear()
    state = Object.freeze({ phase: 'idle' })
  }
  function fail() {
    clear()
    state = Object.freeze({ phase: 'error' })
  }
  function begin(now: number) {
    reset()
    if (!Number.isFinite(now) || now < 0 || now > Number.MAX_SAFE_INTEGER) return fail()
    startedAt = now
    state = Object.freeze({ phase: 'collecting', elapsedMs: 0 })
  }
  function accept(frame: Frame, now: number) {
    if (state.phase !== 'collecting') return
    try {
      const observed = observeCapturedNeckSide({
        frame,
        now,
        minimumConfidence: MIN_VISIBILITY,
        maxAgeMs: INPUT_AGE_MS,
      })
      if (observed.status === 'available' && observed.at < startedAt) return
      if (
        observed.status !== 'available' ||
        now - observed.at >= INPUT_AGE_MS ||
        (generation !== null && generation !== observed.generation) ||
        observed.sequence <= sequence ||
        observed.at <= lastAt ||
        (firstAt !== null && observed.at - lastAt >= INPUT_AGE_MS)
      )
        return fail()
      const degrees = angle((observed.shoulderImageAngleRad * 180) / Math.PI)
      if (firstAt === null) {
        firstAt = observed.at
        firstAngle = degrees
      }
      generation = observed.generation
      sequence = observed.sequence
      lastAt = observed.at
      const delta = angle(degrees - firstAngle)
      low = Math.min(low, delta)
      high = Math.max(high, delta)
      sin += Math.sin((degrees * Math.PI) / 90)
      cos += Math.cos((degrees * Math.PI) / 90)
      count++
      const elapsedMs = Math.min(DURATION_MS, observed.at - firstAt)
      if (elapsedMs < DURATION_MS) {
        state = Object.freeze({ phase: 'collecting', elapsedMs })
        return
      }
      // Reject an undefined circular mean at numerical roundoff, not a medical cut-off.
      if (Math.hypot(sin, cos) <= count * Number.EPSILON * 64) return fail()
      const draft = Object.freeze({
        method: 'image-plane-shoulder-axial-v1' as const,
        unit: 'deg' as const,
        value: angle((Math.atan2(sin, cos) * 90) / Math.PI),
        observedRangeDeg: high - low,
        sampleCount: count,
      })
      clear()
      state = Object.freeze({ phase: 'review', draft })
    } catch {
      fail()
    }
  }
  function read(now: number) {
    if (
      state.phase === 'collecting' &&
      (!Number.isFinite(now) ||
        now < Math.max(startedAt, lastAt) ||
        now > Number.MAX_SAFE_INTEGER ||
        now - (firstAt === null ? startedAt : lastAt) >= INPUT_AGE_MS)
    )
      fail()
    return state
  }
  return Object.freeze({ begin, accept, read, reset })
}
