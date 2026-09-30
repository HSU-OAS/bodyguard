// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it('B-01 공개 시작은 카메라·시제품 없이 서비스 소개와 계정 진입을 제공한다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(<App />)
  expect(screen.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeTruthy()
  await waitFor(() => expect(screen.getByRole('link', { name: '시작하기' })).toBeTruthy())
  expect(screen.queryByRole('button', { name: '측정 시작' })).toBeNull()
  expect(screen.queryByTestId('measuring-badge')).toBeNull()
})

it('B-01 보호 경로의 401은 로그인으로 이동하며 외부 목적지는 허용하지 않는다', async () => {
  window.history.replaceState(null, '', '/start')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(<App />)
  expect(screen.queryByText('person@example.com')).toBeNull()
  expect(await screen.findByRole('heading', { name: '다시 만나 반갑습니다' })).toBeTruthy()
  expect(window.location.pathname).toBe('/login')
  expect(window.location.search).toBe('?next=%2Fstart')
})

it('B-02 서버 실패는 게스트 폴백 없이 보호 UI를 차단하고 재시도한다', async () => {
  window.history.replaceState(null, '', '/start')
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  render(<App />)
  expect(await screen.findByRole('heading', { name: '연결을 확인해 주세요' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '다시 만나 반갑습니다' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
})
