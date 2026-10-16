// FR-S-02/04·FR-R-03·FR-U-04/NFR-07/08: private ready clock/owner/result connection.
import { recordId, timestamp } from '../api/records'
import type { captureRecordOwner } from './recordOwner'
import { resultRecord } from './resultRecord'
import { createCoachingSession, type SessionSnapshot } from './session'

type Owner = Awaited<ReturnType<typeof captureRecordOwner>>
type Pair = Readonly<{ monotonicMs: number; utc: string }>
type Base = Parameters<typeof createCoachingSession>[0]
type Options = Omit<Base, 'now'> &
  Readonly<{
    context: Owner
    recordId: string
    readClockPair(): Pair
  }>
const claimedContexts = new WeakSet<Owner>()
class ConfigError extends Error {
  constructor() {
    super('Invalid recorded coaching session')
  }
}

/** Explicit captured authority and clock pair only. Not a public start or auth hook.
 * First ready uses the same sample as session.now; never backdate a later wall clock.
 * save/retry are explicit and cannot keep resources open behind a network wait.
 */
export function createRecordedSession(options: Options) {
  let context: Owner
  let id: string
  let readPair: Options['readClockPair']
  let readGates: Base['readGates']
  let onChange: Base['onChange']
  let plan: Base['plan']
  let ports: Base['ports']
  try {
    context = options.context
    id = options.recordId
    readPair = options.readClockPair
    readGates = options.readGates
    onChange = options.onChange
    plan = options.plan
    ports = options.ports
    if (
      typeof id !== 'string' ||
      !recordId(id) ||
      typeof readPair !== 'function' ||
      typeof readGates !== 'function' ||
      typeof onChange !== 'function' ||
      context.active() !== true ||
      claimedContexts.has(context)
    )
      throw new ConfigError()
  } catch {
    throw new ConfigError()
  }
  let writer: ReturnType<Owner['createWriter']>
  try {
    writer = context.createWriter()
    if (writer.getSnapshot().status !== 'idle') throw new ConfigError()
  } catch {
    throw new ConfigError()
  }
  let latestPair: Pair | null = null
  let anchor: Pair | null = null
  let disposed = false
  let disposal: Promise<void> | null = null
  let recordFailure: 'invalid-result' | 'ownership-error' | 'cleanup-error' | null = null

  function owned(): boolean {
    if (disposed) return false
    try {
      if (context.active() === true) return true
    } catch {
      /* Fixed ownership failure only. */
    }
    recordFailure = 'ownership-error'
    anchor = null
    context.close()
    return false
  }
  function now(): number {
    const pair = readPair()
    const monotonicMs = pair.monotonicMs
    const utc = pair.utc
    if (
      !Number.isFinite(monotonicMs) ||
      monotonicMs < 0 ||
      monotonicMs > Number.MAX_SAFE_INTEGER ||
      !timestamp(utc) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(utc) ||
      new Date(utc).toISOString() !== utc
    )
      throw new ConfigError()
    latestPair = Object.freeze({ monotonicMs, utc })
    return monotonicMs
  }
  function changed(snapshot: SessionSnapshot) {
    if (disposed) return
    if (owned() && snapshot.state.startedAt !== null && anchor === null) {
      if (latestPair?.monotonicMs !== snapshot.state.startedAt) {
        recordFailure = 'invalid-result'
        throw new ConfigError()
      }
      anchor = latestPair
    }
    return onChange(snapshot)
  }
  const session = (() => {
    try {
      return createCoachingSession({
        plan,
        ports,
        now,
        readGates() {
          const gates = readGates()
          return {
            authenticated: owned() && gates.authenticated === true,
            motionValidated: gates.motionValidated === true,
            referenceAvatarReady: gates.referenceAvatarReady === true,
            userAvatarReady: gates.userAvatarReady === true,
          }
        },
        onChange: changed,
      })
    } catch {
      context.close()
      throw new ConfigError()
    }
  })()
  claimedContexts.add(context)
  const action = (run: () => Promise<void>) => (owned() ? run() : session.end('session-expired'))
  function cleanupFailed() {
    if (session.getSnapshot().failure !== 'cleanup-error') return false
    recordFailure = 'cleanup-error'
    return true
  }
  function save(): Promise<void> {
    if (!owned()) return session.end('session-expired')
    if (cleanupFailed()) return Promise.resolve()
    const snapshot = session.getSnapshot()
    if (!anchor) return Promise.resolve()
    try {
      if (snapshot.state.startedAt !== anchor.monotonicMs) throw new ConfigError()
      const row = resultRecord({ snapshot, recordId: id, startedUtcAt: anchor.utc })
      return row ? writer.submit(row) : Promise.resolve()
    } catch {
      recordFailure = 'invalid-result'
      return Promise.resolve()
    }
  }
  function dispose(): Promise<void> {
    if (disposal) return disposal
    disposed = true
    anchor = null
    latestPair = null
    context.close()
    disposal = session.close('page-hidden')
    return disposal
  }
  return Object.freeze({
    getSnapshot: session.getSnapshot,
    getRecordSnapshot() {
      const snapshot = writer.getSnapshot()
      return Object.freeze({
        status:
          recordFailure === 'invalid-result' || recordFailure === 'cleanup-error'
            ? ('failed' as const)
            : snapshot.status,
        failure: recordFailure ?? snapshot.failure,
      })
    },
    start: () => action(session.start),
    resume: () => action(session.resume),
    pause: () => action(session.pause),
    tick: () => action(session.tick),
    targetChanged: () => action(session.targetChanged),
    observe: (observation: Parameters<typeof session.observe>[0]) =>
      action(() => session.observe(observation)),
    end: (reason: Parameters<typeof session.end>[0]) => action(() => session.end(reason)),
    close: (reason: Parameters<typeof session.close>[0]) => action(() => session.close(reason)),
    syncOwner: () => action(() => Promise.resolve()),
    save,
    retry: () => action(() => (cleanupFailed() ? Promise.resolve() : writer.retry())),
    dispose,
  })
}
