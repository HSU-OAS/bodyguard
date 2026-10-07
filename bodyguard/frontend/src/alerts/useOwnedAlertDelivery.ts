// FR-N-03/04/05/FR-U-04/NFR-08: private committed-account, settings and page lifetime.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { preparePreferences } from '../api/notificationPreferences'
import { type ReadyAccount, useAuth } from '../auth'
import {
  type AlertDelivery,
  type AlertKind,
  createAlertDelivery,
  type NotificationPort,
} from './delivery'

type State = Readonly<{ status: 'idle' | 'preparing' | 'prepared' | 'failed' }>
type Options = { port: NotificationPort; onChoose(kind: AlertKind): void }
type Operation = {
  authority: ReadyAccount
  abort: AbortController
  preferences: Awaited<ReturnType<typeof preparePreferences>> | null
  delivery: AlertDelivery | null
  detach: (() => void) | null
}
type Owner = { mounted: boolean; authority: ReadyAccount | null; operation: Operation | null }
const idle: State = Object.freeze({ status: 'idle' })
function current(owner: Owner, op: Operation) {
  return (
    owner.mounted &&
    owner.operation === op &&
    owner.authority === op.authority &&
    !op.abort.signal.aborted &&
    document.visibilityState !== 'hidden'
  )
}
function retire(op: Operation | null) {
  if (!op) return
  const detach = op.detach
  op.detach = null
  detach?.()
  op.abort.abort()
  op.preferences?.close()
  op.delivery?.dispose()
}

/** No public consumer, scheduler or automatic preparation/permission/camera/sound/save. */
export function useOwnedAlertDelivery() {
  const auth = useAuth().state
  const authority = auth.status === 'ready' ? auth : null
  const owner = useRef<Owner>({ mounted: false, authority: null, operation: null })
  const [state, setState] = useState<State>(idle)
  useLayoutEffect(() => {
    owner.current.mounted = true
    return () => {
      const op = owner.current.operation
      owner.current.operation = null
      owner.current.mounted = false
      owner.current.authority = null
      retire(op)
    }
  }, [])
  useLayoutEffect(() => {
    owner.current.authority = authority
    const op = owner.current.operation
    if (op && op.authority !== authority) {
      owner.current.operation = null
      setState(idle)
      retire(op)
    }
  }, [authority])
  const cancel = useCallback(() => {
    const op = owner.current.operation
    owner.current.operation = null
    if (owner.current.mounted) setState(idle)
    retire(op)
  }, [])
  const prepare = useCallback(async (options: Options): Promise<AlertDelivery | null> => {
    const authority = owner.current.authority
    if (!owner.current.mounted || !authority || document.visibilityState === 'hidden') return null
    const previous = owner.current.operation
    const op: Operation = {
      authority,
      abort: new AbortController(),
      preferences: null,
      delivery: null,
      detach: null,
    }
    owner.current.operation = op
    setState(Object.freeze({ status: 'preparing' }))
    const stop = () => {
      if (owner.current.operation !== op) return
      owner.current.operation = null
      if (owner.current.mounted) setState(idle)
      retire(op)
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') stop()
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', stop)
    op.detach = () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', stop)
    }
    // FR-N-05: own page cancellation before old handles publish reentrant callbacks.
    retire(previous)
    if (!current(owner.current, op)) {
      retire(op)
      return null
    }
    try {
      // Capture callback/port before awaiting. Settings are this lifetime's owned snapshot.
      const port = options.port
      const onChoose = options.onChoose
      op.preferences = await preparePreferences({
        authority,
        readAuthority: () => owner.current.authority,
        signal: op.abort.signal,
      })
      if (!current(owner.current, op)) {
        retire(op)
        return null
      }
      const value = op.preferences.value
      op.delivery = createAlertDelivery({
        port,
        isCurrent: () => current(owner.current, op),
        enabled: { posture: value.posture_enabled, sitting: value.sitting_enabled },
        onChoose,
      })
      if (!current(owner.current, op)) {
        retire(op)
        return null
      }
      setState(Object.freeze({ status: 'prepared' }))
      return op.delivery
    } catch {
      if (owner.current.operation === op) {
        owner.current.operation = null
        if (owner.current.mounted) setState(Object.freeze({ status: 'failed' }))
      }
      retire(op)
      return null
    }
  }, [])
  const getDelivery = useCallback(() => {
    const op = owner.current.operation
    return op && current(owner.current, op) ? op.delivery : null
  }, [])
  return Object.freeze({ state, prepare, getDelivery, cancel })
}
