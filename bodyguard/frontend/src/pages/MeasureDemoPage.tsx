import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router'
import { drawSkeleton2D } from '../avatar/drawSkeleton2D'
import { Skeleton3D } from '../avatar/Skeleton3D'
import { StatsPanel } from '../components/StatsPanel'
import { type LatestPose, type MeasureError, useMeasurement } from '../pose/useMeasurement'
import {
  createFramingTrial,
  type ObserverFraming,
  readFramingSample,
  reduceFramingTrial,
  summarizeFramingTrials,
  TRIAL_SCENARIOS,
  type TrialScenario,
  type TrialSettings,
  trialProfileKey,
} from '../posture/framingTrial'

// prd §4 오류·예외 처리
const ERROR_TEXT: Record<MeasureError, string> = {
  denied:
    '카메라 권한이 거부됐어요. 주소창 왼쪽의 사이트 설정에서 카메라를 허용한 뒤 다시 눌러 주세요.',
  busy: '다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 눌러 주세요.',
  'not-found': '카메라를 찾지 못했어요.',
  unknown: '카메라를 켜지 못했어요. 페이지를 새로고침한 뒤 다시 눌러 주세요.',
  model: '포즈 모델을 불러오지 못했어요. 개발 서버를 pnpm dev로 켰는지 확인해 주세요.',
}

const OBSERVER_LABELS = {
  unrated: '판단 보류',
  sufficient: '필수 부위 충분',
  insufficient: '필수 부위 부족',
  multiple: '복수 인물',
} as const
const RESULT_LABELS = { ...OBSERVER_LABELS, unavailable: '대조 보류' }

