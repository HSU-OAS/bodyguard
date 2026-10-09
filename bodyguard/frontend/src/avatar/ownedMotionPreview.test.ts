// FR-A-03·FR-M-01/NFR-08: selection preview only; deterministic clocks, no camera or clinical gate.
import { describe, expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { createOwnedMotionPreview, type PreviewAsset } from './ownedMotionPreview'

const drain = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const asset = () => ({ durationMs: 1000, draw: vi.fn<(ms: number) => void>(), dispose: vi.fn() })
function setup() {
  let next = 0
  const callbacks = new Map<number, (at: number) => void>()
  const request = vi.fn((cb: (at: number) => void) => {
    callbacks.set(++next, cb)
    return next
  })
  const cancel = vi.fn((handle: number) => {
    callbacks.delete(handle)
  })
  const model = asset()
  const load = vi.fn(async (_id: string, _signal: AbortSignal): Promise<PreviewAsset> => model)
  const player = createOwnedMotionPreview({ load, scheduler: { request, cancel } })
  const fire = (at: number) => {
    const entry = callbacks.entries().next().value
    if (!entry) throw new Error('No queued frame')
    callbacks.delete(entry[0])
    entry[1](at)
  }
  return { player, model, load, request, cancel, callbacks, fire }
}
describe('owned selection motion preview', () => {
  it('does not call a factory cancelled before its acquisition microtask', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    f.player.update({ pointer: false })
    await drain()
    expect(f.load).not.toHaveBeenCalled()
    await f.player.dispose()
  })
  it('rejects overflowing clip-time arithmetic before passing nonfinite values to draw', async () => {
    const f = setup()
    f.model.durationMs = Number.MIN_VALUE
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    f.fire(0)
    f.fire(100)
    expect(f.player.snapshot().failure).toBe('clock-failed')
    expect(f.model.draw.mock.calls.every(([at]) => Number.isFinite(at))).toBe(true)
    await f.player.dispose()
  })
  it('retains a cancelled factory partial-cleanup failure and does not load its replacement', async () => {
    const f = setup(),
      pending = deferred<PreviewAsset>()
    f.load.mockImplementationOnce(() => pending.promise)
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    f.player.select('female')
    pending.reject(new ResourceCleanupError())
    await drain()
    expect(f.player.snapshot().failure).toBe('cleanup-failed')
    expect(f.load).toHaveBeenCalledTimes(1)
    await expect(f.player.dispose()).rejects.toThrow('Motion preview cleanup failed')
  })
  it('rejects inherited intent keys without mutating the current input', () => {
    const f = setup()
    expect(() => f.player.update({ toString: true } as never)).toThrow(
      'Invalid motion preview input',
    )
    expect(f.player.snapshot().status).toBe('idle')
  })
  it('reserves the identical disposal promise before a release can re-enter disposal', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    let nested: Promise<void> | undefined
    f.model.dispose.mockImplementation(() => {
      nested = f.player.dispose()
    })
    const original = f.player.dispose()
    expect(nested).toBe(original)
    await original
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
  })
  it('quarantines a synchronous scheduler and cancels its returned handle', async () => {
    const f = setup()
    f.request.mockImplementation((cb) => {
      cb(0)
      return 42
    })
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    expect(f.player.snapshot().failure).toBe('scheduler-failed')
    expect(f.cancel).toHaveBeenCalledWith(42)
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
    await f.player.dispose()
  })
  it('does not load until an input requests the selected preview', async () => {
    const f = setup()
    f.player.select('male')
    await drain()
    expect(f.load).not.toHaveBeenCalled()
    expect(f.player.snapshot().status).toBe('idle')
    f.player.update({ pointer: true })
    await drain()
    expect(f.load).toHaveBeenCalledTimes(1)
    expect(f.player.snapshot().status).toBe('playing')
    expect(f.callbacks.size).toBe(1)
  })
  it('samples the authored motion forward and back without an endpoint jump', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    for (const at of [100, 600, 1100, 1600, 2100]) f.fire(at)
    expect(f.model.draw.mock.calls.map(([at]) => at)).toEqual([0, 0, 500, 1000, 500, 0])
    await f.player.dispose()
  })
  it('keeps playing on pointer leave while focused, then resets and releases once', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true, focus: true })
    await drain()
    f.fire(10)
    f.fire(510)
    f.player.update({ pointer: false })
    expect(f.model.dispose).not.toHaveBeenCalled()
    expect(f.callbacks.size).toBe(1)
    f.player.update({ focus: false })
    await drain()
    expect(f.model.draw).toHaveBeenLastCalledWith(0)
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
    expect(f.callbacks.size).toBe(0)
    expect(f.player.snapshot().status).toBe('idle')
    await f.player.dispose()
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
  })
  it('requires an explicit play request with reduced motion and never plays hidden', async () => {
    const f = setup()
    f.player.select('female')
    f.player.update({ pointer: true, focus: true, reducedMotion: true })
    await drain()
    expect(f.load).not.toHaveBeenCalled()
    f.player.update({ manual: true })
    await drain()
    expect(f.callbacks.size).toBe(1)
    f.player.update({ visible: false })
    await drain()
    expect(f.callbacks.size).toBe(0)
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
    f.player.update({ manual: true })
    await drain()
    expect(f.load).toHaveBeenCalledTimes(1)
    await f.player.dispose()
  })
  it('aborts a pending selection and waits before loading the latest one', async () => {
    const f = setup(),
      pending = deferred<PreviewAsset>(),
      late = asset(),
      current = asset()
    f.load.mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(current)
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    const signal = f.load.mock.calls[0][1]
    f.player.select('female')
    await drain()
    expect(signal.aborted).toBe(true)
    expect(f.load).toHaveBeenCalledTimes(1)
    pending.resolve(late)
    await drain()
    expect(late.draw).not.toHaveBeenCalled()
    expect(late.dispose).toHaveBeenCalledTimes(1)
    expect(f.load).toHaveBeenLastCalledWith('female', expect.any(AbortSignal))
    expect(current.draw).toHaveBeenCalledWith(0)
    await f.player.dispose()
  })
  it('waits for a late load to release before disposal resolves', async () => {
    const f = setup(),
      pending = deferred<PreviewAsset>(),
      late = asset()
    f.load.mockImplementation(() => pending.promise)
    f.player.select('male')
    f.player.update({ focus: true })
    await drain()
    let done = false
    const original = f.player.dispose(),
      closed = original.then(() => {
        done = true
      })
    await drain()
    expect(done).toBe(false)
    pending.resolve(late)
    await closed
    expect(late.draw).not.toHaveBeenCalled()
    expect(late.dispose).toHaveBeenCalledTimes(1)
    expect(f.player.snapshot().status).toBe('closed')
    expect(f.callbacks.size).toBe(0)
    expect(f.player.dispose()).toBe(original)
  })
  it('quarantines late cancelled load failure without poisoning the latest selection', async () => {
    const f = setup(),
      pending = deferred<PreviewAsset>()
    f.load.mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(asset())
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    f.player.select('female')
    pending.reject(new Error('PRIVATE_OLD'))
    await drain()
    expect(f.player.snapshot()).toMatchObject({
      status: 'playing',
      failure: null,
      selection: 'female',
    })
    await f.player.dispose()
  })
  it('does not automatically retry failed load on repeated input, but allows explicit retry', async () => {
    const f = setup()
    f.load.mockRejectedValueOnce(new Error('PRIVATE_LOAD'))
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    expect(f.player.snapshot()).toMatchObject({ status: 'failed', failure: 'load-failed' })
    f.player.update({ focus: true })
    await drain()
    expect(f.load).toHaveBeenCalledTimes(1)
    f.player.retry()
    await drain()
    expect(f.player.snapshot().status).toBe('playing')
    expect(JSON.stringify(f.player.snapshot())).not.toContain('PRIVATE')
    await f.player.dispose()
  })
  it.each([NaN, Infinity, -1])('fails closed for invalid RAF time %s', async (at) => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    f.fire(at)
    expect(f.player.snapshot().failure).toBe('clock-failed')
    expect(f.callbacks.size).toBe(0)
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
    await f.player.dispose()
  })
  it('rejects a regressing clock', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    f.fire(20)
    f.fire(19)
    expect(f.player.snapshot().failure).toBe('clock-failed')
    await f.player.dispose()
  })
  it('cleans up and reports a fixed rendering failure', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ focus: true })
    await drain()
    f.model.draw.mockImplementation(() => {
      throw new Error('PRIVATE_RENDER')
    })
    f.fire(10)
    expect(f.player.snapshot().failure).toBe('render-failed')
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
    expect(f.callbacks.size).toBe(0)
    await f.player.dispose()
  })
  it('preserves cleanup failure and prohibits retry', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    f.model.dispose.mockImplementation(() => {
      throw new Error('PRIVATE_CLEANUP')
    })
    f.player.update({ pointer: false })
    f.player.retry()
    await drain()
    expect(f.player.snapshot().failure).toBe('cleanup-failed')
    expect(f.load).toHaveBeenCalledTimes(1)
    await expect(f.player.dispose()).rejects.toThrow('Motion preview cleanup failed')
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
  })
  it('never frees an asset already transferred to another player', async () => {
    const f = setup(),
      g = setup()
    g.load.mockResolvedValue(f.model)
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    g.player.select('female')
    g.player.update({ pointer: true })
    await drain()
    expect(g.player.snapshot().failure).toBe('ownership-failed')
    expect(f.model.dispose).not.toHaveBeenCalled()
    await g.player.dispose()
    expect(f.model.dispose).not.toHaveBeenCalled()
    await f.player.dispose()
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
  })
  it('discards a callback delivered after cancellation', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    const late = [...f.callbacks.values()][0]
    f.player.update({ pointer: false })
    const before = f.model.draw.mock.calls.length
    late(20)
    expect(f.model.draw).toHaveBeenCalledTimes(before)
    expect(f.callbacks.size).toBe(0)
    await f.player.dispose()
  })
  it('does not schedule another frame if a draw removes the owner', async () => {
    const f = setup()
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    f.model.draw.mockImplementationOnce(() => {
      void f.player.dispose()
    })
    f.fire(20)
    await drain()
    expect(f.callbacks.size).toBe(0)
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
  })
  it('rejects an invalid duration while releasing the returned owned asset', async () => {
    const f = setup()
    f.model.durationMs = 0
    f.player.select('male')
    f.player.update({ pointer: true })
    await drain()
    expect(f.player.snapshot().failure).toBe('load-failed')
    expect(f.model.dispose).toHaveBeenCalledTimes(1)
    await f.player.dispose()
  })
})
