// FR-U-05: memory-only signed confirmation; never infer an uncertain deletion result.
import { ApiError, request } from './auth'
import type { DeletePeriod, DeleteProof } from './generated'
import { timestamp } from './records'

export async function previewDeletion(
  period: DeletePeriod,
  signal: AbortSignal,
): Promise<DeleteProof> {
  const value = await request('/records/stretch/delete-preview', signal, period, 200)
  if (!value || typeof value !== 'object') throw new ApiError(503)
  const row = value as Record<string, unknown>
  const dates = ['start', 'end', 'cutoff', 'expires_at'] as const
  for (const field of dates) {
    if (!timestamp(row[field])) throw new ApiError(503)
  }
  if (
    Date.parse(row.start as string) !== Date.parse(period.start) ||
    Date.parse(row.end as string) !== Date.parse(period.end) ||
    Date.parse(row.end as string) <= Date.parse(row.start as string) ||
    Date.parse(row.expires_at as string) - Date.parse(row.cutoff as string) !== 600000 ||
    typeof row.count !== 'number' ||
    !Number.isInteger(row.count) ||
    row.count < 0 ||
    row.count > 2147483647 ||
    typeof row.fingerprint !== 'string' ||
    !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
    typeof row.signature !== 'string' ||
    !/^[0-9a-f]{64}$/.test(row.signature)
  )
    throw new ApiError(503)
  return {
    start: row.start as string,
    end: row.end as string,
    cutoff: row.cutoff as string,
    expires_at: row.expires_at as string,
    count: row.count,
    fingerprint: row.fingerprint,
    signature: row.signature,
  }
}

export async function confirmDeletion(proof: DeleteProof, signal: AbortSignal): Promise<number> {
  const value = await request(
    '/records/stretch/delete',
    signal,
    { ...proof, confirmation: 'delete-stretch-records' },
    200,
  )
  if (
    !value ||
    typeof value !== 'object' ||
    !('deleted' in value) ||
    typeof value.deleted !== 'number' ||
    !Number.isInteger(value.deleted) ||
    value.deleted < 0 ||
    value.deleted > proof.count
  )
    throw new ApiError(503)
  return value.deleted
}
