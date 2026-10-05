// FR-R-03/FR-U-04/NFR-08: synthetic engine algebra, no clinical classification.
import { afterEach, expect, it, vi } from 'vitest'
import type { StretchInput } from '../api/generated'
import {
  advanceCoaching,
  type CoachingEvent,
  type CoachingPlan,
  createCoaching,
} from '../stretch/progression'
import {
  createRecordWriter,
  InvalidResultError,
  resultRecord,
  saveResultRecord,
} from './resultRecord'
import type { SessionSnapshot } from './session'

const id = '00000000-0000-4000-8000-000000000001'
const anchor = '2026-10-05T00:00:00.000Z'
const proof = 'a'.repeat(64)
const gates = {
  authenticated: true,
  motionValidated: true,
  referenceAvatarReady: true,
  userAvatarReady: true,
}
const plan: CoachingPlan = {
  motionId: 'fixture-not-release',
  version: 'synthetic-algebra-only',
  source: 'direct',
  maxFrameAgeMs: 100,
  maxFrameGapMs: 200,
  steps: [{ id: 'hold', kind: 'hold', targetMs: 100 }],
}
function engine(custom = plan) {
  let state = createCoaching(custom)
  const event = (value: CoachingEvent) => {
    state = advanceCoaching(state, value).state
  }
  const snapshot = (): SessionSnapshot => ({
    state,
    closed: state.status === 'ended',
    failure: null,
  })
  const ready = () => {
    event({ type: 'start', now: 10, gates })
    event({ type: 'ready', now: 20, generation: 1 })
  }
  const frame = (classification: 'start' | 'target' | 'returned', now: number, sequence: number) =>
    event({
      type: 'frame',
      now,
      sampledAt: now,
      sequence,
      personCount: 1,
      stepId: state.plan.steps[state.stepIndex].id,
      generation: state.generation,
      classification,
    })
  return { event, snapshot, ready, frame }
}
const encode = (snapshot: SessionSnapshot, startedUtcAt = anchor, recordId = id) =>
  resultRecord({ snapshot, recordId, startedUtcAt })
function completed() {
  const e = engine()
  e.ready()
  e.frame('start', 21, 0)
  e.frame('target', 22, 1)
  e.frame('target', 122, 2)
  e.frame('returned', 123, 3)
  return e.snapshot()
}
const record = (): StretchInput => encode(completed()) as StretchInput
const response = (row = record(), status = 201) =>
  new Response(JSON.stringify({ ...row, created_at: anchor, provenance: 'client-reported' }), {
    status,
  })
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
afterEach(() => vi.unstubAllGlobals())

