// 스켈레톤의 둥근 머리와 얼굴 (원문 55, 57).
// 얼굴 관절을 선으로 잇지 않는다. 머리 자리와 크기는 몸 모델의 귀로, 방향과 눈·입은 얼굴 모델로 정한다 (ADR-0017).
// 브라우저 API를 쓰지 않는 순수 함수라 카메라 없이 테스트한다 (ADR-0012)
import { type Quaternion, Vector3 } from 'three'

export type Vec3 = { x: number; y: number; z: number }

/** 머리 방향. 서로 수직인 단위 벡터이고 right × up = forward다. forward는 얼굴이 보는 쪽이다 */
export type Axes = { right: Vec3; up: Vec3; forward: Vec3 }

/** 머리의 자리·크기·방향. 좌표계는 x 오른쪽, y 위, z 보는 사람 쪽인 오른손 좌표계다 */
export type HeadPose = Axes & { center: Vec3; radius: number }

/** 보는 사람을 똑바로 보는 방향. 얼굴 모델이 없거나 얼굴을 못 찾으면 이 방향으로 그린다 */
export const FRONT: Axes = {
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  forward: { x: 0, y: 0, z: 1 },
}

// 얼굴 관절: 코, 눈 여섯, 귀 둘, 입꼬리 둘. 선이나 점으로 그리지 않고 머리가 대신한다
export const FACE_POINTS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// 머리를 그리는 데 필요한 몸 관절: 코(얼굴이 카메라 쪽인지), 양 귀(자리와 크기)
const NOSE = 0
const EARS = [7, 8] as const

// 귀 사이 거리에 곱해 머리 반지름으로 쓴다. 실제 머리보다 크게 그려 2등신 캐릭터처럼 보이게 한다
export const HEAD_SCALE = 0.95
// 머리 중심을 귀 높이에서 반지름의 이만큼 올린다. 얼굴 부품이 머리 가운데보다 아래에 오고, 턱이 어깨에 닿지 않는다
export const HEAD_LIFT = 0.25

/**
 * 얼굴 부품 자리. 반지름 1인 머리를 정면에서 본 좌표다 (x 오른쪽, y 위).
 * 좌우 대칭이라 거울처럼 뒤집은 화면에서도 같게 보인다
 */
export const FACE = {
  eyes: [
    { x: -0.36, y: -0.06 },
    { x: 0.36, y: -0.06 },
  ],
  eyeRadius: { x: 0.1, y: 0.13 },
  // 눈동자 하이라이트. 눈 가운데에서 바깥쪽 위로 비껴 둔다
  shine: { dx: 0.03, dy: 0.05, r: 0.04 },
  cheeks: [
    { x: -0.58, y: -0.28 },
    { x: 0.58, y: -0.28 },
  ],
  cheekRadius: { x: 0.14, y: 0.085 },
  // 웃는 입: 가장 낮은 점의 높이, 원호 반지름, 원호 각(라디안), 선 굵기
  smile: { y: -0.33, radius: 0.15, arc: 1.85, width: 0.045 },
  // 벌린 입: 가운데 높이, 가로 반지름, 세로 반지름(조금 벌림~크게 벌림)
  mouth: { y: -0.31, rx: 0.1, ry: [0.035, 0.13] as const },
} as const

export const FACE_COLORS = {
  skin: '#ffedd5',
  ink: '#1e293b',
  cheek: '#f9a8d4',
  shine: '#ffffff',
} as const

// 입을 이만큼(0~1) 넘게 벌리면 웃는 입 대신 벌린 입을 그린다
export const MOUTH_OPEN_MIN = 0.08

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k })
const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * 머리의 자리와 크기를 몸 관절로 정하고 방향(axes)을 붙인다.
 * 코와 양 귀 중 하나라도 믿을 수 없으면 null이다 (constitution P3). points와 axes는 같은 좌표계여야 한다
 */
