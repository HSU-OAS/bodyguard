// S4.15: actual production web/HTTP/SQL; synthetic accounts, aggregates, mail and faults.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned mailbox required')
const password = '격리된 자세 기록 시험 비밀번호 12345'
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function register(context: BrowserContext) {
  const email = `summaries-${randomUUID()}@example.com`
  const sent = await post(context, '/auth/signup', { email, password })
  expect(sent.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^\d{6}$/)
  expect(
    (
      await post(context, '/auth/verify', { challenge_id: (await sent.json()).challenge_id, code })
    ).status(),
  ).toBe(201)
  return email
}
async function seed(context: BrowserContext, count = 1, deviation = 1.25) {
  const top = new Date(Math.floor(Date.now() / 60000) * 60000 - 5 * 60000)
  const part = { method: 'Fixture+V1', unit: 'deg', measured_sec: 0, bad_sec: 0, dev_mean: null }
  const items = Array.from({ length: count }, (_, index) => ({
    minute_start: new Date(top.getTime() - index * 60000).toISOString(),
    baseline_id: null,
    client_version: 'Fixture+V1',
    coverage_sec: 60,
    measured_sec: 30,
    unmeasurable_sec: 20,
    present_sec: 45,
    background_sec: 10,
    any_bad_sec: 15,
    neck: part,
    trunk: part,
    shoulder: { ...part, measured_sec: 30, bad_sec: 15, dev_mean: deviation },
  }))
  expect((await post(context, '/summaries/batch', { items })).status()).toBe(201)
  return items
}
async function open(page: Page) {
  await page.goto('/posture-records')
  await expect(page.getByRole('button', { name: '삭제 대상 확인' })).toBeVisible()
}
function contrast(a: string, b: string) {
  function luminance(value: string) {
    const rgb = value
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number)
    if (rgb?.length !== 3) throw new Error('Unsupported color')
    const c = rgb.map((n) =>
      n / 255 <= 0.04045 ? n / 255 / 12.92 : ((n / 255 + 0.055) / 1.055) ** 2.4,
    )
    return (c[0] ?? 0) * 0.2126 + (c[1] ?? 0) * 0.7152 + (c[2] ?? 0) * 0.0722
  }
  const x = luminance(a),
    y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
let camera = 0,
  unexpected: string[] = [],
  errors: string[] = []
let timing: Array<{ path: string; method: string; milliseconds: number }> = []
test.beforeEach(async ({ context, page }) => {
  camera = 0
  unexpected = []
  errors = []
  timing = []
  await context.exposeBinding('__summaryCamera', () => {
    camera++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __summaryCamera(): Promise<void> }).__summaryCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname))
      unexpected.push(url.origin + url.pathname)
  })
  context.on('requestfinished', (request) => {
    const url = new URL(request.url())
    if (url.origin === origin && url.pathname.startsWith('/api/v1/'))
      timing.push({
        path: url.pathname,
        method: request.method(),
        milliseconds: request.timing().responseEnd,
      })
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
})
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('summary-boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualProductionChromeHttpSql: true,
        syntheticAggregatesMailFaults: true,
        actualPersonCameraClinical: false,
        camera,
        unexpected,
        errors,
        timing,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
  })
  expect(camera).toBe(0)
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
  expect(storage).toEqual([0, 0])
})

