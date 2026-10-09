// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { useMeasurement } from '../pose/useMeasurement'
import { MeasureDemoPage } from './MeasureDemoPage'

vi.mock('../avatar/Skeleton3D', () => ({ Skeleton3D: () => null }))
vi.mock('../pose/useMeasurement', () => ({ useMeasurement: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function measurementFixture(): ReturnType<typeof useMeasurement> {
  const noop = vi.fn()
  return {
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
    start: vi.fn(),
    stop: vi.fn(),
    poseRef: {
      current: {
        sampledAt: performance.now(),
        personCount: 1,
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
}

// FR-M-02·FR-M-07: 가시성 충족을 성공으로 기록하거나 원시 좌표를 저장하지 않는다.
it('상반신 프레임은 머리·어깨 범위만 충족하며 전신·미검출 기록은 촬영 안내를 남긴다', () => {
  const measurement = measurementFixture()
  vi.mocked(useMeasurement).mockReturnValue(measurement)
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  const view = render(<MeasureDemoPage />, { wrapper: MemoryRouter })
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
  measurement.poseRef.current.personCount = 0
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

it('첫 프레임 전·오래된 프레임·복수 포즈를 촬영 범위 충족으로 기록하지 않는다', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  const measurement = measurementFixture()
  vi.mocked(useMeasurement).mockReturnValue(measurement)
  render(<MeasureDemoPage />, { wrapper: MemoryRouter })
  const panel = within(screen.getByRole('region', { name: '동작 촬영 검증' }))
  const record = panel.getByRole('button', { name: '현재 프레임 기록' })
  clock.mockReturnValue(2001)
  fireEvent.click(record)
  measurement.poseRef.current.sampledAt = null
  fireEvent.click(record)
  measurement.poseRef.current.sampledAt = 3000 // 미래 시각도 거부
  fireEvent.click(record)
  measurement.poseRef.current.sampledAt = 2001
  measurement.poseRef.current.personCount = 2
  fireEvent.click(record)
  const rows = panel.getAllByRole('listitem')
  for (const row of rows) {
    expect(row.textContent).toContain('0/5')
    expect(row.textContent).not.toContain('촬영 범위 충족 (동작 성공 아님)')
  }
  expect(rows[0].textContent).toContain('새 프레임 대기')
  expect(rows[3].textContent).toContain('복수 포즈')
})

it('최신 100개만 남기고 준비 중에도 취소할 수 있다', () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  const measurement = measurementFixture()
  vi.mocked(useMeasurement).mockReturnValue(measurement)
  const view = render(<MeasureDemoPage />, { wrapper: MemoryRouter })
  const panel = within(screen.getByRole('region', { name: '동작 촬영 검증' }))
  const record = panel.getByRole('button', { name: '현재 프레임 기록' })
  for (let i = 0; i < 101; i++) fireEvent.click(record)
  expect(panel.getAllByRole('listitem')).toHaveLength(100)
  measurement.status = 'starting'
  view.rerender(<MeasureDemoPage />)
  fireEvent.click(screen.getByRole('button', { name: '준비 취소' }))
  expect(measurement.stop).toHaveBeenCalledTimes(1)
  expect(measurement.start).not.toHaveBeenCalled()
  expect(record.hasAttribute('disabled')).toBe(true)
})

it('관찰자 라벨을 한 번만 사용하고 새 촬영 프레임을 튜닝과 분리한다', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  const measurement = measurementFixture()
  vi.mocked(useMeasurement).mockReturnValue(measurement)
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  render(<MeasureDemoPage />, { wrapper: MemoryRouter })
  const panel = within(screen.getByRole('region', { name: '동작 촬영 검증' }))
  const record = panel.getByRole('button', { name: '현재 프레임 기록' })
  const observer = panel.getByRole('combobox', { name: '관찰자 판단' })
  const begin = panel.getByRole('button', { name: '튜닝 마치고 검증 시작' })
  expect(begin.hasAttribute('disabled')).toBe(true)
  fireEvent.change(observer, { target: { value: 'insufficient' } })
  fireEvent.click(record)
  expect(panel.getByRole('listitem').textContent).toContain(
    '관찰자: 필수 부위 부족 / 인식: 필수 부위 충분 · 불일치',
  )
  expect((observer as HTMLSelectElement).value).toBe('unrated')
  expect(begin.hasAttribute('disabled')).toBe(true)
  fireEvent.click(panel.getByRole('checkbox', { name: '튜닝에 쓰지 않은 촬영 조건' }))
  expect(begin.hasAttribute('disabled')).toBe(false)
  clock.mockReturnValue(1100)
  fireEvent.click(begin)
  expect(document.activeElement).toBe(observer)
  expect(panel.getByText(/별도 검증 · 설정 동결/).textContent).toContain(
    '튜닝 대조 0 일치 / 1 불일치 / 1 범위 과인식',
  )
  fireEvent.click(record)
  expect(panel.getByRole('status').textContent).toContain('관찰자 판단을 먼저')
  fireEvent.change(observer, { target: { value: 'sufficient' } })
  fireEvent.click(record)
  expect(panel.getByRole('status').textContent).toContain('검증 시작 뒤 새 프레임')
  expect(panel.getAllByRole('listitem')).toHaveLength(1)
  clock.mockReturnValue(1200)
  measurement.poseRef.current.sampledAt = 1200
  fireEvent.click(record)
  expect(panel.getAllByRole('listitem')[1].textContent).toContain(
    '검증 · 관찰자: 필수 부위 충분 / 인식: 필수 부위 충분 · 일치',
  )
  fireEvent.change(observer, { target: { value: 'sufficient' } })
  fireEvent.click(record)
  expect(panel.getByRole('status').textContent).toContain('이미 사용한 프레임')
  expect(panel.getAllByRole('listitem')).toHaveLength(2)
  expect(storage).not.toHaveBeenCalled()
  expect(screen.getByRole('region', { name: '동작 촬영 검증' }).textContent).not.toContain(
    '0.481234',
  )
})

it('검증 설정 변경·복원은 기록을 보존하면서 지우기 전 차단한다', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  const measurement = measurementFixture()
  vi.mocked(useMeasurement).mockReturnValue(measurement)
  const view = render(<MeasureDemoPage />, { wrapper: MemoryRouter })
  const panel = within(screen.getByRole('region', { name: '동작 촬영 검증' }))
  const record = panel.getByRole('button', { name: '현재 프레임 기록' })
  fireEvent.change(panel.getByRole('combobox', { name: '관찰자 판단' }), {
    target: { value: 'sufficient' },
  })
  fireEvent.click(record)
  fireEvent.click(panel.getByRole('checkbox', { name: '튜닝에 쓰지 않은 촬영 조건' }))
  clock.mockReturnValue(1100)
  fireEvent.click(panel.getByRole('button', { name: '튜닝 마치고 검증 시작' }))
  measurement.framingMode = 'standing'
  view.rerender(<MeasureDemoPage />)
  expect(record.hasAttribute('disabled')).toBe(true)
  expect(panel.getByRole('status').textContent).toContain('설정이 바뀌었습니다')
  measurement.framingMode = 'seated'
  view.rerender(<MeasureDemoPage />)
  expect(record.hasAttribute('disabled')).toBe(true)
  expect(panel.getAllByRole('listitem')).toHaveLength(1)
  fireEvent.click(panel.getByRole('button', { name: '기록 지우기' }))
  expect(document.activeElement).toBe(panel.getByRole('combobox', { name: '관찰자 판단' }))
  expect(record.hasAttribute('disabled')).toBe(false)
  expect(panel.queryAllByRole('listitem')).toHaveLength(0)
  expect(
    (panel.getByRole('checkbox', { name: '튜닝에 쓰지 않은 촬영 조건' }) as HTMLInputElement)
      .checked,
  ).toBe(false)
})

it('비교 불가 라벨은 보류하고 필수 관절 입력이 깨져도 화면이 실패하지 않는다', () => {
  vi.spyOn(performance, 'now').mockReturnValue(1000)
  const measurement = measurementFixture()
  const image = measurement.poseRef.current.image
  if (!image) throw new Error('Missing synthetic test input')
  image[11].x = Number.NaN
  vi.mocked(useMeasurement).mockReturnValue(measurement)
  render(<MeasureDemoPage />, { wrapper: MemoryRouter })
  const panel = within(screen.getByRole('region', { name: '동작 촬영 검증' }))
  fireEvent.change(panel.getByRole('combobox', { name: '관찰자 판단' }), {
    target: { value: 'sufficient' },
  })
  fireEvent.click(panel.getByRole('button', { name: '현재 프레임 기록' }))
  expect(panel.getByRole('listitem').textContent).toContain('대조 보류')
  expect(panel.getByRole('listitem').textContent).not.toContain(' · 일치')
  expect(
    panel.getByRole('button', { name: '튜닝 마치고 검증 시작' }).hasAttribute('disabled'),
  ).toBe(true)
})
