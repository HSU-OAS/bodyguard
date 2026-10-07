// FR-N-03/04/05: real controller; permission/OS handles only are synthetic.
import { expect, it, vi } from 'vitest'
import { type AlertKind, createAlertDelivery, type NotificationPort } from './delivery'

function fixture(permission: NotificationPermission | 'unsupported' = 'default') {
  let current = true
  let finish!: (p: NotificationPermission) => void
  const handles: Array<{ close: ReturnType<typeof vi.fn>; click(): void; fail(): void }> = []
  const port: NotificationPort = {
    permission: vi.fn(() => permission),
    requestPermission: vi.fn(
      () =>
        new Promise<NotificationPermission>((resolve) => {
          finish = resolve
        }),
    ),
    show: vi.fn((_kind, click, fail) => {
      const h = { close: vi.fn(), click, fail }
      handles.push(h)
      return h
    }),
  }
  const onChoose = vi.fn()
  const delivery = createAlertDelivery({
    port,
    isCurrent: () => current,
    enabled: { posture: true, sitting: true },
    onChoose,
  })
  return {
    delivery,
    port,
    handles,
    onChoose,
    finish: (p: NotificationPermission) => {
      permission = p
      finish(p)
    },
    revoke: () => {
      current = false
    },
    permission: (p: NotificationPermission) => {
      permission = p
    },
  }
}
it('D01 construction is inert and snapshot has no user or body metadata', () => {
  const f = fixture()
  expect(f.delivery.getSnapshot()).toEqual({
    permission: 'default',
    alerts: [],
    browserFailed: false,
    closed: false,
  })
  expect(f.port.requestPermission).not.toHaveBeenCalled()
  expect(f.port.show).not.toHaveBeenCalled()
})
it('D01 explicit permission is single flight; denial never removes screen fallback', async () => {
  const f = fixture()
  f.delivery.receive('posture')
  const pending = f.delivery.requestPermission()
  const duplicate = f.delivery.requestPermission()
  expect(f.delivery.getSnapshot().permission).toBe('requesting')
  expect(f.port.requestPermission).toHaveBeenCalledTimes(1)
  f.finish('denied')
  await Promise.all([pending, duplicate])
  expect(f.delivery.getSnapshot()).toMatchObject({ permission: 'denied', alerts: ['posture'] })
  await f.delivery.requestPermission()
  expect(f.port.requestPermission).toHaveBeenCalledTimes(1)
})
it.each(['denied', 'unsupported'] as const)('D01 %s uses only the screen', (p) => {
  const f = fixture(p)
  expect(f.delivery.receive('sitting')).toBe(true)
  expect(f.delivery.getSnapshot().alerts).toEqual(['sitting'])
  expect(f.port.show).not.toHaveBeenCalled()
})
it('D01 failed permission is safe, explicit retry only and never logs raw failure', async () => {
  const f = fixture()
  vi.mocked(f.port.requestPermission).mockRejectedValueOnce(new Error('PRIVATE_BODY_ACCOUNT_ERROR'))
  await f.delivery.requestPermission()
  expect(f.delivery.getSnapshot().permission).toBe('failed')
  expect(JSON.stringify(f.delivery.getSnapshot())).not.toContain('PRIVATE')
  const pending = f.delivery.requestPermission()
  f.finish('granted')
  await pending
  expect(f.delivery.getSnapshot().permission).toBe('granted')
})
it('D02 duplicate events are bounded to one per kind; replacement closes old OS handle', () => {
  const f = fixture('granted')
  f.delivery.receive('posture')
  f.delivery.receive('posture')
  f.delivery.receive('sitting')
  expect(f.delivery.getSnapshot().alerts).toEqual(['posture', 'sitting'])
  expect(f.handles[0]?.close).toHaveBeenCalledTimes(1)
  f.handles[0]?.click()
  expect(f.onChoose).not.toHaveBeenCalled()
})
it('D02 disabled or invalid kinds do not deliver', () => {
  const f = fixture('granted')
  f.delivery.setEnabled({ posture: false, sitting: true })
  expect(f.delivery.receive('posture')).toBe(false)
  expect(f.delivery.receive('coordinates' as AlertKind)).toBe(false)
  expect(f.port.show).not.toHaveBeenCalled()
})
it('D02 revoked authority closes old alerts and never opens or chooses a new one', () => {
  const f = fixture('granted')
  f.delivery.receive('sitting')
  f.revoke()
  expect(f.delivery.receive('posture')).toBe(false)
  expect(f.delivery.choose('sitting')).toBe(false)
  expect(f.delivery.getSnapshot()).toMatchObject({ alerts: [], closed: true })
  expect(f.handles[0]?.close).toHaveBeenCalledTimes(1)
  expect(f.onChoose).not.toHaveBeenCalled()
})
it('D02 a throwing authority fails closed', () => {
  const delivery = createAlertDelivery({
    port: fixture().port,
    enabled: { posture: true, sitting: true },
    isCurrent: () => {
      throw new Error('PRIVATE')
    },
    onChoose: vi.fn(),
  })
  expect(delivery.receive('posture')).toBe(false)
  expect(delivery.getSnapshot().closed).toBe(true)
})
it('D03 constructor/error events keep the screen and mark browser delivery failure', () => {
  const f = fixture('granted')
  vi.mocked(f.port.show).mockImplementationOnce(() => {
    throw new Error('PRIVATE')
  })
  expect(f.delivery.receive('posture')).toBe(true)
  expect(f.delivery.getSnapshot()).toMatchObject({ alerts: ['posture'], browserFailed: true })
  f.delivery.receive('sitting')
  f.handles[0]?.fail()
  expect(f.delivery.getSnapshot().alerts).toEqual(['posture', 'sitting'])
})
it('D03 permission revoked after creation prevents subsequent browser delivery', () => {
  const f = fixture('granted')
  f.delivery.receive('posture')
  f.permission('denied')
  f.delivery.receive('sitting')
  expect(f.port.show).toHaveBeenCalledTimes(1)
  expect(f.delivery.getSnapshot().permission).toBe('denied')
})
it('D04 update and dismiss close only their owned handles; disposal is idempotent', () => {
  const f = fixture('granted')
  f.delivery.receive('posture')
  f.delivery.receive('sitting')
  f.delivery.setEnabled({ posture: false, sitting: true })
  expect(f.delivery.getSnapshot().alerts).toEqual(['sitting'])
  expect(f.handles[0]?.close).toHaveBeenCalledTimes(1)
  f.delivery.dismiss('sitting')
  f.delivery.dispose()
  f.delivery.dispose()
  expect(f.handles[1]?.close).toHaveBeenCalledTimes(1)
  expect(f.onChoose).not.toHaveBeenCalled()
})
it('D04 late permission and OS callbacks after disposal are ignored', async () => {
  const f = fixture()
  const pending = f.delivery.requestPermission()
  f.delivery.dispose()
  f.finish('granted')
  await pending
  expect(f.delivery.getSnapshot()).toMatchObject({ closed: true, alerts: [] })
  expect(f.port.show).not.toHaveBeenCalled()
})
it('D04 current OS click chooses once; stale error cannot mutate another alert', () => {
  const f = fixture('granted')
  f.delivery.receive('posture')
  const old = f.handles[0]
  f.delivery.receive('posture')
  old?.fail()
  expect(f.delivery.getSnapshot().browserFailed).toBe(false)
  f.handles[1]?.click()
  f.handles[1]?.click()
  expect(f.onChoose).toHaveBeenCalledExactlyOnceWith('posture')
  expect(f.delivery.getSnapshot().alerts).toEqual([])
})
it('D04 failing navigation retains screen and never claims completion', () => {
  const f = fixture()
  f.delivery.receive('posture')
  f.onChoose.mockImplementation(() => {
    throw new Error('PRIVATE')
  })
  expect(f.delivery.choose('posture')).toBe(false)
  expect(f.delivery.getSnapshot().alerts).toEqual(['posture'])
})
it('D05 subscriptions stop on unsubscribe; immutable snapshots are stable until change', () => {
  const f = fixture()
  const notify = vi.fn()
  const unsubscribe = f.delivery.subscribe(notify)
  const old = f.delivery.getSnapshot()
  expect(f.delivery.getSnapshot()).toBe(old)
  f.delivery.receive('posture')
  expect(old.alerts).toEqual([])
  expect(Object.isFrozen(f.delivery.getSnapshot().alerts)).toBe(true)
  expect(notify).toHaveBeenCalledTimes(1)
  unsubscribe()
  f.delivery.receive('sitting')
  expect(notify).toHaveBeenCalledTimes(1)
})
it('D04 synchronous browser failure reclaims the returned handle', () => {
  const f = fixture('granted')
  const close = vi.fn()
  vi.mocked(f.port.show).mockImplementationOnce((_kind, _click, fail) => {
    fail()
    return { close }
  })
  f.delivery.receive('posture')
  expect(close).toHaveBeenCalledTimes(1)
  expect(f.delivery.getSnapshot()).toMatchObject({ alerts: ['posture'], browserFailed: true })
  f.delivery.dispose()
  expect(close).toHaveBeenCalledTimes(1)
})
it('D04 a navigation callback cannot acknowledge a newly replaced event', () => {
  const f = fixture('granted')
  f.delivery.receive('posture')
  f.onChoose.mockImplementationOnce(() => {
    f.delivery.receive('posture')
  })
  f.delivery.choose('posture')
  expect(f.delivery.getSnapshot().alerts).toEqual(['posture'])
  expect(f.handles[1]?.close).not.toHaveBeenCalled()
})
it('D04 disposal while publishing permission intent never starts the OS request', async () => {
  const f = fixture()
  f.delivery.subscribe(() => {
    if (f.delivery.getSnapshot().permission === 'requesting') f.delivery.dispose()
  })
  await f.delivery.requestPermission()
  expect(f.port.requestPermission).not.toHaveBeenCalled()
  expect(f.delivery.getSnapshot().closed).toBe(true)
})
it('D04 a reentrant selection callback can acknowledge an event only once', () => {
  const f = fixture()
  f.delivery.receive('posture')
  f.onChoose.mockImplementationOnce(() => f.delivery.choose('posture'))
  f.delivery.choose('posture')
  expect(f.onChoose).toHaveBeenCalledExactlyOnceWith('posture')
  expect(f.delivery.getSnapshot().alerts).toEqual([])
})
