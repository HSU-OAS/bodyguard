// FR-U-04/FR-S-04/FR-R-03/NFR-07/08: private committed-auth owner and page lifecycle.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { recordId } from '../api/records'
import { type ReadyAccount, useAuth } from '../auth'
import { createCoaching } from '../stretch/progression'
import { bindCoachingLifecycle } from './lifecycle'
import { createRecordedSession } from './recordedSession'
import { captureRecordOwner } from './recordOwner'
import { ResourceCleanupError } from './resources'

type Session = ReturnType<typeof createRecordedSession>
type Options = Omit<Parameters<typeof createRecordedSession>[0], 'context'> &
  Readonly<{ ownedResources?: Readonly<{ close(): void | Promise<void> }> }>
type Context = Awaited<ReturnType<typeof captureRecordOwner>>
type State = Readonly<{
  status: 'idle' | 'preparing' | 'prepared' | 'failed'
  failure: null | 'preparation-error' | 'cleanup-error'
}>
type Operation = {
  authority: ReadyAccount
  abort: AbortController
  context: Context | null
  session: Session | null
  detach: (() => void) | null
  cleanup: Promise<void> | null
  closeOwned: (() => void | Promise<void>) | null
}
type Lifecycle = {
  mounted: boolean
  authority: ReadyAccount | null
  operation: Operation | null
  cleanup: Promise<void> | null
  poisoned: boolean
  onCleanupFailure(): void
}
const idle: State = Object.freeze({ status: 'idle', failure: null })
const cleanupFailure: State = Object.freeze({ status: 'failed', failure: 'cleanup-error' })
const consumed = new WeakSet<object>()
function claimOwned(
  value: Options['ownedResources'],
  allowed: () => boolean,
): (() => void | Promise<void>) | null {
  if (!allowed()) throw new Error()
  if (value === undefined) return null
  if (!value || typeof value !== 'object' || consumed.has(value)) throw new Error()
  const close = value.close
  if (typeof close !== 'function' || !allowed()) throw new Error()
  consumed.add(value)
  return close.bind(value)
}
function current(op: Operation, owner: Lifecycle): boolean {
  return (
    owner.mounted &&
    !owner.poisoned &&
    owner.operation === op &&
    owner.authority === op.authority &&
    !op.abort.signal.aborted &&
    (!op.context || op.context.active())
  )
}
function retire(
  op: Operation | null,
  reason: 'page-hidden' | 'session-expired' | 'user-stop',
): Promise<void> {
  if (!op) return Promise.resolve()
  if (op.cleanup) return op.cleanup
  let done!: () => void, failed!: (error: ResourceCleanupError) => void
  op.cleanup = new Promise<void>((resolve, reject) => {
    done = resolve
    failed = reject
  })
  // Publish before invoking foreign callbacks. Every action runs even if another throws.
  const tasks: Promise<unknown>[] = []
  const attempt = (action: () => unknown) => {
    try {
      tasks.push(Promise.resolve(action()))
    } catch {
      tasks.push(Promise.reject(new ResourceCleanupError()))
    }
  }
  const detach = op.detach
  op.detach = null
  const closeOwned = op.closeOwned
  op.closeOwned = null
  if (detach) attempt(detach)
  // Start close before abort for an accurately owned page/user reason. Optional native close
  // joins pending ownership; the hook itself never waits for save.
  attempt(() => op.session?.close(reason))
  attempt(() => op.abort.abort())
  attempt(() => op.context?.close())
  attempt(() => op.session?.dispose())
  if (closeOwned) attempt(closeOwned)
  void Promise.allSettled(tasks).then((results) => {
    if (results.some((result) => result.status === 'rejected')) failed(new ResourceCleanupError())
    else done()
  })
  return op.cleanup
}
function release(
  owner: Lifecycle,
  op: Operation | null,
  reason: Parameters<typeof retire>[1],
): Promise<void> {
  const previous = owner.cleanup
  let done!: () => void, failed!: (error: ResourceCleanupError) => void
  const task = new Promise<void>((resolve, reject) => {
    done = resolve
    failed = reject
  })
  owner.cleanup = task
  void Promise.allSettled([previous, retire(op, reason)]).then(async (results) => {
    if (results.some((result) => result.status === 'rejected')) {
      if (!owner.poisoned) {
        owner.poisoned = true
        const pending = owner.operation
        owner.operation = null
        // Quarantine any replacement already waiting for this earlier cleanup.
        await retire(pending, 'session-expired').catch(() => {})
      }
      owner.onCleanupFailure()
      failed(new ResourceCleanupError())
    } else done()
  })
  void task.then(
    () => {
      if (owner.cleanup === task) owner.cleanup = null
    },
    () => {},
  )
  return task
}

