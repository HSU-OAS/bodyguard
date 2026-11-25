// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openCamera } from './camera'
import {
  cameraConstraints,
  listCameras,
  preferredCamera,
  setPreferredCamera,
  subscribePreferredCamera,
} from './cameraSource'
import { CAMERA_CONSTRAINTS } from './constants'

const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream
const video = () => {
  const element = document.createElement('video')
  Object.defineProperty(element, 'srcObject', { configurable: true, writable: true, value: null })
  vi.spyOn(element, 'play').mockResolvedValue()
  return element
}
const device = (kind: MediaDeviceKind, deviceId: string, label = '') =>
  ({ kind, deviceId, label, groupId: '' }) as MediaDeviceInfo

beforeEach(() =>
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(), enumerateDevices: vi.fn() },
  }),
)
afterEach(() => {
  setPreferredCamera(null)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('keeps the shared default constraints until a camera is chosen', () => {
  expect(cameraConstraints()).toBe(CAMERA_CONSTRAINTS)
  setPreferredCamera('built-in')
  const video = cameraConstraints().video as MediaTrackConstraints
  expect(video.deviceId).toEqual({ exact: 'built-in' })
  expect(video.facingMode).toBeUndefined()
  expect(video.width).toEqual({ ideal: 640 })
  expect(cameraConstraints().audio).toBe(false)
})

it('notifies on a real change only and treats an empty id as the default', () => {
  const listener = vi.fn()
  const stop = subscribePreferredCamera(listener)
  setPreferredCamera('a')
  setPreferredCamera('a')
  setPreferredCamera('')
  expect(preferredCamera()).toBeNull()
  expect(listener).toHaveBeenCalledTimes(2)
  stop()
  setPreferredCamera('b')
  expect(listener).toHaveBeenCalledTimes(2)
})

it('lists video inputs only', async () => {
  vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
    device('audioinput', 'mic'),
    device('videoinput', 'cam', 'FaceTime HD Camera'),
    device('videoinput', ''),
  ])
  expect(await listCameras()).toEqual({
    cameras: [{ deviceId: 'cam', label: 'FaceTime HD Camera' }],
    locked: true,
  })
})

it('reports hidden cameras before permission was granted', async () => {
  vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([device('videoinput', '')])
  expect(await listCameras()).toEqual({ cameras: [], locked: true })
})

it('lists nothing where devices cannot be enumerated', async () => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
  expect(await listCameras()).toEqual({ cameras: [], locked: false })
})

it('opens the chosen camera', async () => {
  setPreferredCamera('built-in')
  vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream())
  await openCamera(video(), new AbortController().signal)
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(cameraConstraints('built-in'))
})

it('falls back to the default once when the chosen camera was unplugged', async () => {
  setPreferredCamera('gone')
  vi.mocked(navigator.mediaDevices.getUserMedia)
    .mockRejectedValueOnce(new DOMException('gone', 'OverconstrainedError'))
    .mockResolvedValueOnce(stream())
  await openCamera(video(), new AbortController().signal)
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith(CAMERA_CONSTRAINTS)
  expect(preferredCamera()).toBeNull()
})

it('does not retry a denied permission on another camera', async () => {
  setPreferredCamera('built-in')
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
    new DOMException('denied', 'NotAllowedError'),
  )
  await expect(openCamera(video(), new AbortController().signal)).rejects.toThrow('denied')
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
  expect(preferredCamera()).toBe('built-in')
})

it('does not fall back after the request was cancelled', async () => {
  setPreferredCamera('gone')
  const controller = new AbortController()
  vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementationOnce(async () => {
    controller.abort()
    throw new DOMException('gone', 'NotFoundError')
  })
  await expect(openCamera(video(), controller.signal)).rejects.toThrow()
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
})
