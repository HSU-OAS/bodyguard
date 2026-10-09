import { describe, expect, it } from 'vitest'
import {
  createFramingTrial,
  readFramingSample,
  reduceFramingTrial,
  summarizeFramingTrials,
  type TrialSettings,
} from './framingTrial'
import type { Point } from './landmarks'

const settings: TrialSettings = {
  model: 'full',
  framingMode: 'seated',
  fpsLimit: 30,
  handsEnabled: false,
  faceEnabled: false,
}
const points: Point[] = Array.from({ length: 33 }, () => ({
  x: 0.48,
  y: 0.5,
  z: 0,
  visibility: 0.9,
}))
const sample = (
  sampledAt = 1000,
  result: 'sufficient' | 'insufficient' | 'multiple' | 'unavailable' = 'sufficient',
) => ({
  sampledAt,
  result,
  visible: result === 'sufficient' ? 5 : 0,
  total: 5,
  hint: null,
})
function labelled(
  state = createFramingTrial(),
  observer: 'sufficient' | 'insufficient' | 'multiple' = 'sufficient',
  at = 1000,
  result: ReturnType<typeof sample>['result'] = 'sufficient',
  profile = settings,
) {
  const selected = reduceFramingTrial(state, { type: 'observer', observer })
  return reduceFramingTrial(selected, {
    type: 'capture',
    sample: sample(at, result),
    settings: profile,
    scenario: '정상 좌측',
  })
}
function begin(state = labelled(), unusedCondition = true) {
  return reduceFramingTrial(state, {
    type: 'begin-validation',
    settings,
    now: 1100,
    unusedCondition,
  })
}

