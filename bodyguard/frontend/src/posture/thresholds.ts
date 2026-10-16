// FR-S-01/02·FR-M-07: explicit test-only bands; no default clinical angles or exercise dose.
export type ReviewBand = readonly [number, number]
// IEEE754 projection/trigonometry roundoff only, not detector error or clinical tolerance.
export const NECK_FLOAT_ROUND_OFF = Number.EPSILON * 64
export const compareNeckScalar = (a: number, b: number) =>
  Math.abs(a - b) <= NECK_FLOAT_ROUND_OFF * Math.max(1, Math.abs(a), Math.abs(b))
    ? 0
    : a < b
      ? -1
      : 1
export type NeckReviewCriteria = Readonly<{
  scope: 'image-plane-candidate-only'
  version: string
  minimumConfidence: number
  maxFrameAgeMs: number
  maxFrameGapMs: number
  neutralHeadRad: ReviewBand
  leftHeadRad: ReviewBand
  rightHeadRad: ReviewBand
  shoulderAxisRad: ReviewBand
  headAlongShoulder: ReviewBand
  headNormalToShoulder: ReviewBand
}>
export function copyNeckReviewCriteria(value: NeckReviewCriteria): NeckReviewCriteria {
  const invalid = () => new Error('Invalid neck candidate criteria')
  try {
    const row = {
      scope: value.scope,
      version: value.version,
      minimumConfidence: value.minimumConfidence,
      maxFrameAgeMs: value.maxFrameAgeMs,
      maxFrameGapMs: value.maxFrameGapMs,
    }
    if (
      row.scope !== 'image-plane-candidate-only' ||
      typeof row.version !== 'string' ||
      !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(row.version) ||
      !Number.isFinite(row.minimumConfidence) ||
      row.minimumConfidence <= 0 ||
      row.minimumConfidence > 1 ||
      ![row.maxFrameAgeMs, row.maxFrameGapMs].every(
        (n) => Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER,
      )
    )
      throw invalid()
    const band = (input: ReviewBand, angle = false): ReviewBand => {
      if (!Array.isArray(input) || input.length !== 2) throw invalid()
      const [low, high] = input
      if (
        ![low, high].every(Number.isFinite) ||
        !Number.isFinite(high - low) ||
        high - low <= NECK_FLOAT_ROUND_OFF * 4 * Math.max(1, Math.abs(low), Math.abs(high)) ||
        (angle && (low <= -Math.PI / 2 || high >= Math.PI / 2))
      )
        throw invalid()
      return Object.freeze([low, high])
    }
    const neutralHeadRad = band(value.neutralHeadRad, true),
      leftHeadRad = band(value.leftHeadRad, true),
      rightHeadRad = band(value.rightHeadRad, true)
    const side = (b: ReviewBand) =>
      b[1] < neutralHeadRad[0] - NECK_FLOAT_ROUND_OFF * 4
        ? -1
        : b[0] > neutralHeadRad[1] + NECK_FLOAT_ROUND_OFF * 4
          ? 1
          : 0
    if (
      side(leftHeadRad) === 0 ||
      side(rightHeadRad) === 0 ||
      side(leftHeadRad) === side(rightHeadRad)
    )
      throw invalid()
    return Object.freeze({
      ...row,
      neutralHeadRad,
      leftHeadRad,
      rightHeadRad,
      shoulderAxisRad: band(value.shoulderAxisRad, true),
      headAlongShoulder: band(value.headAlongShoulder),
      headNormalToShoulder: band(value.headNormalToShoulder),
    })
  } catch {
    throw invalid()
  }
}
