import {
  Grid,
  Instance,
  Instances,
  OrbitControls,
  type PositionMesh,
  Segment,
  Segments,
} from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { type ComponentRef, type RefObject, useRef } from 'react'
import { type Group, Matrix4, type Mesh, Quaternion, Vector3 } from 'three'
import type { LatestPose } from '../pose/useMeasurement'
import {
  attachHandToBody,
  BODY_WRIST,
  HAND_BONES,
  HAND_POINT_COUNT,
  trustedHandPoints,
} from '../posture/hands'
import { JOINT_COUNT, type Point, trustedJoints } from '../posture/landmarks'
import {
  eyeLid,
  eyeOpen,
  FACE,
  FACE_COLORS,
  FACE_POINTS,
  headPose,
  MOUTH_OPEN_MIN,
  mouthRadiusY,
  turnAxes,
} from './face'
import { ROUGH_HAND_POINTS, SEGMENT_COUNT, skeletonSegments, withoutRoughHands } from './skeleton'

type SegmentRef = ComponentRef<typeof Segment>
// drei의 Instance는 ref 타입을 비워 두고 내보내서 실제 타입(PositionMesh)을 직접 적는다
type JointRef = PositionMesh

// 판정 색(FR-A-01)은 판정 엔진(tasks #7)이 생기면 부위별로 칠한다. 지금은 한 색이다
const NEUTRAL = '#e2e8f0'
// 믿을 수 없는 관절과 그 선분은 화면 밖으로 치운다
const HIDDEN: [number, number, number] = [0, -100, 0]

// 손은 최대 두 개 (원문 53·54)
const HAND_SLOTS = 2
const HAND_SEGMENTS = HAND_SLOTS * HAND_BONES.length
const HAND_JOINTS = HAND_SLOTS * HAND_POINT_COUNT

// MediaPipe 월드 좌표(엉덩이 중심, 미터, y가 아래) → Three.js(y가 위). 웹캠 화면처럼 좌우를 뒤집는다
const toScene = (p: Point): [number, number, number] => [-p.x, -p.y, -p.z]

// 머리 표면 한 점에 붙일 부품의 자리와 방향(반지름 1 기준). 부품의 z축이 표면 바깥을 향한다 (원문 55)
const OUTWARD = new Vector3(0, 0, 1)
function surface(x: number, y: number, lift = 1) {
  const normal = new Vector3(x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y)))
  return {
    position: normal.clone().multiplyScalar(lift),
    quaternion: new Quaternion().setFromUnitVectors(OUTWARD, normal),
  }
}
const EYES = FACE.eyes.map(({ x, y }) => ({ x, ...surface(x, y) }))
const CHEEKS = FACE.cheeks.map(({ x, y }) => ({ x, ...surface(x, y, 1.01) }))
const SMILE = surface(0, FACE.smile.y, 1.01)
const MOUTH = surface(0, FACE.mouth.y)

// 매 프레임 머리 방향을 계산할 때 다시 쓰는 객체
const headAxes = [new Vector3(), new Vector3(), new Vector3()] as const
const headBasis = new Matrix4()
const headTurn = new Quaternion()

