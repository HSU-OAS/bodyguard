// @vitest-environment happy-dom
// Actual App/AuthProvider/client; input/API responses are controlled, not human validation.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'

vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
// This DOM contract is not a cold lazy-module speed test; real startup stays in Chrome.
beforeAll(async () => {
  await import('./CoachingPage')
})
type Input = NonNullable<ReturnType<ReturnType<typeof createCameraPreparation>['takeFrame']>>
const a = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const b = { ...a, id: '00000000-0000-4000-8000-000000000002' }
let now = 100,
  callbackId = 0,
  owner = a
const callbacks = new Map<number, FrameRequestCallback>()
const fixtures: Array<{ input: Input | null; stop: ReturnType<typeof vi.fn> }> = []
beforeEach(() => {
  fixtures.length = 0
  callbacks.clear()
  now = 100
  owner = a
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++callbackId
    callbacks.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  vi.mocked(createCameraPreparation).mockImplementation((options) => {
    let state: PreparationState = { phase: 'idle' }
    const publish = (next: PreparationState) => {
      state = next
      options.onState(next)
    }
    const fixture = {
      input: null as Input | null,
      stop: vi.fn(async () => publish({ phase: 'idle' })),
    }
    fixtures.push(fixture)
    return {
      get state() {
        return state
      },
      start: async () => publish({ phase: 'ready' }),
      observe: () => publish({ phase: 'observing' }),
      takeFrame: () => {
        const input = fixture.input
        fixture.input = null
        return input
      },
      stop: fixture.stop,
      close: fixture.stop,
    }
  })
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  history.replaceState(null, '', '/')
})
async function setup(
  save: (value: Record<string, unknown>, init: RequestInit) => Response | Promise<Response> = (
    value,
  ) => saved(value),
) {
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/v1/me') return new Response(JSON.stringify(owner))
    if (path === '/api/v1/auth/csrf')
      return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
    if (path === '/api/v1/baselines' && init?.method === 'POST')
      return save(JSON.parse(init.body as string), init)
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetch)
  history.replaceState(null, '', '/dev/coaching?motion=neck-side')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '카메라 확인' }))
  fireEvent.click(screen.getByRole('button', { name: '입력 확인' }))
  return fetch
}
function saved(value: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      ...value,
      created_at: '2026-10-12T00:00:00Z',
      is_active: true,
      provenance: 'client-reported',
    }),
    { status: 201 },
  )
}
function sample(sequence: number): Input {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.4, z: 0, visibility: 0.9 }))
  points[7].x = 0.4
  points[8].x = 0.6
  points[11] = { ...points[11], x: 0.3, y: 0.6 }
  points[12] = { ...points[12], x: 0.7, y: 0.6 }
  return {
    generation: 1,
    sequence,
    at: now,
    image: { width: 640, height: 480, imageIsMirrored: false },
    result: { landmarks: [points], worldLandmarks: [] },
  }
}
function pump(input?: Input) {
  const fixture = fixtures.at(-1)
  if (input && fixture) fixture.input = input
  act(() => {
    const current = [...callbacks.values()]
    callbacks.clear()
    for (const callback of current) callback(now)
  })
}
function collect() {
  const button = screen.getByRole('button', { name: '3초 기준 수집' })
  button.focus()
  fireEvent.click(button)
  fireEvent.click(screen.getByRole('button', { name: '기준 다시 수집' }))
  for (let n = 0; n <= 6; n++) {
    now = 100 + n * 500
    pump(sample(n + 1))
  }
  expect(screen.getByText(/화면상 어깨선/).textContent).toContain('0.0°')
  return button
}
const writes = (fetch: Awaited<ReturnType<typeof setup>>) =>
  fetch.mock.calls.filter(([path, init]) => path === '/api/v1/baselines' && init?.method === 'POST')
