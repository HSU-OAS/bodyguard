// Demo candidate bands built from a measured upright pose. Generated points only.
import { expect, it } from 'vitest'
import { overheadFrame } from '../../e2e/fixtures/overheadCandidate'
import { shrugFrame } from '../../e2e/fixtures/shrugCandidate'
import { copyOverheadReviewCriteria, copyShrugReviewCriteria } from '../posture/thresholds'
import { createOverheadCandidateClassifier } from '../stretch/overheadCandidateClassifier'
import { createShrugCandidateClassifier } from '../stretch/shrugCandidateClassifier'
import {
  BASELINE_FRAMES,
  createCalibratedCandidateFeedback,
  overheadDemoCriteria,
  readUpperBodySample,
  settleBaseline,
  shrugDemoCriteria,
  type UpperBodyBaseline,
} from './upperBodyDemo'

const baselineOf = (frame: ReturnType<typeof shrugFrame>) => {
  const sample = readUpperBodySample(frame, frame.at)
  if (!sample) throw new Error('No sample')
  const baseline = settleBaseline(Array.from({ length: BASELINE_FRAMES }, () => sample))
  if (!baseline) throw new Error('No baseline')
  return baseline
}

it('accepts only steady, upright, arms-down samples', () => {
  const upright = readUpperBodySample(shrugFrame(0), 100) as UpperBodyBaseline
  expect(upright.leftShoulder).toBeCloseTo(1.4)
  // Arm raised to the side is not an upright baseline.
  expect(readUpperBodySample(overheadFrame(Math.PI / 2, 0), 100)).toBeNull()
  expect(settleBaseline(Array.from({ length: BASELINE_FRAMES - 1 }, () => upright))).toBeNull()
  const moving = Array.from({ length: BASELINE_FRAMES }, (_, i) => ({
    ...upright,
    leftShoulder: upright.leftShoulder + (i % 2) * 0.2,
  }))
  expect(settleBaseline(moving)).toBeNull()
})

it('builds valid shrug bands around the measured shoulders', () => {
  const criteria = shrugDemoCriteria(baselineOf(shrugFrame(0)))
  expect(copyShrugReviewCriteria(criteria)).toEqual(criteria)
  const classify = (rise: number, phase: 'waiting-start' | 'seeking-target') =>
    createShrugCandidateClassifier(criteria, 7).classify(shrugFrame(rise), 100, {
      stepId: 'both',
      phase,
    })
  expect(classify(0, 'waiting-start')?.classification).toBe('start')
  expect(classify(5, 'waiting-start')?.classification).toBe('start')
  expect(classify(30, 'seeking-target')?.classification).toBe('target')
  expect(classify(30, 'waiting-start')?.classification).toBe('unmet')
  expect(classify(100, 'seeking-target')?.errors).toEqual(['shrug-range'])
})

it('builds valid overhead bands and flags the other arm', () => {
  const criteria = overheadDemoCriteria(baselineOf(overheadFrame(0, 0)))
  expect(copyOverheadReviewCriteria(criteria)).toEqual(criteria)
  const classify = (
    left: number,
    right: number,
    stepId: 'left' | 'right',
    phase: 'waiting-start' | 'seeking-target',
  ) =>
    createOverheadCandidateClassifier(criteria, 7).classify(overheadFrame(left, right), 100, {
      stepId,
      phase,
    })
  expect(classify(0, 0, 'left', 'waiting-start')?.classification).toBe('start')
  expect(classify(Math.PI * 0.95, 0, 'left', 'seeking-target')?.classification).toBe('target')
  expect(classify(0, Math.PI * 0.95, 'right', 'seeking-target')?.classification).toBe('target')
  expect(classify(0, Math.PI * 0.95, 'left', 'seeking-target')?.errors).toEqual([
    'overhead-other-arm',
  ])
  expect(classify(Math.PI / 2, 0, 'left', 'seeking-target')?.classification).toBe('moving')
})

it('reports frames as not yet judged until a steady baseline exists, then delegates', () => {
  const state = {
    status: 'running',
    generation: 7,
    phase: 'waiting-start',
    stepIndex: 0,
    plan: { motionId: 'shoulder-shrug', steps: [{ id: 'both' }] },
  }
  const snapshot = { state, closed: false, failure: null }
  const observed: string[] = []
  const created: unknown[] = []
  let calibrated = 0
  const feedback = createCalibratedCandidateFeedback({
    motionId: 'shoulder-shrug',
    generation: 7,
    now: () => 100_000,
    session: { getSnapshot: () => snapshot as never },
    observe: (input) => {
      observed.push(input.classification)
      return snapshot as never
    },
    build: shrugDemoCriteria,
    create: (criteria) => {
      created.push(criteria)
      return { evaluate: () => ({ state: state as never, errors: [] }), close() {} }
    },
    onCalibrated: () => calibrated++,
  })
  for (let i = 1; i <= BASELINE_FRAMES; i++) {
    expect(feedback.calibrating()).toBe(true)
    feedback.evaluate(shrugFrame(0, i, 100_000))
  }
  expect(observed).toEqual(Array(BASELINE_FRAMES).fill('unobservable'))
  expect(feedback.calibrating()).toBe(false)
  expect(calibrated).toBe(1)
  expect(created).toHaveLength(1)
  // Later frames go to the motion's own evaluator, not the session directly.
  feedback.evaluate(shrugFrame(0, BASELINE_FRAMES + 1, 100_000))
  expect(observed).toHaveLength(BASELINE_FRAMES)
})
