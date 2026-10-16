// FR-S-06/FR-U-04: existing recommendation pane, camera-match candidates NOT personal treatment.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth'
import type {
  RecommendationPurpose,
  CameraRecommendations as Snapshot,
} from '../catalog/cameraRecommendations'
import { motionPreviewMedia } from '../catalog/motionMedia'
import { motionById } from '../catalog/motions'
import { CameraPreparation } from './CameraPreparation'
import { MotionPreview } from './MotionPreview'
import './MotionSelectionPage.css'
import './CameraRecommendations.css'

const labels = { neck: '목', shoulder: '어깨', torso: '몸통' } as const
export function CameraRecommendations({ purpose }: { purpose: RecommendationPurpose }) {
  const auth = useAuth().state,
    [result, setResult] = useState<Readonly<{ value: Snapshot; owner: typeof auth }> | null>(null),
    [gender, setGender] = useState<'male' | 'female'>('male'),
    heading = useRef<HTMLHeadingElement>(null)
  const snapshot = result?.owner === auth && result.value.purpose === purpose ? result.value : null
  const onResult = useCallback(
      (value: Snapshot | null) =>
        setResult(auth.status === 'ready' && value ? { value, owner: auth } : null),
      [auth],
    ),
    recommendation = useMemo(() => ({ purpose, onResult }), [purpose, onResult])
  useLayoutEffect(() => {
    const clear = () => setResult(null),
      hidden = () => {
        if (document.visibilityState === 'hidden') clear()
      }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', clear)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', clear)
    }
  }, [])
  useLayoutEffect(() => {
    if (snapshot) heading.current?.focus({ preventScroll: true })
  }, [snapshot])
  if (!import.meta.env.DEV) return null
  const matches =
    snapshot?.purpose === purpose &&
    snapshot.scope === 'camera-match-candidate-only' &&
    snapshot.status === 'ready'
      ? snapshot.motionIds.map(motionById).filter((m) => m !== undefined)
      : []
  const direct = `/dev/select?region=${purpose}`
  return (
    <section className="camera-recommendations" aria-label="촬영 조건 기반 동작 후보">
      <p className="small muted">개발 검수 · 개인별 교정 필요성을 판단하는 추천은 아닙니다.</p>
      {purpose === 'torso' ? (
        <p role="status">
          몸통의 실시간 코칭 후보는 검증 중입니다. 직접 선택에서 수행 안내를 확인할 수 있습니다.
        </p>
      ) : snapshot ? (
        <button className="button secondary" type="button" onClick={() => setResult(null)}>
          촬영 다시 확인
        </button>
      ) : (
        <CameraPreparation recommendation={recommendation} />
      )}
      {matches.length > 0 && (
        <section aria-labelledby="recommendation-heading">
          <h3 id="recommendation-heading" tabIndex={-1} ref={heading}>
            촬영 조건이 맞는 후보
          </h3>
          <p className="small muted">
            {labels[purpose]} 선택과 방금 확인한 촬영 범위가 기준입니다. 코칭 시작 시 다시
            확인합니다.
          </p>
          <label>
            미리보기 형태{' '}
            <select
              aria-label="후보 미리보기 형태"
              value={gender}
              onChange={(e) => setGender(e.target.value as 'male' | 'female')}
            >
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </label>
          <ul className="motion-list">
            {matches.map((m) => (
              <li key={m.id}>
                <MotionPreview title={m.title} media={motionPreviewMedia(m.id, gender)} />
                <div>
                  <p className="motion-region">{m.regionLabel} · 촬영 검증 전</p>
                  <h4>{m.title}</h4>
                  <p>{m.summary}</p>
                </div>
                <Link
                  className="button secondary"
                  aria-label={`${m.title} 안내 보기`}
                  to={`${direct}&motion=${m.id}`}
                >
                  안내 보기
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link className="back-link" to={direct}>
        직접 선택에서 모두 보기
      </Link>
    </section>
  )
}
