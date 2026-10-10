// @vitest-environment happy-dom
// FR-R-03/06, FR-U-04: real React/AuthProvider; mock reader/auth responses.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '../api/auth'
import * as api from '../api/dashboard'
import type { DashboardOut } from '../api/generated'
import { AuthProvider, useAuth } from '../auth'
import { useOwnedDashboard } from './useOwnedDashboard'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.com' }
const query = { date: '2026-10-01', period: 'day' as const, timezone: 'UTC' }
const value: DashboardOut = {
  ...query,
  local_start: query.date,
  local_end: '2026-10-02',
  start: '2026-10-01T00:00:00Z',
  end: '2026-10-02T00:00:00Z',
  totals: {
    minutes: 0,
    coverage_sec: 0,
    measured_sec: 0,
    unmeasurable_sec: 0,
    present_sec: 0,
    background_sec: 0,
    any_bad_sec: 0,
  },
  metrics: [],
  stretch: { completed: 0, interrupted: 0, skipped: 0 },
  notifications: null,
  provenance: 'client-reported',
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function setup(guest = false, strict = false) {
  const server = { guest, user: { ...user }, logoutFail: false }
  const fetch = vi.fn(async (path: string) => {
    if (path.endsWith('/csrf')) return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
    if (path.endsWith('/logout'))
      return new Response(null, { status: server.logoutFail ? 503 : 204 })
    return new Response(JSON.stringify(server.guest ? {} : server.user), {
      status: server.guest ? 401 : 200,
    })
  })
  vi.stubGlobal('fetch', fetch)
  const reader = vi.spyOn(api, 'readDashboard').mockResolvedValue(value)
  let control!: ReturnType<typeof useOwnedDashboard>, auth!: ReturnType<typeof useAuth>
  function View() {
    control = useOwnedDashboard()
    auth = useAuth()
    return (
      <>
        <output data-testid="auth">{auth.state.status}</output>
        <output data-testid="query">{control.state.status}</output>
      </>
    )
  }
  const tree = (
    <AuthProvider>
      <View />
    </AuthProvider>
  )
  const rendered = render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return {
    server,
    reader,
    fetch,
    rendered,
    get control() {
      return control
    },
    get auth() {
      return auth
    },
    async ready() {
      await waitFor(() =>
        expect(screen.getByTestId('auth').textContent).toBe(guest ? 'guest' : 'ready'),
      )
    },
  }
}
async function read(h: ReturnType<typeof setup>) {
  let result: DashboardOut | null = null
  await act(async () => {
    result = await h.control.read(query)
  })
  return result
}
it.each([false, true])(
  'mount and ready stay inert; explicit read succeeds (StrictMode %s)',
  async (strict) => {
    const h = setup(false, strict)
    await h.ready()
    expect(h.reader).not.toHaveBeenCalled()
    expect(h.control.getSnapshot()).toEqual({ status: 'idle' })
    expect(await read(h)).toBe(value)
    expect(h.control.getSnapshot()).toEqual({ status: 'ready', value })
  },
)
it('guest cannot read or invent a result', async () => {
  const h = setup(true)
  await h.ready()
  expect(await read(h)).toBeNull()
  expect(h.reader).not.toHaveBeenCalled()
})
it('same-account refresh discards ready data without automatic reload', async () => {
  const h = setup()
  await h.ready()
  await read(h)
  const old = h.control
  await act(async () => {
    await h.auth.refresh()
  })
  expect(old.getSnapshot()).toEqual({ status: 'idle' })
  expect(h.reader).toHaveBeenCalledTimes(1)
  expect(await read(h)).toBe(value)
})
it('failed logout aborts held read and late success cannot restore data', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<DashboardOut>()
  h.reader.mockReturnValueOnce(held.promise)
  let task!: ReturnType<typeof h.control.read>
  await act(async () => {
    task = h.control.read(query)
  })
  const signal = h.reader.mock.calls[0][0].signal
  h.server.logoutFail = true
  await act(async () => {
    await h.auth.signOut()
  })
  expect(signal.aborted).toBe(true)
  expect(h.auth.state.status).toBe('logout-error')
  await act(async () => {
    held.resolve(value)
    expect(await task).toBeNull()
  })
  expect(h.control.getSnapshot()).toEqual({ status: 'idle' })
})
it.each(['success', 'failure'] as const)('new read wins over late old %s', async (kind) => {
  const h = setup()
  await h.ready()
  const held = deferred<DashboardOut>()
  h.reader.mockReturnValueOnce(held.promise)
  let old!: ReturnType<typeof h.control.read>
  await act(async () => {
    old = h.control.read(query)
  })
  expect(await read(h)).toBe(value)
  await act(async () => {
    if (kind === 'success') held.resolve({ ...value, timezone: 'synthetic-old' })
    else held.reject(new ApiError(401))
    expect(await old).toBeNull()
  })
  expect(h.control.getSnapshot()).toEqual({ status: 'ready', value })
  expect(h.auth.state.status).toBe('ready')
  expect(h.fetch).toHaveBeenCalledTimes(1)
})
it.each(['cancel', 'pagehide', 'unmount'] as const)(
  '%s retires pending work and retained control',
  async (event) => {
    const h = setup()
    await h.ready()
    const held = deferred<DashboardOut>()
    h.reader.mockReturnValueOnce(held.promise)
    const old = h.control
    let task!: ReturnType<typeof h.control.read>
    await act(async () => {
      task = old.read(query)
    })
    act(() => {
      if (event === 'cancel') old.cancel()
      else if (event === 'pagehide') window.dispatchEvent(new Event('pagehide'))
      else h.rendered.unmount()
    })
    expect(h.reader.mock.calls[0][0].signal.aborted).toBe(true)
    await act(async () => {
      held.resolve(value)
      expect(await task).toBeNull()
    })
    expect(old.getSnapshot()).toEqual({ status: 'idle' })
    if (event === 'unmount') expect(await old.read(query)).toBeNull()
  },
)
it('503 shows error with no value; retry is explicit', async () => {
  const h = setup()
  await h.ready()
  h.reader.mockRejectedValueOnce(new ApiError(503))
  expect(await read(h)).toBeNull()
  expect(h.control.getSnapshot()).toEqual({ status: 'error', statusCode: 503 })
  expect(h.reader).toHaveBeenCalledTimes(1)
  expect(await read(h)).toBe(value)
})
it('current 401 rechecks AuthProvider and stays guest without a result', async () => {
  const h = setup()
  await h.ready()
  h.server.guest = true
  h.reader.mockRejectedValueOnce(new ApiError(401))
  expect(await read(h)).toBeNull()
  await waitFor(() => expect(h.auth.state.status).toBe('guest'))
  expect(h.control.getSnapshot()).toEqual({ status: 'idle' })
})
it('account replacement cannot keep old result or requery without a new action', async () => {
  const h = setup()
  await h.ready()
  await read(h)
  h.server.user.id = '00000000-0000-4000-8000-000000000002'
  await act(async () => {
    await h.auth.refresh()
  })
  expect(h.control.getSnapshot()).toEqual({ status: 'idle' })
  expect(h.reader).toHaveBeenCalledTimes(1)
  expect(await read(h)).toBe(value)
  expect(h.reader.mock.calls[1][0].authority.user.id).toBe(h.server.user.id)
})
