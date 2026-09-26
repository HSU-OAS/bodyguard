import type { Landmark, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { createFaceTracker, type FaceState, readFace } from '../avatar/faceTracking'
import { createHintStabilizer, type FramingMode, framingHint } from '../posture/framing'
import { gestureLabel, matchHandToBody, type Side } from '../posture/hands'
import { headShoulderConfidence, trustedJoints } from '../posture/landmarks'
import { type CameraErrorKind, cameraErrorKind, closeCamera, openCamera } from './camera'
import {
  DEFAULT_FACE_ENABLED,
  DEFAULT_FRAMING_MODE,
  DEFAULT_HANDS_ENABLED,
  DEFAULT_INFERENCE_FPS,
  DEFAULT_POSE_MODEL,
  type InferenceFpsLimit,
  type PoseModel,
} from './constants'
import { createFaceLandmarker, type LoadedFaceLandmarker } from './face'
import { createGestureRecognizer, type LoadedGestureRecognizer } from './hands'
import { createPoseLandmarker, type Delegate, type LoadedLandmarker } from './landmarker'

/** 손 하나. 손가락 21점과 제스처 (원문 53·54) */
export type HandPose = {
  image: NormalizedLandmark[]
  world: Landmark[]
  /** 몸 손목에 맞춘 쪽. 맞출 몸 손목이 없으면 null */
  side: Side | null
  /** 우리말 제스처 이름(엄지척 등). 없으면 null */
  gesture: string | null
}

/** 가장 최근 프레임의 관절. 그리는 데만 쓰고 매 프레임 덮어쓴다. 저장하지 않는다 (FR-M-02) */
export type LatestPose = {
  image: NormalizedLandmark[] | null
  world: Landmark[] | null
  hands: HandPose[]
  /** 둥근 머리의 방향과 눈·입 (원문 57). 얼굴 인식을 끄거나 얼굴을 못 찾으면 null */
  face: FaceState | null
}
export type MeasureStatus = 'idle' | 'starting' | 'running' | 'error'
export type MeasureError = CameraErrorKind | 'model'
export type MeasureStats = {
  fps: number
  inferenceMs: number
  /** 손가락 추론 1회 시간. 손가락 인식을 끄거나 모델이 없으면 null */
  handMs: number | null
  /** 얼굴 추론 1회 시간. 얼굴 인식을 끄거나 모델이 없으면 null */
  faceMs: number | null
  detected: boolean
  /** 머리·어깨 인식 확실도(0~1) */
  confidence: number | null
  delegate: Delegate | null
  /** 자세를 유도하는 안내 문구 (FR-M-07). 없으면 null */
  hint: string | null
  /** 인식한 손 제스처 요약(예: 왼손 엄지척). 없으면 null */
  gesture: string | null
}

const EMPTY_POSE: LatestPose = { image: null, world: null, hands: [], face: null }
const EMPTY_STATS: MeasureStats = {
  fps: 0,
  inferenceMs: 0,
  handMs: null,
  faceMs: null,
  detected: false,
  confidence: null,
  delegate: null,
  hint: null,
  gesture: null,
}
const STATS_INTERVAL_MS = 500
const SIDE_LABEL: Record<Side, string> = { left: '왼손', right: '오른손' }

const gestureSummary = (hands: readonly HandPose[]): string | null => {
  const parts = hands
    .filter((h) => h.gesture)
    .map((h) => `${h.side ? SIDE_LABEL[h.side] : '손'} ${h.gesture}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export function useMeasurement(
  videoRef: RefObject<HTMLVideoElement | null>,
  onFrame: (pose: LatestPose) => void,
) {
  const [status, setStatus] = useState<MeasureStatus>('idle')
  const [error, setError] = useState<MeasureError | null>(null)
  const [stats, setStats] = useState<MeasureStats>(EMPTY_STATS)
  const [fpsLimit, setFpsLimit] = useState<InferenceFpsLimit>(DEFAULT_INFERENCE_FPS)
  const [framingMode, setFramingMode] = useState<FramingMode>(DEFAULT_FRAMING_MODE)
  const [model, setModel] = useState<PoseModel>(DEFAULT_POSE_MODEL)
  const [handsEnabled, setHandsEnabled] = useState(DEFAULT_HANDS_ENABLED)
  const [faceEnabled, setFaceEnabled] = useState(DEFAULT_FACE_ENABLED)

  const poseRef = useRef<LatestPose>(EMPTY_POSE)
  const loadedRef = useRef<LoadedLandmarker | null>(null)
  const gestureRef = useRef<LoadedGestureRecognizer | null>(null)
  const faceRef = useRef<LoadedFaceLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fpsLimitRef = useRef<InferenceFpsLimit>(fpsLimit)
  const framingModeRef = useRef<FramingMode>(framingMode)
  const modelRef = useRef<PoseModel>(model)
  const handsEnabledRef = useRef(handsEnabled)
  const faceEnabledRef = useRef(faceEnabled)
  const onFrameRef = useRef(onFrame)

  useEffect(() => {
    fpsLimitRef.current = fpsLimit
  }, [fpsLimit])
  useEffect(() => {
    framingModeRef.current = framingMode
  }, [framingMode])
  useEffect(() => {
    modelRef.current = model
  }, [model])
  useEffect(() => {
    handsEnabledRef.current = handsEnabled
  }, [handsEnabled])
  useEffect(() => {
    faceEnabledRef.current = faceEnabled
  }, [faceEnabled])
  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  const release = useCallback(() => {
    closeCamera(videoRef.current, streamRef.current)
    streamRef.current = null
    poseRef.current = EMPTY_POSE
    onFrameRef.current(EMPTY_POSE)
  }, [videoRef])

  const fail = useCallback(
    (kind: MeasureError) => {
      release()
      setStats(EMPTY_STATS)
      setError(kind)
      setStatus('error')
    },
    [release],
  )

  // FR-M-01 측정 중지 — 카메라를 끈다
  const stop = useCallback(() => {
    release()
    setStats(EMPTY_STATS)
    setStatus('idle')
  }, [release])

  // FR-M-01 측정 시작 — 버튼을 눌렀을 때만 카메라를 켠다
  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setStatus('starting')
    setError(null)
    try {
      streamRef.current = await openCamera(video)
    } catch (e) {
      fail(cameraErrorKind(e))
      return
    }
    try {
      // 모델을 바꿨으면 이전 모델을 닫고 새로 불러온다 (데모용 모델 비교)
      const wanted = modelRef.current
      if (loadedRef.current && loadedRef.current.model !== wanted) {
        loadedRef.current.landmarker.close()
        loadedRef.current = null
      }
      loadedRef.current ??= await createPoseLandmarker(wanted)
    } catch {
      fail('model')
      return
    }
    try {
      gestureRef.current ??= await createGestureRecognizer()
    } catch {
      // 손가락 모델이 없어도 몸 측정은 계속한다
      gestureRef.current = null
    }
    try {
      faceRef.current ??= await createFaceLandmarker()
    } catch {
      // 얼굴 모델이 없으면 둥근 머리는 정면을 보고 몸 측정은 계속한다
      faceRef.current = null
    }
    const { landmarker, delegate } = loadedRef.current
    setStatus('running')

    const stabilize = createHintStabilizer()
    const trackFace = createFaceTracker()
    let hint: string | null = null
    let budget = 1 // 첫 프레임은 바로 처리한다
    let lastTick = performance.now()
    let frames = 0
    let msSum = 0
    let handFrames = 0
    let handMsSum = 0
    let faceFrames = 0
    let faceMsSum = 0
    let windowStart = performance.now()

    const tick = () => {
      if (!streamRef.current) return // 중지됨
      const now = performance.now()
      const limit = fpsLimitRef.current
      // 초당 limit번만 추론한다. 카메라 프레임 간격이 흔들려도 평균이 limit에 맞도록 예산을 쌓아 쓴다
      budget = limit === 0 ? 1 : budget + ((now - lastTick) * limit) / 1000
      lastTick = now
      if (budget >= 1) {
        // 탭이 멈췄다 돌아와도 한꺼번에 몰아서 돌지 않게 남는 예산은 한 번치까지만 둔다
        budget = Math.min(budget - 1, 1)
        try {
          const t0 = performance.now()
          const result = landmarker.detectForVideo(video, now)
          msSum += performance.now() - t0
          frames += 1
          const image = result.landmarks[0] ?? null
          const world = result.worldLandmarks[0] ?? null
          const trusted = trustedJoints(image)

          let hands: HandPose[] = []
          const gesture = gestureRef.current
          if (handsEnabledRef.current && gesture) {
            const h0 = performance.now()
            const g = gesture.recognizer.recognizeForVideo(video, now)
            handMsSum += performance.now() - h0
            handFrames += 1
            hands = g.landmarks.map((handImage, k) => ({
              image: handImage,
              world: g.worldLandmarks[k] ?? [],
              side: matchHandToBody(handImage, image, trusted),
              gesture: gestureLabel(g.gestures[k]?.[0]?.categoryName, g.gestures[k]?.[0]?.score),
            }))
          }

          let face: FaceState | null = null
          const faceModel = faceRef.current
          if (faceEnabledRef.current && faceModel) {
            const f0 = performance.now()
            const r = faceModel.landmarker.detectForVideo(video, now)
            faceMsSum += performance.now() - f0
            faceFrames += 1
            face = trackFace(readFace(r, video.videoWidth / video.videoHeight), now)
          } else {
            trackFace(null, now)
          }

          poseRef.current = { image, world, hands, face }
          onFrameRef.current(poseRef.current)
          hint = stabilize(framingHint(image !== null, trusted, framingModeRef.current), now)
        } catch {
          fail('model')
          return
        }
      }
      if (now - windowStart >= STATS_INTERVAL_MS) {
        const pose = poseRef.current
        const handsOn = handsEnabledRef.current && gestureRef.current !== null
        const faceOn = faceEnabledRef.current && faceRef.current !== null
        const average = (sum: number, n: number) => (n ? Math.round((sum / n) * 10) / 10 : 0)
        setStats({
          fps: Math.round((frames * 1000) / (now - windowStart)),
          inferenceMs: average(msSum, frames),
          handMs: handsOn ? average(handMsSum, handFrames) : null,
          faceMs: faceOn ? average(faceMsSum, faceFrames) : null,
          detected: pose.image !== null,
          confidence: headShoulderConfidence(pose.image),
          delegate,
          hint,
          gesture: gestureSummary(pose.hands),
        })
        frames = 0
        msSum = 0
        handFrames = 0
        handMsSum = 0
        faceFrames = 0
        faceMsSum = 0
        windowStart = now
      }
      schedule()
    }
    // 카메라 프레임이 들어올 때마다 깨어난다. 탭이 가려지면 멈춘다 (가려진 탭 측정은 tasks #17)
    const schedule = () => {
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(tick)
      else requestAnimationFrame(tick)
    }
    schedule()
  }, [videoRef, fail])

  useEffect(
    () => () => {
      release()
      loadedRef.current?.landmarker.close()
      loadedRef.current = null
      gestureRef.current?.recognizer.close()
      gestureRef.current = null
      faceRef.current?.landmarker.close()
      faceRef.current = null
    },
    [release],
  )

  return {
    status,
    error,
    stats,
    fpsLimit,
    setFpsLimit,
    framingMode,
    setFramingMode,
    model,
    setModel,
    handsEnabled,
    setHandsEnabled,
    faceEnabled,
    setFaceEnabled,
    start,
    stop,
    poseRef,
  }
}
