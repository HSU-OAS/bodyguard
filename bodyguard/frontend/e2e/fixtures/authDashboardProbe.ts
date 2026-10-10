// FR-R-03/06, FR-U-04: TEST ONLY actual provider/reader; synthetic stored summaries.
import { createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { DashboardQuery } from '../../src/api/dashboard'
import { AuthProvider, useAuth } from '../../src/auth'
import { useOwnedDashboard } from '../../src/records/useOwnedDashboard'

export function mountAuthDashboardProbe(query: DashboardQuery) {
  let control: ReturnType<typeof useOwnedDashboard> | null = null
  let auth: ReturnType<typeof useAuth> | null = null
  function View() {
    const latest = useOwnedDashboard(),
      latestAuth = useAuth()
    useLayoutEffect(() => {
      control = latest
      auth = latestAuth
    })
    return createElement(
      'section',
      { 'aria-label': '연결 검증용 화면' },
      createElement('p', null, '개발 검증용 · 확정 화면 아님'),
      createElement('output', { 'data-testid': 'dashboard-status' }, latest.state.status),
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => {
            void latest.read(query)
          },
        },
        '조회',
      ),
      createElement('button', { type: 'button', onClick: latest.cancel }, '조회 취소'),
    )
  }
  const host = document.createElement('main')
  document.body.append(host)
  const root = createRoot(host)
  root.render(createElement(AuthProvider, null, createElement(View)))
  return {
    async read(value = query) {
      await control?.read(value)
    },
    cancel: () => control?.cancel(),
    refresh: () => auth?.refresh(),
    signOut: () => auth?.signOut(),
    state() {
      const state = control?.getSnapshot()
      return {
        auth: auth?.state.status ?? 'unmounted',
        status: state?.status ?? 'unmounted',
        minutes: state?.status === 'ready' ? state.value.totals.minutes : null,
        clientReported:
          state?.status === 'ready' ? state.value.provenance === 'client-reported' : null,
        notificationsMissing: state?.status === 'ready' ? state.value.notifications === null : null,
        statusCode: state?.status === 'error' ? state.statusCode : null,
      }
    },
    unmount() {
      root.unmount()
      auth = null
      host.remove()
    },
  }
}
