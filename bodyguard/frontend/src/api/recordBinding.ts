// FR-R-03/FR-U-04/05: bind one record operation to committed account and current session.
import type { ReadyAccount } from '../auth'
import { ApiError } from './auth'

export type RecordBinding = Readonly<{
  authority: ReadyAccount
  readAuthority: () => ReadyAccount | null
}>

export async function boundRecordRequest(
  path: string,
  signal: AbortSignal,
  binding: RecordBinding,
  body?: unknown,
): Promise<unknown> {
  const owner = binding.authority
  const ownerId = owner.user.id
  const readAuthority = binding.readAuthority
  const deadline = AbortSignal.timeout(15_000)
  const combined = AbortSignal.any([signal, deadline])
  // Snapshot caller input before any asynchronous authentication work.
  const encoded = body === undefined ? undefined : JSON.stringify(body)
  function check() {
    if (signal.aborted || readAuthority() !== owner || owner.user.id !== ownerId)
      throw new ApiError(401)
    if (deadline.aborted) throw new ApiError(503)
  }
  async function read(url: string, headers?: HeadersInit): Promise<unknown> {
    check()
    const response = await fetch(`/api/v1${url}`, {
      method: headers && encoded !== undefined ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: combined,
      headers,
      body: headers ? encoded : undefined,
    })
    check()
    if (response.status !== 200) throw new ApiError(response.ok ? 503 : response.status)
    const value: unknown = await response.json()
    check()
    return value
  }
  async function sameAccount() {
    const value = await read('/me')
    if (!value || typeof value !== 'object' || !('id' in value) || value.id !== ownerId)
      throw new ApiError(401)
  }
  try {
    check()
    await sameAccount()
    const csrf = await read('/auth/csrf')
    if (
      !csrf ||
      typeof csrf !== 'object' ||
      !('csrf_token' in csrf) ||
      typeof csrf.csrf_token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(csrf.csrf_token)
    )
      throw new ApiError(503)
    await sameAccount()
    const value = await read(path, {
      'X-CSRF-Token': csrf.csrf_token,
      'X-Account-ID': ownerId,
      ...(encoded === undefined ? {} : { 'Content-Type': 'application/json' }),
    })
    await sameAccount()
    check()
    return value
  } catch (error) {
    check()
    throw error instanceof ApiError ? error : new ApiError(503)
  }
}
