// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { closeCamera, openCamera } from './camera'

const stream = () => {
  const stop = vi.fn()
  return { value: { getTracks: () => [{ stop }] } as unknown as MediaStream, stop }
}
const video = () => {
  const element = document.createElement('video')
  Object.defineProperty(element, 'srcObject', { configurable: true, writable: true, value: null })
  vi.spyOn(element, 'play').mockResolvedValue()
  return element
}
beforeEach(() => vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// FR-M-01·07 카메라를 얻은 뒤 실패·취소해도 트랙을 남기지 않는다.
it('play 실패 시 이미 얻은 스트림을 끈다', async () => {
  const camera = stream()
  const element = video()
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(camera.value)
  vi.mocked(element.play).mockRejectedValue(new DOMException('play failed', 'NotAllowedError'))
  await expect(openCamera(element, new AbortController().signal)).rejects.toThrow()
  expect(camera.stop).toHaveBeenCalled()
  expect(element.srcObject).toBeNull()
})

it('권한 대기 중 취소하면 뒤늦은 스트림을 화면에 붙이지 않고 끈다', async () => {
  const camera = stream()
  const element = video()
  let allow!: (value: MediaStream) => void
  const permission = new Promise<MediaStream>((resolve) => {
    allow = resolve
  })
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockReturnValue(permission)
  const controller = new AbortController()
  const pending = openCamera(element, controller.signal)
  const rejected = expect(pending).rejects.toThrow()
  controller.abort()
  allow(camera.value)
  await rejected
  expect(camera.stop).toHaveBeenCalled()
  expect(element.play).not.toHaveBeenCalled()
  expect(element.srcObject).toBeNull()
})

it('play 대기 중 취소는 즉시 트랙을 끄고 늦은 재생으로 부활하지 않는다', async () => {
  const camera = stream()
  const element = video()
  let play!: () => void
  const playback = new Promise<void>((resolve) => {
    play = resolve
  })
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(camera.value)
  vi.mocked(element.play).mockReturnValue(playback)
  const controller = new AbortController()
  const pending = openCamera(element, controller.signal)
  const rejected = expect(pending).rejects.toThrow()
  await vi.waitFor(() => expect(element.play).toHaveBeenCalled())
  controller.abort()
  expect(camera.stop).toHaveBeenCalled()
  expect(element.srcObject).toBeNull()
  play()
  await rejected
})

it('지난 스트림을 닫아도 새 스트림을 분리하지 않는다', () => {
  const old = stream()
  const next = stream()
  const element = video()
  element.srcObject = next.value
  closeCamera(element, old.value)
  expect(old.stop).toHaveBeenCalled()
  expect(next.stop).not.toHaveBeenCalled()
  expect(element.srcObject).toBe(next.value)
})
