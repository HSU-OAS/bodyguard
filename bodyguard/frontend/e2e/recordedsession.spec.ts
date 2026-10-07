// FR-R-03/FR-U-04: actual Chrome/API/SQL; clocks/ports/authority/mail/observations synthetic.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { prepareRecordedProbe } from './fixtures/recordedSessionProbe'

const origin = 'http://localhost:4173'
const password = '수행 기록 브라우저 시험 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_RECORDED_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle?.startsWith('/private/tmp/bodyguard-recorded-session-proof.') ||
  !bundle.endsWith('/browser-probe')
)
  throw new Error('Owned recorded probe required')
type Probe = Awaited<ReturnType<typeof prepareRecordedProbe>>
type PrivateWindow = Window & { recordedProbe: Probe }
let posts = 0
let external = 0
let cameras = 0
let statuses: number[] = []
test.beforeEach(async ({ context, page }) => {
  posts = 0
  external = 0
  cameras = 0
  statuses = []
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/records/stretch' && request.method() === 'POST') posts++
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      /\.glb|\.wasm|mediapipe/.test(url.pathname)
    )
      external++
  })
  context.on('response', (response) => {
    if (
      new URL(response.url()).pathname === '/api/v1/records/stretch' &&
      response.request().method() === 'POST'
    )
      statuses.push(response.status())
  })
  await page.route('**/__private-recorded-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
  await context.exposeBinding('__unexpectedCamera', () => {
    cameras++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __unexpectedCamera(): Promise<void> }).__unexpectedCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
})
test.afterEach(async ({ page }) => {
  expect(external).toBe(0)
  expect(cameras).toBe(0)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `recorded-${randomUUID()}@example.com`
  const response = await post(context, '/auth/signup', { email, password })
  expect(response.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  expect(
    (
      await post(context, '/auth/verify', {
        challenge_id: (await response.json()).challenge_id,
        code,
      })
    ).status(),
  ).toBe(201)
  return email
}
async function prepare(page: Page, context: BrowserContext, delayed: boolean) {
  const user = await (await context.request.get('/api/v1/me')).json()
  const recordId = randomUUID()
  const utc = new Date(Date.now() - 2000).toISOString()
  await page.evaluate(
    async (options) => {
      const path = '/__private-recorded-probe.js'
      const module = (await import(path)) as { prepareRecordedProbe: typeof prepareRecordedProbe }
      ;(window as unknown as PrivateWindow).recordedProbe =
        await module.prepareRecordedProbe(options)
    },
    { authority: { status: 'ready' as const, user }, recordId, utc, delayed },
  )
  return { recordId, utc }
}
// Existing API serializes aware Python datetime at microsecond precision; assert exact instant.
function apiTimestamp(ms: number) {
  const value = new Date(ms).toISOString()
  return value.endsWith('.000Z') ? value.replace('.000Z', 'Z') : value.replace(/Z$/, '000Z')
}
test('A04 delayed ready pause/resume saves actual session summary to own record/detail', async ({
  page,
  context,
}, info) => {
  await join(context)
  await page.goto('/start')
  const data = await prepare(page, context, true)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  await expect
    .poll(() => page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.waiting()))
    .toBe(true)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  expect(posts).toBe(0)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.releaseReady())
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.perform())
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  ).toMatchObject({
    session: 'ended',
    started: 500,
    elapsed: 300,
    disposed: 6,
    record: { status: 'idle', failure: null },
  })
  expect(posts).toBe(0)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.retry())
  expect(posts).toBe(1)
  expect(statuses).toEqual([201])
  const records = await (await context.request.get('/api/v1/records/stretch')).json()
  expect(records.items).toHaveLength(1)
  expect(records.items[0]).toMatchObject({
    id: data.recordId,
    started_at: apiTimestamp(Date.parse(data.utc) + 500),
    ended_at: apiTimestamp(Date.parse(data.utc) + 800),
    outcome: 'interrupted',
    observed_ms: 40,
    repetitions: 0,
    provenance: 'client-reported',
  })
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
  await page.goto(`/records/${data.recordId}`)
  await expect(page.getByRole('heading', { name: '수행 기록 상세', exact: true })).toBeVisible()
  await expect(page.getByText('관찰된 수행 시간', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('recorded-session-detail.png'), fullPage: true })
})
test('A04 same-account authority replaced during preparation: late readiness cannot save', async ({
  page,
  context,
}) => {
  await join(context)
  await page.goto('/start')
  await prepare(page, context, true)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  await expect
    .poll(() => page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.waiting()))
    .toBe(true)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.replace())
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.releaseReady())
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  ).toMatchObject({
    session: 'ended',
    started: null,
    disposed: 3,
    record: { status: 'closed', failure: 'ownership-error' },
  })
  expect(posts).toBe(0)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
})
test('A04 lost accepted response retries identical result and actual SQL contains one row', async ({
  page,
  context,
}) => {
  await join(context)
  await page.goto('/start')
  const data = await prepare(page, context, false)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.perform())
  const bodies: string[] = []
  await page.route('**/api/v1/records/stretch', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    bodies.push(route.request().postData() as string)
    if (bodies.length === 1) {
      expect((await route.fetch()).status()).toBe(201)
      await route.abort()
    } else await route.continue()
  })
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  ).toMatchObject({ record: { status: 'failed', failure: 'network' } })
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  expect(bodies).toHaveLength(1)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.retry())
  expect(bodies).toHaveLength(2)
  expect(bodies[0]).toBe(bodies[1])
  expect(JSON.parse(bodies[0]).id).toBe(data.recordId)
  expect(statuses).toEqual([200])
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    1,
  )
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
})
test('A04 missed account notification keeps original proof; new cookie receives 403/no record', async ({
  page,
  context,
}) => {
  const email = await join(context)
  await page.goto('/start')
  await prepare(page, context, false)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.perform())
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await join(context)
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  expect(statuses).toEqual([403])
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  ).toMatchObject({ record: { status: 'failed', failure: 'session-expired' } })
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  expect((await post(context, '/auth/login', { email, password })).status()).toBe(200)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
})
