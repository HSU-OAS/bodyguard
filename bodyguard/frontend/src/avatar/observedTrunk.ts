// FR-A-01/03·FR-M-02/07: aggregate axis only; not individual vertebrae/pelvis/twist.
import { type Point, trustedJoints } from '../posture/landmarks'

// Exact existing GLTFLoader bones: spine05 has neck01 as a descendant.
// Root/pelvis and intermediate local rotations remain authored, not inferred.
export const OBSERVED_TRUNK_BINDING = Object.freeze({ bone: 'spine05', anchor: 'neck01' })
const ENDPOINTS = [11, 12, 23, 24] as const

/** Same single image/world result. No automatic calibration, anatomical
 * rotation distribution, positional reconstruction or correctness signal.
 */
export function observedTrunkDirection(
  image: readonly Point[] | null,
  world: readonly Point[] | null,
  mirror: boolean,
): Readonly<Record<string, readonly number[]>> {
  const trusted = trustedJoints(image)
  const result: Record<string, readonly number[]> = {}
  // Snapshot each world component once, before validating foreign getters.
  const points = ENDPOINTS.map((index) => {
    const p = world?.[index]
    return p ? { x: p.x, y: p.y, z: p.z } : null
  })
  const [leftShoulder, rightShoulder, leftHip, rightHip] = points
  if (
    leftShoulder &&
    rightShoulder &&
    leftHip &&
    rightHip &&
    ENDPOINTS.every((index, position) => {
      const p = points[position]
      return trusted[index] && p && [p.x, p.y, p.z].every(Number.isFinite)
    })
  ) {
    // Divide before adding to avoid midpoint overflow; subtraction checked separately.
    const value = (['x', 'y', 'z'] as const).map(
      (key) =>
        leftShoulder[key] / 2 + rightShoulder[key] / 2 - (leftHip[key] / 2 + rightHip[key] / 2),
    )
    value[0] *= mirror ? -1 : 1
    value[1] *= -1
    value[2] *= -1
    const length = Math.hypot(...value)
    if (value.every(Number.isFinite) && Number.isFinite(length) && length > 0)
      result[OBSERVED_TRUNK_BINDING.bone] = Object.freeze(
        value.map((component) => component / length),
      )
  }
  return Object.freeze(result)
}
