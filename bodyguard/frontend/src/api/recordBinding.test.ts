// Controlled network/authority faults; actual API ownership is tested with PostgreSQL.
import { afterEach, expect, it, vi } from 'vitest'
import type { ReadyAccount } from '../auth'
import { ApiError } from './auth'
import { confirmDeletion, previewDeletion } from './recordDeletion'
import { listRecords } from './records'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const period = { start: '2026-10-01T00:00:00Z', end: '2026-10-02T00:00:00Z' }
const proof = {
  ...period,
  cutoff: '2026-10-02T00:00:00Z',
  expires_at: '2026-10-02T00:10:00Z',
  count: 1,
  fingerprint: 'a'.repeat(64),
  signature: 'b'.repeat(64),
}
function setup(data: (url: string, init?: RequestInit) => Promise<Response>) {
  const authority: ReadyAccount = { status: 'ready', user: { id: 'a', email: 'a@example.com' } }
  let current: ReadyAccount | null = authority
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/v1/me') return json({ id: 'a' })
    if (url === '/api/v1/auth/csrf') return json({ csrf_token: 'a'.repeat(64) })
    return data(url, init)
  })
  vi.stubGlobal('fetch', fetcher)
  return {
    fetcher,
    binding: { authority, readAuthority: () => current },
    replace: () => {
      current = { ...authority, user: { ...authority.user } }
    },
  }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('binds the list to one account/session, uses a single deadline and omits redirects/storage', async () => {
  const h = setup(async () => json({ items: [], has_more: false }))
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  await expect(listRecords(period, 0, new AbortController().signal, h.binding)).resolves.toEqual({
    items: [],
    has_more: false,
  })
  expect(h.fetcher.mock.calls.map(([url]) => url.split('?')[0])).toEqual([
    '/api/v1/me',
    '/api/v1/auth/csrf',
    '/api/v1/me',
    '/api/v1/records/stretch',
    '/api/v1/me',
  ])
  expect(timeout).toHaveBeenCalledExactlyOnceWith(15_000)
  const signals = h.fetcher.mock.calls.map(([, init]) => init?.signal)
  expect(new Set(signals).size).toBe(1)
  for (const [, init] of h.fetcher.mock.calls) {
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
  }
  expect(new Headers(h.fetcher.mock.calls[3][1]?.headers).get('X-Account-ID')).toBe('a')
  expect(new Headers(h.fetcher.mock.calls[3][1]?.headers).get('X-CSRF-Token')).toBe('a'.repeat(64))
})

it.each(['list', 'preview', 'delete'] as const)(
  'discards late %s response after authority replacement',
  async (kind) => {
    let release: (response: Response) => void = () => {}
    const h = setup(
      () =>
        new Promise((done) => {
          release = done
        }),
    )
    const signal = new AbortController().signal
    const pending =
      kind === 'list'
        ? listRecords(period, 0, signal, h.binding)
        : kind === 'preview'
          ? previewDeletion(period, signal, h.binding)
          : confirmDeletion(proof, signal, h.binding)
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 })
    await vi.waitFor(() => expect(h.fetcher.mock.calls).toHaveLength(4))
    h.replace()
    release(
      json(
        kind === 'list'
          ? { items: [], has_more: false }
          : kind === 'preview'
            ? proof
            : { deleted: 1 },
      ),
    )
    await rejected
    expect(h.fetcher.mock.calls).toHaveLength(4)
  },
)

it('rechecks authority after late JSON parsing and does not retry', async () => {
  let release: (value: unknown) => void = () => {}
  const response = json({})
  vi.spyOn(response, 'json').mockImplementation(
    () =>
      new Promise((done) => {
        release = done
      }),
  )
  const h = setup(async () => response)
  const pending = listRecords(period, 0, new AbortController().signal, h.binding)
  const rejected = expect(pending).rejects.toMatchObject({ status: 401 })
  await vi.waitFor(() => expect(response.json).toHaveBeenCalledOnce())
  h.replace()
  release({ items: [], has_more: false })
  await rejected
  expect(h.fetcher.mock.calls).toHaveLength(4)
})

it.each(['cancel', 'timeout'] as const)('rejects a late body after %s', async (kind) => {
  const deadline = new AbortController()
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  const controller = new AbortController()
  let release: (response: Response) => void = () => {}
  const h = setup(
    () =>
      new Promise((done) => {
        release = done
      }),
  )
  const pending = listRecords(period, 0, controller.signal, h.binding)
  const rejected = expect(pending).rejects.toMatchObject({ status: kind === 'cancel' ? 401 : 503 })
  await vi.waitFor(() => expect(h.fetcher.mock.calls).toHaveLength(4))
  ;(kind === 'cancel' ? controller : deadline).abort()
  release(json({ items: [], has_more: false }))
  await rejected
  expect(h.fetcher.mock.calls).toHaveLength(4)
})

it('rejects the wrong /me owner before reading any records', async () => {
  const h = setup(async () => json({ items: [], has_more: false }))
  h.fetcher.mockResolvedValueOnce(json({ id: 'b' }))
  await expect(
    listRecords(period, 0, new AbortController().signal, h.binding),
  ).rejects.toBeInstanceOf(ApiError)
  expect(h.fetcher).toHaveBeenCalledTimes(1)
})

it.each(['fixture-csrf', 'g'.repeat(64), '', null])(
  'rejects malformed CSRF %s without record requests',
  async (csrf) => {
    const h = setup(async () => json({ items: [], has_more: false }))
    h.fetcher
      .mockResolvedValueOnce(json({ id: 'a' }))
      .mockResolvedValueOnce(json({ csrf_token: csrf }))
    await expect(
      listRecords(period, 0, new AbortController().signal, h.binding),
    ).rejects.toMatchObject({ status: 503 })
    expect(h.fetcher).toHaveBeenCalledTimes(2)
  },
)

it('snapshots deletion input before awaiting authentication', async () => {
  const mutable = { ...proof }
  const h = setup(async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toEqual({
      ...proof,
      confirmation: 'delete-stretch-records',
    })
    return json({ deleted: 1 })
  })
  const pending = confirmDeletion(mutable, new AbortController().signal, h.binding)
  mutable.count = 0
  mutable.signature = 'c'.repeat(64)
  await expect(pending).resolves.toBe(1)
})
