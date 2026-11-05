// @vitest-environment happy-dom
// FR-R-03/FR-U-04: controlled DOM/network faults, not real exercise records.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { defaultPeriod, localDay } from '../api/records'

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
    if (url === '/api/v1/auth/csrf') return Promise.resolve(json({ csrf_token: 'a'.repeat(64) }))
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
    name: status === 401 ? '로그인' : '연결을 확인해 주세요',
  })
  expect(records).not.toHaveBeenCalled()
})
it('shows loading, genuine empty period and start recovery without invented scores', async () => {
  const pending: { signal?: AbortSignal | null; resolve: (value: Response) => void }[] = []
  stub(
    (_url, init) =>
      new Promise((done) => {
        pending.push({ signal: init?.signal, resolve: done })
      }),
  )
  open()
  await screen.findByText('기록을 불러오고 있습니다.')
  // FR-R-03: loading renders before fetch; resolve only a started, non-aborted request.
  await waitFor(() => expect(pending.some((request) => !request.signal?.aborted)).toBe(true))
  await act(async () => {
    for (const request of pending) request.resolve(json({ items: [], has_more: false }))
  })
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
it('switches day/week ranges and shows a total only when the returned list is complete', async () => {
  let paginated = false
  stub(async () => json({ items: [row()], has_more: paginated }))
  open()
  await screen.findByRole('table')
  expect(screen.getByText('기록 1건')).toBeTruthy()
  expect(screen.getByText('관찰 시간 12초')).toBeTruthy()
  const { to } = defaultPeriod()
  fireEvent.click(screen.getByRole('button', { name: '일간' }))
  await waitFor(() => expect(new URLSearchParams(location.search).get('from')).toBe(to))
  expect(new URLSearchParams(location.search).get('to')).toBe(to)
  fireEvent.click(screen.getByRole('button', { name: '주간' }))
  await waitFor(() =>
    expect(new URLSearchParams(location.search).get('from')).toBe(defaultPeriod().from),
  )
  paginated = true
  fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
  await screen.findByRole('button', { name: '다음 페이지' })
  expect(screen.queryByText('기록 1건')).toBeNull()
  expect(screen.getByText('전체 기간 요약은 아직 제공되지 않습니다.')).toBeTruthy()
})
it('a selected calendar day queries that day without retaining a prior week', async () => {
  stub(async () => json({ items: [], has_more: false }))
  open()
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
  fireEvent.click(screen.getByRole('button', { name: '일간' }))
  const previous = new Date()
  previous.setDate(previous.getDate() - 1)
  const day = localDay(previous)
  fireEvent.click(screen.getByRole('button', { name: `${day} 선택` }))
  await waitFor(() => expect(new URLSearchParams(location.search).get('to')).toBe(day))
  expect(new URLSearchParams(location.search).get('from')).toBe(day)
})
it('renders server totals even when the first page is incomplete', async () => {
  stub(async () =>
    json({ items: [row()], has_more: true, total_count: 23, total_observed_ms: 276000 }),
  )
  open()
  await screen.findByRole('table')
  expect(screen.getByText('기록 23건')).toBeTruthy()
  expect(screen.getByText('관찰 시간 4분 36초')).toBeTruthy()
  expect(screen.queryByText('전체 기간 요약은 아직 제공되지 않습니다.')).toBeNull()
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
  await screen.findByRole('heading', { name: '로그인' })
  expect(screen.queryByRole('heading', { name: '스트레칭 기록' })).toBeNull()
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
  await screen.findByRole('heading', { name: '로그인' })
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
  await screen.findByRole('heading', { name: '로그인' })
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
  let release: ((value: Response) => void) | undefined
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
  await waitFor(() => expect(release).toBeTypeOf('function'))
  await act(async () => release?.(json({ items: [], has_more: false })))
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
  expect(fetcher.mock.calls.some(([url]) => url.includes('offset=20'))).toBe(false)
  expect([localStorage.length, sessionStorage.length]).toEqual([0, 0])
  await waitFor(() => expect(document.title).toBe('내 수행 기록 · BODYGUARD'))
})

// S4.D6: minimal copy is not permission to remove outcome/privacy/deletion boundaries.
it('keeps a short outcome notice without repeated introductory copy', async () => {
  stub(async () => json({ items: [row()], has_more: false }))
  open()
  await screen.findByRole('table')
  const notice = document.querySelector('.records-explanation')
  expect(notice?.textContent).toBe(
    '‘완료’는 수행 종료입니다. 자세 정확성·효과를 보장하지 않습니다.',
  )
  expect(notice?.textContent?.replace(/\s/g, '').length).toBeLessThanOrEqual(40)
  expect(document.querySelector('.records-intro')).toBeNull()
  for (const name of ['시작일', '종료일']) expect(screen.getByLabelText(name)).toBeTruthy()
  expect(screen.getByRole('button', { name: '기간 조회' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '이 기간 기록 삭제' })).toBeTruthy()
})
it('keeps summary-only storage explicit on detail with concise copy', async () => {
  stub(async () => json(row()))
  open(`/records/${id}`)
  await screen.findByText('fixture-not-release')
  expect(screen.getByText('수행 요약만 저장하며, 영상·관절 좌표는 저장하지 않습니다.')).toBeTruthy()
  for (const name of ['시작', '종료', '관찰된 수행 시간', '반복 요약', '규칙 버전'])
    expect(screen.getByText(name, { exact: true })).toBeTruthy()
  expect(screen.getByRole('link', { name: '기록 목록으로 돌아가기' })).toBeTruthy()
})

it.each(['/records', `/records/${id}`])(
  'blocks %s after a bound request is rejected until account recheck',
  async (path) => {
    let rejected = true
    const fetcher = stub(async (url, init) => {
      expect(new Headers(init?.headers).get('X-Account-ID')).toBe('fixture-owner')
      return rejected
        ? json({}, 403)
        : json(url.includes('?') ? { items: [row()], has_more: false } : row())
    })
    open(path)
    await screen.findByRole('heading', { name: '계정을 다시 확인해 주세요' })
    // DOM availability precedes the page's passive focus effect under a loaded worker pool.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: '계정을 다시 확인해 주세요' }),
      ),
    )
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: '이 기간 기록 삭제' })).toBeNull()
    const attempts = fetcher.mock.calls.filter(([url]) =>
      url.startsWith('/api/v1/records/stretch'),
    ).length
    if (path === '/records') {
      fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
      await act(async () => {})
      expect(
        fetcher.mock.calls.filter(([url]) => url.startsWith('/api/v1/records/stretch')),
      ).toHaveLength(attempts)
      expect(screen.queryByRole('button', { name: '이 기간 기록 삭제' })).toBeNull()
    }
    rejected = false
    fireEvent.click(screen.getByRole('button', { name: '계정 다시 확인' }))
    if (path === '/records') await screen.findByRole('table')
    else await screen.findByText('fixture-not-release')
  },
)
