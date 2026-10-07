// FR-N-04/05: user gesture only, fixed metadata-free silent OS notice, explicit close.
import type { NotificationPort } from './delivery'

export function browserNotificationPort(): NotificationPort {
  const supported = () => window.isSecureContext && typeof window.Notification === 'function'
  return {
    permission: () => (supported() ? Notification.permission : 'unsupported'),
    requestPermission() {
      if (!supported() || !navigator.userActivation?.isActive)
        return Promise.reject(
          new Error('Notification permission requires explicit user activation'),
        )
      return Notification.requestPermission()
    },
    show(kind, click, fail) {
      if (!supported() || Notification.permission !== 'granted')
        throw new Error('Notification unavailable')
      const notification = new Notification('BODYGUARD 스트레칭 알림', {
        body: '잠깐 움직일 시간을 확인해 주세요.',
        tag: `bodyguard-${kind}`,
        lang: 'ko',
        silent: true,
        requireInteraction: false,
      })
      let closed = false
      // The owned callback decides navigation/focus after checking current authority.
      notification.onclick = () => {
        if (!closed) click()
      }
      notification.onerror = () => {
        if (!closed) fail()
      }
      return {
        close() {
          if (closed) return
          closed = true
          notification.onclick = null
          notification.onerror = null
          notification.close()
        },
      }
    },
  }
}
