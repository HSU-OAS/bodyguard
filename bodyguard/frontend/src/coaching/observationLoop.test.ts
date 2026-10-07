// FR-M-07/FR-S-02/04/NFR-08: synthetic provider/manual scheduler; not camera/posture verification.
import { expect, it, vi } from 'vitest'
import type { CoachingEvent } from '../stretch/progression'
import { createObservationLoop } from './observationLoop'
import { createCoachingSession } from './session'

type Observation = Omit<Extract<CoachingEvent, { type: 'frame' }>, 'type' | 'now'>
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function setup() {
  let clock = 0
  let id = 0
  let loop: ReturnType<typeof createObservationLoop> | null = null
  const queued = new Map<number, () => void>()
  const scheduler = {
    request: vi.fn((callback: () => void) => {
      const handle = ++id
      queued.set(handle, callback)
      return handle
    }),
    cancel: vi.fn((handle: number) => {
      queued.delete(handle)
    }),
  }
  const gates = {
    authenticated: true,
    motionValidated: true,
    referenceAvatarReady: true,
    userAvatarReady: true,
  }
  const resources: { dispose: ReturnType<typeof vi.fn<() => void>> }[] = []
  const factory = () => {
    const resource = { dispose: vi.fn<() => void>() }
    resources.push(resource)
    return resource
  }
  const session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
    },
    ports: { camera: factory, inference: factory, avatars: factory },
    now: () => clock,
    readGates: () => gates,
    onChange: () => {
      loop?.sync()
    },
  })
  const methods = {
    getSnapshot: session.getSnapshot,
    tick: vi.fn(session.tick),
    observe: vi.fn(session.observe),
    end: vi.fn(session.end),
  }
  const readFrame = vi
    .fn<
      (context: {
        generation: number
        signal: AbortSignal
      }) => Observation | null | Promise<Observation | null>
    >()
    .mockReturnValue(null)
  loop = createObservationLoop({ session: methods, scheduler, readFrame })
  return {
    loop,
    queued,
    scheduler,
    gates,
    session,
    methods,
    resources,
    readFrame,
    at: (value: number) => {
      clock = value
    },
    fire: () => {
      const item = [...queued][0]
      expect(item).toBeDefined()
      queued.delete(item[0])
      item[1]()
    },
  }
}
const observation = (
  sampledAt: number,
  classification: Observation['classification'],
  generation = 1,
): Observation => ({
  generation,
  sampledAt,
  sequence: sampledAt,
  personCount: 1,
  stepId: 'hold',
  classification,
})
const privateFailure = () => new Error('PRIVATE_OBSERVATION_LOOP_COORDINATES')
async function deliver(h: ReturnType<typeof setup>, frame: Observation) {
  const calls = h.methods.observe.mock.calls.length
  h.at(frame.sampledAt)
  h.readFrame.mockReturnValueOnce(frame)
  h.fire()
  await vi.waitFor(() => expect(h.methods.observe.mock.calls.length).toBe(calls + 1))
}

it('L01 constructor/idle never schedules or reads frames', async () => {
  const session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
    },
    ports: {
      camera: () => ({ dispose() {} }),
      inference: () => ({ dispose() {} }),
      avatars: () => ({ dispose() {} }),
    },
    now: () => 0,
    readGates: () => ({
      authenticated: false,
      motionValidated: false,
      referenceAvatarReady: false,
      userAvatarReady: false,
    }),
    onChange: vi.fn(),
  })
  const scheduler = { request: vi.fn(() => 1), cancel: vi.fn() }
  const readFrame = vi.fn()
  const loop = createObservationLoop({ session, scheduler, readFrame })
  loop.sync()
  await session.start()
  loop.sync()
  expect(scheduler.request).not.toHaveBeenCalled()
  expect(readFrame).not.toHaveBeenCalled()
  expect(Object.keys(loop)).toEqual(['sync', 'close'])
  await loop.close()
})

