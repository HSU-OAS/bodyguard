// FR-R-03/06, FR-U-04: actual Chrome/AuthProvider/HTTP/SQL, synthetic users/mail/summary.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { mountAuthDashboardProbe } from './fixtures/authDashboardProbe'

const origin = 'http://localhost:4173',
  mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_AUTH_DASHBOARD_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle ||
  !/^\/private\/tmp\/bodyguard-auth-dashboard\.[A-Za-z0-9]+\/browser-probe$/.test(bundle)
)
  throw new Error('Owned provider/dashboard probe required')
type ProbeWindow = Window & { authDashboardProbe: ReturnType<typeof mountAuthDashboardProbe> }
const anchor = new Date()
anchor.setUTCHours(0, 0, 0, 0)
anchor.setUTCDate(anchor.getUTCDate() - 8)
const date = anchor.toISOString().slice(0, 10)
const query = { date, period: 'day' as const, timezone: 'UTC' }
let external = 0,
  camera = 0,
  errors = 0,
  queries = 0
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as ProbeWindow).authDashboardProbe.state())
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post('/api/v1' + path, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `dashboard-lifetime-${randomUUID()}@example.com`
  const response = await post(context, '/auth/signup', {
    email,
    password: '가상 기록 연결 시험 비밀번호 12345',
  })
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
async function seed(context: BrowserContext, minutes: number) {
  const items = Array.from({ length: minutes }, (_, i) => ({
    minute_start: `${date}T12:${i.toString().padStart(2, '0')}:00Z`,
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
test.beforeEach(async ({ context, page }) => {
  external = camera = errors = queries = 0
  page.on('pageerror', () => errors++)
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.wasm|\.task|mediapipe/i.test(url.pathname)) external++
    if (url.pathname === '/api/v1/records/dashboard') queries++
  })
  await context.exposeBinding('__unexpectedDashboardCamera', () => camera++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { __unexpectedDashboardCamera(): Promise<void> }
      ).__unexpectedDashboardCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  await page.route('**/__private-auth-dashboard-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
  await join(context)
  await seed(context, 2)
  await page.goto('/start')
  await page.evaluate(async (query) => {
    const path = '/__private-auth-dashboard-probe.js'
    const module = (await import(path)) as {
      mountAuthDashboardProbe: typeof mountAuthDashboardProbe
    }
    ;(window as unknown as ProbeWindow).authDashboardProbe = module.mountAuthDashboardProbe(query)
  }, query)
  await expect.poll(async () => (await state(page)).auth).toBe('ready')
})
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('auth-dashboard-boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualChromeAuthProviderHttpSql: true,
        syntheticAccountsMailSummary: true,
        actualBodyOrAvatar: false,
        external,
        camera,
        errors,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
  })
  expect(external + camera + errors).toBe(0)
  expect(storage).toEqual([0, 0])
})
async function read(page: Page) {
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await expect.poll(async () => (await state(page)).status).toBe('ready')
}
test('AD-W01 explicit day/week and same-account refresh require a fresh action', async ({
  page,
}) => {
  expect(queries).toBe(0)
  expect(await state(page)).toMatchObject({ status: 'idle', minutes: null })
  await read(page)
  expect(await state(page)).toMatchObject({
    minutes: 2,
    clientReported: true,
    notificationsMissing: true,
  })
  await page.evaluate(() => (window as unknown as ProbeWindow).authDashboardProbe.refresh())
  await expect.poll(async () => (await state(page)).status).toBe('idle')
  expect(queries).toBe(1)
  await page.evaluate((q) => (window as unknown as ProbeWindow).authDashboardProbe.read(q), {
    ...query,
    period: 'week' as const,
  })
  expect(await state(page)).toMatchObject({ status: 'ready', minutes: 2 })
  expect(queries).toBe(2)
})
test('AD-W02 actual logout while response is held cancels and cannot restore old data', async ({
  page,
}) => {
  let release!: () => void, arrived!: () => void, finished!: () => void
  const held = new Promise<void>((done) => {
    release = done
  })
  const captured = new Promise<void>((done) => {
    arrived = done
  })
  const fulfilled = new Promise<void>((done) => {
    finished = done
  })
  await page.route('**/api/v1/records/dashboard?**', async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    arrived()
    await held
    await route.fulfill({ response })
    finished()
  })
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await captured
  expect(await state(page)).toMatchObject({ status: 'loading', minutes: null })
  await page.evaluate(() => (window as unknown as ProbeWindow).authDashboardProbe.signOut())
  await expect.poll(async () => (await state(page)).auth).toBe('guest')
  release()
  await fulfilled
  expect(await state(page)).toMatchObject({ status: 'idle', minutes: null })
  await page.evaluate(() => (window as unknown as ProbeWindow).authDashboardProbe.read())
  expect(queries).toBe(1)
})
test('AD-W03 controlled 503 has no data; only explicit retry reads again', async ({ page }) => {
  await page.route('**/api/v1/records/dashboard?**', async (route) => {
    expect((await route.fetch()).status()).toBe(200)
    await route.fulfill({ status: 503, json: {} })
  })
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await expect.poll(async () => (await state(page)).status).toBe('error')
  expect(await state(page)).toMatchObject({ minutes: null, statusCode: 503 })
  expect(queries).toBe(1)
  await page.unroute('**/api/v1/records/dashboard?**')
  await read(page)
  expect(queries).toBe(2)
})
test('AD-W04 actual account switch clears old data and fresh read returns only new owner', async ({
  page,
  context,
}) => {
  await read(page)
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await join(context)
  await seed(context, 1)
  await page.evaluate(() => (window as unknown as ProbeWindow).authDashboardProbe.refresh())
  await expect.poll(async () => (await state(page)).status).toBe('idle')
  expect(await state(page)).toMatchObject({ auth: 'ready', minutes: null })
  expect(queries).toBe(1)
  await read(page)
  expect(await state(page)).toMatchObject({ minutes: 1 })
})
test('AD-W05 actual React unmount retires retained controller and its data', async ({ page }) => {
  await read(page)
  await page.evaluate(() => (window as unknown as ProbeWindow).authDashboardProbe.unmount())
  expect(await state(page)).toMatchObject({ status: 'idle', minutes: null, auth: 'unmounted' })
  await page.evaluate(() => (window as unknown as ProbeWindow).authDashboardProbe.read())
  expect(queries).toBe(1)
})
test('AD-W06 actual revoked session rechecks AuthProvider to guest without data', async ({
  page,
  context,
}) => {
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await page.getByRole('button', { name: '조회', exact: true }).click()
  await expect.poll(async () => (await state(page)).auth).toBe('guest')
  expect(await state(page)).toMatchObject({ status: 'idle', minutes: null })
  expect(queries).toBe(0)
})
