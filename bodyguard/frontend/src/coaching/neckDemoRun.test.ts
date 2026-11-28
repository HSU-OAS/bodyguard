// Demo candidate bands against raw (non-mirrored) front-camera geometry. Generated points,
// not a person or accuracy evidence.
import { expect, it } from 'vitest'
import { copyNeckReviewCriteria } from '../posture/thresholds'
import { createNeckCandidateClassifier } from '../stretch/neckCandidateClassifier'
import { createCoaching } from '../stretch/progression'
import { neckDemoCriteria, neckDemoRun } from './neckDemoRun'

const W = 640,
  H = 480
/** Raw webcam frame: the user's left shoulder (11) and left ear (7) are on the image right.
 * `tilt` > 0 leans the head toward the user's left shoulder; `shrug` raises the left shoulder. */
function rawFrame(
  tilt: number,
  sequence: number,
  options: { shrug?: number; shift?: number } = {},
) {
  const rad = (tilt * Math.PI) / 180
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }))
  // Pixel space with y up, converted to normalized image coordinates.
  const put = (i: number, px: number, py: number) => {
    points[i] = { ...points[i], x: px / W, y: 1 - py / H }
  }
  const shoulderY = 0.38 * H
  put(11, 0.62 * W, shoulderY + (options.shrug ?? 0) * H)
  put(12, 0.38 * W, shoulderY)
  const cx = 0.5 * W + (options.shift ?? 0) * W,
    cy = 0.64 * H,
    r = 0.06 * W
  // Leaning left lowers the left ear (image right): rotate clockwise by `rad`.
  put(7, cx + r * Math.cos(rad), cy - r * Math.sin(rad))
  put(8, cx - r * Math.cos(rad), cy + r * Math.sin(rad))
  put(0, cx, cy - 0.02 * H)
  return {
    generation: 1,
    sequence,
    at: sequence * 100,
    image: { width: W, height: H, imageIsMirrored: false },
    result: { landmarks: [points], worldLandmarks: [points.map((p) => ({ ...p }))] },
  }
}

const classify = (
  stepId: 'left' | 'right',
  phase: 'waiting-start' | 'seeking-target' | 'holding' | 'waiting-return',
  tilt: number,
  options?: { shrug?: number; shift?: number },
) => {
  const classifier = createNeckCandidateClassifier(neckDemoCriteria, 1)
  return classifier.classify(rawFrame(tilt, 1, options), 100, { stepId, phase })
}

it('is a valid candidate run configuration', () => {
  expect(copyNeckReviewCriteria(neckDemoCriteria)).toEqual(neckDemoCriteria)
  expect(createCoaching(neckDemoRun.plan).plan.steps.map((s) => s.id)).toEqual(['left', 'right'])
  expect(neckDemoRun.plan.version).toBe(neckDemoCriteria.version)
})

it('accepts an upright head as the start and return position', () => {
  expect(classify('left', 'waiting-start', 0)?.classification).toBe('start')
  expect(classify('left', 'waiting-start', 5)?.classification).toBe('start')
  expect(classify('right', 'waiting-return', -5)?.classification).toBe('returned')
})

it('maps each step to the matching side of a raw camera frame', () => {
  expect(classify('left', 'seeking-target', 25)?.classification).toBe('target')
  expect(classify('right', 'seeking-target', -25)?.classification).toBe('target')
  expect(classify('left', 'seeking-target', -25)?.errors).toEqual(['neck-wrong-direction'])
  expect(classify('right', 'seeking-target', 25)?.errors).toEqual(['neck-wrong-direction'])
})

it('accepts the sideways ear shift of a tilt that pivots at the neck base', () => {
  // Ear midpoint 0.81 shoulder widths above the line; 30° moves it 0.41 widths sideways.
  const shift = 0.81 * Math.sin(Math.PI / 6) * 0.24
  expect(classify('left', 'seeking-target', 30, { shift })?.classification).toBe('target')
  expect(classify('right', 'seeking-target', -30, { shift: -shift })?.classification).toBe('target')
})

it('flags too far, a raised shoulder and a shifted head', () => {
  expect(classify('left', 'seeking-target', 60)?.errors).toEqual(['neck-range'])
  expect(classify('left', 'seeking-target', 25, { shrug: 0.06 })?.errors).toEqual([
    'neck-shoulder-line',
  ])
  expect(classify('left', 'seeking-target', 25, { shift: 0.2 })?.errors).toEqual([
    'neck-head-position',
  ])
})
