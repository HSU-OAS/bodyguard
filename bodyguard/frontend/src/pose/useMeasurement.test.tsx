// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { closeCamera, openCamera } from './camera'
import { createFaceLandmarker, type LoadedFaceLandmarker } from './face'
import { createGestureRecognizer, type LoadedGestureRecognizer } from './hands'
import { createPoseLandmarker, type LoadedLandmarker } from './landmarker'
import { useMeasurement } from './useMeasurement'

vi.mock('./camera', () => ({
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
  cameraErrorKind: () => 'unknown',
}))
vi.mock('./landmarker', () => ({ createPoseLandmarker: vi.fn() }))
vi.mock('./hands', () => ({ createGestureRecognizer: vi.fn() }))
vi.mock('./face', () => ({ createFaceLandmarker: vi.fn() }))

const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }))
const bodyModel = () => ({
  landmarker: {
    detectForVideo: vi.fn(() => ({ landmarks: [points], worldLandmarks: [points] })),
    close: vi.fn(),
  },
  delegate: 'CPU' as const,
  model: 'heavy' as const,
})

function setup() {
  let now = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const video = document.createElement('video')
  const pending = new Map<number, VideoFrameRequestCallback>()
  let next = 0
  Object.defineProperties(video, {
    readyState: { value: 2 },
    currentTime: { value: 0, writable: true },
    videoWidth: { value: 640 },
    videoHeight: { value: 480 },
    requestVideoFrameCallback: {
      configurable: true,
      value: vi.fn((callback: VideoFrameRequestCallback) => {
        pending.set(++next, callback)
        return next
      }),
    },
    cancelVideoFrameCallback: { value: vi.fn((id: number) => pending.delete(id)) },
  })
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  vi.mocked(openCamera).mockResolvedValue(stream)
  const body = bodyModel()
  vi.mocked(createPoseLandmarker).mockResolvedValue(body as unknown as LoadedLandmarker)
  const hands = {
    recognizer: {
      recognizeForVideo: vi.fn(() => ({ landmarks: [], worldLandmarks: [], gestures: [] })),
      close: vi.fn(),
    },
    delegate: 'CPU',
  }
  const face = {
    landmarker: { detectForVideo: vi.fn(() => ({ faceLandmarks: [] })), close: vi.fn() },
    delegate: 'CPU',
  }
  vi.mocked(createGestureRecognizer).mockResolvedValue(hands as unknown as LoadedGestureRecognizer)
  vi.mocked(createFaceLandmarker).mockResolvedValue(face as unknown as LoadedFaceLandmarker)
  const onFrame = vi.fn()
  const ref = { current: video }
  const hook = renderHook(() => useMeasurement(ref, onFrame))
  const frame = (advanceVideo = true) => {
    const [id, callback] = [...pending][0]
    pending.delete(id)
    now += 40
    if (advanceVideo) video.currentTime += 0.04
    act(() => callback(now, {} as VideoFrameCallbackMetadata))
  }
  return { hook, body, hands, face, video, pending, stream, track, frame, onFrame }
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// FR-M-01·07 제어된 모델/영상 콜백으로 수명·복수 결과 경계를 확인한다. 실제 사람 정확도 시험 아님.
it('중복 시작은 루프 하나만 만들고 중지·재시작 뒤 지난 콜백은 실행하지 않는다', async () => {
  const s = setup()
  await act(async () => {
    await Promise.all([s.hook.result.current.start(), s.hook.result.current.start()])
  })
  expect(openCamera).toHaveBeenCalledTimes(1)
  expect(s.pending.size).toBe(1)
  const old = [...s.pending.values()][0]
  s.frame()
  expect(s.body.landmarker.detectForVideo).toHaveBeenCalledTimes(1)
  act(() => s.hook.result.current.stop())
  expect(s.pending.size).toBe(0)
  expect(s.hook.result.current.poseRef.current.image).toBeNull()
  await act(() => s.hook.result.current.start())
  act(() => old(2000, {} as VideoFrameCallbackMetadata))
  expect(s.pending.size).toBe(1)
  expect(s.body.landmarker.detectForVideo).toHaveBeenCalledTimes(1)
  s.frame()
  expect(s.body.landmarker.detectForVideo).toHaveBeenCalledTimes(2)
})

it('같은 영상은 재추론하지 않고 프레임 시각을 갱신하지 않는다', async () => {
  const s = setup()
  await act(() => s.hook.result.current.start())
  s.frame()
  const sampled = s.hook.result.current.poseRef.current.sampledAt
  s.frame(false)
  expect(s.body.landmarker.detectForVideo).toHaveBeenCalledTimes(1)
  expect(s.hook.result.current.poseRef.current.sampledAt).toBe(sampled)
})

it('복수 결과는 첫 사람을 선택하지 않고 몸·손·얼굴을 즉시 비운다', async () => {
  const s = setup()
  await act(() => s.hook.result.current.start())
  s.frame()
  expect(s.hook.result.current.poseRef.current.image).toBe(points)
  s.body.landmarker.detectForVideo.mockReturnValue({
    landmarks: [points, points],
    worldLandmarks: [points, points],
  })
  s.frame()
  expect(s.hook.result.current.poseRef.current).toMatchObject({
    personCount: 2,
    image: null,
    world: null,
    hands: [],
    face: null,
  })
  expect(s.hands.recognizer.recognizeForVideo).toHaveBeenCalledTimes(1)
  expect(s.face.landmarker.detectForVideo).toHaveBeenCalledTimes(1)
  s.body.landmarker.detectForVideo.mockReturnValue({ landmarks: [], worldLandmarks: [] })
  s.frame()
  expect(s.hook.result.current.poseRef.current.personCount).toBe(0)
  expect(s.hook.result.current.poseRef.current.image).toBeNull()
})

it('트랙 종료는 루프와 최근 좌표를 즉시 비운다', async () => {
  const s = setup()
  await act(() => s.hook.result.current.start())
  s.frame()
  act(() => s.track.dispatchEvent(new Event('ended')))
  expect(s.hook.result.current.status).toBe('error')
  expect(s.hook.result.current.poseRef.current.sampledAt).toBeNull()
  expect(s.pending.size).toBe(0)
  expect(closeCamera).toHaveBeenCalledWith(s.video, s.stream)
})

it('늦은 모델은 새 측정 모델을 덮어쓰지 않고 닫힌다', async () => {
  const s = setup()
  let finish!: (value: LoadedLandmarker) => void
  vi.mocked(createPoseLandmarker).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  let first!: Promise<void>
  await act(async () => {
    first = s.hook.result.current.start()
    await Promise.resolve()
  })
  expect(createPoseLandmarker).toHaveBeenCalledTimes(1)
  act(() => s.hook.result.current.stop())
  await act(() => s.hook.result.current.start())
  const late = bodyModel()
  await act(async () => {
    finish(late as unknown as LoadedLandmarker)
    await first
  })
  expect(late.landmarker.close).toHaveBeenCalledTimes(1)
  expect(s.body.landmarker.close).not.toHaveBeenCalled()
  expect(s.hook.result.current.status).toBe('running')
  expect(s.pending.size).toBe(1)
  s.frame()
  expect(s.body.landmarker.detectForVideo).toHaveBeenCalledTimes(1)
  expect(late.landmarker.detectForVideo).not.toHaveBeenCalled()
})

it('이탈 후 늦은 얼굴 모델은 닫고 상태/루프를 되살리지 않는다', async () => {
  const s = setup()
  let finish!: (value: LoadedFaceLandmarker) => void
  vi.mocked(createFaceLandmarker).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  let starting!: Promise<void>
  await act(async () => {
    starting = s.hook.result.current.start()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(createFaceLandmarker).toHaveBeenCalledTimes(1)
  s.hook.unmount()
  await act(async () => {
    finish(s.face as unknown as LoadedFaceLandmarker)
    await starting
  })
  expect(s.face.landmarker.close).toHaveBeenCalledTimes(1)
  expect(s.pending.size).toBe(0)
  expect(s.onFrame.mock.lastCall?.[0].image).toBeNull()
})

it('이탈 후 늦은 스트림은 닫고 모델을 불러오지 않는다', async () => {
  const s = setup()
  let allow!: (value: MediaStream) => void
  vi.mocked(openCamera).mockReturnValueOnce(
    new Promise((resolve) => {
      allow = resolve
    }),
  )
  let starting!: Promise<void>
  act(() => {
    starting = s.hook.result.current.start()
  })
  s.hook.unmount()
  await act(async () => {
    allow(s.stream)
    await starting
  })
  expect(closeCamera).toHaveBeenCalledWith(s.video, s.stream)
  expect(createPoseLandmarker).not.toHaveBeenCalled()
  expect(s.pending.size).toBe(0)
})

it('추론 실패는 지난 좌표와 프레임 루프를 남기지 않는다', async () => {
  const s = setup()
  await act(() => s.hook.result.current.start())
  s.frame()
  s.body.landmarker.detectForVideo.mockImplementationOnce(() => {
    throw new Error('synthetic inference failure')
  })
  s.frame()
  expect(s.hook.result.current.status).toBe('error')
  expect(s.hook.result.current.error).toBe('model')
  expect(s.hook.result.current.poseRef.current.image).toBeNull()
  expect(s.pending.size).toBe(0)
})

it('영상 프레임 API가 없을 때도 RAF 콜백을 중지 시 취소한다', async () => {
  const s = setup()
  Reflect.deleteProperty(s.video, 'requestVideoFrameCallback')
  const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(73)
  const cancel = vi.spyOn(window, 'cancelAnimationFrame')
  await act(() => s.hook.result.current.start())
  expect(request).toHaveBeenCalledTimes(1)
  act(() => s.hook.result.current.stop())
  expect(cancel).toHaveBeenCalledWith(73)
})
