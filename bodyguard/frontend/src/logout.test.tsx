// @vitest-environment happy-dom
// FR-U-04/NFR-08: synthetic wire/state tests, not evidence of actual DB revocation.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { logout } from './api/auth'
import { AuthProvider, useAuth } from './auth'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const account = { id: 'test-owned-account', email: 'synthetic@example.invalid' }
function stub(result: Response) {
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    String(url).endsWith('/csrf') ? json({ csrf_token: 'test-only-csrf' }) : result,
  )
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

it.each([200, 201, 202, 203, 205, 206])(
  'LA-01 other successful%s is not logout204',
  async (status) => {
    stub(json({ logged_out: true }, status))
    await expect(logout(new AbortController().signal)).rejects.toMatchObject({ status: 503 })
  },
)
it.each([400, 401, 403, 429, 500, 503])('LA-02 error%s remains an error', async (status) => {
  stub(new Response(null, { status, headers: { 'Retry-After': '25' } }))
  await expect(logout(new AbortController().signal)).rejects.toMatchObject({
    status,
    retryAfter: 25,
  })
})
it('LA-03 confirms204 without JSON and keeps POST/CSRF/cookie/cancel contract', async () => {
  const response = new Response(null, { status: 204 })
  const parse = vi.spyOn(response, 'json').mockRejectedValue(new Error('Must not parse204'))
  const fetcher = stub(response)
  const controller = new AbortController()
  await expect(logout(controller.signal)).resolves.toBeUndefined()
  expect(parse).not.toHaveBeenCalled()
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    '/api/v1/auth/csrf',
    '/api/v1/auth/logout',
  ])
  const init = fetcher.mock.calls[1]?.[1]
  expect(init).toMatchObject({
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-only-csrf' },
  })
  expect(init?.body).toBeUndefined()
  controller.abort()
  expect(init?.signal?.aborted).toBe(true)
})
it('LA-04 malformed CSRF never sends logout', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ csrf_token: null }))
  vi.stubGlobal('fetch', fetcher)
  await expect(logout(new AbortController().signal)).rejects.toMatchObject({ status: 503 })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

function AccountState() {
  const { state, signOut } = useAuth()
  return (
    <>
      <output>{state.status}</output>
      {state.status === 'ready' && <p>{state.user.email}</p>}
      <button type="button" onClick={() => void signOut()}>
        Logout
      </button>
    </>
  )
}

it.each([200, 202])(
  'LA-05 wrong%s stays blocked on focus/channel; explicit204 retry',
  async (status) => {
    let confirmed = false
    const messages: unknown[] = []
    let receiver: (() => void) | undefined
    class Channel {
      onmessage: (() => void) | null = null
      constructor() {
        receiver = () => this.onmessage?.()
      }
      postMessage(value: unknown) {
        messages.push(value)
      }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', Channel)
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/me')) return json(account)
      if (String(url).endsWith('/csrf')) return json({ csrf_token: 'test-only-csrf' })
      return confirmed ? new Response(null, { status: 204 }) : json({ logged_out: true }, status)
    })
    vi.stubGlobal('fetch', fetcher)
    render(
      <AuthProvider>
        <AccountState />
      </AuthProvider>,
    )
    await screen.findByText(account.email)
    fireEvent.click(screen.getByText('Logout'))
    await screen.findByText('logout-error')
    expect(screen.queryByText(account.email)).toBeNull()
    expect(messages).toEqual([])
    await act(async () => {
      fireEvent.focus(window)
      receiver?.()
    })
    expect(screen.getByRole('status').textContent).toBe('logout-error')
    expect(fetcher).toHaveBeenCalledTimes(3)
    confirmed = true
    fireEvent.click(screen.getByText('Logout'))
    await screen.findByText('guest')
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5))
    expect(messages).toEqual(['changed'])
  },
)
