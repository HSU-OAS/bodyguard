// @vitest-environment happy-dom
// FR-M-02/07·FR-U-04/NFR-08: controlled owned ports; no real-body/clinical claim.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { closeCamera, openCamera } from './camera'
import { createCameraPreparation } from './cameraPreparation'
import { capturePreparationFrame } from './preparationFrame'
import { createVideoPoseSource } from './videoPoseSource'
import { createWorkerPoseInference } from './workerInference'

vi.mock('./camera', () => ({ openCamera: vi.fn(), closeCamera: vi.fn() }))
vi.mock('./preparationFrame', () => ({ capturePreparationFrame: vi.fn() }))
vi.mock('./workerInference', () => ({ createWorkerPoseInference: vi.fn() }))
vi.mock('./videoPoseSource', () => ({ createVideoPoseSource: vi.fn() }))
type Frame = NonNullable<Awaited<ReturnType<ReturnType<typeof createVideoPoseSource>['read']>>>
const workers: Array<{ detect: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }> = []
const sources: Array<{
  read: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  send(frame: Frame | null): void
  fail(error: Error): void
}> = []
const changed = vi.fn()
const sample = (generation: number, sequence = 1): Frame =>
  Object.freeze({
    generation,
    sequence,
    at: performance.now(),
    result: Object.freeze({ landmarks: [], worldLandmarks: [] }),
  })
function owner() {
  return createCameraPreparation({
    video: document.createElement('video'),
    model: 'heavy',
    allowed: () => true,
    onState: changed,
  })
}
async function flush() {
  for (let i = 0; i < 14; i++) await Promise.resolve()
}
beforeEach(() => {
  workers.length = 0
  sources.length = 0
  vi.mocked(openCamera).mockImplementation(
    async () =>
      ({
        getVideoTracks: () => [
          { readyState: 'live', addEventListener: vi.fn(), removeEventListener: vi.fn() },
        ],
      }) as unknown as MediaStream,
  )
  vi.mocked(capturePreparationFrame).mockImplementation(
    async () => ({ close: vi.fn() }) as unknown as VideoFrame,
  )
  vi.mocked(createWorkerPoseInference).mockImplementation(async () => {
    const worker = {
      detect: vi.fn(async () => ({ close: vi.fn() })),
      dispose: vi.fn(async () => {}),
    }
    workers.push(worker)
    return worker as unknown as Awaited<ReturnType<typeof createWorkerPoseInference>>
  })
  vi.mocked(createVideoPoseSource).mockImplementation(() => {
    let send!: (frame: Frame | null) => void, fail!: (error: Error) => void
    const source = {
      read: vi.fn(
        () =>
          new Promise<Frame | null>((resolve, reject) => {
            send = resolve
            fail = reject
          }),
      ),
      dispose: vi.fn(async () => {}),
      send: (frame: Frame | null) => send(frame),
      fail: (error: Error) => fail(error),
    }
    sources.push(source)
    return source
  })
})
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it('discards a latest observation and raw failure on read error; no automatic acquisition', async () => {
  const current = owner()
  await current.start()
  current.observe()
  sources[0].send(sample(1))
  await flush()
  expect(current.state).toEqual({ phase: 'observing' })
  sources[0].fail(Error('PRIVATE_NATIVE_FAILURE'))
  await flush()
  expect(current.state).toEqual({ phase: 'error', reason: 'frame' })
  expect(current.takeFrame()).toBeNull()
  expect(openCamera).toHaveBeenCalledTimes(1)
  expect(closeCamera).toHaveBeenCalledTimes(1)
  expect(sources[0].dispose).toHaveBeenCalledTimes(1)
  expect(workers[0].dispose).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(changed.mock.calls)).not.toContain('PRIVATE_NATIVE_FAILURE')
})
it('fresh explicit retry prepares/discards once and observes generation2 only after separate confirmation', async () => {
  const current = owner()
  await current.start()
  current.observe()
  sources[0].fail(Error('PRIVATE_NATIVE_FAILURE'))
  await flush()
  await current.start()
  expect(current.state).toEqual({ phase: 'ready' })
  expect(sources).toHaveLength(1)
  expect(current.takeFrame()).toBeNull()
  expect(workers[0]).not.toBe(workers[1])
  expect(workers.map((w) => w.detect.mock.calls.length)).toEqual([1, 1])
  expect(
    vi.mocked(createWorkerPoseInference).mock.calls.map(([context]) => context.generation),
  ).toEqual([1, 2])
  current.observe()
  const fresh = sample(2)
  sources[1].send(fresh)
  await flush()
  expect(current.takeFrame()).toBe(fresh)
  const stopped = current.stop()
  sources[1].send(null)
  await stopped
  expect(current.state).toEqual({ phase: 'idle' })
  expect(workers[1].dispose).toHaveBeenCalledTimes(1)
})
it.each(['source-error', 'worker-disposal'] as const)(
  'blocks recovery on %s while reclaiming other owners',
  async (mode) => {
    const current = owner()
    await current.start()
    current.observe()
    if (mode === 'worker-disposal')
      workers[0].dispose.mockRejectedValueOnce(Error('PRIVATE_NATIVE_FAILURE'))
    sources[0].fail(
      mode === 'source-error' ? new ResourceCleanupError() : Error('PRIVATE_NATIVE_FAILURE'),
    )
    await flush()
    expect(current.state).toEqual({ phase: 'error', reason: 'cleanup' })
    expect(current.takeFrame()).toBeNull()
    expect(sources[0].dispose).toHaveBeenCalledTimes(1)
    expect(workers[0].dispose).toHaveBeenCalledTimes(1)
    expect(closeCamera).toHaveBeenCalledTimes(1)
    await current.start()
    current.observe()
    expect(openCamera).toHaveBeenCalledTimes(1)
    expect(sources).toHaveLength(1)
    expect(JSON.stringify(changed.mock.calls)).not.toContain('PRIVATE_NATIVE_FAILURE')
  },
)
