// FR-S-02/04·FR-R-03: actual session and DTO, generated ports/points and mock HTTP only.
import { afterEach, expect, it, vi } from 'vitest'
import { overheadCriteria, overheadFrame } from '../../e2e/fixtures/overheadCandidate'
import type { CoachingPlan } from '../stretch/progression'
import { createOverheadCandidateFeedback, type OverheadRegions } from './overheadCandidateFeedback'
import { resultRecord, saveResultRecord } from './resultRecord'
import { createCoachingSession } from './session'

const regions: OverheadRegions = {
  left: {
    'overhead-head': 'head',
    'overhead-trunk': 'trunk',
    'overhead-other-arm': 'right-arm',
    'overhead-elbow': 'left-arm',
    'overhead-range': 'left-arm',
  },
  right: {
    'overhead-head': 'head',
    'overhead-trunk': 'trunk',
    'overhead-other-arm': 'left-arm',
    'overhead-elbow': 'right-arm',
    'overhead-range': 'right-arm',
  },
}
async function fixture(validated = true, repetitions = 0) {
  const criteria = overheadCriteria(),
    plan: CoachingPlan = {
      motionId: 'arm-overhead',
      version: criteria.version,
      source: 'direct',
      maxFrameAgeMs: criteria.maxFrameAgeMs,
      maxFrameGapMs: criteria.maxFrameGapMs,
      steps: ['left', 'right'].map((id) =>
        repetitions
          ? { id, kind: 'repetitions', targetMs: 50, repetitions }
          : { id, kind: 'hold', targetMs: 50 },
      ),
    }
  let now = 20,
    sequence = 0
  const gates = {
      authenticated: true,
      motionValidated: validated,
      referenceAvatarReady: true,
      userAvatarReady: true,
    },
    disposals: ReturnType<typeof vi.fn>[] = []
  const acquire = vi.fn(async () => {
    const dispose = vi.fn()
    disposals.push(dispose)
    return { dispose }
  })
  const session = createCoachingSession({
    plan,
    ports: { camera: acquire, inference: acquire, avatars: acquire },
    now: () => now,
    readGates: () => gates,
    onChange() {},
  })
  await session.start()
  const pending: Promise<void>[] = [],
    observe = vi.fn((input: Parameters<typeof session.observe>[0]) => {
      pending.push(session.observe(input))
      return session.getSnapshot()
    })
  const options = { criteria, generation: 1, now: () => now, session, observe, regions }
  const adapter = createOverheadCandidateFeedback(options)
  const send = (
    left: number,
    right: number,
    at: number,
    mutate?: (f: ReturnType<typeof overheadFrame>) => void,
  ) => {
    now = at
    const f = overheadFrame(left, right, ++sequence, at, { generation: 1 })
    mutate?.(f)
    return adapter.evaluate(f)
  }
  return {
    criteria,
    plan,
    gates,
    disposals,
    acquire,
    session,
    observe,
    options,
    adapter,
    send,
    setNow: (value: number) => {
      now = value
    },
    settle: () => Promise.all(pending),
  }
}
afterEach(() => vi.unstubAllGlobals())
it('requires each return for two repetitions on each designated arm', async () => {
  const f = await fixture(true, 2)
  let now = 30
  for (const side of ['left', 'right'])
    for (let i = 0; i < 2; i++) {
      f.send(0, 0, now)
      f.send(side === 'left' ? Math.PI : 0, side === 'right' ? Math.PI : 0, now + 10)
      f.send(side === 'left' ? Math.PI : 0, side === 'right' ? Math.PI : 0, now + 60)
      f.send(0, 0, now + 70)
      now += 80
    }
  await f.settle()
  expect(f.session.getSnapshot().state.result).toMatchObject({
    outcome: 'completed',
    steps: [
      { id: 'left', repetitions: 2 },
      { id: 'right', repetitions: 2 },
    ],
  })
})
it('completes left then right with returns and sends only the existing bounded result contract', async () => {
  const f = await fixture(),
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
  for (const [left, right, at] of [
    [0, 0, 30],
    [Math.PI, 0, 40],
    [Math.PI, 0, 90],
    [0, 0, 100],
    [0, 0, 110],
    [0, Math.PI, 120],
    [0, Math.PI, 170],
    [0, 0, 180],
  ])
    f.send(left, right, at)
  await f.settle()
  expect(f.session.getSnapshot().state.result).toMatchObject({
    outcome: 'completed',
    steps: [
      { id: 'left', outcome: 'completed' },
      { id: 'right', outcome: 'completed' },
    ],
  })
  const row = resultRecord({
    snapshot: f.session.getSnapshot(),
    recordId: '00000000-0000-4000-8000-000000000001',
    startedUtcAt: '2026-10-17T00:00:00.000Z',
  })
  expect(row).toMatchObject({
    motion_id: 'arm-overhead',
    protocol_version: 'math-overhead-v1',
    outcome: 'completed',
    observed_ms: 100,
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
    /landmarks|Elbow|Wrist|errors|generation|classification|scope|regionId/,
  )
  if (!row) throw new Error('Missing generated result')
  await saveResultRecord(row, { csrfProof: 'a'.repeat(64), signal: new AbortController().signal })
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][0]).toBe('/api/v1/records/stretch')
  for (const dispose of f.disposals) expect(dispose).toHaveBeenCalledOnce()
})
it('stops hold accumulation for both raised arms and labels the actual other arm on either step', async () => {
  const f = await fixture()
  f.send(0, 0, 30)
  f.send(Math.PI, 0, 40)
  const d = f.send(Math.PI, Math.PI, 60)
  expect(d?.errors).toContainEqual({
    regionId: 'right-arm',
    severity: 'deviation',
    code: 'overhead-other-arm',
  })
  expect(f.session.getSnapshot().state.progress[0].holdMs).toBe(0)
  for (const [l, r, t] of [
    [0, 0, 70],
    [Math.PI, 0, 80],
    [Math.PI, 0, 130],
    [0, 0, 140],
    [0, 0, 150],
  ])
    f.send(l, r, t)
  const second = f.send(Math.PI, Math.PI, 160)
  expect(second?.errors).toContainEqual({
    regionId: 'left-arm',
    severity: 'deviation',
    code: 'overhead-other-arm',
  })
  f.setNow(170)
  await f.session.end('user-stop')
  await f.settle()
  expect(f.session.getSnapshot().state.result?.outcome).toBe('interrupted')
})
it('does not bypass false gate, revoked authentication, missing hips or an old capture generation', async () => {
  const denied = await fixture(false)
  expect(denied.acquire).not.toHaveBeenCalled()
  expect(denied.send(0, 0, 30)).toBeNull()
  expect(denied.observe).not.toHaveBeenCalled()
  const f = await fixture()
  f.send(0, 0, 30)
  f.send(Math.PI, 0, 40)
  expect(
    f.send(Math.PI, 0, 60, (frame) => {
      frame.result.landmarks[0][23].presence = 0
    })?.errors,
  ).toEqual([])
  expect(f.session.getSnapshot().state.progress[0].holdMs).toBe(0)
  const calls = f.observe.mock.calls.length
  expect(
    f.send(Math.PI, 0, 70, (frame) => {
      frame.generation = 9
    }),
  ).toBeNull()
  expect(f.observe.mock.calls.length).toBe(calls)
  f.gates.authenticated = false
  f.send(0, 0, 80)
  await f.settle()
  expect(f.session.getSnapshot().state.result?.reason).toBe('session-expired')
})
it('requires matching protocol and exactly the current ordered left/right plan', async () => {
  const f = await fixture(),
    frame = overheadFrame(0, 0, 1, 30, { generation: 1 }),
    before = f.session.getSnapshot()
  for (const patch of [
    { motionId: 'neck-side' },
    { version: 'other' },
    { maxFrameAgeMs: 999 },
    { steps: [{ ...f.plan.steps[0], id: 'both' }] },
  ]) {
    const adapter = createOverheadCandidateFeedback({
      ...f.options,
      session: {
        getSnapshot: () => ({
          ...before,
          state: { ...before.state, plan: { ...f.plan, ...patch } as CoachingPlan },
        }),
      },
    })
    expect(adapter.evaluate(frame)).toBeNull()
  }
  expect(f.observe).not.toHaveBeenCalled()
  await f.session.close('user-stop')
})
it('does not publish after clock callback changes or closes the current session', async () => {
  const f = await fixture(),
    frame = overheadFrame(0, 0, 1, 30, { generation: 1 })
  const adapter = createOverheadCandidateFeedback({
    ...f.options,
    now: () => {
      void f.session.end('user-stop')
      return 30
    },
  })
  expect(adapter.evaluate(frame)).toBeNull()
  expect(f.observe).not.toHaveBeenCalled()
  await f.session.close('user-stop')
})
it('rejects Promise-shaped observe returns and suppresses foreign error contents after closing', async () => {
  const f = await fixture(),
    raw = new Error('PRIVATE_OVERHEAD_CALLBACK')
  const adapter = createOverheadCandidateFeedback({
    ...f.options,
    observe: (() => Promise.reject(raw)) as never,
  })
  f.setNow(30)
  expect(() => adapter.evaluate(overheadFrame(0, 0, 1, 30, { generation: 1 }))).toThrow(
    'Invalid overhead candidate feedback',
  )
  expect(adapter.evaluate(overheadFrame(0, 0, 2, 40, { generation: 1 }))).toBeNull()
  await Promise.resolve()
  await f.session.close('user-stop')
})
it('copies side-specific maps and deduplicates a shared region without returning metrics', async () => {
  const f = await fixture(),
    local: OverheadRegions = {
      left: { ...regions.left, 'overhead-head': 'body', 'overhead-trunk': 'body' },
      right: { ...regions.right },
    }
  const adapter = createOverheadCandidateFeedback({ ...f.options, regions: local })
  Object.assign(local.left, { 'overhead-head': 'changed' })
  const frame = overheadFrame(Math.PI, 0, 1, 30, { generation: 1 }),
    p = frame.result.landmarks[0]
  for (const i of [0, 7, 8, 11, 12]) p[i].x += 40 / 640
  f.setNow(30)
  const d = adapter.evaluate(frame)
  expect(d?.errors.filter((e) => e.regionId === 'body')).toHaveLength(1)
  expect(d?.errors.some((e) => e.regionId === 'changed')).toBe(false)
  expect(JSON.stringify(d?.errors)).not.toMatch(/ElbowRad|Wrist|landmarks/)
  await f.session.close('user-stop')
})
it('rejects malformed map contracts and cannot publish through an evaluate reentry', async () => {
  const f = await fixture()
  for (const bad of [
    { left: regions.left },
    { ...regions, extra: regions.left },
    { left: { ...regions.left, 'overhead-head': '<script>' }, right: regions.right },
  ])
    expect(() =>
      createOverheadCandidateFeedback({ ...f.options, regions: bad as OverheadRegions }),
    ).toThrow('Invalid overhead candidate feedback')
  const frame = overheadFrame(0, 0, 1, 30, { generation: 1 })
  let adapter: ReturnType<typeof createOverheadCandidateFeedback>
  adapter = createOverheadCandidateFeedback({
    ...f.options,
    now: () => {
      expect(() => adapter.evaluate(overheadFrame(Math.PI, 0, 2, 31, { generation: 1 }))).toThrow(
        'Invalid overhead candidate feedback',
      )
      return 30
    },
  })
  expect(adapter.evaluate(frame)).toBeNull()
  expect(f.observe).not.toHaveBeenCalled()
  expect(adapter.evaluate(overheadFrame(Math.PI, 0, 3, 40, { generation: 1 }))).toBeNull()
  await f.session.close('user-stop')
})
it.each(['user-stop', 'pause'] as const)(
  'clears feedback if the exact accepted frame is followed by %s before publication',
  async (reason) => {
    const f = await fixture()
    f.setNow(30)
    const adapter = createOverheadCandidateFeedback({
      ...f.options,
      observe(input) {
        void f.session.observe(input)
        if (reason === 'pause') void f.session.pause()
        else void f.session.end('user-stop')
        return f.session.getSnapshot()
      },
    })
    const decision = adapter.evaluate(overheadFrame(Math.PI, Math.PI, 1, 30, { generation: 1 }))
    expect(decision?.state.status).toBe(reason === 'pause' ? 'paused' : 'ended')
    expect(decision?.errors).toEqual([])
    await f.session.close('user-stop')
  },
)
