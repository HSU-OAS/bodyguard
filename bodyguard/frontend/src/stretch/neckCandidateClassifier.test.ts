// FR-S-01/02/04·FR-M-07: generated projection bands are algebra fixtures, NOT exercise criteria.
import { afterEach, expect, it, vi } from 'vitest'
import { criteria, frame } from '../../e2e/fixtures/neckCandidate'
import { observeCapturedNeckSide } from '../posture/neckSideObservation'
import type { NeckReviewCriteria } from '../posture/thresholds'
import { copyNeckReviewCriteria, NECK_FLOAT_ROUND_OFF } from '../posture/thresholds'
import { createNeckCandidateClassifier } from './neckCandidateClassifier'

afterEach(() => vi.restoreAllMocks())
const start = { stepId: 'left', phase: 'waiting-start' } as const
it.each([
  { width: 640, height: 480 },
  { width: 480, height: 640 },
])('uses captured aspect and mirror without swapping authored side %j', (opts) => {
  for (const mirrored of [false, true]) {
    const classifier = createNeckCandidateClassifier(criteria(), 7)
    const run = (
      angle: number,
      sequence: number,
      phase: typeof start.phase | 'seeking-target' | 'holding' | 'waiting-return',
    ) =>
      classifier.classify(
        frame(angle, sequence, sequence * 10, { ...opts, mirrored }),
        sequence * 10,
        { stepId: 'left', phase },
      )
    expect(run(0, 1, 'waiting-start')?.classification).toBe('start')
    expect(run(-0.15, 2, 'seeking-target')?.classification).toBe('moving')
    expect(run(-0.4, 3, 'seeking-target')?.classification).toBe('target')
    expect(run(-0.4, 4, 'holding')?.classification).toBe('target')
    expect(run(-0.15, 5, 'waiting-return')?.classification).toBe('moving')
    expect(run(0, 6, 'waiting-return')?.classification).toBe('returned')
  }
})
it('classifies right separately; entering a target before starting never becomes start', () => {
  const c = createNeckCandidateClassifier(criteria(), 7)
  expect(
    c.classify(frame(0.4, 1, 10), 10, { stepId: 'right', phase: 'waiting-start' })?.classification,
  ).toBe('unmet')
  expect(
    c.classify(frame(0, 2, 20), 20, { stepId: 'right', phase: 'waiting-start' })?.classification,
  ).toBe('start')
  expect(
    c.classify(frame(0.4, 3, 30), 30, { stepId: 'right', phase: 'holding' })?.classification,
  ).toBe('target')
})

