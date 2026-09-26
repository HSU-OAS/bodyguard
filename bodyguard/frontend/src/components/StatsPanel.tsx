import {
  INFERENCE_FPS_OPTIONS,
  type InferenceFpsLimit,
  POSE_MODELS,
  type PoseModel,
} from '../pose/constants'
import type { MeasureStats } from '../pose/useMeasurement'
import type { FramingMode } from '../posture/framing'

type Props = {
  stats: MeasureStats
  running: boolean
  fpsLimit: InferenceFpsLimit
  onFpsLimitChange: (limit: InferenceFpsLimit) => void
  framingMode: FramingMode
  onFramingModeChange: (mode: FramingMode) => void
  model: PoseModel
  onModelChange: (model: PoseModel) => void
  handsEnabled: boolean
  onHandsEnabledChange: (enabled: boolean) => void
  faceEnabled: boolean
  onFaceEnabledChange: (enabled: boolean) => void
}

const fpsLabel = (v: InferenceFpsLimit) =>
  v === 0 ? '제한 없음' : `${v}fps${v === 30 ? ' (설계값)' : ''}`

const FRAMING_OPTIONS: ReadonlyArray<readonly [FramingMode, string]> = [
  ['seated', '앉은 자세 (머리·어깨)'],
  ['standing', '서서 (전신)'],
]

const MODEL_OPTIONS = (Object.keys(POSE_MODELS) as PoseModel[]).map(
  (m) => [m, POSE_MODELS[m].label] as const,
)

const ON_OFF_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['on', '켬'],
  ['off', '끔'],
]

const CONFIDENCE_HELP =
  'MediaPipe가 코·귀·어깨를 얼마나 확실하게 보고 있는지예요. 화면 밖이거나 가려지면 낮아져요.'

// FR-V-03 디버그 패널 — fps 실측(M-2), 인식 확실도, 안내 기준·모델 크기·손가락·얼굴 비교용
export function StatsPanel({
  stats,
  running,
  fpsLimit,
  onFpsLimitChange,
  framingMode,
  onFramingModeChange,
  model,
  onModelChange,
  handsEnabled,
  onHandsEnabledChange,
  faceEnabled,
  onFaceEnabledChange,
}: Props) {
  const show = (value: string) => (running ? value : '-')
  const confidence = stats.confidence === null ? '-' : `${Math.round(stats.confidence * 100)}%`
  const handMs = stats.handMs === null ? '꺼짐' : `${stats.handMs} ms`
  const faceMs = stats.faceMs === null ? '꺼짐' : `${stats.faceMs} ms`

  return (
    <section
      aria-label="측정 수치"
      className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-slate-900 p-4 text-sm sm:grid-cols-3 lg:grid-cols-4"
    >
      <Stat label="fps" value={show(String(stats.fps))} testId="fps" />
      <Stat label="몸 추론 1회" value={show(`${stats.inferenceMs} ms`)} />
      <Stat label="손 추론 1회" value={show(handMs)} />
      <Stat label="얼굴 추론 1회" value={show(faceMs)} />
      <Stat label="사람 인식" value={show(stats.detected ? '됨' : '안 보여요')} />
      <Stat label="처리 장치" value={show(stats.delegate ?? '-')} />
      <Stat label="인식 확실도 (머리·어깨)" value={show(confidence)} help={CONFIDENCE_HELP} />
      <Choice
        label="추론 속도 제한"
        value={String(fpsLimit)}
        options={INFERENCE_FPS_OPTIONS.map((v) => [String(v), fpsLabel(v)] as const)}
        onChange={(v) => onFpsLimitChange(Number(v) as InferenceFpsLimit)}
      />
      <Choice
        label="안내 기준 (데모용)"
        value={framingMode}
        options={FRAMING_OPTIONS}
        onChange={(v) => onFramingModeChange(v as FramingMode)}
      />
      <Choice
        label="포즈 모델 (데모용)"
        value={model}
        options={MODEL_OPTIONS}
        onChange={(v) => onModelChange(v as PoseModel)}
        disabled={running}
        note={running ? '측정을 멈추면 바꿀 수 있어요' : undefined}
      />
      <Choice
        label="손가락 인식 (데모용)"
        value={handsEnabled ? 'on' : 'off'}
        options={ON_OFF_OPTIONS}
        onChange={(v) => onHandsEnabledChange(v === 'on')}
      />
      <Choice
        label="얼굴 인식 (데모용)"
        value={faceEnabled ? 'on' : 'off'}
        options={ON_OFF_OPTIONS}
        onChange={(v) => onFaceEnabledChange(v === 'on')}
        note="끄면 둥근 머리가 정면만 봐요"
      />
    </section>
  )
}

function Stat({
  label,
  value,
  testId,
  help,
}: {
  label: string
  value: string
  testId?: string
  help?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-base" data-testid={testId}>
        {value}
      </span>
      {help && <span className="text-xs leading-snug text-slate-500">{help}</span>}
    </div>
  )
}

function Choice({
  label,
  value,
  options,
  onChange,
  disabled = false,
  note,
}: {
  label: string
  value: string
  options: ReadonlyArray<readonly [string, string]>
  onChange: (value: string) => void
  disabled?: boolean
  note?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-slate-400">{label}</span>
      <select
        className="rounded bg-slate-800 px-2 py-1 disabled:opacity-50"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      {note && <span className="text-xs text-slate-500">{note}</span>}
    </label>
  )
}
