// FR-S-06: readiness only; not a clinical rule, body analysis or coaching authorization.
export type RecommendationInput = Readonly<{
  purpose: 'neck' | 'shoulder' | 'torso' | null
  bodyCheck: 'not-started' | 'unavailable' | 'observed'
}>

export type RecommendationReadiness = Readonly<{
  status: 'purpose-needed' | 'body-check-needed' | 'validation-pending'
  message: string
  alternative: '/start'
}>

// No motion has passed all release gates. Development candidates must not be reused here.
export const releasedMotionIds: readonly string[] = Object.freeze([])

export function recommendationReadiness(input: RecommendationInput): RecommendationReadiness {
  if (input.purpose === null) {
    return Object.freeze({
      status: 'purpose-needed',
      message: '스트레칭하고 싶은 부위를 선택하거나 직접 동작을 골라주세요.',
      alternative: '/start',
    })
  }
  if (input.bodyCheck !== 'observed') {
    return Object.freeze({
      status: 'body-check-needed',
      message: '신체 확인 정보가 없어 맞춤 동작을 추천할 수 없습니다. 직접 선택할 수 있습니다.',
      alternative: '/start',
    })
  }
  return Object.freeze({
    status: 'validation-pending',
    message: '맞춤 추천을 준비 중입니다. 검증이 완료되기 전에는 추천 결과를 제공하지 않습니다.',
    alternative: '/start',
  })
}
