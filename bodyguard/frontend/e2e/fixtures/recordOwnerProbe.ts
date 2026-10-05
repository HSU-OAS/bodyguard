// FR-U-04/FR-R-03: TEST ONLY real auth API, synthetic authority object and summary.
import type { ReadyAccount } from '../../src/auth'
import { captureRecordOwner } from '../../src/coaching/recordOwner'

export function prepareOwnerProbe(options: {
  authority: ReadyAccount
  recordId: string
  startedUtcAt: string
}) {
  let current = options.authority
  const controller = new AbortController()
  let context: Awaited<ReturnType<typeof captureRecordOwner>> | null = null
  let failed = false
  const capturing = captureRecordOwner({
    authority: options.authority,
    readAuthority: () => current,
    signal: controller.signal,
  }).then(
    (value) => {
      context = value
    },
    () => {
      failed = true
    },
  )
  const row = {
    id: options.recordId,
    motion_id: 'fixture-not-release',
    protocol_version: 'synthetic-algebra-only',
    started_at: options.startedUtcAt,
    ended_at: new Date(Date.parse(options.startedUtcAt) + 100).toISOString(),
    outcome: 'interrupted' as const,
    observed_ms: 40,
    repetitions: 0,
  }
  return {
    wait: () => capturing,
    state: () => ({
      captured: context !== null,
      failed,
      active: context?.active() ?? false,
      writer: context?.active() ? context.createWriter().getSnapshot() : null,
    }),
    submit: () => context?.createWriter().submit(row),
    retry: () => context?.createWriter().retry(),
    abort: () => controller.abort(),
    replace() {
      current = { ...options.authority }
      context?.active()
    },
    close: () => context?.close(),
  }
}
