// FR-M-01/02/07: authored geometry only, not a clinical or physical-camera validation.
import { describe, expect, it } from 'vitest'
import { observeCapturedNeckSide } from './neckSideObservation'

function input() {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }))
  points[7] = { x: 0.4, y: 0.2, z: 0, visibility: 1 }
  points[8] = { x: 0.6, y: 0.1, z: 0, visibility: 1 }
  points[11] = { x: 0.3, y: 0.4, z: 0, visibility: 1 }
  points[12] = { x: 0.7, y: 0.4, z: 0, visibility: 1 }
  return {
    frame: {
      generation: 1,
      sequence: 3,
      at: 10,
      image: { width: 1280, height: 720, imageIsMirrored: false },
      result: { landmarks: [points] },
    },
    now: 20,
    minimumConfidence: 0.8,
    maxAgeMs: 250,
  }
}
describe('neck observation from captured image geometry', () => {
  it('uses same-frame dimensions/stamps and never supplies a classification', () => {
    const supplied = input(),
      observation = observeCapturedNeckSide(supplied)
    expect(observation.status).toBe('available')
    if (observation.status !== 'available') throw new Error('Synthetic observation unavailable')
    expect(observation.headShoulderLineAngleRad).toBeCloseTo(Math.atan2(72, 256), 12)
    expect(observation).toMatchObject({
      generation: 1,
      sequence: 3,
      at: 10,
      space: 'image-plane-only',
    })
    expect('classification' in observation || 'verifiedMs' in observation).toBe(false)
    expect(Object.isFrozen(observation)).toBe(true)
    supplied.frame.result.landmarks[0][8].y = 0.8
    expect(observation.headShoulderLineAngleRad).toBeCloseTo(Math.atan2(72, 256), 12)
  })
  it('does not borrow prior geometry when a later frame omits it', () => {
    const supplied = input()
    expect(observeCapturedNeckSide(supplied).status).toBe('available')
    const { image: _image, ...frame } = supplied.frame
    expect(observeCapturedNeckSide({ ...supplied, frame })).toEqual({ status: 'unavailable' })
  })
  it('honors an explicitly transformed input rather than a display mirror', () => {
    const supplied = input(),
      expected = observeCapturedNeckSide(supplied)
    for (const p of supplied.frame.result.landmarks[0]) p.x = 1 - p.x
    supplied.frame.image.imageIsMirrored = true
    const actual = observeCapturedNeckSide(supplied)
    expect(actual.status).toBe('available')
    if (actual.status !== 'available' || expected.status !== 'available')
      throw new Error('Synthetic observation unavailable')
    for (const key of [
      'headShoulderLineAngleRad',
      'shoulderImageAngleRad',
      'leftEarShoulderDistanceInShoulderWidths',
      'rightEarShoulderDistanceInShoulderWidths',
      'headOffsetAlongShoulder',
      'headOffsetNormalToShoulder',
    ] as const)
      expect(actual[key]).toBeCloseTo(expected[key], 12)
  })
  it.each(['stale', 'future', 'hidden', 'multiple', 'none', 'bad-image', 'bad-mirror'] as const)(
    'keeps %s unavailable without a default/fallback',
    (kind) => {
      const supplied = input()
      if (kind === 'stale') supplied.now = 261
      if (kind === 'future') supplied.now = 9
      if (kind === 'hidden') supplied.frame.result.landmarks[0][7].visibility = 0
      if (kind === 'multiple')
        supplied.frame.result.landmarks.push(supplied.frame.result.landmarks[0])
      if (kind === 'none') supplied.frame.result.landmarks = []
      if (kind === 'bad-image') supplied.frame.image.height = 0
      if (kind === 'bad-mirror') Object.assign(supplied.frame.image, { imageIsMirrored: undefined })
      expect(observeCapturedNeckSide(supplied)).toEqual({ status: 'unavailable' })
    },
  )
  it('sanitizes foreign geometry getter failures without raw payloads', () => {
    const supplied = input()
    Object.defineProperty(supplied.frame, 'image', {
      get() {
        throw new Error('PRIVATE_INPUT')
      },
    })
    expect(observeCapturedNeckSide(supplied)).toEqual({ status: 'unavailable' })
  })
})
