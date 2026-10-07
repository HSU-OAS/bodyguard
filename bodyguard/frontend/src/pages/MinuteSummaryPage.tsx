// FR-R-03/FR-U-04: actual owned minutes, with a committed authority and query lease.
import {
  type FormEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useSearchParams } from 'react-router'
import { ApiError } from '../api/auth'
import type { DeletePeriod, MinuteList, MinuteMetric, MinuteOut } from '../api/generated'
import { prepareSummaries, type SummaryContext } from '../api/minuteSummaries'
import { dateRange, defaultPeriod } from '../api/records'
import { type ReadyAccount, useAuth } from '../auth'
import { MinuteSummaryDeletion } from './MinuteSummaryDeletion'
import './RecordsPage.css'
import './MinuteSummaryPage.css'

const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
const names = { neck: '목', shoulder: '어깨', trunk: '몸통' } as const
const time = (value: number) =>
  value > 0 && value < 0.005 ? '0.01초 미만' : `${number.format(value)}초`
const mean = (part: MinuteMetric) =>
  part.dev_mean === null ? '—' : `${number.format(part.dev_mean)} ${part.unit}`
const ratio = (part: MinuteMetric) =>
  part.measured_sec === 0 ? '—' : `${number.format((part.bad_sec / part.measured_sec) * 100)}%`
type View = { owner: ReadyAccount; key: string } & (
  | { status: 'loading' | 'error' | 'auth-error' }
  | { status: 'ready'; data: MinuteList; context: SummaryContext; stale: boolean }
)

