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
import type { CredentialsWritable, UserOut, Verification } from './api/generated'

type State =
  | { status: 'checking' | 'guest' | 'offline' | 'logging-out' | 'logout-error' }
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
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('bodyguard-account-change')
      channel.current.onmessage = onFocus
    }
    return () => {
      current.current?.controller.abort()
      current.current = null
      window.removeEventListener('focus', onFocus)
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
  return <Auth.Provider value={{ state, refresh, signIn, signOut }}>{children}</Auth.Provider>
}

export function useAuth() {
  const value = useContext(Auth)
  if (!value) throw new Error('AuthProvider required')
  return value
}
