// Counts supplied, validated observations; does not classify poses or prescribe exercise.
export type CoachingStep = Readonly<
  | { id: string; kind: 'hold'; targetMs: number }
  | { id: string; kind: 'repetitions'; targetMs: number; repetitions: number }
>
export type CoachingPlan = Readonly<{
  motionId: string
  version: string
  source: 'direct' | 'recommended' | 'alert'
  maxFrameGapMs: number
  maxFrameAgeMs: number
  steps: readonly CoachingStep[]
}>
export type ObservationClass = 'start' | 'target' | 'returned' | 'moving' | 'unmet' | 'unobservable'
type Gates = Readonly<{
  authenticated: boolean
  motionValidated: boolean
  referenceAvatarReady: boolean
  userAvatarReady: boolean
}>
// FR-S-04/NFR-07/08: preserve bounded technical termination causes, never fabricate pose errors.
type EndReason =
  | 'user-stop'
  | 'pain'
  | 'page-hidden'
  | 'session-expired'
  | 'camera-error'
  | 'inference-error'
  | 'asset-error'
  | 'motion-withdrawn'
  | 'ownership-error'
  | 'cleanup-error'
  | 'clock-error'
  | 'gate-error'
  | 'callback-error'
  | 'skip'
export type CoachingEvent =
  | { type: 'start' | 'resume'; now: number; gates: Gates }
  | { type: 'ready'; now: number; generation: number }
  | {
      type: 'frame'
      now: number
      generation: number
      sampledAt: number
      sequence: number
      personCount: number
      stepId: string
      classification: ObservationClass
    }
  | { type: 'tick' | 'pause' | 'target-changed'; now: number }
  | { type: 'end'; now: number; reason: EndReason }
type Progress = Readonly<{
  holdMs: number
  repetitions: number
  verifiedMs: number
  attempted: boolean
  completed: boolean
}>
type CoachingResult = Readonly<{
  motionId: string
  version: string
  source: CoachingPlan['source']
  outcome: 'completed' | 'interrupted' | 'skipped'
  reason?: EndReason
  elapsedMs: number
  steps: readonly Readonly<{
    id: string
    outcome: 'completed' | 'partial' | 'pending'
    verifiedMs: number
    repetitions: number
  }>[]
}>
export type CoachingState = Readonly<{
  plan: CoachingPlan
  status: 'idle' | 'preparing' | 'running' | 'paused' | 'ended'
  generation: number
  stepIndex: number
  lastSequence: number
  phase: 'waiting-start' | 'seeking-target' | 'holding' | 'waiting-return'
  progress: readonly Progress[]
  result: CoachingResult | null
  lastNow: number
  startedAt: number | null
  readyAt: number | null
  lastObservationAt: number | null
  lastSampledAt: number | null
  lastTargetAt: number | null
}>
type Effect = Readonly<{ type: 'request-camera' | 'release-resources'; generation: number }>
type Transition = { state: CoachingState; effects: readonly Effect[] }

const time = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
const positive = (value: number) => time(value) && value > 0
const named = (value: string) => typeof value === 'string' && value.trim().length > 0

export function createCoaching(input: CoachingPlan): CoachingState {
  if (
    !named(input.motionId) ||
    !named(input.version) ||
    !['direct', 'recommended', 'alert'].includes(input.source) ||
    !positive(input.maxFrameGapMs) ||
    !positive(input.maxFrameAgeMs) ||
    !Array.isArray(input.steps) ||
    input.steps.length === 0
  )
    throw new Error('An explicit validated coaching plan is required')
  const ids = new Set<string>()
  const steps = input.steps.map((step): CoachingStep => {
    if (!step || !named(step.id) || ids.has(step.id))
      throw new Error('Step IDs must be unique and nonempty')
    ids.add(step.id)
    if (step.kind === 'hold' && positive(step.targetMs)) {
      return Object.freeze({ id: step.id, kind: step.kind, targetMs: step.targetMs })
    }
    if (
      step.kind === 'repetitions' &&
      time(step.targetMs) &&
      Number.isSafeInteger(step.repetitions) &&
      step.repetitions > 0 &&
      time(step.targetMs * step.repetitions)
    ) {
      return Object.freeze({
        id: step.id,
        kind: step.kind,
        targetMs: step.targetMs,
        repetitions: step.repetitions,
      })
    }
    throw new Error('Step duration and repetition count must be explicitly valid')
  })
  const plan = Object.freeze({
    motionId: input.motionId,
    version: input.version,
    source: input.source,
    maxFrameGapMs: input.maxFrameGapMs,
    maxFrameAgeMs: input.maxFrameAgeMs,
    steps: Object.freeze(steps),
  })
  return freeze({
    plan,
    status: 'idle',
    generation: 0,
    stepIndex: 0,
    lastSequence: -1,
    phase: 'waiting-start',
    result: null,
    lastNow: 0,
    startedAt: null,
    readyAt: null,
    lastObservationAt: null,
    lastSampledAt: null,
    lastTargetAt: null,
    progress: steps.map(() => ({
      holdMs: 0,
      repetitions: 0,
      verifiedMs: 0,
      attempted: false,
      completed: false,
    })),
  })
}

