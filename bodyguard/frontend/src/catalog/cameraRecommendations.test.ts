// FR-S-06/FR-M-07: generated visibility/stamps; not medical/personal recommendation accuracy.
import { expect, it } from 'vitest'
import { createCameraRecommendations } from './cameraRecommendations'

const frame = (sequence = 1, at = 100) => ({
  generation: 7,
  sequence,
  at,
  result: {
    landmarks: [Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))],
  },
})
it('requires real coverage as well as purpose and never promotes a candidate to release/clinical proof', () => {
  const check = createCameraRecommendations('neck')
  expect(check.read(100).motionIds).toEqual([])
  check.accept(frame(), 100)
  const s = check.read(100)
  expect(s).toEqual({
    scope: 'camera-match-candidate-only',
    purpose: 'neck',
    status: 'ready',
    motionIds: ['neck-side'],
  })
  expect(Object.isFrozen(s)).toBe(true)
  expect(Object.isFrozen(s.motionIds)).toBe(true)
  expect(check.read(100)).toBe(s)
  expect(Object.keys(s).sort()).toEqual(['scope', 'purpose', 'status', 'motionIds'].sort())
})
it('upper-only input offers neck but cannot offer head-torso/overhead; extra full body is allowed', () => {
  const upper = frame()
  for (const i of [13, 14, 15, 16, 23, 24, 25, 26, 27, 28])
    upper.result.landmarks[0][i].visibility = 0
  const neck = createCameraRecommendations('neck'),
    shoulder = createCameraRecommendations('shoulder')
  neck.accept(upper, 100)
  shoulder.accept(upper, 100)
  expect(neck.read(100).motionIds).toEqual(['neck-side'])
  expect(shoulder.read(100).motionIds).toEqual([])
  shoulder.accept(frame(2, 110), 110)
  expect(shoulder.read(110).motionIds).toEqual(['shoulder-shrug', 'arm-overhead'])
  expect(createCameraRecommendations('torso').read(100).status).toBe('none')
})
it.each([
  'empty',
  'multiple',
  'occluded',
  'absent',
  'stale',
  'future',
  'duplicate',
  'foreign',
] as const)('revokes a prior positive for %s without resetting capture authority', (kind) => {
  const check = createCameraRecommendations('neck')
  check.accept(frame(), 100)
  const f = frame(2, 110)
  if (kind === 'empty') f.result.landmarks = []
  if (kind === 'multiple') f.result.landmarks.push(f.result.landmarks[0])
  if (kind === 'occluded') f.result.landmarks[0][7].visibility = 0
  if (kind === 'absent') Object.assign(f.result.landmarks[0][7], { presence: 0 })
  const now = kind === 'stale' ? 1110 : 110
  if (kind === 'future') f.at = 111
  if (kind === 'duplicate') f.sequence = 1
  if (kind === 'foreign') f.generation = 8
  check.accept(f, now)
  expect(check.read(now).motionIds).toEqual([])
  check.accept({ ...frame(3, now + 10), generation: 8 }, now + 10)
  expect(check.read(now + 10).motionIds).toEqual([])
  check.accept(frame(4, now + 20), now + 20)
  expect(check.read(now + 20).motionIds).toEqual(['neck-side'])
})
it('freshness expires without input, reset retires old evidence and permits a new owner', () => {
  const check = createCameraRecommendations('neck')
  check.accept(frame(), 100)
  expect(check.read(1100).motionIds).toEqual([])
  check.reset()
  expect(check.read(1100).motionIds).toEqual([])
  check.accept({ ...frame(1, 1200), generation: 8 }, 1200)
  expect(check.read(1200).motionIds).toEqual(['neck-side'])
})
it('getter reentry or reset cannot publish older captured evidence', () => {
  const check = createCameraRecommendations('neck'),
    old = frame(),
    newer = frame(2, 110)
  check.accept(
    {
      ...old,
      get result() {
        check.accept(newer, 110)
        return { landmarks: [] }
      },
    },
    100,
  )
  expect(check.read(110).motionIds).toEqual(['neck-side'])
  check.accept(
    {
      ...frame(3, 120),
      get result() {
        check.reset()
        return old.result
      },
    },
    120,
  )
  expect(check.read(120).motionIds).toEqual([])
})
