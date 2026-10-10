// FR-A-01/03·FR-M-02/07·FR-S-04: private continuous rendering, no classifier or release gate.
import { ResourceCleanupError, type ResourceContext } from '../coaching/resources'
import type { createVideoPoseSource } from '../pose/videoPoseSource'
import type { prepareOwnedAvatarPair } from './ownedAvatarPair'

type Source = ReturnType<typeof createVideoPoseSource>
type Avatars = Pick<
  Awaited<ReturnType<typeof prepareOwnedAvatarPair>>,
  'observe' | 'render' | 'dispose'
>
type RigState = ReturnType<Avatars['render']>
type Options = Readonly<{
  context: ResourceContext
  source: Source
  avatars: Avatars
  scheduler: Readonly<{
    request(callback: (now: number) => void): number
    cancel(handle: number): void
  }>
  render(): unknown
  onFailure?(reason: Failure): void | Promise<void>
}>
type Failure = 'inference-error' | 'callback-error' | 'ownership-error' | 'cleanup-error'
const consumed = new WeakSet<object>()

/** Transfers source/pair ownership only after validation. Caller retains camera/SDK/renderer
 * and must await dispose before releasing them. One pending inference never blocks render.
 * Original RAF times/deltas and capture metadata are preserved; no clinical rule or fallback.
 */
