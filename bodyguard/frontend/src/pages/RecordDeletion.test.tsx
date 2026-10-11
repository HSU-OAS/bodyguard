// @vitest-environment happy-dom
// FR-U-05: initial red harness; a preview must never issue a deletion request.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function mockResponse(body: unknown, status = 200): Response {
  const response = new Response(JSON.stringify(body), { status })
  // FR-U-05: deterministic DOM state; API/production Chrome retain real response parsing.
  vi.spyOn(response, 'json').mockResolvedValue(body)
  return response
}

function setup(count = 2, deletionStatus = 200) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    let body: unknown = { items: [], has_more: false }
    if (url === '/api/v1/me') body = { id: 'fixture-owner', email: 'fixture@example.com' }
    if (url === '/api/v1/auth/google/status') body = { configured: false }
    if (url === '/api/v1/auth/csrf') body = { csrf_token: 'a'.repeat(64) }
    if (url.endsWith('/delete-preview'))
      body = {
        ...JSON.parse(String(init?.body)),
        cutoff: '2026-10-05T04:00:00Z',
        expires_at: '2026-10-05T04:10:00Z',
        count,
        fingerprint: 'a'.repeat(64),
        signature: 'b'.repeat(64),
      }
    if (url.endsWith('/delete'))
      body = deletionStatus === 200 ? { deleted: count } : { detail: 'private raw error' }
    return mockResponse(body, url.endsWith('/delete') ? deletionStatus : 200)
  })
  vi.stubGlobal('fetch', fetcher)
  window.history.replaceState(null, '', '/records')
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  return fetcher
}
const deletions = (fetcher: ReturnType<typeof setup>) =>
  fetcher.mock.calls.filter(([url]) => url.endsWith('/delete'))

async function openPreview() {
  // FR-U-05: wait for the mounted list, not the first StrictMode commit where
  // passive-effect cleanup can abort a synthetic click. No latency limit is relaxed.
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
  const button = screen.getByRole('button', { name: '이 기간 기록 삭제' })
  // FR-U-05: flush controlled immediate mock work; real timing is exercised in Chrome.
  await act(async () => fireEvent.click(button))
}
const previewText = (count: number) => screen.findByText(`삭제 대상: ${count}건`)

