import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from './face'
import {
  createFaceTracker,
  type FaceRaw,
  faceOpenness,
  faceRotation,
  NEUTRAL_MS,
  readFace,
} from './faceTracking'

const turn = (yaw = 0, pitch = 0, roll = 0) =>
  new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, 'YXZ'))
const deg = (rad: number) => (rad * 180) / Math.PI

// Face Landmarker처럼 얼굴이 카메라 앞 50cm에 있는 변환 행렬(열 우선)
const matrix = (q: Quaternion, size = 1) =>
  new Matrix4().compose(new Vector3(2, -3, -50), q, new Vector3(size, size, size)).elements

describe('faceRotation', () => {
  it('열 우선 행렬에서 회전만 꺼낸다. 크기와 위치는 버린다', () => {
    const q = turn(0.4, -0.2, 0.1)
    expect(deg(faceRotation(matrix(q))?.angleTo(q) ?? 99)).toBeLessThan(0.01)
    expect(deg(faceRotation(matrix(q, 1.7))?.angleTo(q) ?? 99)).toBeLessThan(0.01)
  })

  it('행 우선으로 와도 알아보고 같은 회전을 꺼낸다', () => {
    const q = turn(0.4, -0.2, 0.1)
    const rowMajor = new Matrix4().fromArray(matrix(q)).transpose().elements
    expect(deg(faceRotation(rowMajor)?.angleTo(q) ?? 99)).toBeLessThan(0.01)
  })

  it('16개가 아니면 버린다', () => {
    expect(faceRotation([1, 0, 0])).toBeNull()
    expect(faceRotation(undefined)).toBeNull()
  })
})

