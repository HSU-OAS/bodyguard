// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const owner = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const empty = {
  nickname: null,
  age: null,
  height_cm: null,
  weight_kg: null,
  gender: null,
  revision: 0,
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function network(profile: (init?: RequestInit) => Promise<Response>, user = () => json(owner)) {
  const calls = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/v1/me') return user()
    if (url === '/api/v1/auth/csrf') return json({ csrf_token: 'a'.repeat(64) })
    if (url === '/api/v1/auth/google/status') return json({ configured: false })
    if (url === '/api/v1/profile') return profile(init)
    throw new Error('Unexpected fixture request')
  })
  vi.stubGlobal('fetch', calls)
  return calls
}
function open(path = '/account/profile') {
  history.replaceState(null, '', path)
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})
it('loads only the owned profile and saves explicit optional fields', async () => {
  const calls = network(async (init) =>
    init?.method === 'POST' ? json({ ...JSON.parse(String(init.body)), revision: 1 }) : json(empty),
  )
  open()
  await screen.findByRole('button', { name: '저장하기' })
  fireEvent.change(screen.getByLabelText('닉네임'), { target: { value: '가상 사용자' } })
  fireEvent.change(screen.getByLabelText('나이 세'), { target: { value: '28' } })
  fireEvent.click(screen.getByLabelText('여성'))
  fireEvent.click(screen.getByRole('button', { name: '저장하기' }))
  await screen.findByText('기본 정보를 저장했습니다.')
  const post = calls.mock.calls.filter(
    ([url, init]) => url === '/api/v1/profile' && init?.method === 'POST',
  )
  expect(post).toHaveLength(1)
  expect(JSON.parse(String(post[0][1]?.body))).toEqual({
    ...empty,
    nickname: '가상 사용자',
    age: 28,
    gender: 'female',
  })
  expect(new Headers(post[0][1]?.headers).get('X-Account-ID')).toBe(owner.id)
  expect([localStorage.length, sessionStorage.length]).toEqual([0, 0])
})
it('clear requires confirmation and saves null fields using current revision', async () => {
  const calls = network(async (init) =>
    init?.method === 'POST'
      ? json({ ...JSON.parse(String(init.body)), revision: 4 })
      : json({ ...empty, nickname: '가상', age: 40, revision: 3 }),
  )
  open()
  await screen.findByDisplayValue('가상')
  fireEvent.click(screen.getByRole('button', { name: '입력한 정보 모두 삭제' }))
  expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))
  await screen.findByText('기본 정보를 저장했습니다.')
  const post = calls.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({ ...empty, revision: 3 })
})
it.each([409, 503])('save failure %s stops editing and requires a fresh read', async (status) => {
  const calls = network(async (init) =>
    init?.method === 'POST' ? json({ detail: 'private fixture' }, status) : json(empty),
  )
  open()
  await screen.findByRole('button', { name: '저장하기' })
  fireEvent.click(screen.getByRole('button', { name: '저장하기' }))
  await screen.findByRole('alert')
  expect(document.body.textContent).not.toContain('private fixture')
  expect(
    (screen.getByLabelText('닉네임').closest('fieldset') as HTMLFieldSetElement).disabled,
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('닉네임').closest('fieldset') as HTMLFieldSetElement).disabled,
    ).toBe(false),
  )
  expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})
it('switching away from the authenticated account aborts an outstanding read', async () => {
  let expired = false
  const pending: Array<{ signal: AbortSignal; done: (r: Response) => void }> = []
  network(
    (init) => new Promise((done) => pending.push({ signal: init?.signal as AbortSignal, done })),
    () => (expired ? json({}, 401) : json(owner)),
  )
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  open()
  await waitFor(() => expect(pending.some((p) => !p.signal.aborted)).toBe(true))
  expired = true
  fireEvent(window, new Event('focus'))
  await screen.findByRole('heading', { name: '로그인' })
  expect(pending.every((p) => p.signal.aborted)).toBe(true)
  await act(async () => {
    for (const p of pending) p.done(json({ ...empty, nickname: 'private fixture' }))
  })
  expect(document.body.textContent).not.toContain('private fixture')
})
it('guest does not issue profile requests', async () => {
  const profile = vi.fn(async () => json(empty))
  network(profile, () => json({}, 401))
  open()
  await screen.findByRole('heading', { name: '로그인' })
  expect(profile).not.toHaveBeenCalled()
})
it('email signup opens the optional profile and skipping keeps the original destination', async () => {
  let signedIn = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/v1/me') return signedIn ? json(owner) : json({}, 401)
      if (url === '/api/v1/auth/csrf') return json({ csrf_token: 'a'.repeat(64) })
      if (url === '/api/v1/auth/google/status') return json({ configured: false })
      if (url === '/api/v1/auth/signup') return json({ challenge_id: 'fixture-challenge' })
      if (url === '/api/v1/auth/verify') {
        signedIn = true
        return json(owner)
      }
      if (url === '/api/v1/profile') return json(empty)
      if (url.startsWith('/api/v1/records')) return json({ items: [], has_more: false })
      throw new Error('Unexpected fixture request')
    }),
  )
  open('/signup?next=%2Fstart')
  fireEvent.change(await screen.findByLabelText('이메일'), { target: { value: owner.email } })
  fireEvent.change(screen.getByLabelText('비밀번호'), {
    target: { value: 'test-only-password-long' },
  })
  fireEvent.click(screen.getByRole('button', { name: '인증 코드 받기' }))
  fireEvent.change(await screen.findByLabelText('인증 코드'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: '인증하고 시작하기' }))
  await screen.findByRole('heading', { name: '기본 정보' })
  expect((await screen.findByRole('link', { name: '나중에 하기' })).getAttribute('href')).toBe(
    '/start',
  )
  fireEvent.click(screen.getByRole('link', { name: '나중에 하기' }))
  await screen.findByRole('heading', { name: '내 몸을 위한 시작' })
})
