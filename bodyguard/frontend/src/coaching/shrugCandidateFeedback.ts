// FR-S-02/04·FR-M-07: bind one same-frame candidate to the exact current session, no gate bypass.
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import type { FeedbackFrame } from '../avatar/surfaceFeedback'
import { copyShrugReviewCriteria, type ShrugReviewCriteria } from '../posture/thresholds'
import {
  createShrugCandidateClassifier,
  type ShrugCandidateError,
} from '../stretch/shrugCandidateClassifier'
import type { createCoachingSession, SessionSnapshot } from './session'

type Input = Parameters<ReturnType<typeof createCoachingSession>['observe']>[0]
const codes = ['shrug-head', 'shrug-trunk', 'shrug-arms', 'shrug-asymmetry', 'shrug-range'] as const
export function createShrugCandidateFeedback(
  options: Readonly<{
    criteria: ShrugReviewCriteria
    generation: number
    now(): number
    session: Pick<ReturnType<typeof createCoachingSession>, 'getSnapshot'>
    observe(input: Input): SessionSnapshot | null
    regions: Readonly<Record<ShrugCandidateError, string>>
  }>,
) {
  const criteria = copyShrugReviewCriteria(options.criteria),
    classifier = createShrugCandidateClassifier(criteria, options.generation)
  const invalid = () => new Error('Invalid shrug candidate feedback')
  let regions: Readonly<Record<ShrugCandidateError, string>>
  try {
    regions = Object.freeze({ ...options.regions })
  } catch {
    throw invalid()
  }
  if (
    Object.keys(regions).length !== codes.length ||
    codes.some(
      (code) => typeof regions[code] !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(regions[code]),
    ) ||
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
      displayReady = true,
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
          plan.motionId !== 'shoulder-shrug' ||
          plan.version !== criteria.version ||
          plan.maxFrameAgeMs !== criteria.maxFrameAgeMs ||
          plan.maxFrameGapMs !== criteria.maxFrameGapMs ||
          plan.steps.length !== 1 ||
          step !== 'both'
        )
          return null
        const decision = classifier.classify(frame, options.now(), {
          stepId: 'both',
          phase: state.phase,
        })
        const original = options.session.getSnapshot()
        if (closed || !decision || original.closed || original.state !== state) return null
        const after = options.observe({
          generation: decision.generation,
          sequence: decision.sequence,
          sampledAt: decision.sampledAt,
          personCount: decision.personCount,
          stepId: decision.stepId,
          classification: displayReady === true ? decision.classification : 'unobservable',
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
        // Several compensation codes may share a displayed region; emit each region once.
        const seen = new Set<string>()
        return Object.freeze({
          state: current.state,
          errors: Object.freeze(
            (displayReady === true ? decision.errors : []).flatMap((code) => {
              const regionId = regions[code]
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
