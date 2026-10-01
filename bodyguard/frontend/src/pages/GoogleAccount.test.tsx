// @vitest-environment happy-dom
// FR-U-01/04: UI stubs only; real API/SQL/SDK is checked in the Chrome harness.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth'
import { AccountPage } from './AccountPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const json = (value: unknown) => new Response(JSON.stringify(value))
function show(query = '', mode: 'login' | 'signup' = 'login') {
  render(
    <MemoryRouter initialEntries={[`/${mode}${query}`]}>
      <AuthProvider>
        <AccountPage mode={mode} />
      </AuthProvider>
    </MemoryRouter>,
  )
}
function fetcher(status: unknown) {
  return vi.fn((path: string) =>
    Promise.resolve(path.endsWith('/me') ? new Response('{}', { status: 401 }) : json(status)),
  )
}
it.each(['login', 'signup'] as const)(
  'GW-01 %s unconfigured Google keeps email usable',
  async (mode) => {
    vi.stubGlobal('fetch', fetcher({ configured: false }))
    show('', mode)
    await waitFor(() => expect(screen.getByText(/이메일로 계속해 주세요/)).toBeTruthy())
    expect(
      (screen.getByRole('button', { name: 'Google로 계속하기' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((screen.getByLabelText('이메일') as HTMLInputElement).disabled).toBe(false)
  },
)
it('GW-02 configured Google navigates only to the fixed same-origin endpoint once', async () => {
  vi.stubGlobal('fetch', fetcher({ configured: true }))
  const navigate = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
  show('?next=https%3A%2F%2Fattacker.invalid')
  const button = screen.getByRole('button', { name: 'Google로 계속하기' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  fireEvent.click(button)
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/api/v1/auth/google/login')
  expect((screen.getByRole('button', { name: '처리 중…' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  const back = new Event('pageshow')
  Object.defineProperty(back, 'persisted', { value: true })
  fireEvent(window, back)
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Google로 계속하기' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  )
})
it.each([
  ['cancelled', '취소'],
  ['failed', '다시 시도'],
  ['account-conflict', '기존 방식'],
  ['unavailable', '이메일'],
  ['rate-limited', '잠시 후'],
  ['RAW-CODE-SECRET&google=RAW-TOKEN-SECRET', '다시 시도'],
  ['toString', '다시 시도'],
  ['constructor', '다시 시도'],
  ['__proto__', '다시 시도'],
])('GW-03/04 fixed failure %s never renders query secrets', async (query, message) => {
  vi.stubGlobal('fetch', fetcher({ configured: true }))
  show(`?google=${query}`)
  expect(screen.getByRole('alert').textContent).toContain(message)
  expect(screen.getByRole('alert').textContent).not.toMatch(/RAW-CODE|RAW-TOKEN/)
})
it('GW-01 malformed status fails closed and retries the native boolean contract', async () => {
  const api = fetcher({ configured: 'true' })
  vi.stubGlobal('fetch', api)
  show()
  await screen.findByRole('button', { name: '구글 연결 다시 확인' })
  expect(
    (screen.getByRole('button', { name: 'Google로 계속하기' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  api.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/me') ? new Response('{}', { status: 401 }) : json({ configured: true }),
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: '구글 연결 다시 확인' }))
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Google로 계속하기' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  )
})
it('GW-01 status reply after unmount cannot update the old form', async () => {
  let finish: (value: Response) => void = () => {}
  let signal: AbortSignal | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string, options: RequestInit) => {
      if (path.endsWith('/me')) return Promise.resolve(new Response('{}', { status: 401 }))
      signal = options.signal as AbortSignal
      return new Promise<Response>((resolve) => {
        finish = resolve
      })
    }),
  )
  show()
  await waitFor(() => expect(signal).toBeTruthy())
  cleanup()
  expect(signal?.aborted).toBe(true)
  await act(async () => finish(json({ configured: true })))
  expect(screen.queryByRole('button', { name: 'Google로 계속하기' })).toBeNull()
})
