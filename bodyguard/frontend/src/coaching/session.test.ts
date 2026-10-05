// FR-S-02/04·FR-U-04/NFR-07/08: synthetic ports/gates, not camera/clinical verification.
import { expect, it, vi } from 'vitest'
import { bindCoachingLifecycle } from './lifecycle'
import { createCoachingSession } from './session'

const plan = {
  motionId: 'fixture-not-release',
  version: 'synthetic-algebra-only',
  source: 'direct' as const,
  maxFrameAgeMs: 100,
  maxFrameGapMs: 200,
  steps: [{ id: 'synthetic-hold', kind: 'hold' as const, targetMs: 100 }],
}
const gateNames = [
  'authenticated',
  'motionValidated',
  'referenceAvatarReady',
  'userAvatarReady',
] as const
const fresh = () => ({ dispose: vi.fn<() => void | Promise<void>>() })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function setup() {
  let clock = 0
  const gates = {
    authenticated: true,
    motionValidated: true,
    referenceAvatarReady: true,
    userAvatarReady: true,
  }
  const resources: ReturnType<typeof fresh>[] = []
  const acquire = async () => {
    const resource = fresh()
    resources.push(resource)
    return resource
  }
  const ports = { camera: vi.fn(acquire), inference: vi.fn(acquire), avatars: vi.fn(acquire) }
  const now = vi.fn(() => clock)
  const readGates = vi.fn(() => gates)
  const onChange = vi.fn()
  return {
    ports,
    gates,
    resources,
    now,
    readGates,
    onChange,
    options: { plan, ports, now, readGates, onChange },
    at: (value: number) => {
      clock = value
    },
  }
}
const privateFailure = () => new Error('PRIVATE_COORDINATES_ACCOUNT_FAILURE')

it('T-01 생성/미확인 gate는 실제 coordinator에서도 factory0이다', async () => {
  const factory = vi.fn(async () => ({ dispose: vi.fn() }))
  const session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 100,
      steps: [{ id: 'synthetic-hold', kind: 'hold', targetMs: 100 }],
    },
    ports: { camera: factory, inference: factory, avatars: factory },
    readGates: () => ({
      authenticated: false,
      motionValidated: false,
      referenceAvatarReady: false,
      userAvatarReady: false,
    }),
    now: () => 1,
    onChange: vi.fn(),
  })
  expect(factory).not.toHaveBeenCalled()
  await session.start()
  expect(factory).not.toHaveBeenCalled()
  expect(session.getSnapshot().state.status).toBe('idle')
  await session.close('page-hidden')
})

it.each(gateNames.flatMap((name) => [false, undefined, 'true'].map((value) => ({ name, value }))))(
  'T-01 gate $name / $value 는 true가 아니면 준비0이다',
  async ({ name, value }) => {
    const h = setup()
    h.gates[name] = value as boolean
    const session = createCoachingSession(h.options)
    await session.start()
    await session.resume()
    for (const port of Object.values(h.ports)) expect(port).not.toHaveBeenCalled()
    expect(session.getSnapshot().state.status).toBe('idle')
    await session.close('page-hidden')
  },
)

it('T-02 실제 engine effect와 controller를 연결해 start→pause→resume→end를 진행한다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  await session.start()
  expect(session.getSnapshot().state.status).toBe('running')
  await session.pause()
  expect(session.getSnapshot().state.status).toBe('paused')
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  h.at(1)
  await session.resume()
  expect(session.getSnapshot().state.generation).toBe(2)
  h.at(2)
  await session.end('session-expired')
  const snapshot = session.getSnapshot()
  expect(snapshot.closed).toBe(true)
  expect(snapshot.state.result?.outcome).toBe('interrupted')
  expect(snapshot.state.result?.reason).toBe('session-expired')
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  await session.start()
  await session.resume()
  await session.close('page-hidden')
  expect(h.ports.camera).toHaveBeenCalledTimes(2)
})

