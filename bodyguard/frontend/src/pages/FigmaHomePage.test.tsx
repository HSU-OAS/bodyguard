// @vitest-environment happy-dom
// FR-S-06/FR-V-03: layout review never enables unimplemented motions as coaching.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FigmaHomePage } from './FigmaHomePage'

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('requires a supported candidate and keeps the coaching link in the development review', () => {
  render(
    <MemoryRouter>
      <FigmaHomePage />
    </MemoryRouter>,
  )
  expect(
    (screen.getByRole('button', { name: '동작을 선택해 주세요' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect((screen.getByRole('button', { name: /기지개 켜기/ }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  fireEvent.click(screen.getByRole('button', { name: '목 옆 늘리기' }))
  expect(screen.getByRole('link', { name: '코칭 화면 보기' }).getAttribute('href')).toBe(
    '/dev/coaching?motion=neck-side&preview=1',
  )
  expect(screen.getByRole('button', { name: '목 옆 늘리기' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  fireEvent.pointerDown(screen.getByRole('img', { name: '턱 당기기 정지 시안' }))
  expect(screen.getByRole('link', { name: '코칭 화면 보기' }).getAttribute('href')).toBe(
    '/dev/coaching?motion=chin-retraction&preview=1',
  )
})

it('collapses and reopens the panels without claiming unavailable features', () => {
  render(
    <MemoryRouter>
      <FigmaHomePage />
    </MemoryRouter>,
  )
  expect((screen.getByRole('button', { name: /AI 신체 분석/ }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  fireEvent.click(screen.getByRole('button', { name: '서비스 메뉴 접기' }))
  expect(screen.queryByRole('link', { name: '스트레칭 기록' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '서비스 메뉴 펼치기' }))
  expect(screen.getByRole('link', { name: '스트레칭 기록' }).getAttribute('href')).toBe('/records')
  fireEvent.click(screen.getByRole('button', { name: '동작 목록 접기' }))
  expect(screen.queryByRole('button', { name: '목 옆 늘리기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '동작 목록 펼치기' }))
  expect(screen.getByRole('button', { name: '목 옆 늘리기' })).toBeTruthy()
})
