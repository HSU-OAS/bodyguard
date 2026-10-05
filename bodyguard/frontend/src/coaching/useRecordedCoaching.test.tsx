// @vitest-environment happy-dom
// FR-U-04/FR-S-04/NFR-08: initial private contract, no camera/user body inputs.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../auth'
import { useRecordedCoaching } from './useRecordedCoaching'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.com' }
const id = '00000000-0000-4000-8000-000000000002'
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
type Control = ReturnType<typeof useRecordedCoaching>
function setup(initialGuest = false, strict = false) {
  const resources: { dispose: ReturnType<typeof vi.fn> }[] = []
  const acquire = async () => {
    const value = { dispose: vi.fn() }
    resources.push(value)
    return value
  }
  let now = 0
  const options = {
    recordId: id,
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct' as const,
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'first', kind: 'hold' as const, targetMs: 100 }],
    },
    ports: { camera: vi.fn(acquire), inference: vi.fn(acquire), avatars: vi.fn(acquire) },
    readClockPair: () => ({ monotonicMs: now, utc: '2026-10-05T00:00:00.000Z' }),
    readGates: () => ({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange: vi.fn(),
  }
  const state = { guest: initialGuest, failLogout: false, user: { ...user } }
  const rows: unknown[] = []
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/me'))
      return response(state.guest ? {} : state.user, state.guest ? 401 : 200)
    if (path.endsWith('/csrf')) return response({ csrf_token: 'a'.repeat(64) })
    if (path.endsWith('/logout'))
      return state.failLogout ? response({}, 503) : new Response(null, { status: 204 })
    const row = JSON.parse(String(init?.body))
    rows.push(row)
    return response({ ...row, created_at: row.ended_at, provenance: 'client-reported' }, 201)
  })
  vi.stubGlobal('fetch', fetch)
  let control!: Control
  let auth!: ReturnType<typeof useAuth>
  function View() {
    control = useRecordedCoaching()
    auth = useAuth()
    return (
      <>
        <output data-testid="auth">{auth.state.status}</output>
        <output data-testid="hook">{control.state.status}</output>
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
    fetch,
    resources,
    options,
    state,
    rows,
    rendered,
    get control() {
      return control
    },
    get auth() {
      return auth
    },
    at(ms: number) {
      now = ms
    },
    async ready() {
      await waitFor(() =>
        expect(screen.getByTestId('auth').textContent).toBe(initialGuest ? 'guest' : 'ready'),
      )
    },
  }
}
type Harness = ReturnType<typeof setup>
async function prepare(h: Harness) {
  let value: Awaited<ReturnType<Control['prepare']>> = null
  await act(async () => {
    value = await h.control.prepare(h.options)
  })
  if (!value) throw new Error('Synthetic hook preparation missing')
  return value as NonNullable<Awaited<ReturnType<Control['prepare']>>>
}
it('H01 mounting and idle ready do not capture/start/post beyond existing provider me', async () => {
  const h = setup()
  await h.ready()
  expect(h.fetch).toHaveBeenCalledTimes(1)
  expect(h.control.state).toEqual({ status: 'idle', failure: null })
  expect(h.control.getSession()).toBeNull()
  expect(h.options.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(0)
})
it('H01 initial provider checking cannot capture, and becoming ready never starts implicitly', async () => {
  const h = setup()
  expect(h.auth.state.status).toBe('checking')
  let value: unknown
  await act(async () => {
    value = await h.control.prepare(h.options)
  })
  expect(value).toBeNull()
  await h.ready()
  expect(h.control.state.status).toBe('idle')
  expect(h.fetch).toHaveBeenCalledTimes(1)
  expect(h.options.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(0)
})
it('H01 guest explicit preparation cannot capture or start resources', async () => {
  const h = setup(true)
  await h.ready()
  let value: unknown
  await act(async () => {
    value = await h.control.prepare(h.options)
  })
  expect(value).toBeNull()
  expect(h.fetch).toHaveBeenCalledTimes(1)
  expect(h.options.ports.camera).not.toHaveBeenCalled()
})
it('H02 provider ready captures owner but constructor is inert; actual engine can explicitly save', async () => {
  const h = setup()
  await h.ready()
  const session = await prepare(h)
  expect(h.fetch).toHaveBeenCalledTimes(4)
  expect(h.options.ports.camera).not.toHaveBeenCalled()
  expect(h.control.state).toEqual({ status: 'prepared', failure: null })
  await session.start()
  h.at(100)
  await session.end('user-stop')
  await session.save()
  expect(h.rows[0]).toMatchObject({
    id,
    outcome: 'interrupted',
    started_at: '2026-10-05T00:00:00.000Z',
    ended_at: '2026-10-05T00:00:00.100Z',
  })
  await act(async () => {
    await h.control.cancel()
  })
  expect(h.control.getSession()).toBeNull()
  expect(session.getRecordSnapshot().status).toBe('closed')
})
it('H03 same user refresh replaces actual ready object and disposes original session', async () => {
  const h = setup()
  await h.ready()
  const session = await prepare(h)
  await session.start()
  await act(async () => {
    await h.auth.refresh()
  })
  expect(h.control.getSession()).toBeNull()
  expect(h.control.state.status).toBe('idle')
  await session.resume()
  await session.save()
  expect(h.options.ports.camera).toHaveBeenCalledTimes(1)
  expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
  expect(h.rows).toHaveLength(0)
})
it('H03 logout failure still disposes private resources and cannot refresh/revive old session', async () => {
  const h = setup()
  await h.ready()
  const session = await prepare(h)
  await session.start()
  h.state.failLogout = true
  await act(async () => {
    await h.auth.signOut()
  })
  expect(screen.getByTestId('auth').textContent).toBe('logout-error')
  expect(h.control.getSession()).toBeNull()
  await session.save()
  expect(h.rows).toHaveLength(0)
  expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
})
it('H03 actual different server account cannot become original ready authority', async () => {
  const h = setup()
  await h.ready()
  h.state.user = { ...user, id: '00000000-0000-4000-8000-000000000003' }
  let value: unknown
  await act(async () => {
    value = await h.control.prepare(h.options)
  })
  expect(value).toBeNull()
  expect(h.control.state).toEqual({ status: 'failed', failure: 'preparation-error' })
  expect(h.options.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(0)
})
it('H03 held capture cannot revive a refreshed authority', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let task!: ReturnType<Control['prepare']>
  await act(async () => {
    task = h.control.prepare(h.options)
  })
  expect(h.control.state.status).toBe('preparing')
  await act(async () => {
    await h.auth.refresh()
  })
  let value: unknown
  await act(async () => {
    held.resolve(response(user))
    value = await task
  })
  expect(value).toBeNull()
  expect(h.control.getSession()).toBeNull()
  expect(h.control.state.status).toBe('idle')
  expect(h.options.ports.camera).not.toHaveBeenCalled()
})
it('H03 second prepare cancels held first, late first cannot dispose current session', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let first!: ReturnType<Control['prepare']>
  await act(async () => {
    first = h.control.prepare(h.options)
  })
  const second = await prepare(h)
  await act(async () => {
    held.resolve(response(user))
    expect(await first).toBeNull()
  })
  expect(h.control.getSession()).toBe(second)
  await second.start()
  expect(h.options.ports.camera).toHaveBeenCalledTimes(1)
  await act(async () => {
    await h.control.cancel()
  })
})
it('H03 unmount during capture drops late context and never updates mounted UI', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let task!: ReturnType<Control['prepare']>
  await act(async () => {
    task = h.control.prepare(h.options)
  })
  h.rendered.unmount()
  held.resolve(response(user))
  expect(await task).toBeNull()
  expect(h.options.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(0)
})
it('H03 unmount closes running resources and suppresses observer after disposal', async () => {
  const h = setup()
  await h.ready()
  const session = await prepare(h)
  await session.start()
  const count = h.options.onChange.mock.calls.length
  h.rendered.unmount()
  await waitFor(() =>
    expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true),
  )
  expect(h.options.onChange).toHaveBeenCalledTimes(count)
  await session.save()
  expect(h.rows).toHaveLength(0)
})
it('H03 StrictMode repeated mount/cleanup does not capture or start on its own', async () => {
  const h = setup(false, true)
  await h.ready()
  const session = await prepare(h)
  await session.start()
  await act(async () => {
    await h.control.cancel()
    await h.control.cancel()
  })
  expect(h.resources).toHaveLength(3)
  expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
  expect(h.rows).toHaveLength(0)
})
it.each(['visibilitychange', 'pagehide'])(
  'H04 %s drops context/listeners and returning visible never restarts',
  async (event) => {
    const h = setup()
    await h.ready()
    const session = await prepare(h)
    await session.start()
    const removePage = vi.spyOn(document, 'removeEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => {
      fireEvent(event === 'pagehide' ? window : document, new Event(event))
    })
    expect(h.control.getSession()).toBeNull()
    expect(removePage).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(removeWindow).toHaveBeenCalledWith('pagehide', expect.any(Function))
    visibility.mockReturnValue('visible')
    await act(async () => {
      fireEvent(document, new Event('visibilitychange'))
    })
    await session.resume()
    expect(h.options.ports.camera).toHaveBeenCalledTimes(1)
    expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
    expect(h.rows).toHaveLength(0)
  },
)
it('H04 already hidden page rejects prepared context without opening resources', async () => {
  const h = setup()
  await h.ready()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  let value: unknown
  await act(async () => {
    value = await h.control.prepare(h.options)
  })
  expect(value).toBeNull()
  expect(h.control.getSession()).toBeNull()
  expect(h.options.ports.camera).not.toHaveBeenCalled()
})
it('H04 pagehide revokes a held capture even if the page becomes visible before it returns', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let pending!: ReturnType<Control['prepare']>
  await act(async () => {
    pending = h.control.prepare(h.options)
    await Promise.resolve()
  })
  try {
    await act(async () => {
      fireEvent(window, new Event('pagehide'))
    })
    expect(h.control.state.status).toBe('idle')
  } finally {
    await act(async () => {
      held.resolve(response(user))
      await pending
    })
  }
  expect(h.control.getSession()).toBeNull()
  expect(h.options.ports.camera).not.toHaveBeenCalled()
})
it('H03 raw configuration failure stays fixed and cannot leak through hook state', async () => {
  const h = setup()
  await h.ready()
  let value: unknown
  await act(async () => {
    value = await h.control.prepare({
      ...h.options,
      get plan(): typeof h.options.plan {
        throw new Error('PRIVATE_AUTH_LIFECYCLE_COORDINATES')
      },
    })
  })
  expect(value).toBeNull()
  expect(h.control.state).toEqual({ status: 'failed', failure: 'preparation-error' })
  expect(JSON.stringify(h.control.state)).not.toContain('PRIVATE_AUTH')
  expect(h.options.ports.camera).not.toHaveBeenCalled()
})

