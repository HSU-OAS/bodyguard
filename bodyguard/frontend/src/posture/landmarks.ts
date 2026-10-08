// MediaPipe 관절을 믿고 쓸 수 있는지 가리는 순수 함수.
// 브라우저 API를 쓰지 않아서 카메라 없이 테스트한다 (ADR-0012)

export type Point = { x: number; y: number; z: number; visibility?: number; presence?: number }

export const JOINT_COUNT = 33

/**
 * 가시성: MediaPipe가 관절마다 주는 0~1 점수. 그 관절이 가려지지 않고 정말 보인다고 얼마나 확신하는지다.
 * 이보다 낮은 관절은 MediaPipe가 지어낸 위치로 보고 쓰지 않는다 (constitution P3)
 */
export const MIN_VISIBILITY = 0.5

// 앉은 자세 판정에 쓰는 관절: 코, 양 귀, 양 어깨
export const HEAD_SHOULDER_JOINTS: readonly number[] = [0, 7, 8, 11, 12]

/** 화면 좌표(0~1)가 카메라 화면 안에 있는가 */
export const isInFrame = (p: Point): boolean =>
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  Number.isFinite(p.z) &&
  p.x >= 0 &&
  p.x <= 1 &&
  p.y >= 0 &&
  p.y <= 1

// FR-M-07 비정상 모델 값을 신뢰도/관절 색으로 전파하지 않는다. 실제 관절 가시성 보장은 아니다.
const visibility = (p: Point): number => {
  const value = p.visibility ?? 0
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0
}

/**
 * 관절마다 믿고 쓸 수 있는지. 가시성이 충분하고 화면 안에 있어야 한다.
 * 화면 밖 관절도 가시성이 높게 나올 때가 있어서 둘 다 본다 (2026-09-26 데모에서 확인)
 */
export function trustedJoints(
  image: readonly Point[] | null | undefined,
  min = MIN_VISIBILITY,
): boolean[] {
  return Array.from({ length: JOINT_COUNT }, (_, i) => {
    const p = image?.[i]
    return (
      p !== undefined &&
      Number.isFinite(min) &&
      min > 0 &&
      min <= 1 &&
      visibility(p) >= min &&
      isInFrame(p)
    )
  })
}

/** 머리·어깨 인식 확실도(0~1). 화면 밖 관절은 0으로 센다. 디버그 패널용 */
export function headShoulderConfidence(image: readonly Point[] | null | undefined): number | null {
  if (!image || image.length < JOINT_COUNT) return null
  const sum = HEAD_SHOULDER_JOINTS.reduce((acc, i) => {
    const p = image[i]
    return acc + (p && isInFrame(p) ? visibility(p) : 0)
  }, 0)
  return sum / HEAD_SHOULDER_JOINTS.length
}
