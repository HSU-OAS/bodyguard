// FR-M-02/07·FR-S-02: hip-anchored image-plane geometry, not anatomical/clinical angles.
import type { CapturedImage } from './capturedImage'
import { isInFrame, JOINT_COUNT, type Point } from './landmarks'
import type { NeckObservationInput } from './neckSideObservation'

export type ShrugFrame = NeckObservationInput['frame'] & Readonly<{ image?: CapturedImage }>
export function observeShoulderShrug(
  input: Readonly<{
    frame: ShrugFrame
    now: number
    minimumConfidence: number
    maxAgeMs: number
  }>,
) {
  const unavailable = Object.freeze({ status: 'unavailable' as const })
  try {
    const { frame, now, minimumConfidence, maxAgeMs } = input
    const { generation, sequence, at, image } = frame
    const width = image?.width,
      height = image?.height,
      mirrored = image?.imageIsMirrored
    if (
      !Number.isSafeInteger(generation) ||
      generation <= 0 ||
      !Number.isSafeInteger(sequence) ||
      sequence < 0 ||
      ![at, now, maxAgeMs].every(
        (n) => Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER,
      ) ||
      maxAgeMs <= 0 ||
      at > now ||
      now - at > maxAgeMs ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      !width ||
      !height ||
      width <= 0 ||
      height <= 0 ||
      typeof mirrored !== 'boolean' ||
      !Number.isFinite(minimumConfidence) ||
      minimumConfidence <= 0 ||
      minimumConfidence > 1
    )
      return unavailable
    const people = frame.result.landmarks
    if (
      !Array.isArray(people) ||
      people.length !== 1 ||
      !Array.isArray(people[0]) ||
      people[0].length !== JOINT_COUNT
    )
      return unavailable
    const points = new Map<number, Point>()
    for (const i of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
      const p = people[0][i]
      if (!p || typeof p !== 'object') return unavailable
      const copied = { x: p.x, y: p.y, z: p.z, visibility: p.visibility, presence: p.presence }
      if (
        !isInFrame(copied) ||
        copied.visibility === undefined ||
        !Number.isFinite(copied.visibility) ||
        copied.visibility < minimumConfidence ||
        copied.visibility > 1 ||
        (copied.presence !== undefined &&
          (!Number.isFinite(copied.presence) ||
            copied.presence < minimumConfidence ||
            copied.presence > 1))
      )
        return unavailable
      points.set(i, copied)
    }
    const xy = (i: number) => {
      const p = points.get(i)
      if (!p) throw new Error()
      return { x: (mirrored ? -1 : 1) * p.x * width, y: -p.y * height }
    }
    const [le, re, ls, rs, la, ra, lh, rh] = [7, 8, 11, 12, 13, 14, 23, 24].map(xy)
    const hx = rh.x - lh.x,
      hy = rh.y - lh.y,
      span = Math.hypot(hx, hy)
    if (!(span > 0)) return unavailable
    // Give the hip line an upward normal independent of anatomical label/image handedness.
    const sign = hx < 0 ? -1 : 1,
      ux = (sign * hx) / span,
      uy = (sign * hy) / span
    if (!(ux > 0)) return unavailable
    const cx = (lh.x + rh.x) / 2,
      cy = (lh.y + rh.y) / 2
    const project = (p: typeof lh) => ({
      x: ((p.x - cx) * ux + (p.y - cy) * uy) / span,
      y: (-(p.x - cx) * uy + (p.y - cy) * ux) / span,
    })
    const l = project(ls),
      r = project(rs),
      h = project({ x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 })
    const earX = (re.x - le.x) * ux + (re.y - le.y) * uy,
      earY = -(re.x - le.x) * uy + (re.y - le.y) * ux
    if (!(Math.hypot(earX, earY) > 0) || !((l.y + r.y) / 2 > 0)) return unavailable
    const arm = (s: typeof ls, e: typeof la) => {
      const dx = e.x - s.x,
        dy = e.y - s.y,
        length = Math.hypot(dx, dy)
      return length > 0 ? Math.acos(Math.max(-1, Math.min(1, (dx * uy - dy * ux) / length))) : NaN
    }
    const values = {
      hipImageAngleRad: Math.atan2(uy, ux),
      headHipLineAngleRad:
        Math.atan2(Math.sin(2 * Math.atan2(earY, earX)), Math.cos(2 * Math.atan2(earY, earX))) / 2,
      headHeightHipWidths: h.y,
      headOffsetAlongHip: h.x,
      trunkLeanRad: Math.atan2((l.x + r.x) / 2, (l.y + r.y) / 2),
      leftShoulderHeightHipWidths: l.y,
      rightShoulderHeightHipWidths: r.y,
      shoulderDifferenceHipWidths: l.y - r.y,
      leftUpperArmDownRad: arm(ls, la),
      rightUpperArmDownRad: arm(rs, ra),
    }
    if (!Object.values(values).every(Number.isFinite)) return unavailable
    return Object.freeze({
      status: 'available' as const,
      space: 'image-plane-only' as const,
      generation,
      sequence,
      at,
      ...values,
    })
  } catch {
    return unavailable
  }
}
