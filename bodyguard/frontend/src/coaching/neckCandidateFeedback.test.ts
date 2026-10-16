// FR-S-02/03/04·FR-R-03: generated points → real classifier/engine/result/HTTP contract, not clinical/SQL proof.
import { afterEach, expect, it, vi } from 'vitest'
import { criteria, frame } from '../../e2e/fixtures/neckCandidate'
import {
  advanceCoaching,
  type CoachingEvent,
  type CoachingPlan,
  createCoaching,
} from '../stretch/progression'
import { createNeckCandidateFeedback } from './neckCandidateFeedback'
import { resultRecord, saveResultRecord } from './resultRecord'
import type { SessionSnapshot } from './session'

const regions = {
  'neck-shoulder-line': 'shoulders',
  'neck-head-position': 'neck',
  'neck-wrong-direction': 'neck',
  'neck-range': 'neck',
} as const
function fixture(validated = true) {
  const config = criteria(),
    plan: CoachingPlan = {
      motionId: 'neck-side',
      version: config.version,
      source: 'direct',
      maxFrameAgeMs: config.maxFrameAgeMs,
      maxFrameGapMs: config.maxFrameGapMs,
      steps: [
        { id: 'left', kind: 'hold', targetMs: 50 },
        { id: 'right', kind: 'hold', targetMs: 50 },
      ],
    }
  let state = createCoaching(plan),
    now = 10,
    sequence = 0
  const event = (e: CoachingEvent) => {
    state = advanceCoaching(state, e).state
  }
  const snapshot = (): SessionSnapshot =>
    Object.freeze({ state, closed: state.status === 'ended', failure: null })
  event({
    type: 'start',
    now,
    gates: {
      authenticated: true,
      motionValidated: validated,
      referenceAvatarReady: true,
      userAvatarReady: true,
    },
  })
  now = 20
  event({ type: 'ready', now, generation: 1 })
  const observe = vi.fn(
    (input: Parameters<ReturnType<typeof createNeckCandidateFeedback>['evaluate']>[0]) => input,
  )
  const submitted: unknown[] = []
  const adapter = createNeckCandidateFeedback({
    criteria: config,
    generation: 1,
    now: () => now,
    session: { getSnapshot: snapshot },
    regions,
    observe(input) {
      submitted.push(input)
      event({ ...input, type: 'frame', now })
      return snapshot()
    },
  })
  const send = (angle: number, at: number, options: Parameters<typeof frame>[3] = {}) => {
    now = at
    const value = frame(angle, ++sequence, at, { ...options, generation: 1 })
    observe(value)
    return adapter.evaluate(value)
  }
  return {
    adapter,
    snapshot,
    event,
    submitted,
    send,
    observe,
    setNow: (value: number) => {
      now = value
    },
  }
}
afterEach(() => vi.unstubAllGlobals())
it('drives both sides to completion from points, then encodes/saves only the bounded result DTO', async () => {
  const f = fixture(),
    fetcher = vi.fn(
      async (_url: string, init: RequestInit) =>
        new Response(
          JSON.stringify({
            ...JSON.parse(init.body as string),
            created_at: '2026-10-16T00:00:00.000Z',
            provenance: 'client-reported',
          }),
          { status: 201 },
        ),
    )
  vi.stubGlobal('fetch', fetcher)
  expect(
    resultRecord({
      snapshot: f.snapshot(),
      recordId: '00000000-0000-4000-8000-000000000001',
      startedUtcAt: '2026-10-16T00:00:00.000Z',
    }),
  ).toBeNull()
  for (const [angle, at] of [
    [0, 30],
    [-0.4, 40],
    [-0.4, 90],
    [0, 100],
    [0, 110],
    [0.4, 120],
    [0.4, 170],
    [0, 180],
  ])
    f.send(angle, at)
  expect(f.snapshot().state.result?.outcome).toBe('completed')
  const row = resultRecord({
    snapshot: f.snapshot(),
    recordId: '00000000-0000-4000-8000-000000000001',
    startedUtcAt: '2026-10-16T00:00:00.000Z',
  })
  expect(row).toMatchObject({
    motion_id: 'neck-side',
    protocol_version: 'math-neck-v1',
    outcome: 'completed',
    observed_ms: 100,
    repetitions: 0,
  })
  expect(JSON.stringify(row)).not.toMatch(/landmarks|classification|neck-range|scope|generation/)
  if (!row) throw Error('Missing generated result')
  await saveResultRecord(row, { csrfProof: 'a'.repeat(64), signal: new AbortController().signal })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe('/api/v1/records/stretch')
  expect(f.submitted).toHaveLength(8)
})
it('same-frame compensation produces a bounded feedback code and does not accrue hold time', () => {
  const f = fixture()
  f.send(0, 30)
  f.send(-0.4, 40)
  const failed = f.send(-0.4, 70, { shoulder: 0.2 })
  expect(failed?.errors).toEqual([
    { regionId: 'shoulders', severity: 'deviation', code: 'neck-shoulder-line' },
  ])
  expect(f.snapshot().state.progress[0].holdMs).toBe(0)
  expect(f.snapshot().state.result).toBeNull()
  const snap = f.snapshot().state
  expect(failed?.state).toBe(snap)
  expect(JSON.stringify(failed?.errors)).not.toMatch(/landmarks|AngleRad|Distance/)
})
it('empty input, duplicates and foreign generation cannot complete a half-finished movement', () => {
  const f = fixture()
  f.send(0, 30)
  f.send(-0.4, 40)
  const missing = frame(-0.4, 3, 60, { generation: 1 })
  missing.result.landmarks = []
  f.setNow(60)
  f.adapter.evaluate(missing)
  expect(f.snapshot().state.phase).toBe('waiting-start')
  expect(f.snapshot().state.progress[0].holdMs).toBe(0)
  const count = f.submitted.length
  expect(f.adapter.evaluate(missing)).toBeNull()
  expect(f.adapter.evaluate({ ...frame(0, 4, 70), generation: 7 })).toBeNull()
  expect(f.submitted).toHaveLength(count)
  f.event({ type: 'end', now: 80, reason: 'user-stop' })
  expect(f.snapshot().state.result?.outcome).toBe('interrupted')
})
it('does not grant motion eligibility or resurrect an ended/closed candidate', () => {
  const f = fixture(false)
  expect(f.snapshot().state.status).toBe('idle')
  expect(f.send(0, 30)).toBeNull()
  expect(f.submitted).toHaveLength(0)
  const g = fixture()
  g.adapter.close()
  expect(g.send(0, 30)).toBeNull()
})

