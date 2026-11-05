// @vitest-environment happy-dom
// FR-U-04: DOM uses synthetic auth responses; separate browser uses actual HTTP/SQL.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})
const account = { id: '00000000-0000-4000-8000-000000000001', email: 'return@example.com' }
function setupAuth() {
  let signedIn = false
  const fetcher = vi.fn().mockImplementation((url: string) => {
    if (url === '/api/v1/auth/login') signedIn = true
    const value =
      url === '/api/v1/auth/google/status'
        ? { configured: false }
        : url === '/api/v1/auth/csrf'
          ? { csrf_token: 'f'.repeat(64) }
          : url === '/api/v1/me' || url === '/api/v1/auth/login'
            ? account
            : { items: [], has_more: false }
    return Promise.resolve(
      new Response(JSON.stringify(value), {
        status: url === '/api/v1/me' && !signedIn ? 401 : 200,
      }),
    )
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
it.each([
  ['/records?from=2026-10-01&to=2026-10-09', '/records?from=2026-10-01&to=2026-10-09'],
  [
    '/posture-records?from=2026-10-01&to=2026-10-09&page=2',
    '/posture-records?from=2026-10-01&to=2026-10-09&page=2',
  ],
  ['/ACCOUNT/NOTIFICATIONS/', '/account/notifications'],
])('개인 주소 %s의 로그인 목적은 이미 구현된 동일 화면이다', async (path, expected) => {
  setupAuth()
  window.history.replaceState(null, '', path)
  render(<App />)
  await screen.findByRole('heading', { name: '로그인' })
  expect(new URLSearchParams(window.location.search).get('next')).toBe(expected)
})
it('기록 진입→가입/로그인 전환→이메일 로그인 뒤 원래 기간으로 복귀한다', async () => {
  const destination = '/records?from=2026-10-01&to=2026-10-09'
  setupAuth()
  window.history.replaceState(null, '', '/records?from=2026-10-01&to=2026-10-09')
  render(<App />)
  await screen.findByRole('heading', { name: '로그인' })
  fireEvent.click(screen.getByRole('link', { name: '회원가입' }))
  await screen.findByRole('heading', { name: '나를 위한 움직임의 시작' })
  expect(new URLSearchParams(window.location.search).get('next')).toBe(destination)
  const links = screen.getAllByRole('link', { name: '로그인' })
  fireEvent.click(links[links.length - 1])
  await screen.findByRole('heading', { name: '로그인' })
  fireEvent.change(screen.getByLabelText('이메일', { exact: true }), {
    target: { value: account.email },
  })
  fireEvent.change(screen.getByLabelText('비밀번호', { exact: true }), {
    target: { value: 'test-password-long-123' },
  })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))
  await waitFor(() => expect(window.location.pathname + window.location.search).toBe(destination))
})

it('서버 상태를 확인하지 못하면 복귀 목적이 있어도 개인 화면을 열지 않는다', async () => {
  window.history.replaceState(null, '', '/records?from=2026-10-01&to=2026-10-09')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
  render(<App />)
  await screen.findByRole('heading', { name: '연결을 확인해 주세요' })
  expect(screen.queryByRole('heading', { name: '내 수행 기록' })).toBeNull()
  expect(screen.queryByRole('heading', { name: '로그인' })).toBeNull()
  expect(window.location.pathname).toBe('/records')
})
