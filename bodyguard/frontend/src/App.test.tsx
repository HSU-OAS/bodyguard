// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it('B-01 공개 시작은 카메라·시제품 없이 서비스 소개와 계정 진입을 제공한다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(<App />)
  expect(screen.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeTruthy()
  await waitFor(() => expect(screen.getByRole('link', { name: '시작하기' })).toBeTruthy())
  expect(screen.queryByRole('button', { name: '측정 시작' })).toBeNull()
  expect(screen.queryByTestId('measuring-badge')).toBeNull()
})

it('B-01 보호 경로의 401은 로그인으로 이동하며 외부 목적지는 허용하지 않는다', async () => {
  window.history.replaceState(null, '', '/start')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(<App />)
  expect(screen.queryByText('person@example.com')).toBeNull()
  expect(await screen.findByRole('heading', { name: '로그인' })).toBeTruthy()
  expect(window.location.pathname).toBe('/login')
  expect(window.location.search).toBe('?next=%2Fstart')
})

it('B-02 서버 실패는 게스트 폴백 없이 보호 UI를 차단하고 재시도한다', async () => {
  window.history.replaceState(null, '', '/start')
  const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  render(<App />)
  expect(await screen.findByRole('heading', { name: '연결을 확인해 주세요' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '로그인' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
})

// FR-V-02/FR-U-04: identify real entry/recovery pages without changing their layout.
it('공개 서비스 소개는 코칭 실행과 구분되는 탭 제목을 제공한다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(<App />)
  await waitFor(() => expect(document.title).toBe('서비스 소개 · BODYGUARD'))
  expect(screen.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeTruthy()
})

it('없는 주소는 입력을 반사하지 않고 소개 복귀→로그인까지 제목을 갱신한다', async () => {
  window.history.replaceState(null, '', '/unknown-private-fixture?token=fixture#private')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(<App />)
  await waitFor(() => expect(document.title).toBe('페이지를 찾을 수 없습니다 · BODYGUARD'))
  expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeTruthy()
  fireEvent.click(screen.getByRole('link', { name: '서비스 소개로 돌아가기' }))
  await waitFor(() => expect(document.title).toBe('서비스 소개 · BODYGUARD'))
  fireEvent.click(screen.getByRole('link', { name: '로그인' }))
  await waitFor(() => expect(document.title).toBe('로그인 · BODYGUARD'))
  expect(await screen.findByRole('heading', { name: '로그인' })).toBeTruthy()
})

it.each([
  ['/login/', '로그인'],
  ['/LOGIN/', '로그인'],
  ['/signup/', '이메일 가입'],
  ['/help/', '도움말'],
  ['/HELP///', '도움말'],
  ['/data/', '카메라와 데이터 안내'],
  ['/password/forgot/', '계정 복구'],
  ['/password/reset/', '계정 복구'],
  ['/password/not-a-page/', '페이지를 찾을 수 없습니다'],
])('기존 라우트 %s의 trailing slash와 실제 없는 복구 주소를 구분한다', async (path, title) => {
  window.history.replaceState(null, '', `${path}?fixture=value#keep-fragment`)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
  render(<App />)
  await waitFor(() => expect(document.title).toBe(`${title} · BODYGUARD`))
  if (path === '/password/reset/') {
    // FR-U-03: the existing reset form removes invalid fragment/query with a replace navigation.
    expect(window.location.pathname).toBe('/password/reset')
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  } else {
    expect(window.location.pathname).toBe(path)
    expect(window.location.search).toBe('?fixture=value')
    expect(window.location.hash).toBe('#keep-fragment')
  }
})

it.each(['/records-not-a-page/', '/account-not-a-page/'])(
  '없는 유사 경로 %s는 개인 메뉴를 현재 페이지로 표시하지 않는다',
  async (path) => {
    window.history.replaceState(null, '', path)
    const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(user)))),
    )
    render(<App />)
    await waitFor(() => expect(screen.getByRole('link', { name: '내 계정' })).toBeTruthy())
    expect(screen.getByRole('link', { name: '내 계정' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: '수행 기록' }).getAttribute('aria-current')).toBeNull()
    expect(document.title).toBe('페이지를 찾을 수 없습니다 · BODYGUARD')
  },
)

it.each([
  ['/start/', '내 시작 · BODYGUARD', '내 시작'],
  ['/account/', '내 계정 · BODYGUARD', '내 계정'],
  ['/account/notifications/', '알림 설정 · BODYGUARD', '내 계정'],
  ['/ACCOUNT/NOTIFICATIONS/', '알림 설정 · BODYGUARD', '내 계정'],
  ['/account/delete/', '회원 탈퇴 · BODYGUARD', '내 계정'],
  ['/records/', '내 수행 기록 · BODYGUARD', '수행 기록'],
  ['/posture-records/', '내 자세 기록 · BODYGUARD', '자세 기록'],
])('개인 라우트 %s의 자체 제목과 현재 메뉴를 유지한다', async (path, title, menu) => {
  window.history.replaceState(null, '', path)
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url === '/api/v1/me'
            ? new Response(JSON.stringify(user))
            : new Response('{}', { status: 503 }),
        ),
      ),
  )
  render(<App />)
  await waitFor(() =>
    expect(screen.getByRole('link', { name: menu }).getAttribute('aria-current')).toBe('page'),
  )
  await waitFor(() => expect(document.title).toBe(title))
  expect(window.location.pathname).toBe(path)
})
