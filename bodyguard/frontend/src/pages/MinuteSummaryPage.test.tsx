// @vitest-environment happy-dom
// FR-R-03/FR-U-04: first red exercises the real web router; synthetic network only.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  history.replaceState(null, '', '/')
})

const account = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const part = { method: 'fixture-neck', unit: 'deg', dev_mean: null, measured_sec: 0, bad_sec: 0 }
const row = {
  minute_start: '2026-10-01T12:00:00Z',
  baseline_id: null,
  client_version: 'Fixture+V1',
  coverage_sec: 60,
  measured_sec: 30,
  unmeasurable_sec: 20,
  present_sec: 45,
  background_sec: 10,
  any_bad_sec: 15,
  neck: part,
  trunk: { ...part, method: 'fixture-trunk' },
  shoulder: { ...part, method: 'fixture-shoulder', dev_mean: 1.25, measured_sec: 30, bad_sec: 15 },
  created_at: '2026-10-01T12:01:00Z',
  provenance: 'client-reported',
}
beforeEach(() => vi.setSystemTime(new Date('2026-10-06T12:01:00Z')))
function setup(
  handler: (path: string, init?: RequestInit) => unknown | Promise<unknown>,
  search = '',
) {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v1/me') return new Response(JSON.stringify(account))
    if (path === '/api/v1/auth/csrf')
      return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
    const value = await handler(path, init)
    return value instanceof Response ? value : new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetch)
  history.replaceState(null, '', `/posture-records${search}`)
  render(<App />)
  return fetch
}
const listed = () => ({ items: [row], has_more: false })
function preview(init?: RequestInit, count = 1) {
  return {
    ...JSON.parse(init?.body as string),
    cutoff: '2026-10-06T12:01:00.123456Z',
    expires_at: '2026-10-06T12:11:00.123456Z',
    count,
    fingerprint: 'b'.repeat(64),
    signature: 'c'.repeat(64),
  }
}
it('SW02 list → keyboard-ready detail retains per-part denominators and no clinical score', async () => {
  setup(listed)
  await screen.findByRole('button', { name: /2026.*10.*1/ })
  expect(screen.getByRole('link', { name: '자세 기록' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(screen.getByRole('button', { name: /2026.*10.*1/ }))
  const table = await screen.findByRole('table', { name: '선택한 분의 부위별 측정 지표' })
  const shoulder = within(table).getByRole('row', { name: /어깨/ })
  expect(shoulder.textContent).toContain('50%')
  const neck = within(table).getByRole('row', { name: /목/ })
  expect(neck.textContent).toContain('—')
  expect(neck.textContent).not.toContain('0%')
  expect(screen.getByText('보정 전')).toBeTruthy()
  expect(document.title).toBe('내 자세 기록 · BODYGUARD')
})
it.each(['?from=2026-02-30&to=2026-10-01', '?from=2026-10-02&to=2026-10-01', '?page=501'])(
  'SW03 invalid URL %s makes zero data requests and has a recovery path',
  async (query) => {
    const fetch = setup(listed, query)
    await screen.findByRole('heading', { name: '내 자세 기록' })
    expect(fetch.mock.calls.filter(([path]) => path.startsWith('/api/v1/summaries'))).toHaveLength(
      0,
    )
    expect(screen.getByRole('alert').textContent).toContain('올바른 기간')
    fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('종료 날짜'), { target: { value: '2026-10-02' } })
    fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
    await screen.findByRole('button', { name: /2026.*10.*1/ })
  },
)
it('SW04 query failure has explicit retry, without mock normal values', async () => {
  let failed = true
  const fetch = setup(() => (failed ? new Response('', { status: 503 }) : listed()))
  await screen.findByRole('alert')
  expect(screen.queryByRole('table')).toBeNull()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: '다시 조회' }))
  await screen.findByRole('button', { name: /2026.*10.*1/ })
  expect(fetch.mock.calls.filter(([path]) => path.includes('/summaries?'))).toHaveLength(2)
})
it('SW05 late query cannot replace the new period even if fetch ignores abort', async () => {
  let release: ((value: unknown) => void) | undefined
  let calls = 0
  setup(() =>
    ++calls === 1
      ? new Promise((resolve) => {
          release = resolve
        })
      : { items: [], has_more: false },
  )
  await waitFor(() => expect(release).toBeTypeOf('function'))
  fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-02' } })
  fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
  await screen.findByText('이 기간에는 자세 기록이 없습니다')
  await act(async () => release?.(listed()))
  expect(screen.queryByRole('table')).toBeNull()
})
it('SW06 deletion cancellation and exact proof/single mutation/success are visible', async () => {
  const fetch = setup((path, init) =>
    path.endsWith('/delete-preview')
      ? preview(init)
      : path.endsWith('/delete')
        ? { deleted: 1 }
        : listed(),
  )
  await screen.findByRole('button', { name: '삭제 대상 확인' })
  fireEvent.click(screen.getByRole('button', { name: '삭제 대상 확인' }))
  await screen.findByRole('button', { name: '확인한 자세 기록 삭제' })
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(fetch.mock.calls.filter(([path]) => path.endsWith('/delete'))).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: '삭제 대상 확인' }))
  const button = await screen.findByRole('button', { name: '확인한 자세 기록 삭제' })
  fireEvent.click(button)
  fireEvent.click(button)
  await screen.findByText(/자세 기록 1건을 삭제했습니다/)
  expect(screen.queryByRole('table')).toBeNull()
  const writes = fetch.mock.calls.filter(([path]) => path.endsWith('/delete'))
  expect(writes).toHaveLength(1)
  expect(JSON.parse(writes[0]?.[1]?.body as string).cutoff).toBe('2026-10-06T12:01:00.123456Z')
})
it('SW16 deletion confirmation preserves the non-minute-aligned boundary in visible copy', async () => {
  vi.setSystemTime(new Date('2026-10-06T12:01:37.123Z'))
  setup((path, init) => (path.endsWith('/delete-preview') ? preview(init) : listed()))
  fireEvent.click(await screen.findByRole('button', { name: '삭제 대상 확인' }))
  await screen.findByRole('button', { name: '확인한 자세 기록 삭제' })
  expect(screen.getByText(/확인한 기간:/).textContent).toContain(':37.123')
})
it.each([
  new Response('', { status: 503 }),
  { deleted: 2 },
  { deleted: 0.5 },
  { deleted: 1, raw: [] },
])('SW07 uncertain deletion hides stale list and never retries itself', async (response) => {
  const fetch = setup((path, init) =>
    path.endsWith('/delete-preview')
      ? preview(init)
      : path.endsWith('/delete')
        ? response
        : listed(),
  )
  await screen.findByRole('button', { name: '삭제 대상 확인' })
  fireEvent.click(screen.getByRole('button', { name: '삭제 대상 확인' }))
  fireEvent.click(await screen.findByRole('button', { name: '확인한 자세 기록 삭제' }))
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/)
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.queryByRole('button', { name: '확인한 자세 기록 삭제' })).toBeNull()
  expect(fetch.mock.calls.filter(([path]) => path.endsWith('/delete'))).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '기간 다시 조회' }))
  await screen.findByRole('button', { name: /2026.*10.*1/ })
})
it('SW08 zero targets disables confirmation; changed targets require new preview', async () => {
  let targets = 0
  setup((path, init) =>
    path.endsWith('/delete-preview')
      ? preview(init, targets)
      : path.endsWith('/delete')
        ? new Response('', { status: 409 })
        : listed(),
  )
  await screen.findByRole('button', { name: '삭제 대상 확인' })
  fireEvent.click(screen.getByRole('button', { name: '삭제 대상 확인' }))
  const zero = await screen.findByRole('button', { name: '확인한 자세 기록 삭제' })
  expect((zero as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  targets = 1
  fireEvent.click(screen.getByRole('button', { name: '삭제 대상 확인' }))
  fireEvent.click(await screen.findByRole('button', { name: '확인한 자세 기록 삭제' }))
  await screen.findByText(/삭제 대상이 바뀌었거나/)
  fireEvent.click(screen.getByRole('button', { name: '삭제 대상 다시 확인' }))
  await screen.findByRole('button', { name: '확인한 자세 기록 삭제' })
})

it('SW09 editing a date disposes the old deletion proof before another query', async () => {
  setup((path, init) => (path.endsWith('/delete-preview') ? preview(init) : listed()))
  fireEvent.click(await screen.findByRole('button', { name: '삭제 대상 확인' }))
  await screen.findByRole('button', { name: '확인한 자세 기록 삭제' })
  fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-02' } })
  expect(screen.queryByRole('button', { name: '확인한 자세 기록 삭제' })).toBeNull()
})
it('SW10 later empty page is not an empty period; pagination restores results focus', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  const rows = Array.from({ length: 20 }, (_, index) => ({
    ...row,
    minute_start: new Date(Date.parse(row.minute_start) - index * 60000).toISOString(),
  }))
  setup((path) =>
    new URL(path, 'http://localhost').searchParams.get('offset') === '0'
      ? { items: rows, has_more: true }
      : { items: [], has_more: false },
  )
  const next = await screen.findByRole('button', { name: '다음 기록' })
  next.focus()
  fireEvent.click(next)
  await screen.findByText('이 페이지에는 자세 기록이 없습니다')
  expect(screen.queryByText('이 기간에는 자세 기록이 없습니다')).toBeNull()
  expect(document.activeElement?.id).toBe('summary-results-heading')
})
it('SW11 cancellation returns keyboard focus to the deletion entry', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  setup((path, init) => (path.endsWith('/delete-preview') ? preview(init) : listed()))
  fireEvent.click(await screen.findByRole('button', { name: '삭제 대상 확인' }))
  const cancel = await screen.findByRole('button', { name: '취소' })
  cancel.focus()
  fireEvent.click(cancel)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '삭제 대상 확인' }))
})

