// FR-S-02/03/04·FR-A-01: development demo of the neck coaching flow (2026-11 CTO/team approval).
// These bands are demo candidates for a raw (non-mirrored) laptop webcam, NOT validated,
// prescribed or released thresholds. The run stays DEV-only and labelled as a candidate review;
// releasedMotionIds stays empty.
import type { NeckRunConfiguration } from '../pages/NeckCoachingRun'
import type { NeckReviewCriteria } from '../posture/thresholds'

const deg = (value: number) => (value * Math.PI) / 180
export const NECK_DEMO_HOLD_MS = 5000

export const neckDemoCriteria: NeckReviewCriteria = Object.freeze({
  scope: 'image-plane-candidate-only',
  version: 'demo-neck-candidate-v1',
  minimumConfidence: 0.5,
  // Laptop CPU inference with face/hand models runs well below 30 fps.
  maxFrameAgeMs: 600,
  maxFrameGapMs: 600,
  // Ear line against the shoulder line. Negative = toward the user's left shoulder.
  neutralHeadRad: Object.freeze([deg(-8), deg(8)]) as readonly [number, number],
  leftHeadRad: Object.freeze([deg(-45), deg(-15)]) as readonly [number, number],
  rightHeadRad: Object.freeze([deg(15), deg(45)]) as readonly [number, number],
  // Shoulders stay level instead of the shoulder rising toward the ear.
  shoulderAxisRad: Object.freeze([deg(-8), deg(8)]) as readonly [number, number],
  // Ear midpoint relative to the shoulder midpoint, in shoulder widths. On a raw camera
  // frame the left→right shoulder axis points to image-left, so "above" is negative.
  // A side tilt pivots near the shoulder line, so the ears also slide ~0.4 widths at 30°.
  headAlongShoulder: Object.freeze([-0.6, 0.6]) as readonly [number, number],
  headNormalToShoulder: Object.freeze([-1.6, -0.25]) as readonly [number, number],
})

export const neckDemoRun: NeckRunConfiguration = Object.freeze({
  scope: 'candidate-review-only',
  // Records go only to the local development database and are labelled as test records.
  recording: 'isolated-local-test',
  criteria: neckDemoCriteria,
  plan: Object.freeze({
    motionId: 'neck-side',
    version: neckDemoCriteria.version,
    source: 'direct',
    maxFrameAgeMs: neckDemoCriteria.maxFrameAgeMs,
    maxFrameGapMs: neckDemoCriteria.maxFrameGapMs,
    steps: Object.freeze([
      Object.freeze({ id: 'left', kind: 'hold', targetMs: NECK_DEMO_HOLD_MS }),
      Object.freeze({ id: 'right', kind: 'hold', targetMs: NECK_DEMO_HOLD_MS }),
    ]),
  }) as NeckRunConfiguration['plan'],
  // Reached only through SessionGate on a DEV route with the bundled avatars.
  readGates: () =>
    Object.freeze({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
})
