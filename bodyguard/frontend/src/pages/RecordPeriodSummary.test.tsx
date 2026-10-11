// @vitest-environment happy-dom
// FR-R-03/06/U-04: actual public router; HTTP/accounts/aggregates are fixtures.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const account = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const DateTimeFormat = Intl.DateTimeFormat
beforeEach(() => {
  vi.setSystemTime(new Date('2026-10-06T12:01:00Z'))
  // The HTTP fixture describes UTC days. Pin only the default browser zone;
  // explicit IANA zones still use the native formatter and strict parser.
  // biome-ignore lint/complexity/useArrowFunction: Vitest constructor mocks must be constructible.
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locales, options) {
    return new DateTimeFormat(locales, { timeZone: 'UTC', ...options })
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  history.replaceState(null, '', '/')
})
function aggregate(path: string, minutes = 21) {
  const q = new URL(path, 'http://localhost').searchParams
  const start = q.get('period') === 'week' ? '2026-10-05' : (q.get('date') ?? '2026-10-06')
  const end = q.get('period') === 'week' ? '2026-10-12' : '2026-10-07'
  // Tests pin UTC to make the fixture calendar explicit; no production time-zone policy change.
  const m = minutes
  return {
    date: q.get('date'),
    period: q.get('period'),
    timezone: q.get('timezone'),
    local_start: start,
    local_end: end,
    start: `${start}T00:00:00Z`,
    end: `${end}T00:00:00Z`,
    totals: {
      minutes: m,
      coverage_sec: m * 60,
      measured_sec: m * 30,
      unmeasurable_sec: m * 20,
      present_sec: m * 45,
      background_sec: m * 10,
      any_bad_sec: m * 15,
    },
    metrics: m
      ? ['neck', 'shoulder', 'trunk'].map((part) => ({
          part,
          baseline_id: null,
          client_version: 'Fixture+V1',
          method: 'fixture',
          unit: 'deg',
          measured_sec: part === 'shoulder' ? m * 30 : 0,
          bad_sec: part === 'shoulder' ? m * 15 : 0,
          dev_mean: part === 'shoulder' ? 1.25 : null,
          bad_ratio: part === 'shoulder' ? 0.5 : null,
        }))
      : [],
    stretch: { completed: m ? 2 : 0, interrupted: m ? 1 : 0, skipped: m ? 3 : 0 },
    notifications: null,
    provenance: 'client-reported',
  }
}
it('RP12 pins only the fixture default zone and preserves explicit native IANA zones', () => {
  expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC')
  expect(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul' }).resolvedOptions().timeZone).toBe(
    'Asia/Seoul',
  )
  expect(
    new Intl.DateTimeFormat('en', { timeZone: 'America/New_York' }).resolvedOptions().timeZone,
  ).toBe('America/New_York')
})
function setup(handler: (path: string) => unknown | Promise<unknown>) {
  const fetch = vi.fn(async (path: string) => {
    if (path === '/api/v1/me') return new Response(JSON.stringify(account))
    if (path === '/api/v1/auth/csrf')
      return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
    if (path.startsWith('/api/v1/summaries?'))
      return new Response(JSON.stringify({ items: [], has_more: false }))
    const value = await handler(path)
    return value instanceof Response ? value : new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetch)
  history.replaceState(null, '', '/posture-records?from=2026-10-01&to=2026-10-06')
  render(<App />)
  return fetch
}
async function controls() {
  await screen.findByRole('heading', { name: '내 자세 기록', level: 1 })
  const region = screen.getByRole('region', { name: '일·주 기록 요약' })
  return { region, ui: within(region) }
}
it('RP01 explicit whole-period day/week aggregate, not current20 rows or clinical status', async () => {
  const fetch = setup(aggregate)
  const { ui } = await controls()
  expect(fetch.mock.calls.some(([path]) => path.includes('/dashboard?'))).toBe(false)
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByText('21분 기록')
  const table = ui.getByRole('table', { name: '기간 전체의 부위별 저장 지표' })
  expect(within(table).getByRole('row', { name: /어깨/ }).textContent).toContain('50%')
  expect(within(table).getByRole('row', { name: /목/ }).textContent).toContain('—')
  expect(ui.getByText('완료 2 · 중단 1 · 건너뜀 3')).toBeTruthy()
  expect(ui.queryByText('알림 0')).toBeNull()
  fireEvent.change(ui.getByLabelText('요약 단위'), { target: { value: 'week' } })
  expect(ui.queryByText('21분 기록')).toBeNull()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByText(/2026-10-05 ~ 2026-10-11/)
})
it('RP02 empty is not zero normal, error retry is explicit', async () => {
  let failed = true
  const fetch = setup((path) => (failed ? new Response('', { status: 503 }) : aggregate(path, 0)))
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByRole('alert')
  expect(fetch.mock.calls.filter(([path]) => path.includes('/dashboard?'))).toHaveLength(1)
  failed = false
  fireEvent.click(ui.getByRole('button', { name: '요약 다시 조회' }))
  await ui.findByText('이 기간에는 저장된 기록이 없습니다')
  expect(ui.queryByRole('table')).toBeNull()
})
it('RP03 invalid/future day makes no aggregate request', async () => {
  const fetch = setup(aggregate)
  const { ui } = await controls()
  fireEvent.change(ui.getByLabelText('요약 날짜'), { target: { value: '2026-10-07' } })
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByRole('alert')
  expect(fetch.mock.calls.some(([path]) => path.includes('/dashboard?'))).toBe(false)
})
it('RP04 edit cancels old response even when HTTP ignores abort and does not steal input focus', async () => {
  let release!: (v: unknown) => void
  let old = ''
  setup((path) => {
    old = path
    return new Promise((resolve) => {
      release = resolve
    })
  })
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await waitFor(() => expect(release).toBeTypeOf('function'))
  const input = ui.getByLabelText('요약 날짜')
  input.focus()
  fireEvent.change(input, { target: { value: '2026-10-05' } })
  await act(async () => release(aggregate(old)))
  expect(ui.queryByText('21분 기록')).toBeNull()
  expect(document.activeElement).toBe(input)
})
it('RP05 a new minute-list query discards aggregate without automatic retry', async () => {
  const fetch = setup(aggregate)
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByText('21분 기록')
  fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
  const next = within(screen.getByRole('region', { name: '일·주 기록 요약' }))
  expect(next.queryByText('21분 기록')).toBeNull()
  expect(fetch.mock.calls.filter(([path]) => path.includes('/dashboard?'))).toHaveLength(1)
})
it('RP06 aggregate403 closes both aggregate and existing record/delete authority', async () => {
  setup(() => new Response('', { status: 403 }))
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await screen.findByRole('button', { name: '계정 다시 확인' })
  expect(screen.queryByRole('button', { name: '삭제 대상 확인' })).toBeNull()
  expect(ui.queryByText('21분 기록')).toBeNull()
})
it('RP07 pagehide discards successful aggregate with no storage or automatic restart', async () => {
  const fetch = setup(aggregate)
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByText('21분 기록')
  fireEvent(window, new Event('pagehide'))
  expect(ui.queryByText('21분 기록')).toBeNull()
  expect(fetch.mock.calls.filter(([path]) => path.includes('/dashboard?'))).toHaveLength(1)
  expect(localStorage.length).toBe(0)
  expect(sessionStorage.length).toBe(0)
})

it('RP08 stretch-only records are not an empty period', async () => {
  setup((path) => ({
    ...aggregate(path, 0),
    stretch: { completed: 1, interrupted: 0, skipped: 0 },
  }))
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByText('완료 1 · 중단 0 · 건너뜀 0')
  expect(ui.queryByText('이 기간에는 저장된 기록이 없습니다')).toBeNull()
  expect(ui.queryByRole('table')).toBeNull()
})

it('RP09 method/version/unit/baseline partitions remain separate with original nulls', async () => {
  setup((path) => {
    const v = aggregate(path)
    const metrics = v.metrics.map((m) => ({
      ...m,
      measured_sec: m.measured_sec / 2,
      bad_sec: m.bad_sec / 2,
    }))
    return {
      ...v,
      metrics: [
        ...metrics,
        ...metrics.map((m) => ({
          ...m,
          baseline_id: '00000000-0000-4000-8000-000000000009',
          client_version: 'Fixture+V2',
          method: 'fixture2',
          unit: 'index',
          dev_mean: m.part === 'shoulder' ? 3 : null,
        })),
      ],
    }
  })
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByText('21분 기록')
  const table = ui.getByRole('table', { name: '기간 전체의 부위별 저장 지표' })
  expect(within(table).getAllByRole('row')).toHaveLength(7)
  expect(within(table).getByText('1.25 deg')).toBeTruthy()
  expect(within(table).getByText('3 index')).toBeTruthy()
  expect(within(table).getAllByText('—')).toHaveLength(8)
  expect(within(table).getAllByText('보정 전')).toHaveLength(3)
})

it('RP10 retired403 cannot revoke a newer successful query', async () => {
  let release!: (v: unknown) => void
  let n = 0
  setup((path) =>
    ++n === 1
      ? new Promise((resolve) => {
          release = resolve
        })
      : aggregate(path),
  )
  const { ui } = await controls()
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await waitFor(() => expect(release).toBeTypeOf('function'))
  fireEvent.change(ui.getByLabelText('요약 단위'), { target: { value: 'week' } })
  fireEvent.click(ui.getByRole('button', { name: '요약 조회' }))
  await ui.findByText('21분 기록')
  await act(async () => release(new Response('', { status: 403 })))
  expect(ui.getByText('21분 기록')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '계정 다시 확인' })).toBeNull()
})

it('RP11 a pending query remains keyboard-focused but cannot make duplicate reads', async () => {
  let release!: (v: unknown) => void
  let path = ''
  const fetch = setup((value) => {
    path = value
    return new Promise((resolve) => {
      release = resolve
    })
  })
  const { ui } = await controls()
  const query = ui.getByRole('button', { name: '요약 조회' })
  query.focus()
  fireEvent.click(query)
  await waitFor(() => expect(release).toBeTypeOf('function'))
  expect(query.hasAttribute('disabled')).toBe(false)
  expect(query.getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(query)
  expect(fetch.mock.calls.filter(([p]) => p.includes('/dashboard?'))).toHaveLength(1)
  await act(async () => release(aggregate(path)))
  expect(ui.getByText('21분 기록')).toBeTruthy()
  expect(document.activeElement).toBe(query)
})