it('H03 failed old preparation cannot overwrite a newer held preparation status', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let first!: ReturnType<Control['prepare']>
  let second!: ReturnType<Control['prepare']>
  await act(async () => {
    first = h.control.prepare({ ...h.options, recordId: 'invalid' })
    second = h.control.prepare(h.options)
    expect(await first).toBeNull()
  })
  try {
    expect(h.control.state.status).toBe('preparing')
  } finally {
    await act(async () => {
      held.resolve(response(user))
      await second
    })
  }
  expect(h.control.state.status).toBe('prepared')
})
it('H04 repeated cancel joins an already pending owned disposal', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<void>()
  const dispose = vi.fn(() => held.promise)
  h.options.ports.camera.mockResolvedValueOnce({ dispose })
  const session = await prepare(h)
  await session.start()
  let first!: Promise<void>
  let second!: Promise<void>
  let joined = false
  await act(async () => {
    first = h.control.cancel()
    second = h.control.cancel()
    void second.then(() => {
      joined = true
    })
    await Promise.resolve()
    await Promise.resolve()
  })
  try {
    expect(joined).toBe(false)
  } finally {
    await act(async () => {
      held.resolve()
      await Promise.all([first, second])
    })
  }
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(h.rows).toHaveLength(0)
})

it('H04 cancellation never serializes an unresolved permission factory; late resource is reclaimed', async () => {
  const h = setup()
  await h.ready()
  const late = { dispose: vi.fn(() => undefined) }
  const held = deferred<typeof late>()
  h.options.ports.camera.mockImplementationOnce(() => held.promise)
  const session = await prepare(h)
  const pending = session.start()
  await waitFor(() => expect(h.options.ports.camera).toHaveBeenCalledTimes(1))
  await act(async () => {
    await h.control.cancel()
  })
  expect(h.control.getSession()).toBeNull()
  held.resolve(late)
  await pending
  expect(late.dispose).toHaveBeenCalledTimes(1)
  expect(h.options.ports.inference).not.toHaveBeenCalled()
  await session.save()
  expect(h.rows).toHaveLength(0)
})
