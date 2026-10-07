// FR-R-01/06, FR-U-04: private/test only; explicit memory-bound upload, never raw history.
import { ApiError, request } from '../api/auth'
import type { MinuteInput } from '../api/generated'
import { parseMinute, parseMinuteInput } from '../api/minuteSummaries'
import type { ReadyAccount } from '../auth'
import { createMinuteAggregation } from './minuteAggregation'

type Aggregation = ReturnType<typeof createMinuteAggregation>
type Options = {
  authority: ReadyAccount
  readAuthority(): ReadyAccount | null
  signal: AbortSignal
  aggregation: Parameters<typeof createMinuteAggregation>[0]
  maxQueuedMinutes: number
  maxBatchMinutes: number
}
type Status = 'ready' | 'sending' | 'uncertain' | 'rejected' | 'closed'
const parts = ['neck', 'shoulder', 'trunk'] as const
function invalid(): Error {
  return new Error('Invalid owned minute upload')
}
function bound(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 60
}
function input(source: ReturnType<Aggregation['flush']>[number]): MinuteInput {
  return parseMinuteInput({
    minute_start: source.minuteStart,
    baseline_id: source.baselineId?.toLowerCase() ?? null,
    client_version: source.clientVersion,
    coverage_sec: source.coverageSec,
    measured_sec: source.measuredSec,
    unmeasurable_sec: source.unmeasurableSec,
    present_sec: source.presentSec,
    background_sec: source.backgroundSec,
    any_bad_sec: source.anyBadSec,
    ...Object.fromEntries(
      parts.map((name) => [
        name,
        {
          method: source.metrics[name].method,
          unit: source.metrics[name].unit,
          dev_mean: source.metrics[name].devMean,
          measured_sec: source.metrics[name].measuredSec,
          bad_sec: source.metrics[name].badSec,
        },
      ]),
    ),
  })
}
/** Real batch API uses ascending MinuteOut rows, not the paginated descending read-list. */
function accepted(value: unknown, batch: readonly MinuteInput[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as { items?: unknown; has_more?: unknown }
  if (
    Object.keys(row).length !== 2 ||
    row.has_more !== false ||
    !Array.isArray(row.items) ||
    row.items.length !== batch.length
  )
    return false
  return row.items.every((item, index) => {
    const actual = parseMinute(item)
    const expected = batch[index]
    if (!expected || Date.parse(actual.minute_start) !== Date.parse(expected.minute_start))
      return false
    return (Object.keys(expected) as (keyof MinuteInput)[]).every((key) => {
      if (key === 'minute_start') return true
      if (key === 'neck' || key === 'shoulder' || key === 'trunk') {
        const a = actual[key],
          b = expected[key]
        return (
          a.method === b.method &&
          a.unit === b.unit &&
          a.dev_mean === b.dev_mean &&
          a.measured_sec === b.measured_sec &&
          a.bad_sec === b.bad_sec
        )
      }
      return actual[key] === expected[key]
    })
  })
}
export async function prepareOwnedMinuteUpload(options: Options) {
  const { authority, readAuthority } = options
  const ownerId = authority.user.id
  const maxQueued = options.maxQueuedMinutes,
    maxBatch = options.maxBatchMinutes
  if (!bound(maxQueued) || !bound(maxBatch) || maxBatch > maxQueued) throw invalid()
  let engine: Aggregation
  try {
    engine = createMinuteAggregation(options.aggregation)
  } catch {
    throw invalid()
  }
  const abort = new AbortController()
  const signal = AbortSignal.any([abort.signal, options.signal])
  let status: Status = 'ready',
    proof = '',
    busy = false
  let queue: MinuteInput[] = []
  let pending: { body: string; items: readonly MinuteInput[] } | null = null
  function close() {
    status = 'closed'
    proof = ''
    pending = null
    queue = []
    engine.close()
    abort.abort()
    options.signal.removeEventListener('abort', close)
  }
  function syncOwner(): boolean {
    if (
      status === 'closed' ||
      signal.aborted ||
      readAuthority() !== authority ||
      authority.user.id !== ownerId
    ) {
      close()
      return false
    }
    return true
  }
  function check() {
    if (!syncOwner()) throw new ApiError(401)
  }
  function protect<T>(action: () => T): T {
    check()
    try {
      return action()
    } catch {
      close()
      throw invalid()
    }
  }
  async function sameAccount() {
    check()
    const user = await request('/me', signal, undefined, 200)
    check()
    if (!user || typeof user !== 'object' || !('id' in user) || user.id !== ownerId)
      throw new ApiError(401)
  }
  options.signal.addEventListener('abort', close, { once: true })
  try {
    await sameAccount()
    const csrf = await request('/auth/csrf', signal, undefined, 200)
    check()
    if (
      !csrf ||
      typeof csrf !== 'object' ||
      Object.keys(csrf).length !== 1 ||
      !('csrf_token' in csrf) ||
      typeof csrf.csrf_token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(csrf.csrf_token)
    )
      throw new ApiError(503)
    proof = csrf.csrf_token
    await sameAccount()
  } catch (error) {
    close()
    throw error instanceof ApiError ? error : new ApiError(503)
  }
  async function send(retry: boolean): Promise<void> {
    if (!syncOwner() || busy || (retry ? status !== 'uncertain' : status !== 'ready')) return
    if (!pending) {
      if (queue.length === 0) return
      const items = Object.freeze(queue.slice(0, maxBatch))
      pending = { items, body: JSON.stringify({ items }) }
    }
    const original = pending
    busy = true
    status = 'sending'
    try {
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      const response = await fetch('/api/v1/summaries/batch', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: requestSignal,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': proof,
          'X-Account-ID': ownerId,
        },
        body: original.body,
      })
      if (!syncOwner()) return
      if (requestSignal.aborted) {
        status = 'uncertain'
        return
      }
      if ([401, 403].includes(response.status)) {
        close()
        return
      }
      if ([409, 422].includes(response.status)) {
        status = 'rejected'
        return
      }
      if (![200, 201].includes(response.status)) {
        status = 'uncertain'
        return
      }
      const result: unknown = await response.json()
      if (!syncOwner()) return
      if (requestSignal.aborted) {
        status = 'uncertain'
        return
      }
      if (!accepted(result, original.items)) {
        status = 'uncertain'
        return
      }
      queue = queue.slice(original.items.length)
      pending = null
      status = 'ready'
    } catch {
      if (syncOwner()) status = 'uncertain'
    } finally {
      busy = false
    }
  }
  return Object.freeze({
    close,
    syncOwner,
    push(interval: Parameters<Aggregation['push']>[0]) {
      if (!syncOwner() || status === 'rejected') return
      protect(() => engine.push(interval))
    },
    flush(monotonicMs: number) {
      if (!syncOwner() || status === 'rejected') return
      protect(() => {
        const completed = engine.flush(monotonicMs).map(input)
        if (queue.length + completed.length > maxQueued) throw invalid()
        queue.push(...completed)
      })
    },
    upload: () => send(false),
    retry: () => send(true),
    getSnapshot() {
      syncOwner()
      return Object.freeze({
        status,
        queuedMinutes: queue.length,
        bufferedMinutes: engine.getSnapshot().bufferedMinutes,
      })
    },
  })
}
