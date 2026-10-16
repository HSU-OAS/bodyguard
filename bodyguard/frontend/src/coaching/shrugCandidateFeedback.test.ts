// FR-S-02/04·FR-R-03: actual session/engine/result contract, synthetic ports/coordinates/HTTP only.
import { afterEach, expect, it, vi } from 'vitest'
import { shrugCriteria, shrugFrame } from '../../e2e/fixtures/shrugCandidate'
import type { CoachingPlan } from '../stretch/progression'
import { resultRecord, saveResultRecord } from './resultRecord'
import { createCoachingSession } from './session'
import { createShrugCandidateFeedback } from './shrugCandidateFeedback'

const regions = {
  'shrug-head': 'head',
  'shrug-trunk': 'trunk',
  'shrug-arms': 'arms',
  'shrug-asymmetry': 'shoulders',
  'shrug-range': 'shoulders',
} as const
async function fixture(validated = true, repetitions = 0) {
  const criteria = shrugCriteria(),
    plan: CoachingPlan = {
      motionId: 'shoulder-shrug',
      version: criteria.version,
      source: 'direct',
      maxFrameAgeMs: criteria.maxFrameAgeMs,
      maxFrameGapMs: criteria.maxFrameGapMs,
      steps: [
        repetitions
          ? { id: 'both', kind: 'repetitions', targetMs: 50, repetitions }
          : { id: 'both', kind: 'hold', targetMs: 50 },
      ],
    }
  let now = 20,
    sequence = 0
  const gates = {
      authenticated: true,
      motionValidated: validated,
      referenceAvatarReady: true,
      userAvatarReady: true,
    },
    resources: ReturnType<typeof vi.fn>[] = []
  const acquire = vi.fn(async () => {
    const dispose = vi.fn()
    resources.push(dispose)
    return { dispose }
  })
  const session = createCoachingSession({
    plan,
    ports: { camera: acquire, inference: acquire, avatars: acquire },
    now: () => now,
    readGates: () => gates,
    onChange: () => {},
  })
  await session.start()
  const pending: Promise<void>[] = [],
    observe = vi.fn((input: Parameters<typeof session.observe>[0]) => {
      pending.push(session.observe(input))
      return session.getSnapshot()
    })
  const adapter = createShrugCandidateFeedback({
    criteria,
    generation: 1,
    now: () => now,
    session,
    observe,
    regions,
  })
  const send = (rise: number, at: number, mutate?: (f: ReturnType<typeof shrugFrame>) => void) => {
    now = at
    const f = shrugFrame(rise, ++sequence, at, { generation: 1 })
    mutate?.(f)
    return adapter.evaluate(f)
  }
  return {
    session,
    adapter,
    observe,
    send,
    gates,
    resources,
    acquire,
    criteria,
    setNow: (n: number) => {
      now = n
    },
    settle: () => Promise.all(pending),
  }
}
afterEach(() => vi.unstubAllGlobals())
it('real session completes two generated shrug/relax repetitions and emits only the existing bounded summary DTO', async () => {
  const f = await fixture(true, 2),
    fetcher = vi.fn(
      async (_url: string, init: RequestInit) =>
        new Response(
          JSON.stringify({
            ...JSON.parse(init.body as string),
            created_at: '2026-10-17T00:00:00.000Z',
            provenance: 'client-reported',
          }),
          { status: 201 },
        ),
    )
  vi.stubGlobal('fetch', fetcher)
  for (const [rise, at] of [
    [0, 30],
    [40, 40],
    [40, 90],
    [0, 100],
    [0, 110],
    [40, 120],
    [40, 170],
    [0, 180],
  ])
    f.send(rise, at)
  await f.settle()
  expect(f.session.getSnapshot().state.result).toMatchObject({
    outcome: 'completed',
    steps: [{ id: 'both', repetitions: 2, outcome: 'completed' }],
  })
  const row = resultRecord({
    snapshot: f.session.getSnapshot(),
    recordId: '00000000-0000-4000-8000-000000000001',
    startedUtcAt: '2026-10-17T00:00:00.000Z',
  })
  expect(row).toMatchObject({
    motion_id: 'shoulder-shrug',
    protocol_version: 'math-shrug-v1',
    outcome: 'completed',
    repetitions: 2,
  })
  expect(Object.keys(row ?? {}).sort()).toEqual(
    [
      'id',
      'motion_id',
      'protocol_version',
      'started_at',
      'ended_at',
      'outcome',
      'observed_ms',
      'repetitions',
    ].sort(),
  )
  expect(JSON.stringify(row)).not.toMatch(
    /landmarks|Height|Angle|errors|generation|classification|scope/,
  )
  if (!row) throw new Error('Missing generated result')
  await saveResultRecord(row, { csrfProof: 'a'.repeat(64), signal: new AbortController().signal })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe('/api/v1/records/stretch')
  for (const dispose of f.resources) expect(dispose).toHaveBeenCalledTimes(1)
})
it('head-only lowering cannot accrue the existing target hold and interruption keeps a partial result', async () => {
  const f = await fixture()
  f.send(0, 30)
  f.send(40, 40)
  const d = f.send(40, 70, (frame) => {
    for (const i of [0, 7, 8]) frame.result.landmarks[0][i].y += 40 / 480
  })
  expect(d?.errors).toEqual([{ regionId: 'head', severity: 'deviation', code: 'shrug-head' }])
  expect(f.session.getSnapshot().state.progress[0].holdMs).toBe(0)
  expect(f.session.getSnapshot().state.result).toBeNull()
  f.setNow(80)
  await f.session.end('user-stop')
  await f.settle()
  expect(f.session.getSnapshot().state.result).toMatchObject({
    outcome: 'interrupted',
    steps: [{ outcome: 'partial' }],
  })
})
it('missing hips, mixed people and old generation never complete an in-progress target; gate revocation is not bypassed', async () => {
  const f = await fixture()
  f.send(0, 30)
  f.send(40, 40)
  expect(
    f.send(40, 60, (frame) => {
      frame.result.landmarks[0][23].visibility = 0
    })?.errors,
  ).toEqual([])
  expect(f.session.getSnapshot().state.phase).toBe('waiting-start')
  expect(f.session.getSnapshot().state.progress[0].holdMs).toBe(0)
  expect(
    f.send(40, 65, (frame) => {
      frame.result.landmarks.push(frame.result.landmarks[0])
    })?.errors,
  ).toEqual([])
  const n = f.observe.mock.calls.length
  expect(
    f.send(40, 70, (frame) => {
      frame.generation = 99
    }),
  ).toBeNull()
  expect(f.observe.mock.calls.length).toBe(n)
  f.gates.authenticated = false
  f.send(0, 80)
  await f.settle()
  expect(f.session.getSnapshot().state.result?.reason).toBe('session-expired')
  const denied = await fixture(false)
  expect(denied.acquire).not.toHaveBeenCalled()
  expect(denied.send(0, 30)).toBeNull()
  expect(denied.observe).not.toHaveBeenCalled()
})
it('deduplicates a shared error region and never copies raw metrics into feedback', async () => {
  const f = await fixture()
  f.send(0, 30)
  f.setNow(40)
  const shared = createShrugCandidateFeedback({
    criteria: f.criteria,
    generation: 1,
    now: () => 40,
    session: f.session,
    observe: f.observe,
    regions: { ...regions, 'shrug-head': 'upper', 'shrug-trunk': 'upper' },
  })
  const frame = shrugFrame(40, 2, 40, { generation: 1 })
  for (const i of [0, 7, 8]) frame.result.landmarks[0][i].y += 40 / 480
  for (const i of [11, 12, 13, 14, 15, 16]) frame.result.landmarks[0][i].x += 30 / 640
  const d = shared.evaluate(frame)
  expect(d?.errors).toEqual([{ regionId: 'upper', severity: 'deviation', code: 'shrug-head' }])
  expect(Object.isFrozen(d?.errors)).toBe(true)
  expect(JSON.stringify(d?.errors)).not.toMatch(/landmarks|Widths|Angle/)
  await f.session.close('user-stop')
  await f.settle()
})
it('does not forward input when a foreign getter pauses or closes the current session during classification', async () => {
  const f = await fixture()
  f.setNow(30)
  const frame = shrugFrame(0, 1, 30, { generation: 1 })
  expect(
    f.adapter.evaluate({
      ...frame,
      get image() {
        void f.session.pause()
        return frame.image
      },
    }),
  ).toBeNull()
  expect(f.observe).not.toHaveBeenCalled()
  await f.session.close('user-stop')
})
it('rejects mismatched protocol/steps and throws only a fixed error for malformed/async callbacks', async () => {
  const f = await fixture(),
    before = f.session.getSnapshot(),
    base = { criteria: f.criteria, generation: 1, now: () => 30, regions }
  const observe = vi.fn(() => f.session.getSnapshot())
  for (const patch of [
    { version: 'other' },
    { motionId: 'neck-side' },
    { steps: [{ id: 'left', kind: 'hold' as const, targetMs: 50 }] },
    { maxFrameAgeMs: 999 },
  ]) {
    const bad = createShrugCandidateFeedback({
      ...base,
      observe,
      session: {
        getSnapshot: () => ({
          ...before,
          state: { ...before.state, plan: { ...before.state.plan, ...patch } },
        }),
      },
    })
    expect(bad.evaluate(shrugFrame(0, 1, 30, { generation: 1 }))).toBeNull()
  }
  expect(observe).not.toHaveBeenCalled()
  for (const badRegions of [{}, { ...regions, 'shrug-head': 'bad\nregion' }])
    expect(() =>
      createShrugCandidateFeedback({
        ...base,
        observe,
        session: f.session,
        regions: badRegions as typeof regions,
      }),
    ).toThrow('Invalid shrug candidate feedback')
  const asynchronous = createShrugCandidateFeedback({
    ...base,
    session: f.session,
    observe: (() => Promise.reject(new Error('PRIVATE_SHRUG_RAW_SENTINEL'))) as never,
  })
  expect(() => asynchronous.evaluate(shrugFrame(0, 1, 30, { generation: 1 }))).toThrow(
    'Invalid shrug candidate feedback',
  )
  await Promise.resolve()
  const broken = createShrugCandidateFeedback({
    ...base,
    observe,
    session: {
      getSnapshot() {
        throw new Error('PRIVATE_SHRUG_RAW_SENTINEL')
      },
    },
  })
  expect(() => broken.evaluate(shrugFrame(0, 1, 30, { generation: 1 }))).toThrow(
    'Invalid shrug candidate feedback',
  )
  expect(broken.evaluate(shrugFrame(0, 2, 40, { generation: 1 }))).toBeNull()
  await f.session.close('user-stop')
})
