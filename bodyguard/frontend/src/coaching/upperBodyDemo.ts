// FR-S-02/03/04·FR-A-01: development demo of shoulder-shrug / arm-overhead coaching.
// Hip-width projections differ by body and camera angle, so the demo measures the user's own
// upright pose during '준비' and builds candidate bands around it. These are demo candidates,
// NOT validated, prescribed or released thresholds. releasedMotionIds stays empty.
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import { observeShoulderShrug, type ShrugFrame } from '../posture/shoulderShrugObservation'
import type { OverheadReviewCriteria, ReviewBand, ShrugReviewCriteria } from '../posture/thresholds'
import type { CoachingPlan, ObservationClass } from '../stretch/progression'
import type { createCoachingSession, SessionSnapshot } from './session'

type Session = Pick<ReturnType<typeof createCoachingSession>, 'getSnapshot'>
type Input = Parameters<ReturnType<typeof createCoachingSession>['observe']>[0]
type FeedbackErrors = readonly Readonly<{
  regionId: string
  severity: 'attention' | 'deviation'
  code?: string
}>[]
export type CandidateEvaluator = Readonly<{
  evaluate(
    frame: PoseRigFrame,
  ): Readonly<{ state: SessionSnapshot['state']; errors: FeedbackErrors }> | null
  close(): void
}>

const deg = (value: number) => (value * Math.PI) / 180
const band = (lo: number, hi: number): ReviewBand => Object.freeze([lo, hi]) as ReviewBand
export const UPPER_BODY_DEMO_HOLD_MS = 5000
export const UPPER_BODY_DEMO_FRAME_MS = 600
const MINIMUM_CONFIDENCE = 0.5
// Consecutive steady upright frames needed before judging (~1 s on a laptop).
export const BASELINE_FRAMES = 12
// Landmark jitter allowed while measuring, in hip widths.
const BASELINE_STEADY = 0.08

export type UpperBodyBaseline = Readonly<{
  leftShoulder: number
  rightShoulder: number
  headHeight: number
  headAlong: number
}>

/** One upright, arms-down frame for the baseline, or null. Image-plane values only. */
export function readUpperBodySample(frame: ShrugFrame, now: number): UpperBodyBaseline | null {
  const observed = observeShoulderShrug({
    frame,
    now,
    minimumConfidence: MINIMUM_CONFIDENCE,
    maxAgeMs: UPPER_BODY_DEMO_FRAME_MS,
  })
  if (
    observed.status !== 'available' ||
    Math.abs(observed.hipImageAngleRad) > deg(10) ||
    Math.abs(observed.trunkLeanRad) > deg(10) ||
    Math.abs(observed.headHipLineAngleRad) > deg(12) ||
    observed.leftUpperArmDownRad > deg(35) ||
    observed.rightUpperArmDownRad > deg(35)
  )
    return null
  return Object.freeze({
    leftShoulder: observed.leftShoulderHeightHipWidths,
    rightShoulder: observed.rightShoulderHeightHipWidths,
    headHeight: observed.headHeightHipWidths,
    headAlong: observed.headOffsetAlongHip,
  })
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b),
    middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
/** Median of steady samples, or null while they still move. */
export function settleBaseline(samples: readonly UpperBodyBaseline[]): UpperBodyBaseline | null {
  if (samples.length < BASELINE_FRAMES) return null
  const recent = samples.slice(-BASELINE_FRAMES)
  const spread = (key: keyof UpperBodyBaseline) => {
    const values = recent.map((sample) => sample[key])
    return Math.max(...values) - Math.min(...values)
  }
  if (spread('leftShoulder') > BASELINE_STEADY || spread('rightShoulder') > BASELINE_STEADY)
    return null
  const pick = (key: keyof UpperBodyBaseline) => median(recent.map((sample) => sample[key]))
  return Object.freeze({
    leftShoulder: pick('leftShoulder'),
    rightShoulder: pick('rightShoulder'),
    headHeight: pick('headHeight'),
    headAlong: pick('headAlong'),
  })
}

const common = (version: string) => ({
  scope: 'image-plane-candidate-only' as const,
  version,
  minimumConfidence: MINIMUM_CONFIDENCE,
  maxFrameAgeMs: UPPER_BODY_DEMO_FRAME_MS,
  maxFrameGapMs: UPPER_BODY_DEMO_FRAME_MS,
})
// Shared posture checks around the measured upright pose.
const posture = (b: UpperBodyBaseline) => ({
  hipAxisRad: band(deg(-10), deg(10)),
  headAxisRad: band(deg(-12), deg(12)),
  headHeight: band(Math.max(0.05, b.headHeight - 0.5), b.headHeight + 0.5),
  headAlongHip: band(b.headAlong - 0.4, b.headAlong + 0.4),
  trunkLeanRad: band(deg(-10), deg(10)),
})

