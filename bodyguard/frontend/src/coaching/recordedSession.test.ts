// FR-S-02/04·FR-R-03·FR-U-04: synthetic clock/ports/observations, actual owner/session/codec.
import { afterEach, expect, it, vi } from 'vitest'
import { createRecordedSession } from './recordedSession'
import { captureRecordOwner } from './recordOwner'

afterEach(() => vi.unstubAllGlobals())
const id = '00000000-0000-4000-8000-000000000001'
const utc = '2026-10-05T00:00:00.000Z'
const plan = {
  motionId: 'fixture-not-release',
  version: 'synthetic-algebra-only',
  source: 'direct' as const,
  maxFrameAgeMs: 100,
  maxFrameGapMs: 200,
  steps: [{ id: 'first', kind: 'hold' as const, targetMs: 100 }],
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
async function setup() {
  const authority = { status: 'ready' as const, user: { id, email: 'synthetic@example.com' } }
  let current = authority
  const abort = new AbortController()
  const rows: unknown[] = []
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/me')) return new Response(JSON.stringify(authority.user))
    if (path.endsWith('/csrf')) return new Response(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
    const row = JSON.parse(String(init?.body))
    rows.push(row)
    return new Response(
      JSON.stringify({
        ...row,
        created_at: row.ended_at,
        provenance: 'client-reported',
      }),
      { status: 201 },
    )
  })
  vi.stubGlobal('fetch', fetch)
  const context = await captureRecordOwner({
    authority,
    readAuthority: () => current,
    signal: abort.signal,
  })
  let monotonicMs = 0
  let currentUtc = utc
  const readClockPair = vi.fn(() => ({ monotonicMs, utc: currentUtc }))
  const resources: { dispose: ReturnType<typeof vi.fn> }[] = []
  const acquire = async () => {
    const resource = { dispose: vi.fn() }
    resources.push(resource)
    return resource
  }
  const ports = { camera: vi.fn(acquire), inference: vi.fn(acquire), avatars: vi.fn(acquire) }
  const gates = {
    authenticated: true,
    motionValidated: true,
    referenceAvatarReady: true,
    userAvatarReady: true,
  }
  const onChange = vi.fn()
  return {
    context,
    abort,
    fetch,
    rows,
    resources,
    ports,
    gates,
    readClockPair,
    onChange,
    options: {
      context,
      recordId: id,
      readClockPair,
      ports,
      plan,
      readGates: () => gates,
      onChange,
    },
    at(ms: number, date = new Date(Date.parse(utc) + ms).toISOString()) {
      monotonicMs = ms
      currentUtc = date
    },
    replace() {
      current = { ...authority }
    },
  }
}
type Session = ReturnType<typeof createRecordedSession>
async function frame(
  session: Session,
  h: Awaited<ReturnType<typeof setup>>,
  classification: 'start' | 'target' | 'returned',
  at: number,
) {
  h.at(at)
  await session.observe({
    generation: session.getSnapshot().state.generation,
    sampledAt: at,
    sequence: at,
    personCount: 1,
    stepId: 'first',
    classification,
  })
}
async function complete(session: Session, h: Awaited<ReturnType<typeof setup>>) {
  await frame(session, h, 'start', 1)
  await frame(session, h, 'target', 2)
  await frame(session, h, 'target', 102)
  await frame(session, h, 'returned', 103)
}
it('A01 construction/idle/never-ready termination never samples or posts', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  expect(h.readClockPair).not.toHaveBeenCalled()
  await s.save()
  expect(h.ports.camera).not.toHaveBeenCalled()
  await s.end('user-stop')
  await s.save()
  expect(h.rows).toHaveLength(0)
  expect(s.getSnapshot().state.startedAt).toBeNull()
  await s.dispose()
})
it('A01 pending readiness samples the actual ready pair, not permission request or save time', async () => {
  const h = await setup()
  const held = deferred<Awaited<ReturnType<typeof h.ports.avatars>>>()
  h.ports.avatars.mockImplementationOnce(() => held.promise)
  const s = createRecordedSession(h.options)
  const task = s.start()
  await vi.waitFor(() => expect(h.ports.avatars).toHaveBeenCalled())
  await s.save()
  expect(h.rows).toHaveLength(0)
  h.at(500, '2026-10-05T00:00:01.000Z')
  const late = { dispose: vi.fn() }
  held.resolve(late)
  await task
  expect(s.getSnapshot().state.startedAt).toBe(500)
  h.at(600, '2030-01-01T00:00:00.000Z')
  await s.end('user-stop')
  await s.save()
  expect(h.rows[0]).toMatchObject({
    started_at: '2026-10-05T00:00:01.000Z',
    ended_at: '2026-10-05T00:00:01.100Z',
    outcome: 'interrupted',
  })
  expect(late.dispose).toHaveBeenCalledTimes(1)
  await s.dispose()
})
it('A02 completion uses actual engine summary and exact eight fields; never auto posts', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  await s.start()
  await complete(s, h)
  expect(h.rows).toHaveLength(0)
  await s.save()
  expect(h.rows[0]).toEqual({
    id,
    motion_id: plan.motionId,
    protocol_version: plan.version,
    started_at: utc,
    ended_at: '2026-10-05T00:00:00.103Z',
    outcome: 'completed',
    observed_ms: 100,
    repetitions: 0,
  })
  expect(s.getRecordSnapshot()).toEqual({ status: 'saved', failure: null })
  await s.save()
  await s.retry()
  expect(h.rows).toHaveLength(1)
  expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
  await s.dispose()
})
it('cleanup failure reported by a settled controller cannot save or retry a completed result', async () => {
  const h = await setup(),
    s = createRecordedSession(h.options)
  await s.start()
  h.resources[0].dispose.mockRejectedValue(new Error('Controlled cleanup failure'))
  await complete(s, h)
  expect(s.getSnapshot().failure).toBe('cleanup-error')
  await s.save()
  await s.retry()
  expect(h.rows).toHaveLength(0)
  expect(s.getRecordSnapshot()).toEqual({ status: 'failed', failure: 'cleanup-error' })
  await s.dispose()
})
it('A02 pause/resume and UTC jumps preserve first anchor and verified time', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  await s.start()
  await frame(s, h, 'start', 1)
  await frame(s, h, 'target', 2)
  await frame(s, h, 'target', 42)
  h.at(50)
  await s.pause()
  await s.save()
  expect(h.rows).toHaveLength(0)
  h.at(200, '2026-10-04T00:00:00.000Z')
  await s.resume()
  h.at(300, '2030-01-01T00:00:00.000Z')
  await s.end('user-stop')
  await s.save()
  expect(h.rows[0]).toMatchObject({
    started_at: utc,
    ended_at: '2026-10-05T00:00:00.300Z',
    observed_ms: 40,
    outcome: 'interrupted',
  })
  expect(s.getSnapshot().state.startedAt).toBe(0)
  expect(h.resources).toHaveLength(6)
  expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
  await s.dispose()
})
it('A02 partial skip preserves original engine steps and interrupted record counts', async () => {
  const h = await setup()
  const s = createRecordedSession({
    ...h.options,
    plan: { ...plan, steps: [...plan.steps, { ...plan.steps[0], id: 'second' }] },
  })
  await s.start()
  await complete(s, h)
  h.at(104)
  await s.end('skip')
  await s.save()
  expect(s.getSnapshot().state.result?.outcome).toBe('skipped')
  expect(h.rows[0]).toMatchObject({
    outcome: 'interrupted',
    observed_ms: 100,
    ended_at: '2026-10-05T00:00:00.104Z',
  })
  await s.dispose()
})
it('A02 wholly skipped has zero observed counts and exact elapsed', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  await s.start()
  h.at(10)
  await s.end('skip')
  await s.save()
  expect(h.rows[0]).toMatchObject({
    outcome: 'skipped',
    observed_ms: 0,
    ended_at: '2026-10-05T00:00:00.010Z',
  })
  await s.dispose()
})
it('A03 failed save retries only explicitly with identical captured payload', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  await s.start()
  await complete(s, h)
  const bodies: string[] = []
  h.fetch.mockImplementation(async (_path, init) => {
    bodies.push(String(init?.body))
    if (bodies.length === 1) throw new Error('PRIVATE_RECORDED_CLOCK_COORDINATES')
    const row = JSON.parse(bodies[0])
    return new Response(
      JSON.stringify({ ...row, created_at: row.ended_at, provenance: 'client-reported' }),
      { status: 200 },
    )
  })
  await s.save()
  expect(s.getRecordSnapshot()).toEqual({ status: 'failed', failure: 'network' })
  await s.save()
  expect(bodies).toHaveLength(1)
  await s.retry()
  expect(bodies).toHaveLength(2)
  expect(bodies[0]).toBe(bodies[1])
  expect(s.getRecordSnapshot().status).toBe('saved')
  await s.dispose()
})
it('A03 pending network does not block cleanup; dispose rejects late local success', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  await s.start()
  await complete(s, h)
  const held = deferred<Response>()
  h.fetch.mockReturnValueOnce(held.promise)
  const task = s.save()
  expect(s.getRecordSnapshot().status).toBe('saving')
  expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
  const body = JSON.parse(String(h.fetch.mock.calls[3][1]?.body))
  await s.dispose()
  held.resolve(
    new Response(
      JSON.stringify({ ...body, created_at: body.ended_at, provenance: 'client-reported' }),
      { status: 201 },
    ),
  )
  await task
  await s.retry()
  expect(s.getRecordSnapshot().status).toBe('closed')
  expect(h.fetch).toHaveBeenCalledTimes(4)
})
it('A03 same-account authority replacement closes resources and drops anchor/writer', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  await s.start()
  h.replace()
  await s.syncOwner()
  await s.save()
  await s.resume()
  expect(h.rows).toHaveLength(0)
  expect(s.getSnapshot().state.result?.reason).toBe('session-expired')
  expect(s.getRecordSnapshot()).toEqual({ status: 'closed', failure: 'ownership-error' })
  expect(h.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true)
  await s.dispose()
})
it('A03 abort during readiness cannot capture late anchor or retain resources', async () => {
  const h = await setup()
  const held = deferred<Awaited<ReturnType<typeof h.ports.avatars>>>()
  h.ports.avatars.mockImplementationOnce(() => held.promise)
  const s = createRecordedSession(h.options)
  const task = s.start()
  await vi.waitFor(() => expect(h.ports.avatars).toHaveBeenCalled())
  h.abort.abort()
  const late = { dispose: vi.fn() }
  held.resolve(late)
  await task
  await s.save()
  expect(h.rows).toHaveLength(0)
  expect(s.getSnapshot().state.startedAt).toBeNull()
  expect(s.getSnapshot().state.status).toBe('ended')
  expect(late.dispose).toHaveBeenCalledTimes(1)
  await s.dispose()
})
it.each(['authenticated', 'motionValidated', 'referenceAvatarReady', 'userAvatarReady'] as const)(
  'A01 missing %s never creates a record or resources',
  async (name) => {
    const h = await setup()
    h.gates[name] = false
    const s = createRecordedSession(h.options)
    await s.start()
    await s.save()
    expect(h.ports.camera).not.toHaveBeenCalled()
    expect(h.rows).toHaveLength(0)
    await s.dispose()
  },
)
it.each([
  '2026-02-30T00:00:00.000Z',
  '2026-10-05T24:00:00.000Z',
  '2026-10-05T00:00:00Z',
  '2026-10-05T00:00:00.000+09:00',
])('A03 noncanonical clock %s fails before readiness and no POST', async (date) => {
  const h = await setup()
  h.at(0, date)
  const s = createRecordedSession(h.options)
  await s.start()
  await s.save()
  expect(h.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(0)
  expect(s.getSnapshot().failure).toBe('clock-error')
  await s.dispose()
})
it('A03 clock/accessor exception returns fixed failure without raw provider values', async () => {
  const h = await setup()
  h.readClockPair.mockImplementation(() => {
    throw new Error('PRIVATE_RECORDED_CLOCK_COORDINATES')
  })
  const s = createRecordedSession(h.options)
  await s.start()
  await s.save()
  expect(JSON.stringify(s.getSnapshot())).not.toContain('PRIVATE_RECORDED')
  expect(s.getSnapshot().failure).toBe('clock-error')
  expect(h.rows).toHaveLength(0)
  await s.dispose()
})
it('A03 backwards monotonic time cannot increase elapsed or upgrade clock-error to complete', async () => {
  const h = await setup()
  h.at(100)
  const s = createRecordedSession(h.options)
  await s.start()
  h.at(90)
  await s.tick()
  await s.save()
  expect(s.getSnapshot().failure).toBe('clock-error')
  expect(h.rows[0]).toMatchObject({
    started_at: '2026-10-05T00:00:00.100Z',
    ended_at: '2026-10-05T00:00:00.100Z',
    outcome: 'interrupted',
    observed_ms: 0,
  })
  await s.dispose()
})
it('A03 UUID/config getters are required and fixed; never fallback to generated IDs', async () => {
  const h = await setup()
  expect(() => createRecordedSession({ ...h.options, recordId: 'invalid' })).toThrowError(
    /^Invalid recorded coaching session$/,
  )
  expect(() =>
    createRecordedSession({
      ...h.options,
      get readClockPair(): typeof h.readClockPair {
        throw new Error('PRIVATE_RECORDED_CLOCK_COORDINATES')
      },
    }),
  ).toThrowError(/^Invalid recorded coaching session$/)
  expect(h.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(0)
  h.context.close()
})
it('A03 original observer failure still terminates actual session; no false completion', async () => {
  const h = await setup()
  h.onChange.mockImplementation(() => {
    throw new Error('PRIVATE_RECORDED_CLOCK_COORDINATES')
  })
  const s = createRecordedSession(h.options)
  await s.start()
  await s.save()
  expect(s.getSnapshot().failure).toBe('callback-error')
  expect(h.rows).toHaveLength(0)
  await s.dispose()
})

it('A03 configuration plan/port accessors expose only fixed initialization failure', async () => {
  const h = await setup()
  expect(() =>
    createRecordedSession({
      ...h.options,
      get plan(): typeof plan {
        throw new Error('PRIVATE_RECORDED_CLOCK_COORDINATES')
      },
    }),
  ).toThrowError(/^Invalid recorded coaching session$/)
  expect(h.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(0)
  h.context.close()
})
it('A03 a captured context cannot own two recorded sessions or overwrite the first result', async () => {
  const h = await setup()
  const s = createRecordedSession(h.options)
  expect(() =>
    createRecordedSession({ ...h.options, recordId: '00000000-0000-4000-8000-000000000002' }),
  ).toThrowError(/^Invalid recorded coaching session$/)
  await s.start()
  await complete(s, h)
  await s.save()
  expect(h.rows[0]).toMatchObject({ id, outcome: 'completed' })
  expect(h.ports.camera).toHaveBeenCalledTimes(1)
  await s.dispose()
})
it('A03 repeated dispose awaits the same pending cleanup, not a premature success', async () => {
  const h = await setup()
  const held = deferred<void>()
  const dispose = vi.fn(() => held.promise)
  h.ports.camera.mockResolvedValueOnce({ dispose })
  const s = createRecordedSession(h.options)
  await s.start()
  const first = s.dispose()
  const second = s.dispose()
  let joined = false
  void second.then(() => {
    joined = true
  })
  await Promise.resolve()
  await Promise.resolve()
  expect(joined).toBe(false)
  held.resolve()
  await Promise.all([first, second])
  expect(joined).toBe(true)
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(h.rows).toHaveLength(0)
})

it('A03 previously bound context writer is not reused for a different coaching result', async () => {
  const h = await setup()
  await h.context.createWriter().submit({
    id,
    motion_id: plan.motionId,
    protocol_version: plan.version,
    started_at: utc,
    ended_at: utc,
    outcome: 'interrupted',
    observed_ms: 0,
    repetitions: 0,
  })
  expect(() => createRecordedSession(h.options)).toThrowError(/^Invalid recorded coaching session$/)
  expect(h.ports.camera).not.toHaveBeenCalled()
  expect(h.rows).toHaveLength(1)
  h.context.close()
})

it('A03 API-invalid year zero fails before resource preparation, not only at save', async () => {
  const h = await setup()
  h.at(0, '0000-10-05T00:00:00.000Z')
  const s = createRecordedSession(h.options)
  await s.start()
  expect(h.ports.camera).not.toHaveBeenCalled()
  expect(s.getSnapshot().failure).toBe('clock-error')
  await s.save()
  expect(h.rows).toHaveLength(0)
  await s.dispose()
})
it('A03 a UUID-shaped coercible object is not an explicit string ID', async () => {
  const h = await setup()
  const wrong = { toString: () => id } as unknown as string
  expect(() => createRecordedSession({ ...h.options, recordId: wrong })).toThrowError(
    /^Invalid recorded coaching session$/,
  )
  expect(h.ports.camera).not.toHaveBeenCalled()
  h.context.close()
})
