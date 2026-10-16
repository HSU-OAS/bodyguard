// FR-M-07/NFR-08: test-only fixed resource events; never copy frames, results or errors.
type Kind = 'source' | 'inference' | 'avatars' | 'camera'
export function cleanupNote(kind: Kind, phase: 'start' | 'clean' | 'failed') {
  const target = window as unknown as {
    nativeCleanupTrace?: { kind: string; phase: string; ms: number }[]
  }
  const events = target.nativeCleanupTrace
  if (events && events.length < 120) events.push({ kind, phase, ms: Math.round(performance.now()) })
}
export function traceCleanup<T extends { dispose(): void | Promise<void> }>(
  kind: Kind,
  value: T,
): T {
  return {
    ...value,
    dispose() {
      cleanupNote(kind, 'start')
      try {
        const result = value.dispose()
        if (result && typeof result.then === 'function')
          return result.then(
            () => {
              cleanupNote(kind, 'clean')
            },
            (error: unknown) => {
              cleanupNote(kind, 'failed')
              throw error
            },
          )
        cleanupNote(kind, 'clean')
      } catch (error) {
        cleanupNote(kind, 'failed')
        throw error
      }
    },
  }
}
