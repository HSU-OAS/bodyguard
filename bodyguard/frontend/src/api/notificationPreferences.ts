// FR-N-03/FR-U-04/NFR-08: five owned settings; no storage, automatic write or runtime alerts.
import type { ReadyAccount } from '../auth'
import { ApiError, request } from './auth'
import type { NotificationPreferences } from './generated'

const fields = [
  'posture_enabled',
  'posture_minutes',
  'sitting_enabled',
  'sitting_minutes',
  'sound_enabled',
] as const
export function parsePreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(503)
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== fields.length || !fields.every((key) => Object.hasOwn(row, key)))
    throw new ApiError(503)
  for (const key of ['posture_enabled', 'sitting_enabled', 'sound_enabled']) {
    if (typeof row[key] !== 'boolean') throw new ApiError(503)
  }
  for (const key of ['posture_minutes', 'sitting_minutes']) {
    const minutes = row[key]
    if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440)
      throw new ApiError(503)
  }
  return {
    posture_enabled: row.posture_enabled as boolean,
    posture_minutes: row.posture_minutes as number,
    sitting_enabled: row.sitting_enabled as boolean,
    sitting_minutes: row.sitting_minutes as number,
    sound_enabled: row.sound_enabled as boolean,
  }
}

/** The committed ready object is the lease. Proof remains in this private closure.
 * Server cookie-bound CSRF is the backstop if a caller misses a cookie change.
 */
export async function preparePreferences(options: {
  authority: ReadyAccount
  readAuthority(): ReadyAccount | null
  signal: AbortSignal
}) {
  const { authority, readAuthority } = options
  // FR-U-04: pin the primitive identity as well as the committed ready object.
  const ownerId = authority.user.id
  const abort = new AbortController()
  const signal = AbortSignal.any([abort.signal, options.signal])
  let proof = ''
  let closed = false
  let busy = false
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
  options.signal.addEventListener('abort', close, { once: true })
  try {
    check()
    await sameAccount()
    const csrf = await request('/auth/csrf', signal, undefined, 200)
    check()
    if (
      !csrf ||
      typeof csrf !== 'object' ||
      !('csrf_token' in csrf) ||
      typeof csrf.csrf_token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(csrf.csrf_token)
    )
      throw new ApiError(503)
    proof = csrf.csrf_token
    // FR-N-03/NFR-08: bookend /me checks alone cannot bind the intervening read.
    const response = await fetch('/api/v1/settings/notifications', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      headers: { 'X-CSRF-Token': proof, 'X-Account-ID': ownerId },
    })
    check()
    if (!response.ok) {
      const delay = Number(response.headers.get('Retry-After'))
      throw new ApiError(response.status, Number.isFinite(delay) ? Math.max(0, delay) : 0)
    }
    if (response.status !== 200) throw new ApiError(503)
    const loaded: unknown = await response.json()
    check()
    let value = Object.freeze(parsePreferences(loaded))
    check()
    await sameAccount()
    return Object.freeze({
      get value() {
        return value
      },
      close,
      async save(input: NotificationPreferences): Promise<NotificationPreferences> {
        check()
        if (busy) throw new ApiError(409)
        const snapshot = parsePreferences(input)
        busy = true
        try {
          // Do not use generic request POST: it would refresh CSRF for a changed cookie.
          const response = await fetch('/api/v1/settings/notifications', {
            method: 'POST',
            credentials: 'same-origin',
            cache: 'no-store',
            signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': proof },
            body: JSON.stringify(snapshot),
          })
          check()
          if (response.status !== 200) throw new ApiError(response.status)
          const saved = parsePreferences(await response.json())
          check()
          if (!fields.every((key) => saved[key] === snapshot[key])) throw new ApiError(503)
          value = Object.freeze(saved)
          return saved
        } catch (error) {
          close()
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
