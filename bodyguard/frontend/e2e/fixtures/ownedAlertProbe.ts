// FR-N-03/04/05/FR-U-04: TEST ONLY actual auth/settings hook, synthetic alert triggers.
import { createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertDeliveryPanel } from '../../src/alerts/AlertDeliveryPanel'
import { browserNotificationPort } from '../../src/alerts/browserNotifications'
import type { AlertDelivery, AlertKind } from '../../src/alerts/delivery'
import { useOwnedAlertDelivery } from '../../src/alerts/useOwnedAlertDelivery'
import { AuthProvider, useAuth } from '../../src/auth'

export function mountOwnedAlertProbe() {
  let control: ReturnType<typeof useOwnedAlertDelivery> | null = null
  let auth: ReturnType<typeof useAuth> | null = null
  let last: AlertDelivery | null = null
  let chosen: AlertKind | null = null
  let permissionRequests = 0
  let notificationShows = 0
  const browser = browserNotificationPort()
  const port = {
    permission: browser.permission,
    requestPermission() {
      permissionRequests++
      return browser.requestPermission()
    },
    show(kind: AlertKind, click: () => void, fail: () => void) {
      notificationShows++
      return browser.show(kind, click, fail)
    },
  }
  function View() {
    const latest = useOwnedAlertDelivery()
    const latestAuth = useAuth()
    useLayoutEffect(() => {
      control = latest
      auth = latestAuth
    })
    const delivery = latest.getDelivery()
    return createElement(
      'div',
      null,
      createElement('p', { className: 'small muted' }, '개발 검증 · 안내 입력은 합성입니다.'),
      createElement('output', { 'data-testid': 'owned-alert-state' }, latest.state.status),
      createElement(
        'button',
        {
          className: 'button secondary',
          type: 'button',
          onClick: () => {
            void latest
              .prepare({
                port,
                onChoose: (kind) => {
                  chosen = kind
                },
              })
              .then((value) => {
                if (value) last = value
              })
          },
        },
        '설정 연결',
      ),
      createElement(
        'button',
        {
          className: 'button secondary',
          type: 'button',
          onClick: () => latest.getDelivery()?.receive('posture'),
        },
        '합성 자세 안내',
      ),
      createElement(
        'button',
        {
          className: 'button secondary',
          type: 'button',
          onClick: () => latest.getDelivery()?.receive('sitting'),
        },
        '합성 장시간 안내',
      ),
      createElement(
        'button',
        {
          className: 'button secondary',
          type: 'button',
          onClick: () => latest.cancel(),
        },
        '연결 닫기',
      ),
      delivery ? createElement(AlertDeliveryPanel, { delivery }) : null,
    )
  }
  const old = document.getElementById('root')
  if (old) old.style.display = 'none'
  const host = document.createElement('main')
  host.className = 'website'
  host.style.cssText = 'width:100%;padding:48px'
  document.body.append(host)
  const root = createRoot(host)
  root.render(createElement(AuthProvider, null, createElement(View)))
  return {
    refresh: () => auth?.refresh(),
    signOut: () => auth?.signOut(),
    receiveOld: (kind: AlertKind) => last?.receive(kind) ?? false,
    state: () => ({
      auth: auth?.state.status ?? 'unmounted',
      status: control?.state.status ?? 'unmounted',
      active: (control?.getDelivery() ?? null) !== null,
      last: last?.getSnapshot() ?? null,
      chosen,
      permissionRequests,
      notificationShows,
      syntheticTriggers: true,
    }),
    unmount() {
      root.unmount()
      control = null
      auth = null
      host.remove()
      if (old) old.style.display = ''
    },
  }
}
