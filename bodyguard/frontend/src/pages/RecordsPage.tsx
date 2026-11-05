// FR-R-03/FR-U-04/NFR-08: private record journeys; no fake exercise result producer.
import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../api/auth'
import type { StretchList, StretchOut } from '../api/generated'
import {
  dateRange,
  defaultPeriod,
  listRecords,
  localDay,
  readRecord,
  validDay,
} from '../api/records'
import analysisIcon from '../assets/figma-home/7cba9.svg'
import recordsIcon from '../assets/figma-home/38cc0.svg'
import changesIcon from '../assets/figma-home/b943c.svg'
import favoritesIcon from '../assets/figma-home/ec753.svg'
import routineIcon from '../assets/figma-home/f2c6a.svg'
import { type ReadyAccount, useAuth } from '../auth'
import { RecordDeletion } from './RecordDeletion'
import './RecordsPage.css'

const outcomes = { completed: '완료', interrupted: '중단', skipped: '건너뜀' }
const dateTime = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
function time(value: string) {
  return dateTime.format(new Date(value))
}
function duration(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return seconds >= 60 ? `${Math.floor(seconds / 60)}분 ${seconds % 60}초` : `${seconds}초`
}

// FR-R-03: calendar dates are local; a noon anchor avoids midnight DST transitions.
function shiftDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return localDay(date)
}
function rangeForView(from: string, to: string) {
  return validDay(from) && validDay(to) && (from === to || from === shiftDay(to, -6))
}
type Result = {
  key: string
  owner: ReadyAccount | null
} & (
  | { status: 'loading' }
  | { status: 'error' | 'missing' | 'auth-error' }
  | { status: 'list'; value: StretchList }
  | { status: 'detail'; value: StretchOut }
)

