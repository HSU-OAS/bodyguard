// @vitest-environment happy-dom
// FR-R-03/U-04: actual router, synthetic network; actual HTTP lives in Chrome/PG.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const account = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const zero = {
  minutes: 0,
  coverage_sec: 0,
  measured_sec: 0,
  unmeasurable_sec: 0,
  present_sec: 0,
  background_sec: 0,
  any_bad_sec: 0,
}
function sample(path: string, empty = false) {
  const q = new URL(path, 'http://localhost').searchParams
  const date = q.get('date') ?? '2026-10-01',
    period = q.get('period') ?? 'day'
  const first = new Date(`${date}T00:00:00Z`)
  if (period === 'week') first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7))
  const end = new Date(first)
  end.setUTCDate(end.getUTCDate() + (period === 'week' ? 7 : 1))
  return {
    date,
    period,
    timezone: 'UTC',
    local_start: first.toISOString().slice(0, 10),
    local_end: end.toISOString().slice(0, 10),
    start: first.toISOString(),
    end: end.toISOString(),
    totals: empty
      ? zero
      : {
          ...zero,
          minutes: 1,
          coverage_sec: 60,
          measured_sec: 30,
          unmeasurable_sec: 20,
          present_sec: 45,
          background_sec: 10,
          any_bad_sec: 15,
        },
    metrics: empty
      ? []
      : ['neck', 'shoulder', 'trunk'].map((part) => ({
          part,
          baseline_id: null,
          client_version: 'Fixture+V1',
          method: `fixture-${part}`,
          unit: 'deg',
          dev_mean: part === 'shoulder' ? 1.25 : null,
          measured_sec: part === 'shoulder' ? 30 : 0,
          bad_sec: part === 'shoulder' ? 15 : 0,
          bad_ratio: part === 'shoulder' ? 0.5 : null,
        })),
    stretch: { completed: empty ? 0 : 1, interrupted: 0, skipped: 0 },
    notifications: null,
    provenance: 'client-reported',
  }
}
function setup(
  handler: (path: string) => unknown | Promise<unknown> = sample,
  query = '?date=2026-10-01&period=day&timezone=UTC',
) {
  const fetch = vi.fn(async (path: string) => {
    if (path === '/api/v1/me') return new Response(JSON.stringify(account))
    if (path === '/api/v1/auth/csrf')
      return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
    const value = await handler(path)
    return value instanceof Response ? value : new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetch)
  history.replaceState(null, '', `/dashboard${query}`)
  render(<App />)
  return fetch
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})
it.each(['ready', 'other', 'logout'] as const)(
  'late dashboard after %s cannot restore old records',
  async (kind) => {
    let release: ((value: unknown) => void) | undefined,
      calls = 0,
      guest = false
    const other = { ...account, id: '00000000-0000-4000-8000-000000000002' }
    let current = account
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/v1/me')
          return guest ? new Response('', { status: 401 }) : new Response(JSON.stringify(current))
        if (path === '/api/v1/auth/csrf')
          return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
        const value =
          ++calls === 1
            ? await new Promise((resolve) => {
                release = resolve
              })
            : sample(path, true)
        return new Response(JSON.stringify(value))
      }),
    )
    history.replaceState(null, '', '/dashboard?date=2026-10-01&period=day&timezone=UTC')
    render(<App />)
    await waitFor(() => expect(release).toBeDefined())
    if (kind === 'other') current = other
    if (kind === 'logout') guest = true
    fireEvent(window, new Event('focus'))
    if (kind === 'logout') await screen.findByRole('heading', { name: '다시 만나 반갑습니다' })
    else await screen.findByText('이 기간에는 저장된 기록이 없습니다')
    await act(async () => release?.(sample('/api/v1/records/dashboard?date=2026-10-01')))
    expect(screen.queryByText('1.25 deg')).toBeNull()
  },
)
it('cookie changes before final /me block a valid aggregate in the actual DOM', async () => {
  let calls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (path: string) =>
        new Response(
          JSON.stringify(
            path === '/api/v1/me'
              ? ++calls === 4
                ? { ...account, id: '00000000-0000-4000-8000-000000000002' }
                : account
              : path === '/api/v1/auth/csrf'
                ? { csrf_token: 'a'.repeat(64) }
                : sample(path),
          ),
        ),
    ),
  )
  history.replaceState(null, '', '/dashboard?date=2026-10-01&period=day&timezone=UTC')
  render(<App />)
  await screen.findByRole('button', { name: '계정 다시 확인' })
  expect(screen.queryByText('1.25 deg')).toBeNull()
})
it('renders query → measured/group/null counts → management with owned navigation', async () => {
  setup()
  await screen.findByRole('heading', { name: '내 기록 대시보드' })
  await screen.findByText('1.25 deg')
  expect(screen.getByText('50%')).toBeTruthy()
  expect(screen.getAllByText('측정 기록 없음')).toHaveLength(2)
  expect(screen.getByText('알림 기록 연결 준비 중')).toBeTruthy()
  expect(screen.getByRole('link', { name: '기록 대시보드' }).getAttribute('aria-current')).toBe(
    'page',
  )
  expect(screen.getByRole('link', { name: '자세 기록 관리' }).getAttribute('href')).toContain(
    '/posture-records',
  )
  expect(document.title).toBe('내 기록 대시보드 · BODYGUARD')
})
it('day/week submit preserves URL and restores results focus', async () => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  setup()
  await screen.findByText('1.25 deg')
  fireEvent.click(screen.getByLabelText('한 주'))
  fireEvent.click(screen.getByRole('button', { name: '기록 조회' }))
  await waitFor(() => expect(location.search).toContain('period=week'))
  await screen.findByRole('heading', { name: '2026-09-28 ~ 2026-10-05 · 한 주 기록' })
  await waitFor(() => expect(document.activeElement?.id).toBe('dashboard-results'))
})
it.each([
  [1e-320, 5e-7],
  [60, 5e-324],
])(
  'unrepresentable bad ratio %s/%s shows precision guidance, not a fabricated percentage',
  async (measured, bad) => {
    setup((path) => ({
      ...sample(path),
      totals: {
        minutes: 1,
        coverage_sec: 60,
        measured_sec: measured,
        unmeasurable_sec: 60 - measured,
        present_sec: measured,
        background_sec: 0,
        any_bad_sec: bad,
      },
      metrics: sample(path).metrics.map((part) =>
        part.part === 'shoulder'
          ? { ...part, measured_sec: measured, bad_sec: bad, dev_mean: 1.25, bad_ratio: null }
          : part,
      ),
    }))
    await screen.findByText('시간 정밀도 확인 필요')
    expect(screen.queryByText('0%')).toBeNull()
    expect(screen.getByText('1.25 deg')).toBeTruthy()
  },
)
it('invalid URL makes no dashboard read and can recover with valid form', async () => {
  const fetch = setup(sample, '?date=2026-02-30&period=day&timezone=UTC')
  await screen.findByRole('alert')
  expect(fetch.mock.calls.filter(([p]) => p.includes('/records/dashboard'))).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('기준 날짜'), { target: { value: '2026-10-01' } })
  fireEvent.click(screen.getByRole('button', { name: '기록 조회' }))
  await screen.findByText('1.25 deg')
})
it('error has explicit retry; empty does not invent normal values', async () => {
  let fail = true
  setup((path) => (fail ? new Response('', { status: 503 }) : sample(path, true)))
  await screen.findByRole('alert')
  expect(screen.queryByText('50%')).toBeNull()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: '다시 조회' }))
  await screen.findByText('이 기간에는 저장된 기록이 없습니다')
  expect(screen.queryByText('50%')).toBeNull()
})
it('new query hides old range and ignores delayed completion after abort', async () => {
  let release: ((value: unknown) => void) | undefined,
    calls = 0
  setup((path) =>
    ++calls === 1
      ? new Promise((resolve) => {
          release = resolve
        })
      : sample(path, true),
  )
  await waitFor(() => expect(release).toBeDefined())
  fireEvent.change(screen.getByLabelText('기준 날짜'), { target: { value: '2026-10-02' } })
  fireEvent.click(screen.getByRole('button', { name: '기록 조회' }))
  await screen.findByText('이 기간에는 저장된 기록이 없습니다')
  await act(async () => release?.(sample('/api/v1/records/dashboard?date=2026-10-01')))
  expect(screen.queryByText('1.25 deg')).toBeNull()
})
it('authority errors stop reads until explicit account refresh', async () => {
  const fetch = setup(() => new Response('', { status: 403 }))
  const button = await screen.findByRole('button', { name: '계정 다시 확인' })
  expect(fetch.mock.calls.filter(([p]) => p.includes('/records/dashboard'))).toHaveLength(1)
  fireEvent.click(button)
  await screen.findByRole('button', { name: '계정 다시 확인' })
  expect(fetch.mock.calls.filter(([p]) => p.includes('/records/dashboard'))).toHaveLength(2)
})
