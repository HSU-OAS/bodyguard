import { useCallback, useEffect, useRef, useState } from 'react'
import { drawSkeleton2D } from '../avatar/drawSkeleton2D'
import { Skeleton3D } from '../avatar/Skeleton3D'
import { StatsPanel } from '../components/StatsPanel'
import { type LatestPose, type MeasureError, useMeasurement } from '../pose/useMeasurement'
import { framingHint, REQUIRED_JOINTS } from '../posture/framing'
import { trustedJoints } from '../posture/landmarks'

// prd §4 오류·예외 처리
const ERROR_TEXT: Record<MeasureError, string> = {
  denied:
    '카메라 권한이 거부됐어요. 주소창 왼쪽의 사이트 설정에서 카메라를 허용한 뒤 다시 눌러 주세요.',
  busy: '다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 눌러 주세요.',
  'not-found': '카메라를 찾지 못했어요.',
  unknown: '카메라를 켜지 못했어요. 페이지를 새로고침한 뒤 다시 눌러 주세요.',
  model: '포즈 모델을 불러오지 못했어요. 개발 서버를 pnpm dev로 켰는지 확인해 주세요.',
}

// FR-S-01·FR-M-07 동작 후보의 촬영 범위 검증용. 코칭 판정은 하지 않는다.
const TRIAL_SCENARIOS = [
  '정상 좌측',
  '정상 우측',
  '중앙 복귀',
  '어깨 으쓱 보상',
  '몸통 옆 기울임',
  '머리 회전',
  '상반신만 보임',
  '한쪽 어깨 가림',
  '전신 보임',
] as const

// 스켈레톤이 내 몸을 따라 움직이는지 확인하는 데모 화면. 자세 판정·알림은 아직 없다
export function MeasureDemoPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
  const [trialScenario, setTrialScenario] = useState<string>(TRIAL_SCENARIOS[0])
  const [trialRows, setTrialRows] = useState<{ id: number; text: string }[]>([])
  const trialId = useRef(0)
  useEffect(() => {
    if (stats.hint) setHintText(stats.hint)
  }, [stats.hint])
  useEffect(() => {
    if (stats.gesture) setGestureText(stats.gesture)
  }, [stats.gesture])

  const captureTrial = () => {
    const points = poseRef.current.image
    const trusted = trustedJoints(points)
    const required = REQUIRED_JOINTS[framingMode]
    const visible = required.filter((joint) => trusted[joint]).length
    const hint = framingHint(points !== null, trusted, framingMode)
    const scope = framingMode === 'seated' ? '머리·어깨' : '전신'
    const id = ++trialId.current
    setTrialRows((rows) => [
      ...rows,
      {
        id,
        text: `${trialScenario} / ${scope}: 필수 관절 ${visible}/${required.length} · ${hint ?? '촬영 범위 충족 (동작 성공 아님)'}`,
      },
    ])
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
            onClick={running ? stop : start}
            disabled={status === 'starting'}
            className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {running ? '측정 중지' : status === 'starting' ? '준비 중…' : '측정 시작'}
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
        onFpsLimitChange={setFpsLimit}
        framingMode={framingMode}
        onFramingModeChange={setFramingMode}
        model={model}
        onModelChange={setModel}
        handsEnabled={handsEnabled}
        onHandsEnabledChange={setHandsEnabled}
        faceEnabled={faceEnabled}
        onFaceEnabledChange={setFaceEnabled}
      />

      {import.meta.env.DEV && (
        <section aria-label="동작 촬영 검증" className="mt-4 rounded-xl bg-slate-900 p-4 text-sm">
          <h2 className="font-semibold">동작 촬영 검증 · 개발 전용</h2>
          <p className="mt-1 text-slate-400">
            관찰자가 상황을 선택한 뒤 현재 프레임의 필수 관절만 기록합니다. 자세의 옳음·통증·성공은
            판정하지 않습니다. 기록은 이 화면의 메모리에만 있고 새로고침하면 사라집니다.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              연기한 상황
              <select
                value={trialScenario}
                onChange={(event) => setTrialScenario(event.target.value)}
                className="rounded bg-slate-800 px-2 py-2"
              >
                {TRIAL_SCENARIOS.map((scenario) => (
                  <option key={scenario}>{scenario}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={captureTrial}
              disabled={!running}
              className="rounded bg-sky-500 px-3 py-2 text-slate-950 disabled:opacity-50"
            >
              현재 프레임 기록
            </button>
            <button
              type="button"
              onClick={() => setTrialRows([])}
              disabled={trialRows.length === 0}
              className="rounded border border-slate-600 px-3 py-2 disabled:opacity-50"
            >
              기록 지우기
            </button>
          </div>
          <ol className="mt-3 list-inside list-decimal space-y-1 text-slate-300" aria-live="polite">
            {trialRows.map((row) => (
              <li key={row.id}>{row.text}</li>
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