function freeze(state: CoachingState): CoachingState {
  return Object.freeze({
    ...state,
    progress: Object.freeze(state.progress.map((value) => Object.freeze({ ...value }))),
  })
}
function updateProgress(state: CoachingState, changes: Partial<Progress>): CoachingState {
  return {
    ...state,
    progress: state.progress.map((value, index) =>
      index === state.stepIndex ? { ...value, ...changes } : value,
    ),
  }
}
function disarm(state: CoachingState): CoachingState {
  const step = state.plan.steps[state.stepIndex]
  return {
    ...updateProgress(state, step.kind === 'repetitions' ? { holdMs: 0 } : {}),
    phase: 'waiting-start',
    lastObservationAt: null,
    lastTargetAt: null,
  }
}
function finish(
  state: CoachingState,
  outcome: CoachingResult['outcome'],
  reason?: EndReason,
): CoachingState {
  const result: CoachingResult = Object.freeze({
    motionId: state.plan.motionId,
    version: state.plan.version,
    source: state.plan.source,
    outcome,
    ...(reason === undefined ? {} : { reason }),
    elapsedMs: state.startedAt === null ? 0 : state.lastNow - state.startedAt,
    steps: Object.freeze(
      state.progress.map((value, index) =>
        Object.freeze({
          id: state.plan.steps[index].id,
          outcome: value.completed
            ? ('completed' as const)
            : value.attempted
              ? ('partial' as const)
              : ('pending' as const),
          verifiedMs: value.verifiedMs,
          repetitions: value.repetitions,
        }),
      ),
    ),
  })
  return { ...disarm(state), status: 'ended', result }
}
const ownedGeneration = (state: CoachingState, generation: number) =>
  Number.isSafeInteger(generation) && generation > 0 && generation <= state.generation
const release = (generation: number): readonly Effect[] =>
  generation > 0 ? [{ type: 'release-resources', generation }] : []