test('SW-W01 실제 계정→자세 기록→상세·페이지·취소·삭제와 화이트 블루 웹', async ({
  page,
  context,
  browser,
}, info) => {
  test.setTimeout(90_000)
  const email = await register(context)
  await page.goto('/start')
  await page.getByRole('link', { name: '내 자세 기록 확인' }).click()
  await expect(page.getByText('이 기간에는 자세 기록이 없습니다')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '내 자세 기록' })).toBeFocused()
  await expect(page).toHaveTitle('내 자세 기록 · BODYGUARD')
  await page.screenshot({ path: info.outputPath('summary-empty.png'), fullPage: true })
  const other = await browser.newContext()
  await register(other)
  await seed(other, 1, 8.75)
  await seed(context, 21)
  await page.getByRole('button', { name: '기간 조회', exact: true }).click()
  const table = page.getByRole('table', { name: '분별 평균 편차와 전체 측정 시간' })
  await expect(table.locator('tbody tr')).toHaveCount(20)
  await expect(page.getByRole('link', { name: '자세 기록', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(await table.textContent()).not.toContain('8.75')
  await table.getByRole('button').first().focus()
  await page.keyboard.press('Enter')
  const detail = page.getByRole('table', { name: '선택한 분의 부위별 측정 지표' })
  await expect(detail.getByRole('row', { name: /어깨/ })).toContainText('50%')
  await expect(detail.getByRole('row', { name: /목/ })).toContainText('—')
  await expect(page.getByRole('heading', { name: /상세/, level: 2 })).toBeFocused()
  const query = page.getByRole('button', { name: '기간 조회', exact: true })
  await page.mouse.move(0, 0)
  await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(query).toHaveCSS('background-color', 'rgb(30, 90, 168)')
  await expect(query).toHaveCSS('border-radius', '8px')
  const colors = await query.evaluate((node) => {
    const s = getComputedStyle(node)
    return { a: s.color, b: s.backgroundColor }
  })
  expect(contrast(colors.a, colors.b)).toBeGreaterThanOrEqual(4.5)
  const input = page.getByLabel('시작 날짜', { exact: true })
  await input.focus()
  await expect(input).toHaveCSS('outline-width', '3px')
  const control = await input.evaluate((node) => {
    const s = getComputedStyle(node)
    return { border: s.borderTopColor, focus: s.outlineColor, background: s.backgroundColor }
  })
  expect(contrast(control.border, control.background)).toBeGreaterThanOrEqual(3)
  expect(contrast(control.focus, control.background)).toBeGreaterThanOrEqual(3)
  await page.screenshot({ path: info.outputPath('summary-desktop.png'), fullPage: true })
  await page.getByRole('heading', { level: 1, name: '내 자세 기록' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('summary-desktop-viewport.png') })
  await page.setViewportSize({ width: 920, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('summary-notebook.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await expect(query).toHaveCSS('transition-duration', '0s')
  await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('summary-narrow-web.png'), fullPage: true })
  const scroll = page.getByRole('region', { name: '분별 자세 기록 표' })
  await scroll.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => scroll.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)
  await page.setViewportSize({ width: 920, height: 900 })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = '2'
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('summary-zoom.png'), fullPage: true })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = ''
  })
  await page.getByRole('button', { name: '다음 기록', exact: true }).click()
  await expect(table.locator('tbody tr')).toHaveCount(1)
  expect((await context.request.get('/api/v1/me')).status()).toBe(200)
  await page.goBack()
  await expect(table.locator('tbody tr')).toHaveCount(20)
  await page.getByRole('button', { name: '삭제 대상 확인' }).click()
  await expect(page.getByText('삭제 대상 21건')).toBeVisible()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect(
    (await (await context.request.get('/api/v1/summaries?limit=100')).json()).items,
  ).toHaveLength(21)
  await page.getByRole('button', { name: '삭제 대상 확인' }).click()
  await expect(page.getByRole('heading', { name: '자세 기록 삭제 확인' })).toBeFocused()
  await page.screenshot({ path: info.outputPath('summary-confirmation.png'), fullPage: true })
  await page.getByRole('button', { name: '확인한 자세 기록 삭제' }).click()
  await expect(page.locator('.record-deletion [role="status"]')).toContainText(
    /21건을 삭제했습니다/,
  )
  expect((await (await context.request.get('/api/v1/summaries')).json()).items).toHaveLength(0)
  expect((await (await other.request.get('/api/v1/summaries')).json()).items).toHaveLength(1)
  await page.getByRole('button', { name: '기간 다시 조회' }).click()
  await expect(page.getByText('이 기간에는 자세 기록이 없습니다')).toBeVisible()
  await page.getByRole('link', { name: '내 계정', exact: true }).click()
  await expect(page.getByText(email)).toBeVisible()
  await page.getByRole('link', { name: '자세 기록 관리' }).click()
  await expect(page.getByRole('heading', { name: '내 자세 기록' })).toBeVisible()
  await other.close()
})

test('SW-W02 실제 삭제 뒤 응답 단절은 불확실·명시 재조회이며 재삭제하지 않는다', async ({
  page,
  context,
}, info) => {
  await register(context)
  await seed(context)
  await open(page)
  let writes = 0
  await page.route('**/api/v1/summaries/delete', async (route) => {
    writes++
    const response = await route.fetch()
    expect(response.status()).toBe(200)
    await route.abort('connectionreset')
  })
  await page.getByRole('button', { name: '삭제 대상 확인' }).click()
  await page.getByRole('button', { name: '확인한 자세 기록 삭제' }).click()
  await expect(page.getByRole('alert')).toContainText('삭제 결과를 확인하지 못했습니다')
  expect(writes).toBe(1)
  await expect(page.getByRole('table')).toHaveCount(0)
  expect((await (await context.request.get('/api/v1/summaries')).json()).items).toHaveLength(0)
  await page.screenshot({ path: info.outputPath('summary-uncertain.png'), fullPage: true })
  await page.getByRole('button', { name: '기간 다시 조회' }).click()
  await expect(page.getByText('이 기간에는 자세 기록이 없습니다')).toBeVisible()
  expect(writes).toBe(1)
})

