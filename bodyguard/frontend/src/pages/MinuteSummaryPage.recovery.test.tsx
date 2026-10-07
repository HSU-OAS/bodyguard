// @vitest-environment happy-dom
// FR-R-03/FR-U-04: real mount/event/route ordering; synthetic authority/network only.
import { cleanup, screen } from '@testing-library/react'
import { act, type ReactNode, StrictMode, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MinuteSummaryPage } from './MinuteSummaryPage'

const account = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const authority = { status: 'ready', user: account }
vi.mock('../auth', () => ({ useAuth: () => ({ state: authority, refresh: vi.fn() }) }))
let root: Root | undefined
let host: HTMLDivElement | undefined
beforeEach(() => {
  vi.setSystemTime(new Date('2026-10-07T12:00:00Z'))
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})
afterEach(async () => {
  await act(async () => root?.unmount())
  host?.remove()
  root = undefined
  host = undefined
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
function change(id: string, value: string) {
  const input = document.getElementById(id)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (!(input instanceof HTMLInputElement) || !setter) throw new Error('Missing date input')
  setter.call(input, value)
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
function EarlyInput({ id, value }: { id: string; value: string }) {
  useLayoutEffect(() => change(id, value), [id, value])
  return null
}
function Navigation() {
  const navigate = useNavigate()
  return (
    <>
      <button type="button" onClick={() => navigate('?from=2026-10-03&to=2026-10-04')}>
        fixture period
      </button>
      <button type="button" onClick={() => navigate('?from=2026-10-01&to=2026-10-02&page=1')}>
        fixture page
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        fixture back
      </button>
    </>
  )
}
async function mount(query: string, early?: ReactNode, strict = false) {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    const value =
      path === '/api/v1/me'
        ? account
        : path === '/api/v1/auth/csrf'
          ? { csrf_token: 'a'.repeat(64) }
          : path.endsWith('/delete-preview')
            ? {
                ...JSON.parse(init?.body as string),
                cutoff: '2026-10-07T12:00:00.123456Z',
                expires_at: '2026-10-07T12:10:00.123456Z',
                count: 1,
                fingerprint: 'b'.repeat(64),
                signature: 'c'.repeat(64),
              }
            : { items: [], has_more: false }
    return new Response(JSON.stringify(value))
  })
  vi.stubGlobal('fetch', fetch)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  const view = (
    <MemoryRouter initialEntries={[`/posture-records${query}`]}>
      <MinuteSummaryPage />
      {early}
      <Navigation />
    </MemoryRouter>
  )
  await act(async () => root?.render(strict ? <StrictMode>{view}</StrictMode> : view))
  return fetch
}
async function click(name: string) {
  await act(async () => {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement
    button.click()
  })
}
const input = (name: string) => screen.getByLabelText(name) as HTMLInputElement

it.each([
  ['start', false],
  ['start', true],
  ['end', false],
  ['end', true],
] as const)('R01 early %s input survives initial effects (StrictMode=%s)', async (part, strict) => {
  const start = part === 'start'
  const fetch = await mount(
    start ? '?from=2026-02-30&to=2026-10-02' : '?from=2026-10-01&to=2026-02-30',
    <EarlyInput
      id={start ? 'summary-from' : 'summary-to'}
      value={start ? '2026-10-01' : '2026-10-02'}
    />,
    strict,
  )
  expect(input('시작 날짜').value).toBe('2026-10-01')
  expect(input('종료 날짜').value).toBe('2026-10-02')
  expect(fetch.mock.calls.filter(([path]) => path.startsWith('/api/v1/summaries'))).toHaveLength(0)
  await click('기간 조회')
  expect(await screen.findByText('이 기간에는 자세 기록이 없습니다')).toBeTruthy()
  expect(fetch.mock.calls.filter(([path]) => path.startsWith('/api/v1/summaries'))).toHaveLength(1)
})

it('R02 real URL changes/back/page reset the draft but unsubmitted input does not change results', async () => {
  const fetch = await mount('?from=2026-10-01&to=2026-10-02')
  await screen.findByText('이 기간에는 자세 기록이 없습니다')
  const before = fetch.mock.calls.length
  await act(async () => change('summary-from', '2026-10-03'))
  expect(input('시작 날짜').value).toBe('2026-10-03')
  expect(screen.getByRole('heading', { name: '2026-10-01 ~ 2026-10-02 · 자세 기록' })).toBeTruthy()
  expect(fetch.mock.calls).toHaveLength(before)
  await click('fixture page')
  expect(input('시작 날짜').value).toBe('2026-10-01')
  expect(fetch.mock.calls.some(([path]) => path.includes('offset=20'))).toBe(true)
  await click('fixture period')
  expect(input('시작 날짜').value).toBe('2026-10-03')
  expect(input('종료 날짜').value).toBe('2026-10-04')
  await click('fixture back')
  expect(input('시작 날짜').value).toBe('2026-10-01')
  expect(input('종료 날짜').value).toBe('2026-10-02')
})

it('R03 changing the committed route closes deletion confirmation without a mutation', async () => {
  const fetch = await mount('?from=2026-10-01&to=2026-10-02', undefined, true)
  await screen.findByText('이 기간에는 자세 기록이 없습니다')
  await click('삭제 대상 확인')
  expect(await screen.findByRole('button', { name: '확인한 자세 기록 삭제' })).toBeTruthy()
  await click('fixture period')
  expect(screen.queryByRole('button', { name: '확인한 자세 기록 삭제' })).toBeNull()
  expect(fetch.mock.calls.filter(([path]) => path.endsWith('/delete'))).toHaveLength(0)
})
