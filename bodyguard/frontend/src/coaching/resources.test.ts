// FR-S-02/04·FR-M-07/NFR-07/08: synthetic disposable factories, never real camera/model proof.
import { afterEach, expect, it, vi } from 'vitest'
import { advanceCoaching, type CoachingEvent, createCoaching } from '../stretch/progression'
import {
  createResourceController,
  ResourceCleanupError,
  type ResourceContext,
  type ResourceNotice,
} from './resources'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const request = (generation: number) => ({ type: 'request-camera' as const, generation })
const release = (generation: number) => ({ type: 'release-resources' as const, generation })
const stages = ['camera', 'inference', 'avatars'] as const
const fresh = () => ({ dispose: vi.fn() })
function setup() {
  const resources = [fresh(), fresh(), fresh()]
  const ports = {
    camera: vi.fn(async (_context: ResourceContext) => resources[0]),
    inference: vi.fn(async (_context: ResourceContext) => resources[1]),
    avatars: vi.fn(async (_context: ResourceContext) => resources[2]),
  }
  const notice = vi.fn<(notice: ResourceNotice) => void>()
  return { resources, ports, notice }
}
const privateFailure = () => new Error('PRIVATE_FRAME_coordinates_account_METADATA')

it('R-07 factory 반환 전 정리 실패도 다른 소유 자원을 정리하고 재준비를 차단한다', async () => {
  const { resources, ports, notice } = setup()
  ports.avatars.mockRejectedValueOnce(new ResourceCleanupError())
  const controller = createResourceController(ports, notice)
  await controller.run(request(1))
  await controller.run(request(2))
  await controller.close()
  expect(resources[0].dispose).toHaveBeenCalledTimes(1)
  expect(resources[1].dispose).toHaveBeenCalledTimes(1)
  expect(resources[2].dispose).not.toHaveBeenCalled()
  expect(ports.camera).toHaveBeenCalledTimes(1)
  expect(notice.mock.calls).toEqual([[{ type: 'error', generation: 1, reason: 'cleanup-error' }]])
})

it('R-07 이전 factory의 늦은 정리 실패는 현재 세대도 정리하고 오류를 한 번만 보고한다', async () => {
  const { resources, ports, notice } = setup()
  const pending = deferred<ReturnType<typeof fresh>>()
  ports.avatars.mockImplementationOnce(() => pending.promise)
  for (const stage of ['camera', 'inference'] as const)
    ports[stage].mockImplementationOnce(async () => fresh())
  const controller = createResourceController(ports, notice)
  const old = controller.run(request(1))
  await vi.waitFor(() => expect(ports.avatars).toHaveBeenCalledTimes(1))
  await controller.run(request(2))
  pending.reject(new ResourceCleanupError())
  await old
  await controller.run(request(3))
  await controller.close()
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  expect(ports.camera).toHaveBeenCalledTimes(2)
  expect(notice.mock.calls).toEqual([
    [{ type: 'ready', generation: 2 }],
    [{ type: 'error', generation: 1, reason: 'cleanup-error' }],
  ])
})

it('R-02 명시 요청만 camera→inference→avatars 준비하고 close에서 각1회 정리한다', async () => {
  const order: string[] = []
  const resources = Array.from({ length: 3 }, () => ({ dispose: vi.fn() }))
  const notice = vi.fn()
  const controller = createResourceController(
    {
      camera: async () => {
        order.push('camera')
        return resources[0]
      },
      inference: async () => {
        order.push('inference')
        return resources[1]
      },
      avatars: async () => {
        order.push('avatars')
        return resources[2]
      },
    },
    notice,
  )
  expect(order).toEqual([])
  await controller.run({ type: 'request-camera', generation: 1 })
  expect(order).toEqual(['camera', 'inference', 'avatars'])
  expect(notice.mock.calls).toEqual([[{ type: 'ready', generation: 1 }]])
  expect(resources.every((resource) => resource.dispose.mock.calls.length === 0)).toBe(true)
  await controller.close()
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
})

