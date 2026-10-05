// @vitest-environment happy-dom
// FR-U-04/05: first red asserts the actual protected account entry, not a mock component.
import { cleanup, render, screen } from '@testing-library/react'
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
