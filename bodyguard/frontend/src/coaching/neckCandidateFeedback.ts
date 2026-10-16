// FR-S-02/03/04·FR-M-07: candidate classifier → exact session state/feedback; grants no gate.
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import type { FeedbackFrame } from '../avatar/surfaceFeedback'
import { copyNeckReviewCriteria, type NeckReviewCriteria } from '../posture/thresholds'
import {
  createNeckCandidateClassifier,
  type NeckCandidateError,
} from '../stretch/neckCandidateClassifier'
import type { createCoachingSession, SessionSnapshot } from './session'

type Session = Pick<ReturnType<typeof createCoachingSession>, 'getSnapshot'>
type Input = Parameters<ReturnType<typeof createCoachingSession>['observe']>[0]

export function createNeckCandidateFeedback(
  options: Readonly<{
    criteria: NeckReviewCriteria
    generation: number
    now(): number
    session: Session
    observe(input: Input): SessionSnapshot | null
    regions: Readonly<Record<NeckCandidateError, string>>
  }>,
) {
  const criteria = copyNeckReviewCriteria(options.criteria),
    classifier = createNeckCandidateClassifier(criteria, options.generation)
  let regions: Readonly<Record<NeckCandidateError, string>>
  try {
    regions = Object.freeze({ ...options.regions })
  } catch {
    throw new Error('Invalid neck candidate feedback')
  }
  if (
    Object.values(regions).length !== 4 ||
    ['neck-shoulder-line', 'neck-head-position', 'neck-wrong-direction', 'neck-range'].some(
      (k) =>
        typeof regions[k as NeckCandidateError] !== 'string' ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(regions[k as NeckCandidateError]),
    ) ||
    regions['neck-shoulder-line'] === regions['neck-head-position'] ||
    typeof options.now !== 'function' ||
    typeof options.observe !== 'function' ||
    typeof options.session?.getSnapshot !== 'function'
  )
    throw new Error('Invalid neck candidate feedback')
  let closed = false
  return Object.freeze({
    evaluate(
      frame: PoseRigFrame,
    ): Readonly<{ state: SessionSnapshot['state']; errors: FeedbackFrame['errors'] }> | null {
      if (closed) return null
      try {
        const before = options.session.getSnapshot(),
          state = before.state,
          plan = state.plan,
          step = plan.steps[state.stepIndex]?.id
        if (
          before.closed ||
          state.status !== 'running' ||
          state.generation !== options.generation ||
          plan.motionId !== 'neck-side' ||
          plan.version !== criteria.version ||
          plan.maxFrameAgeMs !== criteria.maxFrameAgeMs ||
          plan.maxFrameGapMs !== criteria.maxFrameGapMs ||
          !['left', 'right'].includes(step)
        )
          return null
        const decision = classifier.classify(frame, options.now(), {
          stepId: step as 'left' | 'right',
          phase: state.phase,
        })
        if (!decision) return null
        const after = options.observe({
          generation: decision.generation,
          sequence: decision.sequence,
          sampledAt: decision.sampledAt,
          personCount: decision.personCount,
          stepId: decision.stepId,
          classification: decision.classification,
        })
        if (after && typeof (after as unknown as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(after).catch(() => {})
          throw new Error('Invalid neck candidate feedback')
        }
        const current = options.session.getSnapshot()
        if (
          closed ||
          !after ||
          after.state !== current.state ||
          after.closed !== current.closed ||
          current.state.lastSequence !== decision.sequence ||
          current.state.lastSampledAt !== decision.sampledAt
        )
          return null
        return Object.freeze({
          state: current.state,
          errors: Object.freeze(
            decision.errors.map((code) =>
              Object.freeze({ regionId: regions[code], severity: 'deviation' as const, code }),
            ),
          ),
        })
      } catch {
        closed = true
        throw new Error('Invalid neck candidate feedback')
      }
    },
    close() {
      closed = true
      classifier.close()
    },
  })
}
