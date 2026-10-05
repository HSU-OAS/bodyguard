// FR-S-02/04·FR-M-07/NFR-07/08: explicit generation-bound observation scheduling; no classifier.
import type { CoachingEvent } from '../stretch/progression'
import type { ResourceContext } from './resources'
import type { createCoachingSession } from './session'

type Observation = Omit<Extract<CoachingEvent, { type: 'frame' }>, 'type' | 'now'>
type Session = Pick<
  ReturnType<typeof createCoachingSession>,
  'getSnapshot' | 'tick' | 'observe' | 'end'
>
type Scheduler = Readonly<{ request(callback: () => void): number; cancel(handle: number): void }>
type Options = Readonly<{
  session: Session
  scheduler: Scheduler
  readFrame(context: ResourceContext): Observation | null | Promise<Observation | null>
}>
type Owner = { generation: number; abort: AbortController; busy: boolean }
type Reservation = { handle: number | null; active: boolean }
type Failure = 'inference-error' | 'callback-error'

/** A deferred scheduler (e.g. browser RAF) and already validated provider are required.
 * Call sync from session onChange, close at disposal. No default RAF/FPS/model/clinical rule.
 * One pending provider does not freeze tick, and old observations retain their original stamp.
 */
export function createObservationLoop(options: Options) {
  const { session, scheduler, readFrame } = options
  let current: Owner | null = null
  let queued: Reservation | null = null
  let closed = false

  function stop(): boolean {
    const owner = current
    current = null
    const reservation = queued
    queued = null
    if (reservation) reservation.active = false
    owner?.abort.abort()
    if (reservation?.handle !== undefined && reservation?.handle !== null) {
      try {
        scheduler.cancel(reservation.handle)
      } catch {
        return false
      }
    }
    return true
  }

  function terminate(reason: Failure | 'page-hidden'): Promise<void> {
    if (closed) return Promise.resolve()
    closed = true
    const cancelled = stop()
    // No native error or provider value is forwarded. Real session protects its own observer.
    try {
      return Promise.resolve(session.end(cancelled ? reason : 'callback-error')).catch(() => {})
    } catch {
      return Promise.resolve()
    }
  }

  function valid(owner: Owner): boolean {
    if (closed || current !== owner || owner.abort.signal.aborted) return false
    try {
      const snapshot = session.getSnapshot()
      return (
        !snapshot.closed &&
        snapshot.state.status === 'running' &&
        snapshot.state.generation === owner.generation
      )
    } catch {
      void terminate('callback-error')
      return false
    }
  }

  function read(owner: Owner) {
    if (owner.busy || !valid(owner)) return
    owner.busy = true
    const context = Object.freeze({ generation: owner.generation, signal: owner.abort.signal })
    void Promise.resolve()
      .then(() => {
        if (!valid(owner)) return null
        return readFrame(context)
      })
      .then((observation) => {
        if (!valid(owner) || observation === null) return
        // Do not invent a classification or rewrite timestamp/sequence/generation.
        return session.observe(observation)
      })
      .catch(() => {
        if (valid(owner)) void terminate('inference-error')
      })
      .finally(() => {
        owner.busy = false
      })
  }

  function frame(owner: Owner) {
    if (current !== owner || closed) return
    queued = null
    void Promise.resolve()
      .then(() => {
        if (valid(owner)) return session.tick()
      })
      .then(() => {
        if (!valid(owner)) return
        read(owner)
        schedule(owner)
      })
      .catch(() => {
        if (valid(owner)) void terminate('callback-error')
      })
  }

  function schedule(owner: Owner) {
    if (queued !== null || !valid(owner)) return
    const reservation: Reservation = { handle: null, active: true }
    queued = reservation
    try {
      const handle = scheduler.request(() => {
        if (!reservation.active) return
        reservation.active = false
        if (reservation.handle === null) {
          if (queued === reservation) queued = null
          void terminate('callback-error')
          return
        }
        if (queued !== reservation || !valid(owner)) return
        frame(owner)
      })
      reservation.handle = handle
      if (queued !== reservation || closed) {
        try {
          scheduler.cancel(handle)
        } catch {
          /* Already quarantined. */
        }
        return
      }
      if (!Number.isSafeInteger(handle) || handle < 0)
        throw new TypeError('Invalid observation scheduler')
    } catch {
      void terminate('callback-error')
    }
  }

  function sync() {
    if (closed) return
    try {
      const snapshot = session.getSnapshot()
      if (snapshot.closed || snapshot.state.status !== 'running') {
        if (!stop()) void terminate('callback-error')
        return
      }
      if (!Number.isSafeInteger(snapshot.state.generation) || snapshot.state.generation <= 0) {
        void terminate('callback-error')
        return
      }
      if (current?.generation !== snapshot.state.generation) {
        if (!stop()) {
          void terminate('callback-error')
          return
        }
        current = {
          generation: snapshot.state.generation,
          abort: new AbortController(),
          busy: false,
        }
      }
      schedule(current)
    } catch {
      void terminate('callback-error')
    }
  }
  return Object.freeze({ sync, close: () => terminate('page-hidden') })
}
