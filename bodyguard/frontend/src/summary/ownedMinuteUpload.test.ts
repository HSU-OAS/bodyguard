// FR-R-01/06, FR-U-04: synthetic intervals/fetch only, not clinical measurements.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReadyAccount } from '../auth'
import { prepareOwnedMinuteUpload } from './ownedMinuteUpload'

const initial: ReadyAccount = {
  status: 'ready',
  user: { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' },
}
const aggregation = () => ({
  clock: { monotonicMs: 0, utc: '2026-10-01T12:00:00.000Z' },
  clientVersion: 'Fixture+V1',
  baselineId: null,
  maxIntervalMs: 60000,
  maxBufferedMinutes: 4,
  definitions: Object.fromEntries(
    ['neck', 'shoulder', 'trunk'].map((name) => [
      name,
      {
        method: `fixture-${name}`,
        unit: 'deg',
        minDeviation: -180,
        maxDeviation: 180,
      },
    ]),
  ) as Record<
    'neck' | 'shoulder' | 'trunk',
    {
      method: string
      unit: string
      minDeviation: number
      maxDeviation: number
    }
  >,
})
const interval = (startMs = 0, endMs = 60000) => ({
  startMs,
  endMs,
  present: true,
  background: false,
  neck: null,
  trunk: null,
  shoulder: { deviation: 1.25, bad: true },
})
function ack(init: RequestInit) {
  return {
    items: JSON.parse(String(init.body)).items.map((row: object) => ({
      ...row,
      created_at: '2026-10-01T12:05:00Z',
      provenance: 'client-reported',
    })),
    has_more: false,
  }
}
async function setup(
  handler: (init: RequestInit) => Promise<Response> = async (init) =>
    Response.json(ack(init), { status: 201 }),
  bounds = { maxQueuedMinutes: 4, maxBatchMinutes: 2 },
) {
  let owner: ReadyAccount | null = initial
  const controller = new AbortController()
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url === '/api/v1/me') return Response.json(initial.user)
    if (url === '/api/v1/auth/csrf') return Response.json({ csrf_token: 'a'.repeat(64) })
    if (url === '/api/v1/summaries/batch') return handler(init)
    throw new Error('Unexpected fixture URL')
  })
  vi.stubGlobal('fetch', fetcher)
  const upload = await prepareOwnedMinuteUpload({
    authority: initial,
    readAuthority: () => owner,
    signal: controller.signal,
    aggregation: aggregation(),
    ...bounds,
  })
  return {
    upload,
    fetcher,
    controller,
    replace: () => {
      owner = { ...initial, user: { ...initial.user } }
    },
    posts: () => fetcher.mock.calls.filter(([url]) => url === '/api/v1/summaries/batch'),
  }
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('owned minute upload', () => {
  it('MU01 complete observed minutes only; null denominators and original proof', async () => {
    const h = await setup()
    await h.upload.upload()
    h.upload.push(interval(0, 30000))
    h.upload.flush(30000)
    await h.upload.upload()
    expect(h.posts()).toHaveLength(0)
    h.upload.push({ ...interval(30000, 60000), shoulder: null })
    h.upload.flush(60000)
    await h.upload.upload()
    expect(h.posts()).toHaveLength(1)
    const init = h.posts()[0]?.[1] as RequestInit
    expect(init.headers).toMatchObject({
      'X-CSRF-Token': 'a'.repeat(64),
      'X-Account-ID': initial.user.id,
    })
    const row = JSON.parse(String(init.body)).items[0]
    expect(row).toMatchObject({
      minute_start: '2026-10-01T12:00:00.000Z',
      baseline_id: null,
      coverage_sec: 60,
      measured_sec: 30,
      unmeasurable_sec: 30,
      present_sec: 60,
      background_sec: 0,
      any_bad_sec: 30,
      neck: { dev_mean: null, measured_sec: 0 },
      shoulder: { dev_mean: 1.25, measured_sec: 30, bad_sec: 30 },
    })
    expect(h.upload.getSnapshot()).toEqual({
      status: 'ready',
      queuedMinutes: 0,
      bufferedMinutes: 0,
    })
  })
  it('MU02 single flight; accepted batch does not erase newly completed minutes', async () => {
    let finish: ((response: Response) => void) | undefined
    let sent: RequestInit | undefined
    const h = await setup((init) => {
      sent = init
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    h.upload.push(interval())
    h.upload.flush(60000)
    const pending = h.upload.upload()
    await h.upload.upload()
    await h.upload.retry()
    h.upload.push(interval(60000, 120000))
    h.upload.flush(120000)
    expect(h.posts()).toHaveLength(1)
    finish?.(Response.json(ack(sent as RequestInit), { status: 201 }))
    await pending
    expect(h.upload.getSnapshot().queuedMinutes).toBe(1)
  })
  it('MU03 uncertain transmission requires exact explicit retry, no refreshed CSRF', async () => {
    let count = 0
    const h = await setup(async (init) => {
      if (count++ === 0) throw new Error('PRIVATE_RAW_FAILURE')
      return Response.json(ack(init), { status: 200 })
    })
    h.upload.push(interval())
    h.upload.flush(60000)
    await h.upload.upload()
    expect(h.upload.getSnapshot()).toMatchObject({ status: 'uncertain', queuedMinutes: 1 })
    await h.upload.upload()
    h.upload.push(interval(60000, 120000))
    h.upload.flush(120000)
    await h.upload.retry()
    expect(h.posts()).toHaveLength(2)
    expect(h.posts()[1]?.[1].body).toBe(h.posts()[0]?.[1].body)
    expect(h.posts()[1]?.[1].headers).toEqual(h.posts()[0]?.[1].headers)
    expect(h.fetcher.mock.calls.filter(([url]) => url === '/api/v1/auth/csrf')).toHaveLength(1)
    expect(h.upload.getSnapshot()).toMatchObject({ status: 'ready', queuedMinutes: 1 })
  })
  it.each(['partial', 'different', 'extra', 'more', 'duplicate'])(
    'MU04 malformed ack %s keeps original batch',
    async (kind) => {
      const h = await setup(async (init) => {
        const value = ack(init)
        if (kind === 'partial') value.items = []
        if (kind === 'different') value.items[0].shoulder.dev_mean = 2
        if (kind === 'extra') value.items[0].coordinates = []
        if (kind === 'more') value.has_more = true
        if (kind === 'duplicate') value.items.push(value.items[0])
        return Response.json(value, { status: 201 })
      })
      h.upload.push(interval())
      h.upload.flush(60000)
      await h.upload.upload()
      expect(h.upload.getSnapshot()).toMatchObject({ status: 'uncertain', queuedMinutes: 1 })
    },
  )
  it.each([401, 403])('MU05 %i clears account-owned memory', async (status) => {
    const h = await setup(async () => Response.json({}, { status }))
    h.upload.push(interval())
    h.upload.flush(60000)
    await h.upload.upload()
    await h.upload.retry()
    expect(h.upload.getSnapshot()).toEqual({
      status: 'closed',
      queuedMinutes: 0,
      bufferedMinutes: 0,
    })
    expect(h.posts()).toHaveLength(1)
  })
  it.each([409, 422])('MU06 %i is terminal rejection, no retry', async (status) => {
    const h = await setup(async () => Response.json({}, { status }))
    h.upload.push(interval())
    h.upload.flush(60000)
    await h.upload.upload()
    await h.upload.retry()
    expect(h.upload.getSnapshot()).toMatchObject({ status: 'rejected', queuedMinutes: 1 })
    expect(h.posts()).toHaveLength(1)
  })
  it('MU07 even same-ID replacement ready authority discards pending data', async () => {
    const h = await setup()
    h.upload.push(interval())
    h.upload.flush(60000)
    h.replace()
    h.upload.syncOwner()
    await h.upload.upload()
    expect(h.upload.getSnapshot().status).toBe('closed')
    expect(h.posts()).toHaveLength(0)
  })
  it('MU08 abort beats a late accepted fetch even if it ignores cancellation', async () => {
    let finish: ((response: Response) => void) | undefined
    let sent: RequestInit | undefined
    const h = await setup((init) => {
      sent = init
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    h.upload.push(interval())
    h.upload.flush(60000)
    const pending = h.upload.upload()
    h.controller.abort()
    finish?.(Response.json(ack(sent as RequestInit), { status: 201 }))
    await pending
    expect(h.upload.getSnapshot()).toEqual({
      status: 'closed',
      queuedMinutes: 0,
      bufferedMinutes: 0,
    })
  })
  it('MU09 bounded memory overflow closes without partial transmission', async () => {
    const h = await setup(undefined, { maxQueuedMinutes: 1, maxBatchMinutes: 1 })
    h.upload.push(interval())
    h.upload.push(interval(60000, 120000))
    expect(() => h.upload.flush(120000)).toThrow('Invalid owned minute upload')
    expect(h.upload.getSnapshot().status).toBe('closed')
    expect(h.posts()).toHaveLength(0)
  })
  it('MU10 pre-calibration neck input is rejected, not silently rewritten', async () => {
    const h = await setup()
    h.upload.push({ ...interval(), neck: { deviation: 2, bad: false } })
    expect(() => h.upload.flush(60000)).toThrow('Invalid owned minute upload')
    expect(h.posts()).toHaveLength(0)
  })
  it('MU11 timed-out request cannot accept a late mock response', async () => {
    let finish: ((response: Response) => void) | undefined
    let sent: RequestInit | undefined
    const h = await setup((init) => {
      sent = init
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    h.upload.push(interval())
    h.upload.flush(60000)
    const pending = h.upload.upload()
    timeout.abort()
    finish?.(Response.json(ack(sent as RequestInit), { status: 201 }))
    await pending
    expect(h.upload.getSnapshot()).toMatchObject({ status: 'uncertain', queuedMinutes: 1 })
  })
  it('MU12 real batch contract accepts 60 ascending minutes, not the 20-row list rule', async () => {
    const h = await setup(undefined, { maxQueuedMinutes: 60, maxBatchMinutes: 60 })
    for (let index = 0; index < 60; index++) {
      h.upload.push(interval(index * 60000, (index + 1) * 60000))
      h.upload.flush((index + 1) * 60000)
    }
    await h.upload.upload()
    expect(JSON.parse(String(h.posts()[0]?.[1].body)).items).toHaveLength(60)
    expect(h.upload.getSnapshot()).toMatchObject({ status: 'ready', queuedMinutes: 0 })
  })
  it.each([202, 204, 400, 500, 503])(
    'MU13 unaccepted status %i is uncertain, no automatic resend',
    async (status) => {
      const h = await setup(async () => new Response(null, { status }))
      h.upload.push(interval())
      h.upload.flush(60000)
      await h.upload.upload()
      await h.upload.upload()
      expect(h.upload.getSnapshot()).toMatchObject({ status: 'uncertain', queuedMinutes: 1 })
      expect(h.posts()).toHaveLength(1)
    },
  )
  it('MU14 malformed observation closes with a fixed non-sensitive failure', async () => {
    const h = await setup()
    expect(() =>
      h.upload.push({ ...interval(), coordinates: [123] } as unknown as ReturnType<
        typeof interval
      >),
    ).toThrow('Invalid owned minute upload')
    expect(h.upload.getSnapshot().status).toBe('closed')
    expect(h.posts()).toHaveLength(0)
  })
  it('MU15 timeout while parsing a late body keeps the original batch', async () => {
    let finish: ((value: ReturnType<typeof ack>) => void) | undefined
    let sent: RequestInit | undefined
    const h = await setup(async (init) => {
      sent = init
      const response = Response.json(ack(init), { status: 201 })
      vi.spyOn(response, 'json').mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      return response
    })
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    h.upload.push(interval())
    h.upload.flush(60000)
    const pending = h.upload.upload()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    timeout.abort()
    finish?.(ack(sent as RequestInit))
    await pending
    expect(h.upload.getSnapshot()).toMatchObject({ status: 'uncertain', queuedMinutes: 1 })
  })
  it.each([
    [0, 1],
    [4, 0],
    [4, 5],
    [61, 1],
  ])('MU16 invalid bounds %i/%i never capture proof', async (maxQueuedMinutes, maxBatchMinutes) => {
    await expect(setup(undefined, { maxQueuedMinutes, maxBatchMinutes })).rejects.toThrow(
      'Invalid owned minute upload',
    )
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})
