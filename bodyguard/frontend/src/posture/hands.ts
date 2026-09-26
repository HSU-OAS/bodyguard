// 손가락 21점 처리. 손가락 인식은 원문 53·54에서 추가했다 (ADR-0016).
// 브라우저 API를 쓰지 않는 순수 함수다 (ADR-0012)
import { isInFrame, type Point } from './landmarks'

export const HAND_POINT_COUNT = 21

// MediaPipe Hand 21점 연결. 0 손목, 1~4 엄지, 5~8 검지, 9~12 중지, 13~16 약지, 17~20 새끼
export const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
]

// Gesture Recognizer가 주는 제스처 이름 → 화면 문구. "None"은 문구가 없다
const GESTURE_LABELS: Record<string, string> = {
  Thumb_Up: '엄지척',
  Thumb_Down: '엄지 아래',
  Closed_Fist: '주먹',
  Open_Palm: '편 손바닥',
  Pointing_Up: '검지 위로',
  Victory: '브이',
  ILoveYou: '사랑해',
}

// 이보다 확신이 낮은 제스처는 보여주지 않는다 (constitution P3)
export const MIN_GESTURE_SCORE = 0.6

export function gestureLabel(name: string | undefined, score: number | undefined): string | null {
  if (!name || (score ?? 0) < MIN_GESTURE_SCORE) return null
  return GESTURE_LABELS[name] ?? null
}

/** 손 점에는 가시성 점수가 없어서 화면 안에 있는지만 본다 */
export function trustedHandPoints(hand: readonly Point[]): boolean[] {
  return Array.from({ length: HAND_POINT_COUNT }, (_, i) => {
    const p = hand[i]
    return p !== undefined && isInFrame(p)
  })
}

export type Side = 'left' | 'right'

// 몸(Pose) 모델의 손목 번호. 사람 기준 왼쪽·오른쪽이다
export const BODY_WRIST: Record<Side, number> = { left: 15, right: 16 }

/**
 * 손의 손목과 가장 가까운 몸 손목을 찾아 어느 손인지 정한다.
 * 어깨 너비의 절반보다 멀거나, 몸 손목을 믿을 수 없으면 null
 */
export function matchHandToBody(
  handImage: readonly Point[],
  bodyImage: readonly Point[] | null,
  bodyTrusted: readonly boolean[],
): Side | null {
  const handWrist = handImage[0]
  if (!handWrist || !bodyImage) return null
  let best: Side | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const side of ['left', 'right'] as const) {
    const i = BODY_WRIST[side]
    const wrist = bodyImage[i]
    if (!wrist || !bodyTrusted[i]) continue
    const d = Math.hypot(wrist.x - handWrist.x, wrist.y - handWrist.y)
    if (d < bestDistance) {
      bestDistance = d
      best = side
    }
  }
  const [ls, rs] = [bodyImage[11], bodyImage[12]]
  const limit = ls && rs ? Math.hypot(ls.x - rs.x, ls.y - rs.y) / 2 : 0.15
  return best !== null && bestDistance <= limit ? best : null
}

/**
 * 손 월드 좌표(손 중심이 원점)를 몸 월드 좌표(엉덩이 중심이 원점)로 옮긴다.
 * 두 좌표계의 축이 같다(카메라 기준, 미터)고 보고 손목끼리 위치만 맞춘다. 크기·방향은 근사치다
 */
export function attachHandToBody(handWorld: readonly Point[], bodyWrist: Point): Point[] {
  const w = handWorld[0]
  if (!w) return []
  const [dx, dy, dz] = [bodyWrist.x - w.x, bodyWrist.y - w.y, bodyWrist.z - w.z]
  return handWorld.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz }))
}
