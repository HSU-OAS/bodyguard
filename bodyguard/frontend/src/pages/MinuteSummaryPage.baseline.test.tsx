// @vitest-environment happy-dom
// FR-M-03/FR-R-01/06/FR-U-04: actual App/AuthProvider, synthetic values/network only.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import type { MinuteOut } from '../api/generated'

const a = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const b = { ...a, id: '00000000-0000-4000-8000-000000000002', email: 'other@example.com' }
const id = '00000000-0000-4000-8000-000000000003'
const part = {
  method: 'fixture-shoulder',
  unit: 'deg',
  dev_mean: null,
  measured_sec: 0,
  bad_sec: 0,
}
const row: MinuteOut = {
  minute_start: '2026-10-01T12:00:00Z',
  baseline_id: id,
  client_version: 'Fixture+V1',
  coverage_sec: 60,
  measured_sec: 30,
  unmeasurable_sec: 20,
  present_sec: 45,
  background_sec: 10,
  any_bad_sec: 15,
  neck: { ...part, method: 'fixture-neck' },
  trunk: { ...part, method: 'fixture-trunk' },
  shoulder: { ...part, dev_mean: 1.25, measured_sec: 30, bad_sec: 15 },
  created_at: '2026-10-01T12:01:00Z',
  provenance: 'client-reported',
}
const baseline = {
  id,
  client_version: 'Fixture+V1',
  neck: null,
  trunk: null,
  shoulder: { method: 'fixture-shoulder', unit: 'deg', value: 2.75 },
  created_at: '2026-09-30T12:00:00.123456+09:00',
  is_active: false,
  provenance: 'client-reported',
}
beforeEach(() => vi.setSystemTime(new Date('2026-10-11T12:00:00Z')))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  history.replaceState(null, '', '/')
})
function setup(
  read: (path: string, init?: RequestInit) => unknown | Promise<unknown> = () => baseline,
  items = [row],
) {
  let changed = false
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    const value =
      path === '/api/v1/me'
        ? changed
          ? b
          : a
        : path === '/api/v1/auth/csrf'
          ? { csrf_token: (changed ? 'b' : 'a').repeat(64) }
          : path.startsWith('/api/v1/summaries?')
            ? { items: changed ? [] : items, has_more: false }
            : await read(path, init)
    return value instanceof Response ? value : new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetch)
  history.replaceState(null, '', '/posture-records?from=2026-10-01&to=2026-10-11')
  render(<App />)
  return {
    fetch,
    changeOwner: () => {
      changed = true
    },
  }
}
const reads = (fetch: ReturnType<typeof setup>['fetch']) =>
  fetch.mock.calls.filter(([path]) => path.startsWith('/api/v1/baselines'))
async function pick() {
  fireEvent.click(await screen.findByRole('button', { name: /2026.*10.*1/ }))
}

