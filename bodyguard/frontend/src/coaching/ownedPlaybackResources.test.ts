// FR-S-02/04·FR-M-07/NFR-08: synthetic ownership gates, not clinical/camera proof.
import { describe, expect, it, vi } from 'vitest'
import type { PoseRigFrame } from '../avatar/observedPoseRig'
import { createOwnedPlaybackResources } from './ownedPlaybackResources'
import { createResourceController, ResourceCleanupError, type ResourceContext } from './resources'
import { createCoachingSession } from './session'

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const drain = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve()
}
function setup() {
  const events: string[] = [],
    callbacks = new Map<number, (at: number) => void>()
  let next = 0
  const scheduler = {
    request: vi.fn((callback: (at: number) => void) => {
      callbacks.set(++next, callback)
      return next
    }),
    cancel: vi.fn((id: number) => {
      callbacks.delete(id)
      events.push('cancel')
    }),
  }
  const cameras: { dispose: ReturnType<typeof vi.fn>; context: ResourceContext }[] = []
  const detectors: typeof cameras = []
  const pairs: {
    observe: ReturnType<typeof vi.fn>
    render: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }[] = []
  const sources: { read: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] = []
  const options = {
    camera: vi.fn(async (context: ResourceContext) => {
      const camera = {
        context,
        dispose: vi.fn(() => {
          events.push('camera-close')
        }),
      }
      cameras.push(camera)
      return camera
    }),
    inference: vi.fn(async (context: ResourceContext) => {
      const detector = {
        context,
        dispose: vi.fn(() => {
          events.push('detector-close')
        }),
      }
      detectors.push(detector)
      return detector
    }),
    avatars: vi.fn(async (_context: ResourceContext) => {
      const pair = {
        observe: vi.fn(() => true),
        render: vi.fn(() => ({ status: 'untracked' as const, tracked: 0, total: 8 })),
        dispose: vi.fn(() => {
          events.push('pair-close')
        }),
      }
      pairs.push(pair)
      return pair
    }),
    source: vi.fn((_context: ResourceContext) => {
      const source = {
        read: vi.fn(async (): Promise<PoseRigFrame | null> => null),
        dispose: vi.fn(async () => {
          events.push('source-close')
        }),
      }
      sources.push(source)
      return source
    }),
    scheduler,
    render: vi.fn(() => {
      events.push('render')
    }),
    onFailure: vi.fn(),
  }
  const actor = createOwnedPlaybackResources(options)
  const notices: unknown[] = []
  const controller = createResourceController(actor.ports, (notice) => {
    notices.push(notice)
  })
  const prepare = (generation = 1) => controller.run({ type: 'request-camera', generation })
  const fire = async (at: number) => {
    const entry = callbacks.entries().next().value
    if (!entry) throw new Error('No callback')
    callbacks.delete(entry[0])
    entry[1](at)
    await drain()
  }
  return {
    actor,
    options,
    controller,
    notices,
    prepare,
    fire,
    callbacks,
    cameras,
    detectors,
    pairs,
    sources,
    events,
  }
}
describe('owned playback resource cohort', () => {
  it('rejects the shared barrier for a tagged late partial cleanup failure', async () => {
    const f = setup(),
      abort = new AbortController(),
      context = { generation: 1, signal: abort.signal }
    const wrapper = await f.actor.ports.camera(context)
    const gate = deferred<Awaited<ReturnType<typeof f.options.inference>>>()
    f.options.inference.mockReturnValueOnce(gate.promise)
    const preparing = f.actor.ports.inference(context)
    const rejection = expect(preparing).rejects.toBeInstanceOf(ResourceCleanupError)
    const retiring = wrapper.dispose()
    const retired = expect(retiring).rejects.toBeInstanceOf(ResourceCleanupError)
    gate.reject(new ResourceCleanupError())
    await rejection
    await retired
    await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
  })
  it.each(['inference', 'avatars'] as const)(
    'reclaims prepared ownership after %s factory rejection',
    async (stage) => {
      const f = setup()
      f.options[stage].mockRejectedValueOnce(new Error('PRIVATE_FACTORY'))
      await f.prepare()
      await f.actor.close()
      expect(f.cameras[0].dispose).toHaveBeenCalledTimes(1)
      if (stage === 'avatars') expect(f.detectors[0].dispose).toHaveBeenCalledTimes(1)
      expect(f.options.source).not.toHaveBeenCalled()
      expect(f.notices).toEqual([
        {
          type: 'error',
          generation: 1,
          reason: stage === 'avatars' ? 'asset-error' : 'inference-error',
        },
      ])
    },
  )
  it.each(['inference', 'camera'] as const)(
    'continues all cleanup after %s disposal throws',
    async (stage) => {
      const f = setup()
      await f.prepare()
      f.actor.start(1)
      const owned = stage === 'camera' ? f.cameras[0] : f.detectors[0]
      owned.dispose.mockImplementationOnce(() => {
        throw new Error('PRIVATE_CLOSE')
      })
      await f.controller.close()
      await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
      for (const resource of [f.pairs[0], f.detectors[0], f.cameras[0]])
        expect(resource.dispose).toHaveBeenCalledTimes(1)
      expect(f.actor.getSnapshot()).toMatchObject({ failure: 'cleanup-error', poisoned: true })
    },
  )
  it('a reentrant observer may await controller shutdown without a read/cleanup deadlock', async () => {
    const f = setup()
    await f.prepare()
    f.actor.start(1)
    f.options.onFailure.mockImplementation(() => f.controller.close())
    f.sources[0].read.mockRejectedValueOnce(new Error('PRIVATE_READ'))
    await f.fire(10)
    await f.actor.close()
    expect(f.options.onFailure).toHaveBeenCalledTimes(1)
    expect(f.cameras[0].dispose).toHaveBeenCalledTimes(1)
  })
  it('preserves late factory cleanup failure and prevents replacement acquisition', async () => {
    const f = setup(),
      wait = deferred<Awaited<ReturnType<typeof f.options.inference>>>()
    f.options.inference.mockReturnValueOnce(wait.promise)
    const first = f.prepare()
    await vi.waitFor(() => expect(f.options.inference).toHaveBeenCalledTimes(1))
    const second = f.prepare(2)
    wait.reject(new ResourceCleanupError())
    await first
    await second
    expect(f.options.camera).toHaveBeenCalledTimes(1)
    expect(f.cameras[0].dispose).toHaveBeenCalledTimes(1)
    await f.controller.close()
    await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
  })
  it('invalidates a saved RAF synchronously at the controller abort boundary', async () => {
    const f = setup()
    await f.prepare()
    f.actor.start(1)
    const callback = [...f.callbacks.values()][0]
    const close = f.controller.close()
    callback(10)
    expect(f.options.render).not.toHaveBeenCalled()
    await close
    await f.actor.close()
  })
  it('rejects duplicate inference acquisition while the first factory is pending', async () => {
    const f = setup(),
      abort = new AbortController(),
      context = { generation: 1, signal: abort.signal }
    await f.actor.ports.camera(context)
    const gate = deferred<Awaited<ReturnType<typeof f.options.inference>>>()
    f.options.inference.mockReturnValueOnce(gate.promise)
    const first = f.actor.ports.inference(context)
    await expect(Promise.resolve().then(() => f.actor.ports.inference(context))).rejects.toThrow()
    await drain()
    expect(f.options.inference).toHaveBeenCalledTimes(1)
    gate.resolve({ context, dispose: vi.fn(() => {}) })
    await first
    await f.actor.close()
  })
  it('acquires nothing before explicit preparation and playback', async () => {
    const f = setup()
    expect(f.options.camera).not.toHaveBeenCalled()
    expect(f.actor.start(1)).toBe(false)
    await f.prepare()
    expect(f.notices).toEqual([{ type: 'ready', generation: 1 }])
    expect(f.options.source).not.toHaveBeenCalled()
    expect(f.actor.start(2)).toBe(false)
    expect(f.actor.start(1)).toBe(true)
    expect(f.actor.start(1)).toBe(false)
    await f.fire(10)
    expect(f.sources[0].read).toHaveBeenCalledTimes(1)
    await f.controller.close()
  })
  it('shares retirement while parallel controller cleanup waits for inference quiescence', async () => {
    const f = setup()
    await f.prepare()
    f.actor.start(1)
    const read = deferred<PoseRigFrame | null>(),
      barrier = deferred<void>()
    f.sources[0].read.mockReturnValueOnce(read.promise)
    f.sources[0].dispose.mockImplementationOnce(() => {
      f.events.push('source-close')
      return barrier.promise
    })
    await f.fire(10)
    const close = f.controller.close()
    await drain()
    expect(f.callbacks.size).toBe(0)
    expect(f.cameras[0].context.signal.aborted).toBe(false)
    expect(f.detectors[0].dispose).not.toHaveBeenCalled()
    expect(f.pairs[0].dispose).not.toHaveBeenCalled()
    read.resolve({
      generation: 1,
      sequence: 1,
      at: 10,
      result: { landmarks: [], worldLandmarks: [] },
    })
    barrier.resolve()
    await close
    expect(f.pairs[0].observe).not.toHaveBeenCalled()
    expect(f.cameras[0].context.signal.aborted).toBe(true)
    expect(f.events.slice(-3)).toEqual(['pair-close', 'detector-close', 'camera-close'])
    for (const resource of [f.sources[0], f.pairs[0], f.detectors[0], f.cameras[0]])
      expect(resource.dispose).toHaveBeenCalledTimes(1)
    await f.actor.close()
  })
  it('blocks fresh acquisition until an old pending result is reclaimed', async () => {
    const f = setup()
    await f.prepare()
    f.actor.start(1)
    const barrier = deferred<void>()
    f.sources[0].dispose.mockReturnValueOnce(barrier.promise)
    const replace = f.prepare(2)
    await drain()
    expect(f.options.camera).toHaveBeenCalledTimes(1)
    barrier.resolve()
    await replace
    expect(f.options.camera).toHaveBeenCalledTimes(2)
    expect(f.actor.start(1)).toBe(false)
    expect(f.actor.start(2)).toBe(true)
    await f.controller.close()
  })
  it('aborts preparing factories and reclaims a late owned value without ready', async () => {
    const f = setup(),
      gate = deferred<Awaited<ReturnType<typeof f.options.camera>>>()
    f.options.camera.mockReturnValueOnce(gate.promise)
    const start = f.prepare()
    await drain()
    const context = f.options.camera.mock.calls[0][0]
    const close = f.controller.close()
    await drain()
    expect(context.signal.aborted).toBe(true)
    const old = { context, dispose: vi.fn(() => {}) }
    gate.resolve(old)
    await start
    await close
    await f.actor.close()
    expect(old.dispose).toHaveBeenCalledTimes(1)
    expect(f.options.inference).not.toHaveBeenCalled()
    expect(f.notices).toEqual([])
  })
  it('continues native cleanup after source failure and quarantines the bridge', async () => {
    const f = setup()
    await f.prepare()
    f.actor.start(1)
    f.sources[0].dispose.mockRejectedValueOnce(new Error('PRIVATE_NATIVE_FAILURE'))
    await f.controller.close()
    expect(f.options.onFailure).toHaveBeenCalledWith({
      type: 'error',
      generation: 1,
      reason: 'cleanup-error',
    })
    expect(f.detectors[0].dispose).toHaveBeenCalledTimes(1)
    expect(f.cameras[0].dispose).toHaveBeenCalledTimes(1)
    await expect(f.actor.close()).rejects.toBeInstanceOf(ResourceCleanupError)
    expect(JSON.stringify(f.actor.getSnapshot())).not.toContain('PRIVATE_NATIVE_FAILURE')
  })
  it('retires borrowed native resources on asynchronous playback failure', async () => {
    const f = setup()
    await f.prepare()
    f.actor.start(1)
    f.sources[0].read.mockRejectedValueOnce(new Error('PRIVATE_POINTS'))
    await f.fire(10)
    await drain()
    expect(f.options.onFailure).toHaveBeenCalledWith({
      type: 'error',
      generation: 1,
      reason: 'inference-error',
    })
    expect(f.detectors[0].dispose).toHaveBeenCalledTimes(1)
    expect(f.cameras[0].dispose).toHaveBeenCalledTimes(1)
    expect(f.actor.start(1)).toBe(false)
    await f.controller.close()
    await f.actor.close()
  })
  it('does not dispose another bridge camera alias', async () => {
    const first = setup()
    await first.prepare()
    const second = setup()
    second.options.camera.mockResolvedValueOnce(
      first.cameras[0] as Awaited<ReturnType<typeof second.options.camera>>,
    )
    await second.prepare()
    expect(first.cameras[0].dispose).not.toHaveBeenCalled()
    expect(second.options.inference).not.toHaveBeenCalled()
    expect(second.notices).toEqual([{ type: 'error', generation: 1, reason: 'camera-error' }])
    await second.controller.close()
    await second.actor.close()
    await first.controller.close()
  })
  it.each(['throw', 'reject'] as const)(
    'quarantines a %s failure observer without recursion',
    async (kind) => {
      const f = setup()
      await f.prepare()
      f.actor.start(1)
      if (kind === 'throw')
        f.options.onFailure.mockImplementation(() => {
          throw new Error('PRIVATE_OBSERVER')
        })
      else f.options.onFailure.mockRejectedValue(new Error('PRIVATE_OBSERVER'))
      f.sources[0].read.mockRejectedValueOnce(new Error('PRIVATE_POINTS'))
      await f.fire(10)
      await drain()
      expect(f.options.onFailure).toHaveBeenCalledTimes(1)
      expect(f.cameras[0].dispose).toHaveBeenCalledTimes(1)
      await f.controller.close()
      await f.actor.close()
    },
  )
  it('session pause/resume/expiry use new cohorts without declaring a valid exercise', async () => {
    const f = setup()
    let at = 0,
      authenticated = true
    const session = createCoachingSession({
      plan: {
        motionId: 'fixture-not-release',
        version: 'synthetic-only',
        source: 'direct',
        maxFrameAgeMs: 100,
        maxFrameGapMs: 200,
        steps: [{ id: 'synthetic-hold', kind: 'hold', targetMs: 100 }],
      },
      ports: f.actor.ports,
      now: () => at,
      readGates: () => ({
        authenticated,
        motionValidated: true,
        referenceAvatarReady: true,
        userAvatarReady: true,
      }),
      onChange: (snapshot) => {
        if (snapshot.state.status === 'running') f.actor.start(snapshot.state.generation)
      },
    })
    await session.start()
    expect(f.actor.getSnapshot()).toMatchObject({ generation: 1, status: 'running' })
    await session.pause()
    expect(f.cameras[0].dispose).toHaveBeenCalledTimes(1)
    at = 1
    await session.resume()
    expect(f.actor.getSnapshot()).toMatchObject({ generation: 2, status: 'running' })
    authenticated = false
    at = 2
    await session.tick()
    expect(session.getSnapshot().state.result?.reason).toBe('session-expired')
    expect(session.getSnapshot().state.progress[0].verifiedMs).toBe(0)
    expect(f.cameras[1].dispose).toHaveBeenCalledTimes(1)
    await f.actor.close()
  })
  it('unqualified session does not acquire or play a cohort', async () => {
    const f = setup()
    const session = createCoachingSession({
      plan: {
        motionId: 'fixture-not-release',
        version: 'synthetic-only',
        source: 'direct',
        maxFrameAgeMs: 100,
        maxFrameGapMs: 200,
        steps: [{ id: 'synthetic-hold', kind: 'hold', targetMs: 100 }],
      },
      ports: f.actor.ports,
      now: () => 0,
      readGates: () => ({
        authenticated: true,
        motionValidated: false,
        referenceAvatarReady: true,
        userAvatarReady: true,
      }),
      onChange: vi.fn(),
    })
    await session.start()
    expect(f.options.camera).not.toHaveBeenCalled()
    await session.end('page-hidden')
    await f.actor.close()
  })
})
