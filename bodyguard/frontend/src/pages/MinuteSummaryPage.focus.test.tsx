// @vitest-environment happy-dom
// FR-R-03/FR-U-04/05: actual App/router, controlled synthetic HTTP, no captured body.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const part = { method: 'fixture', unit: 'deg', dev_mean: null, measured_sec: 0, bad_sec: 0 }
const row = {
  minute_start: '2026-10-01T12:00:00Z',
  baseline_id: null,
  client_version: 'Fixture+V1',
  coverage_sec: 60,
  measured_sec: 30,
  unmeasurable_sec: 20,
  present_sec: 45,
  background_sec: 10,
  any_bad_sec: 15,
  neck: part,
  trunk: part,
  shoulder: { ...part, dev_mean: 1.25, measured_sec: 30, bad_sec: 15 },
  created_at: '2026-10-01T12:01:00Z',
  provenance: 'client-reported',
}
beforeEach(() => {
  vi.setSystemTime(new Date('2026-10-06T12:01:00Z'))
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  history.replaceState(null, '', '/')
})
async function pendingQuery(action: 'page' | 'period' = 'page') {
  let calls = 0,
    release: ((value: unknown) => void) | undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/v1/me')
        return new Response(JSON.stringify({ id: 'focus-fixture', email: 'fixture@example.com' }))
      if (path === '/api/v1/auth/csrf')
        return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
      if (path.startsWith('/api/v1/summaries?')) {
        const data =
          ++calls === 1
            ? {
                items: Array.from({ length: 20 }, (_, i) => ({
                  ...row,
                  minute_start: new Date(Date.parse(row.minute_start) - i * 60000).toISOString(),
                })),
                has_more: true,
              }
            : await new Promise((resolve) => {
                release = resolve
              })
        return data instanceof Response ? data : new Response(JSON.stringify(data))
      }
      throw new Error('Unexpected test request')
    }),
  )
  history.replaceState(null, '', '/posture-records?from=2026-10-01&to=2026-10-02')
  render(<App />)
  const next = await screen.findByRole('button', { name: '다음 기록' })
  const initiator = action === 'page' ? next : screen.getByRole('button', { name: '기간 조회' })
  initiator.focus()
  fireEvent.click(initiator)
  await waitFor(() => expect(release).toBeTypeOf('function'))
  return {
    initiator,
    finish: (value: unknown = { items: [], has_more: false }) => act(async () => release?.(value)),
  }
}
it.each(['ready', 'error'] as const)(
  'does not move date-input focus when a pending %s response arrives',
  async (status) => {
    const query = await pendingQuery()
    const input = screen.getByLabelText('시작 날짜')
    act(() => input.focus())
    await query.finish(status === 'error' ? new Response('', { status: 503 }) : undefined)
    expect(document.activeElement).toBe(input)
    expect((input as HTMLInputElement).value).toBe('2026-10-01')
    if (status === 'error')
      expect(screen.getByRole('alert').textContent).toContain('조회하지 못했습니다')
    else expect(screen.getByText('이 페이지에는 자세 기록이 없습니다')).toBeTruthy()
  },
)
it.each(['keydown', 'pointerdown', 'wheel'] as const)(
  'releases pending result focus on new %s even when the focused element stays unchanged',
  async (kind) => {
    const query = await pendingQuery('period')
    expect(document.activeElement).toBe(query.initiator)
    if (kind === 'keydown') fireEvent.keyDown(query.initiator, { key: 'ArrowRight' })
    else if (kind === 'wheel') fireEvent.wheel(query.initiator, { deltaY: 100 })
    else fireEvent.pointerDown(query.initiator)
    await query.finish()
    expect(document.activeElement).toBe(query.initiator)
  },
)
it.each(['ready', 'error'] as const)(
  'still hands result focus to a waiting keyboard user after %s',
  async (status) => {
    const query = await pendingQuery()
    await query.finish(status === 'error' ? new Response('', { status: 503 }) : undefined)
    expect(document.activeElement?.id).toBe('summary-results-heading')
  },
)
it('does not focus an inactive document when a pending response arrives', async () => {
  const query = await pendingQuery()
  vi.mocked(document.hasFocus).mockReturnValue(false)
  const before = document.activeElement
  await query.finish()
  expect(document.activeElement).toBe(before)
})
it('releases pending result focus after leaving the window even if it is active again', async () => {
  const query = await pendingQuery('period')
  fireEvent(window, new Event('blur'))
  await query.finish()
  expect(document.activeElement).toBe(query.initiator)
})
it('removes pending-focus listeners when leaving the record route', async () => {
  const query = await pendingQuery()
  fireEvent.click(screen.getByRole('link', { name: '도움말' }))
  await screen.findByRole('heading', { name: '도움말' })
  const summary = document.querySelector('summary')
  if (!summary) throw new Error('Missing help control')
  act(() => summary.focus())
  await query.finish()
  expect(document.activeElement).toBe(summary)
  expect(screen.queryByRole('heading', { name: /자세 기록$/ })).toBeNull()
})
