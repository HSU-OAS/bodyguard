// @vitest-environment happy-dom
// FR-M-01/02/07·FR-U-04: controlled preparation states, real React control interaction.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReferenceStage } from '../avatar/referenceStage'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'
import { CameraPreparation } from './CameraPreparation'

vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
// Identity must stay stable across the actual component's state rerenders.
const account = vi.hoisted(() => ({
  status: 'ready',
  user: { id: 'fixture', email: 'fixture@example.com' },
}))
vi.mock('../auth', () => ({ useAuth: () => ({ state: account }) }))
function fixture(avatarReady = false) {
  const current = {
    state: { phase: 'idle' } as PreparationState,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    observe: vi.fn(),
    takeFrame: () => null,
    close: vi.fn(async () => {}),
  }
  let notify!: (s: PreparationState) => void
  vi.mocked(createCameraPreparation).mockImplementation((options) => {
    notify = (s) => {
      current.state = s
      options.onState(s)
    }
    return current
  })
  const comparison = { current: {} as ReferenceStage }
  const view = render(
    avatarReady ? <CameraPreparation comparison={comparison} avatarReady /> : <CameraPreparation />,
  )
  return { current, view, comparison, notify: (s: PreparationState) => act(() => notify(s)) }
}
afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.clearAllMocks()
})
it('does not start continuous input during preparation and exposes only an explicit ready control', () => {
  const f = fixture()
  expect(screen.queryByRole('button', { name: '입력 확인' })).toBeNull()
  f.notify({ phase: 'preparing' })
  expect(screen.queryByRole('button', { name: '입력 확인' })).toBeNull()
  f.notify({ phase: 'ready' })
  expect(f.current.observe).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '입력 확인' }))
  expect(f.current.observe).toHaveBeenCalledTimes(1)
})
it('connecting/running prevent duplicate input but keep camera-off usable; errors remove input', () => {
  const f = fixture()
  for (const phase of ['connecting', 'observing'] as const) {
    f.notify({ phase })
    expect(screen.getByRole('button', { name: '입력 확인' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '카메라 끄기' }).hasAttribute('disabled')).toBe(false)
  }
  fireEvent.click(screen.getByRole('button', { name: '카메라 끄기' }))
  expect(f.current.stop).toHaveBeenCalledTimes(1)
  f.notify({ phase: 'error', reason: 'frame' })
  expect(screen.queryByRole('button', { name: '입력 확인' })).toBeNull()
  expect(screen.getByRole('button', { name: '다시 확인' }).hasAttribute('disabled')).toBe(false)
  expect(screen.getByRole('alert').textContent).toContain('카메라 입력을 확인하지 못했습니다')
})

it('starts continuous observation only after the explicit connect action becomes ready', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  expect(f.current.start).not.toHaveBeenCalled()
  expect(f.current.observe).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  expect(f.current.start).toHaveBeenCalledTimes(1)
  f.notify({ phase: 'preparing' })
  expect(f.current.observe).not.toHaveBeenCalled()
  f.notify({ phase: 'ready' })
  await act(async () => finish())
  expect(f.current.observe).toHaveBeenCalledTimes(1)
})

it('cancellation during camera preparation blocks late continuous observation', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  f.notify({ phase: 'preparing' })
  fireEvent.click(screen.getByRole('button', { name: '준비 취소' }))
  expect(f.current.stop).toHaveBeenCalledTimes(1)
  f.notify({ phase: 'ready' })
  await act(async () => finish())
  expect(f.current.observe).not.toHaveBeenCalled()
})

it('removed avatar stage cannot trigger a late observation', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  f.notify({ phase: 'preparing' })
  f.comparison.current = null as unknown as ReferenceStage
  f.notify({ phase: 'ready' })
  await act(async () => finish())
  expect(f.current.observe).not.toHaveBeenCalled()
  f.view.unmount()
})

it('unmounted screen cannot trigger a late continuous observation', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  f.notify({ phase: 'preparing' })
  f.view.unmount()
  f.current.state = { phase: 'ready' }
  await act(async () => finish())
  expect(f.current.observe).not.toHaveBeenCalled()
})

it('replaced stage cannot inherit an earlier pending camera request', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  f.notify({ phase: 'preparing' })
  f.comparison.current = {} as ReferenceStage
  f.notify({ phase: 'ready' })
  await act(async () => finish())
  expect(f.current.observe).not.toHaveBeenCalled()
})

it('hidden tab cannot start late observation from an earlier click', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  f.notify({ phase: 'preparing' })
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  fireEvent(document, new Event('visibilitychange'))
  f.notify({ phase: 'ready' })
  await act(async () => finish())
  expect(f.current.observe).not.toHaveBeenCalled()
  visibility.mockRestore()
})

it('account replacement cannot start a prior account camera request', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  f.notify({ phase: 'preparing' })
  try {
    account.user.id = 'replacement'
    f.view.rerender(<CameraPreparation comparison={f.comparison} avatarReady />)
    f.current.state = { phase: 'ready' }
    await act(async () => finish())
    expect(f.current.observe).not.toHaveBeenCalled()
  } finally {
    account.user.id = 'fixture'
  }
})

it('closing the preview during preparation does not start continuous input', async () => {
  const f = fixture(true)
  let finish!: () => void
  f.current.start.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '카메라로 내 움직임 연결' }))
  f.notify({ phase: 'preparing' })
  f.view.rerender(<CameraPreparation comparison={f.comparison} avatarReady={false} />)
  f.notify({ phase: 'ready' })
  await act(async () => finish())
  expect(f.current.observe).not.toHaveBeenCalled()
})
