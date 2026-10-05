// @vitest-environment happy-dom
// FR-N-03/FR-U-04/NFR-08: actual web route, controlled network; no notification/camera.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from '../App'

const owner = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const defaults = {
  posture_enabled: true,
  posture_minutes: 5,
  sitting_enabled: true,
  sitting_minutes: 50,
  sound_enabled: false,
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function network(settings: (init?: RequestInit) => Promise<Response>, user = () => json(owner)) {
  const calls = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/v1/me') return user()
    if (url === '/api/v1/auth/csrf') return json({ csrf_token: 'a'.repeat(64) })
    if (url === '/api/v1/auth/google/status') return json({ configured: false })
    if (url === '/api/v1/settings/notifications') return settings(init)
    throw new Error('Unexpected test request')
  })
  vi.stubGlobal('fetch', calls)
  return calls
}
function open(path = '/account/notifications') {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  history.replaceState(null, '', path)
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
async function loaded() {
  return screen.findByRole('button', { name: '설정 저장' })
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/')
})

it('W01 account entry links to the protected settings page', async () => {
  network(async () => json(defaults))
  open('/account')
  const entry = await screen.findByRole('link', { name: '알림 설정 관리' })
  expect(entry.getAttribute('href')).toBe('/account/notifications')
  fireEvent.click(entry)
  await loaded()
  expect(document.title).toBe('알림 설정 · BODYGUARD')
  expect(screen.getByRole('heading', { level: 1, name: '알림 설정' })).toBe(document.activeElement)
  expect(screen.getByText(/실제 알림 연결은 준비 중/)).toBeTruthy()
})
it.each([401, 503])('W01 auth gate blocks settings requests at %s', async (status) => {
  const settings = vi.fn(async () => json(defaults))
  network(settings, () => json({}, status))
  open()
  await screen.findByRole('heading', {
    name: status === 401 ? '다시 만나 반갑습니다' : '연결을 확인해 주세요',
  })
  expect(settings).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: '설정 저장' })).toBeNull()
})
it('W01 read loading hides the form, then displays server values, not guessed defaults', async () => {
  const pending: Array<{ signal: AbortSignal; done: (r: Response) => void }> = []
  network(
    (init) => new Promise((done) => pending.push({ signal: init?.signal as AbortSignal, done })),
  )
  open()
  await screen.findByText('설정을 불러오고 있습니다.')
  expect(screen.queryByRole('button', { name: '설정 저장' })).toBeNull()
  await waitFor(() => expect(pending.some((p) => !p.signal.aborted)).toBe(true))
  await act(async () => {
    for (const p of pending) p.done(json({ ...defaults, posture_minutes: 12 }))
  })
  await loaded()
  expect((screen.getByLabelText('자세 알림 시간 (분)') as HTMLInputElement).value).toBe('12')
})
it('W02 explicit save uses all fields, preserves the disabled interval and changes sound only on choice', async () => {
  const calls = network(async (init) =>
    json(init?.method === 'POST' ? JSON.parse(String(init.body)) : defaults),
  )
  open()
  await loaded()
  fireEvent.change(screen.getByLabelText('자세 알림 시간 (분)'), { target: { value: '7' } })
  fireEvent.click(screen.getByLabelText('자세 알림 사용'))
  expect((screen.getByLabelText('자세 알림 시간 (분)') as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByLabelText('알림 소리 사용'))
  fireEvent.click(await loaded())
  await screen.findByText('설정을 저장했습니다.')
  const post = calls.mock.calls.filter(([, init]) => init?.method === 'POST')
  expect(post).toHaveLength(1)
  expect(JSON.parse(String(post[0]?.[1]?.body))).toEqual({
    ...defaults,
    posture_enabled: false,
    posture_minutes: 7,
    sound_enabled: true,
  })
  expect([localStorage.length, sessionStorage.length]).toEqual([0, 0])
})
it.each(['', '0', '1441', '1.5'])(
  'W02 invalid minutes %s focus the error summary without POST',
  async (value) => {
    const calls = network(async () => json(defaults))
    open()
    await loaded()
    fireEvent.change(screen.getByLabelText('자세 알림 시간 (분)'), { target: { value } })
    fireEvent.submit(screen.getByRole('form', { name: '알림 설정 변경' }))
    const summary = await screen.findByRole('alert')
    await waitFor(() => expect(document.activeElement).toBe(summary))
    expect(screen.getByLabelText('자세 알림 시간 (분)').getAttribute('aria-invalid')).toBe('true')
    expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  },
)
it('W03 failed reads require explicit retry and never show raw errors or a default form', async () => {
  let failed = true
  network(async () => (failed ? json({ detail: 'PRIVATE settings ERROR' }, 503) : json(defaults)))
  open()
  await screen.findByText('설정을 불러오지 못했습니다.')
  expect(document.body.textContent).not.toContain('PRIVATE settings ERROR')
  expect(screen.queryByRole('button', { name: '설정 저장' })).toBeNull()
  failed = false
  fireEvent.click(screen.getByRole('button', { name: '다시 조회' }))
  await loaded()
})
it('W03 uncertain POST blocks editing and does not automatically repeat a possibly accepted save', async () => {
  const calls = network(async (init) => {
    if (init?.method === 'POST') throw new Error('PRIVATE save ERROR')
    return json(defaults)
  })
  open()
  await loaded()
  fireEvent.click(await loaded())
  await screen.findByText(/저장 결과를 확인하지 못했습니다/)
  expect(document.body.textContent).not.toContain('PRIVATE save ERROR')
  expect(
    (screen.getByLabelText('자세 알림 사용').closest('fieldset') as HTMLFieldSetElement).disabled,
  ).toBe(true)
  expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '저장된 설정 다시 조회' }))
  await waitFor(() =>
    expect(
      (screen.getByLabelText('자세 알림 사용').closest('fieldset') as HTMLFieldSetElement).disabled,
    ).toBe(false),
  )
  expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})
