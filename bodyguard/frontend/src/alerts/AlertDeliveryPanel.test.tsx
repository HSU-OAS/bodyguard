// @vitest-environment happy-dom
// FR-N-04/05/NFR-08: actual React DOM; trigger/permissions only synthetic.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AlertDeliveryPanel } from './AlertDeliveryPanel'
import { createAlertDelivery } from './delivery'

afterEach(cleanup)
function fixture(permission: NotificationPermission | 'unsupported' = 'default') {
  const request = vi.fn(async (): Promise<NotificationPermission> => 'denied')
  const onChoose = vi.fn()
  const delivery = createAlertDelivery({
    port: {
      permission: () => permission,
      requestPermission: request,
      show: vi.fn(() => ({ close: vi.fn() })),
    },
    enabled: { posture: true, sitting: true },
    isCurrent: () => true,
    onChoose,
  })
  render(<AlertDeliveryPanel delivery={delivery} />)
  return { delivery, request, onChoose }
}
it('D05 initial panel is named, inert and has one atomic status', () => {
  const f = fixture()
  expect(screen.getByRole('region', { name: '스트레칭 알림' })).toBeTruthy()
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status').getAttribute('aria-atomic')).toBe('true')
  expect(f.request).not.toHaveBeenCalled()
})
it('D05 arriving alerts do not steal focus and each has labelled actions', () => {
  const f = fixture()
  const button = screen.getByRole('button', { name: '브라우저 알림 허용 요청' })
  button.focus()
  act(() => {
    f.delivery.receive('posture')
    f.delivery.receive('sitting')
  })
  expect(document.activeElement).toBe(button)
  expect(screen.getByRole('status').textContent).toContain('2개')
  expect(screen.getByRole('group', { name: '자세 스트레칭 안내' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '자세 안내 닫기' })).toBeTruthy()
})
it('D05 explicit request resolves denied but still renders screen alerts', async () => {
  const f = fixture()
  act(() => f.delivery.receive('posture'))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '브라우저 알림 허용 요청' }))
  })
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/다른 창에서는 알림이 보이지/)).toBeTruthy()
  expect(screen.getByRole('group', { name: '자세 스트레칭 안내' })).toBeTruthy()
})
it('D05 dismissal has no completion/selection side effect and choose calls only a current kind', () => {
  const f = fixture('denied')
  act(() => {
    f.delivery.receive('posture')
    f.delivery.receive('sitting')
  })
  fireEvent.click(screen.getByRole('button', { name: '자세 안내 닫기' }))
  expect(f.onChoose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '장시간 안내 스트레칭 살펴보기' }))
  expect(f.onChoose).toHaveBeenCalledExactlyOnceWith('sitting')
  expect(screen.queryByRole('group', { name: '자세 스트레칭 안내' })).toBeNull()
  expect(screen.queryByRole('group', { name: '장시간 사용 안내' })).toBeNull()
  expect(screen.queryByText(/운동 완료|저장했습니다/)).toBeNull()
})
it('D05 unsupported browser keeps the screen and does not offer an unusable permission request', () => {
  const f = fixture('unsupported')
  act(() => f.delivery.receive('sitting'))
  expect(screen.getByText(/화면 안내만 지원/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '브라우저 알림 허용 요청' })).toBeNull()
})
it('D05 pending request has immediate feedback and is disabled', async () => {
  const f = fixture()
  let resolve!: (p: NotificationPermission) => void
  f.request.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  fireEvent.click(screen.getByRole('button', { name: '브라우저 알림 허용 요청' }))
  expect(
    (screen.getByRole('button', { name: '권한 확인 중…' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  await act(async () => resolve('denied'))
})
it('D05 authority disposal removes alerts/controls and unsubscribes when the panel unmounts', () => {
  const f = fixture()
  act(() => f.delivery.receive('posture'))
  act(() => f.delivery.dispose())
  expect(screen.queryByRole('region')).toBeNull()
  expect(f.onChoose).not.toHaveBeenCalled()
})
it('D05 keyboard dismissal restores focus to the remaining alert action', () => {
  const f = fixture('denied')
  act(() => {
    f.delivery.receive('posture')
    f.delivery.receive('sitting')
  })
  const dismiss = screen.getByRole('button', { name: '자세 안내 닫기' })
  dismiss.focus()
  fireEvent.click(dismiss)
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: '장시간 안내 스트레칭 살펴보기' }),
  )
})
it('D05 dismissal of the last alert restores focus to its named heading', () => {
  const f = fixture('denied')
  act(() => f.delivery.receive('posture'))
  const dismiss = screen.getByRole('button', { name: '자세 안내 닫기' })
  dismiss.focus()
  fireEvent.click(dismiss)
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: '스트레칭 알림' }))
})
it('D05 a selection callback that stays on this page restores focus after removal', () => {
  const f = fixture('denied')
  act(() => f.delivery.receive('posture'))
  const choose = screen.getByRole('button', { name: '자세 안내 스트레칭 살펴보기' })
  choose.focus()
  fireEvent.click(choose)
  expect(f.onChoose).toHaveBeenCalledExactlyOnceWith('posture')
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: '스트레칭 알림' }))
})
it('D05 a failed selection never schedules focus movement on a later arrival', () => {
  const f = fixture('denied')
  act(() => f.delivery.receive('posture'))
  f.onChoose.mockImplementationOnce(() => {
    throw new Error('PRIVATE')
  })
  const choose = screen.getByRole('button', { name: '자세 안내 스트레칭 살펴보기' })
  choose.focus()
  fireEvent.click(choose)
  const refresh = screen.getByRole('button', { name: '권한 다시 확인' })
  refresh.focus()
  act(() => f.delivery.receive('sitting'))
  expect(document.activeElement).toBe(refresh)
})
