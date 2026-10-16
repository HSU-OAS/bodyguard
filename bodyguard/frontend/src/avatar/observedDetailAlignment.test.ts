// FR-A-01/03·FR-M-07: generated display references, not webcam/clinical verification.
import { expect, it } from 'vitest'
import { hasSingleDisplayBody, readDetailAlignment } from './observedDetailAlignment'
import type { HandObservation } from './observedHandRig'
import type { PoseRigFrame } from './observedPoseRig'

function fixture(): PoseRigFrame {
  const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const points = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))
  points[5] = { x: -0.1, y: -0.2, z: 0 }
  points[9] = { x: 0, y: -0.2, z: 0 }
  points[17] = { x: 0.1, y: -0.2, z: 0 }
  const hands: HandObservation[] = (['left', 'right'] as const).map((side) => ({
    side,
    landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
    worldLandmarks: points,
  }))
  return {
    generation: 7,
    sequence: 1,
    at: 100,
    result: {
      landmarks: [body],
      worldLandmarks: [body],
      headOrientation: [0, 0, 0, 1],
      hands,
    },
  }
}

it('copies only immutable rotations, without retaining points or defining a correct pose', () => {
  const frame = fixture(),
    raw = JSON.stringify(frame)
  const reference = readDetailAlignment(frame, 7, 100, 1000)
  expect(reference?.head?.bone).toBe('head')
  expect(reference?.head?.cameraReference).toEqual([0, 0, 0, 1])
  expect(Object.keys(reference ?? {}).sort()).toEqual(['hands', 'head'])
  expect(Object.isFrozen(reference?.hands?.cameraReferences.left)).toBe(true)
  expect(reference?.hands?.cameraReferences.left).toHaveLength(4)
  expect(JSON.stringify(frame)).toBe(raw)
  ;(frame.result.headOrientation as number[]).fill(0)
  expect(reference?.head?.cameraReference).toEqual([0, 0, 0, 1])
  expect(JSON.stringify(reference)).not.toContain('landmarks')
})

it.each([
  { generation: 8 },
  { sequence: 0 },
  { sequence: 1.5 },
  { at: 101 },
  { at: -1 },
  { at: NaN },
])('rejects an invalid/current-owner stamp %j', (stamp) => {
  expect(readDetailAlignment({ ...fixture(), ...stamp }, 7, 100, 1000)).toBeNull()
})

it('rejects stale/multiple/sparse/nonfinite body inputs rather than guessing a face/body match', () => {
  const f = fixture()
  expect(readDetailAlignment(f, 7, 1101, 1000)).toBeNull()
  for (const people of [
    [],
    [f.result.landmarks[0], f.result.landmarks[0]],
    new Array(1),
    [new Array(33)],
    [[{ x: NaN, y: 0, z: 0 }, ...f.result.landmarks[0].slice(1)]],
  ]) {
    const frame = { ...f, result: { ...f.result, landmarks: people } }
    expect(hasSingleDisplayBody(frame)).toBe(false)
    expect(readDetailAlignment(frame, 7, 100, 1000)).toBeNull()
  }
})

it('keeps head and both-hand eligibility independent; missing references are never identity tuples', () => {
  const f = fixture()
  expect(readDetailAlignment({ ...f, result: { ...f.result, hands: [] } }, 7, 100, 1000)).toEqual({
    head: expect.any(Object),
  })
  expect(
    readDetailAlignment({ ...f, result: { ...f.result, headOrientation: null } }, 7, 100, 1000),
  ).toEqual({ hands: expect.any(Object) })
  expect(
    readDetailAlignment(
      {
        ...f,
        result: { ...f.result, hands: f.result.hands?.slice(0, 1), headOrientation: [0, 0, 0, 2] },
      },
      7,
      100,
      1000,
    ),
  ).toBeNull()
})

it('contains foreign access failures and never exposes their raw message', () => {
  const f = fixture()
  Object.defineProperty(f, 'result', {
    get() {
      throw new Error('PRIVATE_SENTINEL')
    },
  })
  expect(hasSingleDisplayBody(f)).toBe(false)
  expect(readDetailAlignment(f, 7, 100, 1000)).toBeNull()
})
