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
