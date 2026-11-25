// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { preferredCamera, setPreferredCamera } from '../pose/cameraSource'
import { CameraSourceSelect } from './CameraSourceSelect'

const device = (deviceId: string, label = '') =>
  ({ kind: 'videoinput', deviceId, label, groupId: '' }) as MediaDeviceInfo
let devices: MediaDeviceInfo[] = []
let changed: (() => void) | undefined

beforeEach(() => {
  devices = []
  changed = undefined
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(),
      enumerateDevices: vi.fn(async () => devices),
      addEventListener: vi.fn((_: string, listener: () => void) => {
        changed = listener
      }),
      removeEventListener: vi.fn(),
    },
  })
})
afterEach(() => {
  cleanup()
  setPreferredCamera(null)
  vi.unstubAllGlobals()
})

it('chooses a camera without opening one', async () => {
  devices = [device('built-in', 'FaceTime HD Camera'), device('phone', 'iPhone Camera')]
  const onChange = vi.fn()
  render(<CameraSourceSelect onChange={onChange} />)
  const select = screen.getByRole('combobox', { name: '카메라' }) as HTMLSelectElement
  await screen.findByRole('option', { name: 'FaceTime HD Camera' })
  expect(select.value).toBe('')
  expect(screen.queryByText('카메라를 한 번 켜면 기기 이름이 표시됩니다.')).toBeNull()
  fireEvent.change(select, { target: { value: 'built-in' } })
  expect(preferredCamera()).toBe('built-in')
  expect(onChange).toHaveBeenCalledWith('built-in')
  fireEvent.change(select, { target: { value: '' } })
  expect(preferredCamera()).toBeNull()
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
})

it('explains an empty list before camera permission', async () => {
  devices = [device('')]
  render(<CameraSourceSelect />)
  await screen.findByText('카메라를 한 번 켜면 기기 이름이 표시됩니다.')
  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['기본 카메라'])
})

it('numbers unnamed cameras and says names appear after the first start', async () => {
  devices = [device('a'), device('b')]
  render(<CameraSourceSelect />)
  await screen.findByRole('option', { name: '카메라 2' })
  expect(screen.getByText('카메라를 한 번 켜면 기기 이름이 표시됩니다.')).toBeTruthy()
})

it('shows the default again when the chosen camera is unplugged', async () => {
  devices = [device('phone', 'iPhone Camera')]
  setPreferredCamera('phone')
  render(<CameraSourceSelect />)
  const select = screen.getByRole('combobox', { name: '카메라' }) as HTMLSelectElement
  await screen.findByRole('option', { name: 'iPhone Camera' })
  expect(select.value).toBe('phone')
  devices = []
  await act(async () => changed?.())
  expect(screen.queryByRole('option', { name: 'iPhone Camera' })).toBeNull()
  expect(select.value).toBe('')
})
