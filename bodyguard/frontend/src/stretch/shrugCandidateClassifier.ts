// FR-S-02/04·FR-M-07: two-shoulder rise and compensation, never clinical/release authority.
import { observeShoulderShrug, type ShrugFrame } from '../posture/shoulderShrugObservation'
import {
  compareNeckScalar as compare,
  copyShrugReviewCriteria,
  type ReviewBand,
  type ShrugReviewCriteria,
} from '../posture/thresholds'
import type { CoachingState, ObservationClass } from './progression'

export type ShrugCandidateError =
  | 'shrug-head'
  | 'shrug-trunk'
  | 'shrug-arms'
  | 'shrug-asymmetry'
  | 'shrug-range'
export type ShrugCandidateDecision = Readonly<{
  scope: 'image-plane-candidate-only'
  generation: number
  sequence: number
  sampledAt: number
  personCount: number
  stepId: 'both'
  classification: ObservationClass
  errors: readonly ShrugCandidateError[]
}>
const inside = (n: number, b: ReviewBand) => compare(n, b[0]) >= 0 && compare(n, b[1]) <= 0
export function createShrugCandidateClassifier(value: ShrugReviewCriteria, generation: number) {
  const criteria = copyShrugReviewCriteria(value)
  if (!Number.isSafeInteger(generation) || generation <= 0)
    throw new Error('Invalid shrug candidate criteria')
  let sequence = -1,
    at = -Infinity,
    lastNow = -Infinity,
    closed = false,
    busy = false
  return Object.freeze({
    classify(
      frame: ShrugFrame,
      now: number,
      request: Readonly<{ stepId: 'both'; phase: CoachingState['phase'] }>,
    ): ShrugCandidateDecision | null {
      if (closed) return null
      // A foreign getter cannot consume a newer frame in the middle of this owner's decision.
      if (busy) {
        closed = true
        return null
      }
      busy = true
      try {
        const { stepId, phase } = request
        if (
          stepId !== 'both' ||
          !['waiting-start', 'seeking-target', 'holding', 'waiting-return'].includes(phase) ||
          !Number.isFinite(now) ||
          now < 0 ||
          now > Number.MAX_SAFE_INTEGER ||
          now < lastNow
        )
          return null
        lastNow = now
        const stamp = {
          generation: frame.generation,
          sequence: frame.sequence,
          sampledAt: frame.at,
        }
        if (
          stamp.generation === generation &&
          Number.isSafeInteger(stamp.sequence) &&
          stamp.sequence > sequence &&
          (!Number.isFinite(stamp.sampledAt) || stamp.sampledAt < 0 || stamp.sampledAt > now)
        ) {
          closed = true
          return null
        }
        if (
          stamp.generation !== generation ||
          !Number.isSafeInteger(stamp.sequence) ||
          stamp.sequence < 0 ||
          stamp.sequence <= sequence ||
          !Number.isFinite(stamp.sampledAt) ||
          stamp.sampledAt <= at ||
          stamp.sampledAt > now
        )
          return null
        const gap = stamp.sampledAt - at
        sequence = stamp.sequence
        at = stamp.sampledAt
        const landmarks = frame.result.landmarks,
          personCount = Array.isArray(landmarks) ? landmarks.length : 0
        const observed = observeShoulderShrug({
          frame: {
            generation: stamp.generation,
            sequence: stamp.sequence,
            at: stamp.sampledAt,
            image: frame.image,
            result: { landmarks },
          },
          now,
          minimumConfidence: criteria.minimumConfidence,
          maxAgeMs: criteria.maxFrameAgeMs,
        })
        const decision = (
          classification: ObservationClass,
          errors: ShrugCandidateError[] = [],
        ): ShrugCandidateDecision | null =>
          closed
            ? null
            : Object.freeze({
                scope: criteria.scope,
                ...stamp,
                personCount,
                stepId,
                classification,
                errors: Object.freeze(errors),
              })
        if (
          observed.status !== 'available' ||
          (Number.isFinite(gap) && gap > criteria.maxFrameGapMs)
        )
          return decision('unobservable')
        const errors: ShrugCandidateError[] = []
        if (
          !inside(observed.headHipLineAngleRad, criteria.headAxisRad) ||
          !inside(observed.headHeightHipWidths, criteria.headHeight) ||
          !inside(observed.headOffsetAlongHip, criteria.headAlongHip)
        )
          errors.push('shrug-head')
        if (
          !inside(observed.hipImageAngleRad, criteria.hipAxisRad) ||
          !inside(observed.trunkLeanRad, criteria.trunkLeanRad)
        )
          errors.push('shrug-trunk')
        if (
          !inside(observed.leftUpperArmDownRad, criteria.upperArmDownRad) ||
          !inside(observed.rightUpperArmDownRad, criteria.upperArmDownRad)
        )
          errors.push('shrug-arms')
        if (!inside(observed.shoulderDifferenceHipWidths, criteria.shoulderDifference))
          errors.push('shrug-asymmetry')
        if (errors.length) return decision('unmet', errors)
        const left = observed.leftShoulderHeightHipWidths,
          right = observed.rightShoulderHeightHipWidths
        if (inside(left, criteria.neutralLeftHeight) && inside(right, criteria.neutralRightHeight))
          return decision(
            phase === 'waiting-start'
              ? 'start'
              : phase === 'waiting-return'
                ? 'returned'
                : 'moving',
          )
        if (
          compare(left, criteria.neutralLeftHeight[0]) < 0 ||
          compare(right, criteria.neutralRightHeight[0]) < 0 ||
          compare(left, criteria.targetLeftHeight[1]) > 0 ||
          compare(right, criteria.targetRightHeight[1]) > 0
        )
          return decision('unmet', ['shrug-range'])
        if (inside(left, criteria.targetLeftHeight) && inside(right, criteria.targetRightHeight))
          return decision(phase === 'waiting-start' ? 'unmet' : 'target')
        return decision(phase === 'holding' ? 'unmet' : 'moving')
      } catch {
        closed = true
        return null
      } finally {
        busy = false
      }
    },
    close() {
      closed = true
    },
  })
}
