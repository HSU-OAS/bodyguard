// FR-A-03·FR-M-01/NFR-08: one private selection preview, no camera or coaching verdict.
import { ResourceCleanupError } from '../coaching/resources'
export type PreviewAsset = Readonly<{
  durationMs: number
  draw(positionMs: number): void
  dispose(): void
}>
type Intent = {
  pointer: boolean
  focus: boolean
  visible: boolean
  reducedMotion: boolean
  manual: boolean
}
type Failure =
  | 'load-failed'
  | 'render-failed'
  | 'clock-failed'
  | 'scheduler-failed'
  | 'cleanup-failed'
  | 'ownership-failed'
type Options = Readonly<{
  load(id: string, signal: AbortSignal): Promise<PreviewAsset>
  scheduler: Readonly<{
    request(callback: (now: number) => void): number
    cancel(handle: number): void
  }>
}>
const consumed = new WeakSet<object>()
const validTime = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER

/** A single shared preview slot. load transfers a fresh, synchronously disposable asset;
 * it must settle after abort (including any partial cleanup). No network/camera side effects.
 * Ping-pong sampling previews an authored clip, not a clinical repetition or hold timer.
 */
export function createOwnedMotionPreview(options: Options) {
  const load = options.load.bind(options)
  const request = options.scheduler.request.bind(options.scheduler)
  const cancel = options.scheduler.cancel.bind(options.scheduler)
  let intent: Intent = {
    pointer: false,
    focus: false,
    visible: true,
    reducedMotion: false,
    manual: false,
  }
  let selection: string | null = null,
    revision = 0,
    closed = false
  let status: 'idle' | 'loading' | 'playing' | 'failed' | 'closed' = 'idle'
  let failure: Failure | null = null
  let current: PreviewAsset | null = null
  let pending: { abort: AbortController; revision: number; done: Promise<void> } | null = null
  let queued: { active: boolean; handle: number | null } | null = null
  let started: number | null = null,
    last: number | null = null
  let disposal: Promise<void> | null = null
  const wanted = () =>
    !closed &&
    selection !== null &&
    intent.visible &&
    (intent.manual || (!intent.reducedMotion && (intent.pointer || intent.focus)))
  const snapshot = () => Object.freeze({ status, selection, failure })
  function cleanup(action: () => void) {
    try {
      action()
    } catch {
      failure = 'cleanup-failed'
      status = 'failed'
    }
  }
  function stop(reset: boolean) {
    const reservation = queued,
      asset = current
    queued = null
    current = null
    started = null
    last = null
    if (reservation) {
      reservation.active = false
      if (reservation.handle !== null) cleanup(() => cancel(reservation.handle as number))
    }
    if (asset) {
      if (reset) {
        try {
          asset.draw(0)
        } catch {
          if (!failure) failure = 'render-failed'
          status = 'failed'
        }
      }
      cleanup(() => asset.dispose())
    }
  }
  function fail(reason: Failure) {
    if (!failure || reason === 'cleanup-failed') failure = reason
    status = 'failed'
    stop(false)
  }
  function take(raw: PreviewAsset) {
    if (!raw || (typeof raw !== 'object' && typeof raw !== 'function')) {
      fail('load-failed')
      return null
    }
    if (consumed.has(raw)) {
      fail('ownership-failed')
      return null
    }
    consumed.add(raw)
    let release: (() => void) | undefined
    try {
      release = raw.dispose.bind(raw)
      const durationMs = raw.durationMs,
        draw = raw.draw.bind(raw)
      if (!validTime(durationMs) || durationMs === 0) throw new Error()
      return Object.freeze({ durationMs, draw, dispose: release })
    } catch {
      if (release) cleanup(release)
      if (failure !== 'cleanup-failed') fail('load-failed')
      return null
    }
  }
  function schedule() {
    if (!wanted() || failure || !current || queued) return
    const reservation = { active: true, handle: null as number | null },
      asset = current
    queued = reservation
    let requesting = true
    try {
      const handle = request((now) => {
        if (
          !reservation.active ||
          queued !== reservation ||
          current !== asset ||
          !wanted() ||
          failure
        )
          return
        if (requesting) {
          fail('scheduler-failed')
          return
        }
        reservation.active = false
        queued = null
        if (!validTime(now) || (last !== null && now < last)) {
          fail('clock-failed')
          return
        }
        started ??= now
        last = now
        const cycle = ((now - started) / asset.durationMs) % 2
        if (!Number.isFinite(cycle)) {
          fail('clock-failed')
          return
        }
        try {
          asset.draw((cycle <= 1 ? cycle : 2 - cycle) * asset.durationMs)
        } catch {
          fail('render-failed')
          return
        }
        if (current === asset) schedule()
      })
      requesting = false
      if (!Number.isSafeInteger(handle) || handle < 0) {
        fail('scheduler-failed')
        return
      }
      reservation.handle = handle
      if (!reservation.active || queued !== reservation) cleanup(() => cancel(handle))
    } catch {
      requesting = false
      fail('scheduler-failed')
    }
  }
  function reconcile() {
    if (closed || failure) return
    if (!wanted()) {
      pending?.abort.abort()
      stop(true)
      if (!failure) status = 'idle'
      return
    }
    if (current) {
      status = 'playing'
      schedule()
      return
    }
    status = 'loading'
    if (pending) return
    const id = selection as string
    const job = { abort: new AbortController(), revision, done: Promise.resolve() }
    pending = job
    job.done = Promise.resolve()
      .then(() => (job.abort.signal.aborted ? undefined : load(id, job.abort.signal)))
      .then((raw) => {
        if (raw === undefined) {
          if (!job.abort.signal.aborted) fail('load-failed')
          return
        }
        const asset = take(raw)
        if (!asset) return
        if (
          closed ||
          job.abort.signal.aborted ||
          job.revision !== revision ||
          !wanted() ||
          failure
        ) {
          cleanup(() => asset.dispose())
          return
        }
        current = asset
        try {
          asset.draw(0)
        } catch {
          fail('render-failed')
          return
        }
        if (current === asset && !closed && !failure) {
          status = 'playing'
          schedule()
        }
      })
      .catch((error) => {
        if (error instanceof ResourceCleanupError) {
          fail('cleanup-failed')
          return
        }
        if (!closed && !job.abort.signal.aborted && job.revision === revision) fail('load-failed')
      })
      .finally(() => {
        if (pending === job) pending = null
        reconcile()
      })
  }
  function select(id: string | null) {
    if (id !== null && (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id)))
      throw new Error('Invalid motion preview selection')
    if (closed || selection === id) return
    revision++
    selection = id
    intent.manual = false
    pending?.abort.abort()
    stop(true)
    if (failure !== 'cleanup-failed') failure = null
    if (!failure) status = 'idle'
    reconcile()
  }
  function update(changes: Partial<Intent>) {
    const copied = { ...changes }
    if (
      Object.entries(copied).some(
        ([key, value]) => !Object.hasOwn(intent, key) || typeof value !== 'boolean',
      )
    )
      throw new Error('Invalid motion preview input')
    if (closed) return
    intent = { ...intent, ...copied }
    reconcile()
  }
  function retry() {
    if (closed || !failure || failure === 'cleanup-failed') return
    failure = null
    status = 'idle'
    reconcile()
  }
  function dispose(): Promise<void> {
    if (disposal) return disposal
    let resolve!: () => void, reject!: (error: unknown) => void
    disposal = new Promise<void>((yes, no) => {
      resolve = yes
      reject = no
    })
    closed = true
    revision++
    pending?.abort.abort()
    stop(false)
    status = failure === 'cleanup-failed' ? 'failed' : 'closed'
    const waiting = pending?.done
    void Promise.resolve(waiting)
      .then(() => {
        if (failure === 'cleanup-failed') {
          status = 'failed'
          throw new Error('Motion preview cleanup failed')
        }
        status = 'closed'
      })
      .then(resolve, reject)
    return disposal
  }
  return Object.freeze({ select, update, retry, snapshot, dispose })
}