// FR-A-01 내 몸을 따라 움직이는 스켈레톤. 좌표는 그리는 데만 쓰고 버린다
function Body({ poseRef }: { poseRef: RefObject<LatestPose> }) {
  const segments = useRef<(SegmentRef | null)[]>([])
  const joints = useRef<(JointRef | null)[]>([])
  const handSegments = useRef<(SegmentRef | null)[]>([])
  const handJoints = useRef<(JointRef | null)[]>([])
  const head = useRef<Group>(null)
  const eyes = useRef<(Group | null)[]>([])
  const shines = useRef<(Mesh | null)[]>([])
  const smile = useRef<Group>(null)
  const mouth = useRef<Mesh>(null)

  useFrame((_, delta) => {
    const { image, world, hands, face } = poseRef.current
    // 3D에는 화면 경계가 없어서, 화면 밖 관절은 같은 프레임의 화면 좌표로 걸러 낸다
    const trusted = trustedJoints(image)
    const sides = hands.flatMap((h) => (h.side ? [h.side] : []))
    const noDot = new Set([...FACE_POINTS, ...sides.flatMap((side) => ROUGH_HAND_POINTS[side])])

    withoutRoughHands(skeletonSegments(world, trusted), sides).forEach((segment, i) => {
      const line = segments.current[i]
      if (!line) return
      line.start.set(...(segment ? toScene(segment.a) : HIDDEN))
      line.end.set(...(segment ? toScene(segment.b) : HIDDEN))
    })
    for (let i = 0; i < JOINT_COUNT; i++) {
      const joint = joints.current[i]
      if (!joint) continue
      const p = world?.[i]
      const shown = p !== undefined && trusted[i] && !noDot.has(i)
      // 크기를 0으로 줄여 숨기면 Three.js가 크기를 1로 되돌려(decompose) 마지막 자리에 남는다. 화면 밖으로 치운다
      joint.position.set(...(shown ? toScene(p) : HIDDEN))
    }

    // 손가락: 손의 손목을 몸의 손목 위치에 맞춰 붙인다 (posture/hands attachHandToBody)
    for (let k = 0; k < HAND_SLOTS; k++) {
      const hand = hands[k]
      const wrist = hand?.side && world ? world[BODY_WRIST[hand.side]] : undefined
      const attached = hand && wrist ? attachHandToBody(hand.world, wrist) : null
      const handTrusted = hand ? trustedHandPoints(hand.image) : null
      HAND_BONES.forEach(([a, b], j) => {
        const line = handSegments.current[k * HAND_BONES.length + j]
        if (!line) return
        const pa = attached?.[a]
        const pb = attached?.[b]
        if (pa && pb && handTrusted?.[a] && handTrusted?.[b]) {
          line.start.set(...toScene(pa))
          line.end.set(...toScene(pb))
        } else {
          line.start.set(...HIDDEN)
          line.end.set(...HIDDEN)
        }
      })
      for (let i = 0; i < HAND_POINT_COUNT; i++) {
        const joint = handJoints.current[k * HAND_POINT_COUNT + i]
        if (!joint) continue
        const p = attached?.[i]
        joint.position.set(...(p && handTrusted?.[i] ? toScene(p) : HIDDEN))
      }
    }

    // 둥근 머리: 귀로 구한 자리에 얼굴 모델의 방향으로 머리 묶음을 놓는다 (원문 55·57, face.ts).
    // 3D 화면은 좌우를 뒤집어 그리므로 방향과 눈도 뒤집는다
    const headGroup = head.current
    if (headGroup) {
      const scenePoints = world?.map((p) => {
        const [x, y, z] = toScene(p)
        return { x, y, z }
      })
      const now = headPose(scenePoints, trusted, turnAxes(face?.turn, true))
      if (now) {
        const [right, up, forward] = headAxes
        right.set(now.right.x, now.right.y, now.right.z)
        up.set(now.up.x, now.up.y, now.up.z)
        forward.set(now.forward.x, now.forward.y, now.forward.z)
        headTurn.setFromRotationMatrix(headBasis.makeBasis(right, up, forward))
        // 추론 사이 화면 프레임을 이어 주려고 방향을 살짝 늦게 따라간다(약 0.05초). 처음 나타날 때는 바로 맞춘다
        if (headGroup.visible) headGroup.quaternion.slerp(headTurn, 1 - Math.exp(-delta * 20))
        else headGroup.quaternion.copy(headTurn)
        headGroup.position.set(now.center.x, now.center.y, now.center.z)
        headGroup.scale.setScalar(now.radius)
      }
      headGroup.visible = now !== null

      // 눈 깜빡임과 입 벌림
      FACE.eyes.forEach((_, i) => {
        const lid = eyeLid(eyeOpen(face, i, true))
        eyes.current[i]?.scale.set(1, lid, 1)
        const shine = shines.current[i]
        if (shine) shine.visible = lid >= 0.5
      })
      const opened = face?.mouth ?? 0
      if (smile.current) smile.current.visible = opened < MOUTH_OPEN_MIN
      if (mouth.current) {
        mouth.current.visible = opened >= MOUTH_OPEN_MIN
        mouth.current.scale.y = mouthRadiusY(opened)
      }
    }
  })

  return (
    <>
      <Segments limit={SEGMENT_COUNT} lineWidth={4}>
        {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
          <Segment
            // biome-ignore lint/suspicious/noArrayIndexKey: 선분 자리는 BONES 순서로 고정이다
            key={i}
            ref={(el) => {
              segments.current[i] = el
            }}
            start={HIDDEN}
            end={HIDDEN}
            color={NEUTRAL}
          />
        ))}
      </Segments>
      <Instances limit={JOINT_COUNT}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color={NEUTRAL} />
        {Array.from({ length: JOINT_COUNT }, (_, i) => (
          <Instance
            // biome-ignore lint/suspicious/noArrayIndexKey: 관절 자리는 MediaPipe 번호로 고정이다
            key={i}
            ref={(el) => {
              joints.current[i] = el as JointRef | null
            }}
            position={HIDDEN}
          />
        ))}
      </Instances>
      <Segments limit={HAND_SEGMENTS} lineWidth={2}>
        {Array.from({ length: HAND_SEGMENTS }, (_, i) => (
          <Segment
            // biome-ignore lint/suspicious/noArrayIndexKey: 손 선분 자리는 손 번호 × HAND_BONES 순서로 고정이다
            key={i}
            ref={(el) => {
              handSegments.current[i] = el
            }}
            start={HIDDEN}
            end={HIDDEN}
            color={NEUTRAL}
          />
        ))}
      </Segments>
      <Instances limit={HAND_JOINTS}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color={NEUTRAL} />
        {Array.from({ length: HAND_JOINTS }, (_, i) => (
          <Instance
            // biome-ignore lint/suspicious/noArrayIndexKey: 손 관절 자리는 손 번호 × 21점으로 고정이다
            key={i}
            ref={(el) => {
              handJoints.current[i] = el as JointRef | null
            }}
            position={HIDDEN}
          />
        ))}
      </Instances>
      <group ref={head} visible={false}>
        <mesh>
          <sphereGeometry args={[1, 48, 32]} />
          <meshToonMaterial color={FACE_COLORS.skin} toneMapped={false} />
        </mesh>
        {EYES.map((eye, i) => (
          <group key={eye.x} position={eye.position} quaternion={eye.quaternion}>
            <group
              ref={(el) => {
                eyes.current[i] = el
              }}
            >
              <mesh scale={[FACE.eyeRadius.x, FACE.eyeRadius.y, 0.04]}>
                <sphereGeometry args={[1, 24, 16]} />
                <meshBasicMaterial color={FACE_COLORS.ink} toneMapped={false} />
              </mesh>
              <mesh
                ref={(el) => {
                  shines.current[i] = el
                }}
                position={[Math.sign(eye.x) * FACE.shine.dx, FACE.shine.dy, 0.036]}
                scale={[FACE.shine.r, FACE.shine.r, FACE.shine.r * 0.4]}
              >
                <sphereGeometry args={[1, 12, 8]} />
                <meshBasicMaterial color={FACE_COLORS.shine} toneMapped={false} />
              </mesh>
            </group>
          </group>
        ))}
        {CHEEKS.map((cheek) => (
          <mesh
            key={cheek.x}
            position={cheek.position}
            quaternion={cheek.quaternion}
            scale={[FACE.cheekRadius.x, FACE.cheekRadius.y, 1]}
          >
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color={FACE_COLORS.cheek} toneMapped={false} />
          </mesh>
        ))}
        {/* 웃는 입: 원호의 가장 낮은 점이 표면에 닿도록 원 중심을 반지름만큼 올린다 */}
        <group ref={smile} position={SMILE.position} quaternion={SMILE.quaternion}>
          <mesh
            position={[0, FACE.smile.radius, 0]}
            rotation={[0, 0, -Math.PI / 2 - FACE.smile.arc / 2]}
          >
            <torusGeometry
              args={[FACE.smile.radius, FACE.smile.width / 2, 8, 32, FACE.smile.arc]}
            />
            <meshBasicMaterial color={FACE_COLORS.ink} toneMapped={false} />
          </mesh>
        </group>
        {/* 벌린 입: 세로 크기는 입 벌린 정도에 따라 매 프레임 바꾼다 */}
        <mesh
          ref={mouth}
          visible={false}
          position={MOUTH.position}
          quaternion={MOUTH.quaternion}
          scale={[FACE.mouth.rx, FACE.mouth.ry[0], 0.03]}
        >
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color={FACE_COLORS.ink} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}

export function Skeleton3D({ poseRef }: { poseRef: RefObject<LatestPose> }) {
  return (
    <Canvas camera={{ position: [0, 0.3, 2.2], fov: 45 }} dpr={[1, 2]}>
      {/* 둥근 머리의 명암용. 선과 관절은 조명을 받지 않는다. 얼굴 재질은 톤 매핑을 꺼서 2D와 같은 색으로 보인다 */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[1, 2, 3]} intensity={1.5} />
      <Body poseRef={poseRef} />
      <Grid
        args={[4, 4]}
        position={[0, -0.9, 0]}
        cellColor="#334155"
        sectionColor="#475569"
        fadeDistance={8}
        infiniteGrid
      />
      <OrbitControls target={[0, 0.3, 0]} />
    </Canvas>
  )
}
