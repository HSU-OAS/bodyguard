// FR-A-01/03: display-only framing; minimum horizontal room keeps raised fingertips visible.
import type { ReferenceMotion } from './referenceContentAssets'
export function referenceFraming(
  bodyHeight: number,
  width: number,
  height: number,
  view: 'full' | 'upper' | 'detail',
  motion: ReferenceMotion,
) {
  if (![bodyHeight, width, height].every((value) => Number.isFinite(value) && value > 0))
    throw new Error('Blender reference unavailable')
  const [center, desired] =
    view === 'full'
      ? [0.6, 0.72]
      : motion === 'arm-overhead'
        ? [0.85, 0.52]
        : view === 'upper'
          ? [0.78, 0.35]
          : [0.88, 0.24]
  const minimumX = bodyHeight * (view === 'full' || motion === 'arm-overhead' ? 0.85 : 0.45)
  const halfY = Math.max(bodyHeight * desired, (minimumX * height) / width),
    halfX = (halfY * width) / height
  return Object.freeze({ centerY: bodyHeight * center, halfY, halfX, guideX: halfX * 0.5 })
}

/** The upper panes share the same scale. Expand immediately to keep tracked
 * limb anchors visible; ease back in after they return. This is framing only,
 * not a claim that the model correctly represents a user's pose. */
export function upperComparisonHalfY(
  bodyHeight: number,
  paneWidth: number,
  height: number,
  offsets: readonly Readonly<{ x: number; y: number }>[],
  previous: number | null,
  deltaMs: number,
  motion: ReferenceMotion,
) {
  if (
    ![bodyHeight, paneWidth, height].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isFinite(deltaMs) ||
    deltaMs < 0 ||
    (previous !== null && (!Number.isFinite(previous) || previous <= 0))
  )
    throw new Error('Blender reference unavailable')
  let halfX = 0,
    halfY = 0
  for (const offset of offsets) {
    if (Number.isFinite(offset.x)) halfX = Math.max(halfX, Math.abs(offset.x) + bodyHeight * 0.17)
    if (Number.isFinite(offset.y)) halfY = Math.max(halfY, Math.abs(offset.y) + bodyHeight * 0.1)
  }
  const target = Math.max(
    bodyHeight * (motion === 'arm-overhead' ? 0.52 : 0.35),
    halfY,
    (halfX * height) / paneWidth,
  )
  if (previous === null || target >= previous) return target
  return target + (previous - target) * 2 ** (-deltaMs / 250)
}