it.each([
  ['left', -0.5],
  ['left', -0.3],
  ['right', 0.3],
  ['right', 0.5],
] as const)('handles the inclusive projected target edge %s/%s', (stepId, angle) => {
  const observed = observeCapturedNeckSide({
    frame: frame(angle),
    now: 100,
    minimumConfidence: 0.5,
    maxAgeMs: 120,
  })
  if (observed.status !== 'available') throw Error('Missing mathematical projection')
  expect(Math.abs(observed.headShoulderLineAngleRad - angle)).toBeLessThan(NECK_FLOAT_ROUND_OFF)
  expect(
    createNeckCandidateClassifier(criteria(), 7).classify(frame(angle), 100, {
      stepId,
      phase: 'holding',
    })?.classification,
  ).toBe('target')
})
it('does not extend target eligibility beyond floating point resolution or merge tiny bands', () => {
  expect(
    createNeckCandidateClassifier(criteria(), 7).classify(frame(-0.5000001), 100, {
      stepId: 'left',
      phase: 'holding',
    })?.errors,
  ).toEqual(['neck-range'])
  expect(() =>
    createNeckCandidateClassifier(
      { ...criteria(), leftHeadRad: [-0.030000000000001, -0.0300000000000005] },
      7,
    ),
  ).toThrow('Invalid neck candidate criteria')
})
it.each([
  ['neck-wrong-direction', () => frame(0.4)],
  ['neck-range', () => frame(-0.7)],
  ['neck-shoulder-line', () => frame(-0.4, 1, 100, { shoulder: 0.2 })],
  [
    'neck-head-position',
    () => {
      const f = frame(-0.4)
      for (const i of [7, 8]) f.result.landmarks[0][i].y = 0.9
      return f
    },
  ],
] as const)('reports candidate %s without copying raw values', (code, input) => {
  const decision = createNeckCandidateClassifier(criteria(), 7).classify(input(), 100, {
    stepId: 'left',
    phase: 'seeking-target',
  })
  expect(decision?.classification).toBe('unmet')
  expect(decision?.errors).toContain(code)
  expect(Object.isFrozen(decision?.errors)).toBe(true)
  expect(JSON.stringify(decision)).not.toMatch(/landmarks|headOffset|AngleRad/)
})
it('invalidates missing/weak/presence/out-of-frame/multiple/stale inputs instead of passing', () => {
  const inputs = [
    () => {
      const f = frame()
      f.result.landmarks = []
      return f
    },
    () => {
      const f = frame()
      f.result.landmarks.push(f.result.landmarks[0])
      return f
    },
    () => {
      const f = frame()
      f.result.landmarks[0][7].visibility = 0.1
      return f
    },
    () => {
      const f = frame()
      f.result.landmarks[0][7].presence = NaN
      return f
    },
    () => {
      const f = frame()
      f.result.landmarks[0][11].x = -0.01
      return f
    },
    () => ({ ...frame(), image: undefined }),
    () => frame(0, 1, 0),
  ]
  for (const input of inputs)
    expect(
      createNeckCandidateClassifier(criteria(), 7).classify(input(), 200, start)?.classification,
    ).toBe('unobservable')
})
it('preserves stamps, rejects duplicates/foreign/regressing input and disarms a gap', () => {
  const c = createNeckCandidateClassifier(criteria(), 7),
    f = frame(),
    before = JSON.stringify(f)
  expect(c.classify(f, 100, start)).toMatchObject({
    generation: 7,
    sequence: 1,
    sampledAt: 100,
    classification: 'start',
    scope: 'image-plane-candidate-only',
  })
  expect(c.classify(f, 100, start)).toBeNull()
  expect(c.classify({ ...frame(0, 2, 110), generation: 8 }, 110, start)).toBeNull()
  expect(c.classify(frame(0, 2, 100), 110, start)).toBeNull()
  expect(
    c.classify(frame(-0.4, 2, 201), 201, { stepId: 'left', phase: 'holding' })?.classification,
  ).toBe('unobservable')
  expect(c.classify(frame(0, 3, 210), 210, start)?.classification).toBe('start')
  expect(c.classify(frame(0, 4, 211), 209, start)).toBeNull()
  expect(JSON.stringify(f)).toBe(before)
  c.close()
  expect(c.classify(frame(0, 4, 220), 220, start)).toBeNull()
})
it('contains foreign input exceptions and permanently closes that candidate instance', () => {
  const f = frame(),
    c = createNeckCandidateClassifier(criteria(), 7)
  Object.defineProperty(f, 'result', {
    get() {
      throw Error('PRIVATE_COORDINATES')
    },
  })
  expect(c.classify(f, 100, start)).toBeNull()
  expect(c.classify(frame(0, 2, 110), 110, start)).toBeNull()
})

it.each([NaN, Infinity, -1, 200])(
  'retires a broken current capture clock %s rather than bridging an unknown target interval',
  (at) => {
    const c = createNeckCandidateClassifier(criteria(), 7)
    c.classify(frame(-0.4, 1, 100), 100, { stepId: 'left', phase: 'holding' })
    expect(c.classify(frame(-0.4, 2, at), 110, { stepId: 'left', phase: 'holding' })).toBeNull()
    expect(c.classify(frame(-0.4, 3, 120), 120, { stepId: 'left', phase: 'holding' })).toBeNull()
  },
)
it('copies and rejects missing/nonfinite/overlapping/same-sided criteria rather than adopting defaults', () => {
  const left: [number, number] = [-0.5, -0.3]
  const source = { ...criteria(), leftHeadRad: left },
    copy = copyNeckReviewCriteria(source)
  left[0] = -0.8
  expect(copy.leftHeadRad).toEqual([-0.5, -0.3])
  expect(Object.isFrozen(copy)).toBe(true)
  for (const changes of [
    { scope: 'release' },
    { version: '' },
    { minimumConfidence: 0 },
    { maxFrameAgeMs: Infinity },
    { maxFrameGapMs: 0 },
    { neutralHeadRad: [NaN, 0] },
    { leftHeadRad: [0, 0.4] },
    { rightHeadRad: [-0.7, -0.6] },
    { headNormalToShoulder: undefined },
    { shoulderAxisRad: [-Math.PI / 2, 0] },
  ])
    expect(() =>
      createNeckCandidateClassifier({ ...criteria(), ...changes } as NeckReviewCriteria, 7),
    ).toThrow('Invalid neck candidate criteria')
})
