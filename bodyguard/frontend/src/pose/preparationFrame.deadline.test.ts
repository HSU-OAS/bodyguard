// @vitest-environment happy-dom
// FR-M-02/07·NFR-08: bounded input readiness, synthetic native callback faults only.
import { afterEach, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { capturePreparationFrame } from './preparationFrame'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function pendingVideo() {
  const video = document.createElement('video')
  vi.spyOn(video, 'readyState', 'get').mockReturnValue(0)
  vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 })
  video.requestVideoFrameCallback = vi.fn(() => 9)
  video.cancelVideoFrameCallback = vi.fn()
  const construct = vi.fn()
  vi.stubGlobal('VideoFrame', construct)
  return { video, construct }
}
it('a camera without a decoded input times out and releases its callback', async () => {
  vi.useFakeTimers()
  const { video, construct } = pendingVideo()
  const controller = new AbortController()
  const remove = vi.spyOn(controller.signal, 'removeEventListener')
  const pending = capturePreparationFrame(video, controller.signal)
  const rejected = expect(pending).rejects.toThrow()
  await vi.advanceTimersByTimeAsync(5000)
  await rejected
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(9)
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  expect(vi.getTimerCount()).toBe(0)
  expect(construct).not.toHaveBeenCalled()
})
it('abort settles even if native callback cleanup throws, reporting failed ownership', async () => {
  const { video, construct } = pendingVideo()
  video.cancelVideoFrameCallback = vi.fn(() => {
    throw new Error('private native error')
  })
  const controller = new AbortController()
  const pending = capturePreparationFrame(video, controller.signal)
  const rejected = expect(pending).rejects.toBeInstanceOf(ResourceCleanupError)
  controller.abort()
  await rejected
  expect(construct).not.toHaveBeenCalled()
})

it('a delayed timeout task cannot promote an overdue decoded callback', async () => {
  const { video, construct } = pendingVideo()
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  let decoded!: VideoFrameRequestCallback
  video.requestVideoFrameCallback = vi.fn((callback) => {
    decoded = callback
    return 9
  })
  const pending = capturePreparationFrame(video, new AbortController().signal)
  const rejected = expect(pending).rejects.toThrow('Camera input unavailable')
  now = 5000
  decoded(now, {} as VideoFrameCallbackMetadata)
  await rejected
  expect(construct).not.toHaveBeenCalled()
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(9)
})
