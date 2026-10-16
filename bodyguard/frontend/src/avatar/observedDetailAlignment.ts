// FR-A-01/03·FR-M-07: explicit per-session display reference, never correct-pose calibration.

import { JOINT_COUNT } from '../posture/landmarks'
import type { HeadDisplayAlignment } from './headOrientationRig'
import { type HandDisplayAlignment, readHandCameraReferences } from './observedHandRig'
import type { PoseRigFrame } from './observedPoseRig'

export type DetailAlignment = Readonly<{
  head?: HeadDisplayAlignment
  hands?: HandDisplayAlignment
}>
const sceneFromCamera = Object.freeze([0, 0, 0, 1])

export function hasSingleDisplayBody(frame: PoseRigFrame): boolean {
  try {
    return [frame.result.landmarks, frame.result.worldLandmarks].every(
      (people) =>
        Array.isArray(people) &&
        people.length === 1 &&
        Array.isArray(people[0]) &&
        people[0].length === JOINT_COUNT &&
        Array.from(people[0]).every((p) => p && [p.x, p.y, p.z].every(Number.isFinite)),
    )
  } catch {
    return false
  }
}

export function readDetailAlignment(
  frame: PoseRigFrame,
  generation: number,
  now: number,
  maxAgeMs: number,
): DetailAlignment | null {
  try {
    if (
      !Number.isSafeInteger(generation) ||
      generation <= 0 ||
      frame.generation !== generation ||
      !Number.isSafeInteger(frame.sequence) ||
      frame.sequence <= 0 ||
      !Number.isFinite(frame.at) ||
      frame.at < 0 ||
      !Number.isFinite(now) ||
      now < frame.at ||
      !Number.isFinite(maxAgeMs) ||
      maxAgeMs <= 0 ||
      now - frame.at > maxAgeMs ||
      !hasSingleDisplayBody(frame)
    )
      return null
    const supplied = frame.result.headOrientation
    const rotation = Array.isArray(supplied) ? Array.from(supplied) : []
    const head =
      rotation.length === 4 &&
      rotation.every(Number.isFinite) &&
      Math.abs(Math.hypot(...rotation) - 1) <= 1e-5
        ? Object.freeze({ bone: 'head', cameraReference: Object.freeze(rotation), sceneFromCamera })
        : undefined
    const references = readHandCameraReferences(frame.result.hands)
    const hands = references
      ? Object.freeze({ cameraReferences: references, sceneFromCamera })
      : undefined
    return head || hands
      ? Object.freeze({ ...(head ? { head } : {}), ...(hands ? { hands } : {}) })
      : null
  } catch {
    return null
  }
}
