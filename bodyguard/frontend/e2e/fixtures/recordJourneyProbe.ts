// FR-R-01/03/06, FR-U-04/05: TEST ONLY provider/aggregation/upload/query composition.
import { createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { DashboardQuery } from '../../src/api/dashboard'
import { AuthProvider, type ReadyAccount, useAuth } from '../../src/auth'
import { useOwnedDashboard } from '../../src/records/useOwnedDashboard'
import { prepareOwnedMinuteUpload } from '../../src/summary/ownedMinuteUpload'

export function mountRecordJourneyProbe(query: DashboardQuery) {
  let control: ReturnType<typeof useOwnedDashboard> | null = null
  let auth: ReturnType<typeof useAuth> | null = null
  let owner: ReadyAccount | null = null
  let mounted = false
  let abort: AbortController | null = null
  let pipeline: Awaited<ReturnType<typeof prepareOwnedMinuteUpload>> | null = null
  let next = 0
  function retire() {
    abort?.abort()
    pipeline?.close()
  }
  function View() {
    const latest = useOwnedDashboard(),
      latestAuth = useAuth()
    const authority = latestAuth.state.status === 'ready' ? latestAuth.state : null
    useLayoutEffect(() => {
      control = latest
      auth = latestAuth
      if (owner !== authority) retire()
      owner = authority
    })
    useLayoutEffect(() => {
      mounted = true
      window.addEventListener('pagehide', retire)
      return () => {
        mounted = false
        owner = null
        window.removeEventListener('pagehide', retire)
        retire()
      }
    }, [])
    return null
  }
  const host = document.createElement('div')
  host.dataset.recordJourneyProbe = 'TEST ONLY'
  document.body.append(host)
  const root = createRoot(host)
  root.render(createElement(AuthProvider, null, createElement(View)))
  return {
    async prepare(utc: string) {
      retire()
      if (!mounted || !owner) return
      const original = owner
      const operation = new AbortController()
      abort = operation
      const ready = await prepareOwnedMinuteUpload({
        authority: original,
        readAuthority: () => (mounted ? owner : null),
        signal: operation.signal,
        maxQueuedMinutes: 4,
        maxBatchMinutes: 2,
        aggregation: {
          clock: { monotonicMs: 0, utc },
          baselineId: null,
          clientVersion: 'Fixture+V1',
          maxIntervalMs: 60000,
          maxBufferedMinutes: 4,
          definitions: {
            neck: { method: 'fixture-neck', unit: 'deg', minDeviation: -180, maxDeviation: 180 },
            shoulder: {
              method: 'fixture-shoulder',
              unit: 'deg',
              minDeviation: -180,
              maxDeviation: 180,
            },
            trunk: { method: 'fixture-trunk', unit: 'deg', minDeviation: -180, maxDeviation: 180 },
          },
        },
      })
      if (!mounted || owner !== original || abort !== operation || operation.signal.aborted) {
        ready.close()
        return
      }
      pipeline = ready
      next = 0
    },
    observe() {
      if (!pipeline || !mounted) return
      // Synthetic intervals, not raw coordinates, a camera or a clinical classifier.
      pipeline.push({
        startMs: next,
        endMs: next + 30000,
        present: true,
        background: false,
        neck: null,
        shoulder: { deviation: 1.25, bad: true },
        trunk: null,
      })
      pipeline.push({
        startMs: next + 30000,
        endMs: next + 60000,
        present: true,
        background: false,
        neck: null,
        shoulder: null,
        trunk: null,
      })
      next += 60000
      pipeline.flush(next)
    },
    upload: () => pipeline?.upload(),
    retry: () => pipeline?.retry(),
    read: () => control?.read(query),
    refresh: () => auth?.refresh(),
    signOut: () => auth?.signOut(),
    state() {
      const value = control?.getSnapshot()
      return {
        auth: auth?.state.status ?? 'unmounted',
        upload: pipeline?.getSnapshot() ?? null,
        dashboard: value?.status ?? 'unmounted',
        minutes: value?.status === 'ready' ? value.value.totals.minutes : null,
        totals: value?.status === 'ready' ? value.value.totals : null,
        provenance: value?.status === 'ready' ? value.value.provenance : null,
      }
    },
    unmount() {
      root.unmount()
      auth = null
      host.remove()
    },
  }
}
