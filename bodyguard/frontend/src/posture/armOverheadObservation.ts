// FR-M-02/07·FR-S-02: same captured plane, never an anatomical joint measurement.
import { JOINT_COUNT, type Point } from './landmarks'
import { observeShoulderShrug, type ShrugFrame } from './shoulderShrugObservation'

export function observeArmOverhead(
  input: Readonly<{
    frame: ShrugFrame
    now: number
    minimumConfidence: number
    maxAgeMs: number
  }>,
) {
  const unavailable = Object.freeze({ status: 'unavailable' as const })
  try {
    const { frame, now, minimumConfidence, maxAgeMs } = input,
      { generation, sequence, at } = frame,
      image = frame.image
    if (!image) return unavailable
    const captured = {
        width: image.width,
        height: image.height,
        imageIsMirrored: image.imageIsMirrored,
      },
      people = frame.result.landmarks
    if (
      !Array.isArray(people) ||
      people.length !== 1 ||
      !Array.isArray(people[0]) ||
      people[0].length !== JOINT_COUNT
    )
      return unavailable
    const points: Point[] = Array(JOINT_COUNT)
    for (const i of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
      const p = people[0][i]
      if (!p || typeof p !== 'object') return unavailable
      points[i] = { x: p.x, y: p.y, z: p.z, visibility: p.visibility, presence: p.presence }
    }
    // Existing upper-body confidence/time/hip projection checks run on this one private copy.
    const base = observeShoulderShrug({
      frame: { generation, sequence, at, image: captured, result: { landmarks: [points] } },
      now,
      minimumConfidence,
      maxAgeMs,
    })
    if (base.status !== 'available') return unavailable
    const xy = (i: number) => ({
        x: (captured.imageIsMirrored ? -1 : 1) * points[i].x * captured.width,
        y: -points[i].y * captured.height,
      }),
      hips = [xy(23), xy(24)],
      span = Math.hypot(hips[1].x - hips[0].x, hips[1].y - hips[0].y),
      ux = Math.cos(base.hipImageAngleRad),
      uy = Math.sin(base.hipImageAngleRad),
      face = xy(0)
    const elbow = (s: number, e: number, w: number) => {
      const a = xy(s),
        b = xy(e),
        c = xy(w),
        x = a.x - b.x,
        y = a.y - b.y,
        u = c.x - b.x,
        v = c.y - b.y,
        length = Math.hypot(x, y) * Math.hypot(u, v)
      return length > 0 ? Math.acos(Math.max(-1, Math.min(1, (x * u + y * v) / length))) : NaN
    }
    const wrist = (i: number) => {
      const p = xy(i)
      return (-(p.x - face.x) * uy + (p.y - face.y) * ux) / span
    }
    const values = {
      leftElbowRad: elbow(11, 13, 15),
      rightElbowRad: elbow(12, 14, 16),
      leftWristAboveFaceHipWidths: wrist(15),
      rightWristAboveFaceHipWidths: wrist(16),
    }
    if (!Object.values(values).every(Number.isFinite)) return unavailable
    return Object.freeze({ ...base, ...values })
  } catch {
    return unavailable
  }
}
