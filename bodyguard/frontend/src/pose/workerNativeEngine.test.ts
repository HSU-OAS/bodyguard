// FR-M-02/07·ADR-0016/17: SDK ports mocked; generated points are NOT real-person accuracy.
import { Matrix4 } from 'three'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { prepareWorkerNativeEngine } from './workerNativeEngine'

const sdk = vi.hoisted(() => ({ resolve: vi.fn(), body: vi.fn(), face: vi.fn(), hands: vi.fn() }))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: sdk.resolve },
  PoseLandmarker: { createFromOptions: sdk.body },
  FaceLandmarker: { createFromOptions: sdk.face },
  GestureRecognizer: { createFromOptions: sdk.hands },
}))
const config = { model: 'lite', face: true, hands: true, matrixLayout: 'column-major' } as const
const points = (length: number) => Array.from({ length }, () => ({ x: 0.5, y: 0.4, z: 0 }))
function fixture() {
  const result = { landmarks: [points(33)], worldLandmarks: [points(33)], close: vi.fn() }
  const faceResult = {
    faceLandmarks: [points(478)],
    facialTransformationMatrixes: [{ rows: 4, columns: 4, data: new Matrix4().toArray() }],
  }
  const handResult = {
    landmarks: [points(21)],
    worldLandmarks: [points(21)],
    handedness: [[{ categoryName: 'Left', score: 0.9 }]],
  }
  const body = { detectForVideo: vi.fn(() => result), close: vi.fn() }
  const face = { detectForVideo: vi.fn(() => faceResult), close: vi.fn() }
  const hands = { recognizeForVideo: vi.fn(() => handResult), close: vi.fn() }
  sdk.resolve.mockResolvedValue({ wasmLoaderPath: '/fixed' })
  sdk.body.mockResolvedValue(body)
  sdk.face.mockResolvedValue(face)
  sdk.hands.mockResolvedValue(hands)
  const abort = new AbortController()
  const frame = {} as VideoFrame
  return { result, faceResult, handResult, body, face, hands, abort, frame }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('self', { location: { href: 'https://owned.invalid/assets/worker.js' } })
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())
it('resolves fixed assets from the creator origin even inside an inherited-policy Blob worker', async () => {
  vi.stubGlobal('self', { location: { href: 'blob:https://owned.invalid/owned' } })
  const f = fixture()
  const engine = await prepareWorkerNativeEngine(config, f.abort.signal)
  expect(sdk.resolve).toHaveBeenCalledWith('https://owned.invalid/mediapipe/wasm')
  expect(sdk.body.mock.calls[0][1].baseOptions.modelAssetPath).toBe(
    'https://owned.invalid/models/pose_landmarker_lite.task',
  )
  engine.dispose()
})
it('keeps fixed same-origin VIDEO options and copies each SDK result before next call/release', async () => {
  const f = fixture(),
    engine = await prepareWorkerNativeEngine(config, f.abort.signal)
  f.face.detectForVideo.mockImplementation(() => {
    f.result.landmarks[0][0].x = 99
    return f.faceResult
  })
  f.hands.recognizeForVideo.mockImplementation(() => {
    f.faceResult.facialTransformationMatrixes[0].data.fill(99)
    return f.handResult
  })
  f.result.close.mockImplementation(() => {
    f.handResult.landmarks[0][0].x = 99
  })
  const result = await engine.detect(f.frame, 25)
  expect(result.landmarks[0][0].x).toBe(0.5)
  expect(result.headOrientation).toEqual([0, 0, 0, 1])
  expect(result.hands?.[0].landmarks[0].x).toBe(0.5)
  for (const fn of [f.body.detectForVideo, f.face.detectForVideo, f.hands.recognizeForVideo])
    expect(fn).toHaveBeenCalledWith(f.frame, 25)
  expect(f.result.close).toHaveBeenCalledOnce()
  expect(sdk.resolve).toHaveBeenCalledWith('https://owned.invalid/mediapipe/wasm')
  expect(sdk.body.mock.calls[0][1]).toMatchObject({
    baseOptions: {
      modelAssetPath: 'https://owned.invalid/models/pose_landmarker_lite.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 2,
  })
  expect(sdk.face.mock.calls[0][1]).toMatchObject({
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  })
  expect(sdk.hands.mock.calls[0][1]).toMatchObject({ runningMode: 'VIDEO', numHands: 2 })
  engine.dispose()
  engine.dispose()
  for (const task of [f.body, f.face, f.hands]) expect(task.close).toHaveBeenCalledOnce()
  expect(() => engine.detect(f.frame, 26)).toThrow('Worker inference unavailable')
})
it('keeps explicit optional features disabled', async () => {
  const f = fixture(),
    engine = await prepareWorkerNativeEngine(
      { ...config, face: false, hands: false },
      f.abort.signal,
    )
  const result = await engine.detect(f.frame, 25)
  expect(result).not.toHaveProperty('headOrientation')
  expect(result).not.toHaveProperty('hands')
  expect(sdk.face).not.toHaveBeenCalled()
  expect(sdk.hands).not.toHaveBeenCalled()
  engine.dispose()
})
it('does not bind head/hands to missing or multiple bodies', async () => {
  const f = fixture(),
    engine = await prepareWorkerNativeEngine(config, f.abort.signal)
  for (const landmarks of [[], [points(33), points(33)]]) {
    f.result.landmarks = landmarks
    f.result.worldLandmarks = landmarks
    expect(await engine.detect(f.frame, 25)).toMatchObject({ headOrientation: null, hands: [] })
  }
  engine.dispose()
})
it('tries GPU then CPU without disabling features or changing selected model', async () => {
  const f = fixture()
  sdk.body.mockRejectedValueOnce(new Error('PRIVATE_GPU'))
  const engine = await prepareWorkerNativeEngine({ ...config, model: 'full' }, f.abort.signal)
  expect(sdk.body.mock.calls.map((call) => call[1].baseOptions.delegate)).toEqual(['GPU', 'CPU'])
  expect(sdk.body.mock.calls[1][1].baseOptions.modelAssetPath).toBe(
    'https://owned.invalid/models/pose_landmarker_full.task',
  )
  expect(sdk.face).toHaveBeenCalledOnce()
  expect(sdk.hands).toHaveBeenCalledOnce()
  engine.dispose()
})
it('reclaims partial body and face when hands preparation fails', async () => {
  const f = fixture()
  sdk.hands.mockRejectedValue(new Error('PRIVATE_HANDS'))
  await expect(prepareWorkerNativeEngine(config, f.abort.signal)).rejects.toThrow(
    'Worker inference unavailable',
  )
  expect(f.body.close).toHaveBeenCalledOnce()
  expect(f.face.close).toHaveBeenCalledOnce()
})
it('reclaims a body resolving after abort, without preparing face or CPU retry', async () => {
  const f = fixture()
  sdk.body.mockImplementation(async () => {
    f.abort.abort()
    return f.body
  })
  await expect(prepareWorkerNativeEngine(config, f.abort.signal)).rejects.toThrow(
    'Worker inference unavailable',
  )
  expect(sdk.body).toHaveBeenCalledOnce()
  expect(sdk.face).not.toHaveBeenCalled()
  expect(f.body.close).toHaveBeenCalledOnce()
})
it('reports native result close failures as cleanup failures', async () => {
  const f = fixture(),
    engine = await prepareWorkerNativeEngine(config, f.abort.signal)
  f.result.close.mockImplementation(() => {
    throw new Error('PRIVATE_RESULT')
  })
  expect(() => engine.detect(f.frame, 25)).toThrow(ResourceCleanupError)
  engine.dispose()
})
it('attempts every task release and never converts cleanup failure to success', async () => {
  const f = fixture()
  sdk.hands.mockRejectedValue(new Error('PRIVATE_HANDS'))
  f.face.close.mockImplementation(() => {
    throw new Error('PRIVATE_CLOSE')
  })
  await expect(prepareWorkerNativeEngine(config, f.abort.signal)).rejects.toThrow(
    ResourceCleanupError,
  )
  expect(f.face.close).toHaveBeenCalledOnce()
  expect(f.body.close).toHaveBeenCalledOnce()
})
