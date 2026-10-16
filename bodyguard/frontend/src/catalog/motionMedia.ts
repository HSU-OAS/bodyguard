// FR-S-06·FR-A-01: private Blender-rendered candidates, never release/correct-pose readiness.
import type { MotionMedia } from '../pages/MotionPreview'

const candidates = ['neck-side', 'shoulder-shrug', 'arm-overhead'] as const
export function motionPreviewMedia(
  id: string,
  gender: 'male' | 'female' = 'male',
): MotionMedia | undefined {
  if (
    !import.meta.env.DEV ||
    (gender !== 'male' && gender !== 'female') ||
    !candidates.some((candidate) => candidate === id)
  )
    return undefined
  const base = `/__bodyguard/motion-media/${gender}/${id}`
  return Object.freeze({ poster: `${base}.png`, video: `${base}.mp4` })
}
