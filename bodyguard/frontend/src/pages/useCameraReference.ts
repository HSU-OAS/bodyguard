// FR-M-03/FR-U-04: explicit account-owned reference save; never a clinical acceptance gate.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import { prepareBaselines } from '../api/baselines'
import type { BaselineInput } from '../api/generated'
import { useAuth } from '../auth'
import { type CameraReferenceState, createCameraReference } from '../posture/cameraReference'

type Frame = Parameters<ReturnType<typeof createCameraReference>['accept']>[0]
type SaveState = 'idle' | 'saving' | 'saved' | 'historical' | 'error' | 'authority-error'
// Keep a rejected committed authority rejected across motion/route remounts.
// Weak identity only, no persisted account identifiers or response data.
const rejectedAuthorities = new WeakSet<object>()
export function useCameraReference(sourceKey: string | null) {
  const { state: account } = useAuth()
  const authority = useRef(account)
  const activeSource = useRef(sourceKey)
  const mounted = useRef(false)
  const collector = useRef(createCameraReference())
  const operation = useRef<AbortController | null>(null)
  const input = useRef<BaselineInput | null>(null)
  const revoked = useRef(false)
  const [state, setState] = useState<CameraReferenceState>({ phase: 'idle' })
  const [saving, setSaving] = useState<SaveState>('idle')
  const [confirmed, setConfirmed] = useState(false)
  const reset = useCallback(() => {
    operation.current?.abort()
    operation.current = null
    input.current = null
    collector.current.reset()
    if (mounted.current) {
      setState(collector.current.read(performance.now()))
      setSaving(revoked.current ? 'authority-error' : 'idle')
      setConfirmed(false)
    }
  }, [])
  useLayoutEffect(() => {
    mounted.current = true
    authority.current = account
    activeSource.current = sourceKey
    revoked.current = account.status === 'ready' && rejectedAuthorities.has(account)
    reset()
    const retire = () => reset()
    const hidden = () => {
      if (document.hidden) retire()
    }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', retire)
    return () => {
      mounted.current = false
      operation.current?.abort()
      operation.current = null
      input.current = null
      collector.current.reset()
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', retire)
    }
  }, [account, sourceKey, reset])
  const allowed = () =>
    mounted.current &&
    activeSource.current === sourceKey &&
    !revoked.current &&
    authority.current.status === 'ready' &&
    document.visibilityState === 'visible'
  const publish = (now: number) => {
    if (!allowed()) return
    const next = collector.current.read(now)
    // Progress renders only at a tenth-second boundary; no per-frame React/raw history.
    setState((old) =>
      old.phase === 'collecting' &&
      next.phase === 'collecting' &&
      Math.floor(old.elapsedMs / 100) === Math.floor(next.elapsedMs / 100)
        ? old
        : next,
    )
  }
  function begin() {
    if (
      !allowed() ||
      operation.current ||
      saving === 'authority-error' ||
      collector.current.read(performance.now()).phase === 'collecting'
    )
      return
    reset()
    collector.current.begin(performance.now())
    publish(performance.now())
  }
  function accept(frame: Frame, now: number) {
    if (!allowed()) return
    collector.current.accept(frame, now)
    publish(now)
  }
  async function save() {
    const captured = collector.current.read(performance.now())
    const owner = authority.current
    if (
      !allowed() ||
      owner.status !== 'ready' ||
      !confirmed ||
      captured.phase !== 'review' ||
      operation.current ||
      saving === 'saved' ||
      saving === 'historical' ||
      saving === 'authority-error'
    )
      return
    // Uncertain writes retry this same immutable ID; no second reference is invented.
    input.current ??= Object.freeze({
      id: crypto.randomUUID(),
      client_version: 'web-observation-1',
      neck: null,
      trunk: null,
      shoulder: Object.freeze({
        method: captured.draft.method,
        unit: captured.draft.unit,
        value: captured.draft.value,
      }),
    })
    const value = input.current
    const abort = new AbortController()
    operation.current = abort
    setSaving('saving')
    let lease: Awaited<ReturnType<typeof prepareBaselines>> | undefined
    const current = () =>
      allowed() &&
      authority.current === owner &&
      operation.current === abort &&
      !abort.signal.aborted
    try {
      lease = await prepareBaselines({
        authority: owner,
        signal: abort.signal,
        readAuthority: () => (current() ? owner : null),
      })
      const stored = await lease.save(value, abort.signal)
      if (current()) setSaving(stored.is_active ? 'saved' : 'historical')
    } catch (error) {
      if (current()) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          revoked.current = true
          rejectedAuthorities.add(owner)
          input.current = null
          collector.current.reset()
          setState({ phase: 'idle' })
          setConfirmed(false)
          setSaving('authority-error')
        } else setSaving('error')
      }
    } finally {
      lease?.close()
      if (operation.current === abort) operation.current = null
    }
  }
  return { state, saving, confirmed, setConfirmed, begin, accept, tick: publish, reset, save }
}
