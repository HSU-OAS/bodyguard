// FR-M-02/07·NFR-07/08: same-browser worker ownership, no real SDK/human claims.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkerPoseInference } from './workerInference'

class FakeWorker extends EventTarget {
  static current: FakeWorker
  sent: { data: unknown; transfer: Transferable[] }[] = []
  terminate = vi.fn()
  constructor(readonly url: URL) {
    super()
    FakeWorker.current = this
  }
  postMessage(data: unknown, transfer: Transferable[] = []) {
    this.sent.push({ data, transfer })
  }
  reply(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }
}
function fixture() {
  vi.stubGlobal('Worker', FakeWorker)
  const abort = new AbortController()
  const pending = createWorkerPoseInference(
    { generation: 3, signal: abort.signal },
    { model: 'lite', face: true, hands: true, matrixLayout: 'column-major' },
  )
  const worker = FakeWorker.current
  const ready = () => worker.reply({ type: 'ready', generation: 3, id: 0 })
  return { abort, pending, worker, ready }
}
function frame() {
  const clone = { close: vi.fn(), displayWidth: 640, displayHeight: 480 }
  return { input: { clone: vi.fn(() => clone) } as unknown as VideoFrame, clone }
}
const points = () => ({ landmarks: [], worldLandmarks: [], headOrientation: null, hands: [] })
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('worker inference owner', () => {
  it('rejects late ready even when its timer callback has not been scheduled yet', async () => {
    vi.useFakeTimers()
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const f = fixture(),
      outcome = f.pending.then(
        () => 'ready',
        () => 'failed',
      )
    now = 5001
    f.ready()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    expect(await outcome).toBe('failed')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects late result before a delayed timer callback can promote it', async () => {
    vi.useFakeTimers()
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const f = fixture()
    f.ready()
    const inference = await f.pending
    const outcome = inference.detect(frame().input, 2).then(
      () => 'accepted',
      () => 'rejected',
    )
    now = 5001
    f.worker.reply({ type: 'result', generation: 3, id: 1, at: 2, result: points() })
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
    expect(await outcome).toBe('rejected')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('bounds a silently closed preparing worker and preserves missing cleanup acknowledgement', async () => {
    vi.useFakeTimers()
    const f = fixture()
    const assertion = expect(f.pending).rejects.toThrow('Resource cleanup failed')
    await vi.advanceTimersByTimeAsync(5000)
    expect(f.worker.sent.at(-1)?.data).toEqual({ type: 'close', generation: 3 })
    f.ready()
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('bounds a missing inference response, never accepts its late result and observes cleanup', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.ready()
    const inference = await f.pending,
      a = frame()
    const job = inference.detect(a.input, 2)
    const assertion = expect(job).rejects.toThrow('Worker inference unavailable')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    f.worker.reply({ type: 'result', generation: 3, id: 1, at: 2, result: points() })
    const cleanup = expect(inference.dispose()).rejects.toThrow('Resource cleanup failed')
    await vi.advanceTimersByTimeAsync(5000)
    await cleanup
    expect(a.clone.close).toHaveBeenCalledOnce()
    expect(f.worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not spend a new frame deadline on preparation or an earlier successful frame', async () => {
    vi.useFakeTimers()
    const f = fixture()
    await vi.advanceTimersByTimeAsync(4999)
    f.ready()
    const inference = await f.pending
    expect(vi.getTimerCount()).toBe(0)
    for (const [id, at] of [
      [1, 2],
      [2, 3],
    ]) {
      const job = inference.detect(frame().input, at)
      await vi.advanceTimersByTimeAsync(4999)
      f.worker.reply({ type: 'result', generation: 3, id, at, result: points() })
      ;(await job).close()
      expect(vi.getTimerCount()).toBe(0)
    }
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects preparation at its deadline even if late ready precedes a clean acknowledgement', async () => {
    vi.useFakeTimers()
    const f = fixture(),
      assertion = expect(f.pending).rejects.toThrow('Worker inference unavailable')
    await vi.advanceTimersByTimeAsync(5000)
    f.ready()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('clears an in-flight response deadline immediately on cancellation', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.ready()
    const inference = await f.pending,
      job = inference.detect(frame().input, 2)
    const assertion = expect(job).rejects.toThrow('Worker inference unavailable')
    await vi.advanceTimersByTimeAsync(1000)
    f.abort.abort()
    await assertion
    expect(vi.getTimerCount()).toBe(1)
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
    await vi.advanceTimersByTimeAsync(10000)
    expect(f.worker.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('uses a fixed same-origin worker and explicit model/features only', async () => {
    const f = fixture()
    expect(f.worker.url.pathname).toMatch(/nativeInference\.worker\.ts$/)
    expect(f.worker.sent[0].data).toEqual({
      type: 'init',
      generation: 3,
      id: 0,
      config: { model: 'lite', face: true, hands: true, matrixLayout: 'column-major' },
    })
    f.ready()
    const inference = await f.pending
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it('transfers one clone, keeps borrowed input intact and preserves original timestamp', async () => {
    const f = fixture(),
      a = frame()
    f.ready()
    const inference = await f.pending
    const job = inference.detect(a.input, 20)
    expect(f.worker.sent[1]).toEqual({
      data: { type: 'frame', generation: 3, id: 1, at: 20, frame: a.clone },
      transfer: [a.clone],
    })
    expect(a.clone.close).toHaveBeenCalledOnce()
    f.worker.reply({ type: 'result', generation: 3, id: 1, at: 20, result: points() })
    const result = await job
    expect(result.landmarks).toEqual([])
    result.close()
    result.close()
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
  })
  it('rejects overlap before cloning or retaining a second frame', async () => {
    const f = fixture(),
      a = frame(),
      b = frame()
    f.ready()
    const inference = await f.pending,
      job = inference.detect(a.input, 2)
    await expect(inference.detect(b.input, 3)).rejects.toThrow('Worker inference unavailable')
    expect(b.input.clone).not.toHaveBeenCalled()
    f.worker.reply({ type: 'result', generation: 3, id: 1, at: 2, result: points() })
    ;(await job).close()
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
  })
  it('rejects pending work immediately on abort, discards late body and waits for cleanup ack', async () => {
    const f = fixture(),
      a = frame()
    f.ready()
    const inference = await f.pending,
      job = inference.detect(a.input, 3)
    const assertion = expect(job).rejects.toThrow('Worker inference unavailable')
    f.abort.abort()
    await assertion
    f.worker.reply({ type: 'result', generation: 3, id: 1, at: 3, result: points() })
    expect(f.worker.terminate).not.toHaveBeenCalled()
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
    expect(f.worker.terminate).toHaveBeenCalledOnce()
    await expect(inference.detect(a.input, 4)).rejects.toThrow('Worker inference unavailable')
  })
  it('cancels preparing without promoting a late ready response', async () => {
    const f = fixture(),
      assertion = expect(f.pending).rejects.toThrow('Worker inference unavailable')
    f.abort.abort()
    f.ready()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it.each([
    { type: 'result', generation: 2, id: 1, at: 2, result: points() },
    { type: 'result', generation: 3, id: 9, at: 2, result: points() },
    { type: 'result', generation: 3, id: 1, at: 1, result: points() },
    { type: 'error', generation: 3, id: 1, error: 'PRIVATE_COORDINATES_ERROR' },
  ])('fails closed on wrong ownership/timing or worker error', async (message) => {
    const f = fixture()
    f.ready()
    const inference = await f.pending,
      a = frame(),
      job = inference.detect(a.input, 2)
    const assertion = expect(job).rejects.toThrow('Worker inference unavailable')
    f.worker.reply(message)
    await assertion
    expect(f.worker.terminate).not.toHaveBeenCalled()
    const disposal = inference.dispose()
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await disposal
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it('reports cleanup rejection as fixed error, not SDK payload', async () => {
    const f = fixture()
    f.ready()
    const inference = await f.pending,
      disposal = inference.dispose()
    const assertion = expect(disposal).rejects.toThrow('Resource cleanup failed')
    f.worker.reply({ type: 'closed', generation: 3, clean: false, error: 'PRIVATE_ERROR' })
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it('bounds missing cleanup acknowledgement and terminates, without success fallback', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.ready()
    const inference = await f.pending,
      disposal = inference.dispose()
    const assertion = expect(disposal).rejects.toThrow('Resource cleanup failed')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it('rejects unsupported worker before any preparation', async () => {
    vi.stubGlobal('Worker', undefined)
    await expect(
      createWorkerPoseInference(
        { generation: 1, signal: new AbortController().signal },
        { model: 'lite', face: false, hands: false, matrixLayout: 'column-major' },
      ),
    ).rejects.toThrow('Worker inference unavailable')
  })
  it('reports transferred clone cleanup failure even when worker releases successfully', async () => {
    const f = fixture(),
      a = frame()
    a.clone.close.mockImplementation(() => {
      throw new Error('PRIVATE_FRAME_CLOSE')
    })
    f.ready()
    const inference = await f.pending
    await expect(inference.detect(a.input, 2)).rejects.toThrow('Worker inference unavailable')
    const assertion = expect(inference.dispose()).rejects.toThrow('Resource cleanup failed')
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it('waits for partial initialization failure cleanup before rejecting its factory', async () => {
    const f = fixture(),
      assertion = expect(f.pending).rejects.toThrow('Resource cleanup failed')
    f.worker.reply({ type: 'error', generation: 3, id: 0 })
    expect(f.worker.terminate).not.toHaveBeenCalled()
    f.worker.reply({ type: 'closed', generation: 3, clean: false })
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
  })
  it('owns ready rejection even when the initial postMessage throws synchronously', async () => {
    const post = vi.spyOn(FakeWorker.prototype, 'postMessage')
    post.mockImplementationOnce(() => {
      throw new Error('PRIVATE_POST')
    })
    const f = fixture(),
      assertion = expect(f.pending).rejects.toThrow('Worker inference unavailable')
    f.worker.reply({ type: 'closed', generation: 3, clean: true })
    await assertion
    expect(f.worker.terminate).toHaveBeenCalledOnce()
    post.mockRestore()
  })
})
