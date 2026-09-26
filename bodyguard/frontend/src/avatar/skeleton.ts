// 스켈레톤 뼈대 정의와 선분 계산.
// 브라우저 API를 쓰지 않는 순수 함수라 카메라 없이 테스트한다 (ADR-0012)
import type { Side } from '../posture/hands'
import { JOINT_COUNT, type Point } from '../posture/landmarks'

// 부위는 나중에 판정 색을 칠할 단위다 (FR-A-01, design §9.1). 머리('head')는 선이 없고 face.ts의 둥근 머리로 그린다
export type BodyPart = 'head' | 'neck' | 'shoulders' | 'torso' | 'arms' | 'legs'
export type Segment = { part: BodyPart; a: Point; b: Point }

// MediaPipe Pose 33점 연결에서 얼굴 연결(0~10번)을 뺀 것. 얼굴은 선 대신 둥근 머리로 그린다 (원문 55)
export const BONES: ReadonlyArray<readonly [number, number, BodyPart]> = [
  [11, 12, 'shoulders'],
  [11, 13, 'arms'],
  [13, 15, 'arms'],
  [15, 17, 'arms'],
  [15, 19, 'arms'],
  [15, 21, 'arms'],
  [17, 19, 'arms'],
  [12, 14, 'arms'],
  [14, 16, 'arms'],
  [16, 18, 'arms'],
  [16, 20, 'arms'],
  [16, 22, 'arms'],
  [18, 20, 'arms'],
  [11, 23, 'torso'],
  [12, 24, 'torso'],
  [23, 24, 'torso'],
  [23, 25, 'legs'],
  [25, 27, 'legs'],
  [27, 29, 'legs'],
  [27, 31, 'legs'],
  [29, 31, 'legs'],
  [24, 26, 'legs'],
  [26, 28, 'legs'],
  [28, 30, 'legs'],
  [28, 32, 'legs'],
  [30, 32, 'legs'],
]

// 목은 MediaPipe 연결에 없어서 귀 중점 → 어깨 중점으로 만든다 (design §9.1)
export const NECK_SEGMENT_INDEX = BONES.length
export const SEGMENT_COUNT = BONES.length + 1

const midpoint = (p: Point, q: Point): Point => ({
  x: (p.x + q.x) / 2,
  y: (p.y + q.y) / 2,
  z: (p.z + q.z) / 2,
})

/**
 * 그릴 선분을 돌려준다. 자리는 BONES 순서이고 마지막 자리는 목이다.
 * 양 끝 관절 중 하나라도 믿을 수 없으면 그 자리는 null이다.
 * points는 화면 좌표나 월드 좌표이고, trusted는 같은 프레임의 화면 좌표로 구한다 (posture/landmarks)
 */
export function skeletonSegments(
  points: readonly Point[] | null | undefined,
  trusted: readonly boolean[],
): (Segment | null)[] {
  const out: (Segment | null)[] = new Array(SEGMENT_COUNT).fill(null)
  if (!points || points.length < JOINT_COUNT) return out
  BONES.forEach(([i, j, part], k) => {
    const a = points[i]
    const b = points[j]
    if (a && b && trusted[i] && trusted[j]) out[k] = { part, a, b }
  })
  const [leftEar, rightEar, leftShoulder, rightShoulder] = [
    points[7],
    points[8],
    points[11],
    points[12],
  ]
  const neckTrusted = trusted[7] && trusted[8] && trusted[11] && trusted[12]
  if (neckTrusted && leftEar && rightEar && leftShoulder && rightShoulder) {
    out[NECK_SEGMENT_INDEX] = {
      part: 'neck',
      a: midpoint(leftEar, rightEar),
      b: midpoint(leftShoulder, rightShoulder),
    }
  }
  return out
}

// 몸(Pose) 모델이 주는 거친 손 점: 새끼·검지·엄지 뿌리. 손가락 모델이 붙은 쪽은 겹치지 않게 뺀다
export const ROUGH_HAND_POINTS: Record<Side, readonly number[]> = {
  left: [17, 19, 21],
  right: [18, 20, 22],
}

/** 손가락이 붙은 쪽의 거친 손 선분을 뺀다. 손목과 팔뚝은 남긴다 */
export function withoutRoughHands(
  segments: (Segment | null)[],
  sides: readonly Side[],
): (Segment | null)[] {
  if (sides.length === 0) return segments
  const hidden = new Set(sides.flatMap((side) => ROUGH_HAND_POINTS[side]))
  return segments.map((segment, k) => {
    const bone = BONES[k]
    return bone && (hidden.has(bone[0]) || hidden.has(bone[1])) ? null : segment
  })
}
