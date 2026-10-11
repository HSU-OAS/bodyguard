// @vitest-environment happy-dom
// FR-M-01/07·NFR-08: synthetic stalled playback and cleanup faults, no real-person evidence.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { closeCamera, openCamera } from './camera'

function stream() {
  const stop = vi.fn()
  return { value: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop }
}
function video() {
  const element = document.createElement('video')
  Object.defineProperty(element, 'srcObject', { configurable: true, writable: true, value: null })
  vi.spyOn(element, 'play').mockResolvedValue()
  return element
}
function held<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
beforeEach(() => vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('settles cancellation without requiring the stalled native play promise to complete', async () => {
  const camera = stream(),
    element = video(),
    playback = held<void>()
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(camera.value)
  vi.mocked(element.play).mockReturnValue(playback.promise)
  const controller = new AbortController()
  let settled = false
  const pending = openCamera(element, controller.signal).then(
    () => {
      throw Error('Cancelled camera became ready')
    },
    (error) => {
      settled = true
      return error
    },
  )
  await vi.waitFor(() => expect(element.play).toHaveBeenCalled())
  controller.abort()
  try {
    await vi.waitFor(() => expect(settled).toBe(true), { timeout: 100 })
    expect(await pending).toBeInstanceOf(DOMException)
    expect(camera.stop).toHaveBeenCalledTimes(1)
    expect(element.srcObject).toBeNull()
  } finally {
    playback.resolve()
    await pending
  }
})

it('attempts every track and detaches its own video even when one stop throws', () => {
  const first = vi.fn(() => {
      throw Error('PRIVATE_TRACK_ERROR')
    }),
    second = vi.fn()
  const camera = { getTracks: () => [{ stop: first }, { stop: second }] } as unknown as MediaStream
  const element = video()
  element.srcObject = camera
  let failure: unknown
  try {
    closeCamera(element, camera)
  } catch (error) {
    failure = error
  }
  expect(second).toHaveBeenCalledTimes(1)
  expect(element.srcObject).toBeNull()
  expect(failure).toBeInstanceOf(ResourceCleanupError)
  expect(String(failure)).not.toContain('PRIVATE_TRACK_ERROR')
})

it('consumes a late native play rejection without touching a subsequent stream', async () => {
  const old = stream(),
    next = stream(),
    element = video(),
    playback = held<void>()
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(old.value)
  vi.mocked(element.play).mockReturnValue(playback.promise)
  const controller = new AbortController()
  const pending = openCamera(element, controller.signal).catch((error) => error)
  await vi.waitFor(() => expect(element.play).toHaveBeenCalled())
  controller.abort()
  await pending
  element.srcObject = next.value
  playback.reject(Error('PRIVATE_LATE_PLAY_ERROR'))
  await Promise.resolve()
  expect(old.stop).toHaveBeenCalledTimes(1)
  expect(next.stop).not.toHaveBeenCalled()
  expect(element.srcObject).toBe(next.value)
})

it('detach is attempted even when reading the owned track list fails', () => {
  const camera = {
    getTracks() {
      throw Error('PRIVATE_TRACK_LIST')
    },
  } as unknown as MediaStream
  const element = video()
  element.srcObject = camera
  expect(() => closeCamera(element, camera)).toThrow(ResourceCleanupError)
  expect(element.srcObject).toBeNull()
})

it('track stop is attempted even when detach fails', () => {
  const camera = stream(),
    element = video()
  Object.defineProperty(element, 'srcObject', {
    get: () => camera.value,
    set() {
      throw Error('PRIVATE_DETACH')
    },
  })
  expect(() => closeCamera(element, camera.value)).toThrow(ResourceCleanupError)
  expect(camera.stop).toHaveBeenCalledTimes(1)
})

it('a synchronous play failure closes once and removes its abort listener', async () => {
  const camera = stream(),
    element = video(),
    controller = new AbortController()
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(camera.value)
  vi.mocked(element.play).mockImplementation(() => {
    throw new DOMException('play failed', 'NotAllowedError')
  })
  await expect(openCamera(element, controller.signal)).rejects.toBeInstanceOf(DOMException)
  controller.abort()
  expect(camera.stop).toHaveBeenCalledTimes(1)
})

it('a cancelled permission remains owned until its late stream is stopped', async () => {
  const camera = stream(),
    element = video(),
    permission = held<MediaStream>()
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockReturnValue(permission.promise)
  const controller = new AbortController()
  let settled = false
  const pending = openCamera(element, controller.signal).catch(() => {
    settled = true
  })
  controller.abort()
  await Promise.resolve()
  expect(settled).toBe(false)
  permission.resolve(camera.value)
  await pending
  expect(camera.stop).toHaveBeenCalledTimes(1)
  expect(element.play).not.toHaveBeenCalled()
})
