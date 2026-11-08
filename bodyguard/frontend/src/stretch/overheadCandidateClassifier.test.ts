// FR-S-02/04·FR-M-07: generated geometry only, not person accuracy/clinical defaults.
import { expect, it } from 'vitest'
import { overheadCriteria, overheadFrame } from '../../e2e/fixtures/overheadCandidate'
import { observeArmOverhead } from '../posture/armOverheadObservation'
import { copyOverheadReviewCriteria } from '../posture/thresholds'
import { createOverheadCandidateClassifier } from './overheadCandidateClassifier'

const request = { stepId: 'left', phase: 'seeking-target' } as const
it('observes each arm independently and requires start -> designated arm -> return', () => {
  const c = createOverheadCandidateClassifier(overheadCriteria(), 7)
  expect(
    c.classify(overheadFrame(), 100, { ...request, phase: 'waiting-start' })?.classification,
  ).toBe('start')
  expect(c.classify(overheadFrame(Math.PI, 0, 2, 110), 110, request)?.classification).toBe('target')
  expect(
    c.classify(overheadFrame(0, 0, 3, 120), 120, { ...request, phase: 'waiting-return' })
      ?.classification,
  ).toBe('returned')
  expect(
    c.classify(overheadFrame(Math.PI, 0, 4, 130), 130, { ...request, phase: 'waiting-start' })
      ?.classification,
  ).toBe('unmet')
  expect(
    c.classify(overheadFrame(0, Math.PI, 5, 140), 140, { stepId: 'right', phase: 'seeking-target' })
      ?.classification,
  ).toBe('target')
})
it.each([
  { width: 640, height: 600 },
  { width: 1280, height: 720 },
  { width: 480, height: 800 },
  { mirrored: true },
  { scale: 0.7, translate: 20 },
])('preserves the capture plane %j without CSS/world geometry', (options) => {
  const f = overheadFrame(Math.PI, 0, 1, 100, options)
  f.result.worldLandmarks[0][15].y = -999
  const o = observeArmOverhead({ frame: f, now: 100, minimumConfidence: 0.5, maxAgeMs: 120 })
  expect(o.status).toBe('available')
  if (o.status === 'available') {
    expect(o.leftUpperArmDownRad).toBeCloseTo(Math.PI)
    expect(o.rightUpperArmDownRad).toBeCloseTo(0)
    expect(o.leftElbowRad).toBeCloseTo(Math.PI)
    expect(o.leftWristAboveFaceHipWidths).toBeCloseTo(0.4)
    expect(o.rightWristAboveFaceHipWidths).toBeCloseTo(-2.8)
    expect(o.space).toBe('image-plane-only')
  }
  expect(
    createOverheadCandidateClassifier(overheadCriteria(), 7).classify(f, 100, request)
      ?.classification,
  ).toBe('target')
})
it.each(['wrong-arm', 'both-arms', 'wrist-only', 'bent-elbow', 'head', 'trunk', 'range'] as const)(
  'does not accrue a target for %s',
  (kind) => {
    const f = overheadFrame(
      kind === 'wrong-arm' || kind === 'wrist-only' ? 0 : Math.PI,
      kind === 'wrong-arm' || kind === 'both-arms' ? Math.PI : 0,
    )
    const p = f.result.landmarks[0]
    if (kind === 'wrist-only') p[15].y = p[0].y - 40 / 600
    if (kind === 'bent-elbow') p[15] = { ...p[13], x: p[13].x - 80 / 640 }
    if (kind === 'head') for (const i of [0, 7, 8]) p[i].x += 40 / 640
    if (kind === 'trunk') for (const i of [11, 12]) p[i].x += 30 / 640
    if (kind === 'range') p[15].y -= 60 / 600
    const d = createOverheadCandidateClassifier(overheadCriteria(), 7).classify(f, 100, request)
    expect(d?.classification).not.toBe('target')
    expect(d?.classification).not.toBe('start')
    if (kind === 'wrong-arm' || kind === 'both-arms')
      expect(d?.errors).toContain('overhead-other-arm')
    if (kind === 'bent-elbow') expect(d?.errors).toContain('overhead-elbow')
    if (kind === 'head' || kind === 'trunk' || kind === 'range')
      expect(d?.errors).toContain(`overhead-${kind}`)
  },
)
it.each([
  'hips',
  'wrist',
  'presence',
  'outside',
  'multiple',
  'empty',
  'image',
  'stale',
  'gap',
  'foreign',
  'duplicate',
  'regressed',
  'degenerate',
] as const)('does not reuse an earlier target after %s', (kind) => {
  const c = createOverheadCandidateClassifier(overheadCriteria(), 7)
  expect(c.classify(overheadFrame(Math.PI), 100, request)?.classification).toBe('target')
  const f = overheadFrame(Math.PI, 0, 2, 110),
    p = f.result.landmarks[0]
  if (kind === 'hips') p[23].visibility = 0
  if (kind === 'wrist') p[16].visibility = 0
  if (kind === 'presence') p[7].presence = 0
  if (kind === 'outside') p[15].y = -0.01
  if (kind === 'multiple') f.result.landmarks.push(p)
  if (kind === 'empty') f.result.landmarks = []
  if (kind === 'image') Object.assign(f, { image: undefined })
  if (kind === 'gap') f.at = 210
  if (kind === 'foreign') f.generation = 8
  if (kind === 'duplicate') f.sequence = 1
  if (kind === 'regressed') f.at = 99
  if (kind === 'degenerate') p[13] = { ...p[11] }
  const d = c.classify(f, kind === 'stale' ? 231 : kind === 'gap' ? 210 : 110, request)
  expect(d === null || d.classification === 'unobservable').toBe(true)
})
it('marks a transition as moving but never counts it as a held target', () => {
  const c = createOverheadCandidateClassifier(overheadCriteria(), 7)
  expect(c.classify(overheadFrame(Math.PI / 2), 100, request)?.classification).toBe('moving')
  expect(
    c.classify(overheadFrame(Math.PI / 2, 0, 2, 110), 110, { ...request, phase: 'holding' })
      ?.classification,
  ).toBe('unmet')
})
it('copies and freezes explicit profiles, rejecting absent/overlapping/ill-conditioned/invalid bands', () => {
  const input = overheadCriteria(),
    copy = copyOverheadReviewCriteria(input)
  Object.assign(input, { targetUpperArmDownRad: [0, 1] })
  expect(copy.targetUpperArmDownRad).toEqual([2.7, Math.PI])
  expect(Object.isFrozen(copy)).toBe(true)
  expect(Object.isFrozen(copy.targetUpperArmDownRad)).toBe(true)
  for (const patch of [
    { scope: 'release' },
    { version: '' },
    { minimumConfidence: 0 },
    { maxFrameAgeMs: 0 },
    { targetUpperArmDownRad: [0.1, 1] },
    { targetWristAboveFace: [-0.1, 1] },
    { neutralWristAboveFace: [-1, 0.3] },
    { targetElbowRad: [1, 4] },
    { headHeight: [0, 1] },
    { trunkLeanRad: [-Math.PI, Math.PI] },
    { targetUpperArmDownRad: [0.12 + Number.EPSILON, 0.5] },
  ])
    expect(() => copyOverheadReviewCriteria({ ...overheadCriteria(), ...patch } as never)).toThrow(
      'Invalid overhead candidate criteria',
    )
  expect(() => copyOverheadReviewCriteria(undefined as never)).toThrow(
    'Invalid overhead candidate criteria',
  )
})
it('closes on a corrupt current clock, reentry, private getter failure or explicit close', () => {
  const c = createOverheadCandidateClassifier(overheadCriteria(), 7),
    f = overheadFrame(Math.PI)
  expect(c.classify({ ...f, at: NaN }, 100, request)).toBeNull()
  expect(c.classify(overheadFrame(Math.PI, 0, 2, 110), 110, request)).toBeNull()
  const reentrant = createOverheadCandidateClassifier(overheadCriteria(), 7)
  expect(
    reentrant.classify(
      {
        ...f,
        get result() {
          reentrant.classify(overheadFrame(Math.PI, 0, 2, 110), 110, request)
          return f.result
        },
      },
      100,
      request,
    ),
  ).toBeNull()
  expect(reentrant.classify(overheadFrame(Math.PI, 0, 3, 120), 120, request)).toBeNull()
  const throwing = createOverheadCandidateClassifier(overheadCriteria(), 7)
  expect(
    throwing.classify(
      {
        ...f,
        get image(): typeof f.image {
          throw new Error('PRIVATE_OVERHEAD_RAW')
        },
      },
      100,
      request,
    ),
  ).toBeNull()
  expect(throwing.classify(overheadFrame(Math.PI, 0, 2, 110), 110, request)).toBeNull()
  const closed = createOverheadCandidateClassifier(overheadCriteria(), 7)
  closed.close()
  expect(closed.classify(f, 100, request)).toBeNull()
})
it.each([
  'width',
  'height',
  'mirror',
  'length',
  'visibility',
  'presence-high',
  'nonfinite',
  'confidence',
  'age',
  'future',
] as const)('retains unavailable for malformed %s before geometry is returned', (kind) => {
  const frame = overheadFrame(Math.PI),
    input = { frame, now: 100, minimumConfidence: 0.5, maxAgeMs: 120 }
  if (kind === 'width') frame.image.width = 0
  if (kind === 'height') frame.image.height = Infinity
  if (kind === 'mirror') Object.assign(frame.image, { imageIsMirrored: undefined })
  if (kind === 'length') frame.result.landmarks[0].pop()
  if (kind === 'visibility') frame.result.landmarks[0][11].visibility = NaN
  if (kind === 'presence-high') frame.result.landmarks[0][16].presence = 1.01
  if (kind === 'nonfinite') frame.result.landmarks[0][0].z = Infinity
  if (kind === 'confidence') input.minimumConfidence = 0
  if (kind === 'age') input.maxAgeMs = 0
  if (kind === 'future') frame.at = 101
  expect(observeArmOverhead(input).status).toBe('unavailable')
})
it.each([NaN, -1, Infinity, Number.MAX_SAFE_INTEGER + 1, 99])(
  'retires ownership after invalid/regressed observation clock %s',
  (now) => {
    const c = createOverheadCandidateClassifier(overheadCriteria(), 7)
    expect(c.classify(overheadFrame(Math.PI), 100, request)?.classification).toBe('target')
    expect(c.classify(overheadFrame(Math.PI, 0, 2, 110), now, request)).toBeNull()
    expect(c.classify(overheadFrame(Math.PI, 0, 3, 120), 120, request)).toBeNull()
  },
)
