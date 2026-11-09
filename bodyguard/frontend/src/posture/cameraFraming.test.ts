// FR-M-07: synthetic technical coverage, not people/clinical accuracy.
import { expect, it } from 'vitest'
import { previewMotions } from '../catalog/motions'
import { createCameraFraming, motionFramingRequirement } from './cameraFraming'
import type { Point } from './landmarks'

const points = (hidden: readonly number[] = []): Point[] =>
  Array.from({ length: 33 }, (_, i) => ({
    x: 0.5,
    y: hidden.includes(i) ? 1.2 : 0.5,
    z: 0,
    visibility: 0.9,
    presence: 0.9,
  }))
const frame = (image = points(), at = 100, sequence = 1, count = 1, generation = 1) => ({
  generation,
  sequence,
  at,
  result: { landmarks: Array.from({ length: count }, () => image) },
})
it('maps only known candidates; camera display framing never changes requirements', () => {
  expect(motionFramingRequirement('neck-side')).toBe('head-shoulders')
  expect(motionFramingRequirement('cross-body-shoulder')).toBe('arms')
  expect(motionFramingRequirement('arm-overhead')).toBe('upper-body')
  expect(motionFramingRequirement('shoulder-shrug')).toBe('upper-body')
  expect(motionFramingRequirement('seated-trunk-rotation')).toBe('head-torso')
  expect(previewMotions.every((motion) => motionFramingRequirement(motion.id) !== null)).toBe(true)
  expect(motionFramingRequirement('__proto__')).toBeNull()
  expect(motionFramingRequirement('unknown')).toBeNull()
})
it('allows upper-body coverage even with unobserved legs, but not a full-body requirement', () => {
  const input = frame(points([25, 26, 27, 28]))
  const upper = createCameraFraming('head-shoulders'),
    full = createCameraFraming('full-body')
  upper.accept(input, 100)
  full.accept(input, 100)
  expect(upper.read(100)).toBe('in-frame')
  expect(full.read(100)).toBe('adjust')
  full.accept(frame(points(), 110, 2), 110)
  expect(full.read(110)).toBe('in-frame')
})
it('checks the chosen arms/torso separately and accepts full-body input for either', () => {
  for (const requirement of ['arms', 'upper-body'] as const) {
    const current = createCameraFraming(requirement)
    current.accept(frame(points([15])), 100)
    expect(current.read(100)).toBe('adjust')
    current.accept(frame(points(), 101, 2), 101)
    expect(current.read(101)).toBe('in-frame')
  }
})
it('revokes positive coverage immediately for a new empty or multiple result', () => {
  const current = createCameraFraming('head-shoulders')
  current.accept(frame(), 100)
  current.accept(frame(points(), 101, 2, 0), 101)
  expect(current.read(101)).toBe('position')
  current.accept(frame(points(), 102, 3, 2), 102)
  expect(current.read(102)).toBe('one-person')
})
it.each([
  { x: Number.NaN },
  { z: Infinity },
  { visibility: 0.49 },
  { presence: 0.49 },
  { visibility: 2 },
  { presence: Number.NaN },
  { x: -0.1 },
])('does not pass invalid/outside/low-confidence required input %j', (change) => {
  const input = points()
  input[11] = { ...input[11], ...change }
  const current = createCameraFraming('head-shoulders')
  current.accept(frame(input), 100)
  expect(current.read(100)).toBe('adjust')
})
it('does not trust incomplete, future, stale, duplicate or other-generation inputs', () => {
  const current = createCameraFraming('head-shoulders')
  current.accept(frame(points().slice(0, 12)), 100)
  expect(current.read(100)).toBe('waiting')
  current.accept(frame(points(), 101, 2), 101)
  expect(current.read(101)).toBe('in-frame')
  expect(current.read(1101)).toBe('waiting')
  current.accept(frame(points(), 102, 2), 1101)
  expect(current.read(1101)).toBe('waiting')
  current.accept(frame(points(), 1200, 3, 1, 2), 1200)
  expect(current.read(1200)).toBe('waiting')
  current.accept(frame(points(), 1500, 4), 1400)
  expect(current.read(1400)).toBe('waiting')
  current.accept(frame(points(), 1501, 5), 2501)
  expect(current.read(2501)).toBe('waiting')
})
it('returns only a closed categorical state, never coordinates or posture success', () => {
  const current = createCameraFraming('head-shoulders')
  current.accept(frame(), 100)
  expect(Object.keys(current)).toEqual(['accept', 'read'])
  expect(current.read(100)).toBe('in-frame')
  expect(typeof current.read(100)).toBe('string')
})
