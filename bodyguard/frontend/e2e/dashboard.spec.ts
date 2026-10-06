// FR-R-03/U-04: production Chrome + actual local HTTP/PG. Synthetic mail/records/faults.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  type BrowserContext,
  expect as baseExpect,
  type CDPSession,
  type Page,
  test,
} from '@playwright/test'

// Functional state waits match the existing 15s request deadline. They are not
// a performance pass: retain browser task/HTTP timing separately below.
const expect = baseExpect.configure({ timeout: 15000 })
const origin = 'http://localhost:4173',
  mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned mailbox required')
const query = '/dashboard?date=2026-10-01&period=day&timezone=UTC'
async function post(context: BrowserContext, path: string, data: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function register(context: BrowserContext) {
  const email = `dashboard-${randomUUID()}@example.com`
  const sent = await post(context, '/auth/signup', {
    email,
    password: '대시보드 격리 시험 비밀번호 12345',
  })
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
}
const emptyPart = { method: 'fixture', unit: 'deg', dev_mean: null, measured_sec: 0, bad_sec: 0 }
function minute(
  minute_start: string,
  measured = 30,
  mean = 1.25,
  version = 'Fixture+V1',
  unit = 'deg',
) {
  return {
    minute_start,
    baseline_id: null,
    client_version: version,
    coverage_sec: 60,
    measured_sec: measured,
    unmeasurable_sec: 50 - measured,
    present_sec: 45,
    background_sec: 10,
    any_bad_sec: measured / 2,
    neck: emptyPart,
    trunk: emptyPart,
    shoulder: { ...emptyPart, dev_mean: mean, measured_sec: measured, bad_sec: measured / 2, unit },
  }
}
async function seed(context: BrowserContext) {
  const items = [
    minute('2026-10-01T10:00:00Z'),
    minute('2026-10-01T10:01:00Z', 10, 5.25),
    minute('2026-10-01T10:02:00Z', 30, 0.75, 'Fixture+V2', 'ratio'),
    minute('2026-09-29T10:00:00Z', 30, 6),
    ...Array.from({ length: 21 }, (_, index) => ({
      ...minute(`2026-10-01T11:${index.toString().padStart(2, '0')}:00Z`),
      measured_sec: 0,
      unmeasurable_sec: 60,
      present_sec: 0,
      background_sec: 0,
      any_bad_sec: 0,
      shoulder: emptyPart,
    })),
  ]
  expect((await post(context, '/summaries/batch', { items })).status()).toBe(201)
  for (const outcome of ['completed', 'interrupted'] as const)
    expect(
      (
        await post(context, '/records/stretch', {
          id: randomUUID(),
          motion_id: 'fixture',
          protocol_version: 'fixture-v1',
          started_at: '2026-10-01T10:00:00Z',
          ended_at: '2026-10-01T10:01:00Z',
          outcome,
          observed_ms: 30000,
          repetitions: 0,
        })
      ).status(),
    ).toBe(201)
}
let camera = 0,
  unexpected: string[] = [],
  errors: string[] = []
let network: Array<{ path: string; status: number }> = []
let profiler: CDPSession | null = null
test.beforeEach(async ({ context, page }) => {
  camera = 0
  unexpected = []
  errors = []
  network = []
  if (process.env.BODYGUARD_TEST_DASHBOARD_PROFILE === '1') {
    profiler = await context.newCDPSession(page)
    await profiler.send('Profiler.enable')
    await profiler.send('Profiler.start')
  }
  await context.exposeBinding('__dashboardCamera', () => {
    camera++
  })
  await context.addInitScript(() => {
    const timings: { longTasks: number[]; focus: number; visibility: string[] } = {
      longTasks: [],
      focus: 0,
      visibility: [document.visibilityState],
    }
    Object.assign(window, { __dashboardTimings: timings })
    new PerformanceObserver((list) => {
      timings.longTasks.push(...list.getEntries().map((entry) => entry.duration))
    }).observe({ type: 'longtask', buffered: true })
    window.addEventListener('focus', () => {
      timings.focus++
    })
    document.addEventListener('visibilitychange', () => {
      timings.visibility.push(document.visibilityState)
    })
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __dashboardCamera(): Promise<void> }).__dashboardCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname))
      unexpected.push(url.origin + url.pathname)
  })
  page.on('pageerror', (error) => errors.push(error.message))
  context.on('response', (response) => {
    const url = new URL(response.url())
    if (url.origin === origin && url.pathname.startsWith('/api/v1/'))
      network.push({ path: url.pathname, status: response.status() })
  })
  await page.goto('/')
})
test.afterEach(async ({ page }, info) => {
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop')
    if (
      !profile.samples ||
      !profile.timeDeltas ||
      profile.samples.length !== profile.timeDeltas.length
    )
      throw new Error('CPU diagnostic samples are incomplete')
    const times = new Map<number, number>()
    for (const [index, id] of profile.samples.entries())
      times.set(id, (times.get(id) ?? 0) + profile.timeDeltas[index])
    await info.attach('dashboard-cpu-functions.json', {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({
          diagnosticSamplingOnly: true,
          duration_us: profile.endTime - profile.startTime,
          functions: profile.nodes
            .map((node: { id: number; callFrame: { functionName: string; url: string } }) => ({
              name: node.callFrame.functionName,
              url: node.callFrame.url,
              self_us: times.get(node.id) ?? 0,
            }))
            .sort((a: { self_us: number }, b: { self_us: number }) => b.self_us - a.self_us)
            .slice(0, 25),
        }),
      ),
    })
    await profiler.detach()
    profiler = null
  }
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('dashboard-boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualProductionChromeHttpSql: true,
        syntheticRecordsMailFaults: true,
        actualPersonCameraClinical: false,
        camera,
        unexpected,
        errors,
        network,
        storage,
        browser: page.context().browser()?.version(),
        timing: await page.evaluate(() => {
          const data = (window as unknown as { __dashboardTimings: unknown }).__dashboardTimings
          return {
            browserTasks: data,
            requests: performance
              .getEntriesByType('resource')
              .filter((entry) => new URL(entry.name).pathname.startsWith('/api/v1/'))
              .map((entry) => ({
                path: new URL(entry.name).pathname,
                start: entry.startTime,
                duration: entry.duration,
              })),
          }
        }),
      }),
    ),
  })
  expect(camera).toBe(0)
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
  expect(storage).toEqual([0, 0])
})
async function open(page: Page) {
  await page.bringToFront()
  await page.goto(query)
  await expect(page.getByRole('heading', { name: '내 기록 대시보드' })).toBeVisible()
}
test('DW01 실제 저장→전체 하루/한 주 집계→기록 관리/복귀와 의료 화이트블루 웹', async ({
  page,
  context,
  browser,
}, info) => {
  test.setTimeout(90000)
  await register(context)
  await seed(context)
  const other = await browser.newContext()
  await register(other)
  expect(
    (
      await post(other, '/summaries/batch', { items: [minute('2026-10-01T10:00:00Z', 30, 8.75)] })
    ).status(),
  ).toBe(201)
  await open(page)
  await expect(page.getByText('2.25 deg', { exact: true })).toBeVisible()
  await expect(page.getByText('0.75 ratio', { exact: true })).toBeVisible()
  await expect(page.getByText('24개의 분 단위 기록')).toBeVisible()
  await expect(page.getByText('측정 기록 없음', { exact: true })).toHaveCount(4)
  await expect(page.getByText('알림 기록 연결 준비 중')).toBeVisible()
  expect(await page.locator('.dashboard-screen').textContent()).not.toContain('8.75')
  await expect(page.getByRole('link', { name: '기록 대시보드', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page).toHaveTitle('내 기록 대시보드 · BODYGUARD')
  const submit = page.getByRole('button', { name: '기록 조회', exact: true })
  await page.mouse.move(0, 0)
  await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(submit).toHaveCSS('background-color', 'rgb(30, 90, 168)')
  const input = page.getByLabel('기준 날짜', { exact: true })
  await input.focus()
  await expect(input).toHaveCSS('outline-width', '3px')
  await page.screenshot({ path: info.outputPath('dashboard-desktop.png'), fullPage: true })
  await page.getByLabel('한 주', { exact: true }).check()
  await submit.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('3.86 deg', { exact: true })).toBeVisible()
  await expect(page.getByText('25개의 분 단위 기록')).toBeVisible()
  await expect(page.locator('#dashboard-results')).toBeFocused()
  await expect(page).toHaveURL(/period=week/)
  await page.screenshot({ path: info.outputPath('dashboard-week.png'), fullPage: true })
  await page.reload()
  await expect(page.getByRole('heading', { name: '내 기록 대시보드' })).toBeVisible()
  await expect(page.getByText('3.86 deg', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '자세 기록 관리', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 자세 기록', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '내 기록 대시보드' })).toBeVisible()
  await expect(page.getByText('3.86 deg', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '수행 기록 관리', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 수행 기록', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '내 기록 대시보드' })).toBeVisible()
  await expect(page.getByText('3.86 deg', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 920, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('dashboard-notebook.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await expect(submit).toHaveCSS('transition-duration', '0s')
  await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('dashboard-narrow-web.png'), fullPage: true })
  await page.setViewportSize({ width: 920, height: 900 })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = '2'
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('dashboard-zoom.png'), fullPage: true })
  await other.close()
})
test('DW02 실제 빈 기간/잘못된 URL/503 복구/요청 시 계정 권위 경계', async ({
  page,
  context,
}, info) => {
  test.setTimeout(90000)
  await register(context)
  await open(page)
  await expect(page.getByText('이 기간에는 저장된 기록이 없습니다')).toBeVisible()
  await page.screenshot({ path: info.outputPath('dashboard-empty.png'), fullPage: true })
  let reads = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/records/dashboard') reads++
  })
  await page.goto('/dashboard?date=2026-02-30&period=day&timezone=UTC')
  await expect(page.getByRole('alert')).toContainText('올바른 날짜')
  expect(reads).toBe(0)
  await page.getByLabel('기준 날짜', { exact: true }).fill('2026-10-01')
  await page.getByRole('button', { name: '기록 조회', exact: true }).click()
  await expect(page.getByText('이 기간에는 저장된 기록이 없습니다')).toBeVisible()
  await page.route('**/api/v1/records/dashboard?*', (route) =>
    route.fulfill({ status: 503, body: '{}', contentType: 'application/json' }),
  )
  await page.getByRole('button', { name: '기록 조회', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('조회하지 못했습니다')
  await page.screenshot({ path: info.outputPath('dashboard-error.png'), fullPage: true })
  await page.unroute('**/api/v1/records/dashboard?*')
  await page.getByRole('button', { name: '다시 조회', exact: true }).click()
  await expect(page.getByText('이 기간에는 저장된 기록이 없습니다')).toBeVisible()
  // A real API rejects the deliberately wrong fixed proof; not a mocked authorization response.
  await page.route('**/api/v1/records/dashboard?*', (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        'x-account-id': '00000000-0000-4000-8000-000000000099',
      },
    }),
  )
  await page.getByRole('button', { name: '기록 조회', exact: true }).click()
  await expect(page.getByRole('button', { name: '계정 다시 확인', exact: true })).toBeVisible()
  await page.unroute('**/api/v1/records/dashboard?*')
  await page.getByRole('button', { name: '계정 다시 확인', exact: true }).click()
  await expect(page.getByText('이 기간에는 저장된 기록이 없습니다')).toBeVisible()
})
