// 얼굴 모델(Face Landmarker) 결과로 머리 방향과 눈·입을 구한다 (원문 57, ADR-0017).
// 몸 모델의 얼굴 점 깊이값으로 구하면 늘 아래를 보고 떨렸다 (원문 56, Q-31).
// 브라우저 API를 쓰지 않는 순수 함수라 카메라 없이 테스트한다 (ADR-0012)
import { Matrix4, Quaternion, Vector3 } from 'three'
import type { Vec3 } from './face'

/** 한 프레임의 얼굴 측정값. 좌표는 그리는 데만 쓰고 버린다 (FR-M-02) */
export type FaceRaw = {
  /** 카메라 기준 머리 회전. x 오른쪽, y 위, z 카메라 쪽이고 좌우를 뒤집지 않은 원본 영상 기준이다 */
  rotation: Quaternion
  /** 눈꺼풀 사이 ÷ 눈 너비. 원본 영상에서 왼쪽에 보이는 눈, 오른쪽에 보이는 눈 순서 */
  eyeRatio: readonly [number, number]
  /** 입술 사이 ÷ 입 너비 */
  mouthRatio: number
}

/** 그릴 얼굴 상태 */
export type FaceState = {
  /** 정면 기준에서 얼마나 돌았는지. 좌표계는 FaceRaw.rotation과 같다 */
  turn: Quaternion
  /** 눈 뜬 정도 0(감음)~1(평소만큼 뜸). 원본 영상의 왼쪽 눈, 오른쪽 눈 순서 */
  eyes: readonly [number, number]
  /** 입 벌린 정도 0(다묾)~1(크게 벌림) */
  mouth: number
}

// Face Landmarker 478점 중 눈꺼풀·입술 점 (MediaPipe Face Mesh 번호)
type EyePoints = { outer: number; inner: number; upper: number; lower: number }
const EYE_POINTS: readonly EyePoints[] = [
  { outer: 33, inner: 133, upper: 159, lower: 145 },
  { outer: 263, inner: 362, upper: 386, lower: 374 },
]
const LIPS = { upper: 13, lower: 14, left: 61, right: 291 }

// 측정 시작 뒤 얼굴이 처음 보이고 이 시간 동안의 평균 방향을 정면으로 삼는다. 이때 화면을 보고 있다고 본다
export const NEUTRAL_MS = 2000
// 머리 방향 떨림을 줄이는 시간 상수. 클수록 부드럽고 늦게 따라온다
export const TURN_SMOOTH_MS = 50
// 입술 사이 ÷ 입 너비: 이하이면 다문 것, MOUTH_WIDE면 크게 벌린 것
const MOUTH_CLOSED = 0.06
const MOUTH_WIDE = 0.45

const near0 = (v: number | undefined) => v !== undefined && Math.abs(v) < 1e-6

/**
 * 얼굴 변환 행렬(4×4)에서 회전만 꺼낸다. 크기와 위치는 버린다.
 * 저장 순서는 열 우선이 기본이다. 맨 아래 행 자리(3, 7, 11번)가 0이 아니고 12~14번이 0이면 행 우선으로 보고 뒤집는다
 */
export function faceRotation(data: readonly number[] | undefined): Quaternion | null {
  if (data?.length !== 16) return null
  const m = new Matrix4().fromArray(data)
  const columnMajor = near0(data[3]) && near0(data[7]) && near0(data[11])
  if (!columnMajor && near0(data[12]) && near0(data[13]) && near0(data[14])) m.transpose()
  const rotation = new Quaternion()
  m.decompose(new Vector3(), rotation, new Vector3())
  return rotation
}

/**
 * 얼굴 점으로 눈 뜬 정도와 입 벌린 정도를 잰다. 점은 0~1 화면 좌표라 가로에 aspect(너비 ÷ 높이)를 곱해 비율을 맞춘다.
 * 어느 눈이 어느 쪽인지는 이름 대신 화면 위치로 정한다
 */
