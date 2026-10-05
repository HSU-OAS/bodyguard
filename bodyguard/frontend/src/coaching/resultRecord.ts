// FR-R-03/FR-U-04/NFR-07/08: private ended-result adapter, not proof of posture accuracy.
import { ApiError } from '../api/auth'
import type { StretchInput, StretchOut } from '../api/generated'
import { parseRecord, recordId, timestamp } from '../api/records'
import { createCoaching } from '../stretch/progression'
import type { SessionSnapshot } from './session'

export class InvalidResultError extends Error {
  constructor() {
    super('Invalid coaching result')
  }
}
class SaveError extends Error {
  constructor() {
    super('Unable to save coaching record')
  }
}
const finite = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
const integer = (value: number, maximum: number) =>
  Number.isInteger(value) && value >= 0 && value <= maximum
const utc = (value: unknown) => {
  if (!timestamp(value)) throw new InvalidResultError()
  const [hour, minute, second] = value.slice(11, 19).split(':').map(Number)
  if (hour > 23 || minute > 59 || second > 59) throw new InvalidResultError()
  const normalized = new Date(value).toISOString()
  if (!/^[0-9]{4}-/.test(normalized)) throw new InvalidResultError()
  return normalized
}
function copyInput(value: StretchInput): Readonly<StretchInput> {
  try {
    const row = {
      id: value.id,
      motion_id: value.motion_id,
      protocol_version: value.protocol_version,
      started_at: utc(value.started_at),
      ended_at: utc(value.ended_at),
      outcome: value.outcome,
      observed_ms: value.observed_ms,
      repetitions: value.repetitions,
    }
    const wall = Date.parse(row.ended_at) - Date.parse(row.started_at)
    if (
      typeof row.id !== 'string' ||
      !recordId(row.id) ||
      typeof row.motion_id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(row.motion_id) ||
      typeof row.protocol_version !== 'string' ||
      !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(row.protocol_version) ||
      !['completed', 'interrupted', 'skipped'].includes(row.outcome) ||
      !integer(row.observed_ms, 86400000) ||
      !integer(row.repetitions, 10000) ||
      wall < row.observed_ms ||
      wall > 86400000 ||
      (row.outcome === 'skipped' && (row.observed_ms !== 0 || row.repetitions !== 0))
    )
      throw new InvalidResultError()
    return Object.freeze(row)
  } catch {
    throw new InvalidResultError()
  }
}

/** Caller must capture UUID, UTC anchor at earliest ready and the authenticated session lease.
 * No clock/ID default, synthetic observation, coordinates, account or technical reason in DTO.
 */
export function resultRecord(
  options: Readonly<{ snapshot: SessionSnapshot; recordId: string; startedUtcAt: string }>,
): Readonly<StretchInput> | null {
  try {
    const { state, closed } = options.snapshot
    if (['idle', 'preparing', 'running', 'paused'].includes(state.status)) return null
    if (state.status !== 'ended' || closed !== true || !state.result) throw new InvalidResultError()
    if (state.startedAt === null) return null
    const plan = createCoaching(state.plan).plan
    const result = state.result
    if (
      !finite(state.startedAt) ||
      !finite(state.lastNow) ||
      state.lastNow < state.startedAt ||
      !Number.isSafeInteger(state.generation) ||
      state.generation < 1 ||
      result.motionId !== plan.motionId ||
      result.version !== plan.version ||
      result.source !== plan.source ||
      !finite(result.elapsedMs) ||
      result.elapsedMs > 86400000 ||
      result.elapsedMs !== state.lastNow - state.startedAt ||
      !Array.isArray(result.steps) ||
      result.steps.length !== plan.steps.length ||
      !Array.isArray(state.progress) ||
      state.progress.length !== plan.steps.length
    )
      throw new InvalidResultError()
    let observed = 0
    let repetitions = 0
    let allComplete = true
    let allPending = true
    result.steps.forEach((step, index) => {
      const expected = plan.steps[index]
      const progress = state.progress[index]
      const outcome = progress.completed ? 'completed' : progress.attempted ? 'partial' : 'pending'
      if (
        step.id !== expected.id ||
        step.outcome !== outcome ||
        typeof progress.completed !== 'boolean' ||
        typeof progress.attempted !== 'boolean' ||
        (progress.completed && !progress.attempted) ||
        !finite(progress.holdMs) ||
        progress.holdMs > expected.targetMs ||
        !finite(step.verifiedMs) ||
        step.verifiedMs !== progress.verifiedMs ||
        step.verifiedMs < progress.holdMs ||
        !integer(step.repetitions, expected.kind === 'hold' ? 0 : expected.repetitions) ||
        step.repetitions !== progress.repetitions ||
        (step.outcome === 'pending' && (step.verifiedMs !== 0 || step.repetitions !== 0)) ||
        (step.outcome === 'completed' &&
          expected.kind === 'hold' &&
          progress.holdMs !== expected.targetMs) ||
        (expected.kind === 'repetitions' &&
          progress.completed !== (step.repetitions === expected.repetitions))
      )
        throw new InvalidResultError()
      observed += step.verifiedMs
      repetitions += step.repetitions
      allComplete &&= step.outcome === 'completed'
      allPending &&= step.outcome === 'pending'
    })
    if (
      !finite(observed) ||
      observed > result.elapsedMs ||
      !['completed', 'interrupted', 'skipped'].includes(result.outcome) ||
      (result.outcome === 'completed') !== allComplete ||
      (result.outcome === 'skipped' && result.reason !== 'skip') ||
      (result.outcome === 'completed' && result.reason !== undefined) ||
      !Number.isSafeInteger(state.stepIndex) ||
      state.stepIndex < 0 ||
      state.stepIndex >= plan.steps.length ||
      (allComplete && state.stepIndex !== plan.steps.length - 1)
    )
      throw new InvalidResultError()
    const started = utc(options.startedUtcAt)
    const elapsed = Math.floor(result.elapsedMs)
    return copyInput({
      id: options.recordId,
      motion_id: result.motionId,
      protocol_version: result.version,
      started_at: started,
      ended_at: new Date(Date.parse(started) + elapsed).toISOString(),
      outcome: result.outcome === 'skipped' && !allPending ? 'interrupted' : result.outcome,
      observed_ms: Math.floor(observed),
      repetitions,
    })
  } catch {
    throw new InvalidResultError()
  }
}

