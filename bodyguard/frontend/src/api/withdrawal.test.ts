// FR-U-05: mock fetch contract tests; not proof of actual SMTP/SQL deletion.
import { afterEach, expect, it, vi } from 'vitest'
import { confirmWithdrawal, startWithdrawal } from './withdrawal'

afterEach(() => vi.unstubAllGlobals())
const json = (body: unknown, status = 202) => new Response(JSON.stringify(body), { status })
const challenge = 'a'.repeat(43)
const consent = {
  challenge_id: challenge,
  code: '123456',
  confirmation: 'delete-my-account' as const,
}
function stub(result: Response) {
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith('/csrf') ? json({ csrf_token: 'test-csrf' }, 200) : result,
  )
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
it('AW-02 sends same-origin CSRF-protected start with no identity supplied by the browser', async () => {
  const fetcher = stub(json({ challenge_id: challenge }))
  expect(await startWithdrawal(new AbortController().signal)).toEqual({ challenge_id: challenge })
  expect(fetcher.mock.calls[1]?.[0]).toBe('/api/v1/me/delete/start')
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[1]?.[1]
  expect(init).toMatchObject({
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    body: '{}',
  })
  expect(init?.headers).toMatchObject({ 'X-CSRF-Token': 'test-csrf' })
})
it.each([
  null,
  {},
  { challenge_id: 1 },
  { challenge_id: 'a'.repeat(42) },
  { challenge_id: 'a'.repeat(44) },
  { challenge_id: `${'a'.repeat(42)}\n` },
  { challenge_id: '가'.repeat(43) },
  { challenge_id: '/'.repeat(43) },
])('AW-02 malformed challenge is not actionable %#', async (value) => {
  stub(json(value))
  await expect(startWithdrawal(new AbortController().signal)).rejects.toMatchObject({ status: 503 })
})
it.each([200, 201, 204])('AW-02 start accepts only202, not%s', async (status) => {
  stub(status === 204 ? new Response(null, { status }) : json({ challenge_id: challenge }, status))
  await expect(startWithdrawal(new AbortController().signal)).rejects.toMatchObject({ status: 503 })
})
it('AW-02 confirm accepts actual204 and preserves external cancellation signal', async () => {
  const fetcher = stub(new Response(null, { status: 204 }))
  const controller = new AbortController()
  await confirmWithdrawal(consent, controller.signal)
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[1]?.[1]
  expect(JSON.parse(init?.body as string)).toEqual(consent)
  controller.abort()
  expect(init?.signal?.aborted).toBe(true)
})
it.each([200, 201, 202])(
  'AW-02 ambiguous successful%s is not deletion completion',
  async (status) => {
    stub(json({ deleted: true }, status))
    await expect(confirmWithdrawal(consent, new AbortController().signal)).rejects.toMatchObject({
      status: 503,
    })
  },
)
it.each([400, 401, 403, 422, 429, 503])('AW-02 real failure%s remains failure', async (status) => {
  stub(new Response(null, { status, headers: { 'Retry-After': '25' } }))
  await expect(confirmWithdrawal(consent, new AbortController().signal)).rejects.toMatchObject({
    status,
    retryAfter: 25,
  })
})
