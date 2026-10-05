// FR-U-04/FR-R-03/NFR-08: TEST ONLY actual AuthProvider/hook; clocks/ports/frames synthetic.
import { createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from '../../src/auth'
import { useRecordedCoaching } from '../../src/coaching/useRecordedCoaching'

export function mountAuthCoachingProbe(options: {
  recordId: string
  utc: string
  delayed: boolean
}) {
  let hook: ReturnType<typeof useRecordedCoaching> | null = null
  let auth: ReturnType<typeof useAuth> | null = null
  let session: ReturnType<ReturnType<typeof useRecordedCoaching>['getSession']> = null
  let monotonicMs = 0
  let disposed = 0
  let acquired = 0
  let waiting = false
  let release!: () => void
  let pending: Promise<void> | null = null
  const permission = new Promise<void>((resolve) => {
    release = resolve
  })
  const resource = () => {
    acquired++
    return {
      dispose() {
        disposed++
      },
    }
  }
  function View() {
    const latestHook = useRecordedCoaching()
    const latestAuth = useAuth()
    useLayoutEffect(() => {
      hook = latestHook
      auth = latestAuth
    })
    return null
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  root.render(createElement(AuthProvider, null, createElement(View)))
  return {
    async prepare() {
      session =
        (await hook?.prepare({
          recordId: options.recordId,
          readClockPair: () => ({
            monotonicMs,
            utc: new Date(Date.parse(options.utc) + monotonicMs).toISOString(),
          }),
          plan: {
            motionId: 'fixture-not-release',
            version: 'synthetic-algebra-only',
            source: 'direct',
            maxFrameAgeMs: 100,
            maxFrameGapMs: 200,
            steps: [{ id: 'first', kind: 'hold', targetMs: 100 }],
          },
          ports: {
            async camera() {
              waiting = true
              if (options.delayed) await permission
              return resource()
            },
            inference: resource,
            avatars: resource,
          },
          readGates: () => ({
            authenticated: true,
            motionValidated: true,
            referenceAvatarReady: true,
            userAvatarReady: true,
          }),
          onChange() {},
        })) ?? null
    },
    start() {
      pending = session?.start() ?? null
    },
    async perform() {
      await pending
      if (!session) throw new Error('Missing private session')
      let sequence = 0
      for (const [classification, ms] of [
        ['start', 1],
        ['target', 2],
        ['target', 102],
        ['returned', 103],
      ] as const) {
        monotonicMs = ms
        await session.observe({
          generation: session.getSnapshot().state.generation,
          sampledAt: ms,
          sequence: sequence++,
          personCount: 1,
          stepId: 'first',
          classification,
        })
      }
    },
    async release() {
      release()
      await pending
    },
    save: () => session?.save(),
    resume: () => session?.resume(),
    refresh: () => auth?.refresh(),
    signOut: () => auth?.signOut(),
    cancel: () => hook?.cancel(),
    unmount() {
      root.unmount()
      host.remove()
    },
    state() {
      return {
        auth: auth?.state.status ?? 'unmounted',
        hook: hook?.state.status ?? 'unmounted',
        owned: Boolean(hook?.getSession()),
        acquired,
        disposed,
        waiting,
        session: session?.getSnapshot().state.status ?? null,
        record: session?.getRecordSnapshot().status ?? null,
        synthetic_clock_ports_frames: true,
      }
    },
  }
}
