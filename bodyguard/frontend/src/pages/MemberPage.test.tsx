// @vitest-environment happy-dom
// FR-U-04/05: first red asserts the actual protected account entry, not a mock component.
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth'
import { MemberPage } from './MemberPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('AW-01 verified account exposes records and a separate withdrawal entry', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ id: 'own-user', email: 'own@example.com' }))),
  )
  render(
    <MemoryRouter>
      <AuthProvider>
        <MemberPage />
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByText('own@example.com')
  expect(screen.getByRole('link', { name: '수행 기록 관리' }).getAttribute('href')).toBe('/records')
  expect(screen.getByRole('link', { name: '회원 탈퇴 안내' }).getAttribute('href')).toBe(
    '/account/delete',
  )
})

// S4.D4 / FR-U-04/05: compact copy retains state, deletion scope and named navigation.
it('MC-01 keeps essential account meaning within a compact description budget', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ id: 'own-user', email: 'own@example.com' }))),
  )
  const rendered = render(
    <MemoryRouter>
      <AuthProvider>
        <MemberPage />
      </AuthProvider>
    </MemoryRouter>,
  )
  await screen.findByText('own@example.com')
  const rootElement = rendered.baseElement
  const description = [...rootElement.querySelectorAll('.member-section p')]
    .map((element) => element.textContent)
    .join('')
    .replace(/\s/g, '')
  expect(description.length).toBeLessThanOrEqual(110)
  expect(rootElement.querySelector('.member-lead')).toBeNull()
  expect(screen.getByText('기간별로 조회·삭제합니다.')).toBeTruthy()
  expect(screen.getByText('1분별 측정 시간·부위별 편차 조회와 기간별 삭제.')).toBeTruthy()
  expect(screen.getByText(/실제 알림은 연결 전입니다/)).toBeTruthy()
  expect(screen.getByText('본인 확인 후 계정과 자세·수행 기록을 삭제합니다.')).toBeTruthy()
  for (const [name, href] of [
    ['수행 기록 관리', '/records'],
    ['자세 기록 관리', '/posture-records'],
    ['알림 설정 관리', '/account/notifications'],
    ['회원 탈퇴 안내', '/account/delete'],
  ]) {
    expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href)
  }
  const section = screen.getByRole('region', { name: '로그인 정보' })
  expect(within(section).getByRole('button', { name: '로그아웃' })).toBeTruthy()
})
