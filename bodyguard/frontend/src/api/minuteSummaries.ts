// S4.15: session-bound, memory-only read/delete. No producer or clinical certification.
import type { ReadyAccount } from '../auth'
import { ApiError, request } from './auth'
import type {
  DeletePeriod,
  MinuteInput,
  MinuteList,
  MinuteMetric,
  MinuteOut,
  SummaryProof,
} from './generated'
import { validDay } from './records'

const token = /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const hex = /^[0-9a-f]{64}$/
const epsilon = 0.000001
const names = ['neck', 'shoulder', 'trunk'] as const
const durations = [
  'coverage_sec',
  'measured_sec',
  'unmeasurable_sec',
  'present_sec',
  'background_sec',
  'any_bad_sec',
] as const

function object(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(503)
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== fields.length || !fields.every((key) => Object.hasOwn(row, key)))
    throw new ApiError(503)
  return row
}
function duration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 60
}
/** UTC output only; preserve signed microseconds, including values Date.parse truncates. */
function instant(value: unknown): bigint {
  if (typeof value !== 'string') throw new ApiError(503)
  const match =
    /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(
      value,
    )
  if (!match || !validDay(match[1] ?? '')) throw new ApiError(503)
  const time = Date.parse(value)
  if (!Number.isFinite(time)) throw new ApiError(503)
  return BigInt(time) * 1000n + BigInt((match[5] ?? '').padEnd(6, '0').slice(3))
}
function metric(value: unknown): MinuteMetric {
  const row = object(value, ['method', 'unit', 'dev_mean', 'measured_sec', 'bad_sec'])
  if (
    typeof row.method !== 'string' ||
    !token.test(row.method) ||
    typeof row.unit !== 'string' ||
    !token.test(row.unit) ||
    !duration(row.measured_sec) ||
    !duration(row.bad_sec) ||
    row.bad_sec > row.measured_sec + epsilon ||
    row.bad_sec > row.measured_sec * (1 + epsilon) ||
    (row.dev_mean === null) !== (row.measured_sec === 0) ||
    (row.measured_sec === 0 && row.bad_sec !== 0) ||
    (row.dev_mean !== null &&
      (typeof row.dev_mean !== 'number' ||
        !Number.isFinite(row.dev_mean) ||
        Math.abs(row.dev_mean) > Number.MAX_SAFE_INTEGER))
  )
    throw new ApiError(503)
  return Object.freeze(row as MinuteMetric)
}
// FR-R-01/06: shared strict snapshot; no fabricated server provenance for upload input.
export function parseMinuteInput(value: unknown): MinuteInput {
  const row = object(value, [
    'minute_start',
    'baseline_id',
    'client_version',
    ...durations,
    ...names,
  ])
  if (
    instant(row.minute_start) % 60000000n !== 0n ||
    typeof row.client_version !== 'string' ||
    !token.test(row.client_version) ||
    (row.baseline_id !== null &&
      (typeof row.baseline_id !== 'string' || !uuid.test(row.baseline_id))) ||
    !durations.every((key) => duration(row[key]))
  )
    throw new ApiError(503)
  const result = {
    ...row,
    neck: metric(row.neck),
    shoulder: metric(row.shoulder),
    trunk: metric(row.trunk),
  } as MinuteInput
  const parts = names.map((name) => result[name])
  if (
    Math.abs(
      result.coverage_sec - result.measured_sec - result.unmeasurable_sec - result.background_sec,
    ) > epsilon ||
    result.measured_sec > result.present_sec + epsilon ||
    result.present_sec > result.coverage_sec - result.background_sec + epsilon ||
    Math.max(...parts.map((part) => part.measured_sec)) > result.measured_sec + epsilon ||
    result.measured_sec > parts.reduce((sum, part) => sum + part.measured_sec, 0) + epsilon ||
    Math.max(...parts.map((part) => part.bad_sec)) > result.any_bad_sec + epsilon ||
    result.any_bad_sec >
      Math.min(
        result.measured_sec,
        parts.reduce((sum, part) => sum + part.bad_sec, 0),
      ) +
        epsilon ||
    result.measured_sec - result.any_bad_sec >
      parts.reduce((sum, part) => sum + part.measured_sec - part.bad_sec, 0) + epsilon ||
    (result.baseline_id === null &&
      (result.neck.measured_sec !== 0 || result.trunk.measured_sec !== 0))
  )
    throw new ApiError(503)
  return Object.freeze(result)
}
export function parseMinute(value: unknown): MinuteOut {
  const row = object(value, [
    'minute_start',
    'baseline_id',
    'client_version',
    ...durations,
    ...names,
    'created_at',
    'provenance',
  ])
  if (instant(row.created_at) < -62135596800000000n || row.provenance !== 'client-reported')
    throw new ApiError(503)
  const { created_at, provenance, ...source } = row
  return Object.freeze({ ...parseMinuteInput(source), created_at, provenance } as MinuteOut)
}
export function parseMinutes(value: unknown, range: DeletePeriod): MinuteList {
  const row = object(value, ['items', 'has_more'])
  if (
    !Array.isArray(row.items) ||
    row.items.length > 20 ||
    typeof row.has_more !== 'boolean' ||
    (row.has_more && row.items.length !== 20)
  )
    throw new ApiError(503)
  const start = instant(range.start),
    end = instant(range.end)
  const items = row.items.map(parseMinute)
  let previous = end
  for (const item of items) {
    const minute = instant(item.minute_start)
    if (minute < start || minute >= previous) throw new ApiError(503)
    previous = minute
  }
  return { items, has_more: row.has_more }
}
export function parseSummaryProof(value: unknown, range: DeletePeriod): SummaryProof {
  const row = object(value, [
    'start',
    'end',
    'cutoff',
    'expires_at',
    'count',
    'fingerprint',
    'signature',
  ])
  if (
    instant(row.start) !== instant(range.start) ||
    instant(row.end) !== instant(range.end) ||
    instant(row.start) >= instant(row.end) ||
    instant(row.expires_at) - instant(row.cutoff) !== 600000000n ||
    typeof row.count !== 'number' ||
    !Number.isInteger(row.count) ||
    row.count < 0 ||
    row.count > 2147483647 ||
    typeof row.fingerprint !== 'string' ||
    !hex.test(row.fingerprint) ||
    typeof row.signature !== 'string' ||
    !hex.test(row.signature)
  )
    throw new ApiError(503)
  return Object.freeze(row as SummaryProof)
}

