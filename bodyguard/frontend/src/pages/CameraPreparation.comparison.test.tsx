// @vitest-environment happy-dom
// FR-A-01/03·NFR-08: controlled same-slot ports, not actual SDK/person evidence.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import type { ReferenceStage } from '../avatar/referenceStage'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'
import { CameraPreparation } from './CameraPreparation'

vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
vi.mock('../auth', () => {
  const state = { status: 'ready', user: { id: 'fixture', email: 'fixture@example.com' } }
  return { useAuth: () => ({ state }) }
})
const baseline = vi.hoisted(() => ({
  saving: 'idle',
  accept: vi.fn(),
  tick: vi.fn(),
  reset: vi.fn(),
  state: { phase: 'idle' },
  begin: vi.fn(),
  cancel: vi.fn(),
}))
vi.mock('./useCameraReference', () => ({ useCameraReference: () => baseline }))
function stage() {
  return {
    beginObservation: vi.fn(() => true),
    observe: vi.fn(() => true),
    updateFeedback: vi.fn(() => false),
    getObservationCoverage: vi.fn(() => null),
    suspendObservation: vi.fn(),
    alignObservation: vi.fn(() => true),
    render: vi.fn(),
    dispose: vi.fn(),
  }
}
function setup() {
  const frames = new Map<number, FrameRequestCallback>()
  let next = 0,
    input: PoseRigFrame | null = null
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    frames.set(++next, fn)
    return next
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  let publish!: (next: PreparationState) => void
  const camera = {
    state: { phase: 'idle' } as PreparationState,
    start: vi.fn(async () => publish({ phase: 'ready' })),
    observe: vi.fn(() => publish({ phase: 'observing' })),
    stop: vi.fn(async () => publish({ phase: 'idle' })),
    close: vi.fn(async () => {}),
    takeFrame: vi.fn(() => {
      const f = input
      input = null
      return f
    }),
  }
  vi.mocked(createCameraPreparation).mockImplementation((options) => {
    publish = (state) => {
      camera.state = state
      options.onState(state)
    }
    return camera
  })
  const comparison = createRef<ReferenceStage>(),
    view = stage()
  comparison.current = view
  const result = render(<CameraPreparation comparison={comparison} />)
  return {
    camera,
    comparison,
    view,
    result,
    publish,
    open: async () => {
      fireEvent.click(screen.getByRole('button', { name: '카메라 확인' }))
      await act(async () => {})
      fireEvent.click(screen.getByRole('button', { name: '입력 확인' }))
    },
    tick: (frame: PoseRigFrame | null = null) => {
      input = frame
      act(() => {
        const batch = [...frames.values()]
        frames.clear()
        for (const fn of batch) fn(performance.now())
      })
    },
  }
}
const frame = (generation = 7): PoseRigFrame => ({
  generation,
  sequence: 1,
  at: performance.now(),
  result: { landmarks: [], worldLandmarks: [] },
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
it('fans out the exact current slot once without changing stamps or starting more capture', async () => {
  const f = setup()
  await f.open()
  const input = frame()
  f.tick(input)
  expect(f.camera.takeFrame).toHaveBeenCalledTimes(1)
  expect(f.view.beginObservation).toHaveBeenCalledExactlyOnceWith(7)
  expect(f.view.observe).toHaveBeenCalledExactlyOnceWith(input)
  expect(baseline.accept).toHaveBeenCalledWith(input, expect.any(Number))
  expect(f.camera.start).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: '움직임 맞추기' }))
  expect(f.view.alignObservation).toHaveBeenCalledTimes(1)
  f.tick()
  expect(f.view.observe).toHaveBeenCalledTimes(1)
})
it('retires the old stage and binds a fresh generation after explicit camera restart', async () => {
  const f = setup()
  await f.open()
  f.tick(frame())
  fireEvent.click(screen.getByRole('button', { name: '카메라 끄기' }))
  await act(async () => {})
  expect(f.view.suspendObservation).toHaveBeenCalledTimes(1)
  const fresh = stage()
  f.comparison.current = fresh
  await f.open()
  f.tick(frame(8))
  expect(fresh.beginObservation).toHaveBeenCalledWith(8)
  expect(f.view.observe).toHaveBeenCalledTimes(1)
  f.result.unmount()
  expect(fresh.suspendObservation).toHaveBeenCalledTimes(1)
  expect(f.camera.close).toHaveBeenCalledTimes(1)
})
it('clears a detached preview without restarting the camera or retaining a frame', async () => {
  const f = setup()
  await f.open()
  f.tick(frame())
  f.comparison.current = null
  f.tick()
  expect(f.view.suspendObservation).toHaveBeenCalledTimes(1)
  expect(f.camera.start).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: '움직임 맞추기' }).hasAttribute('disabled')).toBe(true)
})

// Last case poisons this module's ownership barrier; only page reload may reacquire.
it('still closes the camera when display suspension throws and refuses uncertain reuse', async () => {
  const f = setup()
  await f.open()
  f.tick(frame())
  f.view.suspendObservation.mockImplementation(() => {
    throw new Error('PRIVATE_DISPLAY')
  })
  f.comparison.current = null
  f.tick()
  await act(async () => {})
  expect(f.camera.stop).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('alert').textContent).toContain('카메라 정리를 확인하지 못했습니다')
  expect(screen.getByRole('button', { name: '다시 확인' }).hasAttribute('disabled')).toBe(true)
  f.result.unmount()
  expect(f.camera.close).toHaveBeenCalledTimes(1)
})
