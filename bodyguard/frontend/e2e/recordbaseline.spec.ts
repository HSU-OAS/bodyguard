// FR-M-03/FR-R-01/06/FR-U-04: actual production web/HTTP/SQL, synthetic accounts/values/mail.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned mailbox required')
async function post(context: BrowserContext, path: string, data: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function register(context: BrowserContext) {
  const email = `record-baseline-${randomUUID()}@example.com`
  const response = await post(context, '/auth/signup', {
    email,
    password: '기준선 기록 웹 시험용 비밀번호 12345',
  })
  expect(response.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^\d{6}$/)
  expect(
    (
      await post(context, '/auth/verify', {
        challenge_id: (await response.json()).challenge_id,
        code,
      })
    ).status(),
  ).toBe(201)
  return (await context.request.get('/api/v1/me')).json() as Promise<{ id: string }>
}
async function history(context: BrowserContext, long = false) {
  const method = long ? 'F'.repeat(64) : 'fixture-shoulder'
  const unit = long ? 'U'.repeat(64) : 'deg'
  const old = {
    id: randomUUID(),
    client_version: 'Fixture+V1',
    neck: null,
    trunk: null,
    shoulder: { method, unit, value: 2.75 },
  }
  expect((await post(context, '/baselines', old)).status()).toBe(201)
  const part = { method, unit, measured_sec: 0, bad_sec: 0, dev_mean: null }
  const item = {
    minute_start: new Date(Math.floor(Date.now() / 60000) * 60000 - 5 * 60000).toISOString(),
    baseline_id: old.id,
    client_version: old.client_version,
    coverage_sec: 60,
    measured_sec: 30,
    unmeasurable_sec: 20,
    present_sec: 45,
    background_sec: 10,
    any_bad_sec: 15,
    neck: part,
    trunk: part,
    shoulder: { ...part, measured_sec: 30, bad_sec: 15, dev_mean: 1.25 },
  }
  expect((await post(context, '/summaries/batch', { items: [item] })).status()).toBe(201)
  const replacement = await post(context, '/baselines', {
    ...old,
    id: randomUUID(),
    shoulder: { ...old.shoulder, value: 9.75 },
  })
  expect(replacement.status()).toBe(201)
  expect((await replacement.json()).is_active).toBe(true)
  const saved = await (await context.request.get(`/api/v1/baselines/${old.id}`)).json()
  expect(saved.is_active).toBe(false)
  return old
}
let baselineRequests: Array<{ path: string; method: string }> = []
let external = 0,
  camera = 0
let errors: string[] = []
test.beforeEach(async ({ context, page }) => {
  baselineRequests = []
  external = 0
  camera = 0
  errors = []
  await context.exposeBinding('__recordBaselineCamera', () => {
    camera++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __recordBaselineCamera(): void }).__recordBaselineCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname)) external++
    if (url.pathname.startsWith('/api/v1/baselines'))
      baselineRequests.push({ path: url.pathname, method: request.method() })
  })
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('record-baseline-boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualProductionChromeHttpSql: true,
        syntheticAccountsValuesMail: true,
        actualBodyCalibration: false,
        camera,
        external,
        errors,
        baselineRequests,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
  })
  expect(camera).toBe(0)
  expect(external).toBe(0)
  expect(errors).toEqual([])
  expect(storage).toEqual([0, 0])
  expect(
    baselineRequests.every(
      (request) => request.method === 'GET' && !request.path.endsWith('/active'),
    ),
  ).toBe(true)
})
async function open(page: Page) {
  await page.goto('/posture-records')
  await page.locator('.minute-detail-button').first().click()
  await expect(page.getByRole('button', { name: '기준선 보기' })).toBeVisible()
  expect(baselineRequests).toHaveLength(0)
}
test('record A survives recalibration B: real historical lookup, keyboard and notebook layout', async ({
  page,
  context,
}, info) => {
  await register(context)
  const old = await history(context, true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await open(page)
  // Native Tab navigation within the existing detail, not a mock focus port.
  await page.getByRole('heading', { name: /상세$/ }).focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  const button = page.getByRole('button', { name: '기준선 보기' })
  await expect(button).toBeFocused()
  expect(await button.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  await page.keyboard.press('Enter')
  const result = page.getByRole('region', { name: '기록에 사용한 기준선' })
  await expect(result).toBeVisible()
  await expect(result).toContainText(`2.75 ${old.shoulder.unit} · ${old.shoulder.method}`)
  await expect(result).not.toContainText('9.75')
  expect(baselineRequests).toEqual([{ path: `/api/v1/baselines/${old.id}`, method: 'GET' }])
  for (const width of [1440, 800]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await info.attach(`record-baseline-${width}.png`, {
      body: await page.locator('.minute-detail').screenshot(),
      contentType: 'image/png',
    })
  }
})
test('controlled response failure requires explicit retry before actual stored baseline appears', async ({
  page,
  context,
}, info) => {
  await register(context)
  const old = await history(context)
  let failed = false
  await page.route(`**/api/v1/baselines/${old.id}`, (route) => {
    if (failed) return route.continue()
    failed = true
    return route.fulfill({
      status: 503,
      contentType: 'text/plain',
      body: 'Controlled response fault',
    })
  })
  await open(page)
  await page.getByRole('button', { name: '기준선 보기' }).click()
  await expect(page.getByRole('alert')).toContainText('조회하지 못했습니다')
  expect(baselineRequests).toHaveLength(1)
  await info.attach('record-baseline-error.png', {
    body: await page.locator('.minute-detail').screenshot(),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: '기준선 다시 조회' }).click()
  await expect(page.getByRole('region', { name: '기록에 사용한 기준선' })).toContainText('2.75 deg')
  expect(baselineRequests).toHaveLength(2)
})
test('silent cookie account switch closes original records and cannot read the other owner', async ({
  page,
  context,
  browser,
}) => {
  const owner = await register(context)
  const old = await history(context)
  await open(page)
  const other = await browser.newContext({ baseURL: origin })
  try {
    await register(other)
    await context.clearCookies()
    await context.addCookies(await other.cookies())
    await page.getByRole('button', { name: '기준선 보기' }).click()
    await expect(page.getByRole('button', { name: '계정 다시 확인' })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '삭제 대상 확인' })).toHaveCount(0)
    expect(baselineRequests).toHaveLength(0) // /me mismatch rejects before any baseline read.
    const proof = await (await context.request.get('/api/v1/auth/csrf')).json()
    expect(
      (
        await context.request.get(`/api/v1/baselines/${old.id}`, {
          headers: { 'X-CSRF-Token': proof.csrf_token, 'X-Account-ID': owner.id },
        })
      ).status(),
    ).toBe(403)
    expect((await context.request.get(`/api/v1/baselines/${old.id}`)).status()).toBe(404)
    await page.getByRole('button', { name: '계정 다시 확인' }).click()
    await expect(page.getByText('이 기간에는 자세 기록이 없습니다')).toBeVisible()
    await expect(page.getByRole('button', { name: '기준선 보기' })).toHaveCount(0)
  } finally {
    await other.close()
  }
})
