// @vitest-environment happy-dom
// FR-U-04/05/NFR-08: controlled DOM/network races, separate from actual SQL/Chrome harness.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const account = { id: 'synthetic-owner', email: 'own@example.com' }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const challenge = 'a'.repeat(43)
const consent = () => screen.getByRole('button', { name: '계정과 기록 삭제' })
function stub(
  action: (url: string, init?: RequestInit) => Promise<Response>,
  me: () => Promise<Response> = async () => json(account),
) {
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/v1/me') return me()
    if (url === '/api/v1/auth/csrf') return Promise.resolve(json({ csrf_token: 'fixture' }))
    if (url === '/api/v1/auth/google/status') return Promise.resolve(json({ configured: false }))
    return action(url, init)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function open(path = '/account/delete') {
  window.history.replaceState(null, '', path)
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
async function begin() {
  // StrictMode mount settles before clicks; do not race initial passive effect setup.
  await screen.findByText(account.email)
  fireEvent.click(screen.getByRole('button', { name: '탈퇴 인증 코드 받기' }))
  await screen.findByLabelText('탈퇴 인증 코드')
}
function fill() {
  fireEvent.change(screen.getByLabelText('탈퇴 인증 코드'), { target: { value: '123456' } })
  fireEvent.change(screen.getByLabelText('확인문'), { target: { value: '탈퇴' } })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})
it.each([401, 503])('AW-03 private withdrawal is closed when /me returns%s', async (status) => {
  const action = vi.fn(async () => json({}))
  stub(action, async () => json({}, status))
  open()
  await screen.findByRole('heading', {
    name: status === 401 ? '다시 만나 반갑습니다' : '계정 연결을 확인해 주세요',
  })
  expect(action).not.toHaveBeenCalled()
})
it('AW-04 explicit cancel sends no confirm request and clears memory proof', async () => {
  const action = vi.fn(async () => json({ challenge_id: challenge }, 202))
  stub(action)
  open()
  await begin()
  fill()
  fireEvent.click(screen.getByRole('link', { name: '탈퇴 취소하고 돌아가기' }))
  await screen.findByRole('heading', { name: '내 계정' })
  expect(action).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('link', { name: '회원 탈퇴 안내' }))
  await screen.findByRole('button', { name: '탈퇴 인증 코드 받기' })
  expect(screen.queryByLabelText('탈퇴 인증 코드')).toBeNull()
})
it('AW-05 consent requires six ASCII digits and exact deliberate confirmation, not code alone', async () => {
  const action = vi.fn(async () => json({ challenge_id: challenge }, 202))
  stub(action)
  open()
  await begin()
  fireEvent.change(screen.getByLabelText('탈퇴 인증 코드'), { target: { value: '123456' } })
  expect((consent() as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('확인문'), { target: { value: '탈퇴 ' } })
  expect((consent() as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('확인문'), { target: { value: '탈퇴' } })
  fireEvent.change(screen.getByLabelText('탈퇴 인증 코드'), { target: { value: '１２３４５６' } })
  expect((consent() as HTMLButtonElement).disabled).toBe(true)
  fill()
  expect((consent() as HTMLButtonElement).disabled).toBe(false)
  expect(action).toHaveBeenCalledTimes(1)
})
it('AW-06 final pending stays mounted, closes private navigation and submits only once', async () => {
  let resolve: ((value: Response) => void) | undefined
  const action = vi.fn(async (url: string) =>
    url.endsWith('/start')
      ? json({ challenge_id: challenge }, 202)
      : new Promise<Response>((done) => {
          resolve = done
        }),
  )
  stub(action)
  open()
  await begin()
  fill()
  const button = consent()
  fireEvent.click(button)
  fireEvent.click(button)
  fireEvent.submit(button.closest('form') as HTMLFormElement)
  await screen.findByRole('button', { name: '삭제 결과 확인 중…' })
  expect(screen.queryByRole('link', { name: '내 계정' })).toBeNull()
  expect(action).toHaveBeenCalledTimes(2)
  await act(async () => {
    resolve?.(new Response(null, { status: 204 }))
  })
  await screen.findByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })
  expect(document.title).toBe('탈퇴 완료 · BODYGUARD')
  expect(screen.queryByText(account.email)).toBeNull()
})
it.each([400, 422, 429])(
  'AW-07 rejected%s is retryable only after real-shaped fresh /me',
  async (status) => {
    let meCalls = 0
    const action = vi.fn(async (url: string) =>
      url.endsWith('/start')
        ? json({ challenge_id: challenge }, 202)
        : new Response(null, { status, headers: { 'Retry-After': '23' } }),
    )
    stub(action, async () => {
      meCalls++
      return json(account)
    })
    open()
    await begin()
    fill()
    fireEvent.click(consent())
    await screen.findByRole('alert')
    expect(meCalls).toBe(3)
    expect((screen.getByLabelText('탈퇴 인증 코드') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('확인문') as HTMLInputElement).value).toBe('')
    expect((consent() as HTMLButtonElement).disabled).toBe(true)
    if (status === 429) expect(screen.getByText(/다시 요청까지 23초/)).toBeTruthy()
  },
)
it('AW-08 rejected code cannot revive cached private account when fresh /me fails', async () => {
  let calls = 0
  stub(
    async (url) =>
      url.endsWith('/start') ? json({ challenge_id: challenge }, 202) : json({}, 400),
    async () => (++calls <= 2 ? json(account) : json({}, 503)),
  )
  open()
  await begin()
  fill()
  fireEvent.click(consent())
  await screen.findByRole('heading', { name: '계정 상태를 다시 확인해 주세요' })
  expect(screen.queryByText(account.email)).toBeNull()
  expect(screen.queryByRole('link', { name: '내 계정' })).toBeNull()
})
it('AW-09 newly checked different account never inherits old confirmation or code', async () => {
  let calls = 0
  stub(
    async (url) =>
      url.endsWith('/start') ? json({ challenge_id: challenge }, 202) : json({}, 400),
    async () => json(++calls <= 2 ? account : { id: 'other-owner', email: 'other@example.com' }),
  )
  open()
  await begin()
  fill()
  fireEvent.click(consent())
  await screen.findByRole('heading', { name: '계정 상태를 다시 확인해 주세요' })
  expect(screen.queryByLabelText('탈퇴 인증 코드')).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: '계정 관리로 돌아가기' }))
  await screen.findByText('other@example.com')
})
it.each([200, 401, 403, 503])(
  'AW-10 uncertain%s does not claim deletion or automatically retry',
  async (status) => {
    const action = vi.fn(async (url: string) =>
      url.endsWith('/start') ? json({ challenge_id: challenge }, 202) : json({}, status),
    )
    stub(action)
    open()
    await begin()
    fill()
    fireEvent.click(consent())
    await screen.findByRole('heading', { name: '계정 상태를 다시 확인해 주세요' })
    expect(screen.queryByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '계정 상태 확인' }))
    await screen.findByRole('link', { name: '계정 관리로 돌아가기' })
    expect(action).toHaveBeenCalledTimes(2)
  },
)
it('AW-11 guest after uncertain result means login check, not completed withdrawal', async () => {
  let calls = 0
  stub(
    async (url) =>
      url.endsWith('/start') ? json({ challenge_id: challenge }, 202) : json({}, 503),
    async () => (++calls <= 2 ? json(account) : json({}, 401)),
  )
  open()
  await begin()
  fill()
  fireEvent.click(consent())
  fireEvent.click(await screen.findByRole('button', { name: '계정 상태 확인' }))
  await screen.findByRole('link', { name: '로그인하여 계정 확인' })
  expect(screen.queryByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeNull()
})
it.each([429, 503])('AW-12 send failure%s is not a delivered code or deletion', async (status) => {
  const action = vi.fn(async () => new Response(null, { status, headers: { 'Retry-After': '30' } }))
  stub(action)
  open()
  await screen.findByText(account.email)
  fireEvent.click(screen.getByRole('button', { name: '탈퇴 인증 코드 받기' }))
  await screen.findByRole('alert')
  expect(screen.queryByLabelText('탈퇴 인증 코드')).toBeNull()
  expect(action).toHaveBeenCalledTimes(1)
})
it('AW-13 explicit reissue replaces old proof and clears code/consent', async () => {
  let calls = 0
  const action = vi.fn(async () =>
    json({ challenge_id: (++calls === 1 ? 'a' : 'b').repeat(43) }, 202),
  )
  stub(action)
  open()
  await begin()
  fill()
  fireEvent.click(screen.getByRole('button', { name: '인증 코드 다시 받기' }))
  await waitFor(() =>
    expect((screen.getByLabelText('탈퇴 인증 코드') as HTMLInputElement).value).toBe(''),
  )
  expect((screen.getByLabelText('확인문') as HTMLInputElement).value).toBe('')
  expect(action).toHaveBeenCalledTimes(2)
})
it('AW-14 abandoned start late response is aborted and never becomes reused consent', async () => {
  let resolve: ((value: Response) => void) | undefined
  let signal: AbortSignal | null | undefined
  stub(async (_url, init) => {
    signal = init?.signal
    return new Promise<Response>((done) => {
      resolve = done
    })
  })
  open()
  await screen.findByText(account.email)
  fireEvent.click(screen.getByRole('button', { name: '탈퇴 인증 코드 받기' }))
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('link', { name: '탈퇴 취소하고 돌아가기' }))
  await screen.findByRole('heading', { name: '내 계정' })
  expect(signal?.aborted).toBe(true)
  await act(async () => {
    resolve?.(json({ challenge_id: challenge }, 202))
  })
  fireEvent.click(screen.getByRole('link', { name: '회원 탈퇴 안내' }))
  await screen.findByRole('button', { name: '탈퇴 인증 코드 받기' })
  expect(screen.queryByLabelText('탈퇴 인증 코드')).toBeNull()
})
it('AW-15 leaving during confirmation cannot restore private account from late204', async () => {
  let resolve: ((value: Response) => void) | undefined
  let signal: AbortSignal | null | undefined
  stub(async (url, init) => {
    if (url.endsWith('/start')) return json({ challenge_id: challenge }, 202)
    signal = init?.signal
    return new Promise<Response>((done) => {
      resolve = done
    })
  })
  open()
  await begin()
  fill()
  fireEvent.click(consent())
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('link', { name: 'BODYGUARD 서비스 소개' }))
  await screen.findByRole('heading', { name: /내 몸을 이해하는/ })
  expect(signal?.aborted).toBe(true)
  await act(async () => {
    resolve?.(new Response(null, { status: 204 }))
  })
  // FR-U-04: the provider is still mounted; late204 must not revive a private route.
  await act(async () => {
    window.history.pushState(null, '', '/account')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await screen.findByRole('heading', { name: '연결을 확인해 주세요' })
  expect(screen.queryByText(account.email)).toBeNull()
  expect(screen.queryByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeNull()
})
