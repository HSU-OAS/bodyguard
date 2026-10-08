// FR-M-02·NFR-07/08: bounded TEST-only technical state, never arguments/errors/URLs/body data.
const limits = { camera: 3, fileset: 9, 'body-sdk': 6, 'face-sdk': 6, 'hands-sdk': 6 } as const
type Stage = keyof typeof limits
type Delegate = 'GPU' | 'CPU' | null
type Outcome = 'pending' | 'resolved' | 'rejected'
type ObserverState = 'unsupported' | 'observing' | 'closed' | 'failed'
type Event = {
  stage: Stage
  delegate: Delegate
  startMs: number
  endMs: number | null
  outcome: Outcome
}
const finite = (n: number) => Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER
export function nativeStartupDiagnostic(clock: () => number) {
  const events: Event[] = [],
    longTasks: { startMs: number; durationMs: number }[] = []
  const tokens = new Map<object, number>(),
    counts = new Map<Stage, number>()
  let epoch: number | null = null,
    last = -Infinity,
    invalid = false,
    closed = false,
    reading = false,
    eventsTruncated = false,
    longTasksTruncated = false,
    observerState: ObserverState = 'unsupported'
  function now() {
    if (closed || invalid || reading) return null
    reading = true
    try {
      const at = clock()
      if (closed || invalid) return null
      if (!finite(at) || at < last) throw new Error()
      epoch ??= at
      last = at
      return at - epoch
    } catch {
      invalid = true
      return null
    } finally {
      reading = false
    }
  }
  return Object.freeze({
    begin(stage: Stage, delegate: Delegate = null): object | null {
      if (
        typeof stage !== 'string' ||
        !Object.hasOwn(limits, stage) ||
        ![null, 'GPU', 'CPU'].includes(delegate) ||
        closed ||
        invalid
      )
        return null
      if ((counts.get(stage) ?? 0) >= limits[stage]) {
        eventsTruncated = true
        return null
      }
      const at = now()
      if (at === null || closed || invalid) return null
      const token = {}
      counts.set(stage, (counts.get(stage) ?? 0) + 1)
      tokens.set(token, events.length)
      events.push({ stage, delegate, startMs: at, endMs: null, outcome: 'pending' })
      return token
    },
    end(token: object | null, outcome: Exclude<Outcome, 'pending'>) {
      if (!token || closed || !tokens.has(token) || !['resolved', 'rejected'].includes(outcome))
        return
      const index = tokens.get(token)
      tokens.delete(token)
      const at = now()
      if (at !== null && index !== undefined) {
        events[index].endMs = at
        events[index].outcome = outcome
      }
    },
    setObserverState(state: ObserverState) {
      if (!closed && ['unsupported', 'observing', 'closed', 'failed'].includes(state))
        observerState = state
    },
    markLongTasksTruncated() {
      if (!closed) longTasksTruncated = true
    },
    longTask(start: number, duration: number) {
      if (
        closed ||
        invalid ||
        epoch === null ||
        observerState !== 'observing' ||
        !finite(start) ||
        !finite(duration) ||
        duration > 60_000 ||
        start < epoch ||
        start - epoch > 60_000
      )
        return
      if (longTasks.length === 64) {
        longTasksTruncated = true
        return
      }
      longTasks.push({ startMs: start - epoch, durationMs: duration })
    },
    close() {
      closed = true
      tokens.clear()
    },
    snapshot: () =>
      Object.freeze({
        invalid,
        closed,
        eventsTruncated,
        longTasksTruncated,
        observerState,
        events: Object.freeze(events.map((event) => Object.freeze({ ...event }))),
        longTasks: Object.freeze(longTasks.map((task) => Object.freeze({ ...task }))),
      }),
  })
}

// Long-task observations overlap preparation; they are not CPU/GPU attribution or causal proof.
export function observeNativeStartupLongTasks(
  diagnostic: ReturnType<typeof nativeStartupDiagnostic>,
  Observer: typeof PerformanceObserver | null = globalThis.PerformanceObserver ?? null,
) {
  let observer: PerformanceObserver | null = null,
    closed = false
  function capture(entries: PerformanceEntry[]) {
    if (closed) return
    for (const entry of entries.slice(0, 65)) diagnostic.longTask(entry.startTime, entry.duration)
    if (entries.length > 65) diagnostic.markLongTasksTruncated()
  }
  try {
    if (Observer?.supportedEntryTypes.includes('longtask')) {
      observer = new Observer((list) => {
        try {
          capture(list.getEntries())
        } catch {
          diagnostic.setObserverState('failed')
        }
      })
      observer.observe({ type: 'longtask' })
      diagnostic.setObserverState('observing')
    }
  } catch {
    try {
      observer?.disconnect()
    } catch {
      /* No SDK operation depends on optional diagnostics. */
    }
    observer = null
    diagnostic.setObserverState('failed')
  }
  return Object.freeze({
    close() {
      if (closed) return
      if (observer) {
        try {
          capture(observer.takeRecords())
        } catch {
          diagnostic.setObserverState('failed')
        } finally {
          try {
            observer.disconnect()
          } catch {
            diagnostic.setObserverState('failed')
          }
        }
        if (diagnostic.snapshot().observerState === 'observing')
          diagnostic.setObserverState('closed')
      }
      closed = true
    },
  })
}
