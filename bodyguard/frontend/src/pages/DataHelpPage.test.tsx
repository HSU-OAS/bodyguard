// @vitest-environment happy-dom
// FR-V-01/NFR-08: first red is the real web route; no replacement page mock.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})
it.each([
  ['/help', '도움말'],
  ['/data', '카메라와 데이터 안내'],
])('DH-01 real public route%s exposes%s without private data', async (path, title) => {
  const fetcher = vi.fn(async (_url: string) => new Response(null, { status: 401 }))
  vi.stubGlobal('fetch', fetcher)
  window.history.replaceState(null, '', path as string)
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await screen.findByRole('heading', { level: 1, name: title as string })
  expect(fetcher.mock.calls.every((call) => call[0] === '/api/v1/me')).toBe(true)
})

// FR-V-01/FR-U-04: public information survives private-account failure.
it.each(['guest', 'member', 'offline'])('DH-02 public navigation while %s', async (state) => {
  const fetcher = vi.fn(async (_url: string) => {
    if (state === 'offline') throw new Error('Synthetic account connection failure')
    return state === 'member'
      ? Response.json({ id: 'fixture-member', email: 'fixture@example.com' })
      : new Response(null, { status: 401 })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<App />)
  await within(screen.getByRole('navigation', { name: '계정 메뉴' })).findByRole('link', {
    name: state === 'member' ? '내 계정' : '로그인',
  })
  const footer = within(screen.getByRole('navigation', { name: '서비스 안내' }))
  fireEvent.click(footer.getByRole('link', { name: '도움말' }))
  const heading = await screen.findByRole('heading', { level: 1, name: '도움말' })
  expect(document.activeElement).toBe(heading)
  expect(document.title).toBe('도움말 · BODYGUARD')
  expect(screen.getByRole('link', { name: '계정 복구' }).getAttribute('href')).toBe(
    '/password/forgot',
  )
  expect(document.querySelectorAll('details > summary')).toHaveLength(5)
  fireEvent.click(footer.getByRole('link', { name: '카메라·데이터 안내' }))
  await screen.findByRole('heading', { level: 1, name: '카메라와 데이터 안내' })
  expect(document.title).toBe('카메라와 데이터 안내 · BODYGUARD')
  expect(screen.getByText('현재 카메라 코칭은 연결 전입니다.')).toBeTruthy()
  expect(screen.getByText(/법정 개인정보 처리방침이나 동의 절차를 대신하지 않습니다/)).toBeTruthy()
  expect(screen.getByRole('link', { name: '수행 기록 관리' }).getAttribute('href')).toBe('/records')
  expect(screen.getByRole('link', { name: '계정 관리·탈퇴' }).getAttribute('href')).toBe('/account')
  expect(fetcher.mock.calls.every((call) => call[0] === '/api/v1/me')).toBe(true)
})