export async function prepareSummaries(options: {
  authority: ReadyAccount
  readAuthority(): ReadyAccount | null
  signal: AbortSignal
}) {
  const { authority, readAuthority } = options
  // FR-U-04: the same ready object must not transfer this lease to a mutated ID.
  const ownerId = authority.user.id
  const abort = new AbortController()
  const signal = AbortSignal.any([abort.signal, options.signal])
  let proof = '',
    closed = false,
    busy = false
  function close() {
    closed = true
    proof = ''
    abort.abort()
    options.signal.removeEventListener('abort', close)
  }
  function check() {
    if (
      closed ||
      signal.aborted ||
      readAuthority() !== authority ||
      authority.user.id !== ownerId
    ) {
      close()
      throw new ApiError(401)
    }
  }
  async function sameAccount() {
    check()
    const user = await request('/me', signal, undefined, 200)
    check()
    if (!user || typeof user !== 'object' || !('id' in user) || user.id !== ownerId)
      throw new ApiError(401)
  }
  async function call(
    path: string,
    body: unknown | undefined,
    external: AbortSignal,
  ): Promise<unknown> {
    check()
    const response = await fetch(`/api/v1/summaries${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.any([signal, external, AbortSignal.timeout(15_000)]),
      headers: {
        'X-CSRF-Token': proof,
        'X-Account-ID': ownerId,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    check()
    if (response.status !== 200) {
      if ([401, 403].includes(response.status)) close()
      throw new ApiError(response.status)
    }
    const result: unknown = await response.json()
    check()
    if (external.aborted) throw new ApiError(503)
    return result
  }
  options.signal.addEventListener('abort', close, { once: true })
  try {
    await sameAccount()
    const csrf = object(await request('/auth/csrf', signal, undefined, 200), ['csrf_token'])
    check()
    if (typeof csrf.csrf_token !== 'string' || !hex.test(csrf.csrf_token)) throw new ApiError(503)
    proof = csrf.csrf_token
    await sameAccount()
    return Object.freeze({
      close,
      async list(range: DeletePeriod, offset: number, external: AbortSignal): Promise<MinuteList> {
        if (
          !Number.isInteger(offset) ||
          offset < 0 ||
          offset > 10000 ||
          instant(range.start) >= instant(range.end)
        )
          throw new ApiError(422)
        try {
          const result = parseMinutes(
            await call(
              `?${new URLSearchParams({ ...range, limit: '20', offset: String(offset) })}`,
              undefined,
              external,
            ),
            range,
          )
          await sameAccount()
          if (external.aborted) throw new ApiError(503)
          return result
        } catch (error) {
          if (error instanceof ApiError && [401, 403].includes(error.status)) close()
          throw error instanceof ApiError ? error : new ApiError(503)
        }
      },
      async preview(range: DeletePeriod, external: AbortSignal): Promise<SummaryProof> {
        try {
          return parseSummaryProof(await call('/delete-preview', range, external), range)
        } catch (error) {
          throw error instanceof ApiError ? error : new ApiError(503)
        }
      },
      async remove(input: SummaryProof, external: AbortSignal): Promise<number> {
        check()
        if (busy) throw new ApiError(409)
        const snapshot = parseSummaryProof(input, input)
        // Only the server clock decides expiry; local clock skew must not lock out deletion.
        if (snapshot.count === 0) throw new ApiError(409)
        busy = true
        try {
          const result = object(
            await call(
              '/delete',
              { ...snapshot, confirmation: 'delete-minute-summaries' },
              external,
            ),
            ['deleted'],
          )
          if (
            typeof result.deleted !== 'number' ||
            !Number.isInteger(result.deleted) ||
            (result.deleted !== 0 && result.deleted !== snapshot.count)
          )
            throw new ApiError(503)
          return result.deleted
        } catch (error) {
          throw error instanceof ApiError ? error : new ApiError(503)
        } finally {
          busy = false
        }
      },
    })
  } catch (error) {
    close()
    throw error instanceof ApiError ? error : new ApiError(503)
  }
}
export type SummaryContext = Awaited<ReturnType<typeof prepareSummaries>>