const confirm = () => fireEvent.click(screen.getByRole('checkbox'))
it('C6 historical same-ID retry must not claim to replace the currently active reference', async () => {
  const fetch = await setup(
    (value) =>
      new Response(
        JSON.stringify({
          ...value,
          created_at: '2026-10-12T00:00:00Z',
          is_active: false,
          provenance: 'client-reported',
        }),
        { status: 200 },
      ),
  )
  collect()
  confirm()
  fireEvent.click(screen.getByRole('button', { name: '기준 저장' }))
  await screen.findByText(/저장 이력은 확인했지만 현재 기준은 달라졌습니다/)
  expect(screen.queryByRole('button', { name: '기준 저장됨' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '저장 이력 확인됨' }))
  expect(writes(fetch)).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '기준 다시 수집' }))
  expect(screen.queryByRole('checkbox')).toBeNull()
})
it('C1 actual explicit capture→review→consent→save uses only the scalar whitelist DTO', async () => {
  const fetch = await setup()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(writes(fetch)).toHaveLength(0)
  const button = collect()
  expect(document.activeElement).toBe(button)
  expect(screen.getByRole('button', { name: '기준 저장' }).hasAttribute('disabled')).toBe(true)
  expect(writes(fetch)).toHaveLength(0)
  confirm()
  const save = screen.getByRole('button', { name: '기준 저장' })
  save.focus()
  fireEvent.click(save)
  fireEvent.click(screen.getByRole('button', { name: '기준 저장 중' }))
  await screen.findByRole('button', { name: '기준 저장됨' })
  expect(document.activeElement).toBe(save)
  expect(writes(fetch)).toHaveLength(1)
  const body = JSON.parse(writes(fetch)[0][1]?.body as string)
  expect(Object.keys(body).sort()).toEqual(['client_version', 'id', 'neck', 'shoulder', 'trunk'])
  expect(body).toMatchObject({
    client_version: 'web-observation-1',
    neck: null,
    trunk: null,
    shoulder: { method: 'image-plane-shoulder-axial-v1', unit: 'deg', value: 0 },
  })
  expect(writes(fetch)[0][1]?.headers).toMatchObject({ 'X-Account-ID': a.id })
  expect(localStorage.length + sessionStorage.length).toBe(0)
  expect(screen.getByRole('button', { name: '코칭 준비 중' }).hasAttribute('disabled')).toBe(true)
})
it('C2 failed save retries exactly the same reference ID and values explicitly', async () => {
  let count = 0
  const fetch = await setup((value) =>
    ++count === 1 ? new Response('{}', { status: 503 }) : saved(value),
  )
  collect()
  confirm()
  fireEvent.click(screen.getByRole('button', { name: '기준 저장' }))
  fireEvent.click(await screen.findByRole('button', { name: '기준 저장 다시 시도' }))
  await screen.findByRole('button', { name: '기준 저장됨' })
  expect(writes(fetch).map(([, init]) => init?.body)).toEqual([
    writes(fetch)[0][1]?.body,
    writes(fetch)[0][1]?.body,
  ])
})
it('C3 missing/ambiguous input and no fresh frame cancel collection without a write', async () => {
  const fetch = await setup()
  fireEvent.click(screen.getByRole('button', { name: '3초 기준 수집' }))
  pump(sample(1))
  now = 1100
  pump()
  expect(screen.getByRole('alert').textContent).toContain('입력이 끊겼습니다')
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(writes(fetch)).toHaveLength(0)
})
it.each(['stop', 'motion', 'owner', 'pagehide'] as const)(
  'C4 late write after %s cannot publish a saved reference',
  async (kind) => {
    let finish!: () => void, signal: AbortSignal | null | undefined
    const fetch = await setup((value, init) => {
      signal = init.signal
      return new Promise((resolve) => {
        finish = () => resolve(saved(value))
      })
    })
    collect()
    confirm()
    fireEvent.click(screen.getByRole('button', { name: '기준 저장' }))
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    if (kind === 'stop') fireEvent.click(screen.getByRole('button', { name: '카메라 끄기' }))
    else if (kind === 'motion') {
      fireEvent.click(screen.getByRole('button', { name: '동작 변경' }))
      fireEvent.click(screen.getByRole('button', { name: '팔 위로 뻗기 화면에서 보기' }))
      await screen.findByRole('heading', { name: '팔 위로 뻗기', level: 1 })
    } else if (kind === 'owner') {
      owner = b
      act(() => window.dispatchEvent(new Event('focus')))
      await waitFor(() => expect(fixtures.length).toBeGreaterThan(1))
    } else act(() => window.dispatchEvent(new Event('pagehide')))
    expect(signal?.aborted).toBe(true)
    await act(async () => finish())
    expect(screen.queryByRole('button', { name: '기준 저장됨' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(writes(fetch)).toHaveLength(1)
  },
)
it.each([401, 403])(
  'C5 authority error %s closes the camera and blocks further writes',
  async (status) => {
    const fetch = await setup(() => new Response('{}', { status }))
    collect()
    confirm()
    fireEvent.click(screen.getByRole('button', { name: '기준 저장' }))
    await screen.findByText(/계정을 확인하지 못해 기준 저장을 중단/)
    await waitFor(() => expect(fixtures[0].stop).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: '카메라 확인' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(writes(fetch)).toHaveLength(1)
  },
)