it('R-01 잘못된 effect·세대는 준비를 시작하지 않는다', async () => {
  const { ports, notice } = setup()
  const controller = createResourceController(ports, notice)
  const invalid: unknown[] = [
    null,
    undefined,
    false,
    {},
    { type: 'ready', generation: 1 },
    ...[0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', true].map((generation) => ({
      type: 'request-camera',
      generation,
    })),
  ]
  for (const effect of invalid) await controller.run(effect as Parameters<typeof controller.run>[0])
  for (const port of Object.values(ports)) expect(port).not.toHaveBeenCalled()
  expect(notice).not.toHaveBeenCalled()
  await controller.close()
})

it('R-01/06 중복·과거 요청과 다른 세대 release는 현재 소유권을 바꾸지 않는다', async () => {
  const { resources, ports, notice } = setup()
  const controller = createResourceController(ports, notice)
  await controller.run(request(2))
  for (const effect of [request(1), request(2), release(1), release(3)])
    await controller.run(effect)
  expect(ports.camera).toHaveBeenCalledTimes(1)
  expect(notice).toHaveBeenCalledTimes(1)
  for (const resource of resources) expect(resource.dispose).not.toHaveBeenCalled()
  await controller.run(release(2))
  await controller.run(release(2))
  await controller.close()
  await controller.close()
  await controller.run(request(3))
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  expect(ports.camera).toHaveBeenCalledTimes(1)
})

it.each(stages)('R-02 %s 완료 전 ready가 없고 context는 해당 세대와 signal이다', async (stage) => {
  const { resources, ports, notice } = setup()
  const wait = deferred<ReturnType<typeof fresh>>()
  ports[stage].mockImplementationOnce(() => wait.promise)
  const controller = createResourceController(ports, notice)
  const task = controller.run(request(7))
  await vi.waitFor(() => expect(ports[stage]).toHaveBeenCalledTimes(1))
  expect(notice).not.toHaveBeenCalled()
  for (const port of Object.values(ports))
    for (const [context] of port.mock.calls) {
      expect(Object.keys(context)).toEqual(['generation', 'signal'])
      expect(context.generation).toBe(7)
      expect(context.signal.aborted).toBe(false)
    }
  wait.resolve(resources[stages.indexOf(stage)])
  await task
  expect(notice).toHaveBeenCalledExactlyOnceWith({ type: 'ready', generation: 7 })
  await controller.close()
  for (const port of Object.values(ports)) expect(port.mock.calls[0][0].signal.aborted).toBe(true)
})

it.each(stages.flatMap((stage) => ['throw', 'reject'].map((kind) => ({ stage, kind }))))(
  'R-03 $stage / $kind : 부분 정리하고 고정 오류만 전달한다',
  async ({ stage, kind }) => {
    const { resources, ports, notice } = setup()
    ports[stage].mockImplementationOnce(() => {
      if (kind === 'throw') throw privateFailure()
      return Promise.reject(privateFailure())
    })
    const controller = createResourceController(ports, notice)
    await expect(controller.run(request(1))).resolves.toBeUndefined()
    const reason = stage === 'avatars' ? 'asset-error' : `${stage}-error`
    expect(notice.mock.calls).toEqual([[{ type: 'error', generation: 1, reason }]])
    for (const [index, resource] of resources.entries())
      expect(resource.dispose).toHaveBeenCalledTimes(index < stages.indexOf(stage) ? 1 : 0)
    await controller.close()
  },
)

it.each(stages)('R-03 %s가 소유 자원이 아닌 값을 반환하면 통과하지 않는다', async (stage) => {
  const { resources, ports, notice } = setup()
  ports[stage].mockResolvedValueOnce(null as unknown as ReturnType<typeof fresh>)
  const controller = createResourceController(ports, notice)
  await controller.run(request(1))
  expect(notice.mock.calls).toEqual([
    [
      {
        type: 'error',
        generation: 1,
        reason: stage === 'avatars' ? 'asset-error' : `${stage}-error`,
      },
    ],
  ])
  for (const [index, resource] of resources.entries())
    expect(resource.dispose).toHaveBeenCalledTimes(index < stages.indexOf(stage) ? 1 : 0)
  await controller.close()
})

