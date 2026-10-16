// @vitest-environment happy-dom
// FR-A-01/03·FR-U-04: same-slot DOM lifecycle; synthetic ports, not camera/body accuracy.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import { prepareWorkspaceAvatar, type WorkspaceAvatar } from '../avatar/workspaceAvatar'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'
import { CameraPreparation } from './CameraPreparation'

vi.mock('../avatar/workspaceAvatar', () => ({ prepareWorkspaceAvatar: vi.fn() }))
vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
const account = vi.hoisted(() => ({
  status: 'ready',
  user: { id: 'fixture', email: 'fixture@example.com' },
}))
vi.mock('../auth', () => ({ useAuth: () => ({ state: account }) }))

function fixture(held = false) {
  const ticks = new Map<number, FrameRequestCallback>()
  let id = 0,
    frame: PoseRigFrame | null = null
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      ticks.set(++id, cb)
      return id
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((key: number) => ticks.delete(key)),
  )
  let notify!: (state: PreparationState) => void
  const camera = {
    state: { phase: 'idle' } as PreparationState,
    start: vi.fn(async () => notify({ phase: 'ready' })),
    observe: vi.fn(() => notify({ phase: 'observing' })),
    stop: vi.fn(async () => {
      notify({ phase: 'stopping' })
      notify({ phase: 'idle' })
    }),
    close: vi.fn(async () => {}),
    takeFrame: vi.fn(() => {
      const value = frame
      frame = null
      return value
    }),
  }
  vi.mocked(createCameraPreparation).mockImplementation((options) => {
    notify = (state) => {
      camera.state = state
      options.onState(state)
    }
    return camera
  })
  const view = { observe: vi.fn(() => true), render: vi.fn(), dispose: vi.fn() }
  let resolve!: (v: WorkspaceAvatar) => void
  vi.mocked(prepareWorkspaceAvatar).mockImplementation(() =>
    held
      ? new Promise((yes) => {
          resolve = yes
        })
      : Promise.resolve(view),
  )
  const canvas = createRef<HTMLCanvasElement>(),
    states: string[] = []
  const component = (display: 'full' | 'upper' = 'full', gender: 'male' | 'female' = 'male') => (
    <>
      <canvas ref={canvas} />
      <CameraPreparation
        avatar={{ canvas, gender, view: display, onState: (s) => states.push(s) }}
      />
    </>
  )
  const result = render(component())
  return {
    camera,
    view,
    states,
    component,
    result,
    tick: async (input: PoseRigFrame | null = null) => {
      frame = input
      await act(async () => {
        const reservation = ticks.entries().next().value
        if (reservation) {
          ticks.delete(reservation[0])
          reservation[1](performance.now())
        }
      })
    },
    finish: async () => {
      await act(async () => resolve(view))
    },
    open: async () => {
      fireEvent.click(screen.getByRole('button', { name: '카메라 확인' }))
      await act(async () => {})
      fireEvent.click(screen.getByRole('button', { name: '입력 확인' }))
    },
  }
}
const observation = (sequence: number): PoseRigFrame => ({
  generation: 7,
  sequence,
  at: performance.now(),
  result: {
    landmarks: [Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }))],
    worldLandmarks: [Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }))],
  },
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('empty detector results keep the model waiting without GLB loading or invented motion', async () => {
  const f = fixture()
  await f.open()
  await f.tick({
    generation: 7,
    sequence: 1,
    at: performance.now(),
    result: { landmarks: [], worldLandmarks: [] },
  })
  expect(prepareWorkspaceAvatar).not.toHaveBeenCalled()
  expect(f.states).toContain('waiting')
})

it('prepares only after explicit observation and forwards the next same-stamp frame once', async () => {
  const f = fixture()
  expect(prepareWorkspaceAvatar).not.toHaveBeenCalled()
  await f.open()
  expect(prepareWorkspaceAvatar).not.toHaveBeenCalled()
  await f.tick(observation(1))
  expect(prepareWorkspaceAvatar).toHaveBeenCalledTimes(1)
  expect(vi.mocked(prepareWorkspaceAvatar).mock.calls[0][0].generation).toBe(7)
  expect(f.view.observe).not.toHaveBeenCalled()
  const next = observation(2)
  await f.tick(next)
  expect(f.view.observe).toHaveBeenCalledExactlyOnceWith(next)
  f.result.rerender(f.component('upper'))
  await f.tick()
  expect(f.view.render).toHaveBeenLastCalledWith(expect.any(Number), expect.any(Number), 'upper')
  expect(createCameraPreparation).toHaveBeenCalledTimes(1)
  expect(f.states).toContain('ready')
})

it('stop during pending model setup waits, disposes late success and never publishes ready', async () => {
  const f = fixture(true)
  await f.open()
  await f.tick(observation(1))
  const context = vi.mocked(prepareWorkspaceAvatar).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: '카메라 끄기' }))
  await act(async () => {})
  expect(context.signal.aborted).toBe(true)
  expect(screen.getByRole('button', { name: '정리 중' }).hasAttribute('disabled')).toBe(true)
  await f.finish()
  expect(f.view.dispose).toHaveBeenCalledTimes(1)
  expect(f.states).not.toContain('ready')
  expect(screen.getByRole('button', { name: '카메라 확인' })).toBeDefined()
})

it('gender change retires both display and camera instead of silently carrying observations across', async () => {
  const f = fixture()
  await f.open()
  await f.tick(observation(1))
  f.result.rerender(f.component('full', 'female'))
  await act(async () => {})
  expect(f.view.dispose).toHaveBeenCalledTimes(1)
  expect(f.camera.close).toHaveBeenCalledTimes(1)
  expect(prepareWorkspaceAvatar).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: '카메라 확인' })).toBeDefined()
})

it('model/context failure stops capture and does not loop automatic model or camera retries', async () => {
  const f = fixture()
  await f.open()
  await f.tick(observation(1))
  const opts = vi.mocked(prepareWorkspaceAvatar).mock.calls[0][1]
  await act(async () => opts.onFailure())
  expect(f.states).toContain('error')
  expect(f.camera.stop).toHaveBeenCalledTimes(1)
  await f.tick(observation(2))
  expect(prepareWorkspaceAvatar).toHaveBeenCalledTimes(1)
  expect(f.camera.start).toHaveBeenCalledTimes(1)
})