describe('FR-M-07 / S2.M4: 관찰자 범위 대조는 자세 성공 판정이 아니다', () => {
  it('독립 라벨 없이 기존 최신100개 튜닝 기록을 유지한다', () => {
    let state = createFramingTrial()
    for (let i = 0; i < 101; i++)
      state = reduceFramingTrial(state, {
        type: 'capture',
        sample: sample(),
        settings,
        scenario: '정상 좌측',
      })
    expect(state.rows).toHaveLength(100)
    expect(summarizeFramingTrials(state.rows)).toEqual({
      matched: 0,
      mismatched: 0,
      overAccepted: 0,
      held: 0,
    })
    expect(begin(state).phase).toBe('tuning')
  })

  it('관찰자와 모델을 따로 보존하고 충분 과인식·복수·보류를 구분한다', () => {
    let state = labelled()
    state = labelled(state, 'insufficient', 1001)
    state = labelled(state, 'multiple', 1002)
    state = labelled(state, 'multiple', 1003, 'multiple')
    state = labelled(state, 'insufficient', 1004, 'insufficient')
    state = labelled(state, 'sufficient', 1005, 'unavailable')
    expect(summarizeFramingTrials(state.rows)).toEqual({
      matched: 3,
      mismatched: 2,
      overAccepted: 2,
      held: 1,
    })
    expect(state.observer).toBe('unrated')
    expect(state.rows[2]).toMatchObject({ observer: 'multiple', sample: { result: 'sufficient' } })
  })

  it('프레임을 중복·역순 라벨링해 비교 표본을 늘리지 않는다', () => {
    const initial = labelled()
    expect(labelled(initial).rows).toHaveLength(1)
    expect(labelled(initial, 'sufficient', 999).rows).toHaveLength(1)
  })

  it('비교 불가 튜닝·미사용 조건 미확인은 별도 검증에 들어가지 않는다', () => {
    expect(begin(labelled(undefined, 'sufficient', 1000, 'unavailable')).phase).toBe('tuning')
    expect(begin(labelled(), false).phase).toBe('tuning')
    expect(begin().phase).toBe('validation')
  })

  it('검증은 시작 뒤 새 프레임과 새 라벨이 필요하고 동결 집계를 유지한다', () => {
    let state = begin()
    const frozen = state.frozen
    state = reduceFramingTrial(state, {
      type: 'capture',
      sample: sample(1101),
      settings,
      scenario: '정상 좌측',
    })
    expect(state.rows).toHaveLength(1)
    expect(labelled(state, 'sufficient', 1099).rows).toHaveLength(1)
    state = labelled(state, 'insufficient', 1101)
    expect(state.rows).toHaveLength(2)
    expect(state.rows[1].phase).toBe('validation')
    for (let i = 0; i < 101; i++) state = labelled(state, 'sufficient', 1102 + i)
    expect(state.rows).toHaveLength(100)
    expect(state.rows.every((row) => row.phase === 'validation')).toBe(true)
    expect(state.frozen).toEqual(frozen)
    expect(summarizeFramingTrials(state.rows)).toEqual({
      matched: 100,
      mismatched: 0,
      overAccepted: 0,
      held: 0,
    })
  })

  it.each(['model', 'framingMode', 'fpsLimit', 'handsEnabled', 'faceEnabled'] as const)(
    '동결 뒤 %s 변경·복원도 지우기 전 재검증을 금지한다',
    (key) => {
      const changed = {
        ...settings,
        [key]: {
          model: 'heavy',
          framingMode: 'standing',
          fpsLimit: 15,
          handsEnabled: true,
          faceEnabled: true,
        }[key],
      } as TrialSettings
      let state = labelled(begin(), 'sufficient', 1101, 'sufficient', changed)
      expect(state.invalidated).toBe(true)
      expect(state.rows).toHaveLength(1)
      state = labelled(state, 'sufficient', 1102)
      expect(state.rows).toHaveLength(1)
      state = reduceFramingTrial(state, { type: 'clear' })
      expect(state).toEqual(createFramingTrial())
      expect(labelled(state, 'sufficient', 1103).rows).toHaveLength(1)
    },
  )

  it('명시적 설정 변경은 프레임 기록 전에도 동결을 무효화한다', () => {
    const state = reduceFramingTrial(begin(), { type: 'invalidate-settings' })
    expect(state.invalidated).toBe(true)
    expect(labelled(state, 'sufficient', 1101).rows).toHaveLength(1)
  })

  it('다른 설정의 튜닝 결과를 같은 집계에 합치지 않는다', () => {
    const other = labelled(labelled(), 'insufficient', 1001, 'sufficient', {
      ...settings,
      model: 'lite',
    })
    expect(begin(other).frozen?.tuning).toEqual({
      matched: 1,
      mismatched: 0,
      overAccepted: 0,
      held: 0,
    })
  })

  it.each([null, Number.NaN, Infinity, 2001, -1, 999])(
    '현재 프레임 아닌 %s는 범위 충족이 아니다',
    (sampledAt) => {
      const result = readFramingSample({
        running: true,
        sampledAt,
        personCount: 1,
        image: points,
        mode: 'seated',
        now: 2000,
      })
      expect(result.result).toBe('unavailable')
      expect(result.sampledAt).toBeNull()
      expect(result.visible).toBe(0)
    },
  )

  it('상반신과 전신 필수 관절을 구분하고 좌표를 반환하지 않는다', () => {
    const upper = points.map((point, index) => ({ ...point, y: index >= 23 ? 1.3 : point.y }))
    const input = { running: true, sampledAt: 1000, personCount: 1, image: upper, now: 1000 }
    expect(readFramingSample({ ...input, mode: 'seated' })).toMatchObject({
      result: 'sufficient',
      visible: 5,
      total: 5,
    })
    const full = readFramingSample({ ...input, mode: 'standing' })
    expect(full).toMatchObject({ result: 'insufficient', visible: 3, total: 9 })
    expect(Object.keys(full).sort()).toEqual(['hint', 'result', 'sampledAt', 'total', 'visible'])
    expect(JSON.stringify(full)).not.toContain('0.48')
  })

  it('낮은 presence·복수 포즈·중단·미검출·비정상 필수 관절은 충분하지 않다', () => {
    const input = {
      running: true,
      sampledAt: 1000,
      personCount: 1,
      image: points,
      mode: 'seated' as const,
      now: 1000,
    }
    const low = points.map((point, index) => (index === 11 ? { ...point, presence: 0 } : point))
    expect(readFramingSample({ ...input, image: low }).result).toBe('insufficient')
    expect(readFramingSample({ ...input, personCount: 2 }).result).toBe('multiple')
    for (const invalid of [
      { running: false },
      { personCount: 0 },
      { personCount: 1.5 },
      { image: null },
      { image: points.slice(0, 12) },
      { image: points.map((point, index) => (index === 11 ? { ...point, x: Number.NaN } : point)) },
    ]) {
      expect(readFramingSample({ ...input, ...invalid }).result).toBe('unavailable')
    }
  })

  it('0시점에서도 음수 시각을 거부하고 누락된 필수/나머지 관절은 실패 없이 처리한다', () => {
    const input = {
      running: true,
      sampledAt: 0,
      personCount: 1,
      image: points,
      mode: 'seated' as const,
      now: 0,
    }
    expect(readFramingSample({ ...input, sampledAt: -1 }).result).toBe('unavailable')
    const missing = points.map((point, index) => (index === 11 ? null : point)) as Point[]
    expect(readFramingSample({ ...input, image: missing }).result).toBe('unavailable')
    const optional = points.map((point, index) => (index === 25 ? null : point)) as Point[]
    expect(readFramingSample({ ...input, image: optional }).result).toBe('sufficient')
  })

  it('직렬화 가능한 기록/동결 상태는 좌표·영상 객체·과거 프레임 시각을 보존하지 않는다', () => {
    const initial = readFramingSample({
      running: true,
      sampledAt: 1000,
      personCount: 1,
      image: points,
      mode: 'seated',
      now: 1000,
    })
    const selected = reduceFramingTrial(createFramingTrial(), {
      type: 'observer',
      observer: 'sufficient',
    })
    const state = reduceFramingTrial(selected, {
      type: 'capture',
      sample: initial,
      settings,
      scenario: '정상 좌측',
    })
    expect(state.rows[0].sample).not.toHaveProperty('sampledAt')
    expect(JSON.stringify(state)).not.toContain('0.48')
    expect(JSON.stringify(state)).not.toContain('image')
    expect(Object.keys(state.rows[0]).sort()).toEqual([
      'id',
      'observer',
      'phase',
      'profile',
      'sample',
      'scenario',
    ])
  })
})
