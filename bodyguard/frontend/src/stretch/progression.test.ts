// FR-S-02/04, FR-M-07: synthetic clock/classification tests, not exercise prescriptions.
import { describe, expect, it } from 'vitest'
import {
  advanceCoaching,
  type CoachingEvent,
  type CoachingPlan,
  type CoachingState,
  createCoaching,
  type ObservationClass,
} from './progression'

const gates = {
  authenticated: true,
  motionValidated: true,
  referenceAvatarReady: true,
  userAvatarReady: true,
}
const hold: CoachingPlan = {
  motionId: 'synthetic-algebra-only',
  version: 'fixture-not-release',
  source: 'direct',
  maxFrameGapMs: 120,
  maxFrameAgeMs: 100,
  steps: [{ id: 'left', kind: 'hold', targetMs: 200 }],
}
const reps: CoachingPlan = {
  ...hold,
  steps: [{ id: 'left', kind: 'repetitions', targetMs: 0, repetitions: 2 }],
}
const act = (state: CoachingState, event: CoachingEvent) => advanceCoaching(state, event).state
function running(plan = hold) {
  const requested = act(createCoaching(plan), { type: 'start', now: 0, gates })
  return act(requested, { type: 'ready', now: 0, generation: requested.generation })
}
function frame(
  state: CoachingState,
  sampledAt: number,
  classification: ObservationClass = 'target',
  changes: Partial<Extract<CoachingEvent, { type: 'frame' }>> = {},
) {
  return act(state, {
    type: 'frame',
    now: sampledAt,
    sampledAt,
    sequence: state.lastSequence + 1,
    generation: state.generation,
    personCount: 1,
    stepId: state.plan.steps[state.stepIndex]?.id ?? 'left',
    classification,
    ...changes,
  })
}
function firstTarget(plan = hold) {
  return frame(frame(running(plan), 0, 'start'), 1)
}
function finishHold(state = firstTarget()) {
  return frame(frame(frame(state, 101), 201), 202, 'returned')
}