it.each(stages)(
  'R-04 %s 대기 중 release 뒤 늦은 반환은 정리하고 다음 준비하지 않는다',
  async (stage) => {
    const { resources, ports, notice } = setup()
    const wait = deferred<ReturnType<typeof fresh>>()
    ports[stage].mockImplementationOnce(() => wait.promise)
    const controller = createResourceController(ports, notice)
    const task = controller.run(request(1))
    await vi.waitFor(() => expect(ports[stage]).toHaveBeenCalledTimes(1))
    await controller.run(release(1))
    expect(ports[stage].mock.calls[0][0].signal.aborted).toBe(true)
    wait.resolve(resources[stages.indexOf(stage)])
    await task
    expect(notice).not.toHaveBeenCalled()
    for (const [index, resource] of resources.entries())
      expect(resource.dispose).toHaveBeenCalledTimes(index <= stages.indexOf(stage) ? 1 : 0)
    for (const later of stages.slice(stages.indexOf(stage) + 1))
      expect(ports[later]).not.toHaveBeenCalled()
    await controller.close()
  },
)

it('R-04/06 close는 응답하지 않는 factory를 기다리지 않고 늦은 rejection도 삼킨다', async () => {
  const { ports, notice } = setup()
  const wait = deferred<ReturnType<typeof fresh>>()
  ports.camera.mockImplementationOnce(() => wait.promise)
  const controller = createResourceController(ports, notice)
  const task = controller.run(request(1))
  await vi.waitFor(() => expect(ports.camera).toHaveBeenCalledTimes(1))
  await controller.close()
  await controller.run(request(2))
  wait.reject(privateFailure())
  await expect(task).resolves.toBeUndefined()
  expect(ports.camera).toHaveBeenCalledTimes(1)
  expect(notice).not.toHaveBeenCalled()
})

it('R-05 새 세대 완료 뒤 역순 반환은 현재 ready와 소유 자원에 영향이 없다', async () => {
  const { ports, notice } = setup()
  const waits = [deferred<ReturnType<typeof fresh>>(), deferred<ReturnType<typeof fresh>>()]
  const old = [fresh(), fresh()]
  ports.camera
    .mockImplementationOnce(() => waits[0].promise)
    .mockImplementationOnce(() => waits[1].promise)
    .mockImplementation(async () => fresh())
  ports.inference.mockImplementation(async () => fresh())
  ports.avatars.mockImplementation(async () => fresh())
  const controller = createResourceController(ports, notice)
  const first = controller.run(request(1))
  await vi.waitFor(() => expect(ports.camera).toHaveBeenCalledTimes(1))
  const second = controller.run(request(2))
  await vi.waitFor(() => expect(ports.camera).toHaveBeenCalledTimes(2))
  await controller.run(request(3))
  waits[1].resolve(old[1])
  await second
  waits[0].resolve(old[0])
  await first
  expect(notice.mock.calls).toEqual([[{ type: 'ready', generation: 3 }]])
  for (const resource of old) expect(resource.dispose).toHaveBeenCalledTimes(1)
  await controller.run(release(1))
  await controller.close()
})

it('R-05 교체가 연달아 와도 앞선 비동기 dispose가 끝나기 전 새 factory를 시작하지 않는다', async () => {
  const { resources, ports, notice } = setup()
  const disposal = deferred<void>()
  resources[0].dispose.mockImplementation(() => disposal.promise)
  for (const stage of stages)
    ports[stage]
      .mockImplementationOnce(async () => resources[stages.indexOf(stage)])
      .mockImplementation(async () => fresh())
  const controller = createResourceController(ports, notice)
  await controller.run(request(1))
  const second = controller.run(request(2))
  await vi.waitFor(() => expect(resources[0].dispose).toHaveBeenCalledTimes(1))
  const third = controller.run(request(3))
  await Promise.resolve()
  await Promise.resolve()
  expect(ports.camera).toHaveBeenCalledTimes(1)
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  disposal.resolve()
  await Promise.all([second, third])
  expect(ports.camera).toHaveBeenCalledTimes(2)
  expect(notice.mock.calls).toEqual([
    [{ type: 'ready', generation: 1 }],
    [{ type: 'ready', generation: 3 }],
  ])
  await controller.close()
})

