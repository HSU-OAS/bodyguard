import type { LatestPose } from '../pose/useMeasurement'
import { HAND_BONES, trustedHandPoints } from '../posture/hands'
import { trustedJoints } from '../posture/landmarks'
import {
  eyeLid,
  eyeOpen,
  FACE,
  FACE_COLORS,
  FACE_POINTS,
  facesViewer,
  type HeadPose,
  headPose,
  MOUTH_OPEN_MIN,
  mouthRadiusY,
  onHead,
  turnAxes,
} from './face'
import type { FaceState } from './faceTracking'
import { ROUGH_HAND_POINTS, skeletonSegments, withoutRoughHands } from './skeleton'

// 판정 색(FR-A-01)은 판정 엔진(tasks #7)이 생기면 부위별로 칠한다. 지금은 한 색이다
const NEUTRAL = 'rgba(226, 232, 240, 0.95)'

type Flat = readonly [number, number]

// 정면 좌표의 타원·원호를 점으로 나눈다. 머리 표면에 올리면 고개를 돌린 만큼 납작해진다
const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 24): Flat[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2
    return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]
  })
const smileArc = (n = 16): Flat[] => {
  const { y, radius, arc } = FACE.smile
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = -Math.PI / 2 - arc / 2 + (arc * i) / n
    return [radius * Math.cos(t), y + radius + radius * Math.sin(t)]
  })
}

// 원문 55·57 둥근 머리와 얼굴. head는 캔버스 픽셀 단위의 오른손 좌표계(y 위)라 그릴 때 y를 뒤집는다.
// 2D는 원본 영상 좌표 그대로 그리고 화면에서 CSS로 뒤집으므로 눈은 뒤집지 않은 순서로 고른다
function drawFace(
  ctx: CanvasRenderingContext2D,
  head: HeadPose,
  lineWidth: number,
  face: FaceState | null,
) {
  const trace = (points: readonly Flat[], closed = true) => {
    ctx.beginPath()
    points.forEach(([x, y], i) => {
      const p = onHead(head, x, y)
      if (i === 0) ctx.moveTo(p.x, -p.y)
      else ctx.lineTo(p.x, -p.y)
    })
    if (closed) ctx.closePath()
  }

  ctx.save()
  ctx.beginPath()
  ctx.arc(head.center.x, -head.center.y, head.radius, 0, Math.PI * 2)
  // 불투명하게 칠한다. 비치면 머리 밑을 지나는 목 선이 얼굴 위에 줄처럼 보인다
  ctx.fillStyle = FACE_COLORS.skin
  ctx.fill()
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = NEUTRAL
  ctx.stroke()

  ctx.fillStyle = FACE_COLORS.cheek
  for (const { x, y } of FACE.cheeks) {
    if (!facesViewer(head, x, y)) continue
    trace(ellipse(x, y, FACE.cheekRadius.x, FACE.cheekRadius.y))
    ctx.fill()
  }
  FACE.eyes.forEach(({ x, y }, i) => {
    if (!facesViewer(head, x, y)) return
    // 눈을 감으면 세로로 납작해져 선만 남는다
    const lid = eyeLid(eyeOpen(face, i, false))
    trace(ellipse(x, y, FACE.eyeRadius.x, FACE.eyeRadius.y * lid))
    ctx.fillStyle = FACE_COLORS.ink
    ctx.fill()
    if (lid < 0.5) return
    const { dx, dy, r } = FACE.shine
    trace(ellipse(x + Math.sign(x) * dx, y + dy * lid, r, r, 12))
    ctx.fillStyle = FACE_COLORS.shine
    ctx.fill()
  })
  const mouth = face?.mouth ?? 0
  if (mouth >= MOUTH_OPEN_MIN && facesViewer(head, 0, FACE.mouth.y)) {
    trace(ellipse(0, FACE.mouth.y, FACE.mouth.rx, mouthRadiusY(mouth)))
    ctx.fillStyle = FACE_COLORS.ink
    ctx.fill()
  } else if (mouth < MOUTH_OPEN_MIN && facesViewer(head, 0, FACE.smile.y)) {
    trace(smileArc(), false)
    ctx.lineWidth = Math.max(1.5, head.radius * FACE.smile.width)
    ctx.strokeStyle = FACE_COLORS.ink
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * 웹캠 화면 위에 2D 스켈레톤과 손가락을 그린다. 좌표는 0~1로 정규화된 화면 좌표다.
 * 제품 화면에는 카메라 영상을 보여주지 않으므로 개발용 확인 화면에서만 쓴다 (FR-V-02, FR-V-03)
 */
export function drawSkeleton2D(
  canvas: HTMLCanvasElement,
  pose: Pick<LatestPose, 'image' | 'hands' | 'face'>,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  const { image, hands, face } = pose

  const lineWidth = Math.max(2, width / 160)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = NEUTRAL
  ctx.fillStyle = NEUTRAL

  const line = (ax: number, ay: number, bx: number, by: number) => {
    ctx.beginPath()
    ctx.moveTo(ax * width, ay * height)
    ctx.lineTo(bx * width, by * height)
    ctx.stroke()
  }
  const dot = (x: number, y: number, r: number) => {
    ctx.beginPath()
    ctx.arc(x * width, y * height, r, 0, Math.PI * 2)
    ctx.fill()
  }

  if (image) {
    const trusted = trustedJoints(image)
    const sides = hands.flatMap((h) => (h.side ? [h.side] : []))
    const noDot = new Set([...FACE_POINTS, ...sides.flatMap((side) => ROUGH_HAND_POINTS[side])])
    ctx.lineWidth = lineWidth
    for (const segment of withoutRoughHands(skeletonSegments(image, trusted), sides)) {
      if (segment) line(segment.a.x, segment.a.y, segment.b.x, segment.b.y)
    }
    image.forEach((p, i) => {
      if (trusted[i] && !noDot.has(i)) dot(p.x, p.y, lineWidth * 1.2)
    })
    // 자리·크기: 화면 좌표(y 아래, z는 멀수록 큼)를 픽셀 단위 오른손 좌표계(y 위, z 보는 사람 쪽)로 바꿔 귀로 구한다.
    // 방향: 얼굴 모델의 회전을 뒤집지 않고 쓴다 (원문 57)
    const head = headPose(
      image.map((p) => ({ x: p.x * width, y: -p.y * height, z: -p.z * width })),
      trusted,
      turnAxes(face?.turn, false),
    )
    if (head) drawFace(ctx, head, lineWidth, face)
  }

  // 손가락 21점 (원문 53·54). 몸보다 가늘게 그린다
  ctx.lineWidth = lineWidth * 0.6
  ctx.strokeStyle = NEUTRAL
  ctx.fillStyle = NEUTRAL
  for (const hand of hands) {
    const trusted = trustedHandPoints(hand.image)
    for (const [a, b] of HAND_BONES) {
      const pa = hand.image[a]
      const pb = hand.image[b]
      if (pa && pb && trusted[a] && trusted[b]) line(pa.x, pa.y, pb.x, pb.y)
    }
    hand.image.forEach((p, i) => {
      if (trusted[i]) dot(p.x, p.y, lineWidth * 0.7)
    })
  }
}
