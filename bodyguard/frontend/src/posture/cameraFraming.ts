// FR-M-07: private technical camera coverage, never clinical/coaching authorization.
import { REQUIRED_JOINTS } from './framing'
import { JOINT_COUNT, type Point, trustedJoints } from './landmarks'

export type FramingRequirement =
  | 'head-shoulders'
  | 'head-torso'
  | 'arms'
  | 'upper-body'
  | 'full-body'
export type CameraFramingStatus = 'waiting' | 'position' | 'one-person' | 'adjust' | 'in-frame'
const required: Record<FramingRequirement, readonly number[]> = {
  'head-shoulders': REQUIRED_JOINTS.seated,
  'head-torso': [...REQUIRED_JOINTS.seated, 23, 24],
  arms: [11, 12, 13, 14, 15, 16],
  'upper-body': [...REQUIRED_JOINTS.seated, 13, 14, 15, 16, 23, 24],
  'full-body': REQUIRED_JOINTS.standing,
}
const motions: Readonly<Record<string, FramingRequirement>> = Object.freeze({
  'neck-side': 'head-shoulders',
  'chin-retraction': 'head-shoulders',
  'shoulder-shrug': 'head-torso',
  'cross-body-shoulder': 'arms',
  'arm-overhead': 'upper-body',
  'lateral-trunk': 'upper-body',
  'seated-trunk-rotation': 'head-torso',
})
export function motionFramingRequirement(id: string): FramingRequirement | null {
  return Object.hasOwn(motions, id) ? motions[id] : null
}
type Frame = Readonly<{
  generation: number
  sequence: number
  at: number
  result: Readonly<{ landmarks: readonly (readonly Point[])[] }>
}>
// Reuse the DEV observer tool's one-second input bound; not an accepted product threshold.
const INPUT_AGE_MS = 1000
export function createCameraFraming(requirement: FramingRequirement) {
  let generation: number | null = null,
    sequence = 0,
    lastAt = -Infinity
  let state: CameraFramingStatus = 'waiting',
    sampledAt: number | null = null
  const fresh = (at: number, now: number) =>
    Number.isFinite(at) && at >= 0 && Number.isFinite(now) && now >= at && now - at < INPUT_AGE_MS
  function accept(frame: Frame, now: number) {
    // Revoke first. No malformed/ambiguous new input leaves the previous positive state alive.
    state = 'waiting'
    sampledAt = null
    try {
      const suppliedGeneration = frame.generation,
        suppliedSequence = frame.sequence,
        at = frame.at
      if (
        !Number.isSafeInteger(suppliedGeneration) ||
        suppliedGeneration <= 0 ||
        (generation !== null && suppliedGeneration !== generation) ||
        !Number.isSafeInteger(suppliedSequence) ||
        suppliedSequence <= sequence ||
        at <= lastAt ||
        !fresh(at, now)
      )
        return
      generation = suppliedGeneration
      sequence = suppliedSequence
      lastAt = at
      const poses = frame.result.landmarks
      if (!Array.isArray(poses) || poses.length > 2) return
      if (poses.length === 0) state = 'position'
      else if (poses.length > 1) state = 'one-person'
      else {
        const image = poses[0]
        if (!Array.isArray(image) || image.length !== JOINT_COUNT) return
        const trusted = trustedJoints(
          image.map((p) => (p && typeof p === 'object' ? p : undefined)),
        )
        state = required[requirement].every((joint) => trusted[joint]) ? 'in-frame' : 'adjust'
      }
      sampledAt = at
    } catch {
      state = 'waiting'
      sampledAt = null
    }
  }
  function read(now: number): CameraFramingStatus {
    if (sampledAt === null || !fresh(sampledAt, now)) {
      state = 'waiting'
      sampledAt = null
    }
    return state
  }
  // No original arrays, joint indices, numeric measurements or success values escape.
  return Object.freeze({ accept, read })
}