// 눈꺼풀·입술 점만 채운 478점 (0~1 화면 좌표)
const facePoints = ({ leftEye = 0.3, rightEye = 0.3, mouth = 0.02, swap = false } = {}) => {
  const points: Vec3[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const eye = (ids: [number, number, number, number], cx: number, ratio: number) => {
    const [outer, inner, upper, lower] = ids
    const w = 0.06
    points[outer] = { x: cx - w / 2, y: 0.4, z: 0 }
    points[inner] = { x: cx + w / 2, y: 0.4, z: 0 }
    points[upper] = { x: cx, y: 0.4 - (w * ratio) / 2, z: 0 }
    points[lower] = { x: cx, y: 0.4 + (w * ratio) / 2, z: 0 }
  }
  // 33번 쪽 눈을 화면 왼쪽에, 263번 쪽 눈을 오른쪽에 둔다. swap이면 반대로 둔다
  eye([33, 133, 159, 145], swap ? 0.6 : 0.4, leftEye)
  eye([263, 362, 386, 374], swap ? 0.4 : 0.6, rightEye)
  points[61] = { x: 0.45, y: 0.6, z: 0 }
  points[291] = { x: 0.55, y: 0.6, z: 0 }
  points[13] = { x: 0.5, y: 0.6 - mouth / 2, z: 0 }
  points[14] = { x: 0.5, y: 0.6 + mouth / 2, z: 0 }
  return points
}

describe('faceOpenness', () => {
  it('눈꺼풀 사이 ÷ 눈 너비, 입술 사이 ÷ 입 너비를 잰다', () => {
    const open = faceOpenness(facePoints({ leftEye: 0.3, rightEye: 0.1, mouth: 0.02 }), 1)
    expect(open?.eyeRatio[0]).toBeCloseTo(0.3)
    expect(open?.eyeRatio[1]).toBeCloseTo(0.1)
    expect(open?.mouthRatio).toBeCloseTo(0.2)
  })

  it('어느 눈이 먼저인지는 번호가 아니라 화면 위치로 정한다', () => {
    const open = faceOpenness(facePoints({ leftEye: 0.3, rightEye: 0.1, swap: true }), 1)
    expect(open?.eyeRatio[0]).toBeCloseTo(0.1)
    expect(open?.eyeRatio[1]).toBeCloseTo(0.3)
  })

  it('가로세로 비율을 맞춰 잰다', () => {
    // 가로가 4/3배 길면 눈 너비도 4/3배라 비율은 3/4배가 된다
    const open = faceOpenness(facePoints({ leftEye: 0.3 }), 4 / 3)
    expect(open?.eyeRatio[0]).toBeCloseTo(0.3 * 0.75)
  })

  it('얼굴이 없거나 행렬이 없으면 읽지 않는다', () => {
    expect(readFace({ faceLandmarks: [] }, 1)).toBeNull()
    expect(
      readFace({ faceLandmarks: [facePoints()], facialTransformationMatrixes: [] }, 1),
    ).toBeNull()
    const read = readFace(
      {
        faceLandmarks: [facePoints()],
        facialTransformationMatrixes: [{ data: matrix(turn(0.2)) }],
      },
      1,
    )
    expect(read?.eyeRatio[0]).toBeCloseTo(0.3)
  })
})

const raw = (rotation: Quaternion, eyes: [number, number] = [0.3, 0.3], mouth = 0.02): FaceRaw => ({
  rotation,
  eyeRatio: eyes,
  mouthRatio: mouth,
})

// 30fps로 ms 동안 같은 얼굴을 넣고 마지막 상태를 돌려준다
const feed = (
  track: ReturnType<typeof createFaceTracker>,
  face: FaceRaw,
  from: number,
  ms: number,
) => {
  let state = null
  for (let t = from; t <= from + ms; t += 1000 / 30) state = track(face, t)
  return state
}

describe('createFaceTracker', () => {
  it('처음 2초 동안의 방향을 정면으로 삼는다. 카메라가 위에 있어 늘 숙여 보여도 정면이 된다', () => {
    const track = createFaceTracker()
    const down = turn(0.15, 0.6, 0.05) // 35° 숙이고 조금 돈 채로 화면을 본다
    const state = feed(track, raw(down), 0, NEUTRAL_MS)
    expect(deg(state?.turn.angleTo(new Quaternion()) ?? 99)).toBeLessThan(0.5)
  })

  it('정면 기준에서 돌린 만큼만 돈다', () => {
    const track = createFaceTracker()
    const base = turn(0.15, 0.6, 0.05)
    feed(track, raw(base), 0, NEUTRAL_MS)
    const left = turn(0.35, 0, 0)
    const state = feed(track, raw(left.clone().multiply(base)), NEUTRAL_MS + 100, 600)
    expect(deg(state?.turn.angleTo(left) ?? 99)).toBeLessThan(0.5)
  })

  it('2초가 지나면 정면 기준은 바뀌지 않는다', () => {
    const track = createFaceTracker()
    feed(track, raw(new Quaternion()), 0, NEUTRAL_MS)
    const later = turn(0.5, 0, 0)
    const state = feed(track, raw(later), NEUTRAL_MS + 100, 3000)
    expect(deg(state?.turn.angleTo(later) ?? 99)).toBeLessThan(0.5)
  })

  it('갑자기 돌려도 한 프레임에 다 따라가지 않고 부드럽게 따라간다', () => {
    const track = createFaceTracker()
    feed(track, raw(new Quaternion()), 0, NEUTRAL_MS)
    const step = turn(0.5, 0, 0)
    const first = track(raw(step), NEUTRAL_MS + 1000 / 30 + 1)
    const angle = deg(first?.turn.angleTo(step) ?? 0)
    expect(angle).toBeGreaterThan(5)
    expect(angle).toBeLessThan(deg(0.5))
  })

  it('얼굴을 놓쳤다가 다시 찾으면 바로 맞춘다', () => {
    const track = createFaceTracker()
    feed(track, raw(new Quaternion()), 0, NEUTRAL_MS)
    expect(track(null, NEUTRAL_MS + 100)).toBeNull()
    const back = turn(-0.4, 0, 0)
    expect(deg(track(raw(back), NEUTRAL_MS + 200)?.turn.angleTo(back) ?? 99)).toBeLessThan(0.01)
  })

  it('눈은 처음 2초의 뜬 정도를 평소로 보고, 입은 벌린 만큼 0~1이다', () => {
    const track = createFaceTracker()
    feed(track, raw(new Quaternion(), [0.3, 0.3]), 0, NEUTRAL_MS)
    const blink = track(raw(new Quaternion(), [0.03, 0.3], 0.255), NEUTRAL_MS + 100)
    expect(blink?.eyes[0]).toBeCloseTo(0.1)
    expect(blink?.eyes[1]).toBeCloseTo(1)
    expect(blink?.mouth).toBeCloseTo(0.5)
    expect(track(raw(new Quaternion(), [0.3, 0.3], 0.01), NEUTRAL_MS + 200)?.mouth).toBe(0)
  })
})
