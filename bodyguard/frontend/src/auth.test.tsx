// @vitest-environment happy-dom
// B-03 state races are synthetic; the browser harness separately tests real API auth.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ApiError, authenticate, me, signup } from './api/auth'
import { AuthProvider, useAuth } from './auth'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const account = { id: 'own-user', email: 'own@example.com' }
function Screen() {
  const { state, refresh, signOut, signIn } = useAuth()
  return (
    <>
      <output>{state.status === 'ready' ? state.user.email : state.status}</output>
      <button
        type="button"
        onClick={() => {
          void refresh()
        }}
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => {
          void signOut()
        }}
      >
        Logout
      </button>
      <button
        type="button"
        onClick={() => {
          void signIn(
            'login',
            { email: account.email, password: 'test-only-password-long' },
            new AbortController().signal,
          )
        }}
      >
        Login
      </button>
    </>
  )
}

it('B-03 aborted late /me cannot revive a logged-out account', async () => {
  let finish: ((value: Response) => void) | undefined
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(account))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValueOnce(response({ csrf_token: 'csrf-test-value' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetcher)
  render(
    <AuthProvider>
      <Screen />
    </AuthProvider>,
  )
  await screen.findByText(account.email)
  fireEvent.click(screen.getByText('Refresh'))
  await screen.findByText('checking')
  fireEvent.click(screen.getByText('Logout'))
  await screen.findByText('guest')
  await act(async () => {
    finish?.(response(account))
  })
  expect(screen.getByRole('status').textContent).toBe('guest')
})

it('B-03 failed logout blocks private UI even if window focus rechecks', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(account))
    .mockRejectedValue(new TypeError('offline'))
  vi.stubGlobal('fetch', fetcher)
  render(
    <AuthProvider>
      <Screen />
    </AuthProvider>,
  )
  await screen.findByText(account.email)
  fireEvent.click(screen.getByText('Logout'))
  await screen.findByText('logout-error')
  fireEvent.focus(window)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(screen.queryByText(account.email)).toBeNull()
})

it('B-02 malformed user and 503 are errors, only 401 is guest', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(null))
    .mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({}, 401))
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  await expect(me(signal)).rejects.toBeInstanceOf(ApiError)
  await expect(me(signal)).rejects.toMatchObject({ status: 503 })
  await expect(me(signal)).resolves.toBeNull()
})

it('B-01 actual client sends credentials only in POST body with CSRF and same-origin cookies', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ csrf_token: 'csrf-test-value' }))
    .mockResolvedValueOnce(response({ ...account, csrf_token: 'rotated' }))
  vi.stubGlobal('fetch', fetcher)
  const body = { email: account.email, password: 'test-only-password-long' }
  await authenticate('login', body, new AbortController().signal)
  expect(fetcher.mock.calls[1]).toEqual([
    '/api/v1/auth/login',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-test-value' },
    }),
  ])
})

it('B-02 invalid CSRF response prevents any credential submission', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({ csrf_token: null }))
  vi.stubGlobal('fetch', fetcher)
  await expect(
    signup(
      { email: account.email, password: 'test-only-password-long' },
      new AbortController().signal,
    ),
  ).rejects.toBeInstanceOf(ApiError)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('B-02 rate limit preserves Retry-After without exposing server input', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response('private input', { status: 429, headers: { 'Retry-After': '60' } }),
      ),
  )
  await expect(
    signup(
      { email: account.email, password: 'test-only-password-long' },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ status: 429, retryAfter: 60 })
})
