import { describe, expect, it } from 'vitest'
import { type Point, trustedJoints } from '../posture/landmarks'
import { FACE_POINTS } from './face'
import {
  BONES,
  NECK_SEGMENT_INDEX,
  SEGMENT_COUNT,
  skeletonSegments,
  withoutRoughHands,
} from './skeleton'

const body = (visibility: (i: number) => number = () => 0.9): Point[] =>
  Array.from({ length: 33 }, (_, i) => ({
    x: 0.2 + (i / 33) * 0.6,
    y: 0.2 + (i / 33) * 0.6,
    z: 0,
    visibility: visibility(i),
  }))

const segmentsOf = (lm: Point[]) => skeletonSegments(lm, trustedJoints(lm))

describe('skeletonSegments', () => {
  it('관절이 없으면 아무것도 그리지 않는다', () => {
    expect(skeletonSegments(null, trustedJoints(null)).every((s) => s === null)).toBe(true)
  })

  it('모두 잘 보이면 뼈대 전부와 목을 그린다', () => {
    const segments = segmentsOf(body())
    expect(segments).toHaveLength(SEGMENT_COUNT)
    expect(segments.every((s) => s !== null)).toBe(true)
    expect(segments[NECK_SEGMENT_INDEX]?.part).toBe('neck')
  })

  it('책상에 가린 엉덩이 아래는 그리지 않는다', () => {
    const segments = segmentsOf(body((i) => (i >= 23 ? 0.1 : 0.9)))
    BONES.forEach(([, , part], k) => {
      if (part === 'legs' || part === 'torso') expect(segments[k]).toBeNull()
    })
    expect(segments[NECK_SEGMENT_INDEX]).not.toBeNull()
  })

  it('가시성이 높아도 화면 밖 관절은 그리지 않는다', () => {
    const lm = body()
    lm[15] = { x: 0.3, y: 1.4, z: 0, visibility: 0.9 } // 화면 아래로 벗어난 손목
    const segments = segmentsOf(lm)
    BONES.forEach(([i, j], k) => {
      if (i === 15 || j === 15) expect(segments[k]).toBeNull()
    })
  })

  it('월드 좌표도 같은 프레임의 화면 좌표로 구한 신뢰 여부를 따른다', () => {
    const image = body((i) => (i === 13 ? 0.1 : 0.9))
    const segments = skeletonSegments(body(), trustedJoints(image))
    BONES.forEach(([i, j], k) => {
      if (i === 13 || j === 13) expect(segments[k]).toBeNull()
    })
  })

  it('손가락이 붙은 쪽은 거친 손 선분을 빼고 팔뚝은 남긴다', () => {
    const segments = withoutRoughHands(segmentsOf(body()), ['left'])
    BONES.forEach(([i, j], k) => {
      const leftRough = [17, 19, 21].includes(i) || [17, 19, 21].includes(j)
      const rightRough = [18, 20, 22].includes(i) || [18, 20, 22].includes(j)
      if (leftRough) expect(segments[k]).toBeNull()
      if (rightRough) expect(segments[k]).not.toBeNull()
      if (i === 13 && j === 15) expect(segments[k]).not.toBeNull()
    })
  })

  it('얼굴 관절은 선으로 잇지 않는다', () => {
    for (const [i, j] of BONES) {
      expect(FACE_POINTS).not.toContain(i)
      expect(FACE_POINTS).not.toContain(j)
    }
  })

  it('목은 귀 중점에서 어깨 중점까지다', () => {
    const lm = body()
    lm[7] = { x: 0.4, y: 0.2, z: 0, visibility: 1 }
    lm[8] = { x: 0.6, y: 0.2, z: 0, visibility: 1 }
    lm[11] = { x: 0.3, y: 0.5, z: 0, visibility: 1 }
    lm[12] = { x: 0.7, y: 0.5, z: 0, visibility: 1 }
    const neck = segmentsOf(lm)[NECK_SEGMENT_INDEX]
    expect(neck?.a.x).toBeCloseTo(0.5)
    expect(neck?.a.y).toBeCloseTo(0.2)
    expect(neck?.b.y).toBeCloseTo(0.5)
  })
})
