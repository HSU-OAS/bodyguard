// FR-A-01/03: screen framing only; no posture or tracking verdicts.
import { describe, expect, it } from 'vitest'
import { upperComparisonHalfY } from './referenceFraming'

describe('upper comparison framing', () => {
  it('keeps the existing upper-body crop when both models fit', () => {
    expect(
      upperComparisonHalfY(
        1.7,
        480,
        640,
        [
          { x: 0.02, y: 0 },
          { x: -0.04, y: 0 },
        ],
        null,
        16,
        'neck-side',
      ),
    ).toBeCloseTo(1.7 * 0.35)
  })

  it.each([
    [480, 640],
    [640, 800],
    [375, 640],
  ])('expands immediately to contain a raised hand in either pane at %sx%s', (width, height) => {
    const body = 1.7,
      wrist = body * 0.45,
      halfY = upperComparisonHalfY(
        body,
        width,
        height,
        [{ x: -wrist, y: 0 }],
        body * 0.35,
        16,
        'neck-side',
      ),
      halfX = (halfY * width) / height
    expect(halfX).toBeGreaterThanOrEqual(wrist + body * 0.17 - 1e-10)
  })

  it('eases back after a large movement without cropping the current pose', () => {
    const previous = 1.6,
      first = upperComparisonHalfY(1.7, 480, 640, [{ x: 0.05, y: 0 }], previous, 16, 'neck-side'),
      later = upperComparisonHalfY(1.7, 480, 640, [{ x: 0.05, y: 0 }], first, 300, 'neck-side')
    expect(first).toBeLessThan(previous)
    expect(first).toBeGreaterThan(later)
    expect(later).toBeGreaterThanOrEqual(1.7 * 0.35)
  })

  it('also contains raised hands above the current upper view', () => {
    const body = 1.7,
      handHeight = body * 0.62
    const halfY = upperComparisonHalfY(
      body,
      640,
      640,
      [{ x: 0, y: handHeight }],
      null,
      16,
      'neck-side',
    )
    expect(halfY).toBeGreaterThanOrEqual(handHeight + body * 0.1 - 1e-10)
  })

  it('gives the overhead demonstration its existing larger vertical allowance', () => {
    const value = upperComparisonHalfY(1.7, 640, 640, [], null, 0, 'arm-overhead')
    expect(value).toBeCloseTo(1.7 * 0.52)
  })

  it('rejects invalid framing and ignores unavailable bone positions', () => {
    expect(() => upperComparisonHalfY(0, 480, 640, [], null, 16, 'neck-side')).toThrow()
    expect(
      upperComparisonHalfY(1, 480, 640, [{ x: Number.NaN, y: Number.NaN }], null, 16, 'neck-side'),
    ).toBeCloseTo(0.35)
  })
})
