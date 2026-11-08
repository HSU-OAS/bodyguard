// @vitest-environment happy-dom
// FR-S-01/06, FR-U-04: UI fixture tests are not actual HTTP/SQL or coaching approval.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function open(path = '/dev/select', status = 200) {
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

it.each([
  ['chin-retraction', '턱 당기기'],
  ['cross-body-shoulder', '팔 교차 어깨 늘이기'],
  ['lateral-trunk', '옆구리 늘이기'],
  ['seated-trunk-rotation', '상체 비틀기'],
])('S3.3 opens guidance detail %s without automatic coaching', async (id, title) => {
  const fetcher = open(`/dev/select?motion=${id}`)
  await screen.findByRole('heading', { name: title, level: 1 })
  expect(screen.getByText('안내만 후보 · 자동 판정 없음')).toBeTruthy()
  expect(screen.getByRole('button', { name: '코칭 준비 중' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText(/자동 성공.*타이머|자동 교정.*타이머/)).toBeTruthy()
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/api/v1/me'])
})

it('C-01 hides content while account confirmation is pending', async () => {
  window.history.replaceState(null, '', '/dev/select')
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
  render(<App />)
  expect(screen.getByRole('heading', { name: '계정을 확인하고 있습니다' })).toBeTruthy()
  expect(screen.queryByText('목 옆으로 기울이기')).toBeNull()
})
it('C-01 guest does not see the catalog and uses the unchanged login return', async () => {
  open('/dev/select?motion=neck-side', 401)
  expect(await screen.findByRole('heading', { name: '로그인' })).toBeTruthy()
  expect(screen.queryByText('목 옆으로 기울이기')).toBeNull()
  expect(window.location.search).toBe('?next=%2Fstart')
})
it('C-01 server error stays closed and has retry', async () => {
  const fetcher = open('/dev/select', 503)
  expect(await screen.findByRole('heading', { name: '연결을 확인해 주세요' })).toBeTruthy()
  expect(screen.queryByText('목 옆으로 기울이기')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
})
it('C-02 filters a real empty list and restores it', async () => {
  open()
  await screen.findByRole('heading', { name: '원하는 동작을 골라보세요' })
  fireEvent.change(screen.getByLabelText('동작 검색'), { target: { value: '없는 동작' } })
  expect(await screen.findByText('조건에 맞는 동작이 없습니다')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '검색과 필터 초기화' }))
  expect(await screen.findByRole('link', { name: '목 옆으로 기울이기 안내 보기' })).toBeTruthy()
})
it('C-03/05 selected detail has sources and disabled coaching, without media or new API', async () => {
  const fetcher = open('/dev/select?motion=neck-side')
  expect(await screen.findByRole('heading', { name: '목 옆으로 기울이기', level: 1 })).toBeTruthy()
  expect(screen.getByRole('heading', { name: '수행 과정' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '코칭 준비 중' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Cambridge University Hospitals · 원문').getAttribute('rel')).toContain(
    'noreferrer',
  )
  expect(document.querySelectorAll('video, canvas')).toHaveLength(0)
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/api/v1/me'])
})
it('C-04 unknown ID is a recoverable missing detail, not a fallback motion', async () => {
  open('/dev/select?motion=__proto__')
  expect(await screen.findByRole('heading', { name: '동작을 찾을 수 없습니다' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '목 옆으로 기울이기' })).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
  expect(await screen.findByRole('heading', { name: '원하는 동작을 골라보세요' })).toBeTruthy()
})
it('C-04 selecting and returning preserves search and filters', async () => {
  open('/dev/select?search=목&region=neck')
  fireEvent.click(await screen.findByRole('link', { name: '목 옆으로 기울이기 안내 보기' }))
  await screen.findByRole('heading', { name: '목 옆으로 기울이기', level: 1 })
  fireEvent.click(screen.getByRole('link', { name: '목록으로 돌아가기' }))
  expect(await screen.findByLabelText('동작 검색')).toHaveProperty('value', '목')
  expect(screen.getByRole('button', { name: '목', pressed: true })).toBeTruthy()
})
it('C-01 focus recheck removes selected content before the next account response', async () => {
  const fetcher = open('/dev/select?motion=neck-side')
  await screen.findByRole('heading', { name: '목 옆으로 기울이기', level: 1 })
  fetcher.mockResolvedValue(new Response('{}', { status: 401 }))
  fireEvent(window, new Event('focus'))
  expect(screen.queryByRole('heading', { name: '목 옆으로 기울이기', level: 1 })).toBeNull()
  expect(await screen.findByRole('heading', { name: '로그인' })).toBeTruthy()
})

it('C-07 cached navigation keeps the selection page title', async () => {
  open()
  await screen.findByRole('heading', { name: '원하는 동작을 골라보세요' })
  fireEvent.click(screen.getByRole('link', { name: '내 시작' }))
  await screen.findByRole('heading', { name: '내 몸을 위한 시작' })
  fireEvent.click(screen.getByRole('link', { name: '동작 선택 개발 검수' }))
  await screen.findByRole('heading', { name: '원하는 동작을 골라보세요' })
  expect(document.title).toBe('동작 선택 · BODYGUARD')
})