export function MinuteSummaryPage() {
  const { state, refresh } = useAuth()
  const authority = state.status === 'ready' ? state : null
  const owner = useRef(authority)
  const current = useRef<AbortController | null>(null)
  const [params, setParams] = useSearchParams()
  const search = params.toString()
  const [revision, setRevision] = useState(0)
  const key = `${search}:${revision}`
  const lastKey = useRef(key)
  const focusResults = useRef(false)
  const cutoffKey = `${params.get('from') ?? 'default'}:${params.get('to') ?? 'default'}:${revision}`
  const cutoff = useMemo(() => {
    void cutoffKey
    return new Date()
  }, [cutoffKey])
  const defaults = defaultPeriod(cutoff)
  const from = params.get('from') ?? defaults.from
  const to = params.get('to') ?? defaults.to
  const pageText = params.get('page') ?? '0'
  const page = /^(?:0|[1-9]\d{0,2})$/.test(pageText) ? Number(pageText) : -1
  const range = useMemo(() => {
    try {
      return page >= 0 && page <= 500 ? dateRange(from, to, cutoff) : null
    } catch {
      return null
    }
  }, [from, to, cutoff, page])
  const [draft, setDraft] = useState({ from, to })
  const draftRoute = useRef({ from, to, key })
  const [invalid, setInvalid] = useState(false)
  const [view, setView] = useState<View | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const detail = useRef<HTMLHeadingElement>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    void key
    if (lastKey.current !== key) {
      lastKey.current = key
      focusResults.current = true
    }
    owner.current = authority
    const operation = new AbortController()
    current.current = operation
    setBusy(false)
    return () => {
      operation.abort()
      if (current.current === operation) current.current = null
    }
  }, [authority, key])
  useEffect(() => {
    // FR-R-03: initialization already owns the first URL; do not overwrite early input.
    const previous = draftRoute.current
    if (previous.from === from && previous.to === to && previous.key === key) return
    draftRoute.current = { from, to, key }
    setDraft({ from, to })
    setInvalid(false)
    setSelected(null)
  }, [from, to, key])
  useEffect(() => {
    document.title = '내 자세 기록 · BODYGUARD'
    if (document.hasFocus()) heading.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    if (!authority || !range || !current.current) return
    const operation = current.current
    const live = () =>
      !operation.signal.aborted && current.current === operation && owner.current === authority
    let context: SummaryContext | null = null
    setView({ owner: authority, key, status: 'loading' })
    void (async () => {
      try {
        context = await prepareSummaries({
          authority,
          readAuthority: () => owner.current,
          signal: operation.signal,
        })
        const data = await context.list(range, page * 20, operation.signal)
        if (live()) setView({ owner: authority, key, status: 'ready', data, context, stale: false })
      } catch (error) {
        if (!live()) return
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          setView({ owner: authority, key, status: 'auth-error' })
          return
        }
        setView({ owner: authority, key, status: 'error' })
      }
    })()
    return () => {
      operation.abort()
      context?.close()
    }
  }, [authority, range, page, key])
  useEffect(() => {
    if (selected && document.hasFocus()) detail.current?.focus()
  }, [selected])
  const shown = view?.owner === authority && view.key === key ? view : null
  const ready = shown?.status === 'ready' ? shown : null
  const picked =
    ready && !ready.stale ? ready.data.items.find((item) => item.minute_start === selected) : null
  useEffect(() => {
    if (range && shown && shown.status !== 'loading' && focusResults.current) {
      focusResults.current = false
      if (document.hasFocus()) resultsHeading.current?.focus()
    }
  }, [range, shown])
  function reload() {
    setRevision((value) => value + 1)
  }
  function blockAuthority() {
    if (authority) {
      current.current?.abort()
      setView({ owner: authority, key, status: 'auth-error' })
    }
  }
  function changePage(value: number) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('page', String(value))
      return next
    })
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      dateRange(draft.from, draft.to, new Date())
    } catch {
      setInvalid(true)
      document.getElementById('summary-from')?.focus()
      return
    }
    setInvalid(false)
    setParams({ from: draft.from, to: draft.to })
    reload()
  }
  if (!authority) return null
  return (
    <section className="records-screen minute-screen">
      <p className="eyebrow">MY POSTURE RECORDS</p>
      <h1 tabIndex={-1} ref={heading}>
        내 자세 기록
      </h1>
      <p className="records-intro">저장된 자세 기록을 1분 단위로 확인합니다.</p>
      <p className="records-explanation muted">
        부위별 측정 시간과 평균 편차를 함께 살펴보세요. 기록된 값은 질환 진단이나 올바른 자세의
        인증이 아닙니다. 자세 측정 연결은 준비 중이며, 저장된 기록이 없다면 빈 목록으로 표시됩니다.
      </p>
      <form className="records-filter" onSubmit={submit} noValidate aria-label="자세 기록 기간">
        <label htmlFor="summary-from">
          시작 날짜
          <input
            id="summary-from"
            type="date"
            value={draft.from}
            disabled={busy}
            aria-invalid={invalid || !range}
            aria-describedby={invalid || !range ? 'summary-period-error' : undefined}
            onChange={(event) => {
              const value = event.target.value
              setDraft((previous) => ({ ...previous, from: value }))
            }}
          />
        </label>
        <label htmlFor="summary-to">
          종료 날짜
          <input
            id="summary-to"
            type="date"
            value={draft.to}
            disabled={busy}
            aria-invalid={invalid || !range}
            aria-describedby={invalid || !range ? 'summary-period-error' : undefined}
            onChange={(event) => {
              const value = event.target.value
              setDraft((previous) => ({ ...previous, to: value }))
            }}
          />
        </label>
        <button className="button primary" type="submit" disabled={busy}>
          기간 조회
        </button>
        {(invalid || !range) && (
          <p className="form-error" id="summary-period-error" role="alert">
            시작 날짜부터 오늘까지의 올바른 기간을 선택하세요. 페이지 주소가 잘못되었다면 기간
            조회로 다시 시작할 수 있습니다.
          </p>
        )}
      </form>
      {range && (
        <section
          className="records-results"
          aria-labelledby="summary-results-heading"
          aria-busy={!shown || shown.status === 'loading'}
        >
          <h2 id="summary-results-heading" tabIndex={-1} ref={resultsHeading}>
            {from} ~ {to} · 자세 기록
          </h2>
          {(!shown || shown.status === 'loading') && (
            <div className="records-state" role="status">
              <p>자세 기록을 조회하고 있습니다.</p>
            </div>
          )}
          {shown?.status === 'error' && (
            <div className="records-state">
              <p role="alert">자세 기록을 조회하지 못했습니다. 연결을 확인하고 다시 조회하세요.</p>
              <button className="button secondary" type="button" onClick={reload}>
                다시 조회
              </button>
            </div>
          )}
          {shown?.status === 'auth-error' && (
            <div className="records-state">
              <p role="alert">
                로그인 상태를 다시 확인해야 합니다. 이전 기록과 삭제 확인은 닫았습니다.
              </p>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  void refresh()
                }}
              >
                계정 다시 확인
              </button>
            </div>
          )}
          {ready && !ready.stale && (
            <>
              {!ready.data.items.length ? (
                <div className="records-state">
                  <h3>
                    {page === 0
                      ? '이 기간에는 자세 기록이 없습니다'
                      : '이 페이지에는 자세 기록이 없습니다'}
                  </h3>
                  <p className="muted">
                    {page === 0
                      ? '날짜 범위를 바꾸어 조회할 수 있습니다. 실제 기록이 저장된 뒤 이곳에서 확인할 수 있습니다.'
                      : '이전 기록으로 돌아가거나 기간을 다시 조회해 확인하세요.'}
                  </p>
                </div>
              ) : (
                <>
                  <p className="minute-list-note muted">
                    현재 페이지 {ready.data.items.length}건 · 평균 편차는 기록된 단위로 표시합니다.
                  </p>
                  <p className="muted minute-list-note">
                    목록은 조회 시점마다 달라질 수 있습니다. 기록이 추가·삭제됐다면 기간을 다시
                    조회해 확인하세요.
                  </p>
                  <section
                    className="records-table-scroll"
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the overflowing table.
                    tabIndex={0}
                    aria-label="분별 자세 기록 표"
                  >
                    <table>
                      <caption className="sr-only">분별 평균 편차와 전체 측정 시간</caption>
                      <thead>
                        <tr>
                          <th scope="col">기록 시각</th>
                          <th scope="col">목 평균 편차</th>
                          <th scope="col">어깨 평균 편차</th>
                          <th scope="col">몸통 평균 편차</th>
                          <th scope="col">측정 시간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ready.data.items.map((item) => (
                          <tr key={item.minute_start}>
                            <th scope="row">
                              <button
                                className="minute-detail-button"
                                type="button"
                                aria-pressed={selected === item.minute_start}
                                onClick={() => setSelected(item.minute_start)}
                              >
                                {date.format(new Date(item.minute_start))}
                              </button>
                            </th>
                            <td>{mean(item.neck)}</td>
                            <td>{mean(item.shoulder)}</td>
                            <td>{mean(item.trunk)}</td>
                            <td>{time(item.measured_sec)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
              <div className="records-pagination">
                <button
                  className="button secondary"
                  type="button"
                  disabled={page === 0 || busy}
                  onClick={() => changePage(page - 1)}
                >
                  이전 기록
                </button>
                <span>{page + 1}페이지</span>
                <button
                  className="button secondary"
                  type="button"
                  disabled={!ready.data.has_more || page === 500 || busy}
                  onClick={() => changePage(page + 1)}
                >
                  다음 기록
                </button>
              </div>
              {page === 500 && ready.data.has_more && (
                <p className="records-explanation" role="status">
                  한 번에 조회할 수 있는 범위의 끝입니다. 날짜 범위를 좁혀 남은 기록을 확인하세요.
                </p>
              )}
              {picked && <MinuteDetail item={picked} heading={detail} />}
            </>
          )}
          {ready?.stale && (
            <p className="records-state" role="status">
              기록 목록을 다시 조회해 최신 상태를 확인하세요.
            </p>
          )}
          {ready && !invalid && draft.from === from && draft.to === to && (
            <MinuteSummaryDeletion
              key={key}
              context={ready.context}
              range={range as DeletePeriod}
              onAuthFailure={blockAuthority}
              onStale={() => {
                setSelected(null)
                setView({ ...ready, stale: true })
              }}
              onReload={reload}
              onBusy={setBusy}
            />
          )}
          {ready && (invalid || draft.from !== from || draft.to !== to) && (
            <p className="records-explanation muted">
              선택한 날짜로 기간을 조회한 뒤 삭제 대상을 확인할 수 있습니다.
            </p>
          )}
        </section>
      )}
      <div className="records-back">
        <Link className="back-link" to="/records">
          수행 기록 보기
        </Link>
        <Link className="back-link" to="/account">
          내 계정으로
        </Link>
      </div>
    </section>
  )
}

function MinuteDetail({
  item,
  heading,
}: {
  item: MinuteOut
  heading: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="record-detail minute-detail" aria-labelledby="minute-detail-heading">
      <p className="eyebrow">MINUTE DETAIL</p>
      <h2 id="minute-detail-heading" tabIndex={-1} ref={heading}>
        {date.format(new Date(item.minute_start))} 상세
      </h2>
      <p className="muted">
        평균 편차와 이탈 비율의 기준 시간은 각 부위의 측정 시간입니다. ‘—’는 측정값이 없는 경우이며
        0점이나 정상 판정을 뜻하지 않습니다. 표시는 소수 둘째 자리까지 반올림합니다.
      </p>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Focus provides keyboard access to horizontal table scrolling, not a simulated button. */}
      <section className="records-table-scroll" tabIndex={0} aria-label="선택한 분의 부위별 지표">
        <table>
          <caption className="sr-only">선택한 분의 부위별 측정 지표</caption>
          <thead>
            <tr>
              <th scope="col">부위</th>
              <th scope="col">평균 편차</th>
              <th scope="col">측정 시간</th>
              <th scope="col">기록된 이탈</th>
              <th scope="col">이탈 비율</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(names).map(([key, label]) => {
              const part = item[key as keyof typeof names]
              return (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{mean(part)}</td>
                  <td>{time(part.measured_sec)}</td>
                  <td>{time(part.bad_sec)}</td>
                  <td>{ratio(part)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <dl>
        {[
          ['집계 시간', item.coverage_sec],
          ['전체 측정 시간', item.measured_sec],
          ['집계 내 관찰 시간', item.present_sec],
          ['측정값 없는 시간', item.unmeasurable_sec],
          ['백그라운드 시간', item.background_sec],
          ['하나 이상 이탈 시간', item.any_bad_sec],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{time(value as number)}</dd>
          </div>
        ))}
        <div>
          <dt>개인 기준</dt>
          <dd>{item.baseline_id ? '개인 기준선 사용' : '보정 전'}</dd>
        </div>
        <div>
          <dt>기록 버전</dt>
          <dd>{item.client_version}</dd>
        </div>
        {Object.entries(names).map(([key, label]) => (
          <div key={key}>
            <dt>{label} 측정 방식</dt>
            <dd>
              {item[key as keyof typeof names].method} · {item[key as keyof typeof names].unit}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
