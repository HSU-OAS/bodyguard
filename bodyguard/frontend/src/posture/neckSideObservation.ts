import type { CapturedImage } from './capturedImage'
import { isInFrame, JOINT_COUNT, type Point } from './landmarks'

// FR-M-01/02/07: projected geometry only; no anatomical/clinical verdict or defaults.
export type NeckObservationInput = Readonly<{
  frame: Readonly<{
    generation: number
    sequence: number
    at: number
    result: Readonly<{ landmarks: readonly (readonly Point[])[] }>
  }>
  now: number
  width: number
  height: number
  imageIsMirrored: boolean
  minimumConfidence: number
  maxAgeMs: number
}>
export type NeckSideObservation = Readonly<
  | { status: 'unavailable' }
  | {
      status: 'available'
      space: 'image-plane-only'
      generation: number
      sequence: number
      at: number
      headShoulderLineAngleRad: number
      shoulderImageAngleRad: number
      leftEarShoulderDistanceInShoulderWidths: number
      rightEarShoulderDistanceInShoulderWidths: number
      headOffsetAlongShoulder: number
      headOffsetNormalToShoulder: number
    }
>

const unavailable: NeckSideObservation = Object.freeze({ status: 'unavailable' })
const clock = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
const dimension = (value: number) => Number.isSafeInteger(value) && value > 0

// FR-M-02/07: same-frame projection adapter. No inference, camera, fallback or verdict.
export function observeCapturedNeckSide(
  input: Readonly<{
    frame: NeckObservationInput['frame'] & Readonly<{ image?: CapturedImage }>
    now: number
    minimumConfidence: number
    maxAgeMs: number
  }>,
): NeckSideObservation {
  try {
    const { frame, now, minimumConfidence, maxAgeMs } = input
    const image = frame.image
    if (image === undefined) return unavailable
    const { width, height, imageIsMirrored } = image
    return observeNeckSide({
      frame,
      now,
      minimumConfidence,
      maxAgeMs,
      width,
      height,
      imageIsMirrored,
    })
  } catch {
    return unavailable
  }
}

export function observeNeckSide(input: NeckObservationInput): NeckSideObservation {
  try {
    const { frame, now, width, height, imageIsMirrored, minimumConfidence, maxAgeMs } = input
    const { generation, sequence, at, result } = frame
    if (
      !Number.isSafeInteger(generation) ||
      generation <= 0 ||
      !Number.isSafeInteger(sequence) ||
      sequence < 0 ||
      !clock(now) ||
      !clock(at) ||
      at > now ||
      !clock(maxAgeMs) ||
      maxAgeMs <= 0 ||
      now - at > maxAgeMs ||
      !dimension(width) ||
      !dimension(height) ||
      typeof imageIsMirrored !== 'boolean' ||
      !Number.isFinite(minimumConfidence) ||
      minimumConfidence <= 0 ||
      minimumConfidence > 1
    )
      return unavailable
    const people = result.landmarks
    if (!Array.isArray(people) || people.length !== 1) return unavailable
    const image = people[0]
    if (!Array.isArray(image) || image.length !== JOINT_COUNT) return unavailable
    const points: Point[] = []
    for (const index of [0, 7, 8, 11, 12]) {
      const source = image[index] as (Point & { presence?: number }) | undefined
      if (!source || typeof source !== 'object') return unavailable
      // Copy only the required current values. No raw input reference survives this call.
      const { x, y, z, visibility, presence } = source
      const point = { x, y, z, visibility }
      if (
        !isInFrame(point) ||
        visibility === undefined ||
        !Number.isFinite(visibility) ||
        visibility < minimumConfidence ||
        visibility > 1 ||
        (presence !== undefined &&
          (!Number.isFinite(presence) || presence < minimumConfidence || presence > 1))
      )
        return unavailable
      points.push(point)
    }
    const [, leftEar, rightEar, leftShoulder, rightShoulder] = points
    const sign = imageIsMirrored ? -1 : 1
    // FR-M-02: normalized x/y have different scales; restore the captured aspect.
    // Cartesian image-plane y points up. Neither this nor z is an anatomical angle.
    const delta = (a: Point, b: Point) => ({
      x: sign * (b.x - a.x) * width,
      y: (a.y - b.y) * height,
    })
    const shoulder = delta(leftShoulder, rightShoulder),
      ears = delta(leftEar, rightEar)
    const shoulderLength = Math.hypot(shoulder.x, shoulder.y),
      earLength = Math.hypot(ears.x, ears.y)
    if (!(shoulderLength > 0) || !(earLength > 0)) return unavailable
    const sx = shoulder.x / shoulderLength,
      sy = shoulder.y / shoulderLength
    const ex = ears.x / earLength,
      ey = ears.y / earLength
    const left = delta(leftShoulder, leftEar),
      right = delta(rightShoulder, rightEar)
    const offsetX = (left.x + right.x) / 2,
      offsetY = (left.y + right.y) / 2
    const values = {
      headShoulderLineAngleRad: Math.atan2(sx * ey - sy * ex, sx * ex + sy * ey),
      shoulderImageAngleRad: Math.atan2(sy, sx),
      leftEarShoulderDistanceInShoulderWidths: Math.hypot(left.x, left.y) / shoulderLength,
      rightEarShoulderDistanceInShoulderWidths: Math.hypot(right.x, right.y) / shoulderLength,
      headOffsetAlongShoulder: (offsetX * sx + offsetY * sy) / shoulderLength,
      headOffsetNormalToShoulder: (sx * offsetY - sy * offsetX) / shoulderLength,
    }
    if (!Object.values(values).every(Number.isFinite)) return unavailable
    return Object.freeze({
      status: 'available',
      space: 'image-plane-only',
      generation,
      sequence,
      at,
      ...values,
    })
  } catch {
    // FR-M-07: malformed input/accessors cannot expose raw errors or an earlier observation.
    return unavailable
  }
}
