// FR-V-01/03·FR-S-06·FR-A-01/02: approved layout, private until actual motion/asset gates.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motionNavigationUrl } from '../catalog/motionNavigation'
import { findMotions, motionById, type Region } from '../catalog/motions'
import { CameraPreparation } from './CameraPreparation'
import { MotionPreview } from './MotionPreview'
import './CoachingPage.css'

type View = 'full' | 'upper' | 'detail'
const views = [
  ['upper', '상반신'],
  ['full', '전신'],
  ['detail', '자세히'],
] as const
const regions = [
  ['all', '전체'],
  ['neck', '목'],
  ['shoulder', '어깨'],
  ['torso', '상체'],
] as const

export function CoachingPage() {
  const [params, setParams] = useSearchParams()
  const id = params.get('motion')
  const motion = id ? motionById(id) : undefined
  const [view, setView] = useState<View>('full')
  const [gender, setGender] = useState('male')
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<Region>('all')
  const picker = useRef<HTMLDialogElement>(null)
  const settings = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const motions = findMotions(query, region)
  const title =
    id !== null && !motion ? '동작을 찾을 수 없습니다' : (motion?.title ?? '스트레칭 코칭')
  useEffect(() => {
    document.title = `${title} · BODYGUARD`
    heading.current?.focus({ preventScroll: true })
  }, [title])
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) {
        picker.current?.close()
        settings.current?.close()
      }
    }
    document.addEventListener('visibilitychange', hidden)
    return () => document.removeEventListener('visibilitychange', hidden)
  }, [])

  return (
    <section className="coaching-workspace" aria-labelledby="coaching-heading">
      <nav className="coaching-rail" aria-label="코칭 메뉴">
        <Link to="/start">내 시작</Link>
        <button type="button" onClick={() => picker.current?.showModal()}>
          동작
        </button>
        <Link to="/records">기록</Link>
        <button type="button" onClick={() => settings.current?.showModal()}>
          설정
        </button>
      </nav>
      <div className="coaching-work-area">
        <header className="coaching-heading">
          <div>
            <p className="small muted">화면 구조 검수 · 코칭 연결 전</p>
            <h1 id="coaching-heading" ref={heading} tabIndex={-1}>
              {title}
            </h1>
          </div>
          <div className="coaching-tools">
            <fieldset className="coaching-segmented">
              <legend className="sr-only">두 아바타 표시 구도</legend>
              {views.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  {label}
                </button>
              ))}
            </fieldset>
            <button
              className="button secondary"
              type="button"
              onClick={() => picker.current?.showModal()}
            >
              동작 변경
            </button>
          </div>
        </header>
        <ol className="coaching-stages" aria-label="코칭 순서">
          <li>준비</li>
          <li>수행</li>
          <li>유지</li>
          <li>복귀</li>
        </ol>
        <section
          className="coaching-space"
          aria-label="두 아바타 공간"
          data-view={view}
          data-avatar={gender}
        >
          <div className="coaching-role-labels">
            <span>내 움직임</span>
            <span>현재 단계 시범</span>
          </div>
          <div className="coaching-scene-pending" role="status">
            <span className="coaching-connection-dot" aria-hidden="true" />
            <p>아바타 연결 대기</p>
            <p className="small muted">최종 아바타·동작 검증 후 연결됩니다</p>
          </div>
        </section>
        <div className="coaching-footer">
          <CameraPreparation />
          <div className="coaching-actions">
            <button className="button primary" type="button" disabled>
              코칭 준비 중
            </button>
            <button className="button secondary" type="button" disabled>
              전체 시범
            </button>
            <Link className="button secondary" to={motionNavigationUrl('/dev/select', params)}>
              나가기
            </Link>
          </div>
          {motion && (
            <details className="coaching-instructions">
              <summary>수행 안내</summary>
              <p>{motion.framing}</p>
              <ol>
                {motion.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p>{motion.cautions[0]}</p>
              <Link
                className="back-link"
                to={motionNavigationUrl('/dev/select', params, motion.id)}
              >
                주의점·참고 자료
              </Link>
            </details>
          )}
          <p className="small muted">코칭·판정·저장 꺼짐 · 의학적 진단이 아닌 스트레칭 코칭</p>
        </div>
      </div>
      <dialog ref={picker} className="coaching-dialog" aria-labelledby="coaching-picker-title">
        <header>
          <h2 id="coaching-picker-title">동작 고르기</h2>
          <button
            className="button secondary"
            type="button"
            onClick={() => picker.current?.close()}
            aria-label="동작 고르기 닫기"
          >
            닫기
          </button>
        </header>
        <p className="small muted">검수 후보 · 출시 동작 아님</p>
        <label className="coaching-search">
          동작 검색
          <input
            type="search"
            value={query}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="동작 또는 부위"
          />
        </label>
        <fieldset className="coaching-filters">
          <legend className="sr-only">부위 필터</legend>
          {regions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="button secondary"
              aria-pressed={region === value}
              onClick={() => setRegion(value)}
            >
              {label}
            </button>
          ))}
        </fieldset>
        {motions.length ? (
          <ul className="coaching-motion-grid">
            {motions.map((item) => (
              <li key={item.id}>
                <MotionPreview title={item.title} />
                <button
                  type="button"
                  className="coaching-motion-select"
                  aria-label={`${item.title} 화면에서 보기`}
                  onClick={() => {
                    picker.current?.close()
                    setParams((current) => {
                      const next = new URLSearchParams(current)
                      next.set('motion', item.id)
                      return next
                    })
                  }}
                >
                  <span className="small muted">{item.regionLabel}</span>
                  <strong>{item.title}</strong>
                  <span aria-hidden="true">↗</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="coaching-empty" role="status">
            <p>조건에 맞는 동작이 없습니다</p>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setQuery('')
                setRegion('all')
              }}
            >
              검색과 필터 초기화
            </button>
          </div>
        )}
      </dialog>
      <dialog
        ref={settings}
        className="coaching-dialog coaching-settings"
        aria-labelledby="coaching-settings-title"
      >
        <header>
          <h2 id="coaching-settings-title">화면 설정</h2>
          <button
            className="button secondary"
            type="button"
            onClick={() => settings.current?.close()}
            aria-label="화면 설정 닫기"
          >
            닫기
          </button>
        </header>
        <label>
          표시 구도
          <select value={view} onChange={(event) => setView(event.target.value as View)}>
            {views.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          아바타 형태
          <select value={gender} onChange={(event) => setGender(event.target.value)}>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </label>
        <p className="small muted">
          화면 설정만 변경합니다. 촬영 범위·판정 기준은 바뀌지 않습니다.
        </p>
      </dialog>
    </section>
  )
}