it.each(['throw', 'reject'])(
  'R-07 dispose %s는 다른 자원 정리를 막지 않고 새 준비를 차단한다',
  async (kind) => {
    const { resources, ports, notice } = setup()
    resources[0].dispose.mockImplementation(() => {
      if (kind === 'throw') throw privateFailure()
      return Promise.reject(privateFailure())
    })
    const controller = createResourceController(ports, notice)
    await controller.run(request(1))
    await expect(controller.run(release(1))).resolves.toBeUndefined()
    await controller.run(request(2))
    await controller.close()
    for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
    expect(notice.mock.calls).toEqual([
      [{ type: 'ready', generation: 1 }],
      [{ type: 'error', generation: 1, reason: 'cleanup-error' }],
    ])
    expect(ports.camera).toHaveBeenCalledTimes(1)
  },
)

it('R-07 이미 교체된 factory의 늦은 dispose 실패도 현재 소유 자원을 정리하고 준비를 차단한다', async () => {
  const { resources, ports, notice } = setup()
  const wait = deferred<ReturnType<typeof fresh>>()
  const bad = fresh()
  bad.dispose.mockRejectedValue(privateFailure())
  ports.camera.mockImplementationOnce(() => wait.promise)
  const controller = createResourceController(ports, notice)
  const old = controller.run(request(1))
  await vi.waitFor(() => expect(ports.camera).toHaveBeenCalledTimes(1))
  await controller.run(request(2))
  wait.resolve(bad)
  await old
  await controller.close()
  await controller.run(request(3))
  for (const resource of [...resources, bad]) expect(resource.dispose).toHaveBeenCalledTimes(1)
  expect(notice.mock.calls).toEqual([
    [{ type: 'ready', generation: 2 }],
    [{ type: 'error', generation: 1, reason: 'cleanup-error' }],
  ])
  expect(ports.camera).toHaveBeenCalledTimes(2)
})

it('R-08 동일 객체를 두 stage가 반환하면 ready 없이 소유권 오류와 정리1회이다', async () => {
  const { resources, ports, notice } = setup()
  ports.inference.mockResolvedValue(resources[0])
  const controller = createResourceController(ports, notice)
  await controller.run(request(1))
  await controller.close()
  expect(notice.mock.calls).toEqual([[{ type: 'error', generation: 1, reason: 'ownership-error' }]])
  expect(resources[0].dispose).toHaveBeenCalledTimes(1)
  expect(ports.avatars).not.toHaveBeenCalled()
})

it('R-08 앞선 세대에서 정리한 객체는 다음 세대가 재사용할 수 없다', async () => {
  const { resources, ports, notice } = setup()
  const controller = createResourceController(ports, notice)
  await controller.run(request(1))
  await controller.run(request(2))
  await controller.close()
  expect(notice.mock.calls).toEqual([
    [{ type: 'ready', generation: 1 }],
    [{ type: 'error', generation: 2, reason: 'ownership-error' }],
  ])
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
})

it('R-08 늦은 과거 factory가 현재 소유 객체를 반환해도 현재 객체는 해제하지 않는다', async () => {
  const { resources, ports, notice } = setup()
  const wait = deferred<ReturnType<typeof fresh>>()
  ports.camera.mockImplementationOnce(() => wait.promise)
  const controller = createResourceController(ports, notice)
  const old = controller.run(request(1))
  await vi.waitFor(() => expect(ports.camera).toHaveBeenCalledTimes(1))
  await controller.run(request(2))
  wait.resolve(resources[0])
  await old
  expect(notice.mock.calls).toEqual([[{ type: 'ready', generation: 2 }]])
  for (const resource of resources) expect(resource.dispose).not.toHaveBeenCalled()
  await controller.close()
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
})

