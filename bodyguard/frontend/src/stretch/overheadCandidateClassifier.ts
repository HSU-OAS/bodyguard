// FR-S-02/04·FR-M-07: designated arm and compensations; no clinical/release authority.
import { observeArmOverhead } from '../posture/armOverheadObservation'
import type { ShrugFrame } from '../posture/shoulderShrugObservation'
import {
  compareNeckScalar as compare,
  copyOverheadReviewCriteria,
  type OverheadReviewCriteria,
  type ReviewBand,
} from '../posture/thresholds'
import type { CoachingState, ObservationClass } from './progression'

export type OverheadCandidateError =
  | 'overhead-head'
  | 'overhead-trunk'
  | 'overhead-other-arm'
  | 'overhead-elbow'
  | 'overhead-range'
export type OverheadCandidateDecision = Readonly<{
  scope: 'image-plane-candidate-only'
  generation: number
  sequence: number
  sampledAt: number
  personCount: number
  stepId: 'left' | 'right'
  classification: ObservationClass
  errors: readonly OverheadCandidateError[]
}>
const inside = (n: number, band: ReviewBand) => compare(n, band[0]) >= 0 && compare(n, band[1]) <= 0
export function createOverheadCandidateClassifier(
  value: OverheadReviewCriteria,
  generation: number,
) {
  const criteria = copyOverheadReviewCriteria(value)
  if (!Number.isSafeInteger(generation) || generation <= 0)
    throw new Error('Invalid overhead candidate criteria')
  let sequence = -1,
    at = -Infinity,
    lastNow = -Infinity,
    closed = false,
    busy = false
  return Object.freeze({
    classify(
      frame: ShrugFrame,
      now: number,
      request: Readonly<{ stepId: 'left' | 'right'; phase: CoachingState['phase'] }>,
    ): OverheadCandidateDecision | null {
      if (closed) return null
      if (busy) {
        closed = true
        return null
      }
      busy = true
      try {
        const { stepId, phase } = request
        if (
          !['left', 'right'].includes(stepId) ||
          !['waiting-start', 'seeking-target', 'holding', 'waiting-return'].includes(phase)
        )
          return null
        if (!Number.isFinite(now) || now < 0 || now > Number.MAX_SAFE_INTEGER || now < lastNow) {
          closed = true
          return null
        }
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
          personCount = Array.isArray(landmarks) ? landmarks.length : 0,
          observed = observeArmOverhead({
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
          errors: OverheadCandidateError[] = [],
        ): OverheadCandidateDecision | null =>
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
        const left = {
            upper: observed.leftUpperArmDownRad,
            elbow: observed.leftElbowRad,
            wrist: observed.leftWristAboveFaceHipWidths,
          },
          right = {
            upper: observed.rightUpperArmDownRad,
            elbow: observed.rightElbowRad,
            wrist: observed.rightWristAboveFaceHipWidths,
          },
          active = stepId === 'left' ? left : right,
          other = stepId === 'left' ? right : left,
          neutral = (arm: typeof left) =>
            inside(arm.upper, criteria.neutralUpperArmDownRad) &&
            inside(arm.elbow, criteria.neutralElbowRad) &&
            inside(arm.wrist, criteria.neutralWristAboveFace)
        const errors: OverheadCandidateError[] = []
        if (
          !inside(observed.headHipLineAngleRad, criteria.headAxisRad) ||
          !inside(observed.headHeightHipWidths, criteria.headHeight) ||
          !inside(observed.headOffsetAlongHip, criteria.headAlongHip)
        )
          errors.push('overhead-head')
        if (
          !inside(observed.hipImageAngleRad, criteria.hipAxisRad) ||
          !inside(observed.trunkLeanRad, criteria.trunkLeanRad)
        )
          errors.push('overhead-trunk')
        if (!neutral(other)) errors.push('overhead-other-arm')
        if (errors.length) return decision('unmet', errors)
        if (neutral(active))
          return decision(
            phase === 'waiting-start'
              ? 'start'
              : phase === 'waiting-return'
                ? 'returned'
                : 'moving',
          )
        if (
          compare(active.upper, criteria.targetUpperArmDownRad[1]) > 0 ||
          compare(active.wrist, criteria.targetWristAboveFace[1]) > 0 ||
          compare(active.wrist, criteria.neutralWristAboveFace[0]) < 0
        )
          return decision('unmet', ['overhead-range'])
        if (
          inside(active.upper, criteria.targetUpperArmDownRad) &&
          !inside(active.elbow, criteria.targetElbowRad)
        )
          return decision('unmet', ['overhead-elbow'])
        if (
          inside(active.upper, criteria.targetUpperArmDownRad) &&
          inside(active.wrist, criteria.targetWristAboveFace) &&
          inside(active.elbow, criteria.targetElbowRad)
        )
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
