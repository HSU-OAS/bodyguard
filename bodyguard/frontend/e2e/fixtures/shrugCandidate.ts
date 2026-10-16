// FR-S-02/FR-M-07: mathematical image-plane stimuli, NOT prescribed/validated exercise bands.
import type { ShrugReviewCriteria } from '../../src/posture/thresholds'
export const shrugCriteria = (): ShrugReviewCriteria => ({
  scope: 'image-plane-candidate-only',
  version: 'math-shrug-v1',
  minimumConfidence: 0.5,
  maxFrameAgeMs: 120,
  maxFrameGapMs: 100,
  neutralLeftHeight: [1.35, 1.45],
  neutralRightHeight: [1.35, 1.45],
  targetLeftHeight: [1.75, 1.85],
  targetRightHeight: [1.75, 1.85],
  hipAxisRad: [-0.05, 0.05],
  headAxisRad: [-0.05, 0.05],
  headHeight: [2.4, 2.6],
  headAlongHip: [-0.1, 0.1],
  trunkLeanRad: [-0.05, 0.05],
  shoulderDifference: [-0.15, 0.15],
  upperArmDownRad: [0, 0.15],
})
export function shrugFrame(
  rise = 0,
  sequence = 1,
  at = 100,
  options: {
    width?: number
    height?: number
    mirrored?: boolean
    scale?: number
    translate?: number
    generation?: number
  } = {},
) {
  const { width = 640, height = 480, mirrored = false, scale = 1, translate = 0 } = options
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
    presence: 0.95,
  }))
  for (const [i, x, y] of [
    [0, 0, 260],
    [7, -25, 250],
    [8, 25, 250],
    [11, -75, 140 + rise],
    [12, 75, 140 + rise],
    [13, -75, 60],
    [14, 75, 60],
    [15, -75, 20],
    [16, 75, 20],
    [23, -50, 0],
    [24, 50, 0],
  ]) {
    points[i] = {
      ...points[i],
      x: 0.5 + (x * scale) / width,
      y: 0.8 - (y * scale + translate) / height,
    }
  }
  if (mirrored) for (const p of points) p.x = 1 - p.x
  return {
    generation: options.generation ?? 7,
    sequence,
    at,
    image: { width, height, imageIsMirrored: mirrored },
    result: { landmarks: [points], worldLandmarks: [points.map((p) => ({ ...p }))] },
  }
}
