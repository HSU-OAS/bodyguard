// FR-U-04/FR-R-03/NFR-08: TEST ONLY actual AuthProvider/hook; clocks/ports/frames synthetic.
import { createElement, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from '../../src/auth'
import { type PlaybackInput, useRecordedPlayback } from '../../src/coaching/useRecordedPlayback'

export function mountAuthCoachingProbe(options: {
  recordId: string
  utc: string
  delayed: boolean
}) {
  let hook: ReturnType<typeof useRecordedPlayback> | null = null
  let auth: ReturnType<typeof useAuth> | null = null
  let session: ReturnType<ReturnType<typeof useRecordedPlayback>['getSession']> = null
  let input: PlaybackInput | null = null
  let playbackStarts = 0
  let monotonicMs = 0
  let disposed = 0
  let acquired = 0
  let waiting = false
  let lifecycleClosed = 0
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
    const latestHook = useRecordedPlayback()
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
          createPlayback(ownedInput) {
            input = ownedInput
            return {
              ports: {
                async camera() {
                  waiting = true
                  if (options.delayed) await permission
                  return resource()
                },
                inference: resource,
                avatars: resource,
              },
              start() {
                playbackStarts++
                return true
              },
              synchronize() {
                return true
              },
              close() {
                lifecycleClosed++
              },
            }
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
        input?.observe({
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
    retry: () => session?.retry(),
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
        lifecycleClosed,
        playbackStarts,
        session: session?.getSnapshot().state.status ?? null,
        record: session?.getRecordSnapshot().status ?? null,
        recordFailure: session?.getRecordSnapshot().failure ?? null,
        synthetic_clock_ports_frames: true,
      }
    },
  }
}
