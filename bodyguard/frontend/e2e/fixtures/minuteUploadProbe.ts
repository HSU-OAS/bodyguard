// FR-R-01/06, FR-U-04: TEST ONLY synthetic observation clock; real aggregation/HTTP adapters.
import type { ReadyAccount } from '../../src/auth'
import { prepareOwnedMinuteUpload } from '../../src/summary/ownedMinuteUpload'

export async function prepareMinuteUploadProbe(options: { authority: ReadyAccount; utc: string }) {
  let authority = options.authority
  const abort = new AbortController()
  const pipeline = await prepareOwnedMinuteUpload({
    authority,
    readAuthority: () => authority,
    signal: abort.signal,
    maxQueuedMinutes: 4,
    maxBatchMinutes: 2,
    aggregation: {
      clock: { monotonicMs: 0, utc: options.utc },
      baselineId: null,
      clientVersion: 'Fixture+V1',
      maxIntervalMs: 60000,
      maxBufferedMinutes: 4,
      definitions: {
        neck: { method: 'fixture-neck', unit: 'deg', minDeviation: -180, maxDeviation: 180 },
        shoulder: {
          method: 'fixture-shoulder',
          unit: 'deg',
          minDeviation: -180,
          maxDeviation: 180,
        },
        trunk: { method: 'fixture-trunk', unit: 'deg', minDeviation: -180, maxDeviation: 180 },
      },
    },
  })
  let next = 0
  return {
    observe() {
      // Half the observed minute has no usable metrics. No clinical inference is fabricated.
      pipeline.push({
        startMs: next,
        endMs: next + 30000,
        present: true,
        background: false,
        neck: null,
        shoulder: { deviation: 1.25, bad: true },
        trunk: null,
      })
      pipeline.push({
        startMs: next + 30000,
        endMs: next + 60000,
        present: true,
        background: false,
        neck: null,
        shoulder: null,
        trunk: null,
      })
      next += 60000
      pipeline.flush(next)
    },
    replace() {
      authority = { ...authority, user: { ...authority.user } }
      pipeline.syncOwner()
    },
    upload: pipeline.upload,
    retry: pipeline.retry,
    state: pipeline.getSnapshot,
    close: pipeline.close,
  }
}
