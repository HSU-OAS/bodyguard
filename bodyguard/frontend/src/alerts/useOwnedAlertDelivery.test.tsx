// @vitest-environment happy-dom
// FR-N-03/04/05/FR-U-04/NFR-08: committed auth and settings, synthetic events/ports only.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../auth'
import type { NotificationPort } from './delivery'
import { useOwnedAlertDelivery } from './useOwnedAlertDelivery'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'synthetic@example.com' }
const defaults = {
  posture_enabled: true,
  posture_minutes: 5,
  sitting_enabled: false,
  sitting_minutes: 50,
  sound_enabled: true,
}
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
type Control = ReturnType<typeof useOwnedAlertDelivery>
function setup(guest = false, strict = false) {
  const state = { guest, user: { ...user }, failLogout: false, preferences: { ...defaults } }
  const fetch = vi.fn(async (path: string, _init?: RequestInit) => {
    if (path.endsWith('/me'))
      return response(state.guest ? {} : state.user, state.guest ? 401 : 200)
    if (path.endsWith('/csrf')) return response({ csrf_token: 'a'.repeat(64) })
    if (path.endsWith('/settings/notifications')) return response(state.preferences)
    if (path.endsWith('/logout'))
      return new Response(null, { status: state.failLogout ? 503 : 204 })
    throw new Error('Unexpected test request')
  })
  vi.stubGlobal('fetch', fetch)
  const handles: Array<{ close: ReturnType<typeof vi.fn>; click(): void; fail(): void }> = []
  const request = deferred<NotificationPermission>()
  const port: NotificationPort = {
    permission: vi.fn(() => 'granted' as const),
    requestPermission: vi.fn(() => request.promise),
    show: vi.fn((_kind, click, fail) => {
      const value = { close: vi.fn(), click, fail }
      handles.push(value)
      return value
    }),
  }
  const onChoose = vi.fn()
  let control!: Control
  let auth!: ReturnType<typeof useAuth>
  function View() {
    control = useOwnedAlertDelivery()
    auth = useAuth()
    return <output data-testid="auth">{auth.state.status}</output>
  }
  const tree = (
    <AuthProvider>
      <View />
    </AuthProvider>
  )
  const rendered = render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return {
    state,
    fetch,
    port,
    handles,
    request,
    onChoose,
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
type Harness = ReturnType<typeof setup>
async function prepare(h: Harness) {
  let result: Awaited<ReturnType<Control['prepare']>> = null
  await act(async () => {
    result = await h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  if (!result) throw new Error('Missing synthetic delivery')
  return result as NonNullable<Awaited<ReturnType<Control['prepare']>>>
}
it('O01 mount/checking/ready stay inert until explicit preparation', async () => {
  const h = setup()
  let result: unknown
  await act(async () => {
    result = await h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  expect(result).toBeNull()
  await h.ready()
  expect(h.fetch).toHaveBeenCalledTimes(1)
  expect(h.control.state).toEqual({ status: 'idle' })
  expect(h.control.getDelivery()).toBeNull()
  expect(h.port.permission).not.toHaveBeenCalled()
  expect(h.port.requestPermission).not.toHaveBeenCalled()
  expect(h.port.show).not.toHaveBeenCalled()
})
it('O01 guest cannot prepare or read preferences', async () => {
  const h = setup(true)
  await h.ready()
  await act(async () => {
    expect(await h.control.prepare({ port: h.port, onChoose: h.onChoose })).toBeNull()
  })
  expect(h.fetch).toHaveBeenCalledTimes(1)
  expect(h.port.permission).not.toHaveBeenCalled()
})
it('O02 reads both account bookends and applies enabled fields without time/sound policy', async () => {
  const h = setup()
  await h.ready()
  const delivery = await prepare(h)
  expect(h.fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/me',
    '/api/v1/me',
    '/api/v1/auth/csrf',
    '/api/v1/settings/notifications',
    '/api/v1/me',
  ])
  expect(h.control.state.status).toBe('prepared')
  expect(h.control.getDelivery()).toBe(delivery)
  expect(h.port.requestPermission).not.toHaveBeenCalled()
  expect(delivery.receive('sitting')).toBe(false)
  expect(delivery.receive('posture')).toBe(true)
  expect(h.port.show).toHaveBeenCalledTimes(1)
  expect(delivery.choose('posture')).toBe(true)
  expect(h.onChoose).toHaveBeenCalledWith('posture')
  expect(h.handles[0]?.close).toHaveBeenCalledTimes(1)
  expect(h.fetch.mock.calls.every(([, init]) => !init || init.method === 'GET')).toBe(true)
})
it.each(['different account', 'malformed settings', 'failed settings'])(
  'O02 %s never creates a delivery or fallback',
  async (fault) => {
    const h = setup()
    await h.ready()
    if (fault === 'different account') h.state.user.id = '00000000-0000-4000-8000-000000000002'
    else {
      h.fetch.mockImplementation(async (path: string) => {
        if (path.endsWith('/me')) return response(user)
        if (path.endsWith('/csrf')) return response({ csrf_token: 'a'.repeat(64) })
        return fault === 'malformed settings'
          ? response({ ...defaults, posture_enabled: 'yes' })
          : response({}, 503)
      })
    }
    await act(async () => {
      expect(await h.control.prepare({ port: h.port, onChoose: h.onChoose })).toBeNull()
    })
    expect(h.control.state.status).toBe('failed')
    expect(h.control.getDelivery()).toBeNull()
    expect(h.port.permission).not.toHaveBeenCalled()
  },
)
it('O03 same-user refresh closes handles and rejects old callback before explicit fresh settings', async () => {
  const h = setup()
  await h.ready()
  const delivery = await prepare(h)
  delivery.receive('posture')
  await act(async () => {
    await h.auth.refresh()
  })
  expect(delivery.getSnapshot()).toMatchObject({ closed: true, alerts: [] })
  expect(h.handles[0]?.close).toHaveBeenCalledTimes(1)
  h.handles[0]?.click()
  expect(h.onChoose).not.toHaveBeenCalled()
  expect(h.control.getDelivery()).toBeNull()
  expect(h.control.state.status).toBe('idle')
  h.state.preferences = { ...defaults, posture_enabled: false, sitting_enabled: true }
  const fresh = await prepare(h)
  expect(fresh.receive('posture')).toBe(false)
  expect(fresh.receive('sitting')).toBe(true)
})
it('O03 logout failure still disposes delivery and cannot revive it', async () => {
  const h = setup()
  await h.ready()
  const delivery = await prepare(h)
  delivery.receive('posture')
  h.state.failLogout = true
  await act(async () => {
    await h.auth.signOut()
  })
  expect(h.auth.state.status).toBe('logout-error')
  expect(delivery.getSnapshot().closed).toBe(true)
  expect(delivery.receive('posture')).toBe(false)
  expect(h.control.getDelivery()).toBeNull()
})
it('O03 cancellation aborts held settings and late resolve cannot revive', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockImplementation(async (path: string) =>
    path.endsWith('/settings/notifications')
      ? held.promise
      : response(path.endsWith('/me') ? user : { csrf_token: 'a'.repeat(64) }),
  )
  let task!: ReturnType<Control['prepare']>
  await act(async () => {
    task = h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  const call = h.fetch.mock.calls.find(([url]) => url.endsWith('/settings/notifications'))
  expect(call?.[1]?.signal?.aborted).toBe(false)
  act(() => h.control.cancel())
  expect(call?.[1]?.signal?.aborted).toBe(true)
  await act(async () => {
    held.resolve(response(defaults))
    expect(await task).toBeNull()
  })
  expect(h.control.state.status).toBe('idle')
  expect(h.control.getDelivery()).toBeNull()
  expect(h.port.permission).not.toHaveBeenCalled()
})
it('O03 replacing a held prepare keeps the new delivery intact', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let old!: ReturnType<Control['prepare']>
  await act(async () => {
    old = h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  const fresh = await prepare(h)
  await act(async () => {
    held.resolve(response(user))
    expect(await old).toBeNull()
  })
  expect(h.control.getDelivery()).toBe(fresh)
  expect(fresh.getSnapshot().closed).toBe(false)
})
it.each([false, true])(
  'O03 unmount/StrictMode (%s) close the owned handle once',
  async (strict) => {
    const h = setup(false, strict)
    await h.ready()
    const delivery = await prepare(h)
    delivery.receive('posture')
    h.rendered.unmount()
    expect(delivery.getSnapshot().closed).toBe(true)
    expect(h.handles[0]?.close).toHaveBeenCalledTimes(1)
    expect(delivery.choose('posture')).toBe(false)
    expect(h.onChoose).not.toHaveBeenCalled()
  },
)
it.each(['hidden', 'pagehide'])(
  'O04 %s closes before late permission, never auto-restarts',
  async (event) => {
    const h = setup()
    await h.ready()
    vi.mocked(h.port.permission).mockReturnValue('default')
    const delivery = await prepare(h)
    let permission!: Promise<void>
    await act(async () => {
      permission = delivery.requestPermission()
    })
    act(() => {
      if (event === 'hidden') {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
        document.dispatchEvent(new Event('visibilitychange'))
      } else window.dispatchEvent(new Event('pagehide'))
    })
    expect(delivery.getSnapshot().closed).toBe(true)
    await act(async () => {
      h.request.resolve('granted')
      await permission
    })
    expect(h.control.state.status).toBe('idle')
    expect(h.control.getDelivery()).toBeNull()
    expect(delivery.receive('posture')).toBe(false)
    expect(h.port.show).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(h.control.getDelivery()).toBeNull()
  },
)
it('O04 already hidden cannot prepare or request settings', async () => {
  const h = setup()
  await h.ready()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  await act(async () => {
    expect(await h.control.prepare({ port: h.port, onChoose: h.onChoose })).toBeNull()
  })
  expect(h.fetch).toHaveBeenCalledTimes(1)
})
it('O04 pagehide during pending preparation cannot resurrect and explicit next prepare works', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let task!: ReturnType<Control['prepare']>
  await act(async () => {
    task = h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  act(() => window.dispatchEvent(new Event('pagehide')))
  await act(async () => {
    held.resolve(response(user))
    expect(await task).toBeNull()
  })
  expect(h.control.state.status).toBe('idle')
  expect(h.control.getDelivery()).toBeNull()
  expect(await prepare(h)).toBe(h.control.getDelivery())
})
it('O03 a close subscriber re-preparing owns the newest operation, not the enclosing prepare', async () => {
  const h = setup()
  await h.ready()
  const old = await prepare(h)
  let nested: ReturnType<Control['prepare']> | null = null
  old.subscribe(() => {
    if (old.getSnapshot().closed && !nested)
      nested = h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  let enclosing: unknown
  let newest: unknown
  await act(async () => {
    enclosing = await h.control.prepare({ port: h.port, onChoose: h.onChoose })
    newest = await nested
  })
  expect(enclosing).toBeNull()
  expect(newest).not.toBeNull()
  expect(h.control.getDelivery()).toBe(newest)
  expect(h.control.state.status).toBe('prepared')
})
it('O03 cancel subscriber can prepare a fresh lifetime without idle overriding its intent', async () => {
  const h = setup()
  await h.ready()
  const old = await prepare(h)
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  let next: ReturnType<Control['prepare']> | null = null
  old.subscribe(() => {
    if (old.getSnapshot().closed && !next)
      next = h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  act(() => h.control.cancel())
  expect(h.control.state.status).toBe('preparing')
  await act(async () => {
    held.resolve(response(user))
    await next
  })
  expect(h.control.getDelivery()).not.toBeNull()
})
it('O03 held settings are aborted by committed refresh and cannot revive the old owner', async () => {
  const h = setup()
  await h.ready()
  const held = deferred<Response>()
  h.fetch.mockImplementation(async (path: string) =>
    path.endsWith('/settings/notifications')
      ? held.promise
      : response(path.endsWith('/me') ? user : { csrf_token: 'a'.repeat(64) }),
  )
  let pending!: ReturnType<Control['prepare']>
  await act(async () => {
    pending = h.control.prepare({ port: h.port, onChoose: h.onChoose })
  })
  const call = h.fetch.mock.calls.find(([url]) => url.endsWith('/settings/notifications'))
  await act(async () => {
    await h.auth.refresh()
  })
  expect(call?.[1]?.signal?.aborted).toBe(true)
  await act(async () => {
    held.resolve(response(defaults))
    expect(await pending).toBeNull()
  })
  expect(h.control.state.status).toBe('idle')
  expect(h.port.permission).not.toHaveBeenCalled()
})
it('O04 preparation owns one listener pair and cancel detaches the exact handlers', async () => {
  const h = setup()
  await h.ready()
  const addPage = vi.spyOn(document, 'addEventListener')
  const removePage = vi.spyOn(document, 'removeEventListener')
  const addWindow = vi.spyOn(window, 'addEventListener')
  const removeWindow = vi.spyOn(window, 'removeEventListener')
  await prepare(h)
  const pageHandlers = addPage.mock.calls.filter(([name]) => name === 'visibilitychange')
  const windowHandlers = addWindow.mock.calls.filter(([name]) => name === 'pagehide')
  expect(pageHandlers).toHaveLength(1)
  expect(windowHandlers).toHaveLength(1)
  act(() => {
    h.control.cancel()
    h.control.cancel()
  })
  expect(removePage.mock.calls.filter(([name]) => name === 'visibilitychange')).toEqual(
    pageHandlers,
  )
  expect(removeWindow.mock.calls.filter(([name]) => name === 'pagehide')).toEqual(windowHandlers)
})
it('O04 pagehide during old notification reclamation cancels the incoming prepare before HTTP', async () => {
  const h = setup()
  await h.ready()
  const old = await prepare(h)
  old.receive('posture')
  h.handles[0]?.close.mockImplementation(() => window.dispatchEvent(new Event('pagehide')))
  const before = h.fetch.mock.calls.length
  await act(async () => {
    expect(await h.control.prepare({ port: h.port, onChoose: h.onChoose })).toBeNull()
  })
  expect(h.control.state.status).toBe('idle')
  expect(h.control.getDelivery()).toBeNull()
  expect(h.fetch).toHaveBeenCalledTimes(before)
})
