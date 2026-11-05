// FR-R-03/NFR-08: synthetic network contracts, not exercise validation.
import { afterEach, expect, it, vi } from 'vitest'
import { dateRange, listRecords, readRecord, recordId, validDay } from './records'

const example = {
  id: '00000000-0000-4000-8000-000000000001',
  motion_id: 'neck-side',
  protocol_version: 'fixture-not-release',
  started_at: '2026-10-05T00:00:00Z',
  ended_at: '2026-10-05T00:00:40Z',
  created_at: '2026-10-05T00:00:41Z',
  outcome: 'interrupted',
  observed_ms: 12000,
  repetitions: 0,
  provenance: 'client-reported',
}
afterEach(() => vi.unstubAllGlobals())

it('validates real calendar dates and safe record identifiers', () => {
  expect(validDay('2026-02-30')).toBe(false)
  expect(validDay('2024-02-29')).toBe(true)
  expect(validDay('')).toBe(false)
  expect(recordId(example.id)).toBe(true)
  expect(recordId('../private')).toBe(false)
  expect(() => dateRange('2026-10-06', '2026-10-05', new Date())).toThrow()
})
it('converts local days to inclusive/exclusive aware bounds with a fixed cutoff', () => {
  const cutoff = new Date(2026, 9, 5, 12, 30)
  expect(dateRange('2026-10-01', '2026-10-05', cutoff)).toEqual({
    start: new Date(2026, 9, 1).toISOString(),
    end: cutoff.toISOString(),
  })
  expect(dateRange('2026-10-01', '2026-10-02', cutoff).end).toBe(new Date(2026, 9, 3).toISOString())
})
it('uses calendar midnight rather than adding 24 hours across DST', () => {
  const range = dateRange('2026-11-01', '2026-11-01', new Date(2026, 10, 3))
  const milliseconds = Date.parse(range.end) - Date.parse(range.start)
  expect(milliseconds).toBe(process.env.TZ === 'America/New_York' ? 25 * 3600000 : 24 * 3600000)
})
it('reads own bounded list without persistent credentials and rejects malformed results', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ items: [example], has_more: false })))
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  expect(await listRecords({ start: 'a', end: 'b' }, 0, signal)).toEqual({
    items: [example],
    has_more: false,
  })
  expect(fetcher).toHaveBeenCalledWith(
    '/api/v1/records/stretch?start=a&end=b&limit=20&offset=0',
    expect.objectContaining({ credentials: 'same-origin', cache: 'no-store', method: 'GET' }),
  )
  fetcher.mockResolvedValue(new Response(JSON.stringify({ items: [], has_more: 'yes' })))
  await expect(listRecords({ start: 'a', end: 'b' }, 0, signal)).rejects.toThrow()
})
it('accepts consistent full-period totals across pages and rejects inconsistent totals', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        items: [example],
        has_more: true,
        total_count: 21,
        total_observed_ms: 25000,
      }),
    ),
  )
  expect(await listRecords({ start: 'a', end: 'b' }, 0, signal)).toMatchObject({
    total_count: 21,
    total_observed_ms: 25000,
  })
  for (const bad of [
    { total_count: 1, total_observed_ms: 25000 },
    { total_count: 21, total_observed_ms: 1 },
    { total_count: 21, total_observed_ms: null },
    { total_count: Number.MAX_SAFE_INTEGER + 1, total_observed_ms: 25000 },
  ]) {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ items: [example], has_more: true, ...bad })),
    )
    await expect(listRecords({ start: 'a', end: 'b' }, 0, signal)).rejects.toThrow()
  }
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({ items: [], has_more: false, total_count: 21, total_observed_ms: 25000 }),
    ),
  )
  expect(await listRecords({ start: 'a', end: 'b' }, 100, signal)).toMatchObject({
    total_count: 21,
  })
})
it.each([
  { observed_ms: true },
  { observed_ms: -1 },
  { repetitions: 1.5 },
  { ended_at: 'invalid' },
  { ended_at: '2026-02-30T00:00:40Z' },
  { outcome: 'safe' },
  { outcome: ['completed'] },
  { provenance: 'verified' },
  { protocol_version: '<script>' },
  { id: '../private' },
])('rejects malformed detail rather than rendering it: %o', async (change) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...example, ...change }))),
  )
  await expect(readRecord(example.id, new AbortController().signal)).rejects.toThrow()
})
it('retains HTTP error status, not the raw error body', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('private raw error', { status: 404 })),
  )
  await expect(readRecord(example.id, new AbortController().signal)).rejects.toMatchObject({
    status: 404,
  })
})
