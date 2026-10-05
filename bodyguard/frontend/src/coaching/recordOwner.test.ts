// FR-U-04/FR-R-03/NFR-08: first harness only, no user body/credentials.
import { afterEach, expect, it, vi } from 'vitest'
import { captureRecordOwner } from './recordOwner'

afterEach(() => vi.unstubAllGlobals())
const id = '00000000-0000-4000-8000-000000000001'
const account = () => ({ status: 'ready' as const, user: { id, email: 'synthetic@example.com' } })
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const proof = 'a'.repeat(64)
function fetcher() {
  return vi
    .fn()
    .mockResolvedValueOnce(response(account().user))
    .mockResolvedValueOnce(response({ csrf_token: proof }))
    .mockResolvedValueOnce(response(account().user))
}
const record = {
  id,
  motion_id: 'fixture-not-release',
  protocol_version: 'synthetic-algebra-only',
  started_at: '2026-10-05T00:00:00.000Z',
  ended_at: '2026-10-05T00:00:00.100Z',
  outcome: 'interrupted' as const,
  observed_ms: 40,
  repetitions: 0,
}
const saved = () =>
  response({ ...record, created_at: record.ended_at, provenance: 'client-reported' }, 201)
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
it('O02 captures original ready account through me/csrf/me; only one inert writer, no returned ID/proof', async () => {
  const fetch = fetcher()
  vi.stubGlobal('fetch', fetch)
  const authority = account()
  const context = await captureRecordOwner({
    authority,
    readAuthority: () => authority,
    signal: new AbortController().signal,
  })
  expect(fetch.mock.calls.map((call) => call[0])).toEqual([
    '/api/v1/me',
    '/api/v1/auth/csrf',
    '/api/v1/me',
  ])
  for (const call of fetch.mock.calls)
    expect(call[1]).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' })
  const writer = context.createWriter()
  expect(context.createWriter()).toBe(writer)
  expect(writer.getSnapshot()).toEqual({ status: 'idle', failure: null })
  expect(JSON.stringify(context)).not.toContain(proof)
  expect(JSON.stringify(context)).not.toContain(id)
  expect(fetch).toHaveBeenCalledTimes(3)
  fetch.mockResolvedValueOnce(saved())
  await writer.submit(record)
  expect(writer.getSnapshot().status).toBe('saved')
  expect(fetch.mock.calls[3][1].headers).toEqual({
    'Content-Type': 'application/json',
    'X-CSRF-Token': proof,
  })
})
it.each([0, 1, 2])(
  'O03 replacement during await %s cannot capture a late response',
  async (index) => {
    const held = deferred<Response>()
    const fetch = fetcher()
    fetch.mockReset()
    for (let i = 0; i < index; i++)
      fetch.mockResolvedValueOnce(response(i === 1 ? { csrf_token: proof } : account().user))
    fetch.mockReturnValueOnce(held.promise)
    vi.stubGlobal('fetch', fetch)
    const authority = account()
    let current = authority
    const pending = captureRecordOwner({
      authority,
      readAuthority: () => current,
      signal: new AbortController().signal,
    })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(index + 1))
    current = account()
    held.resolve(response(index === 1 ? { csrf_token: proof } : authority.user))
    await expect(pending).rejects.toThrowError(/^Unable to capture coaching account$/)
    expect(fetch).toHaveBeenCalledTimes(index + 1)
  },
)
it.each([0, 2])(
  'O03 server account differs from original authority at me %s: no captured writer',
  async (index) => {
    const fetch = fetcher()
    fetch.mockReset()
    if (index === 2)
      fetch
        .mockResolvedValueOnce(response(account().user))
        .mockResolvedValueOnce(response({ csrf_token: proof }))
    fetch.mockResolvedValueOnce(
      response({ ...account().user, id: '00000000-0000-4000-8000-000000000002' }),
    )
    vi.stubGlobal('fetch', fetch)
    const authority = account()
    await expect(
      captureRecordOwner({
        authority,
        readAuthority: () => authority,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrowError(/^Unable to capture coaching account$/)
    expect(fetch).toHaveBeenCalledTimes(index + 1)
  },
)
it.each([401, 503])('O03 actual API failure %s exposes no raw body', async (status) => {
  const fetch = vi.fn(async () => new Response('PRIVATE_OWNER_COORDINATES_ACCOUNT', { status }))
  vi.stubGlobal('fetch', fetch)
  const authority = account()
  await expect(
    captureRecordOwner({
      authority,
      readAuthority: () => authority,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrowError(/^Unable to capture coaching account$/)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('O03 mutated user ID and provider/accessor exception cannot retain authority', async () => {
  const held = deferred<Response>()
  const fetch = vi.fn(() => held.promise)
  vi.stubGlobal('fetch', fetch)
  const authority = account()
  const pending = captureRecordOwner({
    authority,
    readAuthority: () => authority,
    signal: new AbortController().signal,
  })
  authority.user.id = '00000000-0000-4000-8000-000000000002'
  held.resolve(response({ ...authority.user, id }))
  await expect(pending).rejects.toThrowError(/^Unable to capture coaching account$/)
  await expect(
    captureRecordOwner({
      authority,
      readAuthority() {
        throw new Error('PRIVATE_OWNER_COORDINATES_ACCOUNT')
      },
      signal: new AbortController().signal,
    }),
  ).rejects.toThrowError(/^Unable to capture coaching account$/)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('O04 external abort closes pending writer and its late response cannot reopen it', async () => {
  const held = deferred<Response>()
  const fetch = fetcher().mockReturnValueOnce(held.promise)
  vi.stubGlobal('fetch', fetch)
  const authority = account()
  const controller = new AbortController()
  const context = await captureRecordOwner({
    authority,
    readAuthority: () => authority,
    signal: controller.signal,
  })
  const writer = context.createWriter()
  const pending = writer.submit(record)
  controller.abort()
  held.resolve(saved())
  await pending
  await writer.retry()
  expect(writer.getSnapshot().status).toBe('closed')
  expect(context.active()).toBe(false)
  expect(() => context.createWriter()).toThrowError(/^Unable to capture coaching account$/)
  expect(fetch).toHaveBeenCalledTimes(4)
})
it('O04 same-user new authority and close forbid new writer/retry', async () => {
  const fetch = fetcher()
  vi.stubGlobal('fetch', fetch)
  const authority = account()
  let current = authority
  const context = await captureRecordOwner({
    authority,
    readAuthority: () => current,
    signal: new AbortController().signal,
  })
  const writer = context.createWriter()
  current = account()
  expect(context.active()).toBe(false)
  await writer.submit(record)
  await writer.retry()
  context.close()
  context.close()
  expect(writer.getSnapshot().status).toBe('closed')
  expect(fetch).toHaveBeenCalledTimes(3)
})
it('O03 malformed proof and abort during capture have fixed failure with no later GET', async () => {
  const authority = account()
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(response(authority.user))
    .mockResolvedValueOnce(response({ csrf_token: 'bad' }))
  vi.stubGlobal('fetch', fetch)
  await expect(
    captureRecordOwner({
      authority,
      readAuthority: () => authority,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrowError(/^Unable to capture coaching account$/)
  expect(fetch).toHaveBeenCalledTimes(2)
  const held = deferred<Response>()
  fetch.mockReset().mockReturnValueOnce(held.promise)
  const controller = new AbortController()
  const pending = captureRecordOwner({
    authority,
    readAuthority: () => authority,
    signal: controller.signal,
  })
  controller.abort()
  held.resolve(response(authority.user))
  await expect(pending).rejects.toThrowError(/^Unable to capture coaching account$/)
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('O03 authority/accessor/options failures are fixed, no request can follow', async () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const authority = account()
  for (const supplied of [
    {
      authority,
      readAuthority() {
        throw new Error('PRIVATE_OWNER_COORDINATES_ACCOUNT')
      },
      signal: new AbortController().signal,
    },
    {
      get authority(): ReturnType<typeof account> {
        throw new Error('PRIVATE_OWNER_COORDINATES_ACCOUNT')
      },
      readAuthority: () => authority,
      signal: new AbortController().signal,
    },
    {
      authority: Object.defineProperty(account(), 'user', {
        get() {
          throw new Error('PRIVATE_OWNER_COORDINATES_ACCOUNT')
        },
      }),
      readAuthority: () => authority,
      signal: new AbortController().signal,
    },
  ])
    await expect(captureRecordOwner(supplied)).rejects.toThrowError(
      /^Unable to capture coaching account$/,
    )
  expect(fetch).not.toHaveBeenCalled()
})
it('O03 unexpected successful me status and raw network rejection cannot capture', async () => {
  const authority = account()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(authority.user, 201)),
  )
  await expect(
    captureRecordOwner({
      authority,
      readAuthority: () => authority,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrowError(/^Unable to capture coaching account$/)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('PRIVATE_OWNER_COORDINATES_ACCOUNT')
    }),
  )
  await expect(
    captureRecordOwner({
      authority,
      readAuthority: () => authority,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrowError(/^Unable to capture coaching account$/)
})
it('O04 mutated account after capture and explicit close both detach abort listener exactly once', async () => {
  const authority = account()
  const fetch = fetcher()
  vi.stubGlobal('fetch', fetch)
  const controller = new AbortController()
  const remove = vi.spyOn(controller.signal, 'removeEventListener')
  const context = await captureRecordOwner({
    authority,
    readAuthority: () => authority,
    signal: controller.signal,
  })
  const writer = context.createWriter()
  authority.user.id = '00000000-0000-4000-8000-000000000002'
  expect(context.active()).toBe(false)
  context.close()
  controller.abort()
  expect(remove).toHaveBeenCalledTimes(1)
  expect(writer.getSnapshot().status).toBe('closed')
  expect(() => context.createWriter()).toThrowError(/^Unable to capture coaching account$/)
  expect(fetch).toHaveBeenCalledTimes(3)
})
it('O01 guest and already aborted authority cannot request or create a writer', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  await expect(
    captureRecordOwner({
      authority: null,
      readAuthority: () => null,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrowError(/^Unable to capture coaching account$/)
  const authority = {
    status: 'ready' as const,
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.com' },
  }
  const controller = new AbortController()
  controller.abort()
  await expect(
    captureRecordOwner({ authority, readAuthority: () => authority, signal: controller.signal }),
  ).rejects.toThrowError(/^Unable to capture coaching account$/)
  expect(fetcher).not.toHaveBeenCalled()
})
