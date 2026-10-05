// @vitest-environment happy-dom
// FR-M-01/02/07·NFR-07/08: initial synthetic harness, not a real camera/model test.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createBrowserPorts } from './browserPorts'
import { createResourceController, ResourceCleanupError, ResourceObserverError } from './resources'
import { createCoachingSession } from './session'

const loaders = vi.hoisted(() => ({ pose: vi.fn(), gesture: vi.fn(), face: vi.fn() }))
vi.mock('../pose/landmarker', () => ({ createPoseLandmarker: loaders.pose }))
vi.mock('../pose/hands', () => ({ createGestureRecognizer: loaders.gesture }))
vi.mock('../pose/face', () => ({ createFaceLandmarker: loaders.face }))
const privateError = () => new Error('PRIVATE_BROWSER_PORT_FRAME_COORDINATES')
const task = () => ({ close: vi.fn() })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function setup() {
  const video = document.createElement('video')
  Object.defineProperty(video, 'srcObject', { configurable: true, writable: true, value: null })
  vi.spyOn(video, 'play').mockResolvedValue()
  const track = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  const onFailure = vi.fn()
  const abort = new AbortController()
  const context = { generation: 1, signal: abort.signal }
  const ports = createBrowserPorts(video, { poseModel: 'lite', onFailure })
  return { video, track, stream, getUserMedia, onFailure, abort, context, ports }
}
const natives: ReturnType<typeof task>[] = []
beforeEach(() => {
  natives.length = 0
  for (const name of ['pose', 'gesture', 'face'] as const) {
    loaders[name].mockReset().mockImplementation(async () => {
      const native = task()
      natives.push(native)
      return name === 'gesture'
        ? { recognizer: native, delegate: 'CPU' }
        : { landmarker: native, delegate: 'CPU', model: 'lite' }
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('B-01 생성만으로 카메라를 요청하지 않고 실제 아바타 ready를 꾸미지 않는다', () => {
  const getUserMedia = vi.fn()
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  const ports = createBrowserPorts(document.createElement('video'), {
    poseModel: 'lite',
    onFailure: vi.fn(),
  })
  expect(getUserMedia).not.toHaveBeenCalled()
  expect(typeof ports.camera).toBe('function')
  expect(typeof ports.inference).toBe('function')
  expect(Object.keys(ports)).toEqual(['camera', 'inference'])
  for (const load of Object.values(loaders)) expect(load).not.toHaveBeenCalled()
})

it.each(['', 'other', undefined, null, '__proto__'])(
  'B-01 invalid model %s initializes nothing',
  (poseModel) => {
    const h = setup()
    expect(() =>
      createBrowserPorts(h.video, { poseModel: poseModel as 'lite', onFailure: h.onFailure }),
    ).toThrow()
    expect(h.getUserMedia).not.toHaveBeenCalled()
    for (const load of Object.values(loaders)) expect(load).not.toHaveBeenCalled()
  },
)
it('B-01 camera duplicate/past/invalid generation cannot request or replace a live lease', async () => {
  const h = setup()
  const lease = await h.ports.camera(h.context)
  for (const generation of [1, 0, -1, 0.5, NaN, Infinity]) {
    await expect(h.ports.camera({ ...h.context, generation })).rejects.toThrow()
  }
  expect(h.getUserMedia).toHaveBeenCalledTimes(1)
  expect(h.video.srcObject).toBe(h.stream)
  expect(h.track.stop).not.toHaveBeenCalled()
  await lease.dispose()
})
it('B-02 camera lease owns its stream and disposes once', async () => {
  const h = setup()
  const lease = await h.ports.camera(h.context)
  expect(h.video.srcObject).toBe(h.stream)
  await Promise.all([lease.dispose(), lease.dispose()])
  h.abort.abort()
  expect(h.track.stop).toHaveBeenCalledTimes(1)
  expect(h.video.srcObject).toBeNull()
})
it('B-02 denied permission initializes no model and emits no raw error', async () => {
  const h = setup()
  h.getUserMedia.mockRejectedValue(privateError())
  await expect(h.ports.camera(h.context)).rejects.toThrow()
  for (const load of Object.values(loaders)) expect(load).not.toHaveBeenCalled()
  expect(h.onFailure).not.toHaveBeenCalled()
})
it('B-02 late permission after abort is stopped without attaching video', async () => {
  const h = setup()
  const pendingStream = deferred<MediaStream>()
  h.getUserMedia.mockReturnValue(pendingStream.promise)
  const pending = h.ports.camera(h.context)
  const rejected = expect(pending).rejects.toThrow()
  await vi.waitFor(() => expect(h.getUserMedia).toHaveBeenCalledTimes(1))
  h.abort.abort()
  pendingStream.resolve(h.stream)
  await rejected
  expect(h.track.stop).toHaveBeenCalledTimes(1)
  expect(h.video.play).not.toHaveBeenCalled()
  expect(h.video.srcObject).toBeNull()
})
it('B-02 pending play abort stops immediately and eventual play rejection cannot stop twice', async () => {
  const h = setup()
  const playback = deferred<void>()
  vi.mocked(h.video.play).mockReturnValue(playback.promise)
  const pending = h.ports.camera(h.context)
  const rejected = expect(pending).rejects.toThrow()
  await vi.waitFor(() => expect(h.video.play).toHaveBeenCalled())
  h.abort.abort()
  expect(h.track.stop).toHaveBeenCalledTimes(1)
  playback.reject(privateError())
  await rejected
  expect(h.track.stop).toHaveBeenCalledTimes(1)
})
it('B-02 new generation is never detached by late old permission', async () => {
  const h = setup()
  const pendingStream = deferred<MediaStream>()
  h.getUserMedia.mockReturnValueOnce(pendingStream.promise)
  const old = h.ports.camera(h.context)
  const rejected = expect(old).rejects.toThrow()
  await vi.waitFor(() => expect(h.getUserMedia).toHaveBeenCalledTimes(1))
  const nextTrack = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  const nextStream = { getTracks: () => [nextTrack] } as unknown as MediaStream
  h.getUserMedia.mockResolvedValueOnce(nextStream)
  const next = await h.ports.camera({ generation: 2, signal: new AbortController().signal })
  pendingStream.resolve(h.stream)
  await rejected
  expect(h.video.srcObject).toBe(nextStream)
  expect(h.track.stop).toHaveBeenCalledTimes(1)
  expect(nextTrack.stop).not.toHaveBeenCalled()
  await next.dispose()
})
it('B-03 inference without same current camera initializes nothing', async () => {
  const h = setup()
  await expect(h.ports.inference(h.context)).rejects.toThrow()
  const camera = await h.ports.camera(h.context)
  await expect(h.ports.inference({ ...h.context, generation: 2 })).rejects.toThrow()
  for (const load of Object.values(loaders)) expect(load).not.toHaveBeenCalled()
  await camera.dispose()
})
it('B-03 all three tasks are ready in same lease before inference succeeds', async () => {
  const h = setup()
  const camera = await h.ports.camera(h.context)
  const late = deferred<{ landmarker: ReturnType<typeof task>; delegate: string }>()
  loaders.face.mockReturnValueOnce(late.promise)
  let complete = false
  const pending = h.ports.inference(h.context).then((value) => {
    complete = true
    return value
  })
  await vi.waitFor(() => expect(loaders.face).toHaveBeenCalledTimes(1))
  expect(complete).toBe(false)
  expect(loaders.pose).toHaveBeenCalledWith('lite')
  const face = task()
  late.resolve({ landmarker: face, delegate: 'CPU' })
  const inference = await pending
  expect(complete).toBe(true)
  await expect(h.ports.inference(h.context)).rejects.toThrow()
  await Promise.all([inference.dispose(), inference.dispose(), camera.dispose()])
  for (const native of [...natives, face]) expect(native.close).toHaveBeenCalledTimes(1)
  expect(h.track.stop).toHaveBeenCalledTimes(1)
})
it.each(['pose', 'gesture', 'face'] as const)(
  'B-03 %s partial failure closes already-created tasks, not ready',
  async (name) => {
    const h = setup()
    const notices = vi.fn()
    const avatars = vi.fn()
    loaders[name].mockRejectedValueOnce(privateError())
    const controller = createResourceController({ ...h.ports, avatars }, notices)
    await controller.run({ type: 'request-camera', generation: 1 })
    expect(avatars).not.toHaveBeenCalled()
    expect(notices).toHaveBeenCalledExactlyOnceWith({
      type: 'error',
      generation: 1,
      reason: 'inference-error',
    })
    for (const native of natives) expect(native.close).toHaveBeenCalledTimes(1)
    expect(h.track.stop).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(notices.mock.calls)).not.toContain('PRIVATE_')
    await controller.close()
  },
)
it.each(['pose', 'gesture', 'face'] as const)(
  'B-04 abort during %s closes known and late native handles once',
  async (name) => {
    const h = setup()
    const camera = await h.ports.camera(h.context)
    const late = deferred<object>()
    loaders[name].mockReturnValueOnce(late.promise)
    const pending = h.ports.inference(h.context)
    const rejected = expect(pending).rejects.toThrow()
    await vi.waitFor(() => expect(loaders[name]).toHaveBeenCalled())
    h.abort.abort()
    await vi.waitFor(() => expect(h.track.stop).toHaveBeenCalledTimes(1))
    for (const native of natives) expect(native.close).toHaveBeenCalledTimes(1)
    const native = task()
    late.resolve(name === 'gesture' ? { recognizer: native } : { landmarker: native })
    await rejected
    expect(native.close).toHaveBeenCalledTimes(1)
    await camera.dispose()
    expect(h.onFailure).not.toHaveBeenCalled()
  },
)
it('B-04 native alias is rejected rather than shared or closed twice', async () => {
  const h = setup()
  const camera = await h.ports.camera(h.context)
  const shared = task()
  loaders.pose.mockResolvedValueOnce({ landmarker: shared })
  loaders.face.mockResolvedValueOnce({ landmarker: shared })
  await expect(h.ports.inference(h.context)).rejects.toThrow()
  expect(shared.close).toHaveBeenCalledTimes(1)
  for (const native of natives) expect(native.close).toHaveBeenCalledTimes(1)
  await camera.dispose()
})
it('B-05 a close failure cannot prevent other native closes and permanently blocks new preparation', async () => {
  const h = setup()
  const camera = await h.ports.camera(h.context)
  const broken = task()
  broken.close.mockImplementation(() => {
    throw privateError()
  })
  loaders.pose.mockResolvedValueOnce({ landmarker: broken })
  const inference = await h.ports.inference(h.context)
  await expect(inference.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
  for (const native of [broken, ...natives]) expect(native.close).toHaveBeenCalledTimes(1)
  await vi.waitFor(() => expect(h.track.stop).toHaveBeenCalledTimes(1))
  expect(h.onFailure).toHaveBeenCalledExactlyOnceWith({
    type: 'error',
    generation: 1,
    reason: 'cleanup-error',
  })
  await expect(
    h.ports.camera({ generation: 2, signal: new AbortController().signal }),
  ).rejects.toThrow()
  expect(h.getUserMedia).toHaveBeenCalledTimes(1)
  await expect(camera.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
})
it('B-05 failed partial cleanup is tagged and controller cannot become ready again', async () => {
  const h = setup()
  const broken = task()
  broken.close.mockImplementation(() => {
    throw privateError()
  })
  loaders.pose.mockResolvedValueOnce({ landmarker: broken })
  loaders.gesture.mockRejectedValueOnce(privateError())
  const notices = vi.fn()
  const avatars = vi.fn()
  const controller = createResourceController({ ...h.ports, avatars }, notices)
  await controller.run({ type: 'request-camera', generation: 1 })
  await controller.run({ type: 'request-camera', generation: 2 })
  expect(notices).toHaveBeenCalledExactlyOnceWith({
    type: 'error',
    generation: 1,
    reason: 'cleanup-error',
  })
  expect(avatars).not.toHaveBeenCalled()
  expect(h.getUserMedia).toHaveBeenCalledTimes(1)
  expect(broken.close).toHaveBeenCalledTimes(1)
  await controller.close()
})
it('B-05 camera cleanup attempts all tracks and detaches despite a stop failure', async () => {
  const h = setup()
  h.track.stop.mockImplementation(() => {
    throw privateError()
  })
  const second = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  h.getUserMedia.mockResolvedValue({ getTracks: () => [h.track, second] })
  const lease = await h.ports.camera(h.context)
  await expect(lease.dispose()).rejects.toBeInstanceOf(ResourceCleanupError)
  expect(second.stop).toHaveBeenCalledTimes(1)
  expect(h.video.srcObject).toBeNull()
  await expect(
    h.ports.camera({ generation: 2, signal: new AbortController().signal }),
  ).rejects.toThrow()
})
it('B-05 abort during play with stop failure is fixed cleanup fault, not uncaught abort-listener error', async () => {
  const h = setup()
  h.track.stop.mockImplementation(() => {
    throw privateError()
  })
  const playback = deferred<void>()
  vi.mocked(h.video.play).mockReturnValue(playback.promise)
  const pending = h.ports.camera(h.context)
  const rejected = expect(pending).rejects.toBeInstanceOf(ResourceCleanupError)
  await vi.waitFor(() => expect(h.video.play).toHaveBeenCalled())
  h.abort.abort()
  playback.resolve()
  await rejected
  expect(h.onFailure).toHaveBeenCalledExactlyOnceWith({
    type: 'error',
    generation: 1,
    reason: 'cleanup-error',
  })
})
it('B-06 track ended stops all same-generation resources and emits a fixed notice once', async () => {
  const h = setup()
  await h.ports.camera(h.context)
  await h.ports.inference(h.context)
  h.track.dispatchEvent(new Event('ended'))
  h.track.dispatchEvent(new Event('ended'))
  await vi.waitFor(() =>
    expect(natives.every((native) => native.close.mock.calls.length === 1)).toBe(true),
  )
  expect(h.onFailure).toHaveBeenCalledExactlyOnceWith({
    type: 'error',
    generation: 1,
    reason: 'camera-error',
  })
  expect(h.video.srcObject).toBeNull()
})
it('B-06 ended from disposed old tracks never terminates the replacement', async () => {
  const h = setup()
  await h.ports.camera(h.context)
  const second = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  const stream = { getTracks: () => [second] } as unknown as MediaStream
  h.getUserMedia.mockResolvedValueOnce(stream)
  const next = await h.ports.camera({ generation: 2, signal: new AbortController().signal })
  h.track.dispatchEvent(new Event('ended'))
  expect(h.onFailure).not.toHaveBeenCalled()
  expect(h.video.srcObject).toBe(stream)
  expect(second.stop).not.toHaveBeenCalled()
  await next.dispose()
})
it.each(['throw', 'reject'] as const)(
  'B-06 failed observer %s safely retires and blocks factories without raw notice',
  async (mode) => {
    const h = setup()
    h.onFailure.mockImplementation(() => {
      if (mode === 'throw') throw privateError()
      return Promise.reject(privateError())
    })
    await h.ports.camera(h.context)
    await h.ports.inference(h.context)
    h.track.dispatchEvent(new Event('ended'))
    await vi.waitFor(() =>
      expect(natives.every((native) => native.close.mock.calls.length === 1)).toBe(true),
    )
    await expect(
      h.ports.camera({ generation: 2, signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(ResourceObserverError)
    expect(h.onFailure).toHaveBeenCalledExactlyOnceWith({
      type: 'error',
      generation: 1,
      reason: 'camera-error',
    })
  },
)
it('B-06 explicit session reporter rejects unknown/past failures but current ended stops session', async () => {
  const h = setup()
  let session!: ReturnType<typeof createCoachingSession>
  h.onFailure.mockImplementation((notice) => session.resourceFailed(notice))
  session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 100,
      steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
    },
    ports: { ...h.ports, avatars: () => ({ dispose: vi.fn() }) },
    now: () => 1,
    readGates: () => ({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange: vi.fn(),
  })
  await session.start()
  expect(session.getSnapshot().state.status).toBe('running')
  for (const generation of [0, 2, NaN]) {
    await session.resourceFailed({ type: 'error', generation, reason: 'camera-error' })
  }
  await session.resourceFailed({
    type: 'error',
    generation: 1,
    reason: 'raw-secret' as 'camera-error',
  })
  expect(session.getSnapshot().state.status).toBe('running')
  h.track.dispatchEvent(new Event('ended'))
  await vi.waitFor(() => expect(session.getSnapshot().closed).toBe(true))
  expect(session.getSnapshot().failure).toBe('camera-error')
  await session.close('page-hidden')
  expect(natives.every((native) => native.close.mock.calls.length === 1)).toBe(true)
})

it('B-01 concurrent camera preparations cannot allow an older actor to take over the newer one', async () => {
  const h = setup()
  const old = h.ports.camera(h.context)
  const rejected = expect(old).rejects.toThrow()
  const next = await h.ports.camera({ generation: 2, signal: new AbortController().signal })
  await rejected
  expect(h.getUserMedia).toHaveBeenCalledTimes(1)
  expect(h.video.srcObject).toBe(h.stream)
  expect(h.track.stop).not.toHaveBeenCalled()
  await next.dispose()
})
it('B-03 inference must use the original camera ownership signal, not another actor token', async () => {
  const h = setup()
  const camera = await h.ports.camera(h.context)
  await expect(
    h.ports.inference({ generation: 1, signal: new AbortController().signal }),
  ).rejects.toThrow()
  for (const load of Object.values(loaders)) expect(load).not.toHaveBeenCalled()
  await camera.dispose()
})
it('B-01 selected model cannot be mutated by the external options object after construction', async () => {
  const h = setup()
  const options = { poseModel: 'lite' as 'lite' | 'full', onFailure: h.onFailure }
  const ports = createBrowserPorts(h.video, options)
  options.poseModel = 'full'
  const camera = await ports.camera(h.context)
  await ports.inference(h.context)
  expect(loaders.pose).toHaveBeenCalledWith('lite')
  await camera.dispose()
})
it('B-05 late old task cleanup failure quarantines and closes the live newer actor', async () => {
  const h = setup()
  const late = deferred<object>()
  loaders.pose.mockReturnValueOnce(late.promise)
  const notices = vi.fn()
  const avatars = vi.fn(() => ({ dispose: vi.fn() }))
  const controller = createResourceController({ ...h.ports, avatars }, notices)
  const first = controller.run({ type: 'request-camera', generation: 1 })
  await vi.waitFor(() => expect(loaders.pose).toHaveBeenCalledTimes(1))
  const nextTrack = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  h.getUserMedia.mockResolvedValueOnce({ getTracks: () => [nextTrack] })
  await controller.run({ type: 'request-camera', generation: 2 })
  const broken = task()
  broken.close.mockImplementation(() => {
    throw privateError()
  })
  late.resolve({ landmarker: broken })
  await first
  await vi.waitFor(() => expect(nextTrack.stop).toHaveBeenCalledTimes(1))
  expect(notices.mock.calls).toEqual([
    [{ type: 'ready', generation: 2 }],
    [{ type: 'error', generation: 1, reason: 'cleanup-error' }],
  ])
  for (const native of natives) expect(native.close).toHaveBeenCalledTimes(1)
  await controller.run({ type: 'request-camera', generation: 3 })
  expect(h.getUserMedia).toHaveBeenCalledTimes(2)
  await controller.close()
})

it('B-06 session ignores past ended notice but globally stops on past cleanup failure', async () => {
  const h = setup()
  let session!: ReturnType<typeof createCoachingSession>
  h.onFailure.mockImplementation((notice) => session.resourceFailed(notice))
  session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 100,
      steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
    },
    ports: { ...h.ports, avatars: () => ({ dispose: vi.fn() }) },
    now: () => 1,
    readGates: () => ({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange: vi.fn(),
  })
  await session.start()
  await session.pause()
  const second = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' })
  h.getUserMedia.mockResolvedValueOnce({ getTracks: () => [second] })
  await session.resume()
  expect(session.getSnapshot().state.generation).toBe(2)
  await session.resourceFailed({ type: 'error', generation: 1, reason: 'camera-error' })
  expect(session.getSnapshot().state.status).toBe('running')
  await session.resourceFailed({ type: 'error', generation: 1, reason: 'cleanup-error' })
  expect(session.getSnapshot().failure).toBe('cleanup-error')
  expect(session.getSnapshot().closed).toBe(true)
  expect(second.stop).toHaveBeenCalledTimes(1)
  await session.start()
  expect(h.getUserMedia).toHaveBeenCalledTimes(2)
})