it('blocks duplicate confirmation and discards deletion response after leaving', async () => {
  const fetcher = setup()
  const original = fetcher.getMockImplementation()
  if (!original) throw new Error('Fixture implementation required')
  let resolve: ((value: Response) => void) | undefined
  let signal: AbortSignal | null | undefined
  fetcher.mockImplementation((url, init) => {
    if (!url.endsWith('/delete')) return original(url, init)
    signal = init?.signal
    return new Promise<Response>((done) => {
      resolve = done
    })
  })
  await openPreview()
  expect(
    fetcher.mock.calls
      .filter(([url]) => url.endsWith('/auth/csrf') || url.endsWith('/delete-preview'))
      .map(([url, init]) => ({ path: url, aborted: init?.signal?.aborted })),
  ).not.toContainEqual(expect.objectContaining({ aborted: true }))
  await previewText(2)
  const button = screen.getByRole('button', { name: '기록 삭제' })
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  expect(deletions(fetcher)).toHaveLength(1)
  expect(
    (screen.getByRole('button', { name: '목록으로 돌아가기' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  fireEvent.click(screen.getByRole('link', { name: '내 시작' }))
  await waitFor(() => expect(signal?.aborted).toBe(true))
  await act(async () => resolve?.(mockResponse({ deleted: 2 })))
  expect(screen.queryByText('2건의 수행 기록을 삭제했습니다.')).toBeNull()
  expect(deletions(fetcher)).toHaveLength(1)
})

it.each(['cancel', 'period', 'leave'])('discards a late preview after %s', async (action) => {
  const fetcher = setup()
  const original = fetcher.getMockImplementation()
  if (!original) throw new Error('Fixture implementation required')
  let resolve: ((value: Response) => void) | undefined
  let signal: AbortSignal | null | undefined
  fetcher.mockImplementation((url, init) => {
    if (!url.endsWith('/delete-preview')) return original(url, init)
    signal = init?.signal
    return new Promise<Response>((done) => {
      resolve = done
    })
  })
  await openPreview()
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  if (action === 'cancel') fireEvent.click(screen.getByRole('button', { name: '취소' }))
  if (action === 'period') fireEvent.click(screen.getByRole('button', { name: '기간 조회' }))
  if (action === 'leave') fireEvent.click(screen.getByRole('link', { name: '내 시작' }))
  await waitFor(() => expect(signal?.aborted).toBe(true))
  await act(async () => resolve?.(mockResponse({ count: 999 })))
  expect(screen.queryByRole('button', { name: '기록 삭제' })).toBeNull()
  expect(screen.queryByText('삭제 대상: 999건')).toBeNull()
  expect(deletions(fetcher)).toHaveLength(0)
})

it('shows scope and irreversible consequence, then cancels without deletion', async () => {
  const fetcher = setup()
  await openPreview()
  await previewText(2)
  expect(screen.getByText(/복구할 수 없습니다/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(deletions(fetcher)).toHaveLength(0)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '이 기간 기록 삭제' }))
})

it('posts only an explicit confirmation and reports the actual server count', async () => {
  const fetcher = setup()
  await openPreview()
  await previewText(2)
  expect(deletions(fetcher)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: '기록 삭제' }))
  await screen.findByText('2건의 수행 기록을 삭제했습니다.')
  expect(deletions(fetcher)).toHaveLength(1)
  expect(JSON.parse(String(deletions(fetcher)[0][1]?.body)).confirmation).toBe(
    'delete-stretch-records',
  )
})

it('does not allow deletion of an empty preview', async () => {
  const fetcher = setup(0)
  await openPreview()
  await previewText(0)
  expect((screen.getByRole('button', { name: '기록 삭제' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  expect(deletions(fetcher)).toHaveLength(0)
})

it.each([409, 503])('does not silently retry or invent results after status %s', async (status) => {
  const fetcher = setup(2, status)
  await openPreview()
  await previewText(2)
  fireEvent.click(screen.getByRole('button', { name: '기록 삭제' }))
  await screen.findByText(
    status === 409 ? /삭제 확인이 만료되었거나/ : /삭제 결과를 확인하지 못했습니다/,
  )
  expect(screen.queryByText('private raw error')).toBeNull()
  expect(screen.queryByRole('button', { name: '기록 삭제' })).toBeNull()
  await waitFor(() => expect(deletions(fetcher)).toHaveLength(1))
  fireEvent.click(screen.getByRole('button', { name: '삭제 대상 다시 확인' }))
  await previewText(2)
  expect(deletions(fetcher)).toHaveLength(1)
})

it('opens deletion preview separately from reading and requires explicit confirmation', async () => {
  const fetcher = vi.fn(async (url: string) => {
    const body =
      url === '/api/v1/me'
        ? { id: 'fixture-owner', email: 'fixture@example.com' }
        : url === '/api/v1/auth/google/status'
          ? { configured: false }
          : url === '/api/v1/auth/csrf'
            ? { csrf_token: 'a'.repeat(64) }
            : { items: [], has_more: false }
    return mockResponse(body)
  })
  vi.stubGlobal('fetch', fetcher)
  window.history.replaceState(null, '', '/records')
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await screen.findByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' })
  fireEvent.click(screen.getByRole('button', { name: '이 기간 기록 삭제' }))
  expect(
    fetcher.mock.calls.filter(([url]) => url === '/api/v1/records/stretch/delete'),
  ).toHaveLength(0)
})

it('removes record rows and signed confirmation when deletion binding is rejected', async () => {
  const fetcher = setup(2, 403)
  await openPreview()
  await previewText(2)
  fireEvent.click(screen.getByRole('button', { name: '기록 삭제' }))
  await screen.findByRole('heading', { name: '계정을 다시 확인해 주세요' })
  expect(document.activeElement).toBe(
    screen.getByRole('heading', { name: '계정을 다시 확인해 주세요' }),
  )
  expect(screen.queryByText('삭제 대상: 2건')).toBeNull()
  expect(screen.queryByRole('button', { name: '기록 삭제' })).toBeNull()
  expect(screen.queryByRole('button', { name: '이 기간 기록 삭제' })).toBeNull()
  expect(screen.queryByText('2건의 수행 기록을 삭제했습니다.')).toBeNull()
  expect(deletions(fetcher)).toHaveLength(1)
})
