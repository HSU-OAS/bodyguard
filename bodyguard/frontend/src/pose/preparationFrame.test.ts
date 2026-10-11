// @vitest-environment happy-dom
// FR-M-02/07: mocked VideoFrame ownership, no capture or serialization.
import { afterEach, expect, it, vi } from 'vitest'
import { capturePreparationFrame } from './preparationFrame'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('does not capture an aborted input', async () => {
  const construct = vi.fn()
  vi.stubGlobal('VideoFrame', construct)
  const controller = new AbortController()
  controller.abort()
  await expect(
    capturePreparationFrame(document.createElement('video'), controller.signal),
  ).rejects.toThrow()
  expect(construct).not.toHaveBeenCalled()
})
it('captures an available video frame only inside this browser', async () => {
  const video = document.createElement('video')
  vi.spyOn(video, 'readyState', 'get').mockReturnValue(2)
  const frame = { close: vi.fn() }
  const construct = vi.fn()
  class TestFrame {
    close = frame.close
    constructor() {
      construct()
    }
  }
  vi.stubGlobal('VideoFrame', TestFrame)
  expect(await capturePreparationFrame(video, new AbortController().signal)).toBeInstanceOf(
    TestFrame,
  )
  expect(construct).toHaveBeenCalledTimes(1)
})
it('cancels a pending video callback without constructing an input', async () => {
  const video = document.createElement('video')
  vi.spyOn(video, 'readyState', 'get').mockReturnValue(0)
  // happy-dom does not supply this native static constant in this environment.
  vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 })
  video.requestVideoFrameCallback = vi.fn(() => 7)
  video.cancelVideoFrameCallback = vi.fn()
  const construct = vi.fn()
  vi.stubGlobal('VideoFrame', construct)
  const controller = new AbortController()
  const pending = capturePreparationFrame(video, controller.signal)
  const rejected = expect(pending).rejects.toThrow()
  controller.abort()
  await rejected
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(7)
  expect(construct).not.toHaveBeenCalled()
})