it.each(['throw', 'reject'])(
  'R-09 callback %s는 모든 자원을 정리하고 unhandled rejection·재준비가 없다',
  async (kind) => {
    const { resources, ports } = setup()
    const notice = vi.fn(() => {
      if (kind === 'throw') throw privateFailure()
      return Promise.reject(privateFailure())
    })
    const controller = createResourceController(ports, notice)
    await expect(controller.run(request(1))).resolves.toBeUndefined()
    await controller.run(request(2))
    await controller.close()
    for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
    expect(notice).toHaveBeenCalledTimes(1)
    expect(ports.camera).toHaveBeenCalledTimes(1)
  },
)

it('R-09 부분 실패의 오류 callback 예외도 오류 전달을 재귀 호출하지 않는다', async () => {
  const { resources, ports } = setup()
  ports.inference.mockRejectedValue(privateFailure())
  const notice = vi.fn(() => {
    throw privateFailure()
  })
  const controller = createResourceController(ports, notice)
  await controller.run(request(1))
  await controller.close()
  await controller.run(request(2))
  expect(resources[0].dispose).toHaveBeenCalledTimes(1)
  expect(notice).toHaveBeenCalledTimes(1)
  expect(ports.camera).toHaveBeenCalledTimes(1)
})

it('R-06/09 close 중 늦은 반환과 여러 cleanup 실패·callback 예외도 정리1회·재준비0이다', async () => {
  const { resources, ports } = setup()
  const wait = deferred<ReturnType<typeof fresh>>()
  ports.avatars.mockImplementationOnce(() => wait.promise)
  resources[0].dispose.mockRejectedValue(privateFailure())
  resources[1].dispose.mockImplementation(() => {
    throw privateFailure()
  })
  const notice = vi.fn(() => {
    throw privateFailure()
  })
  const controller = createResourceController(ports, notice)
  const task = controller.run(request(1))
  await vi.waitFor(() => expect(ports.avatars).toHaveBeenCalledTimes(1))
  await controller.close()
  wait.resolve(resources[2])
  await task
  await controller.close()
  await controller.run(request(2))
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  expect(notice).toHaveBeenCalledExactlyOnceWith({
    type: 'error',
    generation: 1,
    reason: 'cleanup-error',
  })
  expect(ports.camera).toHaveBeenCalledTimes(1)
})

it('R-10 raw 오류·자원 metadata는 notice/console/network/storage에 전달하지 않는다', async () => {
  const logs = ['log', 'error', 'warn', 'info', 'debug'].map((name) =>
    vi.spyOn(console, name as 'log').mockImplementation(() => undefined),
  )
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(privateFailure())
  const storage = { setItem: vi.fn(), getItem: vi.fn(), open: vi.fn() }
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) vi.stubGlobal(name, storage)
  const { resources, ports, notice } = setup()
  Object.assign(resources[0], { secretMetadata: privateFailure().message })
  ports.avatars.mockRejectedValue(privateFailure())
  const controller = createResourceController(ports, notice)
  await controller.run(request(1))
  await controller.close()
  expect(notice.mock.calls).toEqual([[{ type: 'error', generation: 1, reason: 'asset-error' }]])
  for (const log of logs) expect(log).not.toHaveBeenCalled()
  expect(network).not.toHaveBeenCalled()
  for (const method of Object.values(storage)) expect(method).not.toHaveBeenCalled()
  expect(JSON.stringify(notice.mock.calls)).not.toContain('PRIVATE_')
})

it('R-04 완료된 acquire와 다음 stage 사이에 release되면 다음 factory도0이다', async () => {
  const { resources, ports, notice } = setup()
  const controller = createResourceController(ports, notice)
  ports.camera.mockImplementationOnce(async () => {
    queueMicrotask(() =>
      queueMicrotask(() => {
        void controller.run(release(1))
      }),
    )
    return resources[0]
  })
  await controller.run(request(1))
  await controller.close()
  expect(ports.inference).not.toHaveBeenCalled()
  expect(ports.avatars).not.toHaveBeenCalled()
  expect(notice).not.toHaveBeenCalled()
  expect(resources[0].dispose).toHaveBeenCalledTimes(1)
})

