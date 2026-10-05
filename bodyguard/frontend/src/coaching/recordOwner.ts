// FR-U-04/FR-R-03/NFR-08: explicit pre-coaching capture, no public automatic storage.
import { request } from '../api/auth'
import { recordId } from '../api/records'
import type { ReadyAccount } from '../auth'
import { createRecordWriter } from './resultRecord'

class CaptureError extends Error {
  constructor() {
    super('Unable to capture coaching account')
  }
}
/** Ready state object identity is the lease, not just the user ID.
 * Caller must sync/dispose on every auth authority transition. Existing server CSRF
 * binding rejects a changed cookie even if the caller misses a transition.
 */
export async function captureRecordOwner(
  options: Readonly<{
    authority: ReadyAccount | null
    readAuthority(): ReadyAccount | null
    signal: AbortSignal
  }>,
) {
  try {
    const { authority, readAuthority, signal } = options
    const accountId = authority?.user.id
    if (
      authority?.status !== 'ready' ||
      typeof accountId !== 'string' ||
      !recordId(accountId) ||
      typeof readAuthority !== 'function' ||
      !(signal instanceof AbortSignal)
    )
      throw new CaptureError()
    let proof = ''
    let closed = false
    let writer: ReturnType<typeof createRecordWriter> | null = null
    function close() {
      if (closed) return
      closed = true
      proof = ''
      signal.removeEventListener('abort', close)
      writer?.close()
    }
    function active(): boolean {
      if (closed) return false
      try {
        const current = readAuthority()
        if (
          !signal.aborted &&
          current !== null &&
          current === authority &&
          current.status === 'ready' &&
          current.user.id === accountId
        )
          return true
      } catch {
        /* Fixed failure, no raw context logging. */
      }
      close()
      return false
    }
    function check() {
      if (!active()) throw new CaptureError()
    }
    async function sameAccount() {
      check()
      const value = await request('/me', signal, undefined, 200)
      check()
      if (
        !value ||
        typeof value !== 'object' ||
        !('id' in value) ||
        value.id !== accountId ||
        !('email' in value) ||
        typeof value.email !== 'string'
      )
        throw new CaptureError()
    }
    await sameAccount()
    const value = await request('/auth/csrf', signal, undefined, 200)
    check()
    if (
      !value ||
      typeof value !== 'object' ||
      !('csrf_token' in value) ||
      typeof value.csrf_token !== 'string' ||
      !/^[0-9a-f]{64}$/.test(value.csrf_token)
    )
      throw new CaptureError()
    proof = value.csrf_token
    await sameAccount()
    signal.addEventListener('abort', close, { once: true })
    check()
    return Object.freeze({
      active,
      close,
      createWriter() {
        check()
        writer ??= createRecordWriter({
          owner: authority,
          readOwner: () => (active() ? authority : null),
          csrfProof: proof,
        })
        return writer
      },
    })
  } catch {
    throw new CaptureError()
  }
}
