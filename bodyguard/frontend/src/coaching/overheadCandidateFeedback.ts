// FR-S-02/04·FR-M-07: same-frame designated-arm candidate -> exact live session; no gate grant.
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import type { FeedbackFrame } from '../avatar/surfaceFeedback'
import { copyOverheadReviewCriteria, type OverheadReviewCriteria } from '../posture/thresholds'
import {
  createOverheadCandidateClassifier,
  type OverheadCandidateError,
} from '../stretch/overheadCandidateClassifier'
import type { createCoachingSession, SessionSnapshot } from './session'

type Input = Parameters<ReturnType<typeof createCoachingSession>['observe']>[0]
export type OverheadRegions = Readonly<
  Record<'left' | 'right', Readonly<Record<OverheadCandidateError, string>>>
>
const codes = [
  'overhead-head',
  'overhead-trunk',
  'overhead-other-arm',
  'overhead-elbow',
  'overhead-range',
] as const
export function createOverheadCandidateFeedback(
  options: Readonly<{
    criteria: OverheadReviewCriteria
    generation: number
    now(): number
    session: Pick<ReturnType<typeof createCoachingSession>, 'getSnapshot'>
    observe(input: Input): SessionSnapshot | null
    regions: OverheadRegions
  }>,
) {
  const criteria = copyOverheadReviewCriteria(options.criteria),
    classifier = createOverheadCandidateClassifier(criteria, options.generation),
    invalid = () => new Error('Invalid overhead candidate feedback')
  let regions: OverheadRegions
  try {
    if (Object.keys(options.regions).length !== 2) throw invalid()
    regions = Object.freeze({
      left: Object.freeze({ ...options.regions.left }),
      right: Object.freeze({ ...options.regions.right }),
    })
    for (const side of ['left', 'right'] as const) {
      if (
        Object.keys(regions[side]).length !== codes.length ||
        codes.some(
          (code) =>
            typeof regions[side][code] !== 'string' ||
            !/^[a-z][a-z0-9-]{0,63}$/.test(regions[side][code]),
        )
      )
        throw invalid()
    }
  } catch {
    throw invalid()
  }
  if (
    typeof options.now !== 'function' ||
    typeof options.observe !== 'function' ||
    typeof options.session?.getSnapshot !== 'function'
  )
    throw invalid()
  let closed = false,
    busy = false
  return Object.freeze({
    evaluate(
      frame: PoseRigFrame,
    ): Readonly<{ state: SessionSnapshot['state']; errors: FeedbackFrame['errors'] }> | null {
      if (closed) return null
      if (busy) {
        closed = true
        throw invalid()
      }
      busy = true
      try {
        const before = options.session.getSnapshot(),
          state = before.state,
          plan = state.plan,
          step = plan.steps[state.stepIndex]?.id
        if (
          before.closed ||
          state.status !== 'running' ||
          state.generation !== options.generation ||
          plan.motionId !== 'arm-overhead' ||
          plan.version !== criteria.version ||
          plan.maxFrameAgeMs !== criteria.maxFrameAgeMs ||
          plan.maxFrameGapMs !== criteria.maxFrameGapMs ||
          plan.steps.length !== 2 ||
          plan.steps[0].id !== 'left' ||
          plan.steps[1].id !== 'right' ||
          (step !== 'left' && step !== 'right')
        )
          return null
        const decision = classifier.classify(frame, options.now(), {
            stepId: step,
            phase: state.phase,
          }),
          original = options.session.getSnapshot()
        if (closed || !decision || original.closed || original.state !== state) return null
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
          throw invalid()
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
        // The accepted frame may synchronously cause pause/end through the session observer.
        if (current.closed || current.state.status !== 'running')
          return Object.freeze({ state: current.state, errors: Object.freeze([]) })
        const seen = new Set<string>()
        return Object.freeze({
          state: current.state,
          errors: Object.freeze(
            decision.errors.flatMap((code) => {
              const regionId = regions[decision.stepId][code]
              if (seen.has(regionId)) return []
              seen.add(regionId)
              return [Object.freeze({ regionId, severity: 'deviation' as const, code })]
            }),
          ),
        })
      } catch {
        closed = true
        throw invalid()
      } finally {
        busy = false
      }
    },
    close() {
      closed = true
      classifier.close()
    },
  })
}
