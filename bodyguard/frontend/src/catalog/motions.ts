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
  reviewMode: 'coaching-candidate' | 'guidance-candidate'
  observationLimit: string
}>

function freezeMotion(motion: Motion): Motion {
  return Object.freeze({
    ...motion,
    steps: Object.freeze([...motion.steps]),
    cautions: Object.freeze([...motion.cautions]),
    sources: Object.freeze(motion.sources.map((source) => Object.freeze({ ...source }))),
  })
}

const commonCautions = [
  '통증이나 어지러움이 생기면 즉시 멈추고 전문가에게 상담하세요.',
  '이 안내는 질환 진단이나 치료를 대신하지 않습니다.',
] as const

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
    reviewMode: 'coaching-candidate' as const,
    observationLimit:
      '화면상 머리 기울기와 어깨 움직임만 검증 대상입니다. 경추 분절·통증·손의 힘은 측정하지 않습니다.',
  }),
  freezeMotion({
    id: 'chin-retraction',
    title: '턱 당기기',
    region: 'neck',
    regionLabel: '목',
    summary: '머리를 아래로 숙이지 않고 턱을 부드럽게 뒤로 당겼다가 돌아옵니다.',
    steps: [
      '등을 세우고 편하게 앉습니다.',
      '목과 등을 곧게 유지하며 턱을 부드럽게 뒤로 당깁니다. 머리를 앞으로 숙이지 않습니다.',
      '편안한 범위에서 천천히 시작 위치로 돌아옵니다.',
    ],
    cautions: [...commonCautions, '턱을 강하게 밀거나 목을 숙여 범위를 늘리지 마세요.'],
    framing:
      '머리와 어깨가 보이도록 준비합니다. 정면 촬영만으로 턱의 뒤쪽 이동은 판정하지 않습니다.',
    sources: [
      {
        title: 'Cambridge University Hospitals',
        url: 'https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/',
      },
    ],
    coachingStatus: 'pending-validation',
    reviewMode: 'guidance-candidate',
    observationLimit:
      '정면에서 깊이 방향 이동과 숙임을 구별하기 어렵습니다. 측면 실측 전 자동 교정·성공·타이머를 제공하지 않습니다.',
  }),
  freezeMotion({
    id: 'cross-body-shoulder',
    title: '팔 교차 어깨 늘이기',
    region: 'shoulder',
    regionLabel: '어깨',
    summary: '어깨를 편하게 두고 한 팔을 가슴 앞으로 가져와 위팔을 잡습니다.',
    steps: [
      '양쪽 어깨를 편하게 내립니다.',
      '한 팔을 가슴 앞으로 가져와 반대 손으로 위팔을 잡고 부드럽게 당깁니다.',
      '팔을 편하게 내린 뒤 반대쪽도 같은 과정으로 움직입니다.',
    ],
    cautions: [...commonCautions, '팔꿈치를 잡아 당기거나 팔꿈치에 압력을 주지 마세요.'],
    framing: '양쪽 어깨·팔꿈치·손목이 보이도록 준비합니다.',
    sources: [
      {
        title: 'AAOS · Crossover Arm Stretch',
        url: 'https://orthoinfo.aaos.org/globalassets/pdfs/2024-rotator-cuff-and-shoulder-conditioning-program.pdf',
      },
    ],
    coachingStatus: 'pending-validation',
    reviewMode: 'guidance-candidate',
    observationLimit:
      '손으로 잡는 정확한 위치와 압력은 웹캠으로 확인하지 못합니다. 자동 성공·교정·타이머를 제공하지 않습니다.',
  }),
  freezeMotion({
    id: 'lateral-trunk',
    title: '옆구리 늘이기',
    region: 'torso',
    regionLabel: '상체',
    summary: '앉아서 한 팔을 머리 위로 올리고 몸통을 천천히 옆으로 기울입니다.',
    steps: [
      '의자에 바르게 앉아 정면을 봅니다.',
      '한 팔을 머리 위로 올리고 몸통을 옆으로 천천히 기울이며 반대 손을 아래로 내립니다.',
      '편하게 이완하고 시작 위치로 돌아옵니다.',
    ],
    cautions: [
      ...commonCautions,
      '앞으로 숙이거나 몸통을 비틀지 마세요. 편안한 범위를 넘기지 마세요.',
    ],
    framing: '머리 위로 올린 손부터 양쪽 어깨·골반까지 보이도록 준비합니다.',
    sources: [
      {
        title: 'Leeds Teaching Hospitals · Lateral muscles stretch',
        url: 'https://www.leedsth.nhs.uk/wp-content/uploads/2023/08/Exercise-NASS-Home-exercises-for-axSpA_AS-v2.pdf',
      },
    ],
    coachingStatus: 'pending-validation',
    reviewMode: 'guidance-candidate',
    observationLimit:
      '정면에서 앞으로 숙임과 비틀림을 충분히 배제하지 못합니다. 자동 성공·교정·타이머를 제공하지 않습니다.',
  }),
  freezeMotion({
    id: 'seated-trunk-rotation',
    title: '상체 비틀기',
    region: 'torso',
    regionLabel: '상체',
    summary: '의자에 앉아 골반 위치를 유지하며 상체를 천천히 좌우로 돌립니다.',
    steps: [
      '등받이에서 떨어져 바르게 앉고 팔을 가슴 앞에 모읍니다.',
      '골반은 시작 위치에 두고 상체를 한쪽으로 천천히 돌립니다. 머리는 몸이 향하는 방향과 나란히 둡니다.',
      '편안한 범위에서 중앙으로 돌아와 반대쪽도 진행합니다.',
    ],
    cautions: [
      ...commonCautions,
      '골반을 함께 돌리거나 통증이 생기는 범위까지 움직이지 마세요.',
      '운동 범위를 제한받았다면 전문가의 개인별 안내를 먼저 따르세요.',
    ],
    framing: '앉은 상체와 골반이 보이도록 준비합니다.',
    sources: [
      {
        title: 'Kingston and Richmond NHS · Trunk stretch',
        url: 'https://www.kingstonandrichmond.nhs.uk/patients-and-families/patient-leaflets/home-exercise-programme-falls-prevention',
      },
    ],
    coachingStatus: 'pending-validation',
    reviewMode: 'guidance-candidate',
    observationLimit:
      '어깨 폭 변화만으로 몸통 회전과 카메라 위치 변화를 구별할 수 없습니다. 자동 성공·교정·타이머를 제공하지 않습니다.',
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
