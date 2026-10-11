// @vitest-environment happy-dom
// FR-M-01/02/07·NFR-08: synthetic owned source/SDK, not actual-body validation.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { openCamera } from './camera'
import { createCameraPreparation } from './cameraPreparation'
import { capturePreparationFrame } from './preparationFrame'
import { createVideoPoseSource } from './videoPoseSource'
import { createWorkerPoseInference } from './workerInference'

vi.mock('./camera', async (original) => ({
  ...(await original<typeof import('./camera')>()),
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
}))
vi.mock('./preparationFrame', () => ({ capturePreparationFrame: vi.fn() }))
vi.mock('./workerInference', () => ({ createWorkerPoseInference: vi.fn() }))
vi.mock('./videoPoseSource', () => ({ createVideoPoseSource: vi.fn() }))
const track = { readyState: 'live', addEventListener: vi.fn(), removeEventListener: vi.fn() }
const stream = { getVideoTracks: () => [track] } as unknown as MediaStream
const frame = { close: vi.fn() } as unknown as VideoFrame
const worker = { detect: vi.fn(), dispose: vi.fn() }
const source = { read: vi.fn(), dispose: vi.fn() }
let ready = true
function owner() {
  return createCameraPreparation({
    video: document.createElement('video'),
    model: 'heavy',
    allowed: () => ready,
    onState: () => {},
  })
}
beforeEach(() => {
  ready = true
  vi.mocked(openCamera).mockResolvedValue(stream)
  vi.mocked(capturePreparationFrame).mockResolvedValue(frame)
  worker.detect.mockResolvedValue({ close: vi.fn() })
  worker.dispose.mockResolvedValue(undefined)
  vi.mocked(createWorkerPoseInference).mockResolvedValue(
    worker as unknown as Awaited<ReturnType<typeof createWorkerPoseInference>>,
  )
  source.dispose.mockResolvedValue(undefined)
  vi.mocked(createVideoPoseSource).mockReturnValue(source)
})
afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
it('connects only after a separate explicit input request, not preparation', async () => {
  const current = owner()
  await current.start()
  expect(current.state).toEqual({ phase: 'ready' })
  expect(createVideoPoseSource).not.toHaveBeenCalled()
  let settle!: () => void
  source.read.mockImplementation(
    () =>
      new Promise((resolve) => {
        settle = () => resolve(null)
      }),
  )
  current.observe()
  expect(createVideoPoseSource).toHaveBeenCalledTimes(1)
  expect(current.state).toEqual({ phase: 'connecting' })
  const stopped = current.stop()
  settle()
  await stopped
  expect(current.state).toEqual({ phase: 'idle' })
})

it('hands off the exact warmup detector timestamp and uses a fresh value for the next generation', async () => {
  let now = 100
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const current = owner(),
    port = decoded()
  await current.start()
  expect(worker.detect.mock.calls[0][1]).toBe(100)
  expect(createVideoPoseSource).not.toHaveBeenCalled()
  now = 150
  current.observe()
  expect(vi.mocked(createVideoPoseSource).mock.calls[0][1].afterAt).toBe(100)
  const stopped = current.stop()
  port.send(null)
  await stopped
  now = 200
  await current.start()
  expect(worker.detect.mock.calls[1][1]).toBe(200)
  now = 250
  current.observe()
  expect(vi.mocked(createVideoPoseSource).mock.calls[1][0].generation).toBe(2)
  expect(vi.mocked(createVideoPoseSource).mock.calls[1][1].afterAt).toBe(200)
  const closed = current.close()
  port.send(null)
  await closed
  expect(current.takeFrame()).toBeNull()
  expect(worker.dispose).toHaveBeenCalledTimes(2)
})

function input(sequence: number) {
  return Object.freeze({
    generation: 1,
    sequence,
    at: performance.now(),
    image: { width: 640, height: 480, imageIsMirrored: false },
    result: { landmarks: [], worldLandmarks: [] },
  })
}
function decoded() {
  let resolve!: (value: ReturnType<typeof input> | null) => void
  source.read.mockImplementation(
    () =>
      new Promise((yes) => {
        resolve = yes
      }),
  )
  return { send: (frame: ReturnType<typeof input> | null) => resolve(frame) }
}
async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}
it('retains only the latest stamped copied frame, consumes once, and never starts two reads', async () => {
  const current = owner(),
    port = decoded()
  await current.start()
  current.observe()
  current.observe()
  expect(createVideoPoseSource).toHaveBeenCalledTimes(1)
  expect(source.read).toHaveBeenCalledTimes(1)
  expect(current.takeFrame()).toBeNull()
  const first = input(1)
  port.send(first)
  await flush()
  const next = input(2)
  port.send(next)
  await flush()
  expect(current.state).toEqual({ phase: 'observing' })
  expect(current.takeFrame()).toBe(next)
  expect(current.takeFrame()).toBeNull()
  const stopped = current.stop()
  port.send(null)
  await stopped
  expect(current.takeFrame()).toBeNull()
  expect(source.dispose).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
})
it('discards a held late frame immediately on stop and blocks readiness revival', async () => {
  const current = owner(),
    port = decoded()
  await current.start()
  current.observe()
  const stopped = current.stop()
  const late = input(1)
  port.send(late)
  await stopped
  expect(current.takeFrame()).toBeNull()
  expect(current.state).toEqual({ phase: 'idle' })
})
it('ends and clears its slot when account authority disappears', async () => {
  const current = owner(),
    port = decoded()
  await current.start()
  current.observe()
  port.send(input(1))
  await flush()
  ready = false
  expect(current.takeFrame()).toBeNull()
  port.send(input(2))
  await flush()
  expect(current.state).toEqual({ phase: 'idle' })
  expect(source.dispose).toHaveBeenCalledTimes(1)
})
it('a source cleanup failure permanently blocks later acquisition', async () => {
  const current = owner(),
    port = decoded()
  await current.start()
  current.observe()
  source.dispose.mockRejectedValueOnce(new ResourceCleanupError())
  const stopped = current.stop()
  port.send(null)
  await stopped
  expect(current.state).toEqual({ phase: 'error', reason: 'cleanup' })
  await current.start()
  expect(openCamera).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
})
it('does not prolong the response deadline with skipped duplicate input', async () => {
  vi.useFakeTimers()
  const current = owner(),
    port = decoded()
  await current.start()
  current.observe()
  await vi.advanceTimersByTimeAsync(4900)
  port.send(null)
  await flush()
  await vi.advanceTimersByTimeAsync(100)
  port.send(null)
  await flush()
  expect(current.state).toEqual({ phase: 'error', reason: 'frame' })
  expect(current.takeFrame()).toBeNull()
  expect(source.dispose).toHaveBeenCalledTimes(1)
})

it('rejects an overdue read even if its scheduled timer has not fired', async () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const current = owner(),
    port = decoded()
  await current.start()
  current.observe()
  now = 5000
  port.send(input(1))
  await flush()
  expect(current.state).toEqual({ phase: 'error', reason: 'frame' })
  expect(current.takeFrame()).toBeNull()
  expect(source.dispose).toHaveBeenCalledTimes(1)
})
