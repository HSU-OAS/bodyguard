// FR-U-04, NFR-08: /me is the authority; stale responses never revive private UI.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import * as api from './api/auth'
import type {
  CredentialsWritable,
  ResetInput,
  UserOut,
  Verification,
  WithdrawalConfirmWritable,
} from './api/generated'
import { confirmWithdrawal, WithdrawalRejected } from './api/withdrawal'

type State =
  | { status: 'checking' | 'guest' | 'offline' | 'logging-out' | 'logout-error' | 'withdrawing' }
  | { status: 'ready'; user: UserOut }

const Auth = createContext<{
  state: State
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  signIn: (
    kind: 'login' | 'verify',
    body: CredentialsWritable | Verification,
    signal: AbortSignal,
  ) => Promise<void>
  resetPassword: (body: ResetInput, signal: AbortSignal) => Promise<void>
  withdrawAccount: (body: WithdrawalConfirmWritable, signal: AbortSignal) => Promise<void>
} | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'checking' })
  const current = useRef<{
    controller: AbortController
    kind: 'refresh' | 'auth' | 'logout'
  } | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const begin = useCallback((kind: 'refresh' | 'auth' | 'logout') => {
    current.current?.controller.abort()
    const operation = { controller: new AbortController(), kind }
    current.current = operation
    return operation
  }, [])
  const refresh = useCallback(async () => {
    if (current.current && current.current.kind !== 'refresh') return
    const operation = begin('refresh')
    setState({ status: 'checking' })
    try {
      const user = await api.me(operation.controller.signal)
      if (!operation.controller.signal.aborted)
        setState(user ? { status: 'ready', user } : { status: 'guest' })
    } catch {
      if (!operation.controller.signal.aborted) setState({ status: 'offline' })
    } finally {
      if (current.current === operation) current.current = null
    }
  }, [begin])

  useEffect(() => {
    void refresh()
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      current.current?.controller.abort()
      current.current = null
      void refresh()
    }
    // FR-U-04: cached Back navigation is not authority for a private screen.
    window.addEventListener('pageshow', onPageShow)
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('bodyguard-account-change')
      channel.current.onmessage = onFocus
    }
    return () => {
      current.current?.controller.abort()
      current.current = null
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      channel.current?.close()
      channel.current = null
    }
  }, [refresh])

  async function signIn(
    kind: 'login' | 'verify',
    body: CredentialsWritable | Verification,
    external: AbortSignal,
  ) {
    const operation = begin('auth')
    const signal = AbortSignal.any([operation.controller.signal, external])
    setState({ status: 'checking' })
    try {
      const user = await api.authenticate(kind, body, signal)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      setState({ status: 'ready', user })
      channel.current?.postMessage('changed')
    } catch (error) {
      if (!operation.controller.signal.aborted) setState({ status: 'guest' })
      throw error
    } finally {
      if (current.current === operation) current.current = null
    }
  }

  async function signOut() {
    const operation = begin('logout')
    setState({ status: 'logging-out' })
    try {
      await api.logout(operation.controller.signal)
      if (!operation.controller.signal.aborted) {
        setState({ status: 'guest' })
        current.current = null
        channel.current?.postMessage('changed')
      }
    } catch {
      // Keep private UI blocked even if the server has not confirmed revocation.
      if (!operation.controller.signal.aborted) setState({ status: 'logout-error' })
    }
  }

  // FR-U-03: no automatic authentication; uncertain/cancelled reset never revives private UI.
  async function resetPassword(body: ResetInput, external: AbortSignal) {
    const operation = begin('auth')
    const signal = AbortSignal.any([operation.controller.signal, external])
    setState({ status: 'checking' })
    try {
      await api.resetPassword(body, signal)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      setState({ status: 'guest' })
      channel.current?.postMessage('changed')
    } catch (error) {
      if (!operation.controller.signal.aborted) setState({ status: 'offline' })
      throw error
    } finally {
      if (current.current === operation) current.current = null
    }
  }
  // FR-U-05: withdrawal blocks other private routes; only a fresh /me may restore them.
  async function withdrawAccount(body: WithdrawalConfirmWritable, external: AbortSignal) {
    const operation = begin('auth')
    const signal = AbortSignal.any([operation.controller.signal, external])
    setState({ status: 'withdrawing' })
    try {
      await confirmWithdrawal(body, signal)
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      setState({ status: 'guest' })
      channel.current?.postMessage('changed')
    } catch (error) {
      let checkedUserId: string | null = null
      if (!operation.controller.signal.aborted) {
        if (
          !signal.aborted &&
          error instanceof api.ApiError &&
          [400, 422, 429].includes(error.status)
        ) {
          try {
            const user = await api.me(signal)
            if (!signal.aborted) {
              checkedUserId = user?.id ?? null
              setState(user ? { status: 'ready', user } : { status: 'guest' })
            } else if (!operation.controller.signal.aborted) setState({ status: 'offline' })
          } catch {
            if (!operation.controller.signal.aborted) setState({ status: 'offline' })
          }
        } else setState({ status: 'offline' })
      }
      if (checkedUserId && error instanceof api.ApiError)
        throw new WithdrawalRejected(error, checkedUserId)
      throw error
    } finally {
      if (current.current === operation) current.current = null
    }
  }
  return (
    <Auth.Provider value={{ state, refresh, signIn, signOut, resetPassword, withdrawAccount }}>
      {children}
    </Auth.Provider>
  )
}

export function useAuth() {
  const value = useContext(Auth)
  if (!value) throw new Error('AuthProvider required')
  return value
}
