// @vitest-environment happy-dom
// FR-M-07/FR-S-06: controlled body/account/ownership, not actual SDK/person evidence.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { App } from '../App'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'

vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
type Input = NonNullable<ReturnType<ReturnType<typeof createCameraPreparation>['takeFrame']>>
type Fixture = {
  state: PreparationState
  input: Input | null
  start: ReturnType<typeof vi.fn<() => Promise<void>>>
  close: ReturnType<typeof vi.fn<() => Promise<void>>>
  takeFrame: ReturnType<typeof vi.fn<() => Input | null>>
}
const fixtures: Fixture[] = []
let now = 100,
  callbackId = 0
const callbacks = new Map<number, FrameRequestCallback>()
beforeAll(async () => {
  await import('./CoachingPage')
})
beforeEach(() => {
  fixtures.length = 0
  callbacks.clear()
  now = 100
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      const id = ++callbackId
      callbacks.set(id, cb)
      return id
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => callbacks.delete(id)),
  )
  vi.mocked(createCameraPreparation).mockImplementation((options) => {
    const fixture: Fixture = {
      state: { phase: 'idle' },
      input: null,
      start: vi.fn(async () => publish({ phase: 'ready' })),
      close: vi.fn(async () => publish({ phase: 'idle' })),
      takeFrame: vi.fn(() => {
        const input = fixture.input
        fixture.input = null
        return input
      }),
    }
    const publish = (next: PreparationState) => {
      fixture.state = next
      options.onState(next)
    }
    fixtures.push(fixture)
    return {
      get state() {
        return fixture.state
      },
      start: fixture.start,
      observe: () => publish({ phase: 'observing' }),
      takeFrame: fixture.takeFrame,
      stop: async () => publish({ phase: 'idle' }),
      close: fixture.close,
    }
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})
async function open() {
  window.history.replaceState(null, '', '/dev/coaching?motion=neck-side')
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'framing-fixture',
          email: 'fixture@example.com',
        }),
        { status: 200 },
      ),
    ),
  )
  render(<App />)
  await screen.findByRole('button', { name: '카메라 확인' })
}
function pump(input?: Input) {
  const fixture = fixtures.at(-1)
  if (input && fixture) fixture.input = input
  act(() => {
    const current = [...callbacks.values()]
    callbacks.clear()
    for (const cb of current) cb(now)
  })
}
const positive = (): Input => ({
  generation: 1,
  sequence: 1,
  at: now,
  result: {
    landmarks: [
      Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.9,
      })),
    ],
    worldLandmarks: [],
  },
})
it('consumes only explicit continuous input and shows a categorical hint without activating coaching', async () => {
  await open()
  expect(fixtures[0].start).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '카메라 확인' }))
  fireEvent.click(screen.getByRole('button', { name: '입력 확인' }))
  pump(positive())
  expect(screen.getByRole('status', { name: '현재 동작 촬영 안내' }).textContent).toContain(
    '촬영 범위 입력 확인됨',
  )
  expect(screen.getByRole('button', { name: '코칭 준비 중' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '전체 시범' }).hasAttribute('disabled')).toBe(true)
  now = 1100
  pump()
  expect(screen.getByRole('status', { name: '현재 동작 촬영 안내' }).textContent).toContain(
    '새 촬영 입력',
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라 끄기' }))
  expect(screen.getByRole('status', { name: '현재 동작 촬영 안내' }).textContent).not.toContain(
    '촬영 범위 입력 확인됨',
  )
})
it('display controls do not consume/change the actual motion camera owner or requirements', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', { name: '카메라 확인' }))
  fireEvent.click(screen.getByRole('button', { name: '입력 확인' }))
  const input = positive()
  input.result.landmarks[0][27].y = 2
  pump(input)
  fireEvent.click(screen.getByRole('button', { name: /^전신$/ }))
  expect(screen.getByRole('status', { name: '현재 동작 촬영 안내' }).textContent).toContain(
    '촬영 범위 입력 확인됨',
  )
  expect(fixtures).toHaveLength(1)
  expect(fixtures[0].close).not.toHaveBeenCalled()
})
it('motion selection retires the old input and requires fresh explicit camera preparation', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', { name: '카메라 확인' }))
  fireEvent.click(screen.getByRole('button', { name: '입력 확인' }))
  pump(positive())
  fireEvent.click(screen.getByRole('button', { name: '동작 변경' }))
  fireEvent.click(screen.getByRole('button', { name: '팔 위로 뻗기 화면에서 보기' }))
  await screen.findByRole('heading', { name: '팔 위로 뻗기', level: 1 })
  await screen.findByRole('button', { name: '카메라 확인' })
  expect(fixtures[0].close).toHaveBeenCalledTimes(1)
  expect(fixtures).toHaveLength(2)
  expect(fixtures[1].start).not.toHaveBeenCalled()
  const reads = fixtures[0].takeFrame.mock.calls.length
  pump()
  expect(fixtures[0].takeFrame).toHaveBeenCalledTimes(reads)
  expect(screen.getByRole('status', { name: '현재 동작 촬영 안내' }).textContent).toContain('골반')
  expect(screen.getByRole('status', { name: '현재 동작 촬영 안내' }).textContent).not.toContain(
    '촬영 범위 입력 확인됨',
  )
})
