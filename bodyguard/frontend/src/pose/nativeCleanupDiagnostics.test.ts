import { readFileSync } from 'node:fs'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanupNote,
  traceCleanup,
  workerFailureNote,
} from '../../e2e/fixtures/nativeCleanupDiagnostics'
import { instrumentWorkerFailure } from '../../e2e/fixtures/nativeWorkerDiagnosticsTransform'

afterEach(() => vi.unstubAllGlobals())
function setup() {
  const events: { kind: string; phase: string; ms: number }[] = []
  vi.stubGlobal('window', { nativeCleanupTrace: events })
  return events
}
it('keeps method receiver, other ports and sync/async release outcomes', async () => {
  const events = setup()
  const source = {
    read: () => 7,
    dispose() {
      expect(this).toBe(source)
    },
  }
  const traced = traceCleanup('source', source)
  expect(traced.read()).toBe(7)
  expect(traced.dispose()).toBeUndefined()
  await traceCleanup('inference', { dispose: async () => {} }).dispose()
  expect(events.map(({ kind, phase }) => [kind, phase])).toEqual([
    ['source', 'start'],
    ['source', 'clean'],
    ['inference', 'start'],
    ['inference', 'clean'],
  ])
})
it.each([false, true])(
  'preserves the exact failed release without recording its contents, async=%s',
  async (async) => {
    const events = setup(),
      privateError = new Error('PRIVATE_RESULT_NOT_TO_RECORD')
    const resource = traceCleanup('avatars', {
      dispose: () => {
        if (async) return Promise.reject(privateError)
        throw privateError
      },
    })
    await expect(Promise.resolve().then(() => resource.dispose())).rejects.toBe(privateError)
    expect(events.map(({ phase }) => phase)).toEqual(['start', 'failed'])
    expect(JSON.stringify(events)).not.toContain('PRIVATE')
    expect(Object.keys(events[0]).sort()).toEqual(['kind', 'ms', 'phase'])
  },
)
it('bounds the log and is inert outside the explicit test trace', () => {
  const events = setup()
  for (let i = 0; i < 1000; i++) cleanupNote('camera', 'clean')
  expect(events).toHaveLength(120)
  vi.stubGlobal('window', {})
  expect(() => cleanupNote('camera', 'failed')).not.toThrow()
})
it('stores only fixed worker state and time fields, not caller data or error messages', () => {
  const events: unknown[] = []
  vi.stubGlobal('window', { nativeWorkerFailures: events })
  const state = {
    ready: true,
    pending: true,
    retiring: false,
    initSent: true,
    cleanupFailed: false,
    lateByMs: 5.2,
    result: 'PRIVATE_RESULT',
  }
  for (let i = 0; i < 50; i++) workerFailureNote('PRIVATE_ERROR', state)
  expect(events).toHaveLength(16)
  expect(events[0]).toMatchObject({
    phase: 'worker-event',
    lateByMs: 5,
    ready: true,
    pending: true,
  })
  expect(Object.keys(events[0] as object).sort()).toEqual([
    'cleanupFailed',
    'initSent',
    'lateByMs',
    'ms',
    'pending',
    'phase',
    'ready',
    'retiring',
  ])
  expect(JSON.stringify(events)).not.toContain('PRIVATE')
})
it('instruments the exact current Worker owner without changing deadlines and rejects source drift', () => {
  const source = readFileSync(new URL('./workerInference.ts', import.meta.url), 'utf8')
  const instrumented = instrumentWorkerFailure(source)
  expect(source).not.toContain('workerFailureNote')
  for (const line of [
    'const CLEANUP_LIMIT_MS = 5000',
    'const RESPONSE_LIMIT_MS = 5000',
    'performance.now() >= responseDeadline',
    "worker.postMessage({ type: 'close', generation })",
  ])
    expect(instrumented).toContain(line)
  expect(
    transpileModule(instrumented, {
      compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
      reportDiagnostics: true,
    }).diagnostics,
  ).toEqual([])
  expect(() => instrumentWorkerFailure(instrumented)).toThrow('Native diagnostic source mismatch')
  expect(() => instrumentWorkerFailure('')).toThrow('Native diagnostic source mismatch')
})
