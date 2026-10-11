// FR-M-03/FR-U-04/NFR-08: synthetic network/DTOs, never actual calibration.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReadyAccount } from '../auth'
import { ApiError } from './auth'
import { parseBaseline, parseBaselineInput, prepareBaselines } from './baselines'

const input = {
  id: '00000000-0000-4000-8000-000000000001',
  client_version: 'Fixture+V1',
  neck: null,
  trunk: null,
  shoulder: { method: 'fixture-shoulder', unit: 'deg', value: 1.25 },
}
const saved = {
  ...input,
  created_at: '2026-10-01T00:00:00.123456Z',
  is_active: true,
  provenance: 'client-reported',
}
const account = (): ReadyAccount => ({
  status: 'ready',
  user: { id: '00000000-0000-4000-8000-000000000002', email: 'fixture@example.com' },
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function fixture(
  handler: (path: string, init?: RequestInit) => unknown | Promise<unknown>,
  authority = account(),
) {
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
const signal = () => new AbortController().signal
const prepare = (authority = account(), readAuthority = () => authority, external = signal()) =>
  prepareBaselines({ authority, readAuthority, signal: external })
describe('strict baseline snapshots', () => {
  it('retains optional null and microseconds, canonicalizes input and copies nested metrics', () => {
    const original = structuredClone(input)
    const snapshot = parseBaselineInput({ ...original, id: original.id.toUpperCase() })
    original.shoulder.value = 9
    expect(snapshot).toEqual(input)
    expect(Object.isFrozen(snapshot.shoulder)).toBe(true)
    expect(parseBaseline(saved)).toEqual(saved)
    expect(Object.isFrozen(parseBaseline(saved))).toBe(true)
  })
  it.each([
    { user_id: 'other' },
    { samples: [] },
    { id: 'not-uuid' },
    { id: `${input.id}\n` },
    { client_version: 'v1\n' },
    { client_version: 'v1\r' },
    { client_version: '' },
    { client_version: 'x'.repeat(65) },
    { client_version: '한글' },
    { shoulder: null },
    { neck: undefined },
    { shoulder: { ...input.shoulder, value: '1' } },
    { shoulder: { ...input.shoulder, value: true } },
    { shoulder: { ...input.shoulder, value: NaN } },
    { shoulder: { ...input.shoulder, value: Infinity } },
    { shoulder: { ...input.shoulder, value: Number.MAX_SAFE_INTEGER + 1 } },
    { shoulder: { ...input.shoulder, coordinates: [] } },
    { trunk: { ...input.shoulder, unit: 'deg\n' } },
  ])('rejects unknown fields and malformed values %j', (change) => {
    expect(() => parseBaselineInput({ ...input, ...change })).toThrow(ApiError)
  })
  it.each([
    { provenance: 'server-verified' },
    { is_active: 'true' },
    { owner: 'other' },
    { created_at: '2026-02-30T00:00:00Z' },
    { created_at: '2026-10-01T24:00:00Z' },
    { created_at: '2026-10-01T00:00:00+24:00' },
    { created_at: '2026-10-01T00:00:00+09:60' },
    { created_at: '2026-10-01T00:00:00' },
    { created_at: '2026-10-01T00:00:00Z\n' },
  ])('rejects malformed server snapshots %j', (change) => {
    expect(() => parseBaseline({ ...saved, ...change })).toThrow(ApiError)
  })
})
it.each(['+09:00', '-05:30', 'Z', '+00:00'])('retains the API timestamp offset %s', (offset) => {
  const row = { ...saved, created_at: `2026-10-01T12:00:00.123456${offset}` }
  expect(parseBaseline(row)).toEqual(row)
})
it('prepares without data reads/writes, pins proof/owner, handles explicit active/detail/save', async () => {
  const authority = account()
  const fetch = fixture((path, init) => {
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
    expect(init?.headers).toMatchObject({
      'X-CSRF-Token': 'a'.repeat(64),
      'X-Account-ID': authority.user.id,
    })
    if (init?.method === 'POST') {
      expect(JSON.parse(String(init.body))).toEqual(input)
      return new Response(JSON.stringify(saved), { status: 201 })
    }
    return path.endsWith('/active') ? null : { ...saved, is_active: false }
  }, authority)
  const context = await prepare(authority)
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/v1/me',
    '/api/v1/auth/csrf',
    '/api/v1/me',
  ])
  expect(await context.active(signal())).toBeNull()
  expect((await context.detail(input.id, signal())).is_active).toBe(false)
  expect(await context.save(input, signal())).toEqual(saved)
  expect(fetch.mock.calls.filter(([path]) => path.endsWith('/auth/csrf'))).toHaveLength(1)
  context.close()
  await expect(context.active(signal())).rejects.toMatchObject({ status: 401 })
})
it('historical identical retry returns inactive instead of inventing activation', async () => {
  fixture(() => ({ ...saved, is_active: false }))
  expect((await (await prepare()).save(input, signal())).is_active).toBe(false)
})
it.each([202, 204, 206])('unexpected success %s is not confirmation', async (status) => {
  fixture(() => new Response(status === 204 ? null : JSON.stringify(saved), { status }))
  const context = await prepare()
  await expect(context.save(input, signal())).rejects.toMatchObject({ status: 503 })
  await expect(context.active(signal())).rejects.toMatchObject({ status: 401 })
})
it.each([
  { id: '00000000-0000-4000-8000-000000000009' },
  { client_version: 'other' },
  { neck: input.shoulder },
  { shoulder: { ...input.shoulder, value: 9 } },
])('mismatched save echo fails closed %j', async (change) => {
  fixture(() => ({ ...saved, ...change }))
  await expect((await prepare()).save(input, signal())).rejects.toMatchObject({ status: 503 })
})
it('active=false and wrong detail ID are rejected', async () => {
  fixture(() => ({ ...saved, is_active: false }))
  await expect((await prepare()).active(signal())).rejects.toMatchObject({ status: 503 })
  await expect(
    (await prepare()).detail('00000000-0000-4000-8000-000000000009', signal()),
  ).rejects.toMatchObject({ status: 503 })
})
it('409 preserves the uncertainty, does not refresh proof or automatically retry', async () => {
  const fetch = fixture(() => new Response(null, { status: 409 }))
  const context = await prepare()
  await expect(context.save(input, signal())).rejects.toMatchObject({ status: 409 })
  await expect(context.save(input, signal())).rejects.toMatchObject({ status: 401 })
  expect(fetch.mock.calls.filter(([path]) => path === '/api/v1/baselines')).toHaveLength(1)
})
it('invalid input does not send requests and a corrected explicit input can still save', async () => {
  const fetch = fixture(() => saved)
  const context = await prepare()
  await expect(
    context.save({ ...input, samples: [] } as typeof input, signal()),
  ).rejects.toMatchObject({ status: 422 })
  await expect(context.detail('../me', signal())).rejects.toMatchObject({ status: 422 })
  expect(fetch.mock.calls).toHaveLength(3)
  expect(await context.save(input, signal())).toEqual(saved)
})
it('copies before await, rejects duplicate flight, ignores late response after close', async () => {
  let finish: ((value: unknown) => void) | undefined
  const fetch = fixture(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const context = await prepare()
  const original = structuredClone(input)
  const pending = context.save(original, signal())
  original.shoulder.value = 9
  await expect(context.save(input, signal())).rejects.toMatchObject({ status: 409 })
  expect(JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body))).toEqual(input)
  context.close()
  finish?.(saved)
  await expect(pending).rejects.toMatchObject({ status: 401 })
})
it.each(['fresh-ready', 'mutated-id', 'abort'] as const)(
  'revokes stale owner before request: %s',
  async (phase) => {
    const authority = account()
    let current = authority
    const abort = new AbortController()
    const fetch = fixture(() => saved, authority)
    const context = await prepare(authority, () => current, abort.signal)
    if (phase === 'fresh-ready') current = { ...authority }
    if (phase === 'mutated-id') authority.user.id = 'other'
    if (phase === 'abort') abort.abort()
    await expect(context.active(signal())).rejects.toMatchObject({ status: 401 })
    expect(fetch.mock.calls).toHaveLength(3)
  },
)
it('external cancellation during JSON does not return a late baseline', async () => {
  const abort = new AbortController()
  fixture(() => {
    const response = new Response(JSON.stringify(saved))
    vi.spyOn(response, 'json').mockImplementation(async () => {
      abort.abort()
      return saved
    })
    return response
  })
  const context = await prepare()
  await expect(context.save(input, abort.signal)).rejects.toMatchObject({ status: 401 })
})
it('mismatched account during preparation never acquires data authority', async () => {
  const authority = account()
  fixture(() => saved, { ...authority, user: { ...authority.user, id: 'other' } })
  await expect(prepare(authority)).rejects.toMatchObject({ status: 401 })
})

