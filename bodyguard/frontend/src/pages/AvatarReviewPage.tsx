import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Component,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router'
import { type Bone, Quaternion, type SkinnedMesh, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

// FR-A-02~04: artist-authored GLBs; no primitive human, camera, user data or coaching clip.
const models = {
  male: new URL('../avatar/models/bodyguard-male-candidate.glb', import.meta.url).href,
  female: new URL('../avatar/models/bodyguard-female-candidate.glb', import.meta.url).href,
}

type Report = {
  samples: number
  mean_ms: number
  p95_ms: number
  draw_calls: number
  triangles: number
  renderer: string
  skeletons_independent: boolean
  static_angle_max: number
  moving_angle_max: number
}

class ReviewBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="development-note">
        <p role="alert">
          3D 모델을 열지 못했습니다. 연결과 브라우저의 그래픽 지원을 확인해 주세요.
        </p>
        <button className="button secondary" type="button" onClick={this.props.retry}>
          다시 불러오기
        </button>
      </div>
    ) : (
      this.props.children
    )
  }
}

function Pair({
  url,
  moving,
  ready,
  lost,
  report,
}: {
  url: string
  moving: boolean
  ready: () => void
  lost: () => void
  report: (value: Report) => void
}) {
  const { scene } = useGLTF(url)
  const { gl } = useThree()
  // SkeletonUtils clones bones as well as objects. Geometry/materials remain read-only shared assets.
  const pair = useMemo(() => {
    const copies = [clone(scene), clone(scene)]
    const bones = copies.map((model) => {
      model.updateMatrixWorld(true)
      const bone = model.getObjectByName('upperarm01L') as Bone | undefined
      if (!bone?.isBone) throw new Error('검수할 어깨 뼈가 없는 모델입니다')
      return {
        bone,
        rest: bone.quaternion.clone(),
        axis: new Vector3(0, 0, 1).applyQuaternion(
          bone.getWorldQuaternion(new Quaternion()).invert(),
        ),
      }
    })
    const skeletons = copies.map((model) => {
      const values = new Set<Bone>()
      model.traverse((node) => {
        if ((node as SkinnedMesh).isSkinnedMesh)
          for (const bone of (node as SkinnedMesh).skeleton.bones) values.add(bone)
      })
      return values
    })
    if (
      skeletons.some((values) => values.size === 0) ||
      [...skeletons[0]].some((bone) => skeletons[1].has(bone))
    )
      throw new Error('두 아바타의 뼈대가 독립적이지 않습니다')
    return { copies, bones }
  }, [scene])
  const samples = useRef<number[]>([])
  const warmup = useRef(0)
  const time = useRef(0)
  const maximum = useRef([0, 0])
  const rotation = useMemo(() => new Quaternion(), [])
  useEffect(ready, [ready])
  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      lost()
    }
    canvas.addEventListener('webglcontextlost', handleLost)
    return () => canvas.removeEventListener('webglcontextlost', handleLost)
  }, [gl, lost])
  useFrame((_, delta) => {
    if (document.visibilityState !== 'visible') return
    time.current += Math.min(delta, 0.05)
    const angle = moving ? ((1 - Math.cos((time.current * Math.PI) / 2)) * Math.PI) / 30 : 0
    const target = pair.bones[1]
    target.bone.quaternion.copy(target.rest).multiply(rotation.setFromAxisAngle(target.axis, angle))
    pair.bones.forEach(({ bone, rest }, index) => {
      maximum.current[index] = Math.max(maximum.current[index], bone.quaternion.angleTo(rest))
    })
    if (warmup.current++ < 30 || samples.current.length >= 180) return
    samples.current.push(delta * 1000)
    if (samples.current.length === 180) {
      const sorted = [...samples.current].sort((a, b) => a - b)
      const context = gl.getContext()
      report({
        samples: sorted.length,
        mean_ms: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
        p95_ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        draw_calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        renderer: String(context.getParameter(context.RENDERER)),
        skeletons_independent: true,
        static_angle_max: maximum.current[0],
        moving_angle_max: maximum.current[1],
      })
    }
  })
  return (
    <>
      <primitive object={pair.copies[0]} position={[-0.82, 0, 0]} dispose={null} />
      <primitive object={pair.copies[1]} position={[0.82, 0, 0]} dispose={null} />
      <ContactShadows
        frames={1}
        position={[0, -0.01, 0]}
        opacity={0.2}
        scale={4}
        blur={2}
        far={1.5}
        resolution={256}
      />
    </>
  )
}

