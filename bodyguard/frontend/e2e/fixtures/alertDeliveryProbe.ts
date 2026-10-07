// FR-N-04/05: TEST ONLY real React/browser port, synthetic alert triggers/authority.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertDeliveryPanel } from '../../src/alerts/AlertDeliveryPanel'
import { browserNotificationPort } from '../../src/alerts/browserNotifications'
import { type AlertKind, createAlertDelivery } from '../../src/alerts/delivery'

export function mountAlertDeliveryProbe(reportClosed?: () => void) {
  let current = true
  let chosen: AlertKind | null = null
  let reportedClosed = false
  const delivery = createAlertDelivery({
    port: browserNotificationPort(),
    isCurrent: () => current,
    enabled: { posture: true, sitting: true },
    onChoose: (kind) => {
      chosen = kind
    },
  })
  const host = document.createElement('main')
  host.className = 'website'
  host.style.cssText = 'width:100%;padding:48px'
  document.body.append(host)
  const old = document.getElementById('root')
  if (old) old.style.display = 'none'
  const root = createRoot(host)
  root.render(
    createElement(
      'div',
      null,
      createElement(
        'p',
        { className: 'small muted' },
        '개발 검증 화면 · 안내 입력은 합성이며 실제 운동 알림이 아닙니다.',
      ),
      createElement(
        'button',
        {
          className: 'button secondary',
          type: 'button',
          onClick: () => delivery.receive('posture'),
        },
        '합성 자세 안내',
      ),
      createElement(AlertDeliveryPanel, { delivery }),
    ),
  )
  const close = () => {
    current = false
    delivery.dispose()
    // Test-only callback after observing actual closed/empty state, once.
    // The navigation test reports only a fixed empty GET to its owned loopback sink.
    const snapshot = delivery.getSnapshot()
    if (snapshot.closed && snapshot.alerts.length === 0 && !reportedClosed) {
      reportedClosed = true
      reportClosed?.()
    }
  }
  window.addEventListener('pagehide', close)
  return {
    receive: (kind: AlertKind) => delivery.receive(kind),
    close,
    state: () => ({ ...delivery.getSnapshot(), chosen, syntheticTriggersAuthority: true }),
    unmount() {
      close()
      window.removeEventListener('pagehide', close)
      root.unmount()
      host.remove()
      if (old) old.style.display = ''
    },
  }
}
