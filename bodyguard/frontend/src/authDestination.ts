// FR-U-04: existing personal routes only; a destination never grants authentication.
import { recordId, validDay } from './api/records'

const pages = new Set([
  '/start',
  '/explore',
  '/records',
  '/posture-records',
  '/account',
  '/account/notifications',
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
  if (!pages.has(path) && !detail) return null
  const query = new URLSearchParams(search)
  const safe = new URLSearchParams()
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