it('R-09 cleanup-error callback가 close를 await해도 정리 promise와 교착하지 않는다', async () => {
  const { resources, ports } = setup()
  resources[0].dispose.mockRejectedValue(privateFailure())
  const controller = createResourceController(ports, async (notice) => {
    if (notice.type === 'error') await controller.close()
  })
  await controller.run(request(1))
  await controller.run(release(1))
  for (const resource of resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
}, 1000)

const gates = {
  authenticated: true,
  motionValidated: true,
  referenceAvatarReady: true,
  userAvatarReady: true,
}
function engine() {
  // Explicit synthetic progression plan, not a released motion/angle or medical recommendation.
  return createCoaching({
    motionId: 'fixture-not-release',
    version: 'synthetic-algebra-only',
    source: 'direct',
    maxFrameAgeMs: 100,
    maxFrameGapMs: 100,
    steps: [{ id: 'synthetic-hold', kind: 'hold', targetMs: 100 }],
  })
}
it.each(Object.keys(gates) as (keyof typeof gates)[])(
  'R-11 미확인 %s gate에서 engine effect와 자원 요청은0이다',
  async (key) => {
    const { ports, notice } = setup()
    const controller = createResourceController(ports, notice)
    const transition = advanceCoaching(engine(), {
      type: 'start',
      now: 1,
      gates: { ...gates, [key]: false },
    })
    for (const effect of transition.effects) await controller.run(effect)
    expect(transition.state.status).toBe('idle')
    for (const port of Object.values(ports)) expect(port).not.toHaveBeenCalled()
    expect(notice).not.toHaveBeenCalled()
    await controller.close()
  },
)

it('R-11 실제 engine start/ready/pause/resume/end effects와 controller를 연결해도 성공 기록을 만들지 않는다', async () => {
  const all: ReturnType<typeof fresh>[] = []
  const acquire = vi.fn(async () => {
    const resource = fresh()
    all.push(resource)
    return resource
  })
  let state = engine()
  let now = 1
  const controller = createResourceController(
    { camera: acquire, inference: acquire, avatars: acquire },
    (notice) => {
      expect(notice.type).toBe('ready')
      if (notice.type === 'ready')
        state = advanceCoaching(state, { type: 'ready', generation: notice.generation, now }).state
    },
  )
  async function send(event: CoachingEvent) {
    const transition = advanceCoaching(state, event)
    state = transition.state
    for (const effect of transition.effects) await controller.run(effect)
  }
  await send({ type: 'start', now, gates })
  expect(state.status).toBe('running')
  now = 2
  await send({ type: 'pause', now })
  expect(state.status).toBe('paused')
  for (const resource of all) expect(resource.dispose).toHaveBeenCalledTimes(1)
  now = 3
  await send({ type: 'resume', now, gates })
  expect(state.generation).toBe(2)
  now = 4
  await send({ type: 'end', now, reason: 'session-expired' })
  expect(state.result?.outcome).toBe('interrupted')
  expect(state.progress[0].verifiedMs).toBe(0)
  expect(state.progress[0].completed).toBe(false)
  for (const resource of all) expect(resource.dispose).toHaveBeenCalledTimes(1)
  await controller.close()
})

it('R-11 종료 뒤 이전 ready가 도착해도 engine은 부활하지 않고 해당 세대만 release한다', async () => {
  const { resources, ports, notice } = setup()
  const wait = deferred<ReturnType<typeof fresh>>()
  ports.camera.mockImplementationOnce(() => wait.promise)
  const controller = createResourceController(ports, notice)
  const start = advanceCoaching(engine(), { type: 'start', now: 1, gates })
  const task = controller.run(start.effects[0])
  await vi.waitFor(() => expect(ports.camera).toHaveBeenCalledTimes(1))
  const end = advanceCoaching(start.state, { type: 'end', now: 2, reason: 'page-hidden' })
  await controller.run(end.effects[0])
  wait.resolve(resources[0])
  await task
  expect(notice).not.toHaveBeenCalled()
  const late = advanceCoaching(end.state, { type: 'ready', now: 3, generation: 1 })
  expect(late.state).toBe(end.state)
  for (const effect of late.effects) await controller.run(effect)
  expect(resources[0].dispose).toHaveBeenCalledTimes(1)
  expect(ports.inference).not.toHaveBeenCalled()
  await controller.close()
})