export function faceOpenness(
  points: readonly Vec3[],
  aspect: number,
): Pick<FaceRaw, 'eyeRatio' | 'mouthRatio'> | null {
  const at = (i: number) => points[i]
  const dist = (i: number, j: number) => {
    const a = at(i)
    const b = at(j)
    return a && b ? Math.hypot((a.x - b.x) * aspect, a.y - b.y) : 0
  }
  const eyes = EYE_POINTS.map((e) => {
    const outer = at(e.outer)
    const inner = at(e.inner)
    const width = dist(e.outer, e.inner)
    if (!outer || !inner || width === 0) return null
    return { x: (outer.x + inner.x) / 2, ratio: dist(e.upper, e.lower) / width }
  })
  const [a, b] = eyes
  const mouthWidth = dist(LIPS.left, LIPS.right)
  if (!a || !b || mouthWidth === 0) return null
  const [left, right] = a.x <= b.x ? [a, b] : [b, a]
  return {
    eyeRatio: [left.ratio, right.ratio],
    mouthRatio: dist(LIPS.upper, LIPS.lower) / mouthWidth,
  }
}

/** Face Landmarker 결과에서 첫 얼굴을 읽는다. 얼굴이 없으면 null */
export function readFace(
  result: {
    faceLandmarks: readonly (readonly Vec3[])[]
    facialTransformationMatrixes?: readonly { data: readonly number[] }[]
  },
  aspect: number,
): FaceRaw | null {
  const points = result.faceLandmarks[0]
  const rotation = faceRotation(result.facialTransformationMatrixes?.[0]?.data)
  const open = points ? faceOpenness(points, aspect) : null
  return rotation && open ? { rotation, ...open } : null
}

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((p, q) => p - q)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * 측정 한 번 동안 얼굴을 따라간다. 측정을 시작할 때마다 새로 만든다.
 * - 정면 기준: 얼굴이 처음 보이고 NEUTRAL_MS 동안의 평균 방향. 카메라가 모니터 위나 옆에 있어도 화면을 보면 정면이 된다
 * - 떨림: 머리 방향만 TURN_SMOOTH_MS로 부드럽게 한다. 깜빡임은 빨라서 부드럽게 하지 않는다
 * - 눈: 정면 기준을 잡는 동안의 눈 비율(중앙값)을 평소 뜬 눈으로 본다
 */
export function createFaceTracker(neutralMs = NEUTRAL_MS, smoothMs = TURN_SMOOTH_MS) {
  let firstSeen: number | null = null
  let lastSeen = 0
  let anchor: Quaternion | null = null
  const sum = new Quaternion(0, 0, 0, 0)
  const neutral = new Quaternion()
  const eyeSamples: [number[], number[]] = [[], []]
  const eyeBase: [number, number] = [0, 0]
  let shown: Quaternion | null = null

  return (raw: FaceRaw | null, now: number): FaceState | null => {
    if (!raw) {
      // 다시 보이면 부드럽게 이어 가지 않고 바로 맞춘다
      shown = null
      return null
    }
    firstSeen ??= now
    if (now - firstSeen <= neutralMs) {
      anchor ??= raw.rotation.clone()
      // q와 -q는 같은 회전이라 첫 표본과 같은 쪽으로 맞춰 더한다
      const k = raw.rotation.dot(anchor) < 0 ? -1 : 1
      sum.set(
        sum.x + k * raw.rotation.x,
        sum.y + k * raw.rotation.y,
        sum.z + k * raw.rotation.z,
        sum.w + k * raw.rotation.w,
      )
      neutral.copy(sum).normalize()
      eyeSamples[0].push(raw.eyeRatio[0])
      eyeSamples[1].push(raw.eyeRatio[1])
      eyeBase[0] = median(eyeSamples[0])
      eyeBase[1] = median(eyeSamples[1])
    }
    // 정면 기준에서 지금까지 돈 만큼: 지금 회전 × 기준 회전의 역
    const target = raw.rotation.clone().multiply(neutral.clone().invert())
    if (shown) shown.slerp(target, 1 - Math.exp(-(now - lastSeen) / smoothMs))
    else shown = target
    lastSeen = now
    const open = (i: 0 | 1) => (eyeBase[i] > 0 ? clamp01(raw.eyeRatio[i] / eyeBase[i]) : 1)
    return {
      turn: shown.clone(),
      eyes: [open(0), open(1)],
      mouth: clamp01((raw.mouthRatio - MOUTH_CLOSED) / (MOUTH_WIDE - MOUTH_CLOSED)),
    }
  }
}