it('T-03 start의 권한 대기 Promise가 pause·resume·종료를 막지 않고 과거 반환도 정리한다', async () => {
  const h = setup()
  const wait = deferred<ReturnType<typeof fresh>>()
  h.ports.camera.mockImplementationOnce(() => wait.promise)
  const session = createCoachingSession(h.options)
  const first = session.start()
  await vi.waitFor(() => expect(h.ports.camera).toHaveBeenCalledTimes(1))
  await session.pause()
  expect(session.getSnapshot().state.status).toBe('paused')
  h.at(1)
  await session.resume()
  expect(session.getSnapshot().state.status).toBe('running')
  const old = fresh()
  wait.resolve(old)
  await first
  expect(session.getSnapshot().state.generation).toBe(2)
  expect(old.dispose).toHaveBeenCalledTimes(1)
  expect(h.resources.every((resource) => resource.dispose.mock.calls.length === 0)).toBe(true)
  await session.end('page-hidden')
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
})

it.each(['authenticated', 'motionValidated', 'referenceAvatarReady', 'userAvatarReady'] as const)(
  'T-04 ready 전 %s 상실은 준비 성공이 아닌 해당 사유 종료다',
  async (key) => {
    const h = setup()
    const wait = deferred<ReturnType<typeof fresh>>()
    h.ports.avatars.mockImplementationOnce(() => wait.promise)
    const session = createCoachingSession(h.options)
    const task = session.start()
    await vi.waitFor(() => expect(h.ports.avatars).toHaveBeenCalledTimes(1))
    h.gates[key] = false
    const last = fresh()
    wait.resolve(last)
    await task
    expect(session.getSnapshot().state.status).toBe('ended')
    expect(session.getSnapshot().state.result?.reason).toBe(
      key === 'authenticated'
        ? 'session-expired'
        : key === 'motionValidated'
          ? 'motion-withdrawn'
          : 'asset-error',
    )
    for (const resource of [...h.resources, last]) expect(resource.dispose).toHaveBeenCalledTimes(1)
  },
)

it.each(['tick', 'observation'] as const)(
  'T-04 %s 전에 세션 만료를 재확인하여 유지·완료를 만들지 않는다',
  async (action) => {
    const h = setup()
    const session = createCoachingSession(h.options)
    await session.start()
    h.gates.authenticated = false
    h.at(1)
    if (action === 'tick') await session.tick()
    else
      await session.observe({
        generation: 1,
        sampledAt: 1,
        sequence: 0,
        personCount: 1,
        stepId: 'synthetic-hold',
        classification: 'start',
      })
    expect(session.getSnapshot().state.result?.reason).toBe('session-expired')
    expect(session.getSnapshot().state.progress[0].verifiedMs).toBe(0)
    for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  },
)

it.each(['camera', 'inference', 'avatars'] as const)(
  'T-05 %s 오류는 고정 사유로 종료하고 자원과 원본 오류를 snapshot에 노출하지 않는다',
  async (stage) => {
    const h = setup()
    h.ports[stage].mockRejectedValueOnce(privateFailure())
    const session = createCoachingSession(h.options)
    await session.start()
    const snapshot = session.getSnapshot()
    expect(snapshot.state.result?.reason).toBe(
      stage === 'avatars' ? 'asset-error' : `${stage}-error`,
    )
    expect(snapshot.closed).toBe(true)
    expect(Object.keys(snapshot)).toEqual(['state', 'closed', 'failure'])
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_')
    for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  },
)

it('T-05 ownership-error는 실제 엔진 사유이며 asset/user-stop으로 꾸미지 않는다', async () => {
  const h = setup()
  const shared = fresh()
  h.ports.camera.mockResolvedValueOnce(shared)
  h.ports.inference.mockResolvedValueOnce(shared)
  const session = createCoachingSession(h.options)
  await session.start()
  expect(session.getSnapshot().state.result?.reason).toBe('ownership-error')
  expect(shared.dispose).toHaveBeenCalledTimes(1)
  expect(h.ports.avatars).not.toHaveBeenCalled()
})

it('T-05 cleanup-error는 단순 pause가 아니라 종료·재준비 금지로 처리한다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  await session.start()
  h.resources[0].dispose.mockRejectedValueOnce(privateFailure())
  await session.pause()
  await session.resume()
  expect(session.getSnapshot().state.result?.reason).toBe('cleanup-error')
  expect(session.getSnapshot().closed).toBe(true)
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  expect(h.ports.camera).toHaveBeenCalledTimes(1)
})

