// FR-M-02/07·NFR-07/08: worker-side same-input and terminal cleanup contracts.
import { expect, it, vi } from 'vitest'
import { ResourceCleanupError } from '../coaching/resources'
import { createWorkerInferenceRuntime, type WorkerInferenceEngine } from './workerInferenceRuntime'

const config = { model: 'lite', face: true, hands: true, matrixLayout: 'column-major' } as const
const data = () => ({ landmarks: [], worldLandmarks: [], hands: [], headOrientation: null })
const tick = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function fixture() {
  const out: unknown[] = [],
    engine = { detect: vi.fn(() => data()), dispose: vi.fn() }
  const prepare = vi.fn(async () => engine)
  const runtime = createWorkerInferenceRuntime({ prepare, send: (value) => out.push(value) })
  const init = () => runtime.receive({ type: 'init', generation: 4, id: 0, config })
  const frame = () => ({ displayWidth: 640, displayHeight: 480, close: vi.fn() })
  return { out, engine, prepare, runtime, init, frame }
}
it('uses one decoded input and exact timestamp, closes before delivering result', async () => {
  const f = fixture(),
    frame = f.frame()
  f.init()
  await tick()
  f.engine.detect.mockImplementation(() => {
    expect(frame.close).not.toHaveBeenCalled()
    return data()
  })
  f.runtime.receive({ type: 'frame', generation: 4, id: 1, at: 20, frame })
  await tick()
  expect(f.engine.detect).toHaveBeenCalledWith(frame, 20)
  expect(frame.close).toHaveBeenCalledOnce()
  expect(f.out[1]).toEqual({ type: 'result', generation: 4, id: 1, at: 20, result: data() })
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
  expect(f.engine.dispose).toHaveBeenCalledOnce()
  expect(f.out.at(-1)).toEqual({ type: 'closed', generation: 4, clean: true })
})
it('waits for initializing engine during cancel and does not emit late ready', async () => {
  const f = fixture(),
    gate = deferred<WorkerInferenceEngine>()
  f.prepare.mockReturnValueOnce(gate.promise as ReturnType<typeof f.prepare>)
  f.init()
  await tick()
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
  expect(f.engine.dispose).not.toHaveBeenCalled()
  gate.resolve(f.engine)
  await tick()
  expect(f.engine.dispose).toHaveBeenCalledOnce()
  expect(f.out).toEqual([{ type: 'closed', generation: 4, clean: true }])
})
it('does not send a ready response after a duplicate init has failed ownership', async () => {
  const f = fixture(),
    gate = deferred<WorkerInferenceEngine>()
  f.prepare.mockReturnValueOnce(gate.promise as ReturnType<typeof f.prepare>)
  f.init()
  await tick()
  f.init()
  gate.resolve(f.engine)
  await tick()
  expect(f.out).toEqual([{ type: 'error', generation: 4, id: 0 }])
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
  expect(f.engine.dispose).toHaveBeenCalledOnce()
})
it('closes even a transferred frame with invalid generation', async () => {
  const f = fixture(),
    frame = f.frame()
  f.init()
  await tick()
  f.runtime.receive({ type: 'frame', generation: 9, id: 1, at: 20, frame })
  await tick()
  expect(frame.close).toHaveBeenCalledOnce()
  expect(f.engine.detect).not.toHaveBeenCalled()
  expect(f.out.at(-1)).toEqual({ type: 'error', generation: 4, id: 0 })
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
})
it('never sends result after decoded input cleanup fails', async () => {
  const f = fixture(),
    frame = f.frame()
  frame.close.mockImplementation(() => {
    throw new Error('PRIVATE_FRAME')
  })
  f.init()
  await tick()
  f.runtime.receive({ type: 'frame', generation: 4, id: 1, at: 20, frame })
  await tick()
  expect(f.out.at(-1)).toEqual({ type: 'error', generation: 4, id: 1 })
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
  expect(f.out.at(-1)).toEqual({ type: 'closed', generation: 4, clean: false })
})
it('does not report native result release failure as clean SDK shutdown', async () => {
  const f = fixture(),
    frame = f.frame()
  f.init()
  await tick()
  f.engine.detect.mockImplementation(() => {
    throw new ResourceCleanupError()
  })
  f.runtime.receive({ type: 'frame', generation: 4, id: 1, at: 20, frame })
  await tick()
  expect(frame.close).toHaveBeenCalledOnce()
  expect(f.out.at(-1)).toEqual({ type: 'error', generation: 4, id: 1 })
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
  expect(f.out.at(-1)).toEqual({ type: 'closed', generation: 4, clean: false })
})
it('cancel waits for a pending input, discards its late result and disposes once', async () => {
  const f = fixture(),
    gate = deferred<ReturnType<typeof data>>(),
    frame = f.frame()
  f.init()
  await tick()
  f.engine.detect.mockReturnValueOnce(gate.promise as unknown as ReturnType<typeof data>)
  f.runtime.receive({ type: 'frame', generation: 4, id: 1, at: 20, frame })
  await tick()
  f.runtime.receive({ type: 'close', generation: 4 })
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
  expect(frame.close).not.toHaveBeenCalled()
  expect(f.engine.dispose).not.toHaveBeenCalled()
  gate.resolve(data())
  await tick()
  expect(frame.close).toHaveBeenCalledOnce()
  expect(f.engine.dispose).toHaveBeenCalledOnce()
  expect(f.out).toEqual([
    { type: 'ready', generation: 4, id: 0 },
    { type: 'closed', generation: 4, clean: true },
  ])
})
it('overlap fails ownership, closes both inputs and never delivers stale work', async () => {
  const f = fixture(),
    gate = deferred<ReturnType<typeof data>>(),
    first = f.frame(),
    second = f.frame()
  f.init()
  await tick()
  f.engine.detect.mockReturnValueOnce(gate.promise as unknown as ReturnType<typeof data>)
  f.runtime.receive({ type: 'frame', generation: 4, id: 1, at: 20, frame: first })
  await tick()
  f.runtime.receive({ type: 'frame', generation: 4, id: 2, at: 21, frame: second })
  expect(second.close).toHaveBeenCalledOnce()
  gate.resolve(data())
  await tick()
  expect(first.close).toHaveBeenCalledOnce()
  expect(f.out.some((value) => (value as { type: string }).type === 'result')).toBe(false)
  f.runtime.receive({ type: 'close', generation: 4 })
  await tick()
  expect(f.engine.dispose).toHaveBeenCalledOnce()
})
it.each([false, true])(
  'cancelled preparation reports cleanup failure only when cleanup failed=%s',
  async (cleanupFailed) => {
    const f = fixture(),
      gate = deferred<WorkerInferenceEngine>()
    f.prepare.mockReturnValueOnce(gate.promise as ReturnType<typeof f.prepare>)
    f.init()
    await tick()
    f.runtime.receive({ type: 'close', generation: 4 })
    gate.resolve(
      Promise.reject(
        cleanupFailed ? new ResourceCleanupError() : new Error('PRIVATE_MODEL'),
      ) as unknown as WorkerInferenceEngine,
    )
    await tick()
    expect(f.out).toEqual([{ type: 'closed', generation: 4, clean: !cleanupFailed }])
  },
)
