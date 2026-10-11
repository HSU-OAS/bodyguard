// @vitest-environment happy-dom
// FR-M-01/07·NFR-08: real preparation/camera functions with synthetic native ports.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createCameraPreparation } from './cameraPreparation'
import { capturePreparationFrame } from './preparationFrame'
import { createWorkerPoseInference } from './workerInference'

vi.mock('./workerInference', () => ({ createWorkerPoseInference: vi.fn() }))
vi.mock('./preparationFrame', () => ({ capturePreparationFrame: vi.fn() }))
const worker = { detect: vi.fn(), dispose: vi.fn() }
const result = { close: vi.fn() },
  frame = { close: vi.fn() }
function stream(failed = false) {
  const track = Object.assign(new EventTarget(), {
    readyState: 'live',
    stop: vi.fn(() => {
      if (failed) throw Error('PRIVATE_STOP')
    }),
  })
  return {
    value: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream,
    track,
  }
}
function fixture() {
  const video = document.createElement('video')
  Object.defineProperty(video, 'srcObject', { configurable: true, writable: true, value: null })
  let release!: () => void
  const play = vi.spyOn(video, 'play').mockReturnValueOnce(
    new Promise<void>((yes) => {
      release = yes
    }),
  )
  const current = createCameraPreparation({
    video,
    model: 'heavy',
    allowed: () => true,
    onState: () => {},
  })
  return { video, play, current, release }
}
beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
  worker.detect.mockResolvedValue(result)
  worker.dispose.mockResolvedValue(undefined)
  vi.mocked(createWorkerPoseInference).mockResolvedValue(
    worker as unknown as Awaited<ReturnType<typeof createWorkerPoseInference>>,
  )
  vi.mocked(capturePreparationFrame).mockResolvedValue(frame as unknown as VideoFrame)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('cancelled playback reaches idle before old play completes and permits a fresh explicit start', async () => {
  const f = fixture(),
    old = stream(),
    next = stream()
  vi.mocked(navigator.mediaDevices.getUserMedia)
    .mockResolvedValueOnce(old.value)
    .mockResolvedValueOnce(next.value)
  const started = f.current.start()
  await vi.waitFor(() => expect(f.play).toHaveBeenCalled())
  await f.current.stop()
  await started
  expect(f.current.state).toEqual({ phase: 'idle' })
  expect(f.video.srcObject).toBeNull()
  expect(old.track.stop).toHaveBeenCalledTimes(1)
  expect(createWorkerPoseInference).not.toHaveBeenCalled()
  f.play.mockResolvedValue(undefined)
  await f.current.start()
  expect(f.current.state).toEqual({ phase: 'ready' })
  f.release()
  await Promise.resolve()
  expect(f.video.srcObject).toBe(next.value)
  expect(next.track.stop).not.toHaveBeenCalled()
  expect(worker.detect).toHaveBeenCalledTimes(1)
  await f.current.close()
  expect(next.track.stop).toHaveBeenCalledTimes(1)
  expect(worker.dispose).toHaveBeenCalledTimes(1)
})

it('failed native stop during playback cancellation blocks readiness and every later start', async () => {
  const f = fixture(),
    camera = stream(true)
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(camera.value)
  const started = f.current.start()
  await vi.waitFor(() => expect(f.play).toHaveBeenCalled())
  await f.current.close()
  await started
  expect(f.current.state).toEqual({ phase: 'error', reason: 'cleanup' })
  expect(f.video.srcObject).toBeNull()
  expect(camera.track.stop).toHaveBeenCalledTimes(1)
  f.release()
  await Promise.resolve()
  await f.current.start()
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
  expect(createWorkerPoseInference).not.toHaveBeenCalled()
})