it.each([NaN, Infinity, -1])(
  'T-05 clock %s 는 명시 clock-error로 종료·준비0이다',
  async (value) => {
    const h = setup()
    h.at(value)
    const session = createCoachingSession(h.options)
    await session.start()
    expect(session.getSnapshot().state.result?.reason).toBe('clock-error')
    expect(h.ports.camera).not.toHaveBeenCalled()
  },
)

it('T-05 역행 clock 및 provider 예외는 raw 내용 없이 fail-closed이다', async () => {
  const h = setup()
  h.at(2)
  const session = createCoachingSession(h.options)
  await session.start()
  h.at(1)
  await session.tick()
  expect(session.getSnapshot().state.result?.reason).toBe('clock-error')
  const second = setup()
  second.readGates.mockImplementationOnce(() => {
    throw privateFailure()
  })
  const failed = createCoachingSession(second.options)
  await failed.start()
  expect(failed.getSnapshot().state.result?.reason).toBe('gate-error')
  expect(JSON.stringify(failed.getSnapshot())).not.toContain('PRIVATE_')
  expect(second.ports.camera).not.toHaveBeenCalled()
})

it('T-06 ready·tick·시간 경과만으로는 성공·관찰/반복/유지0이다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  await session.start()
  h.at(10000)
  await session.tick()
  expect(session.getSnapshot().state.result).toBeNull()
  expect(session.getSnapshot().state.progress[0]).toMatchObject({
    holdMs: 0,
    verifiedMs: 0,
    repetitions: 0,
    completed: false,
  })
  expect(Object.isFrozen(session.getSnapshot())).toBe(true)
  expect(Object.isFrozen(session.getSnapshot().state.progress[0])).toBe(true)
  await session.end('user-stop')
})

it('T-06 명시 관찰의 시작·목표·복귀만 성공으로 계산하고 종료 뒤 frame은 무시한다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  await session.start()
  let sequence = 0
  for (const [time, classification] of [
    [0, 'start'],
    [1, 'target'],
    [101, 'target'],
    [102, 'returned'],
  ] as const) {
    h.at(time)
    await session.observe({
      generation: 1,
      sampledAt: time,
      sequence: sequence++,
      personCount: 1,
      stepId: 'synthetic-hold',
      classification,
    })
  }
  const ended = session.getSnapshot().state
  expect(ended.result?.outcome).toBe('completed')
  expect(ended.progress[0].verifiedMs).toBe(100)
  h.at(103)
  await session.observe({
    generation: 1,
    sampledAt: 103,
    sequence: sequence++,
    personCount: 1,
    stepId: 'synthetic-hold',
    classification: 'target',
  })
  expect(session.getSnapshot().state).toBe(ended)
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
})

it('T-06 과거 세대 frame·가림 입력은 현재 성공으로 계산하지 않는다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  await session.start()
  await session.pause()
  h.at(1)
  await session.resume()
  for (const generation of [1, 2])
    await session.observe({
      generation,
      sampledAt: 1,
      sequence: 0,
      personCount: 1,
      stepId: 'synthetic-hold',
      classification: 'unobservable',
    })
  expect(session.getSnapshot().state.progress[0].verifiedMs).toBe(0)
  expect(session.getSnapshot().state.result).toBeNull()
  await session.end('user-stop')
})

it.each(['throw', 'reject'] as const)(
  'T-07 observer %s는 정리·callback-error·준비 재시작0이다',
  async (kind) => {
    const h = setup()
    h.onChange.mockImplementation((snapshot) => {
      if (snapshot.state.status === 'running') {
        if (kind === 'throw') throw privateFailure()
        return Promise.reject(privateFailure())
      }
    })
    const session = createCoachingSession(h.options)
    await session.start()
    await session.resume()
    expect(session.getSnapshot().state.result?.reason).toBe('callback-error')
    expect(session.getSnapshot().closed).toBe(true)
    for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
    expect(h.ports.camera).toHaveBeenCalledTimes(1)
  },
)

it('T-07 preparing observer의 reentrant pause가 이전 준비를 부활시키지 않는다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  h.onChange.mockImplementationOnce(() => session.pause())
  await session.start()
  expect(session.getSnapshot().state.status).toBe('paused')
  expect(h.ports.camera).not.toHaveBeenCalled()
  await session.close('page-hidden')
})

