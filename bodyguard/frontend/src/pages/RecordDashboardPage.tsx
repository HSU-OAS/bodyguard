// FR-R-03/06, FR-U-04: the committed account/query lease owns every visible result.
import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../api/auth'
import {
  type DashboardQuery,
  dashboardQuery,
  dashboardTimezone,
  readDashboard,
} from '../api/dashboard'
import type { DashboardOut } from '../api/generated'
import { localDay } from '../api/records'
import { type ReadyAccount, useAuth } from '../auth'
import './RecordsPage.css'
import './RecordDashboardPage.css'

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
const duration = (value: number) =>
  value > 0 && value < 0.005 ? '0.01초 미만' : `${number.format(value)}초`
const names = { neck: '목', shoulder: '어깨', trunk: '몸통' }
type View = { owner: ReadyAccount; key: string } & (
  | { status: 'loading' | 'error' | 'auth-error' | 'invalid' }
  | { status: 'ready'; data: DashboardOut }
)
export function RecordDashboardPage() {
  const { state, refresh } = useAuth()
  const authority = state.status === 'ready' ? state : null
  const owner = useRef(authority),
    current = useRef<AbortController | null>(null)
  const [params, setParams] = useSearchParams(),
    search = params.toString()
  const [revision, setRevision] = useState(0),
    key = `${search}:${revision}`
  const query = useMemo(() => {
    try {
      return dashboardQuery(new URLSearchParams(search))
    } catch {
      return null
    }
  }, [search])
  const canonical = !!query && ['date', 'period', 'timezone'].every((field) => params.has(field))
  const fallbackZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const recoveryZone = useMemo(() => {
    const zone = new URLSearchParams(search).get('timezone') ?? fallbackZone
    try {
      return dashboardTimezone(zone)
    } catch {
      return fallbackZone
    }
  }, [search, fallbackZone])
  const [draft, setDraft] = useState({
    date: query?.date ?? localDay(new Date()),
    period: query?.period ?? 'day',
  })
  const [invalid, setInvalid] = useState(false),
    [view, setView] = useState<View | null>(null)
  const heading = useRef<HTMLHeadingElement>(null),
    results = useRef<HTMLHeadingElement>(null)
  const lastKey = useRef(key),
    focusResults = useRef(false)
  useLayoutEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key
      focusResults.current = true
    }
    owner.current = authority
    const operation = new AbortController()
    current.current = operation
    return () => {
      operation.abort()
      if (current.current === operation) current.current = null
    }
  }, [authority, key])
  useEffect(() => {
    if (query && !canonical) setParams(query, { replace: true })
  }, [query, canonical, setParams])
  useEffect(() => {
    setDraft({ date: query?.date ?? localDay(new Date()), period: query?.period ?? 'day' })
    setInvalid(false)
  }, [query])
  useEffect(() => {
    document.title = '내 기록 대시보드 · BODYGUARD'
    if (document.hasFocus()) heading.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (!authority || !query || !canonical || !current.current) return
    const operation = current.current
    const live = () =>
      !operation.signal.aborted && current.current === operation && owner.current === authority
    setView({ owner: authority, key, status: 'loading' })
    void readDashboard(
      { authority, readAuthority: () => owner.current, signal: operation.signal },
      query,
    )
      .then((data) => {
        if (live()) setView({ owner: authority, key, status: 'ready', data })
      })
      .catch((error) => {
        if (!live()) return
        const status =
          error instanceof ApiError && [401, 403].includes(error.status)
            ? 'auth-error'
            : error instanceof ApiError && error.status === 422
              ? 'invalid'
              : 'error'
        setView({ owner: authority, key, status })
      })
    return () => operation.abort()
  }, [authority, query, canonical, key])
  const shown = view?.owner === authority && view.key === key ? view : null
  const ready = shown?.status === 'ready' ? shown.data : null
  useEffect(() => {
    if (shown && shown.status !== 'loading' && focusResults.current) {
      focusResults.current = false
      if (document.hasFocus()) results.current?.focus()
    }
  }, [shown])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let next: DashboardQuery
    try {
      next = dashboardQuery(
        new URLSearchParams({ ...draft, timezone: query?.timezone ?? recoveryZone }),
      )
    } catch {
      setInvalid(true)
      document.getElementById('dashboard-date')?.focus()
      return
    }
    setInvalid(false)
    focusResults.current = true
    setParams(next)
    setRevision((value) => value + 1)
  }
  if (!authority) return null
  return (
    <section className="records-screen dashboard-screen">
      <p className="eyebrow">MY RECORD OVERVIEW</p>
      <h1 tabIndex={-1} ref={heading}>
        내 기록 대시보드
      </h1>
      <p className="records-intro">기록된 시간을 기준으로, 하루와 한 주의 움직임을 살펴보세요.</p>
      <p className="records-explanation muted">
        저장된 자세·수행 기록을 함께 확인합니다. 측정 연결은 준비 중이며, 기록의 값은 질환 진단이나
        올바른 자세의 인증이 아닙니다.
      </p>
      <form className="dashboard-filter" onSubmit={submit} noValidate aria-label="대시보드 조회">
        <fieldset>
          <legend>조회 기간</legend>
          <div className="dashboard-period">
            {(['day', 'week'] as const).map((period) => (
              <label key={period}>
                <input
                  type="radio"
                  name="dashboard-period"
                  value={period}
                  checked={draft.period === period}
                  onChange={() => setDraft((previous) => ({ ...previous, period }))}
                />
                {period === 'day' ? '하루' : '한 주'}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="dashboard-date" htmlFor="dashboard-date">
          기준 날짜
          <input
            id="dashboard-date"
            type="date"
            value={draft.date}
            aria-invalid={invalid || !query}
            aria-describedby={invalid || !query ? 'dashboard-input-error' : undefined}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, date: event.target.value }))
            }
          />
        </label>
        <button className="button primary" type="submit">
          기록 조회
        </button>
        <p className="dashboard-zone muted">
          시간대 · {query?.timezone ?? recoveryZone}
          <br />한 주는 월요일부터 일요일까지입니다.
        </p>
        {(invalid || !query) && (
          <p id="dashboard-input-error" role="alert" className="form-error">
            올바른 날짜와 기간을 선택하세요. 잘못된 페이지 주소는 기록 조회로 다시 시작할 수
            있습니다.
          </p>
        )}
      </form>
      {query && !invalid && (
        <section
          className="records-results"
          aria-labelledby="dashboard-results"
          aria-busy={!shown || shown.status === 'loading'}
        >
          <h2 id="dashboard-results" tabIndex={-1} ref={results}>
            {ready?.local_start ?? query.date}
            {ready ? ` ~ ${ready.local_end}` : ''} · {query.period === 'day' ? '하루' : '한 주'}{' '}
            기록
          </h2>
          {(!shown || shown.status === 'loading') && (
            <div className="records-state" role="status">
              <p>저장된 기록을 조회하고 있습니다.</p>
            </div>
          )}
          {shown?.status === 'error' && (
            <div className="records-state">
              <p role="alert">기록을 조회하지 못했습니다. 연결을 확인하고 다시 조회하세요.</p>
              <button
                className="button secondary"
                type="button"
                onClick={() => setRevision((value) => value + 1)}
              >
                다시 조회
              </button>
            </div>
          )}
          {shown?.status === 'invalid' && (
            <div className="records-state">
              <p role="alert">이 시간대에 존재하는 날짜를 선택하고 기록 조회를 다시 눌러 주세요.</p>
            </div>
          )}
          {shown?.status === 'auth-error' && (
            <div className="records-state">
              <p role="alert">계정 연결을 다시 확인해야 합니다. 이전 기록은 표시하지 않았습니다.</p>
              <button className="button secondary" type="button" onClick={() => void refresh()}>
                계정 다시 확인
              </button>
            </div>
          )}
          {ready && (
            <>
              <p className="dashboard-boundary muted">
                {ready.timezone} 기준 · 종료 날짜 00:00 이전까지 집계 · 수행은 시작일에 한 번만 반영
              </p>
              {ready.totals.minutes === 0 &&
                Object.values(ready.stretch).every((value) => value === 0) && (
                  <div className="records-state">
                    <h3>이 기간에는 저장된 기록이 없습니다</h3>
                    <p>다른 날짜를 선택하거나, 저장된 기록이 있는 기간을 조회하세요.</p>
                  </div>
                )}
              <dl className="dashboard-overview" aria-label="기간 요약">
                <div>
                  <dt>기록된 관찰 시간</dt>
                  <dd>{duration(ready.totals.coverage_sec)}</dd>
                  <dd className="dashboard-overview-note">
                    {number.format(ready.totals.minutes)}개의 분 단위 기록
                  </dd>
                </div>
                <div>
                  <dt>측정된 시간</dt>
                  <dd>{duration(ready.totals.measured_sec)}</dd>
                  <dd className="dashboard-overview-note">
                    측정되지 않은 시간을 정상으로 포함하지 않습니다.
                  </dd>
                </div>
                <div>
                  <dt>완료한 수행</dt>
                  <dd>{number.format(ready.stretch.completed)}건</dd>
                  <dd className="dashboard-overview-note">
                    중단 {number.format(ready.stretch.interrupted)}건 · 건너뜀{' '}
                    {number.format(ready.stretch.skipped)}건
                  </dd>
                </div>
              </dl>
              <dl className="dashboard-context" aria-label="관찰 시간 세부">
                <div>
                  <dt>신체가 관찰된 시간</dt>
                  <dd>{duration(ready.totals.present_sec)}</dd>
                </div>
                <div>
                  <dt>측정 미집계 시간</dt>
                  <dd>{duration(ready.totals.unmeasurable_sec)}</dd>
                </div>
                <div>
                  <dt>백그라운드 시간</dt>
                  <dd>{duration(ready.totals.background_sec)}</dd>
                </div>
                <div>
                  <dt>하나 이상 부위의 이탈 시간</dt>
                  <dd>{duration(ready.totals.any_bad_sec)}</dd>
                </div>
              </dl>
              <section className="dashboard-parts" aria-labelledby="dashboard-parts">
                <h3 id="dashboard-parts">부위별 기록</h3>
                <p className="muted">
                  평균 편차는 측정 시간으로 가중합니다. 이탈 비율은 해당 부위의 측정 시간만 기준으로
                  계산하며, 기준·버전·방법·단위가 다른 기록은 합치지 않습니다.
                </p>
                {ready.metrics.length === 0 ? (
                  <p className="dashboard-no-parts">부위별 측정 기록이 없습니다.</p>
                ) : (
                  <ul>
                    {ready.metrics.map((part) => (
                      <li
                        key={JSON.stringify([
                          part.part,
                          part.baseline_id,
                          part.client_version,
                          part.method,
                          part.unit,
                        ])}
                      >
                        <div className="dashboard-part-heading">
                          <h4>{names[part.part]}</h4>
                          <span>
                            {part.baseline_id === null ? '보정 전' : `기준 ${part.baseline_id}`}
                          </span>
                        </div>
                        <p className="dashboard-method muted">
                          버전 {part.client_version} · 방법 {part.method} · 단위 {part.unit}
                        </p>
                        {part.dev_mean === null ? (
                          <p className="dashboard-missing">측정 기록 없음</p>
                        ) : (
                          <dl className="dashboard-metrics">
                            <div>
                              <dt>평균 편차</dt>
                              <dd>
                                {number.format(part.dev_mean)} {part.unit}
                              </dd>
                            </div>
                            <div>
                              <dt>이탈 비율</dt>
                              <dd>
                                {part.bad_ratio !== null && part.bad_ratio <= 1.000001
                                  ? `${number.format(part.bad_ratio * 100)}%`
                                  : '시간 정밀도 확인 필요'}
                              </dd>
                            </div>
                            <div>
                              <dt>측정 시간</dt>
                              <dd>{duration(part.measured_sec)}</dd>
                            </div>
                            <div>
                              <dt>이탈 시간</dt>
                              <dd>{duration(part.bad_sec)}</dd>
                            </div>
                          </dl>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <p className="dashboard-notifications muted">알림 기록 연결 준비 중</p>
            </>
          )}
        </section>
      )}
      <nav className="dashboard-management" aria-label="상세 기록 관리">
        <Link className="button secondary" to="/posture-records">
          자세 기록 관리
        </Link>
        <Link className="back-link" to="/records">
          수행 기록 관리
        </Link>
        <Link className="back-link" to="/account">
          계정 관리
        </Link>
      </nav>
    </section>
  )
}