it.each(['csrf', 'json'] as const)(
  'same authority object ID cannot change during %s',
  async (phase) => {
    const authority = account()
    const fetch = fixture(() => {
      const response = new Response(JSON.stringify(saved))
      vi.spyOn(response, 'json').mockImplementation(async () => {
        authority.user.id = 'other'
        return saved
      })
      return response
    }, authority)
    if (phase === 'csrf') {
      fetch.mockImplementation(async (path: string) => {
        if (path.endsWith('/me')) return new Response(JSON.stringify(authority.user))
        authority.user.id = 'other'
        return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
      })
      await expect(prepare(authority)).rejects.toMatchObject({ status: 401 })
      expect(fetch.mock.calls.some(([path]) => path.includes('/baselines'))).toBe(false)
    } else {
      const context = await prepare(authority)
      await expect(context.active(signal())).rejects.toMatchObject({ status: 401 })
    }
  },
)

// FR-U-04/NFR-08: a timed-out request is not revived by an abort-ignoring completion.
it.each(['fetch', 'json'] as const)('rejects late %s after request timeout', async (phase) => {
  const timeout = new AbortController()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout.signal)
  let finish!: () => void
  let started = false
  const late = new Promise<void>((resolve) => {
    finish = resolve
  })
  fixture(async () => {
    const response = new Response(JSON.stringify(saved))
    if (phase === 'fetch') {
      started = true
      await late
    } else {
      vi.spyOn(response, 'json').mockImplementation(async () => {
        started = true
        await late
        return saved
      })
    }
    return response
  })
  const context = await prepare()
  const pending = context.active(signal())
  const assertion = expect(pending).rejects.toMatchObject({ status: 503 })
  await vi.waitFor(() => expect(started).toBe(true))
  timeout.abort()
  finish()
  await assertion
  await expect(context.active(signal())).rejects.toMatchObject({ status: 401 })
})