describe('L-01 explicit immutable plan', () => {
  it.each([NaN, Infinity, -1, 0, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid hold duration %s without inventing a default',
    (value) => {
      expect(() =>
        createCoaching({ ...hold, steps: [{ id: 'left', kind: 'hold', targetMs: value }] }),
      ).toThrow()
    },
  )
  it('requires finite frame policies and explicit positive integer repetitions', () => {
    for (const value of [0, -1, NaN, Infinity]) {
      expect(() => createCoaching({ ...hold, maxFrameGapMs: value })).toThrow()
      expect(() => createCoaching({ ...hold, maxFrameAgeMs: value })).toThrow()
    }
    for (const value of [0, -1, 1.5, NaN, Infinity]) {
      expect(() =>
        createCoaching({
          ...hold,
          steps: [{ id: 'left', kind: 'repetitions', targetMs: 0, repetitions: value }],
        }),
      ).toThrow()
    }
  })
  it('rejects empty, duplicated or incomplete steps', () => {
    expect(() => createCoaching({ ...hold, steps: [] })).toThrow()
    expect(() => createCoaching({ ...hold, steps: [hold.steps[0], hold.steps[0]] })).toThrow()
    expect(() =>
      createCoaching({
        ...hold,
        steps: [{ id: 'left', kind: 'hold' }] as unknown as CoachingPlan['steps'],
      }),
    ).toThrow()
  })
  it('copies and freezes the plan rather than trusting caller mutations', () => {
    const supplied = { ...hold, steps: [{ id: 'left', kind: 'hold' as const, targetMs: 200 }] }
    const state = createCoaching(supplied)
    supplied.steps[0].targetMs = 1
    expect(state.plan.steps[0].targetMs).toBe(200)
    expect(Object.isFrozen(state.plan.steps[0])).toBe(true)
    expect(Object.isFrozen(state)).toBe(true)
  })
})

describe('L-02 explicit start and resource generation', () => {
  it.each(Object.keys(gates) as (keyof typeof gates)[])(
    'does not request a camera when %s is unconfirmed',
    (key) => {
      const state = createCoaching(hold)
      const result = advanceCoaching(state, {
        type: 'start',
        now: 0,
        gates: { ...gates, [key]: false },
      })
      expect(result.state.status).toBe('idle')
      expect(result.effects).toEqual([])
    },
  )
  it('requests only after start and does not start twice', () => {
    const result = advanceCoaching(createCoaching(hold), { type: 'start', now: 10, gates })
    expect(result.effects).toEqual([{ type: 'request-camera', generation: 1 }])
    expect(result.state.status).toBe('preparing')
    expect(advanceCoaching(result.state, { type: 'start', now: 11, gates }).effects).toEqual([])
    expect(frame(result.state, 12).progress[0].verifiedMs).toBe(0)
  })
  it('releases a late ready from its old generation without reviving the session', () => {
    const prepared = act(createCoaching(hold), { type: 'start', now: 0, gates })
    const paused = act(prepared, { type: 'pause', now: 1 })
    const resumed = act(paused, { type: 'resume', now: 2, gates })
    const late = advanceCoaching(resumed, { type: 'ready', now: 3, generation: 1 })
    expect(late.state.status).toBe('preparing')
    expect(late.state.generation).toBe(2)
    expect(late.effects).toEqual([{ type: 'release-resources', generation: 1 }])
  })
  it('requires a deliberate resume and all preparation gates again', () => {
    const paused = act(firstTarget(), { type: 'pause', now: 2 })
    expect(act(paused, { type: 'start', now: 3, gates }).status).toBe('paused')
    expect(
      act(paused, { type: 'resume', now: 3, gates: { ...gates, authenticated: false } }).status,
    ).toBe('paused')
    expect(frame(paused, 3).progress[0].verifiedMs).toBe(0)
  })
})

describe('L-03 observed hold time only', () => {
  it('needs a start and target, counts only fresh pairs, and requires verified return', () => {
    expect(frame(running(), 0).phase).toBe('waiting-start')
    const first = firstTarget()
    expect(first.progress[0].holdMs).toBe(0)
    const half = frame(first, 101)
    expect(half.progress[0].holdMs).toBe(100)
    const goal = frame(half, 201)
    expect(goal.phase).toBe('waiting-return')
    expect(goal.result).toBeNull()
    const done = frame(goal, 202, 'returned')
    expect(done.result?.outcome).toBe('completed')
    expect(done.result?.steps[0].verifiedMs).toBe(200)
  })
  it('never increments from timer ticks or wall-clock completion buttons', () => {
    let state = firstTarget()
    state = act(state, { type: 'tick', now: 101 })
    expect(state.progress[0].holdMs).toBe(0)
    state = act(state, { type: 'tick', now: 5000 })
    expect(state.progress[0].holdMs).toBe(0)
    expect(state.result).toBeNull()
    expect(state.phase).toBe('waiting-start')
  })
  it('does not consume duplicate sequences or out-of-order sample time', () => {
    const half = frame(firstTarget(), 101)
    const duplicate = frame(half, 102, 'target', { sequence: half.lastSequence })
    expect(duplicate.progress[0].holdMs).toBe(100)
    const old = frame(duplicate, 100, 'target', { now: 103 })
    expect(old.progress[0].holdMs).toBe(100)
  })
  it.each([
    { sampledAt: 500, now: 102 },
    { sampledAt: 1, now: 500 },
    { sampledAt: NaN, now: 102 },
    { sampledAt: 102, now: NaN },
  ])('does not count malformed, future or stale frames %j', ({ sampledAt, now }) => {
    const half = frame(firstTarget(), 101)
    const rejected = frame(half, sampledAt, 'target', { now })
    expect(rejected.progress[0].holdMs).toBe(100)
    expect(rejected.result).toBeNull()
  })
  it('breaks continuity across a missing-frame gap instead of filling it', () => {
    const half = frame(firstTarget(), 101)
    let recovered = frame(half, 400)
    expect(recovered.progress[0].holdMs).toBe(100)
    expect(recovered.phase).toBe('waiting-start')
    recovered = frame(frame(recovered, 401, 'start'), 402)
    expect(frame(recovered, 502).progress[0].holdMs).toBe(200)
  })
  it('preserves observed hold time without counting unmet or unobservable time', () => {
    let state = frame(firstTarget(), 101)
    state = frame(state, 111, 'unmet')
    state = frame(state, 121)
    expect(state.progress[0].holdMs).toBe(100)
    state = frame(state, 131, 'unobservable')
    state = frame(state, 141)
    expect(state.progress[0].holdMs).toBe(100)
    expect(state.phase).toBe('waiting-start')
  })
  it('preserves verified time over pause while rejecting all old-generation frames', () => {
    const half = frame(firstTarget(), 101)
    const pause = advanceCoaching(half, { type: 'pause', now: 102 })
    expect(pause.effects).toEqual([{ type: 'release-resources', generation: 1 }])
    const preparing = act(pause.state, { type: 'resume', now: 5000, gates })
    let resumed = act(preparing, { type: 'ready', now: 5000, generation: 2 })
    resumed = frame(resumed, 5001, 'target', { generation: 1 })
    expect(resumed.phase).toBe('waiting-start')
    resumed = frame(frame(resumed, 5002, 'start'), 5003)
    expect(frame(resumed, 5103).progress[0].holdMs).toBe(200)
  })
})

describe('L-04 complete repetition cycles', () => {
  it('does not count a target alone, return alone, or repeated target frames', () => {
    let state = frame(running(reps), 0, 'returned')
    state = frame(state, 1)
    expect(state.progress[0].repetitions).toBe(0)
    state = frame(frame(state, 2, 'start'), 3)
    state = frame(state, 4)
    expect(state.progress[0].repetitions).toBe(0)
    state = frame(frame(state, 5, 'moving'), 6, 'returned')
    expect(state.progress[0].repetitions).toBe(1)
    state = frame(frame(state, 7), 8, 'returned')
    expect(state.result?.outcome).toBe('completed')
    expect(state.result?.steps[0].repetitions).toBe(2)
  })
  it('enforces an explicitly supplied per-repetition hold before return', () => {
    const plan: CoachingPlan = {
      ...hold,
      steps: [{ id: 'left', kind: 'repetitions', targetMs: 100, repetitions: 1 }],
    }
    let state = firstTarget(plan)
    state = frame(state, 51)
    state = frame(state, 52, 'returned')
    expect(state.progress[0].repetitions).toBe(0)
    state = frame(state, 53)
    state = frame(state, 153)
    state = frame(state, 154, 'returned')
    expect(state.result?.outcome).toBe('completed')
  })
  it.each([0, 2])('disarms incomplete cycles for personCount %s', (personCount) => {
    let state = firstTarget(reps)
    state = frame(state, 2, 'target', { personCount })
    state = frame(state, 3, 'returned')
    expect(state.progress[0].repetitions).toBe(0)
    expect(state.phase).toBe('waiting-start')
  })
  it('discards a partial repetition on target changes and time gaps', () => {
    let state = act(firstTarget(reps), { type: 'target-changed', now: 2 })
    state = frame(state, 3, 'returned')
    expect(state.progress[0].repetitions).toBe(0)
    state = frame(frame(state, 4, 'start'), 5)
    state = frame(state, 500, 'returned')
    expect(state.progress[0].repetitions).toBe(0)
  })
})

describe('L-05/06 terminal outcomes and ordered steps', () => {
  it.each([
    'user-stop',
    'pain',
    'page-hidden',
    'session-expired',
    'camera-error',
    'inference-error',
    'asset-error',
    'motion-withdrawn',
  ] as const)('ends without success on %s and releases resources', (reason) => {
    const end = advanceCoaching(frame(firstTarget(), 101), { type: 'end', now: 102, reason })
    expect(end.state.status).toBe('ended')
    expect(end.state.result?.outcome).toBe('interrupted')
    expect(end.state.result?.steps[0].outcome).toBe('partial')
    expect(end.effects).toEqual([{ type: 'release-resources', generation: 1 }])
    expect(frame(end.state, 103).result).toBe(end.state.result)
    expect(act(end.state, { type: 'resume', now: 104, gates })).toBe(end.state)
  })
  it('releases a camera that becomes ready after an early cancel', () => {
    const prepared = act(createCoaching(hold), { type: 'start', now: 0, gates })
    const canceled = act(prepared, { type: 'end', now: 1, reason: 'user-stop' })
    const late = advanceCoaching(canceled, { type: 'ready', now: 2, generation: 1 })
    expect(late.state).toBe(canceled)
    expect(late.effects).toEqual([{ type: 'release-resources', generation: 1 }])
    expect(canceled.result?.elapsedMs).toBe(0)
  })
  it('distinguishes skip before any performance from completion', () => {
    const skipped = act(createCoaching(hold), { type: 'end', now: 0, reason: 'skip' })
    expect(skipped.result?.outcome).toBe('skipped')
    expect(skipped.result?.elapsedMs).toBe(0)
    expect(skipped.result?.steps[0].outcome).toBe('pending')
  })
  it('requires the second side and ignores old-step observations', () => {
    const plan: CoachingPlan = {
      ...hold,
      steps: [...hold.steps, { id: 'right', kind: 'hold', targetMs: 200 }],
    }
    let state = finishHold(firstTarget(plan))
    expect(state.result).toBeNull()
    expect(state.stepIndex).toBe(1)
    expect(state.progress[1].verifiedMs).toBe(0)
    state = frame(state, 203, 'target', { stepId: 'left' })
    expect(state.progress[1].verifiedMs).toBe(0)
    state = frame(frame(state, 204, 'start'), 205)
    state = frame(frame(state, 305), 405)
    state = frame(state, 406, 'returned')
    expect(state.result?.steps.map((step) => step.outcome)).toEqual(['completed', 'completed'])
  })
  it('does not relabel an untouched side when skipping after the first', () => {
    const plan: CoachingPlan = {
      ...hold,
      steps: [...hold.steps, { id: 'right', kind: 'hold', targetMs: 200 }],
    }
    const state = act(finishHold(firstTarget(plan)), { type: 'end', now: 203, reason: 'skip' })
    expect(state.result?.outcome).toBe('skipped')
    expect(state.result?.steps.map((step) => step.outcome)).toEqual(['completed', 'pending'])
  })
  it('does not retain frames, coordinates, tracking or account data in the result', () => {
    const done = finishHold()
    const result = JSON.stringify(done.result)
    expect(result).not.toMatch(
      /sampledAt|sequence|personCount|generation|landmark|video|email|account/,
    )
    expect(Object.isFrozen(done.result)).toBe(true)
    expect(Object.isFrozen(done.result?.steps)).toBe(true)
  })
})

describe('L-02/03 adversarial delivery boundaries', () => {
  it('does not close the active camera on a duplicate malformed ready', () => {
    const state = firstTarget()
    const duplicate = advanceCoaching(state, { type: 'ready', now: NaN, generation: 1 })
    expect(duplicate.state).toBe(state)
    expect(duplicate.effects).toEqual([])
  })
  it('leaves preparation safely paused when its ready clock is invalid', () => {
    const pending = act(createCoaching(hold), { type: 'start', now: 10, gates })
    const invalid = advanceCoaching(pending, { type: 'ready', now: 9, generation: 1 })
    expect(invalid.state.status).toBe('paused')
    expect(invalid.effects).toEqual([{ type: 'release-resources', generation: 1 }])
    expect(frame(invalid.state, 11).progress[0].verifiedMs).toBe(0)
  })
  it('does not accept a timestamp captured before this camera became ready', () => {
    const pending = act(createCoaching(hold), { type: 'start', now: 100, gates })
    let state = act(pending, { type: 'ready', now: 100, generation: 1 })
    state = frame(state, 1, 'start', { now: 100 })
    state = frame(state, 2, 'target', { now: 101 })
    state = frame(state, 102, 'target', { now: 102 })
    expect(state.progress[0].verifiedMs).toBe(0)
    expect(state.phase).toBe('waiting-start')
  })
  it('rejects pre-resume samples even if relabeled with the new generation', () => {
    const paused = act(firstTarget(), { type: 'pause', now: 2 })
    const pending = act(paused, { type: 'resume', now: 50, gates })
    let state = act(pending, { type: 'ready', now: 50, generation: 2 })
    state = frame(state, 3, 'start', { now: 51 })
    state = frame(state, 4, 'target', { now: 52 })
    state = frame(state, 104, 'target', { now: 104 })
    expect(state.progress[0].verifiedMs).toBe(0)
  })
  it('ignores never-requested ready generations without releasing foreign resources', () => {
    const state = firstTarget()
    for (const generation of [0, -1, 2, 1.5, NaN]) {
      const result = advanceCoaching(state, { type: 'ready', now: 2, generation })
      expect(result.state).toBe(state)
      expect(result.effects).toEqual([])
    }
  })
  it('releases only its late old generation while the new one is running', () => {
    const paused = act(firstTarget(), { type: 'pause', now: 2 })
    const pending = act(paused, { type: 'resume', now: 3, gates })
    const state = act(pending, { type: 'ready', now: 3, generation: 2 })
    const late = advanceCoaching(state, { type: 'ready', now: 4, generation: 1 })
    expect(late.state).toBe(state)
    expect(late.effects).toEqual([{ type: 'release-resources', generation: 1 }])
  })
  it('interrupts target timing on a visible non-target movement', () => {
    let state = frame(firstTarget(), 51)
    state = frame(state, 61, 'moving')
    state = frame(state, 71)
    expect(state.progress[0].verifiedMs).toBe(50)
    expect(frame(state, 81).progress[0].verifiedMs).toBe(60)
  })
  it('still stops and releases on invalid pause/end clocks', () => {
    const state = frame(firstTarget(), 101)
    const paused = advanceCoaching(state, { type: 'pause', now: NaN })
    expect(paused.state.status).toBe('paused')
    expect(paused.effects).toEqual([{ type: 'release-resources', generation: 1 }])
    const ended = advanceCoaching(state, { type: 'end', now: -100, reason: 'pain' })
    expect(ended.state.result?.outcome).toBe('interrupted')
    expect(ended.state.result?.elapsedMs).toBe(101)
  })
  it('clamps the last verified interval to the prescribed goal, not the frame length', () => {
    const state = frame(frame(firstTarget(), 101), 211)
    expect(state.progress[0].verifiedMs).toBe(200)
    expect(state.progress[0].holdMs).toBe(200)
  })
  it('does not relabel a completed result with a subsequent skip', () => {
    const done = finishHold()
    const skipped = advanceCoaching(done, { type: 'end', now: 203, reason: 'skip' })
    expect(skipped.state).toBe(done)
    expect(skipped.effects).toEqual([])
    expect(skipped.state.result?.outcome).toBe('completed')
  })
  it('cannot manufacture success or retain arbitrary data from a malformed end reason', () => {
    for (const reason of [undefined, null, 'synthetic-personal-data-not-an-end-reason']) {
      const state = act(running(), { type: 'end', now: 1, reason } as unknown as CoachingEvent)
      expect(state.result?.outcome).toBe('interrupted')
      expect(state.result?.steps[0].outcome).toBe('pending')
      expect(state.result?.reason).toBeUndefined()
      expect(JSON.stringify(state.result)).not.toContain('synthetic-personal-data')
    }
  })
  it('marks an observed zero-duration partial repetition as partial, not pending', () => {
    const state = act(firstTarget(reps), { type: 'end', now: 2, reason: 'user-stop' })
    expect(state.result?.steps[0].outcome).toBe('partial')
    expect(state.result?.steps[0].repetitions).toBe(0)
  })
  it('projects input metadata rather than retaining arbitrary personal properties', () => {
    const plan = {
      ...hold,
      email: 'synthetic-not-an-account',
      steps: [{ ...hold.steps[0], landmark: [] }],
    }
    const state = createCoaching(plan)
    expect(JSON.stringify(state.plan)).not.toMatch(/email|landmark/)
    expect(Object.isFrozen(state.progress[0])).toBe(true)
  })
  it('uses sample intervals rather than delayed delivery time at the exact age limit', () => {
    let state = firstTarget()
    state = frame(state, 2, 'target', { now: 102 })
    expect(state.progress[0].verifiedMs).toBe(1)
    state = frame(state, 101, 'target', { now: 103 })
    expect(state.progress[0].verifiedMs).toBe(100)
  })
  it('accepts the explicit gap boundary but not a gap one unit larger', () => {
    expect(frame(firstTarget(), 121).progress[0].verifiedMs).toBe(120)
    expect(frame(firstTarget(), 122).progress[0].verifiedMs).toBe(0)
  })
  it('fails closed on unknown classifications or non-integer person estimates', () => {
    for (const changes of [
      { classification: 'unrecognized' as ObservationClass },
      { personCount: 1.5 },
    ]) {
      const state = frame(firstTarget(reps), 2, 'target', changes)
      expect(frame(state, 3, 'returned').progress[0].repetitions).toBe(0)
      expect(state.phase).toBe('waiting-start')
    }
  })
  it('preserves progression invariants across 3840 reproducible synthetic events', () => {
    const classifications: ObservationClass[] = [
      'start',
      'target',
      'returned',
      'moving',
      'unmet',
      'unobservable',
    ]
    for (let seed = 1; seed <= 32; seed++) {
      let random = seed
      const next = () => (random = (Math.imul(random, 1664525) + 1013904223) >>> 0)
      const plan =
        seed % 2
          ? hold
          : {
              ...reps,
              steps: [{ id: 'left', kind: 'repetitions' as const, targetMs: 100, repetitions: 2 }],
            }
      let state = running(plan)
      let now = 0
      for (let index = 0; index < 120; index++) {
        now += next() % 151
        const action = next() % 10
        const event: CoachingEvent =
          action < 6
            ? {
                type: 'frame',
                now,
                sampledAt: now - (next() % 130),
                sequence: index,
                generation: state.generation,
                stepId: 'left',
                personCount: next() % 5 === 0 ? 2 : 1,
                classification: classifications[next() % classifications.length],
              }
            : action === 6
              ? { type: 'tick', now }
              : action === 7
                ? { type: 'pause', now }
                : action === 8
                  ? { type: 'resume', now, gates }
                  : { type: 'ready', now, generation: state.generation }
        const before = state
        const transition = advanceCoaching(before, event)
        state = transition.state
        expect(state.progress[0].verifiedMs).toBeGreaterThanOrEqual(before.progress[0].verifiedMs)
        expect(state.progress[0].repetitions).toBeGreaterThanOrEqual(before.progress[0].repetitions)
        expect(state.progress[0].holdMs).toBeGreaterThanOrEqual(0)
        expect(state.progress[0].holdMs).toBeLessThanOrEqual(plan.steps[0].targetMs)
        expect(state.progress[0].verifiedMs).toBeLessThanOrEqual(
          state.lastNow - (state.startedAt ?? state.lastNow),
        )
        if (event.type !== 'frame')
          expect(state.progress[0].verifiedMs).toBe(before.progress[0].verifiedMs)
        if (before.status === 'ended') expect(state).toBe(before)
        for (const effect of transition.effects) {
          expect(effect.generation).toBeGreaterThan(0)
          expect(effect.generation).toBeLessThanOrEqual(state.generation)
        }
      }
    }
  })
})
