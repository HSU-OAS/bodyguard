// FR-M-07/NFR-08: test-only fixed resource events; never copy frames, results or errors.
type Kind = 'source' | 'inference' | 'avatars' | 'camera'
export function workerFailureNote(
  phase: string,
  state: Readonly<{
    ready: boolean
    pending: boolean
    retiring: boolean
    initSent: boolean
    cleanupFailed: boolean
    lateByMs: number | null
  }>,
) {
  const events = (window as unknown as { nativeWorkerFailures?: unknown[] }).nativeWorkerFailures
  if (events && events.length < 16)
    events.push({
      phase: [
        'response-timeout',
        'protocol',
        'post-frame',
        'frame-release',
        'close-unclean',
        'worker-event',
      ].includes(phase)
        ? phase
        : 'worker-event',
      ms: Math.round(performance.now()),
      ready: state.ready === true,
      pending: state.pending === true,
      retiring: state.retiring === true,
      initSent: state.initSent === true,
      cleanupFailed: state.cleanupFailed === true,
      lateByMs:
        typeof state.lateByMs === 'number' && Number.isFinite(state.lateByMs)
          ? Math.round(state.lateByMs)
          : null,
    })
}
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
