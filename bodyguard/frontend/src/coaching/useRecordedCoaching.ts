// FR-U-04/FR-S-04/FR-R-03/NFR-07/08: private committed-auth owner and page lifecycle.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { recordId } from '../api/records'
import { type ReadyAccount, useAuth } from '../auth'
import { createCoaching } from '../stretch/progression'
import { bindCoachingLifecycle } from './lifecycle'
import { createRecordedSession } from './recordedSession'
import { captureRecordOwner } from './recordOwner'

type Session = ReturnType<typeof createRecordedSession>
type Options = Omit<Parameters<typeof createRecordedSession>[0], 'context'>
type Context = Awaited<ReturnType<typeof captureRecordOwner>>
type State = Readonly<{
  status: 'idle' | 'preparing' | 'prepared' | 'failed'
  failure: null | 'preparation-error'
}>
type Operation = {
  authority: ReadyAccount
  abort: AbortController
  context: Context | null
  session: Session | null
  detach: (() => void) | null
  cleanup: Promise<void> | null
}
type Lifecycle = {
  mounted: boolean
  authority: ReadyAccount | null
  operation: Operation | null
  cleanup: Promise<void> | null
}
const idle: State = Object.freeze({ status: 'idle', failure: null })
function current(op: Operation, owner: Lifecycle): boolean {
  return (
    owner.mounted &&
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
  const detach = op.detach
  op.detach = null
  detach?.()
  // Start close before abort for an accurately owned page/user reason. Never await permission/save.
  const closing = op.session?.close(reason)
  op.abort.abort()
  op.context?.close()
  const disposal = op.session?.dispose()
  op.cleanup = Promise.all([closing, disposal]).then(() => undefined)
  return op.cleanup
}
function release(
  owner: Lifecycle,
  op: Operation | null,
  reason: Parameters<typeof retire>[1],
): Promise<void> {
  const task = Promise.all([owner.cleanup, retire(op, reason)]).then(() => undefined)
  owner.cleanup = task
  void task.then(() => {
    if (owner.cleanup === task) owner.cleanup = null
  })
  return task
}

/** No public consumer or automatic start/capture/save. Original AuthProvider state is authority.
 * Caller supplies explicit validated adapters; this hook does not establish clinical validity.
 */
export function useRecordedCoaching() {
  const auth = useAuth().state
  const authority = auth.status === 'ready' ? auth : null
  const owner = useRef<Lifecycle>({
    mounted: false,
    authority: null,
    operation: null,
    cleanup: null,
  })
  const [state, setState] = useState<State>(idle)
  useLayoutEffect(() => {
    owner.current.mounted = true
    return () => {
      const op = owner.current.operation
      owner.current.operation = null
      owner.current.mounted = false
      void release(owner.current, op, 'page-hidden')
      owner.current.authority = null
    }
  }, [])
  useLayoutEffect(() => {
    owner.current.authority = authority
    const op = owner.current.operation
    if (op && op.authority !== authority) {
      owner.current.operation = null
      void release(owner.current, op, 'session-expired')
      setState(idle)
    }
  }, [authority])

  const cancel = useCallback((): Promise<void> => {
    const op = owner.current.operation
    owner.current.operation = null
    const cleanup = release(owner.current, op, 'user-stop')
    if (owner.current.mounted) setState(idle)
    return cleanup
  }, [])
  const prepare = useCallback(async (supplied: Options): Promise<Session | null> => {
    const authority = owner.current.authority
    if (!owner.current.mounted || !authority) return null
    const previous = owner.current.operation
    owner.current.operation = null
    void release(owner.current, previous, 'user-stop')
    const op: Operation = {
      authority,
      abort: new AbortController(),
      context: null,
      session: null,
      detach: null,
      cleanup: null,
    }
    owner.current.operation = op
    setState(Object.freeze({ status: 'preparing', failure: null }))
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
      // Own page cancellation before the first awaited capture, not only after a session exists.
      op.detach = bindCoachingLifecycle(
        {
          close() {
            if (owner.current.operation !== op) return Promise.resolve()
            owner.current.operation = null
            const cleanup = release(owner.current, op, 'page-hidden')
            if (owner.current.mounted) setState(idle)
            return cleanup
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
        if (owner.current.mounted)
          setState(Object.freeze({ status: 'failed', failure: 'preparation-error' }))
      }
      await release(owner.current, op, 'session-expired')
      return null
    }
  }, [])
  const getSession = useCallback((): Session | null => {
    const op = owner.current.operation
    return op && current(op, owner.current) ? op.session : null
  }, [])
  return Object.freeze({ state, prepare, getSession, cancel })
}
