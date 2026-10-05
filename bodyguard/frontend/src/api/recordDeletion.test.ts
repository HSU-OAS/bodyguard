// FR-U-05: malformed signed responses never become actionable confirmations.
import { afterEach, expect, it, vi } from 'vitest'
import { confirmDeletion, previewDeletion } from './recordDeletion'

const period = { start: '2026-10-01T00:00:00Z', end: '2026-10-02T00:00:00Z' }
const proof = {
  ...period,
  cutoff: '2026-10-05T00:00:00Z',
  expires_at: '2026-10-05T00:10:00Z',
  count: 1,
  fingerprint: 'a'.repeat(64),
  signature: 'b'.repeat(64),
}
afterEach(() => vi.unstubAllGlobals())
function stub(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(url.endsWith('/auth/csrf') ? { csrf_token: 'fixture' } : body),
          { status: 200 },
        ),
    ),
  )
}
it.each([
  { count: true },
  { count: -1 },
  { signature: 'bad' },
  { fingerprint: null },
  { start: '2026-10-01' },
  { start: '2026-09-30T00:00:00Z' },
  { cutoff: '2026-02-30T00:00:00Z' },
  { expires_at: '2026-10-05T00:11:00Z' },
])('rejects malformed preview %j', async (change) => {
  stub({ ...proof, ...change })
  await expect(previewDeletion(period, new AbortController().signal)).rejects.toMatchObject({
    status: 503,
  })
})
it.each([null, { deleted: true }, { deleted: -1 }, { deleted: 2 }, { deleted: 0.5 }])(
  'rejects uncertain deletion response %j',
  async (body) => {
    stub(body)
    await expect(confirmDeletion(proof, new AbortController().signal)).rejects.toMatchObject({
      status: 503,
    })
  },
)
