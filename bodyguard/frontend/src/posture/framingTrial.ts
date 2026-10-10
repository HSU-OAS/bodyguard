// FR-M-02/07, S2.3b: DEV-only observer framing comparison, never a posture classifier.
import { type FramingMode, framingHint, REQUIRED_JOINTS } from './framing'
import { type Point, trustedJoints } from './landmarks'

export const TRIAL_SCENARIOS = [
  '정상 좌측',
  '정상 우측',
  '중앙 복귀',
  '어깨 으쓱 보상',
  '몸통 옆 기울임',
  '머리 회전',
  '상반신만 보임',
  '한쪽 어깨 가림',
  '전신 보임',
  '얼굴 가림',
  '두 사람 보임',
  '대상 전환',
  '사선·역광·어두움',
  '카메라 중단',
] as const
export type TrialScenario = (typeof TRIAL_SCENARIOS)[number]
export type ObserverFraming = 'unrated' | 'sufficient' | 'insufficient' | 'multiple'
export type FramingResult = Exclude<ObserverFraming, 'unrated'> | 'unavailable'
export type TrialSettings = {
  model: 'lite' | 'full' | 'heavy'
  framingMode: FramingMode
  fpsLimit: 0 | 15 | 30
  handsEnabled: boolean
  faceEnabled: boolean
}
export type FramingSample = {
  sampledAt: number | null
  result: FramingResult
  visible: number
  total: number
  hint: string | null
}
type Counts = { matched: number; mismatched: number; overAccepted: number; held: number }
type TrialRow = {
  id: number
  phase: 'tuning' | 'validation'
  profile: string
  scenario: TrialScenario
  observer: ObserverFraming
  sample: Omit<FramingSample, 'sampledAt'>
}
export type FramingTrial = {
  phase: 'tuning' | 'validation'
  observer: ObserverFraming
  rows: TrialRow[]
  frozen: { profile: string; cutoffAt: number; tuning: Counts } | null
  lastRatedAt: number | null
  invalidated: boolean
  message: string
  nextId: number
}
export type TrialAction =
  | { type: 'observer'; observer: ObserverFraming }
  | { type: 'capture'; sample: FramingSample; settings: TrialSettings; scenario: TrialScenario }
  | { type: 'begin-validation'; settings: TrialSettings; now: number; unusedCondition: boolean }
  | { type: 'invalidate-settings' }
  | { type: 'clear' }

export const trialProfileKey = (settings: TrialSettings): string =>
  `${settings.model}/${settings.framingMode}/${settings.fpsLimit}/${Number(settings.handsEnabled)}/${Number(settings.faceEnabled)}`

/** Discard coordinates at this boundary; the existing 1s freshness limit is a DEV condition only. */
export function readFramingSample(input: {
  running: boolean
  sampledAt: number | null
  personCount: number
  image: readonly Point[] | null
  mode: FramingMode
  now: number
}): FramingSample {
  const { running, sampledAt, personCount, image, mode, now } = input
  const age = sampledAt === null ? Number.NaN : now - sampledAt
  const fresh =
    sampledAt !== null &&
    Number.isFinite(sampledAt) &&
    sampledAt >= 0 &&
    Number.isFinite(now) &&
    now >= 0 &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 1000
  const required = REQUIRED_JOINTS[mode]
  const validCount = Number.isInteger(personCount) && personCount >= 0
  const validImage =
    Array.isArray(image) &&
    image.length === 33 &&
    required.every((index) => {
      const point = image[index]
      return (
        point !== null &&
        typeof point === 'object' &&
        [point.x, point.y, point.z, point.visibility].every(Number.isFinite) &&
        point.visibility >= 0 &&
        point.visibility <= 1 &&
        (point.presence === undefined ||
          (Number.isFinite(point.presence) && point.presence >= 0 && point.presence <= 1))
      )
    })
  const points = running && fresh && validCount && personCount === 1 && validImage ? image : null
  // Non-required malformed points cannot enter trustedJoints either.
  const trusted = trustedJoints(
    points?.map((point) => (point && typeof point === 'object' ? point : undefined)) as
      | readonly Point[]
      | undefined,
  )
  const visible = required.filter((joint) => trusted[joint]).length
  const result: FramingResult =
    !running || !fresh || !validCount || personCount === 0
      ? 'unavailable'
      : personCount > 1
        ? 'multiple'
        : !validImage
          ? 'unavailable'
          : visible === required.length
            ? 'sufficient'
            : 'insufficient'
  const hint = !running
    ? '측정 중 아님'
    : !fresh
      ? '새 프레임 대기 (촬영 범위 충족 아님)'
      : validCount && personCount > 1
        ? '복수 포즈 — 한 사람만 화면에 들어오게 해 주세요'
        : personCount === 1 && !validImage
          ? '필수 관절 입력 확인 필요 (촬영 범위 충족 아님)'
          : framingHint(points !== null, trusted, mode)
  return {
    sampledAt: running && fresh ? sampledAt : null,
    result,
    visible,
    total: required.length,
    hint,
  }
}