export function advanceCoaching(original: CoachingState, event: CoachingEvent): Transition {
  const unchanged = (): Transition => ({ state: original, effects: [] })
  const validNow = time(event.now) && event.now >= original.lastNow
  // Late permission/model responses own only their generation, never the current one's resources.
  if (event.type === 'ready' && ownedGeneration(original, event.generation)) {
    if (
      event.generation !== original.generation ||
      original.status === 'paused' ||
      original.status === 'ended'
    ) {
      return { state: original, effects: release(event.generation) }
    }
    if (original.status === 'running') return unchanged()
    if (!validNow && original.status === 'preparing') {
      return {
        state: freeze({ ...disarm(original), status: 'paused' }),
        effects: release(event.generation),
      }
    }
  }
  if (original.status === 'ended') return unchanged()
  let state: CoachingState = { ...original, lastNow: validNow ? event.now : original.lastNow }
  let effects: readonly Effect[] = []
  if (event.type === 'end') {
    const reason = [
      'user-stop',
      'pain',
      'page-hidden',
      'session-expired',
      'camera-error',
      'inference-error',
      'asset-error',
      'motion-withdrawn',
      'ownership-error',
      'cleanup-error',
      'clock-error',
      'gate-error',
      'callback-error',
      'skip',
    ].includes(event.reason)
      ? event.reason
      : undefined
    return {
      state: freeze(finish(state, reason === 'skip' ? 'skipped' : 'interrupted', reason)),
      effects: release(state.generation),
    }
  }
  if (event.type === 'pause') {
    if (state.status !== 'running' && state.status !== 'preparing') return unchanged()
    return {
      state: freeze({ ...disarm(state), status: 'paused' }),
      effects: release(state.generation),
    }
  }
  if (event.type === 'start' || event.type === 'resume') {
    if (!validNow || state.status !== (event.type === 'start' ? 'idle' : 'paused'))
      return unchanged()
    const g = event.gates
    if (
      g?.authenticated !== true ||
      g.motionValidated !== true ||
      g.referenceAvatarReady !== true ||
      g.userAvatarReady !== true
    )
      return unchanged()
    state = {
      ...disarm(state),
      status: 'preparing',
      generation: state.generation + 1,
      lastSequence: -1,
      lastSampledAt: null,
    }
    effects = [{ type: 'request-camera', generation: state.generation }]
  } else if (event.type === 'ready') {
    if (!validNow || state.status !== 'preparing' || event.generation !== state.generation)
      return unchanged()
    state = {
      ...state,
      status: 'running',
      startedAt: state.startedAt ?? event.now,
      readyAt: event.now,
    }
  } else if (state.status !== 'running') {
    return unchanged()
  } else if (event.type === 'target-changed') {
    state = disarm(state)
  } else if (event.type === 'tick') {
    if (
      !validNow ||
      (state.lastObservationAt !== null &&
        event.now - state.lastObservationAt > state.plan.maxFrameGapMs)
    )
      state = disarm(state)
  } else if (event.type === 'frame') {
    const step = state.plan.steps[state.stepIndex]
    if (
      event.generation !== state.generation ||
      event.stepId !== step.id ||
      !Number.isSafeInteger(event.sequence) ||
      event.sequence <= state.lastSequence
    )
      return unchanged()
    if (
      !validNow ||
      !time(event.sampledAt) ||
      state.readyAt === null ||
      event.sampledAt < state.readyAt ||
      event.sampledAt > event.now ||
      event.now - event.sampledAt > state.plan.maxFrameAgeMs ||
      (state.lastSampledAt !== null && event.sampledAt <= state.lastSampledAt)
    ) {
      return { state: freeze(disarm(state)), effects: [] }
    }
    if (
      (state.lastObservationAt !== null &&
        event.now - state.lastObservationAt > state.plan.maxFrameGapMs) ||
      (state.lastSampledAt !== null &&
        event.sampledAt - state.lastSampledAt > state.plan.maxFrameGapMs)
    )
      state = disarm(state)
    state = {
      ...state,
      lastSequence: event.sequence,
      lastSampledAt: event.sampledAt,
      lastObservationAt: event.now,
    }
    if (
      event.personCount !== 1 ||
      !['start', 'target', 'returned', 'moving', 'unmet'].includes(event.classification)
    ) {
      state = disarm(state)
    } else if (event.classification === 'start') {
      state = {
        ...updateProgress(state, {
          attempted: true,
          ...(step.kind === 'repetitions' ? { holdMs: 0 } : {}),
        }),
        phase: 'seeking-target',
        lastTargetAt: null,
      }
    } else if (
      event.classification === 'unmet' ||
      (event.classification === 'moving' && state.phase === 'holding')
    ) {
      state = {
        ...updateProgress(state, step.kind === 'repetitions' ? { holdMs: 0 } : {}),
        phase: state.phase === 'waiting-start' ? 'waiting-start' : 'seeking-target',
        lastTargetAt: null,
      }
    } else if (event.classification === 'target' && state.phase !== 'waiting-start') {
      if (state.phase === 'seeking-target' || state.phase === 'holding') {
        const current = state.progress[state.stepIndex]
        const delta =
          state.phase === 'holding' && state.lastTargetAt !== null
            ? Math.min(step.targetMs - current.holdMs, event.sampledAt - state.lastTargetAt)
            : 0
        const holdMs = current.holdMs + delta
        state = {
          ...updateProgress(state, { holdMs, verifiedMs: current.verifiedMs + delta }),
          phase: holdMs >= step.targetMs ? 'waiting-return' : 'holding',
          lastTargetAt: event.sampledAt,
        }
      }
    } else if (event.classification === 'returned' && state.phase !== 'waiting-start') {
      if (state.phase === 'waiting-return') {
        const current = state.progress[state.stepIndex]
        const repetitions = current.repetitions + (step.kind === 'repetitions' ? 1 : 0)
        const completed = step.kind === 'hold' || repetitions >= step.repetitions
        state = updateProgress(state, {
          repetitions,
          completed,
          ...(step.kind === 'repetitions' ? { holdMs: 0 } : {}),
        })
        if (completed) {
          if (state.stepIndex === state.plan.steps.length - 1) {
            return { state: freeze(finish(state, 'completed')), effects: release(state.generation) }
          }
          state = {
            ...state,
            stepIndex: state.stepIndex + 1,
            phase: 'waiting-start',
            lastObservationAt: null,
            lastTargetAt: null,
          }
        } else state = { ...state, phase: 'seeking-target', lastTargetAt: null }
      } else
        state = {
          ...updateProgress(state, step.kind === 'repetitions' ? { holdMs: 0 } : {}),
          phase: 'seeking-target',
          lastTargetAt: null,
        }
    }
  }
  return { state: freeze(state), effects }
}