export function AvatarReviewPage() {
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [moving, setMoving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [contextLost, setContextLost] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const ready = useCallback(() => setLoaded(true), [])
  const lost = useCallback(() => setContextLost(true), [])
  const retry = () => {
    useGLTF.clear(models[gender])
    setLoaded(false)
    setContextLost(false)
    setReport(null)
    setAttempt((value) => value + 1)
  }
  const select = (value: 'male' | 'female') => {
    if (value === gender) return
    setLoaded(false)
    setReport(null)
    setContextLost(false)
    setGender(value)
  }
  return (
    <div className="website">
      <main className="avatar-review">
        <Link className="nav-link" to="/">
          서비스로 돌아가기
        </Link>
        <p className="eyebrow">DEVELOPMENT · AVATAR REVIEW</p>
        <h1>두 아바타 기술 검수</h1>
        <p className="muted">
          외형·웹 변형 검수 중인 후보입니다. 운동 정답이나 실제 웹캠 코칭 시험이 아닙니다. 카메라는
          켜지지 않습니다.
        </p>
        <fieldset className="avatar-controls" aria-label="아바타 검수 설정">
          <button
            className="button secondary"
            type="button"
            aria-pressed={gender === 'male'}
            onClick={() => select('male')}
          >
            남성
          </button>
          <button
            className="button secondary"
            type="button"
            aria-pressed={gender === 'female'}
            onClick={() => select('female')}
          >
            여성
          </button>
          <button
            className="button primary"
            type="button"
            aria-pressed={moving}
            onClick={() => {
              setReport(null)
              setMoving((value) => !value)
            }}
          >
            기술 변형 {moving ? '멈추기' : '시작'}
          </button>
        </fieldset>
        <ReviewBoundary key={`${gender}/${attempt}`} retry={retry}>
          {contextLost ? (
            <div className="development-note">
              <p role="alert">그래픽 연결이 끊겼습니다. 모델을 다시 열어 주세요.</p>
              <button className="button secondary" type="button" onClick={retry}>
                다시 불러오기
              </button>
            </div>
          ) : (
            <>
              <p role="status" aria-label="모델 연결 상태">
                {loaded ? '동일한 모델 · 독립된 두 뼈대' : '3D 모델을 불러오는 중입니다'}
              </p>
              <figure
                className="avatar-stage"
                aria-label={`${gender === 'male' ? '남성' : '여성'} 아바타 두 모델`}
              >
                <div className="avatar-labels" aria-hidden="true">
                  <span>모델 A · 중립</span>
                  <span>모델 B · 기술 변형</span>
                </div>
                <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.84, 3.4], fov: 35 }}>
                  <color attach="background" args={['#eeefeb']} />
                  <hemisphereLight args={['#ffffff', '#69675f', 1.4]} />
                  <directionalLight position={[-2, 3, 3]} intensity={2.2} />
                  <directionalLight position={[2, 2, -1]} intensity={0.8} />
                  <Suspense fallback={null}>
                    <Pair
                      key={String(moving)}
                      url={models[gender]}
                      moving={moving}
                      ready={ready}
                      lost={lost}
                      report={setReport}
                    />
                  </Suspense>
                  <OrbitControls
                    makeDefault
                    enablePan={false}
                    minDistance={2}
                    maxDistance={6}
                    target={[0, 0.8, 0]}
                  />
                </Canvas>
              </figure>
            </>
          )}
        </ReviewBoundary>
        <output
          className="small muted"
          data-testid="avatar-report"
          data-report={report ? JSON.stringify(report) : ''}
        >
          {report
            ? `180 프레임 · 평균 ${report.mean_ms.toFixed(1)}ms · p95 ${report.p95_ms.toFixed(1)}ms · ${report.triangles.toLocaleString()} triangles`
            : '모델 로딩 후 프레임 간격을 측정합니다.'}
        </output>
        <p className="small muted">
          드래그로 회전 · 스크롤로 확대. 합성 기술 변형의 렌더링 간격이며 사람 움직임 지연이나 판정
          정확도 측정이 아닙니다.
        </p>
      </main>
    </div>
  )
}
