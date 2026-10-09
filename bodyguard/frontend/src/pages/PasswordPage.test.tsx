// @vitest-environment happy-dom
// PW-01/03: synthetic protocol/timing faults; real HTTP/SQL is checked in password.spec.ts.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const token = 'a'.repeat(43)
const password = '단위 시험 전용 비밀번호 12345'
const response = (status: number) =>
  status === 204 ? new Response(null, { status }) : new Response('{}', { status })
function stub(post: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/v1/me') return Promise.resolve(response(401))
    if (url === '/api/v1/auth/csrf')
      return Promise.resolve(new Response(JSON.stringify({ csrf_token: 'test-only-csrf' })))
    return post(url, init)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function open(path: string) {
  window.history.replaceState(null, '', path)
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
function fill() {
  fireEvent.change(screen.getByLabelText('새 비밀번호', { exact: true }), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인', { exact: true }), {
    target: { value: password },
  })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

// S4.D4 / FR-U-03/NFR-08: essential recovery guidance cannot live only in hidden aside.
it.each([
  ['/password/forgot', '비밀번호 재설정 요청'],
  [`/password/reset#token=${token}`, '새 비밀번호 설정'],
  ['/password/reset', '새 링크가 필요합니다'],
])('MC-02 keeps security guidance in the form at %s', async (path, title) => {
  stub(async () => response(202))
  open(path)
  await screen.findByRole('heading', { name: title })
  const form = document.querySelector('.account-form')
  expect(form?.textContent).toContain('변경하면 기존 로그인은 모두 종료됩니다.')
  expect(form?.textContent).toContain('카메라는 켜지지 않습니다.')
  const descriptions = [
    ...document.querySelectorAll('.account-layout p:not(.eyebrow):not(.form-secondary)'),
  ]
    .map((element) => element.textContent)
    .join('')
    .replace(/\s/g, '')
  expect(descriptions.length).toBeLessThanOrEqual(120)
  if (path.includes('forgot')) {
    expect(screen.getByText(/가입 여부는 공개하지 않습니다/)).toBeTruthy()
    expect(screen.getByLabelText('이메일')).toBeTruthy()
  } else if (path.includes('#')) {
    expect(screen.getByText(/15~128자 · 한글·공백 가능/)).toBeTruthy()
    expect(screen.getByText(/링크는 30분 내 1회만 사용/)).toBeTruthy()
    expect(screen.getByLabelText('새 비밀번호', { exact: true })).toBeTruthy()
    expect(screen.getByLabelText('새 비밀번호 확인', { exact: true })).toBeTruthy()
  }
})

it('PW-02 StrictMode clears the URL without losing the in-memory POST token', async () => {
  const fetcher = stub(async () => response(204))
  open(`/password/reset#token=${token}`)
  await screen.findByRole('heading', { name: '새 비밀번호 설정' })
  expect(window.location.hash).toBe('')
  expect(window.location.search).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '본문으로 이동' }))
  expect(document.activeElement).toBe(screen.getByRole('main'))
  expect(window.location.hash).toBe('')
  fill()
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  const heading = await screen.findByRole('heading', { name: '비밀번호를 변경했습니다' })
  await waitFor(() => expect(document.activeElement).toBe(heading))
  expect(fetcher.mock.calls.find(([url]) => url.endsWith('/password/reset'))).toEqual([
    '/api/v1/auth/password/reset',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token, password }),
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-only-csrf' },
    }),
  ])
  expect(screen.queryByLabelText('새 비밀번호')).toBeNull()
  expect(fetcher.mock.calls.some(([url]) => url.includes(token))).toBe(false)
  expect([localStorage.length, sessionStorage.length]).toEqual([0, 0])
  expect(document.body.textContent).not.toContain(token)
  expect(screen.getByRole('link', { name: '로그인으로 돌아가기' })).toBeTruthy()
})

it.each([
  '/password/reset',
  `/password/reset?token=${token}`,
  '/password/reset#token=short',
  `/password/reset#token=${token}&token=${token}`,
  `/password/reset#token=${token}&other=1`,
  `/password/reset?other=1#token=${token}`,
])('PW-03 rejects malformed/query/ambiguous links without POST: %s', async (path) => {
  const post = vi.fn(async () => response(204))
  stub(post)
  open(path)
  const heading = await screen.findByRole('heading', { name: '새 링크가 필요합니다' })
  await waitFor(() => expect(window.location.hash + window.location.search).toBe(''))
  expect(document.activeElement).toBe(heading)
  expect(post).not.toHaveBeenCalled()
  expect(screen.getAllByRole('link', { name: '재설정 다시 요청' })).toHaveLength(1)
})

it('PW-03 mismatched confirmation focuses the field and never sends a password', async () => {
  const post = vi.fn(async () => response(204))
  stub(post)
  open(`/password/reset#token=${token}`)
  fill()
  fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), {
    target: { value: `${password}wrong` },
  })
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  expect(screen.getByRole('alert').textContent).toContain('일치하지')
  expect(document.activeElement).toBe(screen.getByLabelText('새 비밀번호 확인'))
  expect(post).not.toHaveBeenCalled()
})

