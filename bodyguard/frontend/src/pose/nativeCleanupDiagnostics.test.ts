import { afterEach, expect, it, vi } from 'vitest'
import { cleanupNote, traceCleanup } from '../../e2e/fixtures/nativeCleanupDiagnostics'

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
