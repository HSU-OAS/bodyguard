// FR-A-03·FR-M-07/NFR-07/08: deterministic rendering/ownership, no camera or actual posture.
import { describe, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import type { PoseRigFrame } from './observedPoseRig'
import { createOwnedPosePlayback } from './ownedPosePlayback'

const drain = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function setup() {
  const abort = new AbortController()
  const callbacks = new Map<number, (at: number) => void>()
  let next = 0
  const scheduler = {
    request: vi.fn((callback: (at: number) => void) => {
      callbacks.set(++next, callback)
      return next
    }),
    cancel: vi.fn((handle: number) => {
      callbacks.delete(handle)
    }),
  }
  const source = {
    read: vi.fn(async (): Promise<PoseRigFrame | null> => null),
    dispose: vi.fn(async () => {}),
  }
  const avatars = {
    observe: vi.fn(() => true),
    render: vi.fn(() => ({ status: 'untracked' as const, tracked: 0, total: 8 })),
    dispose: vi.fn(() => {}),
  }
  const render = vi.fn(() => {})
  const options = {
    context: { generation: 1, signal: abort.signal },
    source,
    avatars,
    scheduler,
    render,
  }
  const frame = (sequence = 1): PoseRigFrame => ({
    generation: 1,
    sequence,
    at: 12,
    result: { landmarks: [], worldLandmarks: [] },
  })
  const fire = async (at: number) => {
    const entry = callbacks.entries().next().value
    if (!entry) throw new Error('No scheduled frame')
    callbacks.delete(entry[0])
    entry[1](at)
    await drain()
  }
  return { ...options, options, abort, callbacks, fire, frame }
}
describe('owned continuous pose playback', () => {
  it('preserves a tagged partial cleanup failure even if source disposal later resolves', async () => {
    const f = setup()
    f.source.read.mockRejectedValueOnce(new ResourceCleanupError())
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(10)
    await expect(playback.dispose()).rejects.toThrow('Resource cleanup failed')
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
    expect(playback.getSnapshot()).toMatchObject({ status: 'failed', failure: 'cleanup-error' })
  })
  it('keeps rendering when the rig rejects an expired observation without making it fresh', async () => {
    const f = setup(),
      original = { ...f.frame(), at: 0 }
    f.source.read.mockResolvedValueOnce(original)
    f.avatars.observe.mockReturnValueOnce(false)
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(1000)
    expect(f.avatars.observe).toHaveBeenCalledExactlyOnceWith(original)
    expect(playback.getSnapshot()).toMatchObject({ status: 'running', failure: null })
    await f.fire(1016)
    expect(f.render).toHaveBeenCalledTimes(2)
    await playback.dispose()
  })
  it('reports cleanup failure even when a synchronous scheduler returns a late handle', async () => {
    const f = setup()
    f.scheduler.request.mockImplementationOnce((callback) => {
      callback(10)
      return 7
    })
    f.scheduler.cancel.mockImplementationOnce(() => {
      throw new Error('private scheduler')
    })
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await expect(playback.dispose()).rejects.toThrow('Resource cleanup failed')
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
    expect(playback.getSnapshot().failure).toBe('cleanup-error')
  })
  it('starts explicitly, renders original deltas, and preserves a supplied frame', async () => {
    const f = setup(),
      frame = f.frame()
    f.source.read.mockResolvedValueOnce(frame)
    const playback = createOwnedPosePlayback(f.options)
    expect(f.scheduler.request).not.toHaveBeenCalled()
    expect(f.source.read).not.toHaveBeenCalled()
    expect(playback.start()).toBe(true)
    expect(playback.start()).toBe(false)
    await f.fire(10)
    expect(f.avatars.render).toHaveBeenLastCalledWith(10, 0)
    expect(f.avatars.observe).toHaveBeenCalledExactlyOnceWith(frame)
    await f.fire(26)
    expect(f.avatars.render).toHaveBeenLastCalledWith(26, 16)
    expect(f.callbacks.size).toBe(1)
    await playback.dispose()
    expect(f.callbacks.size).toBe(0)
  })
  it('continues rendering during one pending inference without concurrent reads', async () => {
    const f = setup(),
      gate = deferred<PoseRigFrame | null>()
    f.source.read.mockReturnValueOnce(gate.promise)
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(10)
    await f.fire(300)
    await f.fire(600)
    expect(f.source.read).toHaveBeenCalledTimes(1)
    expect(f.avatars.render).toHaveBeenCalledTimes(3)
    expect(f.avatars.render).toHaveBeenLastCalledWith(600, 300)
    gate.resolve(f.frame())
    await drain()
    expect(f.avatars.observe).toHaveBeenCalledTimes(1)
    await playback.dispose()
  })
  it('waits for source quiescence before pair disposal and drops late frames', async () => {
    const f = setup(),
      reading = deferred<PoseRigFrame | null>(),
      retiring = deferred<void>()
    f.source.read.mockReturnValueOnce(reading.promise)
    f.source.dispose.mockReturnValueOnce(retiring.promise)
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(10)
    const close = playback.dispose()
    expect(playback.dispose()).toBe(close)
    await drain()
    expect(f.avatars.dispose).not.toHaveBeenCalled()
    reading.resolve(f.frame())
    retiring.resolve()
    await close
    expect(f.avatars.observe).not.toHaveBeenCalled()
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
    expect(playback.start()).toBe(false)
  })
  it('aborts without rendering or delivering a saved callback', async () => {
    const f = setup(),
      playback = createOwnedPosePlayback(f.options)
    playback.start()
    const callback = [...f.callbacks.values()][0]
    f.abort.abort()
    callback(10)
    await playback.dispose()
    expect(f.render).not.toHaveBeenCalled()
    expect(f.source.read).not.toHaveBeenCalled()
  })
  it('quarantines provider errors without forwarding raw values', async () => {
    const f = setup()
    f.source.read.mockRejectedValueOnce(new Error('PRIVATE_PLAYBACK_POINTS'))
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(10)
    await playback.dispose()
    expect(playback.getSnapshot()).toMatchObject({ status: 'failed', failure: 'inference-error' })
    expect(JSON.stringify(playback.getSnapshot())).not.toContain('PRIVATE_PLAYBACK_POINTS')
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
  })
  it('continues cleanup after a source close failure', async () => {
    const f = setup()
    f.source.dispose.mockRejectedValueOnce(new Error('private cleanup'))
    const playback = createOwnedPosePlayback(f.options)
    await expect(playback.dispose()).rejects.toThrow('Resource cleanup failed')
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
    expect(playback.getSnapshot().failure).toBe('cleanup-error')
    await expect(playback.dispose()).rejects.toThrow('Resource cleanup failed')
  })
  it('rejects source or pair aliases without disposing another owner', async () => {
    const f = setup(),
      first = createOwnedPosePlayback(f.options),
      second = setup()
    expect(() => createOwnedPosePlayback({ ...second.options, source: f.source })).toThrow()
    expect(() => createOwnedPosePlayback({ ...second.options, avatars: f.avatars })).toThrow()
    expect(f.source.dispose).not.toHaveBeenCalled()
    expect(f.avatars.dispose).not.toHaveBeenCalled()
    await first.dispose()
    expect(() => createOwnedPosePlayback(f.options)).toThrow()
  })
  it('rejects synchronous scheduler callbacks and cancels their late handle', async () => {
    const f = setup()
    f.scheduler.request.mockImplementationOnce((callback) => {
      callback(10)
      return 7
    })
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await playback.dispose()
    expect(f.scheduler.cancel).toHaveBeenCalledWith(7)
    expect(f.source.read).not.toHaveBeenCalled()
    expect(playback.getSnapshot().failure).toBe('callback-error')
  })
  it('rejects invalid callback clocks and ends rather than producing negative delta', async () => {
    const f = setup(),
      playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(10)
    await f.fire(9)
    await playback.dispose()
    expect(f.avatars.render).toHaveBeenCalledTimes(1)
    expect(playback.getSnapshot().failure).toBe('callback-error')
  })
  it.each([NaN, Infinity, -1])('rejects non-native clock %s', async (at) => {
    const f = setup(),
      playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(at)
    await playback.dispose()
    expect(f.render).not.toHaveBeenCalled()
    expect(f.source.read).not.toHaveBeenCalled()
  })
  it('reclaims both resources after a renderer throws without starting inference', async () => {
    const f = setup()
    f.render.mockImplementationOnce(() => {
      throw new Error('private renderer')
    })
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(10)
    await playback.dispose()
    expect(f.source.read).not.toHaveBeenCalled()
    expect(f.source.dispose).toHaveBeenCalledTimes(1)
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
    expect(playback.getSnapshot().failure).toBe('callback-error')
  })
  it('continues source and pair cleanup after cancellation throws', async () => {
    const f = setup()
    f.scheduler.cancel.mockImplementationOnce(() => {
      throw new Error('private cancel')
    })
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    const callback = [...f.callbacks.values()][0]
    await expect(playback.dispose()).rejects.toThrow('Resource cleanup failed')
    callback(10)
    expect(f.source.read).not.toHaveBeenCalled()
    expect(f.source.dispose).toHaveBeenCalledTimes(1)
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
  })
  it('does not deliver a foreign generation to the avatar', async () => {
    const f = setup()
    f.source.read.mockResolvedValueOnce({ ...f.frame(), generation: 2 })
    const playback = createOwnedPosePlayback(f.options)
    playback.start()
    await f.fire(10)
    await playback.dispose()
    expect(f.avatars.observe).not.toHaveBeenCalled()
    expect(playback.getSnapshot().failure).toBe('ownership-error')
  })
  it('does not schedule or acquire after renderer reentrant disposal', async () => {
    const f = setup(),
      playback = createOwnedPosePlayback(f.options)
    f.render.mockImplementationOnce(() => {
      void playback.dispose()
    })
    playback.start()
    await f.fire(10)
    await playback.dispose()
    expect(f.source.read).not.toHaveBeenCalled()
    expect(f.callbacks.size).toBe(0)
  })
  it('rejects asynchronous rendering safely and closes its source', async () => {
    const f = setup()
    const playback = createOwnedPosePlayback({
      ...f.options,
      render: () => Promise.reject(new Error('private async')),
    })
    playback.start()
    await f.fire(10)
    await playback.dispose()
    expect(f.source.read).not.toHaveBeenCalled()
    expect(playback.getSnapshot().failure).toBe('callback-error')
  })
  it('records an avatar cleanup fault without retrying disposal', async () => {
    const f = setup()
    f.avatars.dispose.mockImplementationOnce(() => {
      throw new Error('private avatar')
    })
    const playback = createOwnedPosePlayback(f.options)
    await expect(playback.dispose()).rejects.toThrow('Resource cleanup failed')
    await expect(playback.dispose()).rejects.toThrow('Resource cleanup failed')
    expect(f.source.dispose).toHaveBeenCalledTimes(1)
    expect(f.avatars.dispose).toHaveBeenCalledTimes(1)
  })
  it('rejects already aborted configuration without consuming or closing caller resources', async () => {
    const f = setup()
    f.abort.abort()
    expect(() => createOwnedPosePlayback(f.options)).toThrow('Invalid owned pose playback')
    expect(f.source.dispose).not.toHaveBeenCalled()
    expect(f.avatars.dispose).not.toHaveBeenCalled()
  })
})
