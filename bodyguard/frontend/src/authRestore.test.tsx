// @vitest-environment happy-dom
// FR-U-04/NFR-08: synthetic lifecycle; native cache restoration is verified separately.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth'

const owned = { id: 'synthetic-owner', email: 'synthetic@example.invalid' }
const fresh = { id: 'synthetic-new-owner', email: 'new@example.invalid' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function View() {
  const { state, signOut, signIn, refresh } = useAuth()
  return (
    <>
      <output>{state.status}</output>
      {state.status === 'ready' && <p>{state.user.email}</p>}
      <button type="button" onClick={() => void signOut()}>
        Logout
      </button>
      <button
        type="button"
        onClick={() =>
          void signIn(
            'login',
            { email: fresh.email, password: 'test-only-password-long' },
            new AbortController().signal,
          ).catch(() => {})
        }
      >
        Login
      </button>
      <button type="button" onClick={() => void refresh()}>
        Refresh
      </button>
    </>
  )
}
function show(persisted = true) {
  const event = new Event('pageshow')
  Object.defineProperty(event, 'persisted', { value: persisted })
  fireEvent(window, event)
}
function mount() {
  render(
    <AuthProvider>
      <View />
    </AuthProvider>,
  )
}

it.each([200, 202, 503])(
  'AR-01 cached restore does not revive private UI after logout%s',
  async (status) => {
    let confirmed = false
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/me')) return json(owned)
      if (String(url).endsWith('/csrf')) return json({ csrf_token: 'test-only-csrf' })
      return confirmed ? new Response(null, { status: 204 }) : json({}, status)
    })
    vi.stubGlobal('fetch', fetcher)
    mount()
    await screen.findByText(owned.email)
    fireEvent.click(screen.getByText('Logout'))
    await screen.findByText('logout-error')
    await act(async () => show())
    expect(screen.getByRole('status').textContent).toBe('logout-error')
    expect(screen.queryByText(owned.email)).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(3)
    confirmed = true
    fireEvent.click(screen.getByText('Logout'))
    await screen.findByText('guest')
    expect(fetcher).toHaveBeenCalledTimes(5)
  },
)

it.each(['logout', 'auth'] as const)(
  'AR-02 restore does not cancel pending%s or show old owner',
  async (kind) => {
    let finish: ((value: Response) => void) | undefined
    let operation: AbortSignal | null | undefined
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith('/me')) return json(owned)
      if (String(url).endsWith('/csrf')) return json({ csrf_token: 'test-only-csrf' })
      operation = init?.signal
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    })
    vi.stubGlobal('fetch', fetcher)
    mount()
    await screen.findByText(owned.email)
    fireEvent.click(screen.getByText(kind === 'logout' ? 'Logout' : 'Login'))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
    await act(async () => show())
    expect(screen.getByRole('status').textContent).toBe(
      kind === 'logout' ? 'logging-out' : 'checking',
    )
    expect(screen.queryByText(owned.email)).toBeNull()
    expect(operation?.aborted).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(3)
    await act(async () =>
      finish?.(kind === 'logout' ? new Response(null, { status: 204 }) : json(fresh)),
    )
    await screen.findByText(kind === 'logout' ? 'guest' : fresh.email)
    expect(screen.queryByText(owned.email)).toBeNull()
  },
)

it('AR-03 cached normal refresh cancels old work and only a fresh401 becomes guest', async () => {
  let finish: ((value: Response) => void) | undefined
  let old: AbortSignal | null | undefined
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(json(owned))
    .mockImplementationOnce(async (_, init) => {
      old = init?.signal
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    })
    .mockResolvedValueOnce(json({}, 401))
  vi.stubGlobal('fetch', fetcher)
  mount()
  await screen.findByText(owned.email)
  fireEvent.click(screen.getByText('Refresh'))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  await act(async () => show())
  await screen.findByText('guest')
  expect(old?.aborted).toBe(true)
  await act(async () => finish?.(json(owned)))
  expect(screen.getByRole('status').textContent).toBe('guest')
  expect(screen.queryByText(owned.email)).toBeNull()
})

it('AR-04 ordinary pageshow does not restart a ready account', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(owned))
  vi.stubGlobal('fetch', fetcher)
  mount()
  await screen.findByText(owned.email)
  await act(async () => show(false))
  expect(screen.getByText(owned.email).textContent).toBe(owned.email)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
