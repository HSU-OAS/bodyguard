// FR-R-03/06, FR-U-04: actual Chrome/API/SQL, synthetic users/mail/summary only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { DashboardQuery } from '../src/api/dashboard'
import type { createDashboardProbe } from './fixtures/dashboardClientProbe'

const origin = 'http://localhost:4173',
  password = '기록 집계 연결 브라우저 시험 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX,
  bundle = process.env.BODYGUARD_TEST_DASHBOARD_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle ||
  !/^\/private\/tmp\/bodyguard-dashboard-client\.[A-Za-z0-9]+\/browser-probe$/.test(bundle)
)
  throw new Error('Owned dashboard probe required')
type Probe = ReturnType<typeof createDashboardProbe>
type PrivateWindow = Window & { dashboardProbe: Probe; dashboardRead: ReturnType<Probe['read']> }
let external = 0,
  cameras = 0,
  pageErrors = 0
const anchor = new Date()
anchor.setUTCHours(0, 0, 0, 0)
anchor.setUTCDate(anchor.getUTCDate() - 8 - ((anchor.getUTCDay() + 6) % 7) + 3)
const date = anchor.toISOString().slice(0, 10)
const query: DashboardQuery = { date, period: 'day', timezone: 'UTC' }
test.beforeEach(async ({ context, page }) => {
  external = cameras = pageErrors = 0
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      /\.glb|\.wasm|\.task|mediapipe/.test(url.pathname)
    )
      external++
  })
  page.on('pageerror', () => {
    pageErrors++
  })
  await page.route('**/__private-dashboard-probe.js', (route) =>
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
  await info.attach('dashboard-client-boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualChromeHttpSql: true,
        syntheticAccountsMailSummary: true,
        actualBodyOrAvatar: false,
        external,
        cameras,
        pageErrors,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
  })
  expect(external).toBe(0)
  expect(cameras).toBe(0)
  expect(pageErrors).toBe(0)
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
  const email = `dashboard-${randomUUID()}@example.com`
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
}
async function seed(context: BrowserContext, minutes: number, day = date) {
  const items = Array.from({ length: minutes }, (_, i) => ({
    minute_start: `${day}T12:${i.toString().padStart(2, '0')}:00Z`,
    baseline_id: null,
    client_version: 'Fixture+V1',
    coverage_sec: 60,
    measured_sec: 30,
    unmeasurable_sec: 20,
    present_sec: 45,
    background_sec: 10,
    any_bad_sec: 15,
    ...Object.fromEntries(
      ['neck', 'shoulder', 'trunk'].map((part) => [
        part,
        {
          method: `fixture-${part}`,
          unit: 'deg',
          dev_mean: part === 'shoulder' ? 1.25 : null,
          measured_sec: part === 'shoulder' ? 30 : 0,
          bad_sec: part === 'shoulder' ? 15 : 0,
        },
      ]),
    ),
  }))
  expect((await post(context, '/summaries/batch', { items })).status()).toBe(201)
}
async function prepare(page: Page, context: BrowserContext) {
  const response = await context.request.get('/api/v1/me')
  expect(response.status()).toBe(200)
  const user = await response.json()
  await page.goto('/start')
  await page.evaluate(
    async (authority) => {
      const path = '/__private-dashboard-probe.js'
      const module = (await import(path)) as { createDashboardProbe: typeof createDashboardProbe }
      ;(window as unknown as PrivateWindow).dashboardProbe = module.createDashboardProbe(authority)
    },
    { status: 'ready' as const, user },
  )
}
const read = (page: Page, value = query) =>
  page.evaluate((q) => (window as unknown as PrivateWindow).dashboardProbe.read(q), value)
const start = (page: Page) =>
  page.evaluate((q) => {
    ;(window as unknown as PrivateWindow).dashboardRead = (
      window as unknown as PrivateWindow
    ).dashboardProbe.read(q)
  }, query)
const finish = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).dashboardRead)
test('DQ-W01 actual owned day/week preserves missing notifications and source', async ({
  page,
  context,
  browser,
}) => {
  const other = await browser.newContext({
    baseURL: origin,
    proxy: {
      server: process.env.BODYGUARD_TEST_BLOCKED_PROXY as string,
      bypass: 'localhost,127.0.0.1,[::1]',
    },
  })
  try {
    await join(other)
    await seed(other, 1)
    await join(context)
    await seed(context, 2)
    const previous = new Date(anchor)
    previous.setUTCDate(previous.getUTCDate() - 1)
    await seed(context, 1, previous.toISOString().slice(0, 10))
    await prepare(page, context)
    expect(await read(page)).toEqual({
      status: 200,
      minutes: 2,
      measured: 60,
      notificationsMissing: true,
      clientReported: true,
      partitions: 3,
    })
    expect(await read(page, { ...query, period: 'week' })).toEqual({
      status: 200,
      minutes: 3,
      measured: 90,
      notificationsMissing: true,
      clientReported: true,
      partitions: 3,
    })
  } finally {
    await other.close()
  }
})
test('DQ-W02 actual old response after logout and account switch is discarded', async ({
  page,
  context,
}) => {
  await join(context)
  await seed(context, 2)
  await prepare(page, context)
  await page.route('**/api/v1/records/dashboard?**', async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    await join(context)
    await seed(context, 1)
    await route.fulfill({ response })
  })
  await start(page)
  expect(await finish(page)).toEqual({ status: 401 })
})
test('DQ-W03 actual revoked cookie cannot read original owner', async ({ page, context }) => {
  await join(context)
  await seed(context, 1)
  await prepare(page, context)
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  expect(await read(page)).toEqual({ status: 401 })
})
test('DQ-W04 real 200 with injected invalid provenance cannot become a result', async ({
  page,
  context,
}) => {
  await join(context)
  await seed(context, 1)
  await prepare(page, context)
  await page.route('**/api/v1/records/dashboard?**', async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    await route.fulfill({
      response,
      json: { ...(await response.json()), provenance: 'server-verified' },
    })
  })
  expect(await read(page)).toEqual({ status: 503 })
})
test('DQ-W05 controlled current-CSRF delivery after same-object owner mutation cannot rebind a read', async ({
  page,
  context,
}) => {
  await join(context)
  await seed(context, 2)
  await prepare(page, context)
  let rebound = false
  await page.route('**/api/v1/auth/csrf', async (route) => {
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    await join(context)
    await seed(context, 1)
    const user = await (await context.request.get('/api/v1/me')).json()
    await page.evaluate(
      (owner) => (window as unknown as PrivateWindow).dashboardProbe.rebind(owner),
      user.id,
    )
    rebound = true
    // TEST ONLY: deliver a real current-session CSRF response, not the old
    // intercepted request's Cookie snapshot (which the server correctly rejects).
    const response = await context.request.get('/api/v1/auth/csrf')
    expect(response.status()).toBe(200)
    await route.fulfill({ response })
  })
  await start(page)
  const result = await finish(page)
  expect(rebound).toBe(true)
  expect(result).toEqual({ status: 401 })
})
