// FR-S-01/02: generated mathematical stimulus only, never prescribed/released thresholds.
import type { NeckReviewCriteria } from '../../src/posture/thresholds'
export const criteria = (): NeckReviewCriteria => ({
  scope: 'image-plane-candidate-only',
  version: 'math-neck-v1',
  minimumConfidence: 0.5,
  maxFrameAgeMs: 120,
  maxFrameGapMs: 100,
  neutralHeadRad: [-0.03, 0.03],
  leftHeadRad: [-0.5, -0.3],
  rightHeadRad: [0.3, 0.5],
  shoulderAxisRad: [-0.05, 0.05],
  headAlongShoulder: [-1, 1],
  headNormalToShoulder: [0.2, 2],
})
export function frame(
  angle = 0,
  sequence = 1,
  at = 100,
  options: {
    width?: number
    height?: number
    mirrored?: boolean
    shoulder?: number
    generation?: number
  } = {},
) {
  const { width = 640, height = 480, mirrored = false, shoulder = 0 } = options
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.4,
    z: 0,
    visibility: 0.9,
    presence: 0.9,
  }))
  const line = (a: number, b: number, cx: number, cy: number, length: number, tilt: number) => {
    for (const [index, sign] of [
      [a, -1],
      [b, 1],
    ])
      points[index] = {
        ...points[index],
        x: cx + (sign * length * Math.cos(tilt)) / (2 * width),
        y: cy - (sign * length * Math.sin(tilt)) / (2 * height),
      }
  }
  line(11, 12, 0.5, 0.6, width * 0.3, shoulder)
  line(7, 8, 0.5, 0.35, width * 0.12, angle + shoulder)
  if (mirrored) for (const point of points) point.x = 1 - point.x
  return {
    generation: options.generation ?? 7,
    sequence,
    at,
    image: { width, height, imageIsMirrored: mirrored },
    result: { landmarks: [points], worldLandmarks: [points.map((point) => ({ ...point }))] },
  }
}
