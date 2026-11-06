import { describe, expect, it } from 'vitest'
import { type NeckObservationInput, observeNeckSide } from './neckSideObservation'

// FR-M-01/02/07: authored pixel geometry only, no human/raw-camera data or clinical cutoffs.
function sample(width = 1600, height = 900): NeckObservationInput {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }))
  const pixels = [
    [0, 800, 210],
    [7, 700, 250],
    [8, 900, 250],
    [11, 600, 450],
    [12, 1000, 450],
  ]
  for (const [index, x, y] of pixels)
    points[index] = { x: x / width, y: y / height, z: 0, visibility: 1 }
  return {
    frame: { generation: 2, sequence: 3, at: 100, result: { landmarks: [points] } },
    now: 200,
    width,
    height,
    imageIsMirrored: false,
    minimumConfidence: 0.8,
    maxAgeMs: 250,
  }
}
function mutable(input = sample()) {
  return {
    ...input,
    frame: {
      ...input.frame,
      result: {
        landmarks: input.frame.result.landmarks.map((points) => points.map((p) => ({ ...p }))),
      },
    },
  }
}
function available(input: NeckObservationInput) {
  const result = observeNeckSide(input)
  expect(result.status).toBe('available')
  if (result.status !== 'available') throw new Error('Generated projection unavailable')
  return result
}
function transform(input: NeckObservationInput, angle: number, scale = 1, dx = 0, dy = 0) {
  const next = mutable(input)
  for (const p of next.frame.result.landmarks[0]) {
    const x = p.x * input.width - 800,
      y = p.y * input.height - 450
    p.x = (800 + scale * (x * Math.cos(angle) - y * Math.sin(angle)) + dx) / input.width
    p.y = (450 + scale * (x * Math.sin(angle) + y * Math.cos(angle)) + dy) / input.height
  }
  return next
}
describe('private neck-side projected observation', () => {
  it('returns only frozen geometry and original capture ownership, not a verdict', () => {
    const input = mutable(),
      before = JSON.stringify(input),
      result = available(input)
    expect(Object.isFrozen(result)).toBe(true)
    expect(result).toMatchObject({ space: 'image-plane-only', generation: 2, sequence: 3, at: 100 })
    expect(result.headShoulderLineAngleRad).toBe(0)
    expect(result.shoulderImageAngleRad).toBe(0)
    expect(result.leftEarShoulderDistanceInShoulderWidths).toBeCloseTo(Math.sqrt(5) / 4, 12)
    expect(result.rightEarShoulderDistanceInShoulderWidths).toBeCloseTo(Math.sqrt(5) / 4, 12)
    expect(result.headOffsetAlongShoulder).toBe(0)
    expect(result.headOffsetNormalToShoulder).toBe(0.5)
    expect(
      'classification' in result || 'verifiedMs' in result || 'motionValidated' in result,
    ).toBe(false)
    expect(JSON.stringify(input) === before).toBe(true)
    input.frame.result.landmarks[0][7].y = 0
    expect(result.headOffsetNormalToShoulder).toBe(0.5)
  })
  it.each([
    [1600, 900],
    [1600, 1600],
    [3200, 900],
  ])('uses captured aspect %s×%s, not normalized-coordinate angles', (width, height) => {
    const input = mutable(sample(width, height))
    input.frame.result.landmarks[0][8].y = 150 / height
    const result = available(input)
    expect(result.headShoulderLineAngleRad).toBeCloseTo(Math.atan2(100, 200), 12)
  })
  it.each([-0.3, 0.3, 0.7])(
    'separates head/shoulder line directions under common camera roll %s',
    (angle) => {
      const input = mutable()
      input.frame.result.landmarks[0][8].y = 150 / input.height
      const base = available(input),
        result = available(transform(input, angle))
      expect(result.headShoulderLineAngleRad).toBeCloseTo(base.headShoulderLineAngleRad, 12)
      expect(result.leftEarShoulderDistanceInShoulderWidths).toBeCloseTo(
        base.leftEarShoulderDistanceInShoulderWidths,
        12,
      )
      expect(result.headOffsetNormalToShoulder).toBeCloseTo(base.headOffsetNormalToShoulder, 12)
      expect(result.shoulderImageAngleRad).toBeCloseTo(-angle, 12)
    },
  )
  it('does not call whole-head-and-shoulder rotation a relative head bend', () => {
    expect(available(transform(sample(), 0.45)).headShoulderLineAngleRad).toBeCloseTo(0, 12)
  })
  it.each([0.5, 1.3])('preserves relative geometry at scale %s and translation', (scale) => {
    const base = available(sample()),
      result = available(transform(sample(), 0, scale, 70, 40))
    for (const key of [
      'headShoulderLineAngleRad',
      'leftEarShoulderDistanceInShoulderWidths',
      'rightEarShoulderDistanceInShoulderWidths',
      'headOffsetAlongShoulder',
      'headOffsetNormalToShoulder',
    ] as const)
      expect(result[key]).toBeCloseTo(base[key], 12)
  })
  it('restores input mirroring explicitly without changing anatomical landmark labels', () => {
    const input = mutable()
    input.frame.result.landmarks[0][8].y = 150 / input.height
    const base = available(input)
    for (const p of input.frame.result.landmarks[0]) p.x = 1 - p.x
    input.imageIsMirrored = true
    const result = available(input)
    for (const key of [
      'headShoulderLineAngleRad',
      'shoulderImageAngleRad',
      'leftEarShoulderDistanceInShoulderWidths',
      'rightEarShoulderDistanceInShoulderWidths',
      'headOffsetAlongShoulder',
      'headOffsetNormalToShoulder',
    ] as const)
      expect(result[key]).toBeCloseTo(base[key], 12)
  })
  it('does not require hips/legs for this head-and-shoulder observation', () => {
    const input = mutable()
    for (const i of [23, 24, 25, 26, 27, 28])
      input.frame.result.landmarks[0][i] = { x: NaN, y: -2, z: Infinity, visibility: 0 }
    expect(available(input).headShoulderLineAngleRad).toBe(0)
  })
  for (const index of [0, 7, 8, 11, 12]) {
    it.each(['hidden', 'outside', 'nonfinite', 'missing', 'presence'])(
      `rejects required landmark ${index} / %s`,
      (kind) => {
        const input = mutable(),
          point = input.frame.result.landmarks[0][index]
        if (kind === 'hidden') point.visibility = 0.79
        if (kind === 'outside') point.x = 1.01
        if (kind === 'nonfinite') point.z = NaN
        if (kind === 'missing') delete input.frame.result.landmarks[0][index]
        if (kind === 'presence') Object.assign(point, { presence: 0 })
        expect(observeNeckSide(input).status).toBe('unavailable')
      },
    )
  }
  it.each([0, 2])('does not select a person when detected count is %s', (count) => {
    const input = mutable()
    input.frame.result.landmarks = Array.from(
      { length: count },
      () => input.frame.result.landmarks[0],
    )
    expect(observeNeckSide(input).status).toBe('unavailable')
  })
  it.each([-1, 0, NaN, Infinity, 1.1])(
    'requires explicit valid confidence %s',
    (minimumConfidence) => {
      expect(observeNeckSide({ ...sample(), minimumConfidence }).status).toBe('unavailable')
    },
  )
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_VALUE])(
    'rejects captured dimension %s',
    (width) => {
      expect(observeNeckSide({ ...sample(), width }).status).toBe('unavailable')
      expect(observeNeckSide({ ...sample(), height: width }).status).toBe('unavailable')
    },
  )
  it.each([{ now: 99 }, { now: 351 }, { maxAgeMs: 0 }, { maxAgeMs: NaN }, { now: Infinity }])(
    'rejects stale/future/bad clock configuration %s',
    (change) => {
      expect(observeNeckSide({ ...sample(), ...change }).status).toBe('unavailable')
    },
  )
  it.each([
    { generation: 0 },
    { generation: 1.5 },
    { sequence: -1 },
    { sequence: NaN },
    { at: -1 },
  ])('rejects invalid original stamp %s', (change) => {
    const input = sample()
    expect(observeNeckSide({ ...input, frame: { ...input.frame, ...change } }).status).toBe(
      'unavailable',
    )
  })
  it.each([
    [7, 8],
    [11, 12],
  ])('rejects coincident projected segment %s/%s', (a, b) => {
    const input = mutable()
    input.frame.result.landmarks[0][b] = { ...input.frame.result.landmarks[0][a] }
    expect(observeNeckSide(input).status).toBe('unavailable')
  })
  it('does not borrow earlier geometry for an unavailable later observation', () => {
    const input = mutable(),
      old = available(input)
    input.frame.sequence++
    input.frame.result.landmarks[0][7].visibility = 0
    expect(observeNeckSide(input)).toEqual({ status: 'unavailable' })
    expect(old.sequence).toBe(3)
  })
  it('accepts the exact caller age boundary and frozen source without mutation', () => {
    const input = sample()
    for (const points of input.frame.result.landmarks) {
      points.forEach(Object.freeze)
      Object.freeze(points)
    }
    Object.freeze(input.frame.result.landmarks)
    expect(available({ ...input, now: 350 }).at).toBe(100)
  })
  it.each([-100, 100])('does not turn finite estimated z=%s into a cervical angle', (z) => {
    const input = mutable(),
      base = available(input)
    for (const index of [0, 7, 8, 11, 12]) input.frame.result.landmarks[0][index].z = z
    expect(available(input).headShoulderLineAngleRad).toBe(base.headShoulderLineAngleRad)
    expect(available(input).headOffsetNormalToShoulder).toBe(base.headOffsetNormalToShoulder)
  })
  it.each([-100, 100])(
    'keeps signed relative tilt in the documented Cartesian plane %s',
    (shift) => {
      const input = mutable()
      input.frame.result.landmarks[0][8].y += shift / input.height
      expect(available(input).headShoulderLineAngleRad).toBeCloseTo(Math.atan2(-shift, 200), 12)
    },
  )
  it.each([undefined, null, {}, { frame: null }, { frame: { result: null } }])(
    'rejects malformed input without raw errors %s',
    (input) => {
      expect(observeNeckSide(input as unknown as NeckObservationInput).status).toBe('unavailable')
    },
  )
  it.each([undefined, null, 0, {}, [undefined], [new Array(33)], [new Array(32)], [new Array(34)]])(
    'rejects malformed single-pose shape %s',
    (landmarks) => {
      const input = sample()
      expect(
        observeNeckSide({
          ...input,
          frame: { ...input.frame, result: { landmarks } },
        } as unknown as NeckObservationInput).status,
      ).toBe('unavailable')
    },
  )
  it.each([NaN, Infinity, -1, 1.1, undefined])(
    'rejects bad required confidence %s',
    (visibility) => {
      const input = mutable()
      Object.assign(input.frame.result.landmarks[0][7], { visibility })
      expect(observeNeckSide(input).status).toBe('unavailable')
    },
  )
  it('does not expose an accessor error containing sensitive-looking text', () => {
    const input = mutable()
    Object.defineProperty(input.frame.result.landmarks[0][7], 'x', {
      get() {
        throw new Error('PRIVATE_RAW_FAILURE')
      },
    })
    expect(observeNeckSide(input)).toEqual({ status: 'unavailable' })
  })
})

it.each([650, 950])('rejects a nose projected outside the ear segment (%s px)', (noseX) => {
  const input = mutable()
  input.frame.result.landmarks[0][0].x = noseX / input.width
  expect(observeNeckSide(input).status).toBe('unavailable')
})

it.each([-0.3, 0.3])('rejects that ambiguity after image rotation %s and mirroring', (angle) => {
  const input = mutable()
  input.frame.result.landmarks[0][0].x = 650 / input.width
  const rotated = transform(input, angle)
  expect(observeNeckSide(rotated).status).toBe('unavailable')
  for (const point of rotated.frame.result.landmarks[0]) point.x = 1 - point.x
  rotated.imageIsMirrored = true
  expect(observeNeckSide(rotated).status).toBe('unavailable')
})
