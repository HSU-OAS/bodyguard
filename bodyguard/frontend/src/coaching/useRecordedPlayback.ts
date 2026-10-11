// FR-M-07/FR-S-02/04/FR-R-03/FR-U-04: owned input/playback/record assembly, no clinical defaults.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth'
import type { CoachingState } from '../stretch/progression'
import { ResourceCleanupError, type ResourceNotice } from './resources'
import type { createCoachingSession, SessionSnapshot } from './session'
import { useRecordedCoaching } from './useRecordedCoaching'

type Session = NonNullable<ReturnType<ReturnType<typeof useRecordedCoaching>['getSession']>>
type Base = Parameters<ReturnType<typeof useRecordedCoaching>['prepare']>[0]
type Observation = Parameters<ReturnType<typeof createCoachingSession>['observe']>[0]
export type PlaybackInput = Readonly<{
  observe(observation: Observation): SessionSnapshot | null
  tick(): SessionSnapshot | null
  onFailure(notice: Extract<ResourceNotice, { type: 'error' }>): void
}>
export type RecordedPlayback = Readonly<{
  ports: Base['ports']
  start(generation: number): boolean
  synchronize(state: CoachingState): boolean
  close(): void | Promise<void>
}>
type Options = Omit<Base, 'ports' | 'ownedResources'> &
  Readonly<{ createPlayback(input: PlaybackInput): RecordedPlayback }>
type Operation = { session: Session | null; closed: boolean; startedGeneration: number }
const claimed = new WeakSet<RecordedPlayback>()

/** Factory must return a fresh inert, independently disposable owner (native adapter compatible).
 * Its own loop supplies classified observations and ticks; there is no second capture/RAF here.
 * Explicit caller-validated gates/plan/clock/observations only. Shape/ready is not clinical proof.
 * observe/tick apply the existing engine synchronously and return that exact updated snapshot;
 * feedback/reference consumers cannot replace it with a fabricated or older owner's state.
 */
export function useRecordedPlayback() {
  const base = useRecordedCoaching()
  const { state: auth } = useAuth()
  const authority = useRef(auth)
  const active = useRef<Operation | null>(null)
  const lifecycle = useRef({ mounted: false, failed: false })
  const [cleanupFailed, setCleanupFailed] = useState(false)
  useLayoutEffect(() => {
    authority.current = auth
  }, [auth])
  useLayoutEffect(() => {
    lifecycle.current.mounted = true
    return () => {
      lifecycle.current.mounted = false
      active.current = null
    }
  }, [])
  const prepare = useCallback(
    async (options: Options): Promise<Session | null> => {
      if (
        !lifecycle.current.mounted ||
        lifecycle.current.failed ||
        authority.current.status !== 'ready'
      )
        return null
      const op: Operation = { session: null, closed: false, startedGeneration: 0 }
      active.current = op
      const current = (): Session | null => {
        if (active.current !== op || op.closed || !op.session) return null
        return base.getSession() === op.session ? op.session : null
      }
      const apply = (action: (session: Session) => Promise<void>): SessionSnapshot | null => {
        const session = current()
        if (!session) return null
        try {
          void action(session).catch(() => {})
        } catch {
          void session.end('inference-error').catch(() => {})
          return null
        }
        return current() === session ? session.getSnapshot() : null
      }
      let playback: RecordedPlayback
      try {
        playback = options.createPlayback(
          Object.freeze({
            observe: (observation: Observation) => apply((session) => session.observe(observation)),
            tick: () => apply((session) => session.tick()),
            onFailure(notice: Extract<ResourceNotice, { type: 'error' }>) {
              const session = current()
              if (session?.getSnapshot().state.generation === notice.generation)
                void session.end(notice.reason).catch(() => {})
            },
          }),
        )
        if (!playback || typeof playback !== 'object' || claimed.has(playback)) throw new Error()
        claimed.add(playback)
      } catch {
        op.closed = true
        if (active.current !== op) return null
        active.current = null
        // A throwing factory must reclaim its own partially constructed native resources.
        await base.cancel()
        return null
      }
      let closing: Promise<void> | null = null
      const close = () => {
        op.closed = true
        // Publish a barrier before foreign close/reentry. Never await this hook's own cancel.
        closing ??= Promise.resolve()
          .then(() => playback.close())
          .catch(() => {
            lifecycle.current.failed = true
            if (lifecycle.current.mounted) setCleanupFailed(true)
            throw new ResourceCleanupError()
          })
        return closing
      }
      try {
        // A reentrant factory/cancel may have superseded this operation before auth capture.
        if (active.current !== op) {
          await close()
          return null
        }
        const synchronize = playback.synchronize.bind(playback)
        const start = playback.start.bind(playback)
        const onChange = options.onChange
        const session = await base.prepare({
          ...options,
          ports: playback.ports,
          ownedResources: { close },
          onChange(snapshot) {
            const session = current()
            if (!session || session.getSnapshot().state !== snapshot.state) return
            synchronize(snapshot.state)
            if (current() !== session || session.getSnapshot().state !== snapshot.state) return
            if (
              snapshot.state.status === 'running' &&
              op.startedGeneration !== snapshot.state.generation
            ) {
              op.startedGeneration = snapshot.state.generation
              const started = start(snapshot.state.generation)
              // Native start may synchronously report failure/input or cancel this owner.
              if (current() !== session || session.getSnapshot().state !== snapshot.state) return
              if (started !== true) {
                apply((owned) => owned.end('ownership-error'))
                return
              }
            }
            return onChange(snapshot)
          },
        })
        if (session && active.current === op && !op.closed) {
          op.session = session
          return session
        }
        await close()
        return null
      } catch {
        let retirement = Promise.resolve()
        if (active.current === op) {
          active.current = null
          retirement = base.cancel()
        }
        // Even failed candidate cleanup cannot skip retirement of the previous session.
        await Promise.all([close(), retirement])
        return null
      }
    },
    [base.prepare, base.getSession, base.cancel],
  )
  const cancel = useCallback(() => {
    active.current = null
    return base.cancel()
  }, [base.cancel])
  const state = cleanupFailed
    ? Object.freeze({ status: 'failed' as const, failure: 'cleanup-error' as const })
    : base.state
  return Object.freeze({ state, getSession: base.getSession, prepare, cancel })
}
