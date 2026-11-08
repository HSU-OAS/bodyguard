// FR-U-04: existing personal routes only; a destination never grants authentication.
import { recordId, validDay } from './api/records'

const pages = new Set([
  '/start',
  '/explore',
  '/records',
  '/posture-records',
  '/account',
  '/account/notifications',
  '/account/profile',
  '/account/delete',
])

export function personalDestination(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 512 ||
    /[\\\\#\s]/.test(value) ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return null
  const [rawPath, search = '', extra] = value.split('?')
  if (extra !== undefined || !/^\/[A-Za-z0-9/-]+$/.test(rawPath)) return null
  const path = rawPath.toLowerCase().replace(/\/+$/, '')
  const detail = path.startsWith('/records/') && recordId(path.slice('/records/'.length))
  // FR-S-06: preserve the selected candidate only in the protected development review.
  const devCoaching = import.meta.env.DEV && path === '/dev/coaching'
  if (!pages.has(path) && !detail && !devCoaching) return null
  const query = new URLSearchParams(search)
  const safe = new URLSearchParams()
  if (devCoaching) {
    const values = query.getAll('motion')
    if (values.length === 1 && /^[a-z0-9-]{1,80}$/.test(values[0])) safe.set('motion', values[0])
    const preview = query.getAll('preview')
    if (safe.has('motion') && preview.length === 1 && preview[0] === '1') safe.set('preview', '1')
  }
  if (path === '/records' || detail || path === '/posture-records') {
    for (const key of ['from', 'to']) {
      const values = query.getAll(key)
      if (values.length === 1 && validDay(values[0])) safe.set(key, values[0])
    }
    const values = query.getAll('page')
    if (
      path === '/posture-records' &&
      values.length === 1 &&
      /^(?:0|[1-9]\d{0,2})$/.test(values[0]) &&
      Number(values[0]) <= 500
    )
      safe.set('page', values[0])
  }
  const suffix = safe.toString()
  return path + (suffix ? `?${suffix}` : '')
}

export function loginDestination(query: URLSearchParams): string {
  const values = query.getAll('next')
  return values.length === 1 ? (personalDestination(values[0]) ?? '/start') : '/start'
}