it('R01 construction, idle, preparing, running, paused and before-ready end never encode or POST', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const e = engine()
  expect(encode(e.snapshot())).toBeNull()
  e.event({ type: 'start', now: 10, gates })
  expect(encode(e.snapshot())).toBeNull()
  e.event({ type: 'end', now: 15, reason: 'page-hidden' })
  expect(encode(e.snapshot())).toBeNull()
  const active = engine()
  active.ready()
  expect(encode(active.snapshot())).toBeNull()
  active.event({ type: 'pause', now: 30 })
  expect(encode(active.snapshot())).toBeNull()
  const owner = {}
  createRecordWriter({ owner, readOwner: () => owner, csrfProof: proof })
  expect(fetcher).not.toHaveBeenCalled()
})
it('R02 actual completed engine creates an immutable exact eight-field UTC summary', () => {
  const row = record()
  expect(row).toEqual({
    id,
    motion_id: plan.motionId,
    protocol_version: plan.version,
    started_at: anchor,
    ended_at: '2026-10-05T00:00:00.103Z',
    outcome: 'completed',
    observed_ms: 100,
    repetitions: 0,
  })
  expect(Object.isFrozen(row)).toBe(true)
})
it('R02 fractional observation is summed then floored; pause/resume preserves first-ready anchor', () => {
  const e = engine()
  e.ready()
  e.frame('start', 21, 0)
  e.frame('target', 22, 1)
  e.frame('target', 62.6, 2)
  e.event({ type: 'pause', now: 63 })
  e.event({ type: 'resume', now: 200, gates })
  e.event({ type: 'ready', now: 210, generation: 2 })
  e.event({ type: 'end', now: 220.9, reason: 'user-stop' })
  expect(encode(e.snapshot())).toMatchObject({
    outcome: 'interrupted',
    observed_ms: 40,
    ended_at: '2026-10-05T00:00:00.200Z',
  })
  expect(encode(e.snapshot(), '2026-10-05T09:00:00+09:00')).toEqual(encode(e.snapshot()))
})
it('R02 whole skipped remains skipped; partly performed skipped becomes interrupted without changing the engine', () => {
  const e = engine({
    ...plan,
    steps: [...plan.steps, { id: 'other', kind: 'hold', targetMs: 100 }],
  })
  e.ready()
  e.frame('start', 21, 0)
  e.frame('target', 22, 1)
  e.frame('target', 122, 2)
  e.frame('returned', 123, 3)
  e.event({ type: 'end', now: 124, reason: 'skip' })
  expect(e.snapshot().state.result).toMatchObject({
    outcome: 'skipped',
    steps: [{ outcome: 'completed' }, { outcome: 'pending' }],
  })
  expect(encode(e.snapshot())).toMatchObject({ outcome: 'interrupted', observed_ms: 100 })
  const skip = engine()
  skip.ready()
  skip.event({ type: 'end', now: 30, reason: 'skip' })
  expect(encode(skip.snapshot())).toMatchObject({
    outcome: 'skipped',
    observed_ms: 0,
    repetitions: 0,
  })
})
it('R02 repetition result preserves count rather than deriving it from time', () => {
  const e = engine({
    ...plan,
    steps: [{ id: 'rep', kind: 'repetitions', targetMs: 0, repetitions: 2 }],
  })
  e.ready()
  e.frame('start', 21, 0)
  e.frame('target', 22, 1)
  e.frame('returned', 23, 2)
  e.frame('target', 24, 3)
  e.frame('returned', 25, 4)
  expect(encode(e.snapshot())).toMatchObject({
    outcome: 'completed',
    observed_ms: 0,
    repetitions: 2,
  })
})
it.each(['bad-id', '2026-02-30T00:00:00Z', '2026-10-05T00:00:00', '0000-01-01T00:00:00Z'])(
  'R03 invalid identity or anchor: %s',
  (value) => {
    expect(() =>
      value === 'bad-id' ? encode(completed(), anchor, value) : encode(completed(), value),
    ).toThrowError(InvalidResultError)
  },
)
it('R03 malformed identity/steps/time/count/completion and accessors are fixed failure', () => {
  const base = completed()
  const result = base.state.result
  if (!result) throw new Error('Synthetic result missing')
  for (const changes of [
    { motionId: 'different' },
    { version: 'different' },
    { source: 'alert' },
    { elapsedMs: -1 },
    { elapsedMs: 103.1 },
    { elapsedMs: 86400001 },
    { steps: [] },
    { steps: [{ ...result.steps[0], verifiedMs: NaN }] },
    { steps: [{ ...result.steps[0], verifiedMs: 104 }] },
    { steps: [{ ...result.steps[0], repetitions: 1 }] },
    { outcome: 'interrupted' },
    { steps: [{ ...result.steps[0], id: 'other' }] },
  ]) {
    expect(() =>
      encode({
        ...base,
        state: { ...base.state, result: { ...result, ...changes } },
      } as SessionSnapshot),
    ).toThrowError(InvalidResultError)
  }
  expect(() => encode({ ...base, closed: false })).toThrowError(InvalidResultError)
  expect(() =>
    encode(
      Object.defineProperty({}, 'state', {
        get() {
          throw new Error('PRIVATE_RESULT_COORDINATES_ACCOUNT')
        },
      }) as SessionSnapshot,
    ),
  ).toThrowError(/^Invalid coaching result$/)
})
it.each([200, 201])(
  'R04 captured proof posts eight fields same-origin/no-store, accepts %s',
  async (status) => {
    const input = {
      ...record(),
      source: 'PRIVATE_RESULT_COORDINATES_ACCOUNT',
      user_id: 'not-a-payload-field',
    }
    const fetcher = vi.fn(async () => response(record(), status))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    await expect(saveResultRecord(input, { csrfProof: proof, signal })).resolves.toMatchObject(
      record(),
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/records/stretch')
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': proof },
    })
    expect(JSON.parse(options.body as string)).toEqual(record())
    expect(JSON.stringify(options.body)).not.toContain('PRIVATE_RESULT')
  },
)
it.each([401, 403, 409, 422, 503])(
  'R04 status %s fixed failure, no fresh CSRF/raw body',
  async (status) => {
    const fetcher = vi.fn(
      async () => new Response('PRIVATE_RESULT_COORDINATES_ACCOUNT', { status }),
    )
    vi.stubGlobal('fetch', fetcher)
    await expect(
      saveResultRecord(record(), { csrfProof: proof, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ status, message: '계정 요청을 완료하지 못했습니다' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  },
)
it('R04 invalid proof/input or already aborted performs no request', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const controller = new AbortController()
  controller.abort()
  await expect(
    saveResultRecord(record(), { csrfProof: proof, signal: controller.signal }),
  ).rejects.toThrow()
  await expect(
    saveResultRecord(record(), { csrfProof: 'bad', signal: new AbortController().signal }),
  ).rejects.toThrow()
  await expect(
    saveResultRecord(
      { ...record(), observed_ms: -1 },
      { csrfProof: proof, signal: new AbortController().signal },
    ),
  ).rejects.toThrow()
  expect(fetcher).not.toHaveBeenCalled()
})
it('R04 foreign/different/malformed response or unexpected success status cannot succeed', async () => {
  for (const row of [
    { ...record(), id: '00000000-0000-4000-8000-000000000002' },
    { ...record(), observed_ms: 99 },
    { ...record(), provenance: 'certified' },
    { ...record(), created_at: 'bad' },
  ]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ created_at: anchor, provenance: 'client-reported', ...row }),
            { status: 201 },
          ),
      ),
    )
    await expect(
      saveResultRecord(record(), { csrfProof: proof, signal: new AbortController().signal }),
    ).rejects.toMatchObject({ status: 503 })
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(record(), 202)),
  )
  await expect(
    saveResultRecord(record(), { csrfProof: proof, signal: new AbortController().signal }),
  ).rejects.toMatchObject({ status: 503 })
})
it('R05 inert constructor, duplicate shares write, conflicting summary cannot replace it', async () => {
  const held = deferred<Response>()
  const fetcher = vi.fn(() => held.promise)
  vi.stubGlobal('fetch', fetcher)
  const owner = {}
  const writer = createRecordWriter({ owner, readOwner: () => owner, csrfProof: proof })
  expect(writer.getSnapshot()).toEqual({ status: 'idle', failure: null })
  expect(fetcher).not.toHaveBeenCalled()
  const first = writer.submit(record())
  const duplicate = writer.submit(record())
  expect(writer.getSnapshot().status).toBe('saving')
  expect(fetcher).toHaveBeenCalledTimes(1)
  await writer.submit({ ...record(), id: '00000000-0000-4000-8000-000000000002' })
  expect(fetcher).toHaveBeenCalledTimes(1)
  held.resolve(response())
  await Promise.all([first, duplicate])
  expect(writer.getSnapshot()).toEqual({ status: 'saved', failure: null })
  await writer.submit(record())
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('R05 network failure has no auto retry; explicit retry keeps exact payload/id/proof', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('PRIVATE_RESULT_COORDINATES_ACCOUNT'))
    .mockResolvedValue(response(record(), 200))
  vi.stubGlobal('fetch', fetcher)
  const owner = {}
  const writer = createRecordWriter({ owner, readOwner: () => owner, csrfProof: proof })
  await writer.submit(record())
  expect(writer.getSnapshot()).toEqual({ status: 'failed', failure: 'network' })
  expect(fetcher).toHaveBeenCalledTimes(1)
  await writer.retry()
  expect(writer.getSnapshot()).toEqual({ status: 'saved', failure: null })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body)
  expect(fetcher.mock.calls[0][1].headers).toEqual(fetcher.mock.calls[1][1].headers)
})
it('R05 changed session lease aborts pending/late success, no retry for a new owner', async () => {
  const held = deferred<Response>()
  const fetcher = vi.fn((_url: string, _options: RequestInit) => held.promise)
  vi.stubGlobal('fetch', fetcher)
  const owner = {}
  let current: object | null = owner
  const writer = createRecordWriter({ owner, readOwner: () => current, csrfProof: proof })
  const pending = writer.submit(record())
  const options = fetcher.mock.calls[0][1] as RequestInit
  current = {}
  writer.syncOwner()
  expect(options.signal?.aborted).toBe(true)
  held.resolve(response())
  await pending
  await writer.retry()
  expect(writer.getSnapshot()).toEqual({ status: 'closed', failure: 'ownership-error' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('R05 disposal/provider failure rejects late data with fixed state', async () => {
  const held = deferred<Response>()
  const fetcher = vi.fn(() => held.promise)
  vi.stubGlobal('fetch', fetcher)
  const owner = {}
  const writer = createRecordWriter({ owner, readOwner: () => owner, csrfProof: proof })
  const pending = writer.submit(record())
  writer.close()
  writer.close()
  held.resolve(response())
  await pending
  await writer.retry()
  expect(writer.getSnapshot()).toEqual({ status: 'closed', failure: null })
  expect(fetcher).toHaveBeenCalledTimes(1)
  const bad = createRecordWriter({
    owner,
    readOwner() {
      throw new Error('PRIVATE_RESULT_COORDINATES_ACCOUNT')
    },
    csrfProof: proof,
  })
  await bad.submit(record())
  expect(bad.getSnapshot()).toEqual({ status: 'closed', failure: 'ownership-error' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('R03 review: impossible clocks and a fraction beyond one day cannot be normalized into validity', () => {
  for (const value of ['2026-10-05T24:00:00Z', '2026-10-05T00:00:00+24:00', '2026-10-05T12:60:00Z'])
    expect(() => encode(completed(), value)).toThrowError(InvalidResultError)
  const e = engine()
  e.ready()
  e.event({ type: 'end', now: 86400020.5, reason: 'user-stop' })
  expect(() => encode(e.snapshot())).toThrowError(InvalidResultError)
})
it('R04 review: context accessor throws fixed failure, not private raw error', async () => {
  const context = {
    signal: new AbortController().signal,
    get csrfProof(): string {
      throw new Error('PRIVATE_RESULT_COORDINATES_ACCOUNT')
    },
  }
  await expect(saveResultRecord(record(), context)).rejects.toThrowError(
    /^Invalid coaching result$/,
  )
})
it('R05 review: constructor accessor throws fixed error without network', () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const owner = {}
  expect(() =>
    createRecordWriter({
      owner,
      readOwner: () => owner,
      get csrfProof(): string {
        throw new Error('PRIVATE_RESULT_COORDINATES_ACCOUNT')
      },
    }),
  ).toThrowError(/^Invalid coaching result$/)
  expect(fetcher).not.toHaveBeenCalled()
})
it('R02 multiple fractional step durations are summed before floor; exact day is accepted', () => {
  const e = engine({
    ...plan,
    steps: [
      { id: 'first', kind: 'hold', targetMs: 0.6 },
      { id: 'second', kind: 'hold', targetMs: 0.6 },
    ],
  })
  e.ready()
  e.frame('start', 21, 0)
  e.frame('target', 22, 1)
  e.frame('target', 23, 2)
  e.frame('returned', 24, 3)
  e.frame('start', 25, 4)
  e.frame('target', 26, 5)
  e.frame('target', 27, 6)
  e.frame('returned', 28, 7)
  expect(encode(e.snapshot())).toMatchObject({ outcome: 'completed', observed_ms: 1 })
  const day = engine()
  day.ready()
  day.event({ type: 'end', now: 86400020, reason: 'user-stop' })
  expect(encode(day.snapshot())?.ended_at).toBe('2026-10-06T00:00:00.000Z')
})
it('R05 failed submit does not retry automatically; changed owner before first submit writes zero', async () => {
  const fetcher = vi.fn(async () => new Response('private-body', { status: 409 }))
  vi.stubGlobal('fetch', fetcher)
  const owner = {}
  let current: object | null = owner
  const writer = createRecordWriter({ owner, readOwner: () => current, csrfProof: proof })
  await writer.submit(record())
  await writer.submit(record())
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(writer.getSnapshot()).toEqual({ status: 'failed', failure: 'conflict' })
  const second = createRecordWriter({ owner, readOwner: () => current, csrfProof: proof })
  current = null
  await second.submit(record())
  await second.retry()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(second.getSnapshot()).toEqual({ status: 'closed', failure: 'ownership-error' })
})
it('R04 abort during response parsing is not late success; bad JSON does not expose parser text', async () => {
  const held = deferred<unknown>()
  const controller = new AbortController()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status: 201, ok: true, json: () => held.promise })),
  )
  const pending = saveResultRecord(record(), { csrfProof: proof, signal: controller.signal })
  await Promise.resolve()
  controller.abort()
  held.resolve({ ...record(), created_at: anchor, provenance: 'client-reported' })
  await expect(pending).rejects.toThrowError(/^Unable to save coaching record$/)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('PRIVATE_RESULT_COORDINATES_ACCOUNT', { status: 201 })),
  )
  await expect(
    saveResultRecord(record(), { csrfProof: proof, signal: new AbortController().signal }),
  ).rejects.toMatchObject({ status: 503 })
})