it('T-08 실제 EventTarget hidden/pagehide/dispose는 종료하고 visible 자동 재시작·listener 누수0이다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  const page = Object.assign(new EventTarget(), {
    visibilityState: 'visible' as DocumentVisibilityState,
  })
  const win = new EventTarget()
  const addPage = vi.spyOn(page, 'addEventListener')
  const removePage = vi.spyOn(page, 'removeEventListener')
  const addWindow = vi.spyOn(win, 'addEventListener')
  const removeWindow = vi.spyOn(win, 'removeEventListener')
  const detach = bindCoachingLifecycle(session, page, win)
  await session.start()
  page.visibilityState = 'hidden'
  page.dispatchEvent(new Event('visibilitychange'))
  expect(removePage).toHaveBeenCalledTimes(1)
  expect(removeWindow).toHaveBeenCalledTimes(1)
  await session.close('page-hidden')
  expect(session.getSnapshot().state.result?.reason).toBe('page-hidden')
  page.visibilityState = 'visible'
  page.dispatchEvent(new Event('visibilitychange'))
  win.dispatchEvent(new Event('pagehide'))
  detach()
  detach()
  await session.resume()
  expect(h.ports.camera).toHaveBeenCalledTimes(1)
  expect(addPage).toHaveBeenCalledTimes(1)
  expect(removePage).toHaveBeenCalledTimes(1)
  expect(addWindow).toHaveBeenCalledTimes(1)
  expect(removeWindow).toHaveBeenCalledTimes(1)
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
})

it.each(['tick', 'observation'] as const)(
  'T-04 %s의 gate 상실 종료는 현재 유효 시각의 경과 시간을 보존한다',
  async (action) => {
    const h = setup()
    const session = createCoachingSession(h.options)
    await session.start()
    h.at(10000)
    h.gates.authenticated = false
    if (action === 'tick') await session.tick()
    else
      await session.observe({
        generation: 1,
        sampledAt: 10000,
        sequence: 0,
        personCount: 1,
        stepId: 'synthetic-hold',
        classification: 'start',
      })
    expect(session.getSnapshot().state.result?.elapsedMs).toBe(10000)
    expect(session.getSnapshot().state.progress[0].verifiedMs).toBe(0)
  },
)

it.each(['pagehide', 'initial-hidden', 'detach'] as const)(
  'T-08 %s 자체가 즉시 종료·listener 제거를 수행한다',
  async (action) => {
    const h = setup()
    const session = createCoachingSession(h.options)
    await session.start()
    const page = Object.assign(new EventTarget(), {
      visibilityState: (action === 'initial-hidden'
        ? 'hidden'
        : 'visible') as DocumentVisibilityState,
    })
    const win = new EventTarget()
    const removePage = vi.spyOn(page, 'removeEventListener')
    const removeWindow = vi.spyOn(win, 'removeEventListener')
    const detach = bindCoachingLifecycle(session, page, win)
    if (action === 'pagehide') win.dispatchEvent(new Event('pagehide'))
    if (action === 'detach') detach()
    await session.close('page-hidden')
    detach()
    expect(session.getSnapshot().state.result?.reason).toBe('page-hidden')
    expect(removePage).toHaveBeenCalledTimes(1)
    expect(removeWindow).toHaveBeenCalledTimes(1)
    for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  },
)

it('T-05 gate 속성 getter의 예외도 gate-error로 처리하고 준비를 시작하지 않는다', async () => {
  const h = setup()
  Object.defineProperty(h.gates, 'authenticated', {
    get() {
      throw privateFailure()
    },
  })
  const session = createCoachingSession(h.options)
  await expect(session.start()).resolves.toBeUndefined()
  expect(session.getSnapshot().state.result?.reason).toBe('gate-error')
  expect(h.ports.camera).not.toHaveBeenCalled()
})

it('T-05 종료 뒤 cleanup 실패는 기존 종료 이유를 왜곡하지 않고 fixed failure를 별도로 남긴다', async () => {
  const h = setup()
  const session = createCoachingSession(h.options)
  await session.start()
  h.resources[0].dispose.mockRejectedValueOnce(privateFailure())
  h.at(1)
  await session.end('page-hidden')
  expect(session.getSnapshot().state.result?.reason).toBe('page-hidden')
  expect(session.getSnapshot().failure).toBe('cleanup-error')
  expect(session.getSnapshot().closed).toBe(true)
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
})
