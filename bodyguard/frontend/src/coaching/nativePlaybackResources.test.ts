// @vitest-environment happy-dom
// FR-M-01/02/07·FR-S-02/04/NFR-08: native adapter ownership; native APIs mocked here.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareOwnedAvatarPair } from '../avatar/ownedAvatarPair'
import { closeCamera, openCamera } from '../pose/camera'
import { createPoseLandmarker } from '../pose/landmarker'
import { createVideoPoseSource } from '../pose/videoPoseSource'
import { createNativePlaybackResources } from './nativePlaybackResources'
import { createResourceController, ResourceCleanupError } from './resources'

vi.mock('../pose/camera', async (original) => ({
  ...(await original<typeof import('../pose/camera')>()),
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
}))
vi.mock('../pose/landmarker', () => ({ createPoseLandmarker: vi.fn() }))
vi.mock('../avatar/ownedAvatarPair', () => ({ prepareOwnedAvatarPair: vi.fn() }))
vi.mock('../pose/videoPoseSource', () => ({ createVideoPoseSource: vi.fn() }))
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
const drain = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve()
}
function setup() {
  const stream = { getTracks: () => [] } as unknown as MediaStream
  const native = {
    close: vi.fn(),
    detectForVideo: vi.fn(() => ({ landmarks: [], worldLandmarks: [], close: vi.fn() })),
  }
  const loaded = { landmarker: native, model: 'lite', delegate: 'CPU' } as unknown as Awaited<
    ReturnType<typeof createPoseLandmarker>
  >
  const pair = {
    models: null,
    observe: vi.fn(),
    render: vi.fn(() => ({ status: 'untracked', tracked: 0, total: 8 })),
    dispose: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof prepareOwnedAvatarPair>>
  const source = { read: vi.fn(async () => null), dispose: vi.fn(async () => {}) }
  vi.mocked(openCamera).mockResolvedValue(stream)
  vi.mocked(createPoseLandmarker).mockResolvedValue(loaded)
  vi.mocked(prepareOwnedAvatarPair).mockResolvedValue(pair)
  vi.mocked(createVideoPoseSource).mockReturnValue(source)
  const callbacks = new Map<number, (at: number) => void>()
  let id = 0
  const options = {
    model: 'lite' as const,
    mirror: true,
    halfLifeMs: 50,
    maxAgeMs: 250,
    loadAvatar: vi.fn(),
    render: vi.fn(),
    onFailure: vi.fn(),
    scheduler: {
      request: vi.fn((cb: (at: number) => void) => {
        callbacks.set(++id, cb)
        return id
      }),
      cancel: vi.fn((key: number) => callbacks.delete(key)),
    },
  }
  const actor = createNativePlaybackResources(options)
  const notices: unknown[] = []
  const controller = createResourceController(actor.ports, (n) => {
    notices.push(n)
  })
  return {
    actor,
    controller,
    notices,
    options,
    loaded,
    native,
    stream,
    pair,
    source,
    callbacks,
    prepare: () => controller.run({ type: 'request-camera', generation: 1 }),
  }
}
beforeEach(() => vi.resetAllMocks())
describe('native playback adapter', () => {
  it('is inert and requires explicit model/rig configuration', () => {
    const f = setup()
    expect(openCamera).not.toHaveBeenCalled()
    expect(createPoseLandmarker).not.toHaveBeenCalled()
    expect(f.actor.getSnapshot().cameraError).toBeNull()
    for (const change of [
      { model: 'constructor' },
      { mirror: 'yes' },
      { halfLifeMs: 0 },
      { maxAgeMs: NaN },
      { loadAvatar: null },
    ])
      expect(() => createNativePlaybackResources({ ...f.options, ...change } as never)).toThrow(
        'Invalid native playback resources',
      )
  })
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotReadableError', 'busy'],
    ['NotFoundError', 'not-found'],
    ['Error', 'unknown'],
  ])('keeps only fixed kind for %s', async (name, kind) => {
    const f = setup()
    vi.mocked(openCamera).mockRejectedValueOnce(
      name === 'Error'
        ? new Error('PRIVATE_CAMERA_VALUE')
        : new DOMException('PRIVATE_CAMERA_VALUE', name),
    )
    await f.prepare()
    await f.actor.close()
    expect(f.actor.getSnapshot().cameraError).toBe(kind)
    expect(f.notices).toEqual([{ type: 'error', generation: 1, reason: 'camera-error' }])
    expect(createPoseLandmarker).not.toHaveBeenCalled()
    expect(JSON.stringify(f.actor.getSnapshot())).not.toContain('PRIVATE_CAMERA_VALUE')
  })
  it('passes explicit configuration and binds native detect to its instance', async () => {
    const f = setup()
    await f.prepare()
    expect(createPoseLandmarker).toHaveBeenCalledWith('lite')
    const [video] = vi.mocked(openCamera).mock.calls[0]
    expect(video.hidden && video.muted && video.playsInline).toBe(true)
    expect(video.isConnected).toBe(false)
    expect(prepareOwnedAvatarPair).toHaveBeenCalledWith(expect.anything(), {
      load: f.options.loadAvatar,
      mirror: true,
      halfLifeMs: 50,
      maxAgeMs: 250,
    })
    expect(f.actor.start(1)).toBe(true)
    const ports = vi.mocked(createVideoPoseSource).mock.calls[0][1]
    const input = {} as VideoFrame
    ports.detect(input, 100)
    expect(f.native.detectForVideo).toHaveBeenCalledWith(input, 100)
    expect(f.native.detectForVideo.mock.contexts[0]).toBe(f.native)
    await f.controller.close()
    await f.actor.close()
    expect(f.source.dispose).toHaveBeenCalledTimes(1)
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
  })
  it('reclaims a late camera after cancellation without a denied label or SDK', async () => {
    const f = setup(),
      gate = deferred<MediaStream>()
    vi.mocked(openCamera).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close()
    await drain()
    expect(createPoseLandmarker).not.toHaveBeenCalled()
    gate.resolve(f.stream)
    await preparing
    await closing
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(f.actor.getSnapshot().cameraError).toBeNull()
    expect(f.notices.some((n) => (n as { type: string }).type === 'ready')).toBe(false)
  })
  it('closes a late SDK once after cancellation before avatar preparation', async () => {
    const f = setup(),
      gate = deferred<typeof f.loaded>()
    vi.mocked(createPoseLandmarker).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close()
    await drain()
    gate.resolve(f.loaded)
    await preparing
    await closing
    expect(f.native.close).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(prepareOwnedAvatarPair).not.toHaveBeenCalled()
  })
  it('preserves a late SDK cleanup failure and still closes the camera', async () => {
    const f = setup(),
      gate = deferred<typeof f.loaded>()
    f.native.close.mockImplementationOnce(() => {
      throw new Error('PRIVATE_CLOSE_VALUE')
    })
    vi.mocked(createPoseLandmarker).mockReturnValueOnce(gate.promise)
    const preparing = f.prepare()
    await drain()
    const closing = f.actor.close(),
      rejected = expect(closing).rejects.toBeInstanceOf(ResourceCleanupError)
    gate.resolve(f.loaded)
    await preparing
    await rejected
    expect(closeCamera).toHaveBeenCalledTimes(1)
    expect(f.actor.getSnapshot().poisoned).toBe(true)
    expect(f.actor.start(2)).toBe(false)
  })
  it.each(['sdk', 'avatar'] as const)(
    'reclaims earlier owned resources on %s failure',
    async (stage) => {
      const f = setup()
      if (stage === 'sdk')
        vi.mocked(createPoseLandmarker).mockRejectedValueOnce(new Error('PRIVATE_NATIVE_VALUE'))
      else
        vi.mocked(prepareOwnedAvatarPair).mockRejectedValueOnce(new Error('PRIVATE_NATIVE_VALUE'))
      await f.prepare()
      await f.actor.close()
      expect(closeCamera).toHaveBeenCalledTimes(1)
      expect(f.native.close).toHaveBeenCalledTimes(stage === 'sdk' ? 0 : 1)
      expect(f.notices).toEqual([
        {
          type: 'error',
          generation: 1,
          reason: stage === 'sdk' ? 'inference-error' : 'asset-error',
        },
      ])
    },
  )
  it('retries by explicit fresh bridge and does not reuse a failed camera label', async () => {
    const f = setup()
    vi.mocked(openCamera).mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))
    await f.prepare()
    await f.actor.close()
    const next = setup()
    await next.prepare()
    expect(next.actor.getSnapshot().cameraError).toBeNull()
    expect(next.actor.start(1)).toBe(true)
    await next.controller.close()
    await next.actor.close()
  })
})