it('W04 pending save is single-flight; auth refresh removes old drafts and ignores late responses', async () => {
  let expired = false
  let done: (r: Response) => void = () => {}
  let pendingSignal: AbortSignal | null = null
  const calls = network(
    (init) =>
      init?.method === 'POST'
        ? new Promise((finish) => {
            done = finish
            pendingSignal = init.signal as AbortSignal
          })
        : Promise.resolve(json(defaults)),
    () => (expired ? json({}, 401) : json(owner)),
  )
  open()
  await loaded()
  const form = screen.getByRole('form', { name: '알림 설정 변경' })
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(pendingSignal).not.toBeNull())
  expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
  expired = true
  fireEvent(window, new Event('focus'))
  await screen.findByRole('heading', { name: '다시 만나 반갑습니다' })
  expect((pendingSignal as AbortSignal | null)?.aborted).toBe(true)
  await act(async () => done(json(defaults)))
  expect(screen.queryByText('설정을 저장했습니다.')).toBeNull()
})
it('W02 disabling an invalid interval retains the last confirmed number rather than an uneditable error', async () => {
  const calls = network(async (init) =>
    json(init?.method === 'POST' ? JSON.parse(String(init.body)) : defaults),
  )
  open()
  await loaded()
  fireEvent.change(screen.getByLabelText('자세 알림 시간 (분)'), { target: { value: '' } })
  fireEvent.click(screen.getByLabelText('자세 알림 사용'))
  expect((screen.getByLabelText('자세 알림 시간 (분)') as HTMLInputElement).value).toBe('5')
  fireEvent.click(await loaded())
  await screen.findByText('설정을 저장했습니다.')
  expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})
it('W04 focus refresh with the same account creates a new authority and discards unsaved settings', async () => {
  const calls = network(async () => json(defaults))
  open()
  await loaded()
  fireEvent.change(screen.getByLabelText('자세 알림 시간 (분)'), { target: { value: '9' } })
  fireEvent(window, new Event('focus'))
  await waitFor(() =>
    expect((screen.getByLabelText('자세 알림 시간 (분)') as HTMLInputElement).value).toBe('5'),
  )
  expect(calls.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
})
