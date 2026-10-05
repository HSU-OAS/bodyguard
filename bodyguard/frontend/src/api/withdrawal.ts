// FR-U-05: only the exact challenge/204 contract authorizes UI progression.

import { ApiError, request } from './auth'

// FR-U-04/05: rejected consent is retryable only after a fresh authoritative account check.
export class WithdrawalRejected extends ApiError {
  constructor(
    error: ApiError,
    readonly checkedUserId: string | null,
  ) {
    super(error.status, error.retryAfter)
  }
}

import type { WithdrawalChallenge, WithdrawalConfirmWritable } from './generated'

export async function startWithdrawal(signal: AbortSignal): Promise<WithdrawalChallenge> {
  const value = await request('/me/delete/start', signal, {}, 202)
  if (
    !value ||
    typeof value !== 'object' ||
    !('challenge_id' in value) ||
    typeof value.challenge_id !== 'string' ||
    value.challenge_id.length !== 43 ||
    !/^[A-Za-z0-9_-]+$/.test(value.challenge_id)
  )
    throw new ApiError(503)
  return { challenge_id: value.challenge_id }
}

export async function confirmWithdrawal(
  body: WithdrawalConfirmWritable,
  signal: AbortSignal,
): Promise<void> {
  await request('/me/delete/confirm', signal, body, 204)
}
