// FR-S-03/04·FR-A-01: actual Blender-only animation assets, not clinical targets.
import type { AvatarGender } from './reviewAvatarAssets.ts'

export type ReferenceMotion = 'neck-side' | 'shoulder-shrug' | 'arm-overhead'
const rows = {
  male: {
    'neck-side': [170036, '3ff797205d6d4e9b64dcb6978a02a71b9dc232b88684dd9bac88f738a57f8b0a'],
    'shoulder-shrug': [162996, '918a689df109be458b0e0cf5b3329e73501eda04c12bde64c83c65f22d869d9f'],
    'arm-overhead': [170244, 'a8dffa164a556e6b3792abda2359e240d032d588d28afaf269c97c63bc87b433'],
  },
  female: {
    'neck-side': [170768, '448bd66553dffd0bb71bf3f5b7f3fc18bc3c1e0512d2508388c2b568212867a9'],
    'shoulder-shrug': [163312, '10b32291301e32a0abe03469d3bb894f7d2d6419514cab0ad9837605ab642eea'],
    'arm-overhead': [170560, 'd5ee3957521d10d6b21be45bc43ad6155f828ab6f39890cbf3b67263a085774d'],
  },
} as const
export function referenceMotion(id: string): id is ReferenceMotion {
  return id === 'neck-side' || id === 'shoulder-shrug' || id === 'arm-overhead'
}
export function referenceContentAsset(gender: AvatarGender, motion: ReferenceMotion) {
  if (!Object.hasOwn(rows, gender) || !referenceMotion(motion))
    throw new Error('Blender reference unavailable')
  const [bytes, sha256] = rows[gender][motion]
  return Object.freeze({
    url: `/__bodyguard/reference-content/${gender}/${motion}.glb`,
    filename: `${gender}-${motion}${motion === 'neck-side' ? '-seated' : ''}.glb`,
    bytes,
    sha256,
  })
}
