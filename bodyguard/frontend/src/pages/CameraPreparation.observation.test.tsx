// @vitest-environment happy-dom
// FR-M-01/02/07·FR-U-04: controlled preparation states, real React control interaction.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createCameraPreparation, type PreparationState } from '../pose/cameraPreparation'
import { CameraPreparation } from './CameraPreparation'

vi.mock('../pose/cameraPreparation', () => ({ createCameraPreparation: vi.fn() }))
// Identity must stay stable across the actual component's state rerenders.
const account = vi.hoisted(() => ({
  status: 'ready',
  user: { id: 'fixture', email: 'fixture@example.com' },
}))
vi.mock('../auth', () => ({ useAuth: () => ({ state: account }) }))
function fixture() {
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
  render(<CameraPreparation />)
  return { current, notify: (s: PreparationState) => act(() => notify(s)) }
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