// 스켈레톤이 내 몸을 따라 움직이는지 확인하는 데모 화면. 자세 판정·알림은 아직 없다
export function MeasureDemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const observerRef = useRef<HTMLSelectElement>(null)

  const draw = useCallback((pose: LatestPose) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
    }
    drawSkeleton2D(canvas, pose)
  }, [])

  const {
    status,
    error,
    stats,
    fpsLimit,
    setFpsLimit,
    framingMode,
    setFramingMode,
    model,
    setModel,
    handsEnabled,
    setHandsEnabled,
    faceEnabled,
    setFaceEnabled,
    start,
    stop,
    poseRef,
  } = useMeasurement(videoRef, draw)
  const running = status === 'running'

  // 안내·제스처가 사라질 때도 글자가 남아 있어야 부드럽게 흐려진다
  const [hintText, setHintText] = useState('')
  const [gestureText, setGestureText] = useState('')
  const [trialScenario, setTrialScenario] = useState<TrialScenario>(TRIAL_SCENARIOS[0])
  const [trial, trialAction] = useReducer(reduceFramingTrial, undefined, createFramingTrial)
  const [unusedCondition, setUnusedCondition] = useState(false)
  const trialSettings: TrialSettings = { model, framingMode, fpsLimit, handsEnabled, faceEnabled }
  const profile = trialProfileKey(trialSettings)
  const tuningCounts =
    trial.frozen?.tuning ??
    summarizeFramingTrials(trial.rows.filter((row) => row.profile === profile))
  const validationCounts = summarizeFramingTrials(
    trial.rows.filter((row) => row.phase === 'validation'),
  )
  useEffect(() => {
    if (trial.phase === 'validation' && trial.frozen?.profile !== profile)
      trialAction({ type: 'invalidate-settings' })
  }, [profile, trial.phase, trial.frozen?.profile])
  useEffect(() => {
    if (stats.hint) setHintText(stats.hint)
  }, [stats.hint])
  useEffect(() => {
    if (stats.gesture) setGestureText(stats.gesture)
  }, [stats.gesture])

  const captureTrial = () => {
    const pose = poseRef.current
    trialAction({
      type: 'capture',
      scenario: trialScenario,
      settings: trialSettings,
      sample: readFramingSample({
        running,
        sampledAt: pose.sampledAt,
        personCount: pose.personCount,
        image: pose.image,
        mode: framingMode,
        now: performance.now(),
      }),
    })
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-5 text-slate-100">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Bodyguard 스켈레톤 데모</h1>
          <p className="text-sm text-slate-400">
            스켈레톤이 몸을 따라 움직이는지 확인하는 화면이에요. 자세 판정은 아직 없어요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-lg px-3 py-2 underline focus-visible:outline-2">
            서비스로 돌아가기
          </Link>
          {/* FR-M-01 측정 중에는 항상 표시한다 */}
          {running && (
            <span
              data-testid="measuring-badge"
              className="rounded-full bg-red-500/15 px-3 py-1 text-sm text-red-300"
            >
              측정 중
            </span>
          )}
          <button
            type="button"
            onClick={running || status === 'starting' ? stop : start}
            className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {running ? '측정 중지' : status === 'starting' ? '준비 취소' : '측정 시작'}
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-200"
        >
          {ERROR_TEXT[error]}
        </p>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <figure>
          <figcaption className="mb-2 text-sm text-slate-400">
            카메라 + 2D 스켈레톤 (개발용 확인 화면, 제품에서는 영상을 보여주지 않아요)
          </figcaption>
          <div className="relative aspect-[4/3] -scale-x-100 overflow-hidden rounded-xl bg-slate-900">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </figure>
        <figure>
          <figcaption className="mb-2 text-sm text-slate-400">
            3D 스켈레톤 (마우스로 돌려 볼 수 있어요)
          </figcaption>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
            <Skeleton3D poseRef={poseRef} />
            {/* FR-M-07 필요한 관절이 화면 밖이면 부드럽게 안내해 그 자세를 하도록 유도한다 */}
            <output
              aria-live="polite"
              aria-label="촬영 안내"
              className={`pointer-events-none absolute inset-x-0 top-4 mx-auto w-fit rounded-full bg-sky-400/15 px-4 py-2 text-sm text-sky-100 backdrop-blur-sm transition-opacity duration-700 ${
                stats.hint ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {hintText}
            </output>
            {/* 손 제스처(엄지척 등) 표시 — 원문 53·54 */}
            <p
              aria-live="polite"
              data-testid="gesture-badge"
              className={`pointer-events-none absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-emerald-400/15 px-4 py-2 text-sm text-emerald-100 transition-opacity duration-300 ${
                stats.gesture ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {gestureText}
            </p>
          </div>
        </figure>
      </section>

      <StatsPanel
        stats={stats}
        running={running}
        fpsLimit={fpsLimit}
        onFpsLimitChange={(value) => {
          if (value !== fpsLimit) trialAction({ type: 'invalidate-settings' })
          setFpsLimit(value)
        }}
        framingMode={framingMode}
        onFramingModeChange={(value) => {
          if (value !== framingMode) trialAction({ type: 'invalidate-settings' })
          setFramingMode(value)
        }}
        model={model}
        onModelChange={(value) => {
          if (value !== model) trialAction({ type: 'invalidate-settings' })
          setModel(value)
        }}
        handsEnabled={handsEnabled}
        onHandsEnabledChange={(value) => {
          if (value !== handsEnabled) trialAction({ type: 'invalidate-settings' })
          setHandsEnabled(value)
        }}
        faceEnabled={faceEnabled}
        onFaceEnabledChange={(value) => {
          if (value !== faceEnabled) trialAction({ type: 'invalidate-settings' })
          setFaceEnabled(value)
        }}
      />

      {import.meta.env.DEV && (
        <section aria-label="동작 촬영 검증" className="mt-4 rounded-xl bg-slate-900 p-4 text-sm">
          <h2 className="font-semibold">동작 촬영 검증 · 개발 전용</h2>
          <p className="mt-1 text-slate-400">
            촬영 범위만 대조합니다. 자세·통증·성공은 판정하지 않습니다. 최신 100개 요약은 이 화면의
            메모리에만 있습니다.
          </p>
          <p className="mt-1 text-slate-400" aria-live="polite">
            {trial.phase === 'tuning' ? '튜닝' : '별도 검증 · 설정 동결'} · 튜닝 대조{' '}
            {tuningCounts.matched} 일치 / {tuningCounts.mismatched} 불일치 /{' '}
            {tuningCounts.overAccepted} 범위 과인식 / {tuningCounts.held} 보류
            {trial.phase === 'validation' && (
              <>
                {' '}
                · 검증(현재 기록 창) {validationCounts.matched} 일치 / {validationCounts.mismatched}{' '}
                불일치 / {validationCounts.overAccepted} 범위 과인식 / {validationCounts.held} 보류
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              연기한 상황
              <select
                value={trialScenario}
                onChange={(event) => setTrialScenario(event.target.value as TrialScenario)}
                className="rounded bg-slate-800 px-2 py-2"
              >
                {TRIAL_SCENARIOS.map((scenario) => (
                  <option key={scenario}>{scenario}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              관찰자 판단
              <select
                ref={observerRef}
                value={trial.observer}
                onChange={(event) =>
                  trialAction({ type: 'observer', observer: event.target.value as ObserverFraming })
                }
                className="rounded bg-slate-800 px-2 py-2"
              >
                {Object.entries(OBSERVER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={captureTrial}
              disabled={!running || trial.invalidated}
              className="rounded bg-sky-500 px-3 py-2 text-slate-950 disabled:opacity-50"
            >
              현재 프레임 기록
            </button>
            <button
              type="button"
              onClick={() => {
                trialAction({ type: 'clear' })
                setUnusedCondition(false)
                observerRef.current?.focus()
              }}
              disabled={trial.rows.length === 0 && trial.phase === 'tuning'}
              className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50"
            >
              기록 지우기
            </button>
          </div>
          {trial.phase === 'tuning' && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={unusedCondition}
                  onChange={(event) => setUnusedCondition(event.target.checked)}
                />
                튜닝에 쓰지 않은 촬영 조건
              </label>
              <button
                type="button"
                onClick={() => {
                  trialAction({
                    type: 'begin-validation',
                    settings: trialSettings,
                    now: performance.now(),
                    unusedCondition,
                  })
                  observerRef.current?.focus()
                }}
                disabled={!unusedCondition || tuningCounts.matched + tuningCounts.mismatched === 0}
                className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50"
              >
                튜닝 마치고 검증 시작
              </button>
            </div>
          )}
          <p role="status" aria-label="촬영 대조 상태" className="mt-1 text-slate-400">
            {trial.invalidated
              ? '설정이 바뀌었습니다. 기록 지우기로 새 튜닝을 시작하세요.'
              : trial.message}
          </p>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-slate-300" aria-live="polite">
            {trial.rows.map((row) => (
              <li key={row.id}>
                {row.scenario} / {row.profile.split('/')[1] === 'seated' ? '머리·어깨' : '전신'}:
                필수 관절 {row.sample.visible}/{row.sample.total} ·{' '}
                {row.sample.hint ?? '촬영 범위 충족 (동작 성공 아님)'}
                {row.observer !== 'unrated' && (
                  <>
                    {' '}
                    · {row.phase === 'tuning' ? '튜닝' : '검증'} · 관찰자:{' '}
                    {OBSERVER_LABELS[row.observer]} / 인식: {RESULT_LABELS[row.sample.result]} ·{' '}
                    {row.sample.result === 'unavailable'
                      ? '대조 보류'
                      : row.observer === row.sample.result
                        ? '일치'
                        : '불일치'}
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="mt-4 text-xs text-slate-500">
        영상은 이 브라우저 밖으로 나가지 않고 저장되지도 않아요.
      </p>
    </main>
  )
}