it.each(['가'.repeat(14), '😀'.repeat(14), 'a'.repeat(129)])(
  'PW-02 invalid password length is rejected before POST: %#',
  async (value) => {
    const post = vi.fn(async () => response(204))
    stub(post)
    open(`/password/reset#token=${token}`)
    fill()
    fireEvent.change(screen.getByLabelText('새 비밀번호', { exact: true }), {
      target: { value },
    })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
    expect(screen.getByRole('alert').textContent).toContain('15~128자')
    expect(document.activeElement).toBe(screen.getByLabelText('새 비밀번호', { exact: true }))
    expect(post).not.toHaveBeenCalled()
  },
)

it('PW-01 request errors do not pretend delivery; 202 is only acceptance', async () => {
  const post = vi
    .fn()
    .mockImplementationOnce(async () => response(503))
    .mockImplementationOnce(async () => response(202))
  stub(post)
  open('/password/forgot')
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: '재설정 요청' }))
  expect((await screen.findByRole('alert')).textContent).toContain('완료할 수 없습니다')
  expect(screen.queryByText(/요청을 접수했습니다/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '재설정 요청' }))
  expect((await screen.findByText(/요청을 접수했습니다/)).textContent).toContain(
    '등록된 이메일이면',
  )
  expect(post).toHaveBeenCalledTimes(2)
})

it('PW-01 quota preserves a disabled wait instead of another submission', async () => {
  const post = vi.fn(
    async () =>
      new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '60' },
      }),
  )
  stub(post)
  open('/password/forgot')
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: '재설정 요청' }))
  await screen.findByRole('alert')
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: '재설정 요청' }) as HTMLButtonElement).disabled,
    ).toBe(true),
  )
  expect(screen.getByText(/다시 요청까지/)).toBeTruthy()
  expect(post).toHaveBeenCalledTimes(1)
})

it('PW-03 held response blocks duplicates and is discarded after leaving', async () => {
  let finish: ((value: Response) => void) | undefined
  const post = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve
      }),
  )
  stub(post)
  open('/password/forgot')
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'test@example.com' } })
  const submit = screen.getByRole('button', { name: '재설정 요청' })
  fireEvent.click(submit)
  fireEvent.click(submit)
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  expect((screen.getByRole('button', { name: '처리 중…' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  fireEvent.click(screen.getByRole('link', { name: '서비스 소개로 돌아가기' }))
  await act(async () => finish?.(response(202)))
  expect(screen.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeTruthy()
  expect(screen.queryByText(/요청을 접수했습니다/)).toBeNull()
})

it('PW-03 a wrong 200 acknowledgement cannot complete reset or reveal private UI', async () => {
  stub(async () => response(200))
  open(`/password/reset#token=${token}`)
  fill()
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('heading', { name: '비밀번호를 변경했습니다' })).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'BODYGUARD 서비스 소개' }))
  fireEvent.click(screen.getByRole('link', { name: '시작하기' }))
  expect(await screen.findByRole('heading', { name: '연결을 확인해 주세요' })).toBeTruthy()
})

it('PW-03 a consumed 400 link clears password fields and offers a fresh request', async () => {
  stub(async () => response(400))
  open(`/password/reset#token=${token}`)
  fill()
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  await screen.findByRole('heading', { name: '새 링크가 필요합니다' })
  expect(screen.queryByLabelText('새 비밀번호')).toBeNull()
  expect(screen.getAllByRole('link', { name: '재설정 다시 요청' })).toHaveLength(1)
})

it('PW-03 a new same-page fragment replaces the consumed token without a reload', async () => {
  const post = vi
    .fn()
    .mockImplementationOnce(async () => response(400))
    .mockImplementationOnce(async () => response(204))
  stub(post)
  open(`/password/reset#token=${token}`)
  fill()
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  await screen.findByRole('heading', { name: '새 링크가 필요합니다' })
  const fresh = 'b'.repeat(43)
  await act(async () => {
    window.history.pushState(null, '', `/password/reset#token=${fresh}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await screen.findByRole('heading', { name: '새 비밀번호 설정' })
  expect(window.location.hash).toBe('')
  fill()
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  await screen.findByRole('heading', { name: '비밀번호를 변경했습니다' })
  expect(post.mock.calls[1][1].body).toBe(JSON.stringify({ token: fresh, password }))
})

it('PW-03 a replacement link cancels a held reset and ignores its late completion', async () => {
  let finish: ((value: Response) => void) | undefined
  const post = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    .mockImplementationOnce(async () => response(204))
  stub(post)
  open(`/password/reset#token=${token}`)
  fill()
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  const fresh = 'c'.repeat(43)
  await act(async () => {
    window.history.pushState(null, '', `/password/reset#token=${fresh}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect((screen.getByLabelText('새 비밀번호') as HTMLInputElement).value).toBe('')
  fill()
  fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))
  await screen.findByRole('heading', { name: '비밀번호를 변경했습니다' })
  await act(async () => finish?.(response(204)))
  expect(screen.getByRole('heading', { name: '비밀번호를 변경했습니다' })).toBeTruthy()
  expect(post.mock.calls[1][1].body).toBe(JSON.stringify({ token: fresh, password }))
})
