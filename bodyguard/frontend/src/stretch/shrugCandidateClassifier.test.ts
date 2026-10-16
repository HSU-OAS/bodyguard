// FR-S-02/04·FR-M-07: generated geometry, not human accuracy or clinical thresholds.
import { expect, it } from 'vitest'
import { shrugCriteria, shrugFrame } from '../../e2e/fixtures/shrugCandidate'
import { observeShoulderShrug } from '../posture/shoulderShrugObservation'
import { copyShrugReviewCriteria } from '../posture/thresholds'
import { createShrugCandidateClassifier } from './shrugCandidateClassifier'

const request = { stepId: 'both', phase: 'seeking-target' } as const
it('start -> both raised -> neutral return, with no target verdict in waiting-start', () => {
  const c = createShrugCandidateClassifier(shrugCriteria(), 7)
  expect(
    c.classify(shrugFrame(), 100, { ...request, phase: 'waiting-start' })?.classification,
  ).toBe('start')
  expect(c.classify(shrugFrame(40, 2, 110), 110, request)?.classification).toBe('target')
  expect(
    c.classify(shrugFrame(0, 3, 120), 120, { ...request, phase: 'waiting-return' })?.classification,
  ).toBe('returned')
  expect(
    c.classify(shrugFrame(40, 4, 130), 130, { ...request, phase: 'waiting-start' })?.classification,
  ).toBe('unmet')
  expect(
    c.classify(shrugFrame(20, 5, 140), 140, { ...request, phase: 'holding' })?.classification,
  ).toBe('unmet')
})
it.each([
  { width: 640, height: 480 },
  { width: 1280, height: 720 },
  { width: 480, height: 800 },
  { width: 640, height: 480, mirrored: true },
])('uses capture geometry %j, not CSS or display mirroring', (options) => {
  const frame = shrugFrame(40, 1, 100, options),
    o = observeShoulderShrug({ frame, now: 100, minimumConfidence: 0.5, maxAgeMs: 120 })
  expect(o.status).toBe('available')
  if (o.status === 'available') {
    expect(o.leftShoulderHeightHipWidths).toBeCloseTo(1.8)
    expect(o.rightShoulderHeightHipWidths).toBeCloseTo(1.8)
    expect(o.headHeightHipWidths).toBeCloseTo(2.5)
    expect(o.leftUpperArmDownRad).toBeCloseTo(0)
  }
  expect(
    createShrugCandidateClassifier(shrugCriteria(), 7).classify(frame, 100, request)
      ?.classification,
  ).toBe('target')
})
it('whole-body translation/zoom cannot fake shoulder elevation', () => {
  for (const options of [{ translate: 40 }, { scale: 0.7 }, { translate: 20, scale: 0.9 }])
    expect(
      createShrugCandidateClassifier(shrugCriteria(), 7).classify(
        shrugFrame(0, 1, 100, options),
        100,
        request,
      )?.classification,
    ).toBe('moving')
})
it.each(['head', 'trunk', 'arms', 'asymmetry', 'range'] as const)(
  'recognizes %s compensation without a target verdict',
  (kind) => {
    const f = shrugFrame(kind === 'range' ? 70 : kind === 'head' ? 0 : 40),
      p = f.result.landmarks[0]
    if (kind === 'head') for (const i of [0, 7, 8]) p[i].y += 40 / 480
    if (kind === 'trunk') for (const i of [11, 12]) p[i].x += 30 / 640
    if (kind === 'arms') {
      p[13].x += 80 / 640
      p[13].y = p[11].y
    }
    if (kind === 'asymmetry') p[12].y += 40 / 480
    const d = createShrugCandidateClassifier(shrugCriteria(), 7).classify(f, 100, request)
    expect(d?.classification).toBe('unmet')
    expect(d?.errors).toContain(`shrug-${kind}`)
  },
)
it.each([
  'occluded',
  'presence',
  'multiple',
  'empty',
  'missing-image',
  'future',
  'stale',
  'gap',
  'foreign',
  'duplicate',
] as const)('rejects %s after an earlier target', (kind) => {
  const c = createShrugCandidateClassifier(shrugCriteria(), 7)
  expect(c.classify(shrugFrame(40), 100, request)?.classification).toBe('target')
  const f = shrugFrame(40, 2, 110)
  if (kind === 'occluded') f.result.landmarks[0][23].visibility = 0
  if (kind === 'presence') f.result.landmarks[0][7].presence = 0
  if (kind === 'multiple') f.result.landmarks.push(f.result.landmarks[0])
  if (kind === 'empty') f.result.landmarks = []
  if (kind === 'missing-image') Object.assign(f, { image: undefined })
  if (kind === 'future') f.at = 111
  if (kind === 'gap') f.at = 210
  if (kind === 'foreign') f.generation = 8
  if (kind === 'duplicate') f.sequence = 1
  const d = c.classify(f, kind === 'stale' ? 231 : kind === 'gap' ? 210 : 110, request)
  expect(d === null || d.classification === 'unobservable').toBe(true)
})
it('copies/freeze explicit profiles and rejects absent, overlapping, inverted or invalid bands', () => {
  const original = shrugCriteria(),
    copied = copyShrugReviewCriteria(original)
  expect(Object.isFrozen(copied)).toBe(true)
  expect(Object.isFrozen(copied.targetLeftHeight)).toBe(true)
  Object.assign(original, { targetLeftHeight: [100, 200] })
  expect(copied.targetLeftHeight).toEqual([1.75, 1.85])
  for (const patch of [
    { version: '' },
    { minimumConfidence: 0 },
    { maxFrameGapMs: 0 },
    { targetLeftHeight: [1.4, 1.8] },
    { targetRightHeight: [1.2, 1.3] },
    { headAxisRad: [-Math.PI, Math.PI] },
    { upperArmDownRad: [-1, 1] },
    { headHeight: [0, 1] },
    { headAlongHip: [1, 1] },
    {
      neutralLeftHeight: [1e16, 1e16 + 1024],
      targetLeftHeight: [1e16 + 1026, 1e16 + 2048],
    },
  ])
    expect(() => copyShrugReviewCriteria({ ...shrugCriteria(), ...patch } as never)).toThrow(
      'Invalid shrug candidate criteria',
    )
})
it('reentry, clock corruption, thrown getters and closed ownership cannot publish newer/old targets', () => {
  const c = createShrugCandidateClassifier(shrugCriteria(), 7),
    f = shrugFrame(40)
  expect(
    c.classify(
      {
        ...f,
        get result() {
          c.classify(shrugFrame(40, 2, 110), 110, request)
          return f.result
        },
      },
      100,
      request,
    ),
  ).toBeNull()
  expect(c.classify(shrugFrame(40, 3, 120), 120, request)).toBeNull()
  const d = createShrugCandidateClassifier(shrugCriteria(), 7)
  d.close()
  expect(d.classify(f, 100, request)).toBeNull()
  const bad = createShrugCandidateClassifier(shrugCriteria(), 7)
  expect(bad.classify({ ...f, at: NaN }, 100, request)).toBeNull()
  expect(bad.classify(shrugFrame(40, 2, 110), 110, request)).toBeNull()
  const throwing = createShrugCandidateClassifier(shrugCriteria(), 7)
  expect(
    throwing.classify(
      {
        ...f,
        get image(): ReturnType<typeof shrugFrame>['image'] {
          throw new Error('PRIVATE_SHRUG_RAW_SENTINEL')
        },
      },
      100,
      request,
    ),
  ).toBeNull()
  expect(throwing.classify(shrugFrame(40, 2, 110), 110, request)).toBeNull()
})
