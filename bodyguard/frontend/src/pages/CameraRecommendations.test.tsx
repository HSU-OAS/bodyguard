// @vitest-environment happy-dom
// FR-S-06/FR-U-04: actual pane/policy, mocked owned capture; not SDK/clinical proof.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import type { PreparationState } from '../pose/cameraPreparation'
import { createCameraPreparation } from '../pose/cameraPreparation'
import { CameraRecommendations } from './CameraRecommendations'

const account = vi.hoisted(() => ({
  state: { status: 'ready', user: { id: 'fixture', email: 'fixture@example.com' } },
}))
vi.mock('../auth', () => ({ useAuth: () => ({ state: account.state }) }))
vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
let now = 100,
  sequence = 0,
  raf: Map<number, FrameRequestCallback>,
  next = 0,
  slot: PoseRigFrame | null,
  wait: Promise<void> | null,
  fail = false,
  starts = 0,
  stops = 0,
  fetcher: ReturnType<typeof vi.fn>
beforeEach(() => {
  now = 100
  sequence = 0
  raf = new Map()
  next = 0
  slot = null
  wait = null
  fail = false
  starts = stops = 0
  account.state = { status: 'ready', user: { id: 'fixture', email: 'fixture@example.com' } }
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    raf.set(++next, fn)
    return next
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => raf.delete(id))
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  fetcher = vi.fn(() => Promise.reject(new Error('Unexpected HTTP')))
  vi.stubGlobal('fetch', fetcher)
  vi.mocked(createCameraPreparation).mockImplementation((options) => {
    let stopping: Promise<void> | null = null
    const camera = {
      state: { phase: 'idle' } as PreparationState,
      async start() {
        starts++
        stopping = null
        publish({ phase: 'ready' })
      },
      observe() {
        publish({ phase: 'observing' })
      },
      stop() {
        if (stopping) return stopping
        stops++
        publish({ phase: 'stopping' })
        stopping = (async () => {
          await wait
          publish(fail ? { phase: 'error', reason: 'cleanup' } : { phase: 'idle' })
        })()
        return stopping
      },
      close() {
        return camera.stop()
      },
      takeFrame() {
        const value = slot
        slot = null
        return value
      },
    }
    const publish = (s: PreparationState) => {
      camera.state = s
      options.onState(s)
    }
    return camera
  })
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const view = (purpose: 'neck' | 'shoulder' | 'torso') => (
  <MemoryRouter>
    <CameraRecommendations purpose={purpose} />
  </MemoryRouter>
)
async function open(purpose: 'neck' | 'shoulder' = 'neck') {
  const ui = render(view(purpose))
  expect(starts).toBe(0)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '카메라 확인' })))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '입력 확인' })))
  return ui
}
function tick(occluded = false) {
  now += 10
  slot = {
    generation: 7,
    sequence: ++sequence,
    at: now,
    result: {
      landmarks: [
        Array.from({ length: 33 }, (_, i) => ({
          x: 0.5,
          y: 0.5,
          z: 0,
          visibility: occluded && i === 7 ? 0 : 1,
        })),
      ],
      worldLandmarks: [],
    },
  }
  act(() => {
    const batch = [...raf.values()]
    raf.clear()
    for (const fn of batch) fn(now)
  })
}
it('explicit observed confirmation waits for cleanup then shows visual candidates and safe local guidance', async () => {
  await open('shoulder')
  tick()
  let release!: () => void
  wait = new Promise<void>((done) => {
    release = done
  })
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '촬영 조건으로 후보 보기' })),
  )
  expect(screen.queryByRole('heading', { name: '촬영 조건이 맞는 후보' })).toBeNull()
  await act(async () => release())
  const heading = screen.getByRole('heading', { name: '촬영 조건이 맞는 후보' })
  expect(document.activeElement).toBe(heading)
  expect(screen.getByRole('heading', { name: '어깨 으쓱·이완' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: '팔 위로 뻗기' })).toBeTruthy()
  expect(screen.getByRole('link', { name: '팔 위로 뻗기 안내 보기' }).getAttribute('href')).toBe(
    '/dev/select?region=shoulder&motion=arm-overhead',
  )
  fireEvent.change(screen.getByLabelText('후보 미리보기 형태'), { target: { value: 'female' } })
  expect(screen.getByLabelText('어깨 으쓱·이완 동작 영상').getAttribute('src')).toContain(
    '/female/',
  )
  expect(screen.queryByText('기준 저장')).toBeNull()
  expect(fetcher).not.toHaveBeenCalled()
  expect(stops).toBe(1)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '촬영 다시 확인' })))
  await act(async () => {})
  expect(screen.queryByRole('heading', { name: '촬영 조건이 맞는 후보' })).toBeNull()
  expect(screen.getByRole('button', { name: '카메라 확인' })).toBeTruthy()
  expect(starts).toBe(1)
})
it('occlusion and expiry never enable an old candidate snapshot', async () => {
  await open()
  tick(true)
  expect(
    screen.getByRole('button', { name: '촬영 조건으로 후보 보기' }).hasAttribute('disabled'),
  ).toBe(true)
  tick()
  now += 1000
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '촬영 조건으로 후보 보기' })),
  )
  expect(screen.queryByRole('heading', { name: '촬영 조건이 맞는 후보' })).toBeNull()
  expect(stops).toBe(0)
})
it('pagehide during teardown cannot publish the late snapshot', async () => {
  await open()
  tick()
  let release!: () => void
  wait = new Promise<void>((done) => {
    release = done
  })
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '촬영 조건으로 후보 보기' })),
  )
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  await act(async () => release())
  expect(screen.queryByRole('heading', { name: '촬영 조건이 맞는 후보' })).toBeNull()
})
it('auth replacement or purpose change removes old candidates and never starts a new camera', async () => {
  const ui = await open()
  tick()
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '촬영 조건으로 후보 보기' })),
  )
  expect(screen.getByRole('heading', { name: '촬영 조건이 맞는 후보' })).toBeTruthy()
  account.state = { ...account.state }
  ui.rerender(view('neck'))
  await act(async () => {})
  expect(screen.queryByRole('heading', { name: '촬영 조건이 맞는 후보' })).toBeNull()
  ui.rerender(view('torso'))
  await act(async () => {})
  expect(screen.queryByRole('button', { name: '카메라 확인' })).toBeNull()
  expect(screen.getByRole('link', { name: '직접 선택에서 모두 보기' }).getAttribute('href')).toBe(
    '/dev/select?region=torso',
  )
  expect(starts).toBe(1)
})
it('reported cleanup failure never publishes or permits another native start', async () => {
  await open()
  tick()
  fail = true
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: '촬영 조건으로 후보 보기' })),
  )
  expect(screen.queryByRole('heading', { name: '촬영 조건이 맞는 후보' })).toBeNull()
  expect(screen.getByRole('button', { name: '다시 확인' }).hasAttribute('disabled')).toBe(true)
  expect(fetcher).not.toHaveBeenCalled()
})
