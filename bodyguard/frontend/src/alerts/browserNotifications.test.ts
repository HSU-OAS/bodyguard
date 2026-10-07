// @vitest-environment happy-dom
// FR-N-04/05: synthetic OS/userActivation; no real desktop notification.
import { afterEach, expect, it, vi } from 'vitest'
import { browserNotificationPort } from './browserNotifications'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function os() {
  const made: Array<{
    onclick: (() => void) | null
    onerror: (() => void) | null
    close: ReturnType<typeof vi.fn>
  }> = []
  const construct = vi.fn()
  const request = vi.fn(async (): Promise<NotificationPermission> => 'granted')
  class Fake {
    static permission: NotificationPermission = 'granted'
    static requestPermission = request
    onclick: (() => void) | null = null
    onerror: (() => void) | null = null
    close = vi.fn()
    constructor(title: string, options: NotificationOptions) {
      construct(title, options)
      made.push(this)
    }
  }
  vi.stubGlobal('Notification', Fake)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('navigator', { userActivation: { isActive: true, hasBeenActive: true } })
  return { Fake, made, construct, request }
}
it('D01 port construction is inert and activation is necessary for a request', async () => {
  const f = os()
  const p = browserNotificationPort()
  expect(f.request).not.toHaveBeenCalled()
  expect(f.construct).not.toHaveBeenCalled()
  ;(navigator.userActivation as { isActive: boolean }).isActive = false
  await expect(p.requestPermission()).rejects.toThrow('explicit user activation')
  expect(f.request).not.toHaveBeenCalled()
})
it('D01 explicit active request delegates once', async () => {
  const f = os()
  await expect(browserNotificationPort().requestPermission()).resolves.toBe('granted')
  expect(f.request).toHaveBeenCalledTimes(1)
})
it('D01 unsupported/insecure contexts never request or construct', async () => {
  const f = os()
  vi.stubGlobal('isSecureContext', false)
  const p = browserNotificationPort()
  expect(p.permission()).toBe('unsupported')
  await expect(p.requestPermission()).rejects.toThrow()
  expect(() => p.show('posture', vi.fn(), vi.fn())).toThrow()
  expect(f.construct).not.toHaveBeenCalled()
  expect(f.request).not.toHaveBeenCalled()
})
it('D03 fixed body/tag/silent do not disclose posture measurements', () => {
  const f = os()
  browserNotificationPort().show('sitting', vi.fn(), vi.fn())
  expect(f.construct).toHaveBeenCalledExactlyOnceWith('BODYGUARD 스트레칭 알림', {
    body: '잠깐 움직일 시간을 확인해 주세요.',
    tag: 'bodyguard-sitting',
    lang: 'ko',
    silent: true,
    requireInteraction: false,
  })
})
it('D04 clicking delegates without moving focus before the owner checks; close detaches callbacks', () => {
  const f = os()
  const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
  const click = vi.fn()
  const fail = vi.fn()
  const handle = browserNotificationPort().show('posture', click, fail)
  const oldClick = f.made[0]?.onclick
  const oldError = f.made[0]?.onerror
  oldClick?.()
  expect(click).toHaveBeenCalledTimes(1)
  expect(focus).not.toHaveBeenCalled()
  handle.close()
  handle.close()
  oldClick?.()
  oldError?.()
  expect(click).toHaveBeenCalledTimes(1)
  expect(fail).not.toHaveBeenCalled()
  expect(f.made[0]?.onclick).toBeNull()
  expect(f.made[0]?.onerror).toBeNull()
  expect(f.made[0]?.close).toHaveBeenCalledTimes(1)
})
