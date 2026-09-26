import { describe, expect, it } from 'vitest'
import {
  attachHandToBody,
  gestureLabel,
  HAND_POINT_COUNT,
  matchHandToBody,
  trustedHandPoints,
} from './hands'
import type { Point } from './landmarks'

const hand = (x: number, y: number): Point[] =>
  Array.from({ length: HAND_POINT_COUNT }, (_, i) => ({
    x: x + i * 0.001,
    y: y - i * 0.002,
    z: -i * 0.001,
  }))

const body = (): Point[] => {
  const b: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }))
  b[11] = { x: 0.6, y: 0.4, z: 0, visibility: 0.9 }
  b[12] = { x: 0.4, y: 0.4, z: 0, visibility: 0.9 }
  b[15] = { x: 0.7, y: 0.7, z: 0, visibility: 0.9 }
  b[16] = { x: 0.3, y: 0.7, z: 0, visibility: 0.9 }
  return b
}
const allTrusted = Array.from({ length: 33 }, () => true)

describe('gestureLabel', () => {
  it('엄지척을 우리말로 바꾼다', () => {
    expect(gestureLabel('Thumb_Up', 0.9)).toBe('엄지척')
  })

  it('확신이 낮거나 제스처가 없으면 보여주지 않는다', () => {
    expect(gestureLabel('Thumb_Up', 0.3)).toBeNull()
    expect(gestureLabel('None', 0.9)).toBeNull()
    expect(gestureLabel(undefined, undefined)).toBeNull()
  })
})

describe('trustedHandPoints', () => {
  it('화면 밖 손가락 점은 믿지 않는다', () => {
    const h = hand(0.5, 0.5)
    h[4] = { x: 1.2, y: 0.5, z: 0 }
    const trusted = trustedHandPoints(h)
    expect(trusted[0]).toBe(true)
    expect(trusted[4]).toBe(false)
  })
})

describe('matchHandToBody', () => {
  it('손목이 가까운 쪽 손으로 맞춘다', () => {
    expect(matchHandToBody(hand(0.71, 0.7), body(), allTrusted)).toBe('left')
    expect(matchHandToBody(hand(0.31, 0.7), body(), allTrusted)).toBe('right')
  })

  it('몸 손목과 너무 멀면 맞추지 않는다', () => {
    expect(matchHandToBody(hand(0.5, 0.1), body(), allTrusted)).toBeNull()
  })

  it('몸 손목을 믿을 수 없으면 맞추지 않는다', () => {
    const trusted = allTrusted.map((_, i) => i !== 15 && i !== 16)
    expect(matchHandToBody(hand(0.7, 0.7), body(), trusted)).toBeNull()
  })
})

describe('attachHandToBody', () => {
  it('손의 손목을 몸의 손목 위치로 옮기고 모양은 유지한다', () => {
    const world = hand(0, 0)
    const attached = attachHandToBody(world, { x: 0.3, y: -0.2, z: 0.1 })
    expect(attached[0]?.x).toBeCloseTo(0.3)
    expect(attached[0]?.y).toBeCloseTo(-0.2)
    expect(attached[0]?.z).toBeCloseTo(0.1)
    expect((attached[5]?.x ?? 0) - (attached[0]?.x ?? 0)).toBeCloseTo(
      (world[5]?.x ?? 0) - (world[0]?.x ?? 0),
    )
  })
})