const validProof = (value: string) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
function sameInput(left: StretchInput, right: StretchInput): boolean {
  return (Object.keys(left) as (keyof StretchInput)[]).every((key) => left[key] === right[key])
}
/** Explicit existing-session CSRF only: never refresh it under a possibly changed cookie. */
export async function saveResultRecord(
  input: StretchInput,
  context: Readonly<{ csrfProof: string; signal: AbortSignal }>,
): Promise<StretchOut> {
  const row = copyInput(input)
  let csrfProof: string
  let signal: AbortSignal
  try {
    csrfProof = context.csrfProof
    signal = context.signal
    if (!validProof(csrfProof) || !(signal instanceof AbortSignal)) throw new InvalidResultError()
  } catch {
    throw new InvalidResultError()
  }
  if (signal.aborted) throw new SaveError()
  try {
    const response = await fetch('/api/v1/records/stretch', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfProof },
      body: JSON.stringify(row),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    })
    if (signal.aborted) throw new SaveError()
    if (response.status !== 200 && response.status !== 201)
      throw new ApiError(response.ok ? 503 : response.status)
    let result: StretchOut
    try {
      result = parseRecord(await response.json())
      if (!sameInput(row, copyInput(result))) throw new ApiError(503)
    } catch {
      throw new ApiError(503)
    }
    if (signal.aborted) throw new SaveError()
    return result
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new SaveError()
  }
}

type WriterFailure =
  | 'invalid-result'
  | 'network'
  | 'session-expired'
  | 'ownership-error'
  | 'conflict'
  | 'invalid-response'
type WriterSnapshot = Readonly<{
  status: 'idle' | 'saving' | 'saved' | 'failed' | 'closed'
  failure: WriterFailure | null
}>
/** One authenticated session lease, one immutable result, memory only; sync on auth disposal.
 * Session lease identity is NOT a user ID. Server captured-proof binding is the backstop.
 * Abort suppresses local late success, not a rollback of an already accepted server write.
 */
export function createRecordWriter(
  options: Readonly<{ owner: object; readOwner(): object | null; csrfProof: string }>,
) {
  let owner: object
  let readOwner: () => object | null
  let csrfProof: string
  try {
    owner = options.owner
    readOwner = options.readOwner
    csrfProof = options.csrfProof
    if (
      !owner ||
      typeof owner !== 'object' ||
      !validProof(csrfProof) ||
      typeof readOwner !== 'function'
    )
      throw new InvalidResultError()
  } catch {
    throw new InvalidResultError()
  }
  let snapshot: WriterSnapshot = Object.freeze({ status: 'idle', failure: null })
  let bound: Readonly<StretchInput> | null = null
  let controller: AbortController | null = null
  let pending: Promise<void> | null = null
  function close(failure: WriterFailure | null = null) {
    if (snapshot.status === 'closed') return
    controller?.abort()
    bound = null
    csrfProof = ''
    snapshot = Object.freeze({ status: 'closed', failure })
  }
  function syncOwner() {
    if (snapshot.status === 'closed') return false
    try {
      if (readOwner() === owner) return true
    } catch {
      /* Fixed ownership failure. */
    }
    close('ownership-error')
    return false
  }
  function write(): Promise<void> {
    if (!syncOwner() || !bound) return Promise.resolve()
    if (pending) return pending
    if (snapshot.status === 'saved') return Promise.resolve()
    const row = bound
    controller = new AbortController()
    snapshot = Object.freeze({ status: 'saving', failure: null })
    pending = saveResultRecord(row, { csrfProof, signal: controller.signal })
      .then(
        () => {
          if (syncOwner()) snapshot = Object.freeze({ status: 'saved', failure: null })
        },
        (error) => {
          if (!syncOwner()) return
          const failure: WriterFailure =
            error instanceof InvalidResultError
              ? 'invalid-result'
              : error instanceof ApiError
                ? error.status === 401 || error.status === 403
                  ? 'session-expired'
                  : error.status === 409
                    ? 'conflict'
                    : 'invalid-response'
                : 'network'
          snapshot = Object.freeze({ status: 'failed', failure })
        },
      )
      .finally(() => {
        pending = null
      })
    return pending
  }
  function submit(input: StretchInput): Promise<void> {
    if (!syncOwner()) return Promise.resolve()
    let row: Readonly<StretchInput>
    try {
      row = copyInput(input)
    } catch {
      if (!bound) snapshot = Object.freeze({ status: 'failed', failure: 'invalid-result' })
      return Promise.resolve()
    }
    if (bound) {
      if (!sameInput(bound, row)) return Promise.resolve()
      // A second submit after failure is not an automatic retry.
      return pending ?? Promise.resolve()
    }
    bound = row
    return write()
  }
  return Object.freeze({
    getSnapshot: (): WriterSnapshot => snapshot,
    submit,
    retry: write,
    syncOwner,
    close: () => close(),
  })
}
