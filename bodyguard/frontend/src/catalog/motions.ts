// FR-S-01/06: first documented candidate; development-only, not a released exercise.
export type Region = 'all' | 'neck' | 'shoulder' | 'torso'
export type Motion = Readonly<{
  id: string
  title: string
  region: Exclude<Region, 'all'>
  regionLabel: string
  summary: string
  steps: readonly string[]
  cautions: readonly string[]
  framing: string
  sources: readonly Readonly<{ title: string; url: string }>[]
  coachingStatus: 'pending-validation'
}>

export const previewMotions: readonly Motion[] = Object.freeze([
  Object.freeze({
    id: 'neck-side',
    title: '목 옆으로 기울이기',
    region: 'neck' as const,
    regionLabel: '목',
    summary: '어깨를 편하게 두고, 머리를 한쪽으로 천천히 기울였다가 중앙으로 돌아오는 동작입니다.',
    steps: Object.freeze([
      '바르게 앉아 머리를 중앙에 두고 양쪽 어깨를 편하게 내립니다.',
      '손으로 당기지 않고, 편안한 범위에서 머리를 한쪽 어깨 방향으로 천천히 기울입니다.',
      '머리를 천천히 중앙으로 되돌린 뒤 반대쪽도 같은 과정으로 움직입니다.',
    ]),
    cautions: Object.freeze([
      '머리를 손으로 당기지 마세요. 더 많이 기울이려고 무리하지 마세요.',
      '통증이나 어지러움이 생기면 즉시 멈추고 전문가에게 상담하세요.',
      '이 안내는 질환 진단이나 치료를 대신하지 않습니다.',
    ]),
    framing: '머리와 양쪽 어깨가 화면에 들어오도록 준비합니다. 전신이 더 보이는 것은 괜찮습니다.',
    sources: Object.freeze([
      Object.freeze({
        title: 'Cambridge University Hospitals',
        url: 'https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/',
      }),
      Object.freeze({
        title: 'North Bristol NHS',
        url: 'https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries',
      }),
    ]),
    coachingStatus: 'pending-validation' as const,
  }),
])

export function parseRegion(value: string | null): Region {
  return value === 'neck' || value === 'shoulder' || value === 'torso' ? value : 'all'
}

export function motionById(id: string): Motion | undefined {
  return previewMotions.find((motion) => motion.id === id)
}

// FR-S-06: literal normalized text, not a regular expression or diagnosis.
export function findMotions(query: string, region: Region): readonly Motion[] {
  const terms = query.trim().normalize('NFC').split(/\s+/).filter(Boolean)
  return previewMotions.filter((motion) => {
    const text = [motion.title, motion.summary, motion.regionLabel].join(' ')
    return (
      (region === 'all' || motion.region === region) && terms.every((term) => text.includes(term))
    )
  })
}
