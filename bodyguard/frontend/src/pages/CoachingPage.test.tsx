// @vitest-environment happy-dom
// FR-V-01/03·FR-S-06·FR-U-04: DOM/auth fixtures, no actual motion/avatar claim.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { App } from '../App'

// This DOM test covers account/layout controls, not lazy-module loading speed.
// Actual cold dev loading/SDK execution is covered by test-camera-preparation.mjs.
beforeAll(async () => {
  await import('./CoachingPage')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})
function open(path = '/dev/coaching', status = 200) {
  window.history.replaceState(null, '', path)
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ id: 'fixture-user', email: 'fixture@example.com' }), {
      status,
    }),
  )
  vi.stubGlobal('fetch', fetcher)
  render(<App />)
  return fetcher
}
it.each([401, 503])('does not open workspace before account authority: %s', async (status) => {
  open('/dev/coaching?motion=neck-side', status)
  await screen.findByRole('heading', {
    name: status === 401 ? '다시 만나 반갑습니다' : '연결을 확인해 주세요',
  })
  expect(screen.queryByRole('region', { name: '두 아바타 공간' })).toBeNull()
})
it('changes display framing without starting camera, verdict, timer or a preview before an explicit request', async () => {
  const fetcher = open('/dev/coaching?motion=neck-side')
  await screen.findByRole('heading', { name: '목 옆으로 기울이기', level: 1 })
  fireEvent.click(screen.getByRole('button', { name: /^전신$/ }))
  expect(screen.getByRole('region', { name: '두 아바타 공간' }).getAttribute('data-view')).toBe(
    'full',
  )
  expect(screen.getByRole('button', { name: '코칭 준비 중' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '시범 미리보기' }).hasAttribute('disabled')).toBe(false)
  expect(document.querySelectorAll('video, canvas')).toHaveLength(0)
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/api/v1/me'])
})
it('unknown motion does not silently become a successful or default motion', async () => {
  open('/dev/coaching?motion=__proto__')
  await screen.findByRole('heading', { name: '동작을 찾을 수 없습니다' })
  expect(screen.queryByRole('button', { name: '코칭 시작' })).toBeNull()
  expect(screen.queryByRole('button', { name: '카메라 확인' })).toBeNull()
})
