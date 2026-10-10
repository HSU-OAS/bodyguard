// FR-R-03/06, FR-U-04/NFR-08: committed auth and request lifetime; no public consumer.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import { type DashboardQuery, readDashboard } from '../api/dashboard'
import type { DashboardOut } from '../api/generated'
import { type ReadyAccount, useAuth } from '../auth'

type State =
  | Readonly<{ status: 'idle' | 'loading' }>
  | Readonly<{ status: 'ready'; value: DashboardOut }>
  | Readonly<{ status: 'error'; statusCode: number }>
type Operation = { authority: ReadyAccount; owner: string; abort: AbortController }
type Owner = {
  mounted: boolean
  authority: ReadyAccount | null
  operation: Operation | null
  snapshot: State
}
const idle: State = Object.freeze({ status: 'idle' })
function current(owner: Owner, op: Operation) {
  return (
    owner.mounted &&
    owner.operation === op &&
    owner.authority === op.authority &&
    op.authority.user.id === op.owner &&
    !op.abort.signal.aborted
  )
}

/** Explicit requests only. No cache, storage, polling, camera or automatic retry. */
export function useOwnedDashboard() {
  const auth = useAuth()
  const authority = auth.state.status === 'ready' ? auth.state : null
  const owner = useRef<Owner>({ mounted: false, authority: null, operation: null, snapshot: idle })
  const [, render] = useState(0)
  const publish = useCallback((snapshot: State) => {
    owner.current.snapshot = snapshot
    if (owner.current.mounted) render((revision) => revision + 1)
  }, [])
  const cancel = useCallback(() => {
    const op = owner.current.operation
    owner.current.operation = null
    publish(idle)
    op?.abort.abort()
  }, [publish])
  useLayoutEffect(() => {
    owner.current.mounted = true
    window.addEventListener('pagehide', cancel)
    return () => {
      window.removeEventListener('pagehide', cancel)
      owner.current.mounted = false
      owner.current.authority = null
      cancel()
    }
  }, [cancel])
  useLayoutEffect(() => {
    owner.current.authority = authority
    const op = owner.current.operation
    if (op && (op.authority !== authority || op.owner !== authority?.user.id)) cancel()
  }, [authority, cancel])
  const getSnapshot = useCallback((): State => {
    const op = owner.current.operation
    return op && current(owner.current, op) ? owner.current.snapshot : idle
  }, [])
  const read = useCallback(
    async (query: DashboardQuery): Promise<DashboardOut | null> => {
      const authority = owner.current.authority
      if (!owner.current.mounted || !authority) return null
      const previous = owner.current.operation
      const op: Operation = { authority, owner: authority.user.id, abort: new AbortController() }
      owner.current.operation = op
      publish(Object.freeze({ status: 'loading' }))
      previous?.abort.abort()
      if (!current(owner.current, op)) return null
      try {
        const value = await readDashboard(
          {
            authority,
            readAuthority: () => owner.current.authority,
            signal: op.abort.signal,
          },
          query,
        )
        if (!current(owner.current, op)) return null
        publish(Object.freeze({ status: 'ready', value }))
        return value
      } catch (error) {
        if (!current(owner.current, op)) return null
        const statusCode = error instanceof ApiError ? error.status : 503
        publish(Object.freeze({ status: 'error', statusCode }))
        // A retired 401 must not recheck/erase a newer account or request.
        if (statusCode === 401) void auth.refresh()
        return null
      }
    },
    [auth.refresh, publish],
  )
  // Do not expose old data during the render before the authority layout effect retires it.
  const op = owner.current.operation
  const state =
    op?.authority === authority && op?.owner === authority?.user.id ? getSnapshot() : idle
  return Object.freeze({ state, read, cancel, getSnapshot })
}
