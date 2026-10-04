// FR-S-06/FR-U-04: protected entry paths; no unvalidated coaching or camera access.
import { useState } from 'react'
import { Link } from 'react-router'
import { recommendationReadiness, releasedMotionIds } from '../catalog/recommendation'
import './ExplorePage.css'

export function ExplorePage() {
  const [mode, setMode] = useState<'select' | 'recommend'>('select')
  const [purpose, setPurpose] = useState<'neck' | 'shoulder' | 'torso' | null>(null)
  const readiness = recommendationReadiness({ purpose, bodyCheck: 'not-started' })
  return (
    <section className="start-screen explore-screen">
      <p className="eyebrow">STRETCHING</p>
      <h1 tabIndex={-1}>스트레칭 시작 경로</h1>
      <p className="muted">
        직접 선택과 신체 확인에 따른 추천, 두 가지 시작 경로를 준비하고 있습니다.
      </p>
      <fieldset>
        <legend>시작 경로</legend>
        <button
          type="button"
          className="button secondary"
          aria-pressed={mode === 'select'}
          onClick={() => setMode('select')}
        >
          직접 고르기
        </button>
        <button
          type="button"
          className="button secondary"
          aria-pressed={mode === 'recommend'}
          onClick={() => setMode('recommend')}
        >
          추천받기
        </button>
      </fieldset>
      {mode === 'select' ? (
        <div className="development-note">
          <h2>동작 목록</h2>
          {releasedMotionIds.length === 0 && (
            <p role="status">
              현재 이용 가능한 동작이 없습니다. 수행 안내와 코칭 검증을 마친 동작부터 제공할
              예정입니다.
            </p>
          )}
        </div>
      ) : (
        <div className="development-note">
          <h2>어느 부위를 스트레칭하고 싶으신가요?</h2>
          <fieldset>
            <legend>스트레칭 목적</legend>
            {(
              [
                ['neck', '목'],
                ['shoulder', '어깨'],
                ['torso', '몸통'],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="purpose"
                  value={value}
                  checked={purpose === value}
                  onChange={() => setPurpose(value)}
                />{' '}
                {label}
              </label>
            ))}
          </fieldset>
          <p role="status">{readiness.message}</p>
          <p className="small muted">
            신체 확인과 맞춤 추천은 준비 중입니다. 카메라는 켜지지 않습니다.
          </p>
          <button type="button" className="button secondary" onClick={() => setMode('select')}>
            직접 선택으로 이동
          </button>
        </div>
      )}
      <Link className="back-link" to="/start">
        내 시작으로 돌아가기
      </Link>
    </section>
  )
}
