// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useMeasurement } from '../pose/useMeasurement'
import { MeasureDemoPage } from './MeasureDemoPage'

vi.mock('../avatar/Skeleton3D', () => ({ Skeleton3D: () => null }))
vi.mock('../pose/useMeasurement', () => ({ useMeasurement: vi.fn() }))

// FR-M-02·FR-M-07: 가시성 충족을 성공으로 기록하거나 원시 좌표를 저장하지 않는다.
it('상반신 프레임은 머리·어깨 범위만 충족하며 전신·미검출 기록은 촬영 안내를 남긴다', () => {
  const noop = vi.fn()
  const measurement: ReturnType<typeof useMeasurement> = {
    status: 'running',
    error: null,
    stats: {
      fps: 30,
      inferenceMs: 10,
      handMs: null,
      faceMs: null,
      detected: true,
      confidence: 0.9,
      delegate: 'CPU',
      hint: null,
      gesture: null,
    },
    fpsLimit: 30,
    setFpsLimit: noop,
    framingMode: 'seated',
    setFramingMode: noop,
    model: 'full',
    setModel: noop,
    handsEnabled: false,
    setHandsEnabled: noop,
    faceEnabled: false,
    setFaceEnabled: noop,
    start: noop,
    stop: noop,
    poseRef: {
      current: {
        image: Array.from({ length: 33 }, (_, i) => ({
          x: 0.481234,
          y: i >= 23 ? 1.3 : 0.5,
          z: 0,
          visibility: 0.9,
        })),
        world: null,
        hands: [],
        face: null,
      },
    },
  }
  vi.mocked(useMeasurement).mockReturnValue(measurement)
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  const view = render(<MeasureDemoPage />)
  const panel = within(screen.getByRole('region', { name: '동작 촬영 검증' }))
  const record = panel.getByRole('button', { name: '현재 프레임 기록' })
  fireEvent.click(record)
  expect(panel.getByRole('listitem').textContent).toContain('머리·어깨: 필수 관절 5/5')
  expect(panel.getByRole('listitem').textContent).toContain('동작 성공 아님')

  measurement.framingMode = 'standing'
  view.rerender(<MeasureDemoPage />)
  fireEvent.click(record)
  expect(panel.getAllByRole('listitem')[1].textContent).toContain('전신: 필수 관절 3/9')
  expect(panel.getAllByRole('listitem')[1].textContent).toContain('한 걸음 뒤로')

  measurement.poseRef.current.image = null
  fireEvent.click(record)
  expect(panel.getAllByRole('listitem')[2].textContent).toContain('0/9')
  expect(panel.getAllByRole('listitem')[2].textContent).toContain('카메라 앞에 서 주세요')
  expect(screen.getByRole('region', { name: '동작 촬영 검증' }).textContent).not.toContain(
    '0.481234',
  )
  expect(storage).not.toHaveBeenCalled()
  fireEvent.click(panel.getByRole('button', { name: '기록 지우기' }))
  expect(panel.queryAllByRole('listitem')).toHaveLength(0)
  storage.mockRestore()
})
