// FR-N-03/FR-U-04: strict public settings contract, private proof and auth lease.
import { afterEach, expect, it, vi } from 'vitest'
import type { ReadyAccount } from '../auth'
import { parsePreferences, preparePreferences } from './notificationPreferences'

const values = {
  posture_enabled: true,
  posture_minutes: 5,
  sitting_enabled: true,
  sitting_minutes: 50,
  sound_enabled: false,
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status })
const makeOwner = (): ReadyAccount => ({
  status: 'ready',
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' },
})
afterEach(() => vi.unstubAllGlobals())
it.each([
  null,
  [],
  { ...values, extra: true },
  { ...values, posture_minutes: true },
  { ...values, sitting_minutes: '50' },
  { ...values, posture_minutes: 1.5 },
  { ...values, posture_minutes: 0 },
  { ...values, sitting_minutes: 1441 },
  { ...values, sound_enabled: 'false' },
  { posture_enabled: true },
])('strictly rejects a malformed preference DTO: %j', (v) => {
  expect(() => parsePreferences(v)).toThrow()
})
it('copies only the exact validated values, including technical range boundaries', () => {
  const original = { ...values, posture_minutes: 1, sitting_minutes: 1440 }
  const parsed = parsePreferences(original)
  expect(parsed).toEqual(original)
  expect(parsed).not.toBe(original)
})
it('prepares from real-shaped me/csrf/settings/me; save uses original proof without fresh credentials', async () => {
  const authority = makeOwner()
  let csrf = 'a'.repeat(64)
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/v1/me') return json(authority.user)
    if (url === '/api/v1/auth/csrf') return json({ csrf_token: csrf })
    return json(init?.method === 'POST' ? JSON.parse(String(init.body)) : values)
  })
  vi.stubGlobal('fetch', fetcher)
  const context = await preparePreferences({
    authority,
    readAuthority: () => authority,
    signal: new AbortController().signal,
  })
  expect(context.value).toEqual(values)
  const read = fetcher.mock.calls.find(([url]) => url === '/api/v1/settings/notifications')
  expect(new Headers(read?.[1]?.headers).get('X-CSRF-Token')).toBe('a'.repeat(64))
  expect(new Headers(read?.[1]?.headers).get('X-Account-ID')).toBe(authority.user.id)
  csrf = 'b'.repeat(64)
  const saved = await context.save({ ...values, posture_minutes: 8 })
  expect(saved.posture_minutes).toBe(8)
  expect(context.value.posture_minutes).toBe(8)
  expect(fetcher.mock.calls.filter(([url]) => url === '/api/v1/auth/csrf')).toHaveLength(1)
  const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(new Headers(post?.[1]?.headers).get('X-CSRF-Token')).toBe('a'.repeat(64))
  expect(
    fetcher.mock.calls.every(
      ([, init]) => init?.credentials === 'same-origin' && init.cache === 'no-store',
    ),
  ).toBe(true)
  expect(Object.keys(context).sort()).toEqual(['close', 'save', 'value'])
})
it('a pending POST prevents a second write before any response and input mutation cannot change the sent snapshot', async () => {
  const authority = makeOwner()
  let done: (r: Response) => void = () => {}
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST')
      return new Promise<Response>((r) => {
        done = r
      })
    return Promise.resolve(
      json(
        url.endsWith('/me')
          ? authority.user
          : url.endsWith('/csrf')
            ? { csrf_token: 'a'.repeat(64) }
            : values,
      ),
    )
  })
  vi.stubGlobal('fetch', fetcher)
  const context = await preparePreferences({
    authority,
    readAuthority: () => authority,
    signal: new AbortController().signal,
  })
  const input = { ...values, posture_minutes: 8 }
  const first = context.save(input)
  input.posture_minutes = 9
  await expect(context.save(values)).rejects.toThrow()
  expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  done(json({ ...values, posture_minutes: 8 }))
  await expect(first).resolves.toEqual({ ...values, posture_minutes: 8 })
})
it('a committed same-ID new ready object retires the old form without POST', async () => {
  const authority = makeOwner()
  let current = authority
  const fetcher = vi.fn(async (url: string, _init?: RequestInit) =>
    json(
      url.endsWith('/me')
        ? authority.user
        : url.endsWith('/csrf')
          ? { csrf_token: 'a'.repeat(64) }
          : values,
    ),
  )
  vi.stubGlobal('fetch', fetcher)
  const context = await preparePreferences({
    authority,
    readAuthority: () => current,
    signal: new AbortController().signal,
  })
  current = makeOwner()
  await expect(context.save(values)).rejects.toThrow()
  expect(
    fetcher.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'POST'),
  ).toBe(false)
})
it('a changed-cookie final me does not expose a form even when caller missed the authority change', async () => {
  const authority = makeOwner()
  let reads = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/me'))
        return json(
          ++reads === 1
            ? authority.user
            : { ...authority.user, id: '00000000-0000-4000-8000-000000000002' },
        )
      return json(url.endsWith('/csrf') ? { csrf_token: 'a'.repeat(64) } : values)
    }),
  )
  await expect(
    preparePreferences({
      authority,
      readAuthority: () => authority,
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow()
})
it('explicit close/abort and late responses cannot confirm a past save', async () => {
  const authority = makeOwner()
  const abort = new AbortController()
  let done: (r: Response) => void = () => {}
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return new Promise<Response>((r) => {
          done = r
        })
      return Promise.resolve(
        json(
          url.endsWith('/me')
            ? authority.user
            : url.endsWith('/csrf')
              ? { csrf_token: 'a'.repeat(64) }
              : values,
        ),
      )
    }),
  )
  const context = await preparePreferences({
    authority,
    readAuthority: () => authority,
    signal: abort.signal,
  })
  const saving = context.save(values)
  const rejection = expect(saving).rejects.toThrow()
  context.close()
  abort.abort()
  done(json(values))
  await rejection
  await expect(context.save(values)).rejects.toThrow()
})

