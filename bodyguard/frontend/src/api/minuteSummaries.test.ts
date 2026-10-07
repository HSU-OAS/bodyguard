// Synthetic adapter/DTO tests; actual API read-binding is tested separately in PostgreSQL.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReadyAccount } from '../auth'
import { ApiError } from './auth'
import { parseMinute, parseMinutes, parseSummaryProof, prepareSummaries } from './minuteSummaries'

const range = { start: '2026-10-01T00:00:00.000Z', end: '2026-10-02T00:00:00.000Z' }
const metric = { method: 'Fixture+V1', unit: 'deg', measured_sec: 0, bad_sec: 0, dev_mean: null }
const minuteFixture = {
  minute_start: '2026-10-01T12:00:00Z',
  baseline_id: null,
  client_version: 'Fixture+V1',
  coverage_sec: 60,
  measured_sec: 30,
  unmeasurable_sec: 20,
  present_sec: 45,
  background_sec: 10,
  any_bad_sec: 15,
  neck: metric,
  trunk: metric,
  shoulder: { ...metric, measured_sec: 30, bad_sec: 15, dev_mean: 1.25 },
  created_at: '2026-10-01T12:01:00.123456Z',
  provenance: 'client-reported',
}
const signed = {
  ...range,
  cutoff: '2026-10-06T12:00:00.123456Z',
  expires_at: '2026-10-06T12:10:00.123456Z',
  count: 3,
  fingerprint: 'b'.repeat(64),
  signature: 'c'.repeat(64),
}
const authority: ReadyAccount = {
  status: 'ready',
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' },
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('strict recorded minute DTO', () => {
  it('retains method/null/fraction without inventing normal values', () => {
    expect(parseMinute(minuteFixture)).toEqual(minuteFixture)
    expect(
      parseMinutes({ items: [minuteFixture], has_more: false }, range).items[0]?.neck.dev_mean,
    ).toBeNull()
  })
  it.each([
    { raw_samples: [] },
    { owner: 'other' },
    { coverage_sec: true },
    { measured_sec: 31 },
    { any_bad_sec: 14 },
    { present_sec: 51 },
    { minute_start: '2026-10-01T12:00:01Z' },
    { minute_start: '2026-10-01T12:00:00.000001Z' },
    { minute_start: '2026-10-01T24:00:00Z' },
    { created_at: '2026-02-30T00:00:00Z' },
    { created_at: '2026-10-01T12:00:00+09:00' },
    { provenance: 'server-verified' },
    { baseline_id: 'bad' },
    { client_version: 'bad\n' },
    { shoulder: { ...metric, measured_sec: 30, bad_sec: 15 } },
    { shoulder: { ...metric, measured_sec: 30, bad_sec: 31, dev_mean: 1 } },
    { shoulder: { ...metric, measured_sec: 30, bad_sec: 15, dev_mean: Infinity } },
    { neck: { ...metric, dev_mean: 1, measured_sec: 1 } },
    { neck: { ...metric, owner: 'other' } },
  ])('rejects malformed or impossible input %j', (change) => {
    expect(() => parseMinute({ ...minuteFixture, ...change })).toThrow(ApiError)
  })
  it('rejects the impossible normal-duration union', () => {
    expect(() =>
      parseMinute({
        ...minuteFixture,
        measured_sec: 60,
        present_sec: 60,
        background_sec: 0,
        unmeasurable_sec: 0,
        shoulder: { ...metric, measured_sec: 30, bad_sec: 30, dev_mean: 1 },
        any_bad_sec: 30,
      }),
    ).toThrow(ApiError)
  })
  it.each([
    { items: [minuteFixture, minuteFixture], has_more: false },
    { items: [minuteFixture], has_more: true },
    { items: [], has_more: 'false' },
    { items: [], has_more: false, user_id: authority.user.id },
    { items: [{ ...minuteFixture, minute_start: range.end }], has_more: false },
  ])('rejects extra fields, sorting/period/pagination mismatch', (value) => {
    expect(() => parseMinutes(value, range)).toThrow(ApiError)
  })
  it('preserves signed microseconds and verifies exact instant/TTL', () => {
    expect(parseSummaryProof({ ...signed, start: '2026-10-01T00:00:00+00:00' }, range).cutoff).toBe(
      signed.cutoff,
    )
    expect(() =>
      parseSummaryProof({ ...signed, start: '2026-10-01T00:00:00.000001Z' }, range),
    ).toThrow(ApiError)
    expect(() =>
      parseSummaryProof({ ...signed, expires_at: '2026-10-06T12:10:00.123455Z' }, range),
    ).toThrow(ApiError)
  })
})

function fetchFixture(handler: (path: string, init?: RequestInit) => unknown | Promise<unknown>) {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v1/me') return new Response(JSON.stringify(authority.user))
    if (path === '/api/v1/auth/csrf')
      return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
    const value = await handler(path, init)
    return value instanceof Response ? value : new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const prepare = (readAuthority = () => authority) =>
  prepareSummaries({ authority, readAuthority, signal: new AbortController().signal })
it('binds each GET at request time and never refreshes CSRF for deletion', async () => {
  vi.setSystemTime(new Date('2026-10-06T12:01:00Z'))
  const fetch = fetchFixture((path, init) => {
    expect(init?.headers).toMatchObject({
      'X-CSRF-Token': 'a'.repeat(64),
      'X-Account-ID': authority.user.id,
    })
    if (path.includes('?')) return { items: [minuteFixture], has_more: false }
    if (path.endsWith('/delete-preview')) return signed
    expect(JSON.parse(init?.body as string)).toEqual({
      ...signed,
      confirmation: 'delete-minute-summaries',
    })
    return { deleted: 3 }
  })
  const context = await prepare()
  await context.list(range, 0, new AbortController().signal)
  const proof = await context.preview(range, new AbortController().signal)
  expect(await context.remove(proof, new AbortController().signal)).toBe(3)
  expect(fetch.mock.calls.filter(([path]) => path.endsWith('/auth/csrf'))).toHaveLength(1)
  context.close()
  await expect(context.list(range, 0, new AbortController().signal)).rejects.toMatchObject({
    status: 401,
  })
})
it('discards a response even if aborted/closed fetch ignores the signal', async () => {
  let finish: ((value: unknown) => void) | undefined
  fetchFixture(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const context = await prepare()
  const pending = context.list(range, 0, new AbortController().signal)
  context.close()
  finish?.({ items: [minuteFixture], has_more: false })
  await expect(pending).rejects.toMatchObject({ status: 401 })
})
it('rejects a new committed ready object with the same account ID', async () => {
  fetchFixture(() => ({ items: [], has_more: false }))
  let current = authority
  const context = await prepare(() => current)
  current = { ...authority }
  await expect(context.list(range, 0, new AbortController().signal)).rejects.toMatchObject({
    status: 401,
  })
})
it.each([1, 2, 4, -1, 0.5, '3', null])(
  'partial/impossible deletion %s remains uncertain',
  async (deleted) => {
    vi.setSystemTime(new Date('2026-10-06T12:01:00Z'))
    fetchFixture(() => ({ deleted }))
    const context = await prepare()
    await expect(context.remove(signed, new AbortController().signal)).rejects.toMatchObject({
      status: 503,
    })
  },
)
it('single-flight rejects duplicate clicks before issuing another mutation', async () => {
  vi.setSystemTime(new Date('2026-10-06T12:01:00Z'))
  let finish: ((value: unknown) => void) | undefined
  const fetch = fetchFixture(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const context = await prepare()
  const pending = context.remove(signed, new AbortController().signal)
  await expect(context.remove(signed, new AbortController().signal)).rejects.toMatchObject({
    status: 409,
  })
  finish?.({ deleted: 3 })
  expect(await pending).toBe(3)
  expect(fetch.mock.calls.filter(([path]) => path.endsWith('/delete'))).toHaveLength(1)
})
it('server-valid proof is not rejected solely because the browser clock is ahead', async () => {
  vi.setSystemTime(new Date('2026-10-06T13:00:00Z'))
  fetchFixture(() => ({ deleted: 3 }))
  const context = await prepare()
  expect(await context.remove(signed, new AbortController().signal)).toBe(3)
})
it('absolute float tolerance cannot create a materially impossible percentage', () => {
  const tiny = {
    ...minuteFixture,
    measured_sec: 0.000001,
    present_sec: 0.000001,
    unmeasurable_sec: 59.999999,
    background_sec: 0,
    any_bad_sec: 0.000002,
    shoulder: { ...metric, measured_sec: 0.000001, bad_sec: 0.000002, dev_mean: 1 },
  }
  expect(() => parseMinute(tiny)).toThrow(ApiError)
})
