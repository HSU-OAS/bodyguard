// FR-R-03/06, FR-U-04: owned aggregate snapshot, strict calendar and request lease.
import type { ReadyAccount } from '../auth'
import { ApiError, request } from './auth'
import type { DashboardMetric, DashboardOut } from './generated'
import { localDay, validDay } from './records'

export type DashboardQuery = { date: string; period: 'day' | 'week'; timezone: string }
const token = /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const names = ['neck', 'shoulder', 'trunk'] as const
const durations = [
  'coverage_sec',
  'measured_sec',
  'unmeasurable_sec',
  'present_sec',
  'background_sec',
  'any_bad_sec',
] as const
const epsilon = 0.000001 // Floating tolerance only, not a posture threshold.
function object(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(503)
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== fields.length || !fields.every((key) => Object.hasOwn(row, key)))
    throw new ApiError(503)
  return row
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
function nonnegative(value: unknown): value is number {
  return finite(value) && value >= 0
}
function count(value: unknown): value is number {
  return nonnegative(value) && Number.isSafeInteger(value)
}
function utcDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}
export function dashboardTimezone(value: string): string {
  // Shared IANA contract: Intl alone also accepts numeric offset identifiers.
  if (!/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value)) throw new ApiError(422)
  try {
    return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone
  } catch {
    throw new ApiError(422)
  }
}
function localFormatter(zone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  return (value: number) => {
    const parts = formatter.formatToParts(value)
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
    return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  }
}
function boundary(
  day: string,
  formatted: ReturnType<typeof localFormatter>,
  latest = false,
): number {
  if (!validDay(day)) throw new ApiError(422)
  const utc = utcDay(day).getTime()
  // Sample offsets on both sides of a transition. Choose earliest valid midnight,
  // or the first local instant following a midnight/whole-date gap. No 24h assumption.
  const candidates = [-2, 0, 2]
    .map((delta) => {
      const sample = utc + delta * 86400000
      return utc - (Date.parse(formatted(sample)) - sample)
    })
    .sort((a, b) => a - b)
  const matches = candidates.filter((candidate) => formatted(candidate) === `${day}T00:00:00Z`)
  const exact = latest ? matches.at(-1) : matches[0]
  let result = exact
  if (result === undefined) {
    // A gap may start before midnight: find the actual first instant of the day.
    let low = Math.floor((utc - 2 * 86400000) / 1000)
    let high = Math.ceil((utc + 2 * 86400000) / 1000)
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (formatted(mid * 1000).slice(0, 10) < day) low = mid + 1
      else high = mid
    }
    result = low * 1000
  }
  if (result === undefined || !Number.isFinite(result) || new Date(result).getUTCFullYear() < 1)
    throw new ApiError(422)
  return result
}
function range(query: DashboardQuery) {
  if (!validDay(query.date) || !['day', 'week'].includes(query.period)) throw new ApiError(422)
  try {
    const formatted = localFormatter(query.timezone)
    if (formatted(boundary(query.date, formatted)).slice(0, 10) !== query.date)
      throw new ApiError(422)
    const startDay = utcDay(query.date)
    if (query.period === 'week')
      startDay.setUTCDate(startDay.getUTCDate() - ((startDay.getUTCDay() + 6) % 7))
    const endDay = new Date(startDay)
    endDay.setUTCDate(endDay.getUTCDate() + (query.period === 'week' ? 7 : 1))
    const local_start = startDay.toISOString().slice(0, 10),
      local_end = endDay.toISOString().slice(0, 10)
    const start = boundary(local_start, formatted),
      end = boundary(local_end, formatted, true)
    if (start >= end) throw new ApiError(422)
    return { local_start, local_end, start, end }
  } catch {
    throw new ApiError(422)
  }
}
export function dashboardQuery(params: URLSearchParams): DashboardQuery {
  if (
    [...params.keys()].some(
      (key) => !['date', 'period', 'timezone'].includes(key) || params.getAll(key).length !== 1,
    )
  )
    throw new ApiError(422)
  const query = {
    date: params.get('date') ?? localDay(new Date()),
    period: params.get('period') ?? 'day',
    timezone: dashboardTimezone(
      params.get('timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  }
  if (query.period !== 'day' && query.period !== 'week') throw new ApiError(422)
  const result: DashboardQuery = { ...query, period: query.period }
  range(result)
  return Object.freeze(result)
}
function instant(value: unknown): number {
  if (
    typeof value !== 'string' ||
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.0{1,6})?(?:Z|\+00:00)$/.test(
      value,
    ) ||
    !validDay(value.slice(0, 10)) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new ApiError(503)
  return Date.parse(value)
}
export function parseDashboard(value: unknown, query: DashboardQuery): DashboardOut {
  const row = object(value, [
    'date',
    'period',
    'timezone',
    'local_start',
    'local_end',
    'start',
    'end',
    'totals',
    'metrics',
    'stretch',
    'notifications',
    'provenance',
  ])
  const expected = range(query)
  if (
    row.date !== query.date ||
    row.period !== query.period ||
    row.timezone !== query.timezone ||
    row.local_start !== expected.local_start ||
    row.local_end !== expected.local_end ||
    instant(row.start) !== expected.start ||
    instant(row.end) !== expected.end ||
    row.notifications !== null ||
    row.provenance !== 'client-reported'
  )
    throw new ApiError(503)
  const totals = object(row.totals, ['minutes', ...durations])
  if (!count(totals.minutes) || totals.minutes > Math.ceil((expected.end - expected.start) / 60000))
    throw new ApiError(503)
  const tolerance = epsilon * totals.minutes
  if (
    !durations.every(
      (key) =>
        nonnegative(totals[key]) && totals[key] <= (totals.minutes as number) * 60 + tolerance,
    )
  )
    throw new ApiError(503)
  const t = totals as DashboardOut['totals']
  if (
    Math.abs(t.coverage_sec - t.measured_sec - t.unmeasurable_sec - t.background_sec) > tolerance ||
    t.measured_sec > t.present_sec + tolerance ||
    t.present_sec > t.coverage_sec - t.background_sec + tolerance ||
    t.any_bad_sec > t.measured_sec + tolerance
  )
    throw new ApiError(503)
  if (
    !Array.isArray(row.metrics) ||
    row.metrics.length > t.minutes * 3 ||
    (t.minutes > 0 && row.metrics.length < 3)
  )
    throw new ApiError(503)
  const seen = new Set<string>()
  const partitions = new Map<string, Set<string>>()
  const metrics = row.metrics.map((value) => {
    const item = object(value, [
      'part',
      'baseline_id',
      'client_version',
      'method',
      'unit',
      'measured_sec',
      'bad_sec',
      'dev_mean',
      'bad_ratio',
    ])
    const ratio =
      nonnegative(item.bad_sec) && nonnegative(item.measured_sec) && item.measured_sec > 0
        ? item.bad_sec / item.measured_sec
        : null
    const precisionNull =
      ratio === null ||
      !Number.isFinite(ratio) ||
      (ratio === 0 && nonnegative(item.bad_sec) && item.bad_sec > 0)
    if (
      !names.some((name) => name === item.part) ||
      (item.baseline_id !== null &&
        (typeof item.baseline_id !== 'string' || !uuid.test(item.baseline_id))) ||
      !['client_version', 'method', 'unit'].every(
        (key) => typeof item[key] === 'string' && token.test(item[key]),
      ) ||
      !nonnegative(item.measured_sec) ||
      item.measured_sec > t.measured_sec + tolerance ||
      !nonnegative(item.bad_sec) ||
      item.bad_sec > item.measured_sec + epsilon * t.minutes ||
      (item.dev_mean === null) !== (item.measured_sec === 0) ||
      (item.bad_ratio === null) !== precisionNull ||
      (item.dev_mean !== null &&
        (!finite(item.dev_mean) || Math.abs(item.dev_mean) > Number.MAX_SAFE_INTEGER)) ||
      (item.bad_ratio !== null &&
        (!nonnegative(item.bad_ratio) ||
          Math.abs(item.bad_ratio - (ratio ?? 0)) > epsilon * Math.max(1, ratio ?? 0))) ||
      (item.measured_sec === 0 && item.bad_sec !== 0) ||
      (item.baseline_id === null && item.part !== 'shoulder' && item.measured_sec !== 0)
    )
      throw new ApiError(503)
    const key = JSON.stringify([
      item.part,
      item.baseline_id,
      item.client_version,
      item.method,
      item.unit,
    ])
    if (seen.has(key)) throw new ApiError(503)
    seen.add(key)
    const partition = JSON.stringify([item.baseline_id, item.client_version])
    const parts = partitions.get(partition) ?? new Set<string>()
    parts.add(item.part as string)
    partitions.set(partition, parts)
    return Object.freeze(item as DashboardMetric)
  })
  const partTime = names.map((part) =>
    metrics
      .filter((metric) => metric.part === part)
      .reduce((sum, item) => sum + item.measured_sec, 0),
  )
  const bad = metrics.reduce((sum, item) => sum + item.bad_sec, 0)
  const partBad = names.map((part) =>
    metrics.filter((metric) => metric.part === part).reduce((sum, item) => sum + item.bad_sec, 0),
  )
  if (
    [...partitions.values()].some((parts) => !names.every((part) => parts.has(part))) ||
    (t.minutes > 0 && !names.every((part) => metrics.some((metric) => metric.part === part))) ||
    Math.max(...partBad) > t.any_bad_sec + tolerance ||
    Math.max(...partTime) > t.measured_sec + tolerance ||
    t.measured_sec > partTime.reduce((a, b) => a + b, 0) + tolerance ||
    t.any_bad_sec > bad + tolerance ||
    t.measured_sec - t.any_bad_sec > partTime.reduce((a, b) => a + b, 0) - bad + tolerance
  )
    throw new ApiError(503)
  const stretch = object(row.stretch, ['completed', 'interrupted', 'skipped'])
  if (!Object.values(stretch).every(count)) throw new ApiError(503)
  return Object.freeze({
    ...row,
    totals: Object.freeze(t),
    metrics: Object.freeze(metrics),
    stretch: Object.freeze(stretch),
  } as unknown as DashboardOut)
}
export async function readDashboard(
  options: {
    authority: ReadyAccount
    readAuthority(): ReadyAccount | null
    signal: AbortSignal
  },
  query: DashboardQuery,
): Promise<DashboardOut> {
  const snapshot = dashboardQuery(new URLSearchParams(query))
  const { authority } = options
  const signal = AbortSignal.any([options.signal, AbortSignal.timeout(15000)])
  function check() {
    if (options.signal.aborted || options.readAuthority() !== authority) throw new ApiError(401)
    if (signal.aborted) throw new ApiError(503)
  }
  async function sameAccount() {
    check()
    const user = await request('/me', signal, undefined, 200)
    check()
    if (!user || typeof user !== 'object' || !('id' in user) || user.id !== authority.user.id)
      throw new ApiError(401)
  }
  try {
    await sameAccount()
    const csrf = object(await request('/auth/csrf', signal, undefined, 200), ['csrf_token'])
    check()
    if (typeof csrf.csrf_token !== 'string' || !/^[0-9a-f]{64}$/.test(csrf.csrf_token))
      throw new ApiError(503)
    await sameAccount()
    const response = await fetch(`/api/v1/records/dashboard?${new URLSearchParams(snapshot)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: { 'X-CSRF-Token': csrf.csrf_token, 'X-Account-ID': authority.user.id },
    })
    check()
    if (response.status !== 200) throw new ApiError(response.status)
    const value: unknown = await response.json()
    check()
    const result = parseDashboard(value, snapshot)
    await sameAccount()
    check()
    return result
  } catch (error) {
    check()
    throw error instanceof ApiError ? error : new ApiError(503)
  }
}
