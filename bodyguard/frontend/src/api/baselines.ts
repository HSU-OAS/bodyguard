// FR-M-03/FR-R-01/06/FR-U-04/NFR-08: immutable, account-owned DTOs, not calibration.
import type { ReadyAccount } from '../auth'
import { ApiError, request } from './auth'
import type { BaselineInput, BaselineMetric, BaselineOut } from './generated'
import { validDay } from './records'

const token = /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$/
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fields = ['id', 'client_version', 'neck', 'shoulder', 'trunk'] as const
function matches(pattern: RegExp, value: unknown): value is string {
  return typeof value === 'string' && pattern.exec(value)?.[0] === value
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(503)
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== keys.length || !keys.every((key) => Object.hasOwn(row, key)))
    throw new ApiError(503)
  return row
}
function metric(value: unknown): BaselineMetric {
  const row = object(value, ['method', 'unit', 'value'])
  if (
    !matches(token, row.method) ||
    !matches(token, row.unit) ||
    typeof row.value !== 'number' ||
    !Number.isFinite(row.value) ||
    Math.abs(row.value) > Number.MAX_SAFE_INTEGER
  )
    throw new ApiError(503)
  return Object.freeze({ method: row.method, unit: row.unit, value: row.value })
}
/** Copy only the existing wire contract; never serialize caller-owned raw data. */
export function parseBaselineInput(value: unknown): BaselineInput {
  const row = object(value, fields)
  if (!matches(uuid, row.id) || !matches(token, row.client_version)) throw new ApiError(503)
  return Object.freeze({
    id: row.id.toLowerCase(),
    client_version: row.client_version,
    neck: row.neck === null ? null : metric(row.neck),
    shoulder: metric(row.shoulder),
    trunk: row.trunk === null ? null : metric(row.trunk),
  })
}
export function parseBaseline(value: unknown): BaselineOut {
  const row = object(value, [...fields, 'created_at', 'is_active', 'provenance'])
  if (
    typeof row.created_at !== 'string' ||
    !matches(
      /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/,
      row.created_at,
    ) ||
    !validDay(row.created_at.slice(0, 10)) ||
    !Number.isFinite(Date.parse(row.created_at)) ||
    typeof row.is_active !== 'boolean' ||
    row.provenance !== 'client-reported'
  )
    throw new ApiError(503)
  const { created_at, is_active, provenance, ...input } = row
  const snapshot = parseBaselineInput(input)
  if (snapshot.id !== row.id) throw new ApiError(503)
  return Object.freeze({ ...snapshot, created_at, is_active, provenance } as BaselineOut)
}
function sameInput(saved: BaselineOut, input: BaselineInput) {
  return (
    saved.id === input.id &&
    saved.client_version === input.client_version &&
    (['neck', 'shoulder', 'trunk'] as const).every((name) => {
      const left = saved[name],
        right = input[name]
      return left === null || right === null
        ? left === right
        : left.method === right.method && left.unit === right.unit && left.value === right.value
    })
  )
}

/** Memory-only lease. Retry explicitly with the same input ID after uncertain writes. */
export async function prepareBaselines(options: {
  authority: ReadyAccount
  readAuthority(): ReadyAccount | null
  signal: AbortSignal
}) {
  const { authority, readAuthority } = options
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
  function check(external?: AbortSignal) {
    if (
      closed ||
      signal.aborted ||
      external?.aborted ||
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
  async function call(path: string, external: AbortSignal, input?: BaselineInput) {
    check(external)
    if (busy) throw new ApiError(409)
    busy = true
    const requestSignal = AbortSignal.any([signal, external, AbortSignal.timeout(15_000)])
    try {
      const response = await fetch(`/api/v1/baselines${path}`, {
        method: input ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        redirect: 'error',
        signal: requestSignal,
        headers: {
          'X-CSRF-Token': proof,
          'X-Account-ID': ownerId,
          ...(input ? { 'Content-Type': 'application/json' } : {}),
        },
        body: input ? JSON.stringify(input) : undefined,
      })
      check(external)
      // FR-U-04: reject even when fetch/JSON completion ignores the expired request signal.
      if (requestSignal.aborted) throw new ApiError(503)
      if (!response.ok) {
        const delay = Number(response.headers.get('Retry-After'))
        throw new ApiError(response.status, Number.isFinite(delay) ? Math.max(0, delay) : 0)
      }
      if (response.status !== 200 && !(input && response.status === 201)) throw new ApiError(503)
      const value: unknown = await response.json()
      check(external)
      if (requestSignal.aborted) throw new ApiError(503)
      if (value === null && path === '/active' && !input) return null
      const saved = parseBaseline(value)
      if (
        (path === '/active' && !saved.is_active) ||
        (path !== '/active' && !input && saved.id !== path.slice(1)) ||
        (input && (!sameInput(saved, input) || (response.status === 201 && !saved.is_active)))
      )
        throw new ApiError(503)
      check(external)
      return saved
    } catch (error) {
      close()
      throw error instanceof ApiError ? error : new ApiError(503)
    } finally {
      busy = false
    }
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
      !matches(/^[0-9a-f]{64}$/, csrf.csrf_token)
    )
      throw new ApiError(503)
    proof = csrf.csrf_token
    await sameAccount()
    check()
    return Object.freeze({
      close,
      active(external: AbortSignal) {
        return call('/active', external)
      },
      async detail(id: string, external: AbortSignal): Promise<BaselineOut> {
        check(external)
        if (!matches(uuid, id)) throw new ApiError(422)
        const result = await call(`/${id.toLowerCase()}`, external)
        if (!result) throw new ApiError(503)
        return result
      },
      async save(value: BaselineInput, external: AbortSignal): Promise<BaselineOut> {
        check(external)
        let input: BaselineInput
        try {
          input = parseBaselineInput(value)
        } catch {
          throw new ApiError(422)
        }
        const result = await call('', external, input)
        if (!result) throw new ApiError(503)
        return result
      },
    })
  } catch (error) {
    close()
    throw error instanceof ApiError ? error : new ApiError(503)
  }
}
