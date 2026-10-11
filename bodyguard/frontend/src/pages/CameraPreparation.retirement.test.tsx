// @vitest-environment happy-dom
// FR-M-07·FR-U-04/NFR-08: synthetic retirement barrier across authority and route owners.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ReadyAccount } from '../auth'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'
import { CameraPreparation } from './CameraPreparation'

const authority = vi.hoisted(() => ({
  account: { status: 'ready', user: { id: 'fixture', email: 'fixture@example.com' } },
}))
vi.mock('../auth', () => ({ useAuth: () => ({ state: authority.account }) }))
vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
const owners: Array<{
  state: PreparationState
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  notify(next: PreparationState): void
}> = []
vi.mocked(createCameraPreparation).mockImplementation((options) => {
  const owner = {
    state: { phase: 'idle' } as PreparationState,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    notify(next: PreparationState) {
      owner.state = next
      options.onState(next)
    },
  }
  owners.push(owner)
  return owner
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  owners.length = 0
  vi.mocked(createCameraPreparation).mockClear()
})
function account() {
  authority.account = {
    status: 'ready',
    user: { id: 'fixture', email: 'fixture@example.com' },
  } satisfies ReadyAccount
}
function holdClose() {
  const previous = owners.at(-1)
  if (!previous) throw new Error('Fixture owner required')
  let finish!: () => void
  previous.close.mockImplementationOnce(
    () =>
      new Promise<void>((yes) => {
        finish = yes
      }),
  )
  return { previous, finish: () => finish() }
}
it('a new ready identity waits for old cleanup even with the same user id', async () => {
  account()
  const view = render(<CameraPreparation />)
  const held = holdClose()
  account()
  view.rerender(<CameraPreparation />)
  expect(screen.getByRole('button', { name: '정리 중' }).hasAttribute('disabled')).toBe(true)
  expect(createCameraPreparation).toHaveBeenCalledTimes(1)
  await act(async () => {
    held.finish()
  })
  expect(createCameraPreparation).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: '카메라 확인' }))
  expect(owners[1].start).toHaveBeenCalledTimes(1)
  act(() => held.previous.notify({ phase: 'ready' }))
  expect(screen.queryByRole('button', { name: '카메라 끄기' })).toBeNull()
})
it('route remount cannot bypass a pending old permission/SDK retirement', async () => {
  account()
  const view = render(<CameraPreparation />)
  const held = holdClose()
  view.unmount()
  render(<CameraPreparation />)
  expect(screen.getByRole('button', { name: '정리 중' }).hasAttribute('disabled')).toBe(true)
  expect(createCameraPreparation).toHaveBeenCalledTimes(1)
  await act(async () => {
    held.finish()
  })
  expect(createCameraPreparation).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: '카메라 확인' }).hasAttribute('disabled')).toBe(false)
})
it('retires an in-place changed account id before a new camera owner', async () => {
  account()
  const view = render(<CameraPreparation />)
  const held = holdClose()
  authority.account.user.id = 'replacement'
  view.rerender(<CameraPreparation />)
  expect(screen.getByRole('button', { name: '정리 중' }).hasAttribute('disabled')).toBe(true)
  expect(createCameraPreparation).toHaveBeenCalledTimes(1)
  await act(async () => {
    held.finish()
  })
  expect(createCameraPreparation).toHaveBeenCalledTimes(2)
})
it('failed retirement stays blocked across subsequent authority and route owners', async () => {
  account()
  const view = render(<CameraPreparation />)
  const previous = owners.at(-1)
  if (!previous) throw new Error('Fixture owner required')
  previous.close.mockImplementationOnce(async () => {
    previous.state = { phase: 'error', reason: 'cleanup' }
  })
  view.unmount()
  const next = render(<CameraPreparation />)
  await act(async () => {})
  expect(screen.getByRole('alert').textContent).toContain('카메라 정리를 확인하지 못했습니다')
  expect(screen.getByRole('button', { name: '다시 확인' }).hasAttribute('disabled')).toBe(true)
  expect(createCameraPreparation).toHaveBeenCalledTimes(1)
  account()
  next.rerender(<CameraPreparation />)
  expect(createCameraPreparation).toHaveBeenCalledTimes(1)
})
