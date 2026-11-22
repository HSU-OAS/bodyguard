import { MIN_VISIBILITY } from './landmarks'
import { observeCapturedNeckSide } from './neckSideObservation'

export type NeckDirection = 'left' | 'right' | 'center'
type Frame = Parameters<typeof observeCapturedNeckSide>[0]['frame']

const MAX_FRAME_AGE_MS = 1000
// Filter small display changes around the user's own reference. These are no posture limits.
const DISPLAY_DEADBAND_RAD = Math.PI / 60

function directionOfRotation(delta: number): NeckDirection {
  // Unoriented image lines repeat every half turn.
  const angle = Math.atan2(Math.sin(2 * delta), Math.cos(2 * delta)) / 2
  if (angle < -DISPLAY_DEADBAND_RAD) return 'left'
  if (angle > DISPLAY_DEADBAND_RAD) return 'right'
  return 'center'
}

export function createNeckDirectionReview(generation: number) {
  let reference: { relative: number; image: number } | null = null
  let requestedAt: number | null = null
  let sequence = 0
  let sampledAt = -Infinity
  let candidate: NeckDirection | 'ambiguous' | null = null
  let stableFrames = 0

  return {
    align(now: number) {
      reference = null
      requestedAt = now
      candidate = null
      stableFrames = 0
    },
    observe(frame: Frame, now: number) {
      if (
        frame.generation !== generation ||
        !Number.isSafeInteger(frame.sequence) ||
        frame.sequence <= sequence
      )
        return
      sequence = frame.sequence
      if (reference !== null && frame.result.landmarks.length !== 1) reference = null
      const next = observeCapturedNeckSide({
        frame,
        now,
        minimumConfidence: MIN_VISIBILITY,
        maxAgeMs: MAX_FRAME_AGE_MS,
      })
      if (next.status !== 'available' || next.at <= sampledAt) {
        candidate = null
        stableFrames = 0
        return
      }
      if (next.at - sampledAt > MAX_FRAME_AGE_MS) {
        reference = null
        stableFrames = 0
      }
      sampledAt = next.at
      const relative = next.headShoulderLineAngleRad
      const image = relative + next.shoulderImageAngleRad
      if (reference === null) {
        if (requestedAt === null || next.at < requestedAt || now - requestedAt > MAX_FRAME_AGE_MS)
          return
        reference = { relative, image }
        requestedAt = null
      }
      const relativeDirection = directionOfRotation(relative - reference.relative)
      const imageDirection = directionOfRotation(image - reference.image)
      // A shoulder-only change can swing the relative angle without moving the head.
      const direction =
        relativeDirection === 'center' || relativeDirection === imageDirection
          ? relativeDirection
          : 'ambiguous'
      stableFrames = direction === candidate ? Math.min(3, stableFrames + 1) : 1
      candidate = direction
    },
    read(now: number) {
      if (reference === null) return { state: 'waiting' as const }
      if (now < sampledAt || now - sampledAt > MAX_FRAME_AGE_MS || !candidate)
        return { state: 'unavailable' as const }
      if (candidate === 'ambiguous' || stableFrames < 3) return { state: 'settling' as const }
      return { state: 'observed' as const, direction: candidate }
    },
  }
}
