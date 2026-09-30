// FR-U-02/03, NFR-08: same-origin HttpOnly session; no credential persistence.
import type { ChallengeOut, CredentialsWritable, UserOut, Verification } from './generated'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter = 0,
  ) {
    super('계정 요청을 완료하지 못했습니다')
  }
}

async function request(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  let headers: HeadersInit | undefined
  if (body !== undefined || path === '/auth/logout') {
    const csrf = await request('/auth/csrf', signal)
    if (
      !csrf ||
      typeof csrf !== 'object' ||
      !('csrf_token' in csrf) ||
      typeof csrf.csrf_token !== 'string'
    ) {
      throw new ApiError(503)
    }
    headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrf_token }
  }
  const response = await fetch(`/api/v1${path}`, {
    method: headers ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const delay = Number(response.headers.get('Retry-After'))
    throw new ApiError(response.status, Number.isFinite(delay) ? Math.max(0, delay) : 0)
  }
  return response.status === 204 || path === '/auth/resend' ? null : response.json()
}

function user(value: unknown): UserOut {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    !('email' in value) ||
    typeof value.id !== 'string' ||
    typeof value.email !== 'string'
  )
    throw new ApiError(503)
  return { id: value.id, email: value.email }
}

export async function me(signal: AbortSignal): Promise<UserOut | null> {
  try {
    return user(await request('/me', signal))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function authenticate(
  kind: 'login' | 'verify',
  body: CredentialsWritable | Verification,
  signal: AbortSignal,
): Promise<UserOut> {
  const value = await request(`/auth/${kind}`, signal, body)
  return user(value)
}

export async function signup(
  body: CredentialsWritable,
  signal: AbortSignal,
): Promise<ChallengeOut> {
  const value = await request('/auth/signup', signal, body)
  if (
    !value ||
    typeof value !== 'object' ||
    !('challenge_id' in value) ||
    typeof value.challenge_id !== 'string'
  ) {
    throw new ApiError(503)
  }
  return { challenge_id: value.challenge_id }
}

export async function resend(challenge_id: string, signal: AbortSignal): Promise<void> {
  await request('/auth/resend', signal, { challenge_id })
}

export async function logout(signal: AbortSignal): Promise<void> {
  await request('/auth/logout', signal)
}

export function errorMessage(error: unknown, verification = false): string {
  if (!(error instanceof ApiError))
    return '연결이 끊겼습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 429) return '요청이 많습니다. 안내된 대기 시간 후 다시 시도해 주세요.'
  if (error.status === 401) return '이메일 또는 비밀번호를 확인해 주세요.'
  if (error.status === 400 && verification)
    return '인증 코드를 확인해 주세요. 만료되었거나 여러 번 틀렸다면 가입을 다시 시작해 주세요.'
  if (error.status === 403) return '인증 연결이 만료되었습니다. 다시 시도해 주세요.'
  if (error.status === 422) return '입력 형식을 확인해 주세요.'
  return '지금 요청을 완료할 수 없습니다. 잠시 후 다시 시도해 주세요.'
}