export function createOwnedPosePlayback(options: Options) {
  let generation: number, signal: AbortSignal, source: Source, avatars: Avatars
  let read: Source['read'], closeSource: Source['dispose']
  let observe: Avatars['observe'], renderRig: Avatars['render'], closeAvatars: Avatars['dispose']
  let request: Options['scheduler']['request'], cancel: Options['scheduler']['cancel']
  let render: Options['render']
  let onFailure: Options['onFailure']
  try {
    ;({ generation, signal } = options.context)
    ;({ source, avatars, render } = options)
    onFailure = options.onFailure
    if (
      !Number.isSafeInteger(generation) ||
      generation <= 0 ||
      !signal ||
      signal.aborted ||
      !source ||
      !avatars ||
      source === (avatars as unknown) ||
      consumed.has(source) ||
      consumed.has(avatars) ||
      typeof render !== 'function' ||
      (onFailure !== undefined && typeof onFailure !== 'function')
    )
      throw new Error()
    read = source.read.bind(source)
    closeSource = source.dispose.bind(source)
    observe = avatars.observe.bind(avatars)
    renderRig = avatars.render.bind(avatars)
    closeAvatars = avatars.dispose.bind(avatars)
    request = options.scheduler.request.bind(options.scheduler)
    cancel = options.scheduler.cancel.bind(options.scheduler)
  } catch {
    throw new Error('Invalid owned pose playback')
  }
  consumed.add(source)
  consumed.add(avatars)
  let status: 'idle' | 'running' | 'closed' | 'failed' = 'idle'
  let failure: Failure | null = null
  let lastNow: number | null = null
  let state: RigState = Object.freeze({ status: 'untracked', tracked: 0, total: 8 })
  let queued: { active: boolean; handle: number | null } | null = null
  let reading: Promise<void> | null = null
  let disposal: Promise<void> | null = null
  let cleanupFailed = false
  let reported: Failure | null = null,
    observerFailed = false
  function notifyFailure() {
    if (!failure || failure === reported || observerFailed) return
    reported = failure
    const broke = () => {
      observerFailed = true
      if (!cleanupFailed) failure = 'callback-error'
      status = 'failed'
      void dispose().catch(() => {})
    }
    try {
      void Promise.resolve(onFailure?.(failure)).catch(broke)
    } catch {
      broke()
    }
  }
  const active = () => status === 'running' && !signal.aborted
  function fail(reason: Failure) {
    if (reason === 'cleanup-error') cleanupFailed = true
    if (failure === null) failure = reason
    status = 'failed'
    void dispose().catch(() => {})
    notifyFailure()
  }
  function dispose(): Promise<void> {
    if (disposal) return disposal
    if (status !== 'failed') status = 'closed'
    const reservation = queued
    queued = null
    if (reservation) reservation.active = false
    let resolve!: () => void, reject!: (error: unknown) => void
    disposal = new Promise((yes, no) => {
      resolve = yes
      reject = no
    })
    const finish = async () => {
      for (const action of [
        () => signal.removeEventListener('abort', aborted),
        () => {
          if (reservation?.handle !== null && reservation?.handle !== undefined)
            cancel(reservation.handle)
        },
      ]) {
        try {
          action()
        } catch {
          cleanupFailed = true
        }
      }
      try {
        await closeSource()
      } catch {
        cleanupFailed = true
      }
      // Source cleanup is a quiescence barrier, not a signal that makes a late result current.
      await reading
      try {
        closeAvatars()
      } catch {
        cleanupFailed = true
      }
      state = Object.freeze({ status: 'closed', tracked: 0, total: state.total })
      if (cleanupFailed) {
        failure = 'cleanup-error'
        status = 'failed'
        notifyFailure()
        throw new ResourceCleanupError()
      }
    }
    void finish().then(resolve, reject)
    return disposal
  }
  function aborted() {
    void dispose().catch(() => {})
  }
  function acquire() {
    if (!active() || reading) return
    reading = Promise.resolve()
      .then(() => (active() ? read() : null))
      .then((frame) => {
        if (!active() || frame === null) return
        if (frame.generation !== generation) fail('ownership-error')
        // A rig rejects stale/duplicate observations without inventing freshness.
        // Rendering/expiry must continue; this is not a resource-ownership failure.
        else observe(frame)
      })
      .catch((error) => {
        if (error instanceof ResourceCleanupError) fail('cleanup-error')
        else if (active()) fail('inference-error')
      })
      .finally(() => {
        reading = null
      })
  }
  function schedule() {
    if (!active() || queued) return
    const reservation = { active: true, handle: null as number | null }
    queued = reservation
    try {
      const handle = request((now) => {
        if (!reservation.active) return
        reservation.active = false
        if (queued !== reservation || !active()) return
        queued = null
        if (
          reservation.handle === null ||
          !Number.isFinite(now) ||
          now < 0 ||
          (lastNow !== null && now <= lastNow)
        ) {
          fail('callback-error')
          return
        }
        try {
          const delta = lastNow === null ? 0 : now - lastNow
          lastNow = now
          const supplied = renderRig(now, delta)
          const { status: rigStatus, tracked, total } = supplied
          if (
            !['tracking', 'partial', 'untracked'].includes(rigStatus) ||
            !Number.isSafeInteger(total) ||
            total <= 0 ||
            !Number.isSafeInteger(tracked) ||
            tracked < 0 ||
            tracked > total
          )
            throw new Error()
          state = Object.freeze({ status: rigStatus, tracked, total })
          const result = render()
          if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            void Promise.resolve(result).catch(() => {})
            throw new Error()
          }
          acquire()
          schedule()
        } catch {
          fail('callback-error')
        }
      })
      reservation.handle = handle
      if (!Number.isSafeInteger(handle) || handle < 0) throw new Error()
      if (!reservation.active || queued !== reservation || !active()) {
        try {
          cancel(handle)
        } catch {
          cleanupFailed = true
          failure = 'cleanup-error'
          status = 'failed'
          notifyFailure()
        }
      }
    } catch {
      fail('callback-error')
    }
  }
  signal.addEventListener('abort', aborted, { once: true })
  if (signal.aborted) aborted()
  return Object.freeze({
    getSnapshot: () => Object.freeze({ status, failure, state, pending: reading !== null }),
    start() {
      if (status !== 'idle' || signal.aborted) return false
      status = 'running'
      schedule()
      return status === 'running'
    },
    dispose,
  })
}