export function RecordsPage() {
  const { recordId: id } = useParams()
  const [params, setParams] = useSearchParams()
  const [initial] = useState(() => defaultPeriod())
  const from = params.get('from') ?? initial.from
  const to = params.get('to') ?? initial.to
  const [draft, setDraft] = useState({ from, to })
  const view = !rangeForView(from, to) ? 'custom' : from === to ? 'day' : 'week'
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [selectionRevision, setSelectionRevision] = useState(0)
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<Result>({ key: '', owner: null, status: 'loading' })
  const heading = useRef<HTMLHeadingElement>(null)
  const resultsHeading = useRef<HTMLHeadingElement>(null)
  const focusResults = useRef(false)
  const { state: auth, refresh } = useAuth()
  const authority = auth.status === 'ready' ? auth : null
  const [blocked, setBlocked] = useState<ReadyAccount | null>(null)
  const owner = useRef<ReadyAccount | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  useLayoutEffect(() => {
    owner.current = authority
    return () => {
      owner.current = null
      activeRequest.current?.abort()
    }
  }, [authority])
  const binding = useMemo(
    () => (authority ? { authority, readAuthority: () => owner.current } : null),
    [authority],
  )
  // A fresh lookup fixes its end cutoff; later page requests reuse that cutoff.
  const [cutoff, setCutoff] = useState(() => new Date())
  const range = useMemo(() => {
    try {
      return dateRange(from, to, cutoff)
    } catch {
      return null
    }
  }, [from, to, cutoff])
  const key = `${id ?? ''}|${from}|${to}|${page}|${revision}`
  const current =
    authority && blocked === authority
      ? { status: 'auth-error' as const }
      : result.key === key && result.owner === authority
        ? result
        : { status: 'loading' as const }
  const summary =
    current.status !== 'list'
      ? null
      : current.value.total_count != null && current.value.total_observed_ms != null
        ? { count: current.value.total_count, observed: current.value.total_observed_ms }
        : page === 0 && !current.value.has_more
          ? {
              count: current.value.items.length,
              observed: current.value.items.reduce((sum, item) => sum + item.observed_ms, 0),
            }
          : null
  const listQuery = new URLSearchParams({ from, to }).toString()
  const days = range ? Array.from({ length: 7 }, (_, index) => shiftDay(to, index - 6)) : []

  useEffect(() => {
    // NFR-08: keyboard paging must not lose focus when the old table is removed.
    if (current.status !== 'loading' && focusResults.current) {
      resultsHeading.current?.focus({ preventScroll: true })
      focusResults.current = false
    }
  }, [current.status])

  useEffect(() => {
    setDraft({ from, to })
  }, [from, to])
  useEffect(() => {
    document.title = `${id ? '수행 기록 상세' : '내 수행 기록'} · BODYGUARD`
    heading.current?.focus({ preventScroll: true })
  }, [id])
  useEffect(() => {
    if (!range || !binding || blocked === binding.authority) return
    const controller = new AbortController()
    activeRequest.current = controller
    const captured = binding.authority
    setResult({ key, owner: captured, status: 'loading' })
    const request = id
      ? readRecord(id, controller.signal, binding)
      : listRecords(range, page * 20, controller.signal, binding)
    void request.then(
      (value) => {
        if (controller.signal.aborted || owner.current !== captured) return
        if ('items' in value) setResult({ key, owner: captured, status: 'list', value })
        else setResult({ key, owner: captured, status: 'detail', value })
      },
      (error: unknown) => {
        if (controller.signal.aborted || owner.current !== captured) return
        if (error instanceof ApiError && error.status === 401) {
          void refresh()
          return
        }
        if (error instanceof ApiError && error.status === 403) {
          focusResults.current = true
          setBlocked(captured)
        }
        setResult({
          key,
          owner: captured,
          status:
            error instanceof ApiError && error.status === 403
              ? 'auth-error'
              : error instanceof ApiError && error.status === 404
                ? 'missing'
                : 'error',
        })
      },
    )
    return () => {
      controller.abort()
      if (activeRequest.current === controller) activeRequest.current = null
    }
  }, [id, range, page, key, refresh, binding, blocked])

  function selectRange(nextFrom: string, nextTo: string) {
    try {
      dateRange(nextFrom, nextTo, new Date())
    } catch {
      setFormError('오늘까지의 날짜로 시작일·종료일 순서를 확인해 주세요.')
      return
    }
    setFormError('')
    setSelectionRevision((value) => value + 1)
    focusResults.current = true
    setPage(0)
    setCutoff(new Date())
    setRevision((value) => value + 1)
    setParams({ from: nextFrom, to: nextTo })
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    selectRange(draft.from, draft.to)
  }
  return (
    <div className="figma-records-layout">
      <aside className="figma-records-menu" aria-label="서비스 메뉴">
        <button type="button" disabled>
          <img src={analysisIcon} alt="" />
          AI 신체 분석 <small>준비 중</small>
        </button>
        <button type="button" disabled>
          <img src={routineIcon} alt="" />
          맞춤 루틴 <small>준비 중</small>
        </button>
        <Link to="/records" aria-current="page">
          <img src={recordsIcon} alt="" />
          스트레칭 기록
        </Link>
        <button type="button" disabled>
          <img src={changesIcon} alt="" />
          변화 보기 <small>준비 중</small>
        </button>
        <button type="button" disabled>
          <img src={favoritesIcon} alt="" />
          즐겨찾기 <small>준비 중</small>
        </button>
        <Link className="figma-records-home" to="/start">
          홈으로
        </Link>
      </aside>
      <section className="records-screen">
        <p className="eyebrow">MY BODYGUARD / RECORDS</p>
        <h1 ref={heading} tabIndex={-1}>
          {id ? '수행 기록 상세' : '스트레칭 기록'}
        </h1>
        <p className="small muted records-explanation">
          ‘완료’는 수행 종료입니다. 자세 정확성·효과를 보장하지 않습니다.
        </p>
        {!id && (
          <div className="figma-records-calendar">
            <div className="figma-records-period">
              <p>
                {range
                  ? new Intl.DateTimeFormat('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date(`${to}T12:00:00`))
                  : to}
              </p>
              <fieldset aria-label="조회 단위">
                <button
                  type="button"
                  aria-pressed={view === 'day'}
                  onClick={() => selectRange(to, to)}
                >
                  일간
                </button>
                <button
                  type="button"
                  aria-pressed={view === 'week'}
                  onClick={() => selectRange(shiftDay(to, -6), to)}
                >
                  주간
                </button>
              </fieldset>
            </div>
            <fieldset className="figma-records-days" aria-label="날짜 선택">
              {days.map((day) => (
                <button
                  type="button"
                  key={day}
                  aria-pressed={day === to}
                  aria-label={`${day} 선택`}
                  onClick={() => selectRange(view === 'day' ? day : shiftDay(day, -6), day)}
                >
                  {new Intl.DateTimeFormat('ko-KR', { weekday: 'short', day: 'numeric' }).format(
                    new Date(`${day}T12:00:00`),
                  )}
                </button>
              ))}
            </fieldset>
          </div>
        )}
        {!id && (
          <details className="records-custom-period">
            <summary>기간 직접 선택</summary>
            <form className="records-filter" onSubmit={apply}>
              <label htmlFor="record-from">
                시작일
                <input
                  id="record-from"
                  type="date"
                  required
                  max={localDay(new Date())}
                  value={draft.from}
                  onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                />
              </label>
              <label htmlFor="record-to">
                종료일
                <input
                  id="record-to"
                  type="date"
                  required
                  max={localDay(new Date())}
                  value={draft.to}
                  onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                />
              </label>
              <button type="submit" className="button primary">
                기간 조회
              </button>
              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
            </form>
          </details>
        )}
        {!range ? (
          <div className="records-state">
            <h2>조회 기간을 확인해 주세요</h2>
            <p role="alert">오늘까지의 날짜에서 시작일과 종료일을 다시 선택해 주세요.</p>
            <Link className="button secondary" to="/records">
              최근 기록으로 돌아가기
            </Link>
          </div>
        ) : current.status === 'auth-error' ? (
          <div className="records-state">
            <h2 ref={resultsHeading} tabIndex={-1}>
              계정을 다시 확인해 주세요
            </h2>
            <p role="alert">기록 조회와 삭제를 중단했습니다.</p>
            <button type="button" className="button secondary" onClick={() => void refresh()}>
              계정 다시 확인
            </button>
          </div>
        ) : current.status === 'loading' ? (
          <div className="records-state" role="status">
            <p>기록을 불러오고 있습니다.</p>
          </div>
        ) : current.status === 'error' || current.status === 'missing' ? (
          <div className="records-state">
            <h2 ref={resultsHeading} tabIndex={-1}>
              {current.status === 'missing'
                ? '기록을 찾을 수 없습니다'
                : '기록을 불러오지 못했습니다'}
            </h2>
            <p role="alert">
              {current.status === 'missing'
                ? '목록에서 본인의 기록을 다시 선택해 주세요.'
                : '연결을 확인하고 다시 조회해 주세요.'}
            </p>
            {current.status === 'error' && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  focusResults.current = true
                  setCutoff(new Date())
                  setRevision((value) => value + 1)
                }}
              >
                다시 조회
              </button>
            )}
          </div>
        ) : current.status === 'list' ? (
          <div className="records-results">
            {summary && (
              <div className="figma-records-summary">
                <span>기록 {summary.count}건</span>
                <span>관찰 시간 {duration(summary.observed)}</span>
              </div>
            )}
            {!summary && page === 0 && current.value.has_more && (
              <p className="figma-records-summary">전체 기간 요약은 아직 제공되지 않습니다.</p>
            )}
            <h2 ref={resultsHeading} tabIndex={-1}>
              {from} — {to}
            </h2>
            <p className="small muted">종료 시각 기준 · 조회 시점까지 · 최신순</p>
            {current.value.items.length === 0 ? (
              <div className="records-state">
                <h3>
                  {page === 0
                    ? '이 기간에는 수행 기록이 없습니다'
                    : '이 페이지에는 기록이 없습니다'}
                </h3>
                <p role="status">기간을 바꾸거나 시작 경로를 확인하세요.</p>
                <Link className="button secondary" to="/explore">
                  스트레칭 시작 경로 선택
                </Link>
              </div>
            ) : (
              <div className="records-table-scroll">
                <table>
                  <caption className="sr-only">기간별 스트레칭 수행 기록</caption>
                  <thead>
                    <tr>
                      <th scope="col">종료 시각</th>
                      <th scope="col">동작 식별자</th>
                      <th scope="col">수행 상태</th>
                      <th scope="col">관찰 시간</th>
                      <th scope="col">반복</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.value.items.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <time dateTime={record.ended_at}>{time(record.ended_at)}</time>
                        </td>
                        <th scope="row">
                          <Link
                            to={`/records/${record.id}?${listQuery}`}
                            aria-label={`${record.motion_id} · ${time(record.ended_at)} 기록 상세`}
                          >
                            {record.motion_id}
                          </Link>
                        </th>
                        <td>
                          <span className="record-outcome">{outcomes[record.outcome]}</span>
                        </td>
                        <td>{duration(record.observed_ms)}</td>
                        <td>{record.repetitions}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(page > 0 || current.value.has_more) && (
              <nav className="records-pagination" aria-label="기록 페이지">
                <button
                  className="button secondary"
                  type="button"
                  disabled={page === 0}
                  onClick={() => {
                    focusResults.current = true
                    setPage((value) => value - 1)
                  }}
                >
                  이전 페이지
                </button>
                <p aria-live="polite">{page + 1}페이지</p>
                <button
                  className="button secondary"
                  type="button"
                  disabled={!current.value.has_more || page >= 500}
                  onClick={() => {
                    focusResults.current = true
                    setPage((value) => value + 1)
                  }}
                >
                  다음 페이지
                </button>
                {page >= 500 && current.value.has_more && (
                  <p>기간을 좁혀 나머지 기록을 조회해 주세요.</p>
                )}
              </nav>
            )}
          </div>
        ) : current.status === 'detail' ? (
          <div className="record-detail">
            <h2>{current.value.motion_id}</h2>
            <p className="record-outcome">{outcomes[current.value.outcome]}</p>
            <dl>
              <div>
                <dt>시작</dt>
                <dd>
                  <time dateTime={current.value.started_at}>{time(current.value.started_at)}</time>
                </dd>
              </div>
              <div>
                <dt>종료</dt>
                <dd>
                  <time dateTime={current.value.ended_at}>{time(current.value.ended_at)}</time>
                </dd>
              </div>
              <div>
                <dt>관찰된 수행 시간</dt>
                <dd>{duration(current.value.observed_ms)}</dd>
              </div>
              <div>
                <dt>반복 요약</dt>
                <dd>{current.value.repetitions}회</dd>
              </div>
              <div>
                <dt>규칙 버전</dt>
                <dd>{current.value.protocol_version}</dd>
              </div>
            </dl>
            <p className="small muted">수행 요약만 저장하며, 영상·관절 좌표는 저장하지 않습니다.</p>
          </div>
        ) : null}
        {!id && range && binding && current.status !== 'auth-error' && (
          <RecordDeletion
            key={`${from}|${to}|${selectionRevision}`}
            period={range}
            from={from}
            to={to}
            binding={binding}
            onAccountConflict={() => {
              activeRequest.current?.abort()
              focusResults.current = true
              setBlocked(authority)
              setResult({ key, owner: authority, status: 'auth-error' })
            }}
            onChanged={() => {
              focusResults.current = true
              setPage(0)
              setCutoff(new Date())
              setRevision((value) => value + 1)
            }}
          />
        )}
        <div className="records-back">
          {id && (
            <Link className="back-link" to={`/records?${listQuery}`}>
              기록 목록으로 돌아가기
            </Link>
          )}
          <Link className="back-link" to="/start">
            내 시작으로 돌아가기
          </Link>
        </div>
      </section>
    </div>
  )
}
