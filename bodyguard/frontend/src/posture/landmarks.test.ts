import { describe, expect, it } from 'vitest'
import { headShoulderConfidence, isInFrame, type Point, trustedJoints } from './landmarks'

const body = (overrides: Record<number, Partial<Point>> = {}): Point[] =>
  Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9, ...overrides[i] }))

describe('trustedJoints', () => {
  it('화면 안에서 잘 보이는 관절만 믿는다', () => {
    const trusted = trustedJoints(body({ 15: { visibility: 0.2 } }))
    expect(trusted[0]).toBe(true)
    expect(trusted[15]).toBe(false)
  })

  it('가시성이 높아도 화면 밖이면 믿지 않는다', () => {
    const trusted = trustedJoints(body({ 23: { y: 1.3, visibility: 0.8 } }))
    expect(trusted[23]).toBe(false)
  })

  it('관절이 없으면 전부 믿지 않는다', () => {
    expect(trustedJoints(null).some(Boolean)).toBe(false)
  })

  it('NaN·무한·범위 밖 가시성·비정상 깊이·잘못된 기준을 신뢰하지 않는다', () => {
    for (const invalid of [
      { visibility: Number.NaN },
      { visibility: Infinity },
      { visibility: 1.1 },
      { visibility: -0.1 },
      { z: Number.NaN },
      { x: Infinity },
    ]) {
      expect(trustedJoints(body({ 0: invalid }))[0]).toBe(false)
      expect(headShoulderConfidence(body({ 0: invalid }))).toBeCloseTo(0.72)
    }
    for (const min of [Number.NaN, Infinity, -1, 0, 1.1]) {
      expect(trustedJoints(body(), min).some(Boolean)).toBe(false)
    }
  })
})

describe('isInFrame', () => {
  it('0~1 밖이면 화면 밖이다', () => {
    expect(isInFrame({ x: 0.5, y: 0.5, z: 0 })).toBe(true)
    expect(isInFrame({ x: -0.1, y: 0.5, z: 0 })).toBe(false)
  })
})

describe('headShoulderConfidence', () => {
  it('코·귀·어깨 가시성의 평균이다', () => {
    expect(headShoulderConfidence(body())).toBeCloseTo(0.9)
  })

  it('화면 밖 관절은 0으로 센다', () => {
    // 다섯 관절 중 어깨 하나가 화면 밖 → 0.9 × 4 / 5
    expect(headShoulderConfidence(body({ 12: { x: 1.2 } }))).toBeCloseTo(0.72)
  })

  it('팔꿈치·손목은 세지 않는다', () => {
    expect(headShoulderConfidence(body({ 13: { visibility: 0 }, 15: { y: 1.5 } }))).toBeCloseTo(0.9)
  })
})