export function headPose(
  points: readonly Vec3[] | null | undefined,
  trusted: readonly boolean[],
  axes: Axes = FRONT,
): HeadPose | null {
  if (!points || !trusted[NOSE] || !points[NOSE]) return null
  const [a, b] = EARS.map((i) => (trusted[i] ? points[i] : undefined))
  if (!a || !b) return null
  const span = sub(a, b)
  const width = Math.hypot(span.x, span.y, span.z)
  if (width < 1e-9) return null
  const radius = width * HEAD_SCALE
  return { ...axes, radius, center: add(mid(a, b), scale(axes.up, radius * HEAD_LIFT)) }
}

const X = new Vector3(1, 0, 0)
const Y = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)
const plain = (v: Vector3): Vec3 => ({ x: v.x, y: v.y, z: v.z })

/**
 * 얼굴 모델의 머리 회전(카메라 기준, 원본 영상)을 그리는 좌표계의 방향으로 바꾼다. 없으면 정면이다.
 * mirrored면 3D 화면처럼 좌우를 뒤집는다. x만 뒤집으면 왼손 좌표계가 되므로 오른쪽 축은 한 번 더 뒤집는다
 */
export function turnAxes(turn: Quaternion | null | undefined, mirrored: boolean): Axes {
  if (!turn) return FRONT
  const r = X.clone().applyQuaternion(turn)
  const u = Y.clone().applyQuaternion(turn)
  const f = Z.clone().applyQuaternion(turn)
  if (!mirrored) return { right: plain(r), up: plain(u), forward: plain(f) }
  return {
    right: { x: r.x, y: -r.y, z: -r.z },
    up: { x: -u.x, y: u.y, z: u.z },
    forward: { x: -f.x, y: f.y, z: f.z },
  }
}

/**
 * FACE.eyes[index] 자리에 그릴 눈이 얼마나 떠 있는지(0~1). 얼굴 상태가 없으면 뜬 눈이다.
 * 원본 영상 기준으로 왼쪽 눈이 앞이라, 좌우를 뒤집은 3D 화면에서는 반대쪽 눈을 쓴다
 */
export function eyeOpen(
  face: { eyes: readonly [number, number] } | null | undefined,
  index: number,
  mirrored: boolean,
): number {
  if (!face) return 1
  return face.eyes[mirrored ? 1 - index : index] ?? 1
}

/** 눈 뜬 정도(0~1)를 눈 세로 크기 비율로 바꾼다. 감으면 가는 선으로 남는다 */
export const eyeLid = (open: number): number => 0.12 + 0.88 * clamp01((open - 0.3) / 0.45)

/** 입 벌린 정도(0~1)에 맞는 벌린 입의 세로 반지름 */
export const mouthRadiusY = (mouth: number): number =>
  FACE.mouth.ry[0] + (FACE.mouth.ry[1] - FACE.mouth.ry[0]) * clamp01(mouth)

const depth = (x: number, y: number): number => Math.sqrt(Math.max(0, 1 - x * x - y * y))

/** 정면 좌표(x, y)에 해당하는 머리 표면의 점. lift는 표면에서 바깥으로 띄우는 비율이다 */
export function onHead(head: HeadPose, x: number, y: number, lift = 1): Vec3 {
  const { center, radius, right, up, forward } = head
  const z = depth(x, y)
  const k = radius * lift
  return {
    x: center.x + k * (x * right.x + y * up.x + z * forward.x),
    y: center.y + k * (x * right.y + y * up.y + z * forward.y),
    z: center.z + k * (x * right.z + y * up.z + z * forward.z),
  }
}

/** 정면 좌표(x, y)의 머리 표면이 보는 사람 쪽을 향하는가. 고개를 돌려 뒤로 넘어간 부품은 그리지 않는다 */
export function facesViewer(head: HeadPose, x: number, y: number): boolean {
  const { right, up, forward } = head
  return x * right.z + y * up.z + depth(x, y) * forward.z > 0
}
