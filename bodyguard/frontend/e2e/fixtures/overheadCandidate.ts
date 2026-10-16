// FR-S-02/04: generated plane stimuli, NOT clinical angles, dose or a human recording.
import type { OverheadReviewCriteria } from '../../src/posture/thresholds'
export const overheadCriteria = (): OverheadReviewCriteria => ({
  scope: 'image-plane-candidate-only',
  version: 'math-overhead-v1',
  minimumConfidence: 0.5,
  maxFrameAgeMs: 120,
  maxFrameGapMs: 100,
  neutralUpperArmDownRad: [0, 0.12],
  targetUpperArmDownRad: [2.7, Math.PI],
  neutralWristAboveFace: [-2.8, -1.8],
  targetWristAboveFace: [0.25, 0.55],
  neutralElbowRad: [2.8, Math.PI],
  targetElbowRad: [2.8, Math.PI],
  hipAxisRad: [-0.05, 0.05],
  headAxisRad: [-0.05, 0.05],
  headHeight: [2.4, 2.6],
  headAlongHip: [-0.1, 0.1],
  trunkLeanRad: [-0.05, 0.05],
})
export function overheadFrame(
  left = 0,
  right = 0,
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
  const { width = 640, height = 600, mirrored = false, scale = 1, translate = 0 } = options
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
    presence: 0.95,
  }))
  const put = (i: number, x: number, y: number) => {
    points[i] = {
      ...points[i],
      x: 0.5 + (x * scale) / width,
      y: 0.8 - (y * scale + translate) / height,
    }
  }
  for (const [i, x, y] of [
    [0, 0, 260],
    [7, -25, 250],
    [8, 25, 250],
    [11, -75, 140],
    [12, 75, 140],
    [23, -50, 0],
    [24, 50, 0],
  ])
    put(i, x, y)
  for (const [side, angle, e, w] of [
    [-1, left, 13, 15],
    [1, right, 14, 16],
  ]) {
    for (const [index, length] of [
      [e, 80],
      [w, 160],
    ])
      put(index, side * (75 + length * Math.sin(angle)), 140 - length * Math.cos(angle))
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
