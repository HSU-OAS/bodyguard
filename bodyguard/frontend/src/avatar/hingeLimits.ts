// FR-A-01/03: display-only elbow/knee shaping. A single webcam's depth estimate bends straight
// limbs (real user: hanging arms read 26-34° bent). Small bends are eased toward straight and
// folding is capped at what a hinge can do. Never a range-of-motion measurement or verdict.
import { Vector3 } from 'three'

export const HINGES = Object.freeze([
  ['upperarm01L', 'lowerarm01L'],
  ['upperarm01R', 'lowerarm01R'],
  ['upperleg01L', 'lowerleg01L'],
  ['upperleg01R', 'lowerleg01R'],
] as const)
export const MAX_HINGE_FLEXION_DEG = 150
// Below this the observed bend is mostly depth noise; it is progressively straightened.
export const HINGE_SOFT_ZONE_DEG = 70
const MIN_KEEP = 0.15

/** Shown flexion (degrees) for an observed flexion (degrees). Monotonic; identity above the soft
 * zone, capped at the hinge maximum. */
export function shownFlexion(observedDeg: number) {
  if (!Number.isFinite(observedDeg) || observedDeg <= 0) return 0
  const t = Math.min(1, observedDeg / HINGE_SOFT_ZONE_DEG)
  const keep = MIN_KEEP + (1 - MIN_KEEP) * t * t * (3 - 2 * t)
  return Math.min(MAX_HINGE_FLEXION_DEG, observedDeg * keep)
}

/** Rewrites each child direction in the plane it shares with its parent. Inputs are unit
 * avatar-space directions; pairs with a missing side are left untouched. */
export function shapeHinges(directions: Record<string, readonly number[]>) {
  const parent = new Vector3()
  const child = new Vector3()
  const axis = new Vector3()
  for (const [upper, lower] of HINGES) {
    const a = directions[upper]
    const b = directions[lower]
    if (!a || !b) continue
    parent.set(a[0], a[1], a[2]).normalize()
    child.set(b[0], b[1], b[2]).normalize()
    const observed = parent.angleTo(child)
    axis.crossVectors(parent, child)
    if (!Number.isFinite(observed) || axis.lengthSq() < 1e-12) continue
    const shown = (shownFlexion((observed * 180) / Math.PI) * Math.PI) / 180
    child.copy(parent).applyAxisAngle(axis.normalize(), shown)
    directions[lower] = [child.x, child.y, child.z]
  }
  return directions
}
