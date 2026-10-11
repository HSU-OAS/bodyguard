import { expect, it } from 'vitest'
import { createCameraReference } from './cameraReference'

type Frame = Parameters<ReturnType<typeof createCameraReference>['accept']>[0]
function frame(at: number, sequence: number, degrees = 0) {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.4,
    z: 0,
    visibility: 0.9,
    presence: 0.9,
  }))
  points[7].x = 0.4
  points[8].x = 0.6
  points[11] = { ...points[11], x: 0.3, y: 0.6 }
  points[12] = {
    ...points[12],
    x: 0.7,
    y: 0.6 - (Math.tan((degrees * Math.PI) / 180) * 640 * 0.4) / 480,
  }
  return {
    generation: 1,
    sequence,
    at,
    result: { landmarks: [points] },
    image: { width: 640, height: 480, imageIsMirrored: false as boolean },
  } satisfies Frame
}
function collect(reference: ReturnType<typeof createCameraReference>, degrees = 10) {
  for (let n = 0; n <= 6; n++) reference.accept(frame(100 + n * 500, n + 1, degrees), 100 + n * 500)
  return reference.read(3100)
}
it('requires fresh observed 3s, returns only bounded scalar draft with no clinical approval', () => {
  const reference = createCameraReference()
  reference.begin(100)
  reference.accept(frame(100, 1, 10), 100)
  reference.accept(frame(600, 2, 10), 600)
  expect(reference.read(600)).toEqual({ phase: 'collecting', elapsedMs: 500 })
  for (let n = 2; n <= 6; n++) reference.accept(frame(100 + n * 500, n + 1, 10), 100 + n * 500)
  const state = reference.read(3100)
  expect(state.phase).toBe('review')
  if (state.phase !== 'review') throw new Error('Draft missing')
  expect(state.draft.value).toBeCloseTo(10, 10)
  expect(state.draft.observedRangeDeg).toBe(0)
  expect(state.draft.sampleCount).toBe(7)
  expect(Object.keys(state.draft).sort()).toEqual([
    'method',
    'observedRangeDeg',
    'sampleCount',
    'unit',
    'value',
  ])
  expect(Object.isFrozen(state.draft)).toBe(true)
})
it('keeps the actual image aspect/mirror and does not retain mutable caller points', () => {
  const reference = createCameraReference()
  reference.begin(100)
  for (let n = 0; n <= 6; n++) {
    const input = frame(100 + n * 500, n + 1, 10)
    input.image = { width: 640, height: 480, imageIsMirrored: true }
    reference.accept(input, input.at)
    ;(input.result.landmarks[0][12] as { y: number }).y = 0
  }
  const state = reference.read(3100)
  expect(state.phase).toBe('review')
  if (state.phase === 'review') expect(state.draft.value).toBeCloseTo(-10, 10)
})
it('does not invent a stability threshold; observed movement stays explicit in the review', () => {
  const reference = createCameraReference()
  reference.begin(100)
  for (let n = 0; n <= 6; n++)
    reference.accept(frame(100 + n * 500, n + 1, n % 2 ? 30 : 0), 100 + n * 500)
  const state = reference.read(3100)
  expect(state.phase).toBe('review')
  if (state.phase === 'review') expect(state.draft.observedRangeDeg).toBeCloseTo(30)
})
it.each([
  'missing-image',
  'multiple',
  'none',
  'missing-joint',
  'outside',
  'confidence',
  'presence',
  'nan',
  'future',
  'stale',
])('invalid/ambiguous current input %s clears collection instead of filling it', (kind) => {
  const reference = createCameraReference()
  reference.begin(100)
  reference.accept(frame(100, 1), 100)
  const input = frame(600, 2)
  if (kind === 'missing-image') Reflect.deleteProperty(input, 'image')
  if (kind === 'multiple')
    input.result.landmarks = [input.result.landmarks[0], input.result.landmarks[0]]
  if (kind === 'none') input.result.landmarks = []
  if (kind === 'missing-joint') input.result.landmarks = [[]]
  if (kind === 'outside') input.result.landmarks[0][11].x = 2
  if (kind === 'confidence') input.result.landmarks[0][11].visibility = 0.1
  if (kind === 'presence') input.result.landmarks[0][11].presence = 0.1
  if (kind === 'nan') input.result.landmarks[0][11].y = NaN
  reference.accept(input, kind === 'future' ? 599 : kind === 'stale' ? 1600 : 600)
  expect(reference.read(1600)).toEqual({ phase: 'error' })
})
it.each(['generation', 'duplicate', 'backwards', 'gap', 'clock'])(
  'does not join %s across a capture boundary',
  (kind) => {
    const reference = createCameraReference()
    reference.begin(100)
    reference.accept(frame(100, 1), 100)
    const input = frame(
      kind === 'gap' ? 1100 : kind === 'backwards' ? 100 : 600,
      kind === 'duplicate' ? 1 : 2,
    )
    if (kind === 'generation') input.generation = 2
    if (kind === 'clock') expect(reference.read(99)).toEqual({ phase: 'error' })
    else reference.accept(input, input.at)
    expect(reference.read(1600)).toEqual({ phase: 'error' })
  },
)
it('no decoded input and exact one-second silence revoke progress; reset discards review', () => {
  const reference = createCameraReference()
  reference.begin(100)
  expect(reference.read(1099).phase).toBe('collecting')
  expect(reference.read(1100)).toEqual({ phase: 'error' })
  reference.begin(100)
  expect(collect(reference).phase).toBe('review')
  reference.reset()
  expect(reference.read(4000)).toEqual({ phase: 'idle' })
})
it('ignores an already captured pre-click sample but never uses it in the new draft', () => {
  const reference = createCameraReference()
  reference.begin(100)
  reference.accept(frame(99, 1, 20), 100)
  expect(reference.read(100)).toEqual({ phase: 'collecting', elapsedMs: 0 })
  expect(collect(reference).phase).toBe('review')
})
it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid start clock %s',
  (now) => {
    const reference = createCameraReference()
    reference.begin(now)
    expect(reference.read(100)).toEqual({ phase: 'error' })
  },
)