it('L01 pending preparation does not schedule until real session resource ready', async () => {
  const wait = deferred<{ dispose(): void }>()
  const scheduler = { request: vi.fn(() => 1), cancel: vi.fn() }
  const readFrame = vi.fn()
  const session = createCoachingSession({
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
    },
    ports: {
      camera: () => wait.promise,
      inference: () => ({ dispose() {} }),
      avatars: () => ({ dispose() {} }),
    },
    now: () => 0,
    readGates: () => ({
      authenticated: true,
      motionValidated: true,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange: vi.fn(),
  })
  const loop = createObservationLoop({ session, scheduler, readFrame })
  const starting = session.start()
  loop.sync()
  expect(scheduler.request).not.toHaveBeenCalled()
  wait.resolve({ dispose() {} })
  await starting
  loop.sync()
  expect(scheduler.request).toHaveBeenCalledTimes(1)
  loop.sync()
  expect(scheduler.request).toHaveBeenCalledTimes(1)
  await loop.close()
})
it('L02 null is not target and single pending provider still allows tick but no overlap', async () => {
  const h = setup()
  await h.session.start()
  await deliver(h, observation(1, 'start'))
  await deliver(h, observation(2, 'target'))
  const wait = deferred<Observation | null>()
  h.readFrame.mockReturnValueOnce(wait.promise)
  h.at(3)
  h.fire()
  await vi.waitFor(() => expect(h.readFrame).toHaveBeenCalledTimes(3))
  const context = h.readFrame.mock.calls[2][0]
  expect(context.generation).toBe(1)
  expect(context.signal.aborted).toBe(false)
  expect(Object.isFrozen(context)).toBe(true)
  h.at(250)
  h.fire()
  await vi.waitFor(() => expect(h.methods.tick).toHaveBeenCalledTimes(4))
  expect(h.readFrame).toHaveBeenCalledTimes(3)
  expect(h.session.getSnapshot().state.phase).toBe('waiting-start')
  expect(h.session.getSnapshot().state.progress[0].holdMs).toBe(0)
  wait.resolve(null)
  await h.loop.close()
  expect(context.signal.aborted).toBe(true)
  expect(h.queued.size).toBe(0)
})
it('L03 original observations reach real engine unmodified and start/target/return completes', async () => {
  const h = setup()
  await h.session.start()
  const frames = [
    observation(1, 'start'),
    observation(2, 'target'),
    observation(102, 'target'),
    observation(103, 'returned'),
  ]
  for (const frame of frames) await deliver(h, frame)
  expect(h.methods.observe.mock.calls.map((call) => call[0])).toEqual(frames)
  for (let i = 0; i < frames.length; i++) expect(h.methods.observe.mock.calls[i][0]).toBe(frames[i])
  expect(h.session.getSnapshot().state.result?.outcome).toBe('completed')
  expect(h.queued.size).toBe(0)
  for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
  await h.loop.close()
})
it.each(['generation', 'step', 'multiple', 'unobservable'] as const)(
  'L03 %s remains withheld by the engine, not corrected by loop',
  async (kind) => {
    const h = setup()
    await h.session.start()
    const frame = {
      ...observation(1, 'start'),
      ...(kind === 'generation'
        ? { generation: 99 }
        : kind === 'step'
          ? { stepId: 'other' }
          : kind === 'multiple'
            ? { personCount: 2 }
            : { classification: 'unobservable' as const }),
    }
    await deliver(h, frame)
    expect(h.methods.observe).toHaveBeenCalledWith(frame)
    expect(h.session.getSnapshot().state.phase).toBe('waiting-start')
    expect(h.session.getSnapshot().state.progress[0].holdMs).toBe(0)
    await h.loop.close()
  },
)
it.each(['resolve', 'reject'] as const)(
  'L04 past provider %s cannot affect resumed generation',
  async (mode) => {
    const h = setup()
    const wait = deferred<Observation | null>()
    h.readFrame.mockReturnValueOnce(wait.promise)
    await h.session.start()
    h.fire()
    await vi.waitFor(() => expect(h.readFrame).toHaveBeenCalledTimes(1))
    const oldSignal = h.readFrame.mock.calls[0][0].signal
    await h.session.pause()
    expect(oldSignal.aborted).toBe(true)
    expect(h.queued.size).toBe(0)
    h.at(1)
    await h.session.resume()
    expect(h.queued.size).toBe(1)
    if (mode === 'resolve') wait.resolve(observation(1, 'start', 1))
    else wait.reject(privateFailure())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(h.methods.observe).not.toHaveBeenCalled()
    expect(h.methods.end).not.toHaveBeenCalled()
    expect(h.session.getSnapshot().state.status).toBe('running')
    expect(h.session.getSnapshot().state.generation).toBe(2)
    await h.loop.close()
  },
)
it('L04 permanent close cancels without waiting for an unresolved provider or restarting', async () => {
  const h = setup()
  const wait = deferred<Observation | null>()
  h.readFrame.mockReturnValueOnce(wait.promise)
  await h.session.start()
  h.fire()
  await vi.waitFor(() => expect(h.readFrame).toHaveBeenCalledTimes(1))
  await h.loop.close()
  await h.loop.close()
  h.loop.sync()
  expect(h.queued.size).toBe(0)
  expect(h.methods.end).toHaveBeenCalledTimes(1)
  wait.resolve(observation(1, 'target'))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(h.methods.observe).not.toHaveBeenCalled()
})
it.each(['throw', 'reject'] as const)(
  'L05 provider %s ends with fixed inference-error and frees actual session claims',
  async (mode) => {
    const h = setup()
    h.readFrame.mockImplementation(() => {
      if (mode === 'throw') throw privateFailure()
      return Promise.reject(privateFailure())
    })
    await h.session.start()
    h.fire()
    await vi.waitFor(() => expect(h.session.getSnapshot().closed).toBe(true))
    expect(h.session.getSnapshot().state.result?.reason).toBe('inference-error')
    expect(h.methods.end).toHaveBeenCalledExactlyOnceWith('inference-error')
    expect(h.queued.size).toBe(0)
    for (const resource of h.resources) expect(resource.dispose).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(h.session.getSnapshot())).not.toContain('PRIVATE_')
  },
)
it('L05 scheduler request failure ends with callback-error without raw error escape', async () => {
  const h = setup()
  h.scheduler.request.mockImplementation(() => {
    throw privateFailure()
  })
  await h.session.start()
  await vi.waitFor(() => expect(h.session.getSnapshot().closed).toBe(true))
  expect(h.methods.end).toHaveBeenCalledExactlyOnceWith('callback-error')
  expect(h.queued.size).toBe(0)
})
it('L06 expiry on tick stops provider and queued work rather than restarting', async () => {
  const h = setup()
  await h.session.start()
  h.gates.authenticated = false
  h.at(1)
  h.fire()
  await vi.waitFor(() => expect(h.session.getSnapshot().closed).toBe(true))
  expect(h.readFrame).not.toHaveBeenCalled()
  expect(h.session.getSnapshot().state.result?.reason).toBe('session-expired')
  expect(h.queued.size).toBe(0)
  h.loop.sync()
  expect(h.queued.size).toBe(0)
})

