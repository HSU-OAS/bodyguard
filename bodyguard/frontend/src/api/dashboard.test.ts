// FR-R-03/U-04: deterministic synthetic DTO/session tests, not clinical evidence.
import { afterEach, expect, it, vi } from 'vitest'
import type { ReadyAccount } from '../auth'
import { ApiError } from './auth'
import { dashboardQuery, parseDashboard, readDashboard } from './dashboard'

const query = { date: '2026-10-01', period: 'day' as const, timezone: 'Asia/Seoul' }
const totals = {
  minutes: 2,
  coverage_sec: 120,
  measured_sec: 40,
  unmeasurable_sec: 60,
  present_sec: 60,
  background_sec: 20,
  any_bad_sec: 20,
}
const metric = {
  part: 'shoulder',
  baseline_id: null,
  client_version: 'Fixture+V1',
  method: 'fixture-shoulder',
  unit: 'deg',
  measured_sec: 40,
  bad_sec: 20,
  dev_mean: 2.25,
  bad_ratio: 0.5,
}
const fixture = {
  ...query,
  local_start: query.date,
  local_end: '2026-10-02',
  start: '2026-09-30T15:00:00Z',
  end: '2026-10-01T15:00:00Z',
  totals,
  metrics: [
    metric,
    ...(['neck', 'trunk'] as const).map((part) => ({
      ...metric,
      part,
      method: `fixture-${part}`,
      measured_sec: 0,
      bad_sec: 0,
      dev_mean: null,
      bad_ratio: null,
    })),
  ],
  stretch: { completed: 1, interrupted: 1, skipped: 0 },
  notifications: null,
  provenance: 'client-reported',
}
const authority: ReadyAccount = {
  status: 'ready',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'fixture@example.com',
  },
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
it('validates exact calendar/zone and preserves null, method, unit', () => {
  expect(dashboardQuery(new URLSearchParams(query))).toEqual(query)
  expect(parseDashboard(fixture, query)).toEqual(fixture)
})
it.each([
  { date: '2026-02-30' },
  { date: '0000-01-01' },
  { date: '9999-12-31' },
  { date: '2011-12-30', timezone: 'Pacific/Apia' },
  { timezone: 'missing/zone' },
  { period: 'month' },
])('rejects invalid calendar request %j', (change) => {
  expect(() => dashboardQuery(new URLSearchParams({ ...query, ...change }))).toThrow(ApiError)
})
it('rejects duplicate/unknown URL fields', () => {
  expect(() => dashboardQuery(new URLSearchParams('date=2026-10-01&date=2026-10-02'))).toThrow(
    ApiError,
  )
  expect(() => dashboardQuery(new URLSearchParams('owner=someone'))).toThrow(ApiError)
})
it('rejects numeric timezone and canonicalizes IANA case', () => {
  expect(() => dashboardQuery(new URLSearchParams({ ...query, timezone: '+09:00' }))).toThrow(
    ApiError,
  )
  expect(dashboardQuery(new URLSearchParams({ ...query, timezone: 'asia/seoul' })).timezone).toBe(
    'Asia/Seoul',
  )
})
it('retains existing additive duration tolerance without turning accepted records into 503', () => {
  const value = {
    ...fixture,
    totals: {
      ...totals,
      minutes: 1,
      coverage_sec: 60,
      measured_sec: 0.5,
      unmeasurable_sec: 59.5,
      present_sec: 0.5,
      background_sec: 0,
      any_bad_sec: 0.5,
    },
    metrics: fixture.metrics.map((part) =>
      part.part === 'shoulder'
        ? { ...part, measured_sec: 0.5, bad_sec: 0.50000075, bad_ratio: 1.0000015 }
        : part,
    ),
  }
  expect(parseDashboard(value, query).metrics[0]?.bad_sec).toBe(0.50000075)
})
it('rejects positive duration for zero stored minutes', () => {
  expect(() =>
    parseDashboard(
      {
        ...fixture,
        totals: {
          minutes: 0,
          coverage_sec: 0.001,
          measured_sec: 0.001,
          unmeasurable_sec: 0,
          present_sec: 0.001,
          background_sec: 0,
          any_bad_sec: 0,
        },
        metrics: [],
      },
      query,
    ),
  ).toThrow(ApiError)
})
it('requires every part within each baseline/version partition', () => {
  const mixed = fixture.metrics.map((part) =>
    part.part === 'shoulder'
      ? part
      : { ...part, baseline_id: authority.user.id, client_version: 'Fixture+V2' },
  )
  expect(() => parseDashboard({ ...fixture, metrics: mixed }, query)).toThrow(ApiError)
})
it('retains an unrepresentable ratio as precision null, never normal zero', () => {
  const value = {
    ...fixture,
    totals: {
      minutes: 1,
      coverage_sec: 60,
      measured_sec: 1e-320,
      unmeasurable_sec: 60,
      present_sec: 1e-320,
      background_sec: 0,
      any_bad_sec: 5e-7,
    },
    metrics: fixture.metrics.map((part) =>
      part.part === 'shoulder'
        ? { ...part, measured_sec: 1e-320, bad_sec: 5e-7, dev_mean: 1.25, bad_ratio: null }
        : part,
    ),
  }
  expect(parseDashboard(value, query).metrics[0]?.bad_ratio).toBeNull()
  expect(() =>
    parseDashboard(
      {
        ...value,
        metrics: value.metrics.map((part) =>
          part.part === 'shoulder' ? { ...part, bad_ratio: 0 } : part,
        ),
      },
      query,
    ),
  ).toThrow(ApiError)
})
it('accepts finite subnormal ratios computed from the emitted float durations', () => {
  const measured = 1e-320,
    bad = 4e-321
  const value = {
    ...fixture,
    totals: {
      ...totals,
      minutes: 1,
      coverage_sec: 60,
      measured_sec: measured,
      unmeasurable_sec: 60,
      present_sec: measured,
      background_sec: 0,
      any_bad_sec: bad,
    },
    metrics: fixture.metrics.map((part) =>
      part.part === 'shoulder'
        ? { ...part, measured_sec: measured, bad_sec: bad, bad_ratio: bad / measured }
        : part,
    ),
  }
  expect(parseDashboard(value, query).metrics[0]?.bad_ratio).toBe(bad / measured)
  expect(() =>
    parseDashboard(
      {
        ...value,
        metrics: value.metrics.map((part) =>
          part.part === 'shoulder' ? { ...part, bad_ratio: 0.4 } : part,
        ),
      },
      query,
    ),
  ).toThrow(ApiError)
})
it('retains an underflowed positive ratio as precision null instead of zero', () => {
  const value = {
    ...fixture,
    totals: {
      ...totals,
      minutes: 1,
      coverage_sec: 60,
      measured_sec: 60,
      unmeasurable_sec: 0,
      present_sec: 60,
      background_sec: 0,
      any_bad_sec: 5e-324,
    },
    metrics: fixture.metrics.map((part) =>
      part.part === 'shoulder'
        ? { ...part, measured_sec: 60, bad_sec: 5e-324, bad_ratio: null }
        : part,
    ),
  }
  expect(parseDashboard(value, query).metrics[0]?.bad_ratio).toBeNull()
  expect(() =>
    parseDashboard(
      {
        ...value,
        metrics: value.metrics.map((part) =>
          part.part === 'shoulder' ? { ...part, bad_ratio: 0 } : part,
        ),
      },
      query,
    ),
  ).toThrow(ApiError)
})
it('rejects missing parts and any-bad below a recorded part without another guard masking the test', () => {
  const mixed = fixture.metrics.map((part) =>
    part.part === 'neck'
      ? {
          ...part,
          baseline_id: authority.user.id,
          measured_sec: 40,
          bad_sec: 0,
          dev_mean: 1,
          bad_ratio: 0,
        }
      : { ...part, baseline_id: authority.user.id },
  )
  expect(() =>
    parseDashboard({ ...fixture, totals: { ...totals, any_bad_sec: 0 }, metrics: mixed }, query),
  ).toThrow(ApiError)
  const dup = fixture.metrics.map((part) =>
    part.part === 'trunk' ? { ...part, part: 'neck', method: 'fixture-second' } : part,
  )
  expect(() => parseDashboard({ ...fixture, metrics: dup }, query)).toThrow(ApiError)
})
it.each([
  { date: '2026-10-02' },
  { period: 'week' },
  { timezone: 'UTC' },
  { local_end: '2026-10-03' },
  { start: '2026-09-30T16:00:00Z' },
  { end: '2026-10-01T15:00:00.000001Z' },
  { owner: 'other' },
  { notifications: 0 },
  { provenance: 'server-verified' },
  { totals: { ...totals, measured_sec: 80 } },
  { totals: { ...totals, minutes: true } },
  { totals: { ...totals, coverage_sec: 121 } },
  { metrics: [metric, ...fixture.metrics] },
  {
    metrics: fixture.metrics.map((part) =>
      part.part === 'shoulder' ? { ...part, bad_ratio: 0.4 } : part,
    ),
  },
  {
    metrics: fixture.metrics.map((part) =>
      part.part === 'shoulder' ? { ...part, dev_mean: Infinity } : part,
    ),
  },
  {
    metrics: fixture.metrics.map((part) =>
      part.part === 'shoulder' ? { ...part, measured_sec: 0 } : part,
    ),
  },
  { stretch: { completed: -1, interrupted: 0, skipped: 0 } },
])('rejects mismatched or fabricated output %j', (change) => {
  expect(() => parseDashboard({ ...fixture, ...change }, query)).toThrow(ApiError)
})
it.each([
  ['2026-03-08', '2026-03-08T05:00:00Z', '2026-03-09T04:00:00Z'],
  ['2026-11-01', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
  ['2018-11-04', '2018-11-04T03:00:00Z', '2018-11-05T02:00:00Z'],
  ['1919-03-31', '1919-03-31T04:30:00Z', '1919-04-01T04:00:00Z'],
])('accepts actual 23/25h and midnight DST gap %s', (date, start, end) => {
  const timezone = date.startsWith('1919')
    ? 'America/Toronto'
    : date.startsWith('2018')
      ? 'America/Sao_Paulo'
      : 'America/New_York'
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  const q = { ...query, date, timezone }
  expect(
    parseDashboard(
      {
        ...fixture,
        ...q,
        local_start: date,
        local_end: next.toISOString().slice(0, 10),
        start,
        end,
      },
      q,
    ).start,
  ).toBe(start)
})
it.each([
  ['1867-10-18', '1867-10-17T09:59:36Z', '1867-10-19T09:59:36Z'],
  ['1867-10-19', '1867-10-18T09:59:36Z', '1867-10-20T09:59:36Z'],
])(
  'matches repeated-date UTC envelope without claiming every instant belongs to %s',
  (date, start, end) => {
    const q = { ...query, date, timezone: 'America/Anchorage' }
    const next = new Date(`${date}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    expect(
      parseDashboard(
        {
          ...fixture,
          ...q,
          local_start: date,
          local_end: next.toISOString().slice(0, 10),
          start,
          end,
        },
        q,
      ).end,
    ).toBe(end)
  },
)
function mockFetch(handler: (path: string, init?: RequestInit) => unknown | Promise<unknown>) {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    const value =
      path === '/api/v1/me'
        ? authority.user
        : path === '/api/v1/auth/csrf'
          ? { csrf_token: 'a'.repeat(64) }
          : await handler(path, init)
    return value instanceof Response ? value : new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const read = (readAuthority = () => authority, signal = new AbortController().signal) =>
  readDashboard({ authority, readAuthority, signal }, query)
it('binds original CSRF/owner and performs final /me before displaying', async () => {
  const fetch = mockFetch((path, init) => {
    expect(path).toBe('/api/v1/records/dashboard?date=2026-10-01&period=day&timezone=Asia%2FSeoul')
    expect(init).toMatchObject({
      cache: 'no-store',
      credentials: 'same-origin',
      headers: {
        'X-CSRF-Token': 'a'.repeat(64),
        'X-Account-ID': authority.user.id,
      },
    })
    return fixture
  })
  expect(await read()).toEqual(fixture)
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/me',
    '/api/v1/auth/csrf',
    '/api/v1/me',
    '/api/v1/records/dashboard?date=2026-10-01&period=day&timezone=Asia%2FSeoul',
    '/api/v1/me',
  ])
})
it.each(['identity', 'abort'] as const)(
  'drops independent %s changes even when fetch ignores its signal',
  async (kind) => {
    let finish: ((v: unknown) => void) | undefined
    mockFetch(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    let current = authority
    const operation = new AbortController()
    const pending = read(() => current, operation.signal)
    await vi.waitFor(() => expect(finish).toBeDefined())
    if (kind === 'identity') current = { ...authority }
    else operation.abort()
    finish?.(fixture)
    await expect(pending).rejects.toMatchObject({ status: 401 })
  },
)
it('discards final /me owner change after a valid aggregate', async () => {
  let calls = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (path: string) =>
        new Response(
          JSON.stringify(
            path === '/api/v1/me'
              ? ++calls === 3
                ? { ...authority.user, id: '00000000-0000-4000-8000-000000000002' }
                : authority.user
              : path === '/api/v1/auth/csrf'
                ? { csrf_token: 'a'.repeat(64) }
                : fixture,
          ),
        ),
    ),
  )
  await expect(read()).rejects.toMatchObject({ status: 401 })
})
it('rejects timeout during JSON despite ignored fetch signal', async () => {
  const timeout = new AbortController()
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
  // Return a real response whose JSON consumes time outside fetch.
  const response = new Response('{}')
  vi.spyOn(response, 'json').mockImplementation(async () => {
    timeout.abort()
    return fixture
  })
  mockFetch(() => response)
  await expect(read()).rejects.toMatchObject({ status: 503 })
})
