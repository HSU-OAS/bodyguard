// @vitest-environment happy-dom
// Synthetic ports/classification/clock/account; real AuthProvider/session/writer assembly.
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../auth'
import type { PlaybackInput, RecordedPlayback } from './useRecordedPlayback'
import { useRecordedPlayback } from './useRecordedPlayback'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const id = '00000000-0000-4000-8000-000000000002'
const user = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
type Control = ReturnType<typeof useRecordedPlayback>
type Actor = RecordedPlayback & {
  input: PlaybackInput
  resources: { dispose: ReturnType<typeof vi.fn> }[]
  acquire: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn<RecordedPlayback['start']>>
  synchronize: ReturnType<typeof vi.fn<RecordedPlayback['synchronize']>>
  close: ReturnType<typeof vi.fn<RecordedPlayback['close']>>
}
function setup(guest = false) {
  let now = 0,
    validated = true
  let control!: Control, auth!: ReturnType<typeof useAuth>
  const rows: unknown[] = [],
    actors: Actor[] = []
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path.endsWith('/me')) return response(guest ? {} : user, guest ? 401 : 200)
    if (path.endsWith('/csrf')) return response({ csrf_token: 'a'.repeat(64) })
    if (path.endsWith('/logout')) return new Response(null, { status: 204 })
    const row = JSON.parse(String(init?.body))
    rows.push(row)
    return response({ ...row, created_at: row.ended_at, provenance: 'client-reported' }, 201)
  })
  vi.stubGlobal('fetch', fetch)
  function actor(input: PlaybackInput): Actor {
    const resources: { dispose: ReturnType<typeof vi.fn> }[] = []
    const acquire = vi.fn(async () => {
      const r = { dispose: vi.fn() }
      resources.push(r)
      return r
    })
    const value: Actor = {
      input,
      resources,
      acquire,
      ports: { camera: acquire, inference: acquire, avatars: acquire },
      start: vi.fn(() => true),
      synchronize: vi.fn(() => true),
      close: vi.fn(),
    }
    actors.push(value)
    return value
  }
  const options: Parameters<Control['prepare']>[0] = {
    recordId: id,
    plan: {
      motionId: 'fixture-not-release',
      version: 'synthetic-algebra-only',
      source: 'direct',
      maxFrameAgeMs: 100,
      maxFrameGapMs: 200,
      steps: [{ id: 'first', kind: 'hold', targetMs: 100 }],
    },
    readClockPair: () => ({
      monotonicMs: now,
      utc: new Date(Date.parse('2026-10-11T00:00:00.000Z') + now).toISOString(),
    }),
    readGates: () => ({
      authenticated: true,
      motionValidated: validated,
      referenceAvatarReady: true,
      userAvatarReady: true,
    }),
    onChange: vi.fn(),
    createPlayback: vi.fn(actor),
  }
  function View() {
    control = useRecordedPlayback()
    auth = useAuth()
    return null
  }
  const view = render(
    <AuthProvider>
      <View />
    </AuthProvider>,
  )
  return {
    options,
    actors,
    rows,
    fetch,
    view,
    get control() {
      return control
    },
    get auth() {
      return auth
    },
    at(ms: number) {
      now = ms
    },
    invalidate() {
      validated = false
    },
    async ready() {
      await waitFor(() => expect(auth.state.status).toBe(guest ? 'guest' : 'ready'))
    },
  }
}
async function prepare(h: ReturnType<typeof setup>) {
  let session: Awaited<ReturnType<Control['prepare']>> = null
  await act(async () => {
    session = await h.control.prepare(h.options)
  })
  if (!session) throw new Error('Missing synthetic session')
  return session as NonNullable<Awaited<ReturnType<Control['prepare']>>>
}
function frame(
  h: ReturnType<typeof setup>,
  session: Awaited<ReturnType<typeof prepare>>,
  sequence: number,
  classification: 'start' | 'target' | 'returned' | 'unobservable',
  ms: number,
  overrides = {},
) {
  h.at(ms)
  return h.actors.at(-1)?.input.observe({
    generation: session.getSnapshot().state.generation,
    sampledAt: ms,
    sequence,
    personCount: 1,
    stepId: 'first',
    classification,
    ...overrides,
  })
}
it('mount, guest and prepare are inert; false motion gate acquires no resource or playback', async () => {
  const guest = setup(true)
  await guest.ready()
  await act(async () => {
    expect(await guest.control.prepare(guest.options)).toBeNull()
  })
  expect(guest.options.createPlayback).not.toHaveBeenCalled()
  guest.view.unmount()
  const h = setup()
  await h.ready()
  expect(h.options.createPlayback).not.toHaveBeenCalled()
  const session = await prepare(h)
  const a = h.actors[0]
  expect(a.acquire).not.toHaveBeenCalled()
  expect(a.start).not.toHaveBeenCalled()
  h.invalidate()
  await session.start()
  expect(a.acquire).not.toHaveBeenCalled()
  expect(a.start).not.toHaveBeenCalled()
  expect(h.rows).toEqual([])
})
it('one start per running generation, original engine snapshots, explicit normal algebra result/save', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  await s.start()
  expect(a.start).toHaveBeenCalledTimes(1)
  frame(h, s, 0, 'start', 1)
  frame(h, s, 1, 'target', 2)
  const last = frame(h, s, 2, 'target', 102)
  expect(last?.state).toBe(s.getSnapshot().state)
  expect(last?.state.lastSampledAt).toBe(102)
  expect(last?.state.lastSequence).toBe(2)
  expect(a.start).toHaveBeenCalledTimes(1)
  frame(h, s, 3, 'returned', 103)
  expect(s.getSnapshot().state.status).toBe('ended')
  expect(h.rows).toEqual([])
  await s.save()
  expect(h.rows[0]).toMatchObject({ id, outcome: 'completed', observed_ms: 100 })
  expect(a.synchronize).toHaveBeenLastCalledWith(s.getSnapshot().state)
  await act(async () => {
    await h.control.cancel()
  })
  expect(a.close).toHaveBeenCalledTimes(1)
})
it('pause/resume starts only the new generation; old frame and failure cannot affect it', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  await s.start()
  const old = s.getSnapshot().state.generation
  await s.pause()
  h.at(10)
  await s.resume()
  const generation = s.getSnapshot().state.generation
  expect(generation).toBeGreaterThan(old)
  expect(a.start.mock.calls).toEqual([[old], [generation]])
  const before = s.getSnapshot().state
  frame(h, s, 0, 'target', 10, { generation: old })
  a.input.onFailure({ type: 'error', generation: old, reason: 'inference-error' })
  expect(s.getSnapshot().state).toBe(before)
  a.input.onFailure({ type: 'error', generation, reason: 'inference-error' })
  expect(s.getSnapshot().failure).toBeNull()
  expect(s.getSnapshot().state.result?.reason).toBe('inference-error')
})
it('unobserved/multiple/stale inputs get no credit; ticks revoke held target without new input', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  await s.start()
  frame(h, s, 0, 'unobservable', 1)
  frame(h, s, 1, 'target', 2, { personCount: 2 })
  frame(h, s, 2, 'target', 103, { sampledAt: 0 })
  expect(s.getSnapshot().state.progress[0].verifiedMs).toBe(0)
  frame(h, s, 3, 'start', 104)
  frame(h, s, 4, 'target', 105)
  h.at(306)
  const snapshot = a.input.tick()
  expect(snapshot?.state).toBe(s.getSnapshot().state)
  expect(snapshot?.state.progress[0].verifiedMs).toBe(0)
  expect(snapshot?.state.phase).toBe('waiting-start')
  await s.end('user-stop')
  await s.save()
  expect(h.rows[0]).toMatchObject({ outcome: 'interrupted', observed_ms: 0 })
})
it('account refresh, replacement preparation and cancellation reject retained callbacks/save', async () => {
  const h = setup()
  await h.ready()
  const first = await prepare(h)
  const old = h.actors[0]
  await first.start()
  await act(async () => {
    await h.auth.refresh()
  })
  expect(old.input.tick()).toBeNull()
  await first.save()
  expect(h.rows).toEqual([])
  expect(old.close).toHaveBeenCalledTimes(1)
  const second = await prepare(h)
  await second.start()
  old.input.onFailure({
    type: 'error',
    generation: second.getSnapshot().state.generation,
    reason: 'asset-error',
  })
  expect(second.getSnapshot().state.status).toBe('running')
  await act(async () => {
    await h.control.cancel()
  })
  expect(h.actors[1].input.tick()).toBeNull()
  expect(h.actors[1].close).toHaveBeenCalledTimes(1)
})
it('playback refuses start or callback throws: fixed terminal reason, no continuing observations', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  a.start.mockReturnValue(false)
  await s.start()
  expect(s.getSnapshot().state.result?.reason).toBe('ownership-error')
  expect(a.acquire.mock.calls).toHaveLength(3)
  expect(h.rows).toEqual([])
  await act(async () => {
    await h.control.cancel()
  })
  const next = await prepare(h)
  h.actors[1].synchronize.mockImplementation(() => {
    throw new Error('private native error')
  })
  await next.start()
  expect(next.getSnapshot().failure).toBe('callback-error')
})
it('failed owned cleanup quarantines another preparation rather than restarting resources', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  await s.start()
  a.close.mockImplementation(() => {
    throw new Error('private cleanup error')
  })
  await act(async () => {
    await expect(h.control.cancel()).rejects.toThrow('Resource cleanup failed')
  })
  expect(h.control.state).toEqual({ status: 'failed', failure: 'cleanup-error' })
  await act(async () => {
    expect(await h.control.prepare(h.options)).toBeNull()
  })
  expect(h.actors).toHaveLength(1)
  expect(a.acquire).toHaveBeenCalledTimes(3)
  expect(h.rows).toEqual([])
})
it('replacement creates a fresh owner; retained old callbacks cannot change or save it', async () => {
  const h = setup()
  await h.ready()
  const old = await prepare(h)
  const a = h.actors[0]
  await old.start()
  const next = await prepare(h)
  expect(a.close).toHaveBeenCalledTimes(1)
  expect(a.input.tick()).toBeNull()
  await next.start()
  await old.save()
  expect(h.rows).toEqual([])
  expect(h.actors[1].start).toHaveBeenCalledTimes(1)
  a.input.onFailure({
    type: 'error',
    generation: next.getSnapshot().state.generation,
    reason: 'asset-error',
  })
  expect(next.getSnapshot().state.status).toBe('running')
})
it('cannot reuse the same native owner with a fresh session or close it twice', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  await s.start()
  vi.mocked(h.options.createPlayback).mockImplementation(() => a)
  await act(async () => {
    expect(await h.control.prepare(h.options)).toBeNull()
  })
  expect(a.close).toHaveBeenCalledTimes(1)
  expect(a.input.tick()).toBeNull()
  expect(a.start).toHaveBeenCalledTimes(1)
  expect(h.control.getSession()).toBeNull()
})
it('logout and unmount reclaim owner; late inputs and explicit save remain inert', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  await s.start()
  await act(async () => {
    await h.auth.signOut()
  })
  expect(a.input.tick()).toBeNull()
  await s.save()
  expect(h.rows).toEqual([])
  expect(a.close).toHaveBeenCalledTimes(1)
  h.view.unmount()
  await waitFor(() =>
    expect(a.resources.every((r) => r.dispose.mock.calls.length === 1)).toBe(true),
  )
})
it('reentrant factory cancellation prevents auth capture and reclaims only the inert candidate', async () => {
  const h = setup()
  await h.ready()
  const factory = vi.mocked(h.options.createPlayback).getMockImplementation()
  if (!factory) throw new Error('Missing synthetic factory')
  vi.mocked(h.options.createPlayback).mockImplementation((input) => {
    const a = factory(input)
    void h.control.cancel()
    return a
  })
  await act(async () => {
    expect(await h.control.prepare(h.options)).toBeNull()
  })
  expect(h.fetch).toHaveBeenCalledTimes(1)
  expect(h.actors[0].close).toHaveBeenCalledTimes(1)
  expect(h.actors[0].acquire).not.toHaveBeenCalled()
})
it('failure reentry during playback start never republishes the older running snapshot', async () => {
  const h = setup()
  await h.ready()
  const s = await prepare(h)
  const a = h.actors[0]
  a.start.mockImplementation((generation) => {
    a.input.onFailure({ type: 'error', generation, reason: 'inference-error' })
    return true
  })
  await s.start()
  expect(s.getSnapshot().state.status).toBe('ended')
  expect(vi.mocked(h.options.onChange).mock.calls.at(-1)?.[0].state.status).toBe('ended')
})
it('unclaimed invalid preparation cleanup is fixed and quarantined, without leaving previous session live', async () => {
  const h = setup()
  await h.ready()
  const old = await prepare(h)
  await old.start()
  const factory = vi.mocked(h.options.createPlayback).getMockImplementation()
  if (!factory) throw new Error('Missing synthetic factory')
  vi.mocked(h.options.createPlayback).mockImplementation((input) => {
    const a = factory(input)
    vi.mocked(a.close).mockImplementation(() => {
      throw new Error('private failed candidate')
    })
    return a
  })
  await act(async () => {
    await expect(h.control.prepare({ ...h.options, recordId: 'invalid' })).rejects.toThrow(
      'Resource cleanup failed',
    )
  })
  expect(h.actors[0].close).toHaveBeenCalledTimes(1)
  expect(h.control.getSession()).toBeNull()
  expect(h.control.state).toEqual({ status: 'failed', failure: 'cleanup-error' })
  await act(async () => {
    expect(await h.control.prepare(h.options)).toBeNull()
  })
  expect(h.actors).toHaveLength(2)
})
