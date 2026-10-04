// @vitest-environment happy-dom
// FR-R-03/FR-U-04: controlled DOM/network faults, not real exercise records.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const id = '00000000-0000-4000-8000-000000000001'
function row(index = 1) {
  const end = new Date()
  return {
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
    motion_id: index === 1 ? 'neck-side' : `fixture-${index}`,
    protocol_version: 'fixture-not-release',
    started_at: new Date(end.getTime() - 40000).toISOString(),
    ended_at: end.toISOString(),
    created_at: end.toISOString(),
    outcome: 'interrupted',
    observed_ms: 12000,
    repetitions: 0,
    provenance: 'client-reported',
  }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
function stub(
  records: (url: string, init?: RequestInit) => Promise<Response>,
  me = () => json({ id: 'fixture-owner', email: 'fixture@example.com' }),
) {
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/v1/me') return Promise.resolve(me())
    if (url === '/api/v1/auth/google/status') return Promise.resolve(json({ configured: false }))
    return records(url, init)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function open(path = '/records') {
  window.history.replaceState(null, '', path)
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it.each([401, 503])('blocks private records when account check returns %s', async (status) => {
  const records = vi.fn(async () => json({ items: [], has_more: false }))
  stub(records, () => json({}, status))
  open()
  await screen.findByRole('heading', {
    name: status === 401 ? '다시 만나 반갑습니다' : '연결을 확인해 주세요',
  })
  expect(records).not.toHaveBeenCalled()
})
it('shows loading, genuine empty period and start recovery without invented scores', async () => {
  let resolve: (value: Response) => void = () => {}
  stub(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  open()
  await screen.findByText('기록을 불러오고 있습니다.')
  await act(async () => resolve(json({ items: [], has_more: false })))
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
  expect(screen.getByRole('link', { name: '스트레칭 시작 경로 선택' }).getAttribute('href')).toBe(
    '/explore',
  )
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.queryByText(/성공률|점수:/)).toBeNull()
})
it('opens real-shaped detail and preserves the selected period on return', async () => {
  stub(async (url) => json(url.includes('?') ? { items: [row()], has_more: false } : row()))
  open('/records?from=2026-09-01&to=2026-09-30')
  const link = await screen.findByRole('link', { name: /neck-side.*기록 상세/ })
  expect(screen.getByText('12초')).toBeTruthy()
  fireEvent.click(link)
  await screen.findByText('fixture-not-release')
  expect(document.title).toBe('수행 기록 상세 · BODYGUARD')
  expect(screen.getByText('중단')).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: '기록 목록으로 돌아가기' }))
  await screen.findByRole('table')
  expect((screen.getByLabelText('시작일') as HTMLInputElement).value).toBe('2026-09-01')
  expect((screen.getByLabelText('종료일') as HTMLInputElement).value).toBe('2026-09-30')
})
it('changes pages using the same query cutoff and never appends duplicates', async () => {
  const fetcher = stub(async (url) =>
    json(
      url.includes('offset=20')
        ? { items: [row(21)], has_more: false }
        : { items: Array.from({ length: 20 }, (_, i) => row(i + 1)), has_more: true },
    ),
  )
  open()
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  await screen.findByRole('link', { name: /fixture-21.*기록 상세/ })
  expect(screen.queryByRole('link', { name: /neck-side.*기록 상세/ })).toBeNull()
  expect((screen.getByRole('button', { name: '다음 페이지' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  const calls = fetcher.mock.calls.filter(([url]) => url.startsWith('/api/v1/records/'))
  const ends = calls.map(([url]) => new URL(url, 'http://localhost').searchParams.get('end'))
  expect(new Set(ends).size).toBe(1)
  fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }))
  await screen.findByRole('link', { name: /neck-side.*기록 상세/ })
})
it('retries a failed read, keeps raw error out of the page and does not call it empty', async () => {
  let failed = true
  stub(async () =>
    failed ? json({ detail: 'private raw error' }, 503) : json({ items: [], has_more: false }),
  )
  open()
  await screen.findByRole('heading', { name: '기록을 불러오지 못했습니다' })
  expect(document.body.textContent).not.toContain('private raw error')
  expect(screen.queryByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })).toBeNull()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: '다시 조회' }))
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
})
it.each([id, 'not-a-record'])('handles unavailable/invalid detail safely: %s', async (record) => {
  const records = vi.fn(async () => json({}, 404))
  stub(records)
  open(`/records/${record}`)
  await screen.findByRole('heading', { name: '기록을 찾을 수 없습니다' })
  if (record !== id) expect(records).not.toHaveBeenCalled()
})
it('rechecks the account after a records 401 and discards private content', async () => {
  let expired = false
  stub(
    async () => {
      expired = true
      return json({}, 401)
    },
    () => (expired ? json({}, 401) : json({ id: 'fixture-owner', email: 'fixture@example.com' })),
  )
  open()
  await screen.findByRole('heading', { name: '다시 만나 반갑습니다' })
  expect(screen.queryByRole('heading', { name: '내 수행 기록' })).toBeNull()
})
it('focus recheck hides loaded private data before its answer and ignores late data', async () => {
  let expired = false
  let release: (value: Response) => void = () => {}
  stub(
    async () => json({ items: [row()], has_more: false }),
    () => (expired ? json({}, 401) : json({ id: 'fixture-owner', email: 'fixture@example.com' })),
  )
  open()
  await screen.findByRole('table')
  expired = true
  fireEvent(window, new Event('focus'))
  expect(screen.queryByRole('table')).toBeNull()
  await screen.findByRole('heading', { name: '다시 만나 반갑습니다' })
  cleanup()
  expired = false
  stub(
    () =>
      new Promise((done) => {
        release = done
      }),
    () => (expired ? json({}, 401) : json({ id: 'fixture-owner', email: 'fixture@example.com' })),
  )
  open()
  await screen.findByText('기록을 불러오고 있습니다.')
  expired = true
  fireEvent(window, new Event('focus'))
  await screen.findByRole('heading', { name: '다시 만나 반갑습니다' })
  await act(async () => release(json({ items: [row()], has_more: false })))
  expect(screen.queryByRole('table')).toBeNull()
})
it('rejects invalid query periods without reading and recovers to recent records', async () => {
  const records = vi.fn(async () => json({ items: [], has_more: false }))
  stub(records)
  open('/records?from=2026-02-30&to=2026-02-01')
  await screen.findByRole('heading', { name: '조회 기간을 확인해 주세요' })
  expect(records).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', { name: '최근 기록으로 돌아가기' }))
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
})
it('new period clears previous rows and returns to page one, without storing records', async () => {
  let release: (value: Response) => void = () => {}
  const fetcher = stub(async (url) =>
    new URL(url, 'http://localhost').searchParams.get('start') ===
    new Date('2026-09-01T00:00:00').toISOString()
      ? new Promise((done) => {
          release = done
        })
      : json({ items: [row()], has_more: false }),
  )
  open()
  await screen.findByRole('table')
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-09-01' } })
  fireEvent.change(screen.getByLabelText('종료일'), { target: { value: '2026-09-02' } })
  fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
  expect(screen.queryByRole('table')).toBeNull()
  await act(async () => release(json({ items: [], has_more: false })))
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
  expect(fetcher.mock.calls.some(([url]) => url.includes('offset=20'))).toBe(false)
  expect([localStorage.length, sessionStorage.length]).toEqual([0, 0])
  await waitFor(() => expect(document.title).toBe('내 수행 기록 · BODYGUARD'))
})
