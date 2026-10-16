// FR-S-01/02/04·FR-M-02/07: same-frame image-plane candidate, never a release/clinical gate.
import { observeCapturedNeckSide } from '../posture/neckSideObservation'
import {
  compareNeckScalar,
  copyNeckReviewCriteria,
  type NeckReviewCriteria,
  type ReviewBand,
} from '../posture/thresholds'
import type { CoachingState, ObservationClass } from './progression'

type Input = Parameters<typeof observeCapturedNeckSide>[0]['frame']
export type NeckCandidateError =
  | 'neck-shoulder-line'
  | 'neck-head-position'
  | 'neck-wrong-direction'
  | 'neck-range'
export type NeckCandidateDecision = Readonly<{
  scope: 'image-plane-candidate-only'
  generation: number
  sequence: number
  sampledAt: number
  personCount: number
  stepId: 'left' | 'right'
  classification: ObservationClass
  errors: readonly NeckCandidateError[]
}>
const inside = (n: number, band: ReviewBand) =>
  compareNeckScalar(n, band[0]) >= 0 && compareNeckScalar(n, band[1]) <= 0
// A shoulder line is axial: +π/-π represent the same line, not a180° compensation.
const axial = (n: number) => Math.atan2(Math.sin(2 * n), Math.cos(2 * n)) / 2
export function createNeckCandidateClassifier(value: NeckReviewCriteria, generation: number) {
  const criteria = copyNeckReviewCriteria(value)
  if (!Number.isSafeInteger(generation) || generation <= 0)
    throw new Error('Invalid neck candidate criteria')
  let lastSequence = -1,
    lastAt = -Infinity,
    lastNow = -Infinity,
    closed = false
  return Object.freeze({
    classify(
      frame: Input,
      now: number,
      request: Readonly<{ stepId: 'left' | 'right'; phase: CoachingState['phase'] }>,
    ): NeckCandidateDecision | null {
      if (closed) return null
      try {
        const { stepId, phase } = request
        if (
          !['left', 'right'].includes(stepId) ||
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
          stamp.sequence > lastSequence &&
          (!Number.isFinite(stamp.sampledAt) || stamp.sampledAt < 0 || stamp.sampledAt > now)
        ) {
          // Do not later accrue a target interval across a current owner's broken capture clock.
          closed = true
          return null
        }
        if (
          stamp.generation !== generation ||
          !Number.isSafeInteger(stamp.sequence) ||
          stamp.sequence < 0 ||
          stamp.sequence <= lastSequence ||
          !Number.isFinite(stamp.sampledAt) ||
          stamp.sampledAt < 0 ||
          stamp.sampledAt <= lastAt ||
          stamp.sampledAt > now
        )
          return null
        const gap = stamp.sampledAt - lastAt
        lastSequence = stamp.sequence
        lastAt = stamp.sampledAt
        const people = frame.result.landmarks
        const personCount =
          Array.isArray(people) && Number.isSafeInteger(people.length) ? people.length : 0
        const decision = (
          classification: ObservationClass,
          errors: NeckCandidateError[] = [],
        ): NeckCandidateDecision =>
          Object.freeze({
            scope: criteria.scope,
            ...stamp,
            personCount,
            stepId,
            classification,
            errors: Object.freeze(errors),
          })
        const observed = observeCapturedNeckSide({
          frame,
          now,
          minimumConfidence: criteria.minimumConfidence,
          maxAgeMs: criteria.maxFrameAgeMs,
        })
        if (
          observed.status !== 'available' ||
          (Number.isFinite(gap) && gap > criteria.maxFrameGapMs)
        )
          return decision('unobservable')
        const errors: NeckCandidateError[] = []
        if (!inside(axial(observed.shoulderImageAngleRad), criteria.shoulderAxisRad))
          errors.push('neck-shoulder-line')
        if (
          !inside(observed.headOffsetAlongShoulder, criteria.headAlongShoulder) ||
          !inside(observed.headOffsetNormalToShoulder, criteria.headNormalToShoulder)
        )
          errors.push('neck-head-position')
        if (errors.length) return decision('unmet', errors)
        const angle = observed.headShoulderLineAngleRad,
          neutral = criteria.neutralHeadRad,
          target = stepId === 'left' ? criteria.leftHeadRad : criteria.rightHeadRad
        if (inside(angle, neutral))
          return decision(
            phase === 'waiting-return'
              ? 'returned'
              : phase === 'waiting-start'
                ? 'start'
                : 'moving',
          )
        const positive = target[0] > neutral[1]
        if (
          (positive && compareNeckScalar(angle, neutral[0]) < 0) ||
          (!positive && compareNeckScalar(angle, neutral[1]) > 0)
        )
          return decision('unmet', ['neck-wrong-direction'])
        if (
          (positive && compareNeckScalar(angle, target[1]) > 0) ||
          (!positive && compareNeckScalar(angle, target[0]) < 0)
        )
          return decision('unmet', ['neck-range'])
        if (inside(angle, target)) return decision(phase === 'waiting-start' ? 'unmet' : 'target')
        return decision(phase === 'holding' ? 'unmet' : 'moving')
      } catch {
        closed = true
        return null
      }
    },
    close() {
      closed = true
    },
  })
}