// FR-U-04/NFR-08: same object identity must not transfer its authority to another ID.
it.each(['csrf', 'settings-json', 'before-save', 'save-json'] as const)(
  'rejects original settings owner mutation in %s',
  async (phase) => {
    const authority = makeOwner()
    let serverOwner = authority.user.id
    const mutate = () => {
      authority.user.id = serverOwner = '00000000-0000-4000-8000-000000000002'
    }
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/me')) return json({ ...authority.user, id: serverOwner })
      if (url.endsWith('/csrf')) {
        if (phase === 'csrf') mutate()
        return json({ csrf_token: 'a'.repeat(64) })
      }
      const response = json(values)
      if (phase === 'settings-json' || (phase === 'save-json' && init?.method === 'POST'))
        response.json = async () => {
          mutate()
          return values
        }
      return response
    })
    vi.stubGlobal('fetch', fetcher)
    const prepared = preparePreferences({
      authority,
      readAuthority: () => authority,
      signal: new AbortController().signal,
    })
    if (phase === 'csrf' || phase === 'settings-json')
      await expect(prepared).rejects.toMatchObject({ status: 401 })
    else {
      const context = await prepared
      if (phase === 'before-save') mutate()
      await expect(context.save(values)).rejects.toMatchObject({ status: 401 })
      context.close()
    }
    if (phase === 'before-save')
      expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    if (phase === 'csrf')
      expect(fetcher.mock.calls.some(([url]) => url.endsWith('/settings/notifications'))).toBe(
        false,
      )
  },
)
it.each([
  { ...values, posture_minutes: 99 },
  { ...values, extra: 1 },
])('different or extra response values are not a save confirmation: %j', async (response) => {
  const authority = makeOwner()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) =>
      json(
        init?.method === 'POST'
          ? response
          : url.endsWith('/me')
            ? authority.user
            : url.endsWith('/csrf')
              ? { csrf_token: 'a'.repeat(64) }
              : values,
      ),
    ),
  )
  const context = await preparePreferences({
    authority,
    readAuthority: () => authority,
    signal: new AbortController().signal,
  })
  await expect(context.save(values)).rejects.toThrow()
})
