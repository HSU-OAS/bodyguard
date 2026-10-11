// FR-R-03/06/U-04: whole-period owned data within the existing records screen.
import { type FormEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type DashboardQuery, dashboardQuery, dashboardTimezone } from '../api/dashboard'
import { localDay, validDay } from '../api/records'
import { useOwnedDashboard } from '../records/useOwnedDashboard'

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
const names = { neck: '목', shoulder: '어깨', trunk: '몸통' } as const
const seconds = (value: number) =>
  value > 0 && value < 0.005 ? '0.01초 미만' : `${number.format(value)}초`

export function RecordPeriodSummary({
  anchor,
  disabled,
  onAuthFailure,
}: {
  anchor: string
  disabled: boolean
  onAuthFailure(): void
}) {
  const control = useOwnedDashboard()
  const [day, setDay] = useState(anchor)
  const [period, setPeriod] = useState<'day' | 'week'>('day')
  const [invalid, setInvalid] = useState(false)
  const request = useRef(0)
  const timezone = useMemo(() => {
    try {
      return dashboardTimezone(new Intl.DateTimeFormat().resolvedOptions().timeZone)
    } catch {
      return null
    }
  }, [])
  useLayoutEffect(() => {
    if (disabled) {
      request.current++
      control.cancel()
    }
  }, [disabled, control.cancel])
  useLayoutEffect(
    () => () => {
      request.current++
    },
    [],
  )
  function edit() {
    request.current++
    control.cancel()
    setInvalid(false)
  }
  async function read() {
    if (disabled || control.getSnapshot().status === 'loading') return
    if (!timezone || !validDay(day) || day > localDay(new Date())) {
      setInvalid(true)
      return
    }
    let query: DashboardQuery
    try {
      query = dashboardQuery(new URLSearchParams({ date: day, period, timezone }))
    } catch {
      setInvalid(true)
      return
    }
    setInvalid(false)
    const id = ++request.current
    await control.read(query)
    if (request.current !== id) return
    const snapshot = control.getSnapshot()
    if (snapshot.status === 'error' && [401, 403].includes(snapshot.statusCode)) onAuthFailure()
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void read()
  }
  const state = disabled ? null : control.state
  const value = state?.status === 'ready' ? state.value : null
  const last = value ? new Date(`${value.local_end}T00:00:00Z`) : null
  if (last) last.setUTCDate(last.getUTCDate() - 1)
  return (
    <section className="records-results period-summary" aria-labelledby="period-summary-heading">
      <h2 id="period-summary-heading">일·주 기록 요약</h2>
      <form className="records-filter" aria-label="일·주 요약 조회" onSubmit={submit} noValidate>
        <label htmlFor="period-summary-day">
          요약 날짜
          <input
            id="period-summary-day"
            type="date"
            value={day}
            disabled={disabled}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'period-summary-error' : undefined}
            onChange={(event) => {
              edit()
              setDay(event.target.value)
            }}
          />
        </label>
        <label htmlFor="period-summary-unit">
          요약 단위
          <select
            id="period-summary-unit"
            value={period}
            disabled={disabled}
            onChange={(event) => {
              edit()
              setPeriod(event.target.value as 'day' | 'week')
            }}
          >
            <option value="day">일</option>
            <option value="week">주</option>
          </select>
        </label>
        <button
          className="button secondary"
          type="submit"
          disabled={disabled}
          aria-disabled={disabled || state?.status === 'loading'}
        >
          {state?.status === 'error' ? '요약 다시 조회' : '요약 조회'}
        </button>
        {invalid && (
          <p className="form-error" id="period-summary-error" role="alert">
            오늘까지의 올바른 날짜를 선택하세요. 시간대를 확인할 수 없다면 브라우저 설정을
            확인하세요.
          </p>
        )}
      </form>
      <p className="small muted">
        {timezone ?? '시간대 확인 필요'} 기준 · 주는 월요일부터 일요일까지
      </p>
      {state?.status === 'idle' && (
        <p className="records-explanation muted">날짜와 단위를 고른 뒤 요약을 조회하세요.</p>
      )}
      {state?.status === 'loading' && (
        <p role="status" className="records-state">
          요약을 조회하고 있습니다.
        </p>
      )}
      {state?.status === 'error' && (
        <p role="alert" className="records-state">
          요약을 조회하지 못했습니다. 연결을 확인하고 다시 조회하세요.
        </p>
      )}
      {value && (
        <div aria-live="polite">
          <h3>
            {value.local_start} ~ {last?.toISOString().slice(0, 10)}
          </h3>
          {value.totals.minutes === 0 &&
          Object.values(value.stretch).every((count) => count === 0) ? (
            <p className="records-state">이 기간에는 저장된 기록이 없습니다</p>
          ) : (
            <>
              <p className="records-explanation">
                <span>{value.totals.minutes}분 기록</span> · 측정{' '}
                {seconds(value.totals.measured_sec)}
              </p>
              <p className="records-explanation">
                완료 {value.stretch.completed} · 중단 {value.stretch.interrupted} · 건너뜀{' '}
                {value.stretch.skipped}
              </p>
              {value.metrics.length > 0 && (
                <section
                  className="records-table-scroll"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard access to horizontal record-table scrolling.
                  tabIndex={0}
                  aria-label="기간 요약 표 스크롤"
                >
                  <table>
                    <caption className="sr-only">기간 전체의 부위별 저장 지표</caption>
                    <thead>
                      <tr>
                        <th scope="col">부위·방법</th>
                        <th scope="col">기준</th>
                        <th scope="col">평균 편차</th>
                        <th scope="col">측정 시간</th>
                        <th scope="col">이탈 비율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {value.metrics.map((metric) => (
                        <tr
                          key={JSON.stringify([
                            metric.part,
                            metric.baseline_id,
                            metric.client_version,
                            metric.method,
                            metric.unit,
                          ])}
                        >
                          <th scope="row">
                            {names[metric.part]}
                            <details>
                              <summary>측정 기준</summary>
                              <p>
                                {metric.method} · {metric.client_version} · {metric.unit}
                              </p>
                            </details>
                          </th>
                          <td>
                            {metric.baseline_id === null ? (
                              '보정 전'
                            ) : (
                              <details>
                                <summary>개인 기준</summary>
                                {metric.baseline_id}
                              </details>
                            )}
                          </td>
                          <td>
                            {metric.dev_mean === null
                              ? '—'
                              : `${number.format(metric.dev_mean)} ${metric.unit}`}
                          </td>
                          <td>{seconds(metric.measured_sec)}</td>
                          <td>
                            {metric.bad_ratio === null
                              ? '—'
                              : `${number.format(metric.bad_ratio * 100)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              <p className="records-explanation small muted">
                저장된 기록의 집계입니다. ‘—’는 측정값 없음이며 정상 판정이 아닙니다. 다른
                기준·방법·단위는 합치지 않습니다.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
