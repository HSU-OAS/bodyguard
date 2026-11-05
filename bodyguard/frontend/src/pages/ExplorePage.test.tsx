// @vitest-environment happy-dom
// FR-S-06: DOM fixture only, not actual webcam validation.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { ExplorePage } from './ExplorePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it.each([401, 503])('keeps the explore route protected for account status %s', async (status) => {
  window.history.replaceState(null, '', '/explore')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })))
  render(<App />)
  await screen.findByRole('heading', {
    name: status === 401 ? '로그인' : '연결을 확인해 주세요',
  })
  expect(screen.queryByRole('heading', { name: '스트레칭 시작 경로' })).toBeNull()
})
it('shows a genuine empty release catalog, not development candidates', () => {
  render(
    <MemoryRouter>
      <ExplorePage />
    </MemoryRouter>,
  )
  expect(screen.getByRole('status').textContent).toContain('현재 이용 가능한 동작이 없습니다')
  expect(screen.queryByText('목 옆으로 기울이기')).toBeNull()
  expect(screen.getByRole('link', { name: '내 시작으로 돌아가기' }).getAttribute('href')).toBe(
    '/start',
  )
})
it('selects a purpose without inventing body findings and returns to selection', () => {
  render(
    <MemoryRouter>
      <ExplorePage />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: '추천받기' }))
  expect(screen.getByRole('status').textContent).toContain('부위를 선택')
  fireEvent.click(screen.getByRole('radio', { name: '어깨' }))
  expect((screen.getByRole('radio', { name: '어깨' }) as HTMLInputElement).checked).toBe(true)
  expect(screen.getByRole('status').textContent).toContain('신체 확인 정보가 없어')
  expect(screen.queryByRole('button', { name: '코칭 시작' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '직접 선택으로 이동' }))
  expect(screen.getByRole('status').textContent).toContain('현재 이용 가능한 동작이 없습니다')
})
