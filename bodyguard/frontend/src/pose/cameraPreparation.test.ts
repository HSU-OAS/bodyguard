// @vitest-environment happy-dom
// FR-M-01/02/07·NFR-08: synthetic owned camera/worker ports, not real-body evidence.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { closeCamera, openCamera } from './camera'
import { createCameraPreparation } from './cameraPreparation'
import { capturePreparationFrame } from './preparationFrame'
import { createWorkerPoseInference } from './workerInference'

vi.mock('./camera', async (original) => ({
  ...(await original<typeof import('./camera')>()),
  openCamera: vi.fn(),
  closeCamera: vi.fn(),
}))
vi.mock('./workerInference', () => ({ createWorkerPoseInference: vi.fn() }))
vi.mock('./preparationFrame', () => ({ capturePreparationFrame: vi.fn() }))
const track = { addEventListener: vi.fn(), removeEventListener: vi.fn(), readyState: 'live' }
const stream = { getVideoTracks: () => [track] } as unknown as MediaStream
const frame = { close: vi.fn() } as unknown as VideoFrame
const result = { close: vi.fn(), landmarks: [['PRIVATE_FRAME_DO_NOT_SERIALIZE']] }
const worker = { dispose: vi.fn(), detect: vi.fn(), thread: 'worker' as const }
let allowed = true
const changed = vi.fn()
function owner() {
  return createCameraPreparation({
    video: document.createElement('video'),
    model: 'heavy',
    allowed: () => allowed,
    onState: changed,
  })
}
beforeEach(() => {
  allowed = true
  vi.mocked(openCamera).mockResolvedValue(stream)
  vi.mocked(capturePreparationFrame).mockResolvedValue(frame)
  worker.dispose.mockResolvedValue(undefined)
  worker.detect.mockResolvedValue(result)
  vi.mocked(createWorkerPoseInference).mockResolvedValue(
    worker as unknown as Awaited<ReturnType<typeof createWorkerPoseInference>>,
  )
})
afterEach(() => vi.clearAllMocks())
it('does nothing before explicit start or without authority', async () => {
  const current = owner()
  expect(openCamera).not.toHaveBeenCalled()
  allowed = false
  await current.start()
  expect(openCamera).not.toHaveBeenCalled()
  await current.close()
})
it('prepares one actual input port and discards all frame/result data; explicit stop releases', async () => {
  const current = owner()
  await current.start()
  expect(current.state).toEqual({ phase: 'ready' })
  expect(worker.detect).toHaveBeenCalledTimes(1)
  expect(frame.close).toHaveBeenCalledTimes(1)
  expect(result.close).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(changed.mock.calls)).not.toContain('PRIVATE_FRAME')
  await current.stop()
  expect(closeCamera).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
  expect(current.state).toEqual({ phase: 'idle' })
})
it('keeps a cancelled late camera out of readiness and blocks concurrent acquisition', async () => {
  let allow!: (s: MediaStream) => void
  vi.mocked(openCamera).mockReturnValueOnce(
    new Promise((yes) => {
      allow = yes
    }),
  )
  const current = owner()
  const first = current.start()
  const stopped = current.stop()
  await current.start()
  expect(openCamera).toHaveBeenCalledTimes(1)
  expect(current.state).toEqual({ phase: 'stopping' })
  allow(stream)
  await first
  await stopped
  expect(current.state).toEqual({ phase: 'idle' })
  expect(createWorkerPoseInference).not.toHaveBeenCalled()
  expect(closeCamera).toHaveBeenCalledTimes(1)
})
it('uses a fresh explicit generation after clean stop, never after permanent close', async () => {
  const current = owner()
  await current.start()
  await current.stop()
  await current.start()
  expect(vi.mocked(createWorkerPoseInference).mock.calls.map((x) => x[0].generation)).toEqual([
    1, 2,
  ])
  await current.close()
  await current.start()
  expect(openCamera).toHaveBeenCalledTimes(2)
})
it('closes camera on SDK failure without exposing its raw error', async () => {
  vi.mocked(createWorkerPoseInference).mockRejectedValueOnce(new Error('PRIVATE_FRAME_ERROR'))
  const current = owner()
  await current.start()
  expect(current.state).toEqual({ phase: 'error', reason: 'inference' })
  expect(closeCamera).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(changed.mock.calls)).not.toContain('PRIVATE_FRAME_ERROR')
})
it('blocks restart after a failed cleanup while still closing the camera', async () => {
  worker.dispose.mockRejectedValueOnce(new ResourceCleanupError())
  const current = owner()
  await current.start()
  await current.stop()
  expect(current.state).toEqual({ phase: 'error', reason: 'cleanup' })
  await current.start()
  expect(openCamera).toHaveBeenCalledTimes(1)
  expect(closeCamera).toHaveBeenCalledTimes(1)
})
it('reports denial without SDK acquisition and allows only an explicit retry', async () => {
  vi.mocked(openCamera).mockRejectedValueOnce(new DOMException('private detail', 'NotAllowedError'))
  const current = owner()
  await current.start()
  expect(current.state).toEqual({ phase: 'error', reason: 'denied' })
  expect(createWorkerPoseInference).not.toHaveBeenCalled()
  await current.start()
  expect(current.state).toEqual({ phase: 'ready' })
  await current.close()
})
it('reclaims a late SDK after cancellation without opening an input', async () => {
  let finish!: (value: Awaited<ReturnType<typeof createWorkerPoseInference>>) => void
  vi.mocked(createWorkerPoseInference).mockReturnValueOnce(
    new Promise((yes) => {
      finish = yes
    }),
  )
  const current = owner()
  const pending = current.start()
  await vi.waitFor(() => expect(createWorkerPoseInference).toHaveBeenCalledTimes(1))
  const stopped = current.stop()
  expect(closeCamera).toHaveBeenCalledTimes(1)
  finish(worker as unknown as Awaited<ReturnType<typeof createWorkerPoseInference>>)
  await pending
  await stopped
  expect(worker.dispose).toHaveBeenCalledTimes(1)
  expect(capturePreparationFrame).not.toHaveBeenCalled()
  expect(current.state).toEqual({ phase: 'idle' })
})
it('discards a held input result after stop; no late readiness', async () => {
  let finish!: (value: typeof result) => void
  worker.detect.mockReturnValueOnce(
    new Promise((yes) => {
      finish = yes
    }),
  )
  const current = owner()
  const pending = current.start()
  await vi.waitFor(() => expect(worker.detect).toHaveBeenCalledTimes(1))
  const stopped = current.stop()
  expect(closeCamera).toHaveBeenCalledTimes(1)
  finish(result)
  await pending
  await stopped
  expect(result.close).toHaveBeenCalledTimes(1)
  expect(frame.close).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
  expect(changed.mock.calls.some(([s]) => s.phase === 'ready')).toBe(false)
})
it('stops a native-ended track and never restarts on its own', async () => {
  const current = owner()
  await current.start()
  const ended = track.addEventListener.mock.calls.find(
    ([kind]) => kind === 'ended',
  )?.[1] as () => void
  ended()
  await vi.waitFor(() => expect(current.state).toEqual({ phase: 'idle' }))
  expect(openCamera).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
})
it('rejects authority lost during camera acquisition before creating the SDK', async () => {
  vi.mocked(openCamera).mockImplementationOnce(async () => {
    allowed = false
    return stream
  })
  const current = owner()
  await current.start()
  expect(createWorkerPoseInference).not.toHaveBeenCalled()
  expect(closeCamera).toHaveBeenCalledTimes(1)
  expect(current.state).toEqual({ phase: 'idle' })
})
it('poisons a failed input release while still releasing the other resources', async () => {
  vi.mocked(frame.close).mockImplementationOnce(() => {
    throw Error('private input')
  })
  const current = owner()
  await current.start()
  expect(current.state).toEqual({ phase: 'error', reason: 'cleanup' })
  expect(result.close).toHaveBeenCalledTimes(1)
  expect(closeCamera).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
  await current.start()
  expect(openCamera).toHaveBeenCalledTimes(1)
})
it('treats a throwing state observer as terminal without acquiring a camera', async () => {
  changed.mockImplementationOnce(() => {
    throw Error('private observer')
  })
  const current = owner()
  await current.start()
  expect(openCamera).not.toHaveBeenCalled()
  expect(current.state).toEqual({ phase: 'error', reason: 'cleanup' })
})
it('coalesces repeated stop and close disposal', async () => {
  const current = owner()
  await current.start()
  await Promise.all([current.stop(), current.stop(), current.close()])
  expect(closeCamera).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
})