it('rejects malformed regions and a changed protocol before forwarding observations', () => {
  const f = fixture(),
    observe = vi.fn(() => f.snapshot())
  const base = {
    criteria: criteria(),
    generation: 1,
    now: () => 30,
    session: { getSnapshot: f.snapshot },
    regions,
    observe,
  }
  for (const candidate of [
    { ...regions, 'neck-shoulder-line': 'neck' },
    { ...regions, 'neck-range': 'bad\nregion' },
    {},
  ])
    expect(() =>
      createNeckCandidateFeedback({ ...base, regions: candidate as typeof regions }),
    ).toThrow('Invalid neck candidate feedback')
  const snapshot = f.snapshot()
  const wrong = createNeckCandidateFeedback({
    ...base,
    session: {
      getSnapshot: () => ({
        ...snapshot,
        state: { ...snapshot.state, plan: { ...snapshot.state.plan, version: 'other-version' } },
      }),
    },
  })
  expect(wrong.evaluate(frame(0, 1, 30, { generation: 1 }))).toBeNull()
  expect(observe).not.toHaveBeenCalled()
})

it('does not publish an old/fabricated snapshot or reentrantly closed adapter', () => {
  const f = fixture(),
    old = f.snapshot(),
    base = {
      criteria: criteria(),
      generation: 1,
      now: () => 30,
      session: { getSnapshot: f.snapshot },
      regions,
    }
  const stale = createNeckCandidateFeedback({ ...base, observe: () => old })
  expect(stale.evaluate(frame(0, 1, 30, { generation: 1 }))).toBeNull()
  let closed: ReturnType<typeof createNeckCandidateFeedback>
  closed = createNeckCandidateFeedback({
    ...base,
    observe() {
      closed.close()
      return f.snapshot()
    },
  })
  expect(closed.evaluate(frame(0, 1, 30, { generation: 1 }))).toBeNull()
  const broken = createNeckCandidateFeedback({
    ...base,
    session: {
      getSnapshot() {
        throw new Error('PRIVATE_SENTINEL')
      },
    },
    observe: () => old,
  })
  expect(() => broken.evaluate(frame(0, 1, 30, { generation: 1 }))).toThrow(
    'Invalid neck candidate feedback',
  )
  expect(broken.evaluate(frame(0, 2, 40, { generation: 1 }))).toBeNull()
})

it('contains an asynchronous foreign observer without leaving an unhandled rejection', async () => {
  const f = fixture()
  const wrong = createNeckCandidateFeedback({
    criteria: criteria(),
    generation: 1,
    now: () => 30,
    session: { getSnapshot: f.snapshot },
    regions,
    observe: (() => Promise.reject(new Error('PRIVATE_SENTINEL'))) as unknown as Parameters<
      typeof createNeckCandidateFeedback
    >[0]['observe'],
  })
  expect(() => wrong.evaluate(frame(0, 1, 30, { generation: 1 }))).toThrow(
    'Invalid neck candidate feedback',
  )
  await Promise.resolve()
  expect(wrong.evaluate(frame(0, 2, 40, { generation: 1 }))).toBeNull()
})
