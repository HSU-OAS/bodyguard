// FR-R-03/FR-S-06: display names only; a name does not approve or enable a motion.
export const motionLabels: Readonly<Record<string, string>> = Object.freeze({
  'neck-side': '목 옆으로 기울이기',
  'chin-retraction': '턱 당기기',
  'shoulder-shrug': '어깨 으쓱·이완',
  'cross-body-shoulder': '팔 교차 어깨 늘이기',
  'arm-overhead': '팔 위로 뻗기',
  'lateral-trunk': '옆구리 늘이기',
  'seated-trunk-rotation': '상체 비틀기',
})

export function motionLabel(id: string): string {
  return Object.hasOwn(motionLabels, id) ? motionLabels[id] : id
}