/** No public consumer or automatic start/capture/save. Original AuthProvider state is authority.
 * Caller supplies explicit validated adapters; this hook does not establish clinical validity.
 * Transfer a fresh inert lifecycle per prepare. Its close must finish its own cleanup, not
 * return/await this hook's same cleanup barrier. Background failures are fixed and quarantined;
 * explicit cancel rejects ResourceCleanupError after all owned cleanup actions settle.
 */
export function useRecordedCoaching() {
  const auth = useAuth().state
  const authority = auth.status === 'ready' ? auth : null
  const [state, setState] = useState<State>(idle)
  const owner = useRef<Lifecycle>({
    mounted: false,
    authority: null,
    operation: null,
    cleanup: null,
    poisoned: false,
    onCleanupFailure() {
      if (owner.current.mounted) setState(cleanupFailure)
    },
  })
  useLayoutEffect(() => {
    owner.current.mounted = true
    return () => {
      const op = owner.current.operation
      owner.current.operation = null
      owner.current.mounted = false
      void release(owner.current, op, 'page-hidden').catch(() => {})
      owner.current.authority = null
    }
  }, [])
  useLayoutEffect(() => {
    owner.current.authority = authority
    const op = owner.current.operation
    if (op && op.authority !== authority) {
      owner.current.operation = null
      if (!owner.current.poisoned) setState(idle)
      void release(owner.current, op, 'session-expired').catch(() => {})
    }
  }, [authority])

  const cancel = useCallback((): Promise<void> => {
    const op = owner.current.operation
    owner.current.operation = null
    if (owner.current.mounted && !owner.current.poisoned) setState(idle)
    return release(owner.current, op, 'user-stop')
  }, [])
  const prepare = useCallback(async (supplied: Options): Promise<Session | null> => {
    const authority = owner.current.authority
    if (!owner.current.mounted || !authority || owner.current.poisoned) return null
    const previous = owner.current.operation
    const op: Operation = {
      authority,
      abort: new AbortController(),
      context: null,
      session: null,
      detach: null,
      cleanup: null,
      closeOwned: null,
    }
    owner.current.operation = op
    setState(Object.freeze({ status: 'preparing', failure: null }))
    // Install this operation before old foreign close may initiate a newer preparation.
    const barrier = release(owner.current, previous, 'user-stop')
    void barrier.catch(() => {})
    try {
      // Capture explicit config before awaiting auth; pure shape validation is not motion validation.
      const options: Options = {
        recordId: supplied.recordId,
        plan: createCoaching(supplied.plan).plan,
        ports: supplied.ports,
        readGates: supplied.readGates,
        readClockPair: supplied.readClockPair,
        onChange: supplied.onChange,
      }
      if (typeof options.recordId !== 'string' || !recordId(options.recordId)) throw new Error()
      op.closeOwned = claimOwned(supplied.ownedResources, () => current(op, owner.current))
      // Own page cancellation before the first awaited capture, not only after a session exists.
      op.detach = bindCoachingLifecycle(
        {
          close() {
            if (owner.current.operation !== op) return Promise.resolve()
            owner.current.operation = null
            if (owner.current.mounted && !owner.current.poisoned) setState(idle)
            return release(owner.current, op, 'page-hidden').catch(() => {})
          },
        },
        document,
        window,
      )
      if (!current(op, owner.current)) {
        await release(owner.current, op, 'page-hidden')
        return null
      }
      const context = await captureRecordOwner({
        authority,
        readAuthority: () => owner.current.authority,
        signal: op.abort.signal,
      })
      op.context = context
      // A new record session resets its generation; require a fresh lifecycle after quiescence.
      await barrier
      if (!current(op, owner.current)) {
        await release(owner.current, op, 'session-expired')
        return null
      }
      const session = createRecordedSession({
        ...options,
        context,
        onChange(snapshot) {
          if (current(op, owner.current)) return options.onChange(snapshot)
        },
      })
      op.session = session
      if (!current(op, owner.current)) {
        await release(owner.current, op, 'session-expired')
        return null
      }
      setState(Object.freeze({ status: 'prepared', failure: null }))
      return session
    } catch {
      const same = owner.current.operation === op
      if (same) {
        owner.current.operation = null
        if (owner.current.mounted && !owner.current.poisoned)
          setState(Object.freeze({ status: 'failed', failure: 'preparation-error' }))
      }
      await release(owner.current, op, 'session-expired').catch(() => {})
      return null
    }
  }, [])
  const getSession = useCallback((): Session | null => {
    const op = owner.current.operation
    return op && current(op, owner.current) ? op.session : null
  }, [])
  return Object.freeze({ state, prepare, getSession, cancel })
}
