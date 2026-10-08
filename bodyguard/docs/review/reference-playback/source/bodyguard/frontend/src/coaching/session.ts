// FR-S-02/04·FR-U-04·FR-M-07/NFR-07/08: engine↔resource bridge, never a classifier or public gate bypass.
import {
  advanceCoaching,
  type CoachingEvent,
  type CoachingPlan,
  type CoachingState,
  createCoaching,
} from '../stretch/progression'
import { createResourceController, type ResourceNotice } from './resources'

type Gates = Extract<CoachingEvent, { gates: unknown }>['gates']
type EndReason = Extract<CoachingEvent, { type: 'end' }>['reason']
type Observation = Omit<Extract<CoachingEvent, { type: 'frame' }>, 'type' | 'now'>
export type SessionSnapshot = Readonly<{
  state: CoachingState
  closed: boolean
  failure: EndReason | null
}>
type Options = Readonly<{
  plan: CoachingPlan
  ports: Parameters<typeof createResourceController>[0]
  readGates(): Gates
  now(): number
  onChange(snapshot: SessionSnapshot): void | Promise<void>
}>

/** Providers/observations must come from validated adapters. Supplying them is not validation.
 * No request queue serializes a pending permission ahead of pause/termination.
 * Observers are non-blocking; failures stop this instance without exposing raw errors.
 */
export function createCoachingSession(options: Options) {
  let state = createCoaching(options.plan)
  let closed = false
  let failure: EndReason | null = null
  let observerFailed = false
  const resources = createResourceController(options.ports, onResourceNotice)
  const getSnapshot = (): SessionSnapshot => Object.freeze({ state, closed, failure })

  function publish() {
    if (observerFailed) return
    const broke = () => {
      observerFailed = true
      void fail('callback-error', sampleClock() ?? state.lastNow)
    }
    try {
      void Promise.resolve(options.onChange(getSnapshot())).catch(broke)
    } catch {
      broke()
    }
  }

  function fail(reason: EndReason, now = state.lastNow): Promise<void> {
    failure = reason
    closed = true
    state = advanceCoaching(state, { type: 'end', now, reason }).state
    const cleanup = resources.close()
    publish()
    return cleanup
  }

  function sampleClock(): number | null {
    try {
      const value = options.now()
      if (
        Number.isFinite(value) &&
        value >= state.lastNow &&
        value >= 0 &&
        value <= Number.MAX_SAFE_INTEGER
      )
        return value
    } catch {
      /* Fixed failure only; no raw error transmission. */
    }
    return null
  }

  function readClock(): number | null {
    const value = sampleClock()
    if (value === null) void fail('clock-error')
    return value
  }

  function readGates(now: number): Gates | null {
    try {
      const supplied = options.readGates()
      // Read accessors inside the guarded provider boundary; keep only strict booleans.
      return Object.freeze({
        authenticated: supplied?.authenticated === true,
        motionValidated: supplied?.motionValidated === true,
        referenceAvatarReady: supplied?.referenceAvatarReady === true,
        userAvatarReady: supplied?.userAvatarReady === true,
      })
    } catch {
      void fail('gate-error', now)
      return null
    }
  }

  function gateFailure(gates: Gates | null): EndReason | null {
    if (gates?.authenticated !== true) return 'session-expired'
    if (gates.motionValidated !== true) return 'motion-withdrawn'
    if (gates.referenceAvatarReady !== true || gates.userAvatarReady !== true) return 'asset-error'
    return null
  }

  function apply(event: CoachingEvent): Promise<void> {
    const transition = advanceCoaching(state, event)
    if (transition.state === state && transition.effects.length === 0) return Promise.resolve()
    state = transition.state
    const tasks = transition.effects.map((effect) => resources.run(effect))
    if (state.status === 'ended') {
      closed = true
      tasks.push(resources.close())
    }
    publish()
    return Promise.all(tasks).then(() => undefined)
  }

  function onResourceNotice(notice: ResourceNotice) {
    if (notice.type === 'error') {
      void fail(notice.reason, sampleClock() ?? state.lastNow)
      return
    }
    if (closed || notice.generation !== state.generation || state.status !== 'preparing') return
    const now = readClock()
    if (now === null || closed) return
    const gates = readGates(now)
    if (closed) return
    const reason = gateFailure(gates)
    if (reason) {
      void fail(reason, now)
      return
    }
    void apply({ type: 'ready', now, generation: notice.generation })
  }

  function prepare(type: 'start' | 'resume'): Promise<void> {
    if (closed) return resources.close()
    const now = readClock()
    if (now === null || closed) return resources.close()
    const gates = readGates(now)
    if (closed || gates === null) return resources.close()
    // Engine independently requires all four strict true gates; no fallback/coercion.
    return apply({ type, now, gates })
  }

  function action(type: 'pause' | 'tick' | 'target-changed'): Promise<void> {
    if (closed) return resources.close()
    const now = readClock()
    if (now === null || closed) return resources.close()
    if (type === 'tick') {
      const reason = gateFailure(readGates(now))
      if (closed) return resources.close()
      if (reason) return fail(reason, now)
    }
    return apply({ type, now })
  }

  function observe(observation: Observation): Promise<void> {
    if (closed) return resources.close()
    const now = readClock()
    if (now === null || closed) return resources.close()
    const reason = gateFailure(readGates(now))
    if (closed) return resources.close()
    if (reason) return fail(reason, now)
    // The supplied generation/time/sequence remain intact; never restamp a stale observation as new.
    return apply({ ...observation, type: 'frame', now })
  }

  function end(reason: EndReason): Promise<void> {
    if (closed) return resources.close()
    const now = readClock()
    if (now === null || closed) return resources.close()
    return apply({ type: 'end', now, reason })
  }

  return Object.freeze({
    getSnapshot,
    start: () => prepare('start'),
    resume: () => prepare('resume'),
    pause: () => action('pause'),
    tick: () => action('tick'),
    targetChanged: () => action('target-changed'),
    observe,
    end,
    close: end,
  })
}