it('L04 duplicate callback from an old reservation cannot clear the current reservation', async () => {
  const h = setup()
  await h.session.start()
  const oldCallback = [...h.queued.values()][0]
  h.fire()
  await vi.waitFor(() => expect(h.readFrame).toHaveBeenCalledTimes(1))
  const currentIds = [...h.queued.keys()]
  oldCallback()
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(h.methods.tick).toHaveBeenCalledTimes(1)
  expect([...h.queued.keys()]).toEqual(currentIds)
  expect(h.queued.size).toBe(1)
  await h.loop.close()
})
it('L05 a synchronous instead of deferred scheduler is rejected without runaway callbacks', async () => {
  const h = setup()
  h.scheduler.request.mockImplementation((callback) => {
    callback()
    return 9
  })
  await h.session.start()
  await vi.waitFor(() => expect(h.session.getSnapshot().closed).toBe(true))
  expect(h.methods.end).toHaveBeenCalledExactlyOnceWith('callback-error')
  expect(h.readFrame).not.toHaveBeenCalled()
  expect(h.methods.tick).not.toHaveBeenCalled()
  expect(h.scheduler.cancel).toHaveBeenCalledWith(9)
})
it('L05 cancellation failure quarantines permanently and old callback cannot read', async () => {
  const h = setup()
  await h.session.start()
  const callback = [...h.queued.values()][0]
  h.scheduler.cancel.mockImplementation(() => {
    throw privateFailure()
  })
  await h.loop.close()
  callback()
  h.loop.sync()
  expect(h.methods.end).toHaveBeenCalledExactlyOnceWith('callback-error')
  expect(h.readFrame).not.toHaveBeenCalled()
})
it('L03 late samples retain the original time and cannot re-arm a fresh hold', async () => {
  const h = setup()
  await h.session.start()
  const wait = deferred<Observation | null>()
  h.readFrame.mockReturnValueOnce(wait.promise)
  h.fire()
  await vi.waitFor(() => expect(h.readFrame).toHaveBeenCalledTimes(1))
  h.at(500)
  const frame = observation(1, 'start')
  wait.resolve(frame)
  await vi.waitFor(() => expect(h.methods.observe).toHaveBeenCalledWith(frame))
  expect(h.session.getSnapshot().state.phase).toBe('waiting-start')
  expect(h.session.getSnapshot().state.lastSampledAt).toBeNull()
  await h.loop.close()
})
