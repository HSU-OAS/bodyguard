// FR-R-03/FR-U-04: owned summaries only; no persistent cache or exercise certification.
import { ApiError } from './auth'
import type { StretchList, StretchOut } from './generated'

export function recordId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
}
export function validDay(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith('0000')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function localDay(date: Date): string {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}
export function defaultPeriod(now = new Date()): { from: string; to: string } {
  const from = new Date(now)
  from.setDate(from.getDate() - 6)
  return { from: localDay(from), to: localDay(now) }
}
export function dateRange(from: string, to: string, cutoff: Date) {
  if (!validDay(from) || !validDay(to) || from > to || to > localDay(cutoff))
    throw new Error('Invalid period')
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  end.setDate(end.getDate() + 1)
  return {
    start: start.toISOString(),
    end: new Date(Math.min(end.getTime(), cutoff.getTime())).toISOString(),
  }
}

export function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    validDay(value.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}
function parseRecord(value: unknown): StretchOut {
  if (!value || typeof value !== 'object') throw new ApiError(503)
  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    !recordId(row.id) ||
    typeof row.motion_id !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(row.motion_id) ||
    typeof row.protocol_version !== 'string' ||
    !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(row.protocol_version) ||
    !timestamp(row.started_at) ||
    !timestamp(row.ended_at) ||
    !timestamp(row.created_at) ||
    typeof row.outcome !== 'string' ||
    !['completed', 'interrupted', 'skipped'].includes(row.outcome) ||
    typeof row.observed_ms !== 'number' ||
    !Number.isInteger(row.observed_ms) ||
    row.observed_ms < 0 ||
    row.observed_ms > 86400000 ||
    typeof row.repetitions !== 'number' ||
    !Number.isInteger(row.repetitions) ||
    row.repetitions < 0 ||
    row.repetitions > 10000 ||
    row.provenance !== 'client-reported'
  )
    throw new ApiError(503)
  const wall = Date.parse(row.ended_at) - Date.parse(row.started_at)
  if (
    wall < row.observed_ms ||
    wall > 86400000 ||
    (row.outcome === 'skipped' && (row.observed_ms !== 0 || row.repetitions !== 0))
  )
    throw new ApiError(503)
  return {
    id: row.id,
    motion_id: row.motion_id,
    protocol_version: row.protocol_version,
    started_at: row.started_at,
    ended_at: row.ended_at,
    created_at: row.created_at,
    outcome: row.outcome as StretchOut['outcome'],
    observed_ms: row.observed_ms,
    repetitions: row.repetitions,
    provenance: 'client-reported',
  }
}
async function get(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`/api/v1/records/stretch${path}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  })
  if (response.status !== 200) throw new ApiError(response.status)
  return response.json()
}
export async function listRecords(
  range: { start: string; end: string },
  offset: number,
  signal: AbortSignal,
): Promise<StretchList> {
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new ApiError(422)
  const query = new URLSearchParams({ ...range, limit: '20', offset: String(offset) })
  const value = await get(`?${query}`, signal)
  if (!value || typeof value !== 'object') throw new ApiError(503)
  const list = value as Record<string, unknown>
  if (!Array.isArray(list.items) || list.items.length > 20 || typeof list.has_more !== 'boolean')
    throw new ApiError(503)
  return { items: list.items.map(parseRecord), has_more: list.has_more }
}
export async function readRecord(id: string, signal: AbortSignal): Promise<StretchOut> {
  if (!recordId(id)) throw new ApiError(404)
  const row = parseRecord(await get(`/${id}`, signal))
  if (row.id !== id) throw new ApiError(503)
  return row
}
