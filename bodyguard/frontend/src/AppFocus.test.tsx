// @vitest-environment happy-dom
// FR-U-04/05 / release-plan4·6: delayed account state must not strand keyboard focus.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from './App'

const account = { id: 'focus-fixture', email: 'fixture@example.com' }
const ready = () => new Response(JSON.stringify(account))
const focused = (element: HTMLElement) => document.activeElement === element
function response() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

for (const [path, title] of [
  ['/start', '내 몸을 위한 시작'],
  ['/explore', '스트레칭 시작 경로'],
  ['/account', '내 계정'],
  ['/start/', '내 몸을 위한 시작'],
  ['/EXPLORE', '스트레칭 시작 경로'],
])
  it(`F01 ${path}: 계정 확인 제목에서 실제 화면 제목으로 이어진다`, async () => {
    const pending = response()
    window.history.replaceState(null, '', path)
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise))
    render(<App />)
    expect(focused(screen.getByRole('heading', { name: '계정을 확인하고 있습니다' }))).toBe(true)
    await act(async () => pending.resolve(ready()))
    const heading = screen.getByRole('heading', { name: title })
    await waitFor(() => expect(focused(heading)).toBe(true))
  })

it('F02 실패 확인·명시 재시도·현재 시작 제목', async () => {
  const retry = response()
  window.history.replaceState(null, '', '/start')
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockReturnValue(retry.promise),
  )
  render(<App />)
  const failure = await screen.findByRole('heading', { name: '연결을 확인해 주세요' })
  await waitFor(() => expect(focused(failure)).toBe(true))
  const button = screen.getByRole('button', { name: '다시 확인' })
  button.focus()
  fireEvent.click(button)
  expect(focused(screen.getByRole('heading', { name: '계정을 확인하고 있습니다' }))).toBe(true)
  await act(async () => retry.resolve(ready()))
  expect(focused(screen.getByRole('heading', { name: '내 몸을 위한 시작' }))).toBe(true)
})

it('F02 로그아웃 실패 제목·명시 재시도·게스트 로그인', async () => {
  const logout = response()
  window.history.replaceState(null, '', '/start')
  const fetcher = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const path = String(input)
    if (path.endsWith('/me')) return Promise.resolve(ready())
    if (path.endsWith('/csrf')) return Promise.resolve(new Response('{"csrf_token":"fixture"}'))
    if (path.endsWith('/google/status'))
      return Promise.resolve(new Response('{"configured":false}'))
    if (path.endsWith('/logout')) return logout.promise
    throw new Error('Unexpected fixture request')
  })
  vi.stubGlobal('fetch', fetcher)
  render(<App />)
  await screen.findByRole('heading', { name: '내 몸을 위한 시작' })
  const button = screen.getByRole('button', { name: '로그아웃' })
  button.focus()
  fireEvent.click(button)
  await act(async () => logout.resolve(new Response('{}', { status: 503 })))
  const failure = screen.getByRole('heading', { name: '로그아웃을 확인하지 못했습니다' })
  expect(focused(failure)).toBe(true)
  fetcher.mockImplementation((input: RequestInfo | URL) =>
    Promise.resolve(
      String(input).endsWith('/logout')
        ? new Response(null, { status: 204 })
        : new Response(
            String(input).endsWith('/csrf') ? '{"csrf_token":"fixture"}' : '{"configured":false}',
          ),
    ),
  )
  const retry = screen.getByRole('button', { name: '로그아웃 다시 시도' })
  retry.focus()
  fireEvent.click(retry)
  const login = await screen.findByRole('heading', { name: '다시 만나 반갑습니다' })
  await waitFor(() => expect(focused(login)).toBe(true))
})

for (const target of ['header', 'main'] as const)
  it(`F03 확인 중 사용자가 선택한 살아 있는 ${target} 초점을 보존한다`, async () => {
    const pending = response()
    window.history.replaceState(null, '', '/start')
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise))
    render(<App />)
    const element =
      target === 'header'
        ? screen.getByRole('link', { name: 'BODYGUARD 서비스 소개' })
        : screen.getByRole('main')
    element.focus()
    await act(async () => pending.resolve(ready()))
    expect(focused(element)).toBe(true)
  })

for (const status of [401, 503])
  it(`F04 공개 로그인 입력은 계정 응답${status} 뒤에도 보존한다`, async () => {
    const pending = response()
    window.history.replaceState(null, '', '/login')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) =>
          String(input).endsWith('/me')
            ? pending.promise
            : Promise.resolve(new Response('{"configured":false}')),
        ),
    )
    render(<App />)
    const email = screen.getByLabelText('이메일', { exact: true })
    email.focus()
    fireEvent.change(email, { target: { value: 'input@example.com' } })
    await act(async () => pending.resolve(new Response('{}', { status })))
    expect(focused(email)).toBe(true)
    expect((email as HTMLInputElement).value).toBe('input@example.com')
  })

it('F04 같은 탐색 화면의 선택 동작은 제목으로 초점을 빼앗지 않는다', async () => {
  window.history.replaceState(null, '', '/explore')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ready()))
  render(<App />)
  await screen.findByRole('heading', { name: '스트레칭 시작 경로' })
  const button = screen.getByRole('button', { name: '추천받기' })
  button.focus()
  fireEvent.click(button)
  expect(focused(button)).toBe(true)
  const radio = screen.getByRole('radio', { name: '어깨' })
  radio.focus()
  fireEvent.click(radio)
  expect(focused(radio)).toBe(true)
})

it('F05 비활성 문서는 초기·계정 완료에 focus를 호출하지 않는다', async () => {
  vi.mocked(document.hasFocus).mockReturnValue(false)
  const focus = vi.spyOn(HTMLElement.prototype, 'focus')
  const pending = response()
  window.history.replaceState(null, '', '/start')
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise))
  render(<App />)
  await act(async () => pending.resolve(ready()))
  expect(focus.mock.calls.length).toBe(0)
})

it('F06 기록 제목의 초점은 담당 화면이 한 번만 관리한다', async () => {
  const focus = vi.spyOn(HTMLElement.prototype, 'focus')
  window.history.replaceState(null, '', '/records')
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((input: RequestInfo | URL) =>
        Promise.resolve(
          String(input).endsWith('/me') ? ready() : new Response('{"items":[],"has_more":false}'),
        ),
      ),
  )
  render(<App />)
  const heading = await screen.findByRole('heading', { name: '내 수행 기록' })
  await waitFor(() => expect(focused(heading)).toBe(true))
  expect(focus.mock.contexts.filter((node) => node === heading).length).toBe(1)
})