export function createFramingTrial(): FramingTrial {
  return {
    phase: 'tuning',
    observer: 'unrated',
    rows: [],
    frozen: null,
    lastRatedAt: null,
    invalidated: false,
    message: '',
    nextId: 1,
  }
}

export function summarizeFramingTrials(rows: readonly TrialRow[]): Counts {
  const counts = { matched: 0, mismatched: 0, overAccepted: 0, held: 0 }
  for (const { observer, sample } of rows) {
    if (observer === 'unrated') continue
    if (sample.result === 'unavailable') {
      counts.held++
      continue
    }
    if (observer === sample.result) counts.matched++
    else counts.mismatched++
    if (sample.result === 'sufficient' && observer !== 'sufficient') counts.overAccepted++
  }
  return counts
}

const SETTINGS_CHANGED = '설정이 바뀌었습니다. 기록 지우기로 새 튜닝을 시작하세요.'

/** Serialized actions consume each observer label once; no storage, DOM, models or coordinates. */
export function reduceFramingTrial(state: FramingTrial, action: TrialAction): FramingTrial {
  if (action.type === 'clear') return createFramingTrial()
  if (action.type === 'observer') return { ...state, observer: action.observer, message: '' }
  if (action.type === 'invalidate-settings')
    return state.phase === 'validation'
      ? { ...state, invalidated: true, message: SETTINGS_CHANGED }
      : state
  const profile = trialProfileKey(action.settings)
  if (action.type === 'begin-validation') {
    if (state.phase !== 'tuning') return state
    const tuning = summarizeFramingTrials(state.rows.filter((row) => row.profile === profile))
    if (
      !action.unusedCondition ||
      tuning.matched + tuning.mismatched === 0 ||
      !Number.isFinite(action.now) ||
      action.now < (state.lastRatedAt ?? 0)
    )
      return { ...state, message: '비교 가능한 튜닝 기록과 미사용 촬영 조건 확인이 필요합니다.' }
    return {
      ...state,
      phase: 'validation',
      observer: 'unrated',
      frozen: { profile, cutoffAt: action.now, tuning },
      message: '튜닝과 설정을 동결했습니다. 새 촬영 조건에서 관찰자 판단을 선택하세요.',
    }
  }
  const { sample, scenario } = action
  if (state.phase === 'validation' && (state.invalidated || state.frozen?.profile !== profile))
    return { ...state, invalidated: true, message: SETTINGS_CHANGED }
  if (state.phase === 'validation' && state.observer === 'unrated')
    return { ...state, message: '관찰자 판단을 먼저 선택하세요.' }
  const at = sample.sampledAt
  const usableTime = at !== null && Number.isFinite(at) && at >= 0
  if (state.phase === 'validation' && (!usableTime || at <= (state.frozen?.cutoffAt ?? Infinity)))
    return { ...state, message: '검증 시작 뒤 새 프레임을 기다려 주세요.' }
  if (state.observer !== 'unrated' && usableTime && at <= (state.lastRatedAt ?? -1))
    return { ...state, message: '이미 사용한 프레임입니다. 새 프레임을 기다려 주세요.' }
  const row: TrialRow = {
    id: state.nextId,
    phase: state.phase,
    profile,
    scenario,
    observer: state.observer,
    // Only the closed categorical summary survives. No input object spread/coordinate retention.
    sample: {
      result: sample.result,
      visible: sample.visible,
      total: sample.total,
      hint: sample.hint,
    },
  }
  return {
    ...state,
    rows: [...state.rows.slice(-99), row],
    nextId: state.nextId + 1,
    observer: 'unrated',
    lastRatedAt: state.observer !== 'unrated' && usableTime ? at : state.lastRatedAt,
    message: '현재 프레임을 기록했습니다.',
  }
}