test('SW-W03 실제 GET에 다른 계정 쿠키가 섞여도 기록은 표시되지 않는다', async ({
  page,
  context,
  browser,
}, info) => {
  await register(context)
  const other = await browser.newContext()
  await register(other)
  await seed(other, 1, 8.75)
  const cookies = (await other.cookies())
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ')
  let rejection = 0
  let swapped = false
  await page.route('**/api/v1/summaries?**', async (route) => {
    if (swapped) {
      await route.continue()
      return
    }
    swapped = true
    // Synthetic scheduling, actual HTTP server: the original proof/owner remains A.
    const response = await route.fetch({
      headers: { ...route.request().headers(), cookie: cookies },
    })
    rejection = response.status()
    await route.fulfill({ response })
  })
  await page.goto('/posture-records')
  await page.getByRole('button', { name: '계정 다시 확인' }).click()
  await expect(page.getByRole('button', { name: '삭제 대상 확인' })).toBeVisible()
  await page.unroute('**/api/v1/summaries?**')
  expect(rejection).toBe(403)
  await expect(page.getByText('이 기간에는 자세 기록이 없습니다')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  expect((await (await other.request.get('/api/v1/summaries')).json()).items).toHaveLength(1)
  await info.attach('read-binding-result.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualHttpCookieMismatch403: rejection === 403,
        otherOwnerRowPreserved: true,
        syntheticScheduling: true,
      }),
    ),
  })
  await other.close()
})

test('SW-W04 실제 대상 변경409와 조회 오류 복구·invalid 기간', async ({ page, context }, info) => {
  await register(context)
  const initial = await seed(context, 2)
  await open(page)
  await page.getByRole('button', { name: '삭제 대상 확인' }).click()
  await page.getByRole('button', { name: '확인한 자세 기록 삭제' }).waitFor()
  const single = initial[0]
  if (!single) throw new Error('Missing initial minute')
  const changed = await (
    await post(context, '/summaries/delete-preview', {
      start: single.minute_start,
      end: new Date(Date.parse(single.minute_start) + 60000).toISOString(),
    })
  ).json()
  expect(
    (
      await post(context, '/summaries/delete', {
        ...changed,
        confirmation: 'delete-minute-summaries',
      })
    ).status(),
  ).toBe(200)
  await page.getByRole('button', { name: '확인한 자세 기록 삭제' }).click()
  await expect(page.getByRole('alert')).toContainText('삭제 대상이 바뀌었거나')
  expect((await (await context.request.get('/api/v1/summaries')).json()).items).toHaveLength(1)
  await page.getByRole('button', { name: '삭제 대상 다시 확인' }).click()
  await page.getByRole('button', { name: '확인한 자세 기록 삭제' }).waitFor()
  // Add a different minute after preview, without changing old samples.
  const now = new Date(Math.floor(Date.now() / 60000) * 60000 - 2 * 60000).toISOString()
  const existing = (await (await context.request.get('/api/v1/summaries')).json()).items[0]
  const { created_at: _created, provenance: _provenance, ...input } = existing
  expect(
    (
      await post(context, '/summaries/batch', { items: [{ ...input, minute_start: now }] })
    ).status(),
  ).toBe(201)
  await page.getByRole('button', { name: '확인한 자세 기록 삭제' }).click()
  // New post-cutoff rows are deliberately preserved, not part of the confirmed target.
  await expect(page.locator('.record-deletion [role="status"]')).toContainText('1건을 삭제했습니다')
  expect((await (await context.request.get('/api/v1/summaries')).json()).items).toHaveLength(1)
  await page.getByRole('button', { name: '기간 다시 조회' }).click()
  await page.getByRole('button', { name: '삭제 대상 확인' }).click()
  const proof = await (
    await post(context, '/summaries/delete-preview', {
      start: '2000-01-01T00:00:00Z',
      end: '2099-01-01T00:00:00Z',
    })
  ).json()
  expect(
    (
      await post(context, '/summaries/delete', {
        ...proof,
        confirmation: 'delete-minute-summaries',
      })
    ).status(),
  ).toBe(200)
  // Emptying the exact target is a successful idempotent 0, not a fictitious partial delete.
  await page.getByRole('button', { name: '확인한 자세 기록 삭제' }).click()
  await expect(page.locator('.record-deletion [role="status"]')).toContainText('남아 있지 않습니다')
  await page.route('**/api/v1/summaries?**', (route) => route.abort())
  await page.getByRole('button', { name: '기간 다시 조회' }).click()
  await expect(page.getByRole('alert')).toContainText('자세 기록을 조회하지 못했습니다')
  await page.screenshot({ path: info.outputPath('summary-query-error.png'), fullPage: true })
  await page.unroute('**/api/v1/summaries?**')
  await page.getByRole('button', { name: '다시 조회', exact: true }).click()
  await expect(page.getByText('이 기간에는 자세 기록이 없습니다')).toBeVisible()
  await page.goto('/posture-records?from=2026-02-30&to=2026-10-01')
  await expect(page.getByRole('alert')).toContainText('올바른 기간')
  await expect(page.getByRole('table')).toHaveCount(0)
})
