import { Euler, Quaternion } from 'three'
import { describe, expect, it } from 'vitest'
import {
  eyeLid,
  eyeOpen,
  FACE,
  FRONT,
  facesViewer,
  HEAD_LIFT,
  HEAD_SCALE,
  headPose,
  mouthRadiusY,
  onHead,
  turnAxes,
  type Vec3,
} from './face'

const ALL = Array.from({ length: 33 }, () => true)

// 코와 양 귀만 채운 몸 관절(오른손 좌표계, 미터). 귀 중점이 원점이다
const body = (): Vec3[] =>
  Array.from({ length: 33 }, (_, i) => {
    if (i === 0) return { x: 0, y: -0.01, z: 0.1 }
    if (i === 7) return { x: -0.075, y: 0, z: 0 }
    if (i === 8) return { x: 0.075, y: 0, z: 0 }
    return { x: 0, y: -0.3, z: 0 }
  })

// 카메라 기준 회전. yaw는 y축, pitch는 x축, roll은 z축(라디안)
const turn = (yaw = 0, pitch = 0, roll = 0) =>
  new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, 'YXZ'))

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const expectVec = (v: Vec3 | undefined, want: Vec3) => {
  expect(v?.x).toBeCloseTo(want.x)
  expect(v?.y).toBeCloseTo(want.y)
  expect(v?.z).toBeCloseTo(want.z)
}

describe('headPose', () => {
  it('코나 귀 하나라도 믿을 수 없으면 머리를 그리지 않는다', () => {
    for (const i of [0, 7, 8]) {
      expect(
        headPose(
          body(),
          ALL.map((_, k) => k !== i),
        ),
      ).toBeNull()
    }
    expect(headPose(null, ALL)).toBeNull()
  })

  it('눈과 입꼬리는 없어도 된다. 방향은 얼굴 모델이 정한다', () => {
    const trusted = ALL.map((_, k) => ![2, 5, 9, 10].includes(k))
    expect(headPose(body(), trusted)).not.toBeNull()
  })

  it('반지름은 귀 사이 거리에 비례하고, 중심은 머리 위쪽으로 조금 올라간다', () => {
    const head = headPose(body(), ALL)
    expect(head?.radius).toBeCloseTo(0.15 * HEAD_SCALE)
    expectVec(head?.center, { x: 0, y: 0.15 * HEAD_SCALE * HEAD_LIFT, z: 0 })
  })

  it('방향을 주지 않으면 정면을 보고, 주면 그 방향의 위쪽으로 올린다', () => {
    expectVec(headPose(body(), ALL)?.forward, FRONT.forward)
    const tilted = turnAxes(turn(0, 0, 0.4), false)
    const head = headPose(body(), ALL, tilted)
    const lift = 0.15 * HEAD_SCALE * HEAD_LIFT
    expectVec(head?.center, { x: tilted.up.x * lift, y: tilted.up.y * lift, z: tilted.up.z * lift })
  })
})

describe('turnAxes', () => {
  it('회전이 없으면 정면이다', () => {
    expect(turnAxes(null, false)).toEqual(FRONT)
    for (const mirrored of [false, true]) {
      const axes = turnAxes(new Quaternion(), mirrored)
      expectVec(axes.right, FRONT.right)
      expectVec(axes.up, FRONT.up)
      expectVec(axes.forward, FRONT.forward)
    }
  })

  it('거울 화면에서는 좌우 돌림과 기울임만 반대가 되고 끄덕임은 그대로다', () => {
    const plain = turnAxes(turn(0.5, 0, 0), false)
    const mirror = turnAxes(turn(0.5, 0, 0), true)
    expect(plain.forward.x).toBeCloseTo(Math.sin(0.5))
    expect(mirror.forward.x).toBeCloseTo(-Math.sin(0.5))

    const tilt = turnAxes(turn(0, 0, 0.3), false)
    const tiltMirror = turnAxes(turn(0, 0, 0.3), true)
    expect(tiltMirror.up.x).toBeCloseTo(-tilt.up.x)

    const nod = turnAxes(turn(0, 0.4, 0), false)
    const nodMirror = turnAxes(turn(0, 0.4, 0), true)
    expect(nod.forward.y).toBeLessThan(0) // x축 양의 회전은 아래를 본다
    expect(nodMirror.forward.y).toBeCloseTo(nod.forward.y)
  })

  it('어느 쪽이든 서로 수직인 단위 벡터이고 오른손 좌표계다', () => {
    for (const mirrored of [false, true]) {
      const { right, up, forward } = turnAxes(turn(0.4, -0.3, 0.2), mirrored)
      expect(dot(right, right)).toBeCloseTo(1)
      expect(dot(up, up)).toBeCloseTo(1)
      expect(dot(forward, forward)).toBeCloseTo(1)
      expect(dot(right, up)).toBeCloseTo(0)
      expect(dot(up, forward)).toBeCloseTo(0)
      expectVec(cross(right, up), forward)
    }
  })

  it('옆으로 거의 다 돌리면 먼 쪽 눈은 뒤로 넘어가 그리지 않는다', () => {
    const head = headPose(body(), ALL, turnAxes(turn(1.4, 0, 0), false))
    if (!head) throw new Error('머리를 못 구했다')
    const [left, right] = FACE.eyes
    // 원본 기준으로 +x 쪽으로 돌렸으니 +x 쪽 눈이 뒤로 넘어간다
    expect(facesViewer(head, left.x, left.y)).toBe(true)
    expect(facesViewer(head, right.x, right.y)).toBe(false)
  })

  it('정면 좌표 (0, 0)은 머리 앞면 한가운데다', () => {
    const head = headPose(body(), ALL, turnAxes(turn(0.3, 0.2, 0), false))
    if (!head) throw new Error('머리를 못 구했다')
    const { center, forward, radius } = head
    expectVec(onHead(head, 0, 0), {
      x: center.x + forward.x * radius,
      y: center.y + forward.y * radius,
      z: center.z + forward.z * radius,
    })
  })
})

describe('눈과 입', () => {
  it('3D처럼 좌우를 뒤집은 화면에서는 반대쪽 눈을 쓴다', () => {
    const face = { eyes: [0.2, 0.9] as const }
    expect(eyeOpen(face, 0, false)).toBe(0.2)
    expect(eyeOpen(face, 0, true)).toBe(0.9)
    expect(eyeOpen(null, 0, true)).toBe(1)
  })

  it('눈을 감으면 가는 선만 남고, 평소만큼 뜨면 원래 크기다', () => {
    expect(eyeLid(0)).toBeCloseTo(0.12)
    expect(eyeLid(1)).toBeCloseTo(1)
    expect(eyeLid(0.5)).toBeGreaterThan(eyeLid(0.4))
  })

  it('입을 벌린 만큼 벌린 입의 세로가 커진다', () => {
    expect(mouthRadiusY(0)).toBeCloseTo(FACE.mouth.ry[0])
    expect(mouthRadiusY(1)).toBeCloseTo(FACE.mouth.ry[1])
    expect(mouthRadiusY(2)).toBeCloseTo(FACE.mouth.ry[1])
  })
})
