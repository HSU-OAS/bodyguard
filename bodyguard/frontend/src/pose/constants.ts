import type { FramingMode } from '../posture/framing'

// 측정 파이프라인 상수. 실측(M-2)하면서 바뀐다 (design §4)

// scripts/prepare-assets.mjs가 public/에 준비하는 파일
export const WASM_BASE_PATH = '/mediapipe/wasm'

// design §4.1 — 포즈 모델. 데모에서 크기별로 바꿔 가며 비교한다 (원문 52).
// 제품 기본값은 정확도가 충분한 가장 작은 모델로, 실측(M-2, M-4) 뒤에 정한다
export const POSE_MODELS = {
  lite: { label: 'lite (5.5MB)', path: '/models/pose_landmarker_lite.task' },
  full: { label: 'full (9.0MB)', path: '/models/pose_landmarker_full.task' },
  heavy: { label: 'heavy (29.2MB)', path: '/models/pose_landmarker_heavy.task' },
} as const
export type PoseModel = keyof typeof POSE_MODELS
export const DEFAULT_POSE_MODEL: PoseModel = 'heavy'

// 손가락 21점 + 제스처(엄지척 등). 원문 53·54에서 추가했다 (ADR-0016)
export const GESTURE_MODEL_PATH = '/models/gesture_recognizer.task'
export const DEFAULT_HANDS_ENABLED = true

// 얼굴 478점 + 머리 방향 행렬. 둥근 머리의 방향과 눈·입에 쓴다 (원문 57, ADR-0017)
export const FACE_MODEL_PATH = '/models/face_landmarker.task'
export const DEFAULT_FACE_ENABLED = true

// design §4.2 — 처음 설계값은 초당 15회였는데 부족하다는 의견에 30으로 올렸다 (원문 50).
// 카메라가 초당 30장을 주면 30이 상한이다. 0 = 제한 없음(카메라가 주는 만큼)
export const INFERENCE_FPS_OPTIONS = [30, 15, 0] as const
export type InferenceFpsLimit = (typeof INFERENCE_FPS_OPTIONS)[number]
export const DEFAULT_INFERENCE_FPS: InferenceFpsLimit = 30

// 안내 문구 기준. 제품에서는 지금 하는 일(자세 측정·스트레칭)에 따라 정해지고, 데모에서는 바꿔 볼 수 있다
export const DEFAULT_FRAMING_MODE: FramingMode = 'seated'

// design §4.1 — 640×480, 영상만 받는다
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
}