it('SW12 repeated 403 stops data requests until the user explicitly rechecks the account', async () => {
  const fetch = setup(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1))
    return new Response('', { status: 403 })
  })
  const recheck = await screen.findByRole('button', { name: '계정 다시 확인' })
  expect(fetch.mock.calls.filter(([path]) => path.includes('/summaries?'))).toHaveLength(1)
  expect(screen.queryByRole('table')).toBeNull()
  fireEvent.click(recheck)
  await screen.findByRole('button', { name: '계정 다시 확인' })
  expect(fetch.mock.calls.filter(([path]) => path.includes('/summaries?'))).toHaveLength(2)
})

it('SW13 offset10000 has an explicit narrowing path, never an out-of-bounds next request', async () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    ...row,
    minute_start: new Date(Date.parse(row.minute_start) - index * 60000).toISOString(),
  }))
  const fetch = setup(() => ({ items: rows, has_more: true }), '?page=500')
  await screen.findByText(/날짜 범위를 좁혀 남은 기록/)
  expect((screen.getByRole('button', { name: '다음 기록' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(fetch.mock.calls.some(([path]) => path.includes('offset=10000'))).toBe(true)
})
it('SW14 page navigation retains the query cutoff even as wall time advances', async () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({
    ...row,
    minute_start: new Date(Date.parse(row.minute_start) - index * 60000).toISOString(),
  }))
  const fetch = setup((path) =>
    new URL(path, 'http://localhost').searchParams.get('offset') === '0'
      ? { items: rows, has_more: true }
      : { items: [], has_more: false },
  )
  const next = await screen.findByRole('button', { name: '다음 기록' })
  vi.setSystemTime(new Date('2026-10-06T13:01:00Z'))
  fireEvent.click(next)
  await screen.findByText('이 페이지에는 자세 기록이 없습니다')
  const ends = fetch.mock.calls
    .filter(([path]) => path.includes('/summaries?'))
    .map(([path]) => new URL(path, 'http://localhost').searchParams.get('end'))
  expect(ends).toHaveLength(2)
  expect(ends[0]).toBe(ends[1])
})
it.each(['list', 'preview', 'remove'] as const)(
  'SW15 committed A→B discards a late %s completion and old proof',
  async (kind) => {
    let changed = false
    let release: ((value: unknown) => void) | undefined
    const userB = { id: '00000000-0000-4000-8000-000000000002', email: 'other@example.com' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (path === '/api/v1/me') return new Response(JSON.stringify(changed ? userB : account))
        if (path === '/api/v1/auth/csrf')
          return new Response(JSON.stringify({ csrf_token: (changed ? 'b' : 'a').repeat(64) }))
        if (changed) return new Response(JSON.stringify({ items: [], has_more: false }))
        const isPending =
          kind === 'list'
            ? path.includes('/summaries?')
            : path.endsWith(`/${kind === 'preview' ? 'delete-preview' : 'delete'}`)
        if (isPending)
          return new Response(
            JSON.stringify(
              await new Promise((resolve) => {
                release = resolve
              }),
            ),
          )
        return new Response(
          JSON.stringify(path.endsWith('/delete-preview') ? preview(init) : listed()),
        )
      }),
    )
    history.replaceState(null, '', '/posture-records')
    render(<App />)
    if (kind !== 'list') {
      fireEvent.click(await screen.findByRole('button', { name: '삭제 대상 확인' }))
      if (kind === 'remove')
        fireEvent.click(await screen.findByRole('button', { name: '확인한 자세 기록 삭제' }))
    }
    await waitFor(() => expect(release).toBeTypeOf('function'))
    changed = true
    act(() => window.dispatchEvent(new Event('focus')))
    await screen.findByText('이 기간에는 자세 기록이 없습니다')
    await act(async () =>
      release?.(
        kind === 'list'
          ? listed()
          : kind === 'preview'
            ? {
                ...preview({
                  body: JSON.stringify({
                    start: '2026-09-30T00:00:00.000Z',
                    end: '2026-10-06T12:01:00.000Z',
                  }),
                }),
              }
            : { deleted: 1 },
      ),
    )
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: '확인한 자세 기록 삭제' })).toBeNull()
    expect(screen.queryByText(/1건을 삭제했습니다/)).toBeNull()
  },
)

it('SW01 본인 자세 기록 웹의 빈 상태와 기간 조회를 제공한다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/v1/me')
        return new Response(
          JSON.stringify({
            id: '00000000-0000-4000-8000-000000000001',
            email: 'fixture@example.com',
          }),
        )
      if (url === '/api/v1/auth/csrf')
        return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
      if (url.startsWith('/api/v1/summaries?'))
        return new Response(JSON.stringify({ items: [], has_more: false }))
      throw new Error('Unexpected fixture request')
    }),
  )
  history.replaceState(null, '', '/posture-records')
  render(<App />)
  await screen.findByRole('heading', { name: '내 자세 기록' })
  expect(screen.getByRole('button', { name: '기간 조회' })).toBeTruthy()
  await screen.findByText('이 기간에는 자세 기록이 없습니다')
  expect([localStorage.length, sessionStorage.length]).toEqual([0, 0])
})
