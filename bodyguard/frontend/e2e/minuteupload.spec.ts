// FR-R-01/06, FR-U-04: actual Chrome/API/PG; synthetic mail/accounts/observations only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { prepareMinuteUploadProbe } from './fixtures/minuteUploadProbe'

const origin = 'http://localhost:4173'
const password = '분 요약 저장 브라우저 시험 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_MINUTE_UPLOAD_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle?.startsWith('/private/tmp/bodyguard-minute-upload-proof.') ||
  !bundle.endsWith('/browser-probe')
)
  throw new Error('Owned minute upload probe required')
type Probe = Awaited<ReturnType<typeof prepareMinuteUploadProbe>>
type PrivateWindow = Window & { minuteUploadProbe: Probe }
let external = 0,
  cameras = 0,
  posts = 0
test.beforeEach(async ({ context, page }) => {
  external = 0
  cameras = 0
  posts = 0
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/summaries/batch' && request.method() === 'POST') posts++
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      /\.glb|\.wasm|mediapipe/.test(url.pathname)
    )
      external++
  })
  await page.route('**/__private-minute-upload-probe.js', (route) =>
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
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('minute-upload-boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualChromeHttpSql: true,
        syntheticAccountsIntervalsMail: true,
        actualBodyCameraClinical: false,
        external,
        cameras,
        posts,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
  })
  expect(external).toBe(0)
  expect(cameras).toBe(0)
  expect(storage).toEqual([0, 0])
})
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `minute-upload-${randomUUID()}@example.com`
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
async function prepare(
  page: Page,
  context: BrowserContext,
  utc = new Date(Math.floor(Date.now() / 60000) * 60000 - 120000).toISOString(),
) {
  const user = await (await context.request.get('/api/v1/me')).json()
  await page.goto('/start')
  await page.evaluate(
    async (options) => {
      const path = '/__private-minute-upload-probe.js'
      const module = (await import(path)) as {
        prepareMinuteUploadProbe: typeof prepareMinuteUploadProbe
      }
      ;(window as unknown as PrivateWindow).minuteUploadProbe =
        await module.prepareMinuteUploadProbe(options)
    },
    { authority: { status: 'ready' as const, user }, utc },
  )
  return utc
}
const observe = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).minuteUploadProbe.observe())
const upload = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).minuteUploadProbe.upload())
const retry = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).minuteUploadProbe.retry())
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).minuteUploadProbe.state())
const list = async (context: BrowserContext) =>
  (await (await context.request.get('/api/v1/summaries')).json()).items
test('MU-W01 observed minute saves to own white-blue posture record', async ({
  page,
  context,
}, info) => {
  await join(context)
  const utc = await prepare(page, context)
  await upload(page)
  expect(posts).toBe(0)
  await observe(page)
  await upload(page)
  expect(await state(page)).toEqual({ status: 'ready', queuedMinutes: 0, bufferedMinutes: 0 })
  const rows = await list(context)
  expect(rows).toHaveLength(1)
  expect(Date.parse(rows[0].minute_start)).toBe(Date.parse(utc))
  expect(rows[0]).toMatchObject({
    coverage_sec: 60,
    measured_sec: 30,
    unmeasurable_sec: 30,
    present_sec: 60,
    neck: { dev_mean: null, measured_sec: 0 },
    shoulder: { dev_mean: 1.25, measured_sec: 30, bad_sec: 30 },
    provenance: 'client-reported',
  })
  await page.evaluate(() => (window as unknown as PrivateWindow).minuteUploadProbe.close())
  await page.goto('/posture-records')
  await expect(page.getByRole('heading', { name: '내 자세 기록', exact: true })).toBeVisible()
  await expect(page.locator('.minute-detail-button').first()).toBeVisible()
  await page.locator('.minute-detail-button').first().click()
  await page.screenshot({ path: info.outputPath('owned-minute-record-detail.png'), fullPage: true })
})
test('MU-W02 accepted then lost response: explicit identical retry saves one row', async ({
  page,
  context,
}) => {
  await join(context)
  await prepare(page, context)
  await observe(page)
  const bodies: string[] = [],
    statuses: number[] = []
  await page.route('**/api/v1/summaries/batch', async (route) => {
    bodies.push(route.request().postData() as string)
    if (bodies.length === 1) {
      statuses.push((await route.fetch()).status())
      await route.abort()
    } else {
      const response = await route.fetch()
      statuses.push(response.status())
      await route.fulfill({ response })
    }
  })
  await upload(page)
  expect(await state(page)).toMatchObject({ status: 'uncertain', queuedMinutes: 1 })
  await upload(page)
  expect(bodies).toHaveLength(1)
  await retry(page)
  expect(bodies).toHaveLength(2)
  expect(bodies[0]).toBe(bodies[1])
  expect(statuses).toEqual([201, 200])
  expect(await state(page)).toMatchObject({ status: 'ready', queuedMinutes: 0 })
  expect(await list(context)).toHaveLength(1)
})
test('MU-W03 authority replaced discards; missed notification cannot write other owner', async ({
  page,
  context,
}) => {
  await join(context)
  await prepare(page, context)
  await observe(page)
  await page.evaluate(() => (window as unknown as PrivateWindow).minuteUploadProbe.replace())
  await upload(page)
  expect(posts).toBe(0)
  expect((await state(page)).status).toBe('closed')
  await prepare(page, context)
  await observe(page)
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await join(context)
  await upload(page)
  expect((await state(page)).status).toBe('closed')
  expect(await list(context)).toHaveLength(0)
})
test('MU-W04 different payload for same minute is rejected without overwriting own or other record', async ({
  page,
  context,
  browser,
}) => {
  const other = await browser.newContext({ baseURL: origin })
  try {
    await join(other)
    const otherPayload = {
      minute_start: '2026-10-01T00:00:00Z',
      baseline_id: null,
      client_version: 'Fixture+V1',
      coverage_sec: 0,
      measured_sec: 0,
      unmeasurable_sec: 0,
      present_sec: 0,
      background_sec: 0,
      any_bad_sec: 0,
      ...Object.fromEntries(
        ['neck', 'shoulder', 'trunk'].map((name) => [
          name,
          {
            method: `fixture-${name}`,
            unit: 'deg',
            dev_mean: null,
            measured_sec: 0,
            bad_sec: 0,
          },
        ]),
      ),
    }
    expect((await post(other, '/summaries/batch', { items: [otherPayload] })).status()).toBe(201)
    await join(context)
    const conflictMinute = await prepare(page, context)
    await observe(page)
    await upload(page)
    const before = await list(context)
    await prepare(page, context, conflictMinute)
    await observe(page)
    // Real conflicting aggregate, not a stubbed error response.
    await page.route('**/api/v1/summaries/batch', (route) => {
      const body = route.request().postDataJSON()
      body.items[0].shoulder.dev_mean = 2
      return route.continue({ postData: JSON.stringify(body) })
    })
    await upload(page)
    await retry(page)
    expect((await state(page)).status).toBe('rejected')
    expect(await list(context)).toEqual(before)
    expect(await list(other)).toHaveLength(1)
  } finally {
    await other.close()
  }
})