it('R1 never reads on list/detail selection; a null baseline has no lookup', async () => {
  const { fetch } = setup(() => baseline, [{ ...row, baseline_id: null }])
  await pick()
  expect(screen.getByText('보정 전')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '기준선 보기' })).toBeNull()
  expect(reads(fetch)).toHaveLength(0)
})
it('R2 explicit lookup uses the record ID and preserves an inactive historical baseline', async () => {
  const { fetch } = setup((path, init) => {
    expect(path).toBe(`/api/v1/baselines/${id}`)
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' })
    expect(init?.headers).toMatchObject({ 'X-Account-ID': a.id, 'X-CSRF-Token': 'a'.repeat(64) })
    return baseline
  })
  await pick()
  expect(reads(fetch)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: '기준선 보기' }))
  const result = await screen.findByRole('region', { name: '기록에 사용한 기준선' })
  expect(within(result).getByText('2.75 deg · fixture-shoulder')).toBeTruthy()
  expect(within(result).getAllByText('—')).toHaveLength(2)
  expect(result.textContent).not.toContain('정상')
  expect(reads(fetch)).toHaveLength(1)
})
it('R3 duplicate lookup is single-flight and loading does not display previous values', async () => {
  let finish!: (value: unknown) => void
  const { fetch } = setup(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  await pick()
  const button = screen.getByRole('button', { name: '기준선 보기' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  expect((button as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('2.75 deg · fixture-shoulder')).toBeNull()
  expect(reads(fetch)).toHaveLength(1)
  await act(async () => finish(baseline))
  await screen.findByRole('region', { name: '기록에 사용한 기준선' })
})
it.each([404, 503])(
  'R4 failed lookup %s has an explicit same-ID retry, no active fallback',
  async (status) => {
    let failed = true
    const { fetch } = setup(() => (failed ? new Response('untrusted error', { status }) : baseline))
    await pick()
    fireEvent.click(screen.getByRole('button', { name: '기준선 보기' }))
    const error = await screen.findByRole('alert')
    expect(error.textContent).toContain(status === 404 ? '찾을 수 없습니다' : '조회하지 못했습니다')
    expect(error.textContent).not.toContain('untrusted error')
    expect(screen.queryByRole('region', { name: '기록에 사용한 기준선' })).toBeNull()
    expect(reads(fetch)).toHaveLength(1)
    failed = false
    fireEvent.click(screen.getByRole('button', { name: '기준선 다시 조회' }))
    await screen.findByRole('region', { name: '기록에 사용한 기준선' })
    expect(reads(fetch).map(([path]) => path)).toEqual([
      `/api/v1/baselines/${id}`,
      `/api/v1/baselines/${id}`,
    ])
  },
)
it.each([
  { ...baseline, id: b.id },
  { ...baseline, coordinates: [] },
  { ...baseline, client_version: 'different-version' },
  { ...baseline, shoulder: { ...baseline.shoulder, method: 'different-method' } },
  { ...baseline, shoulder: null },
])('R5 malformed/mismatched response is not rendered', async (value) => {
  setup(() => value)
  await pick()
  fireEvent.click(screen.getByRole('button', { name: '기준선 보기' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('region', { name: '기록에 사용한 기준선' })).toBeNull()
})
it.each([401, 403])(
  'R6 auth error %s closes parent records and deletion authority',
  async (status) => {
    setup(() => new Response('', { status }))
    await pick()
    fireEvent.click(screen.getByRole('button', { name: '기준선 보기' }))
    await screen.findByRole('button', { name: '계정 다시 확인' })
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: '삭제 대상 확인' })).toBeNull()
  },
)
it.each(['period', 'owner', 'leave'] as const)(
  'R7 late baseline after %s cannot reappear',
  async (kind) => {
    let finish!: (value: unknown) => void
    let requestSignal: AbortSignal | null | undefined
    const context = setup((_path, init) => {
      requestSignal = init?.signal
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    await pick()
    fireEvent.click(screen.getByRole('button', { name: '기준선 보기' }))
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    if (kind === 'period') {
      fireEvent.change(screen.getByLabelText('시작 날짜'), { target: { value: '2026-10-02' } })
      fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
    } else if (kind === 'owner') {
      context.changeOwner()
      act(() => window.dispatchEvent(new Event('focus')))
      await screen.findByText('이 기간에는 자세 기록이 없습니다')
    } else {
      fireEvent.click(screen.getByRole('link', { name: '내 계정으로' }))
      await screen.findByRole('heading', { name: '내 계정' })
    }
    expect(requestSignal?.aborted).toBe(true)
    await act(async () => finish(baseline))
    expect(screen.queryByRole('region', { name: '기록에 사용한 기준선' })).toBeNull()
    expect(screen.queryByText('2.75 deg · fixture-shoulder')).toBeNull()
  },
)

it('R8 selecting another minute disposes the prior lookup even with the same baseline ID', async () => {
  let finish!: (value: unknown) => void
  let requestSignal: AbortSignal | null | undefined
  setup(
    (_path, init) => {
      requestSignal = init?.signal
      return new Promise((resolve) => {
        finish = resolve
      })
    },
    [{ ...row, minute_start: '2026-10-01T12:01:00Z' }, row],
  )
  const buttons = await screen.findAllByRole('button', { name: /2026.*10.*1/ })
  fireEvent.click(buttons[0] as HTMLElement)
  fireEvent.click(screen.getByRole('button', { name: '기준선 보기' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  fireEvent.click(buttons[1] as HTMLElement)
  expect(requestSignal?.aborted).toBe(true)
  await act(async () => finish(baseline))
  expect(screen.queryByRole('region', { name: '기록에 사용한 기준선' })).toBeNull()
  expect(screen.getByRole('button', { name: '기준선 보기' })).toBeTruthy()
})

it('R9 an explicit reread clears previous values while pending or failed', async () => {
  let finish!: (value: unknown) => void
  let calls = 0
  setup(() =>
    ++calls === 1
      ? baseline
      : new Promise((resolve) => {
          finish = resolve
        }),
  )
  await pick()
  fireEvent.click(screen.getByRole('button', { name: '기준선 보기' }))
  await screen.findByRole('region', { name: '기록에 사용한 기준선' })
  fireEvent.click(screen.getByRole('button', { name: '기준선 다시 조회' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(screen.queryByRole('region', { name: '기록에 사용한 기준선' })).toBeNull()
  await act(async () => finish(new Response('', { status: 503 })))
  await screen.findByRole('alert')
  expect(screen.queryByText('2.75 deg · fixture-shoulder')).toBeNull()
})
