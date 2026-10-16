// FR-S-01/06, FR-V-02/03: protected development preview; selection never starts coaching.
import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motionPreviewMedia } from '../catalog/motionMedia'
import { motionNavigationUrl } from '../catalog/motionNavigation'
import { findMotions, motionById, parseRegion, type Region } from '../catalog/motions'
import { MotionPreview } from './MotionPreview'
import './CoachingPage.css'
import './MotionSelectionPage.css'

const regions: readonly [Region, string][] = [
  ['all', '전체'],
  ['neck', '목'],
  ['shoulder', '어깨'],
  ['torso', '상체'],
]

export function MotionSelectionPage() {
  const [params, setParams] = useSearchParams()
  const heading = useRef<HTMLHeadingElement>(null)
  const selectedId = params.get('motion')
  const query = (params.get('search') ?? '').slice(0, 120)
  const region = parseRegion(params.get('region'))
  const selected = selectedId === null ? undefined : motionById(selectedId)
  const motions = findMotions(query, region)
  const pageTitle = selectedId === null ? '동작 선택' : (selected?.title ?? '없는 동작')

  useEffect(() => {
    // NFR-08: detail/Back transitions get focus, search typing never steals focus.
    document.title = `${pageTitle} · BODYGUARD`
    heading.current?.focus({ preventScroll: true })
  }, [pageTitle])

  function update(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, { replace: true })
  }
  function urlFor(id?: string) {
    const next = new URLSearchParams(params)
    next.delete('motion')
    if (id) next.set('motion', id)
    const search = next.toString()
    return search ? `/dev/select?${search}` : '/dev/select'
  }

  return (
    <section className="motion-selection" aria-labelledby="motion-heading">
      <p className="eyebrow">동작 선택 · 개발 검수</p>
      <p className="motion-preview-note">
        출시 전 검수 화면입니다. 동작과 아바타 검증이 끝나기 전에는 코칭을 시작하지 않습니다.
      </p>
      <Link className="back-link" to={motionNavigationUrl('/dev/coaching', params, selected?.id)}>
        코칭 화면 구조 보기
      </Link>
      {selectedId !== null ? (
        selected ? (
          <>
            <Link className="back-link" to={urlFor()}>
              목록으로 돌아가기
            </Link>
            <div className="motion-detail-layout">
              <div>
                <p className="motion-region">{selected.regionLabel} · 스트레칭 안내</p>
                <h1 id="motion-heading" ref={heading} tabIndex={-1}>
                  {selected.title}
                </h1>
                <p className="motion-description">{selected.summary}</p>
                <p className="small muted">
                  {selected.reviewMode === 'guidance-candidate'
                    ? '안내만 후보 · 자동 판정 없음'
                    : '실시간 코칭 후보 · 촬영 검증 전'}
                </p>
                <section className="motion-steps" aria-labelledby="steps-heading">
                  <h2 id="steps-heading">수행 과정</h2>
                  <ol>
                    {selected.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>
                <details className="motion-sources">
                  <summary>참고 자료</summary>
                  <p className="small muted">
                    수행 안내의 참고 자료이며, 코칭 정확도나 효과를 보장하는 자료가 아닙니다.
                  </p>
                  <ul>
                    {selected.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.title} · 원문
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
              <aside className="motion-preparation" aria-labelledby="prep-heading">
                <h2 id="prep-heading">시작 전 확인</h2>
                <p>{selected.framing}</p>
                <p>{selected.observationLimit}</p>
                <h3>편안한 범위에서 움직이세요</h3>
                <ul>
                  {selected.cautions.map((caution) => (
                    <li key={caution}>{caution}</li>
                  ))}
                </ul>
                <button
                  className="button primary wide"
                  type="button"
                  disabled
                  aria-describedby="coaching-pending"
                >
                  코칭 준비 중
                </button>
                <p id="coaching-pending" className="small muted">
                  동작·아바타 검증을 준비하고 있습니다. 카메라는 켜지지 않았습니다.
                </p>
              </aside>
            </div>
          </>
        ) : (
          <div className="status-screen">
            <h1 id="motion-heading" ref={heading} tabIndex={-1}>
              동작을 찾을 수 없습니다
            </h1>
            <p>목록에서 동작을 다시 선택해 주세요.</p>
            <Link className="button secondary" to={urlFor()}>
              목록으로 돌아가기
            </Link>
          </div>
        )
      ) : (
        <>
          <h1 id="motion-heading" ref={heading} tabIndex={-1}>
            원하는 동작을 골라보세요
          </h1>
          <p className="motion-description">수행 과정과 시작 전 주의점을 먼저 확인하세요.</p>
          <div className="motion-controls">
            <label htmlFor="motion-search">동작 검색</label>
            <input
              id="motion-search"
              type="search"
              maxLength={120}
              value={query}
              placeholder="동작 이름 또는 부위"
              onChange={(event) => update('search', event.target.value)}
            />
            <fieldset className="motion-filters">
              <legend className="small">부위 필터</legend>
              {regions.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="button secondary"
                  aria-pressed={region === value}
                  onClick={() => update('region', value === 'all' ? '' : value)}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          </div>
          <p className="small muted" role="status">
            안내 {motions.length}개
          </p>
          {motions.length ? (
            <ul className="motion-list">
              {motions.map((motion) => (
                <li key={motion.id}>
                  <MotionPreview title={motion.title} media={motionPreviewMedia(motion.id)} />
                  <div>
                    <p className="motion-region">{motion.regionLabel}</p>
                    <h2>{motion.title}</h2>
                    <p>{motion.summary}</p>
                  </div>
                  <Link
                    className="button secondary"
                    aria-label={`${motion.title} 안내 보기`}
                    to={urlFor(motion.id)}
                  >
                    안내 보기
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="motion-empty">
              <h2>조건에 맞는 동작이 없습니다</h2>
              <p>다른 검색어를 입력하거나 필터를 초기화해 주세요.</p>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setParams({}, { replace: true })
                  document.getElementById('motion-search')?.focus()
                }}
              >
                검색과 필터 초기화
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