export const SHRUG_DEMO_VERSION = 'demo-shrug-candidate-v1'
export function shrugDemoCriteria(b: UpperBodyBaseline): ShrugReviewCriteria {
  const neutral = (h: number) => band(Math.max(0.05, h - 0.08), h + 0.08)
  // A shrug lifts both shoulders roughly 0.15–0.8 hip widths above the upright pose.
  const target = (h: number) => band(h + 0.15, h + 0.8)
  const difference = b.leftShoulder - b.rightShoulder
  return Object.freeze({
    ...common(SHRUG_DEMO_VERSION),
    neutralLeftHeight: neutral(b.leftShoulder),
    neutralRightHeight: neutral(b.rightShoulder),
    targetLeftHeight: target(b.leftShoulder),
    targetRightHeight: target(b.rightShoulder),
    ...posture(b),
    shoulderDifference: band(difference - 0.2, difference + 0.2),
    upperArmDownRad: band(0, deg(35)),
  })
}

export const OVERHEAD_DEMO_VERSION = 'demo-overhead-candidate-v1'
export function overheadDemoCriteria(b: UpperBodyBaseline): OverheadReviewCriteria {
  return Object.freeze({
    ...common(OVERHEAD_DEMO_VERSION),
    neutralUpperArmDownRad: band(0, deg(35)),
    // Upper arm within ~30° of vertical, wrist above the face, elbow mostly straight.
    targetUpperArmDownRad: band(deg(150), Math.PI),
    neutralWristAboveFace: band(-8, -1),
    targetWristAboveFace: band(0.1, 4),
    neutralElbowRad: band(deg(125), Math.PI),
    targetElbowRad: band(deg(140), Math.PI),
    ...posture(b),
  })
}

export function demoPlan(
  motionId: 'shoulder-shrug' | 'arm-overhead',
  version: string,
  steps: readonly ('left' | 'right' | 'both')[],
): CoachingPlan {
  return Object.freeze({
    motionId,
    version,
    source: 'direct',
    maxFrameAgeMs: UPPER_BODY_DEMO_FRAME_MS,
    maxFrameGapMs: UPPER_BODY_DEMO_FRAME_MS,
    steps: Object.freeze(
      steps.map((id) =>
        Object.freeze({ id, kind: 'hold' as const, targetMs: UPPER_BODY_DEMO_HOLD_MS }),
      ),
    ),
  })
}

/** Measures the baseline in '준비', reporting frames as not yet judged, then hands every later
 * frame to the motion's own candidate evaluator built from that baseline. */
export function createCalibratedCandidateFeedback<C>(
  options: Readonly<{
    motionId: string
    generation: number
    now(): number
    session: Session
    observe(input: Input): SessionSnapshot | null
    build(baseline: UpperBodyBaseline): C
    create(criteria: C): CandidateEvaluator
    onCalibrated?(): void
  }>,
) {
  let inner: CandidateEvaluator | undefined,
    samples: UpperBodyBaseline[] = [],
    lastSequence = -1,
    closed = false
  return Object.freeze({
    calibrating: () => !closed && inner === undefined,
    evaluate(frame: PoseRigFrame) {
      if (closed) return null
      if (inner) return inner.evaluate(frame)
      const before = options.session.getSnapshot(),
        state = before.state,
        step = state.plan.steps[state.stepIndex]?.id
      if (
        before.closed ||
        state.status !== 'running' ||
        state.generation !== options.generation ||
        state.plan.motionId !== options.motionId ||
        frame.generation !== options.generation ||
        !Number.isSafeInteger(frame.sequence) ||
        frame.sequence <= lastSequence ||
        step === undefined
      )
        return null
      lastSequence = frame.sequence
      const sample =
        state.phase === 'waiting-start' ? readUpperBodySample(frame, options.now()) : null
      samples = sample ? [...samples, sample].slice(-BASELINE_FRAMES) : []
      const baseline = settleBaseline(samples)
      if (baseline) {
        inner = options.create(options.build(baseline))
        samples = []
        options.onCalibrated?.()
      }
      const people = frame.result.landmarks
      const classification: ObservationClass = 'unobservable'
      const after = options.observe({
        generation: frame.generation,
        sequence: frame.sequence,
        sampledAt: frame.at,
        personCount: Array.isArray(people) ? people.length : 0,
        stepId: step,
        classification,
      })
      if (!after || after.closed) return null
      return Object.freeze({ state: after.state, errors: Object.freeze([]) as FeedbackErrors })
    },
    close() {
      closed = true
      inner?.close()
      inner = undefined
    },
  })
}
