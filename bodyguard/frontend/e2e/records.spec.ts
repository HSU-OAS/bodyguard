// FR-R-03/FR-U-04/NFR-08: real HTTP/SQL/production Chrome, synthetic summaries and mail.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const password = '기록 브라우저 시험 전용 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Isolated mailbox required')
let cameraCalls = 0
const requests: string[] = []
test.beforeEach(async ({ context }) => {
  cameraCalls = 0
  requests.length = 0
  context.on('request', (request) => requests.push(request.url()))
  await context.exposeBinding('__bodyguardTestCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { __bodyguardTestCamera: () => Promise<void> }
      ).__bodyguardTestCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
})
test.afterEach(async ({ page }) => {
  expect(cameraCalls).toBe(0)
  expect(
    requests.some((url) => /\.glb|\.wasm|pose_landmarker|MeasureDemoPage|mediapipe/.test(url)),
  ).toBe(false)
  expect(requests.every((url) => ['localhost', '127.0.0.1'].includes(new URL(url).hostname))).toBe(
    true,
  )
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
  const email = `records-${randomUUID()}@example.com`
  const signup = await post(context, '/auth/signup', { email, password })
  expect(signup.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  const verified = await post(context, '/auth/verify', {
    challenge_id: (await signup.json()).challenge_id,
    code,
  })
  expect(verified.status()).toBe(201)
}
async function seed(
  context: BrowserContext,
  index = 1,
  outcome: 'completed' | 'interrupted' | 'skipped' = 'interrupted',
  daysAgo = 0,
  long = false,
) {
  const end = new Date(Date.now() - daysAgo * 86400000 - index * 60000)
  const record = {
    id: randomUUID(),
    motion_id: long ? 'fixture-long-'.padEnd(64, 'a') : `fixture-${index}`,
    protocol_version: 'fixture-not-release',
    started_at: new Date(end.getTime() - 90000).toISOString(),
    ended_at: end.toISOString(),
    outcome,
    observed_ms: outcome === 'skipped' ? 0 : 65000,
    repetitions: outcome === 'skipped' ? 0 : 1,
  }
  const result = await post(context, '/records/stretch', record)
  expect(result.status()).toBe(201)
  expect((await result.json()).provenance).toBe('client-reported')
  return record
}
function day(date: Date) {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}
async function filter(page: Page, from: string, to: string) {
  await page.getByLabel('시작일', { exact: true }).fill(from)
  await page.getByLabel('종료일', { exact: true }).fill(to)
  await page.getByRole('button', { name: '기간 조회', exact: true }).click()
}

test('RW-01 protected entry and genuine empty record period', async ({ page, context }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  expect((await context.request.get('/api/v1/records/stretch')).status()).toBe(401)
  await join(context)
  await page.goto('/start')
  await page.getByRole('link', { name: '내 수행 기록 확인' }).click()
  await expect(page.getByRole('heading', { name: '내 수행 기록' })).toBeFocused()
  await expect(
    page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('records-empty.png'), fullPage: true })
  await page.getByRole('link', { name: '스트레칭 시작 경로 선택' }).click()
  await expect(page.getByRole('heading', { name: '스트레칭 시작 경로' })).toBeVisible()
  expect(errors).toEqual([])
})
test('RW-02 actual summaries, detail, Back period and long record narrow layout', async ({
  page,
  context,
}, info) => {
  await join(context)
  const record = await seed(context, 1, 'completed', 0, true)
  await seed(context, 2, 'skipped')
  await seed(context, 3, 'interrupted')
  await page.goto('/records')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(4)
  await expect(page.getByText('완료', { exact: true })).toBeVisible()
  await expect(page.getByText('건너뜀', { exact: true })).toBeVisible()
  await expect(page.getByText('중단', { exact: true })).toBeVisible()
  const original = await page.getByLabel('시작일').inputValue()
  await page.screenshot({ path: info.outputPath('records-list.png'), fullPage: true })
  await page.setViewportSize({ width: 700, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('records-list-narrow.png'), fullPage: true })
  await page.getByRole('link', { name: new RegExp(`^${record.motion_id}.*기록 상세$`) }).click()
  await expect(page.getByRole('heading', { name: '수행 기록 상세' })).toBeFocused()
  await expect(page.getByText('fixture-not-release', { exact: true })).toBeVisible()
  await expect(page.getByText('1분 5초', { exact: true })).toBeVisible()
  await expect(page.getByText('1회', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('record-detail-narrow.png'), fullPage: true })
  await page.getByRole('link', { name: '기록 목록으로 돌아가기' }).click()
  await expect(page.getByLabel('시작일')).toHaveValue(original)
  await expect(page.getByRole('table')).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: '수행 기록 상세' })).toBeVisible()
})
test('RW-03 actual period filter and invalid input recovery', async ({ page, context }, info) => {
  await join(context)
  const historical = await seed(context, 7, 'interrupted', 14)
  await seed(context)
  await page.goto('/records')
  await expect(page.getByRole('link', { name: /^fixture-1 .*기록 상세/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toHaveCount(0)
  const old = day(new Date(historical.ended_at))
  await filter(page, old, old)
  await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /^fixture-1 .*기록 상세/ })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('records-period.png'), fullPage: true })
  const tomorrowFromOld = new Date(historical.ended_at)
  tomorrowFromOld.setDate(tomorrowFromOld.getDate() + 1)
  await filter(page, day(tomorrowFromOld), old)
  await expect(page.getByRole('alert')).toContainText('올바른 날짜')
  await filter(page, old, old)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toBeVisible()
})
test('RW-04 actual bounded pagination uses one cutoff and keyboard', async ({
  page,
  context,
}, info) => {
  await join(context)
  for (let i = 1; i <= 21; i++) await seed(context, i)
  await page.goto('/records')
  await expect(page.getByRole('row')).toHaveCount(21)
  const first = await page
    .locator('tbody a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  const firstRequest = requests.find((url) => url.includes('/api/v1/records/stretch?'))
  await page.getByRole('button', { name: '다음 페이지' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.locator('.records-results h2')).toBeFocused()
  await expect(page.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  const next = await page.locator('tbody a').getAttribute('href')
  expect(first).not.toContain(next)
  const secondRequest = requests.find((url) => url.includes('offset=20'))
  expect(new URL(firstRequest as string).searchParams.get('end')).toBe(
    new URL(secondRequest as string).searchParams.get('end'),
  )
  await page.screenshot({ path: info.outputPath('records-page-two.png'), fullPage: true })
  await page.getByRole('button', { name: '이전 페이지' }).click()
  await expect(page.getByRole('row')).toHaveCount(21)
})
test('RW-05 read failure recovery and cancelled late response after real logout', async ({
  page,
  context,
}, info) => {
  await join(context)
  await seed(context)
  await page.route('**/api/v1/records/stretch?**', (route) => route.abort('failed'))
  await page.goto('/records')
  await expect(page.getByRole('heading', { name: '기록을 불러오지 못했습니다' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('records-read-error.png'), fullPage: true })
  await page.unroute('**/api/v1/records/stretch?**')
  await page.getByRole('button', { name: '다시 조회' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  let release: () => void = () => {}
  let actualRead = false
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/records/stretch?**', async (route) => {
    const response = await route.fetch()
    actualRead = true
    await held
    try {
      await route.fulfill({ response })
    } catch {
      /* aborted by account recheck */
    }
  })
  try {
    await page.reload()
    await expect.poll(() => actualRead).toBe(true)
    await expect(page.getByText('기록을 불러오고 있습니다.')).toBeVisible()
    await page.screenshot({ path: info.outputPath('records-loading.png'), fullPage: true })
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    release()
    await expect(page.getByRole('table')).toHaveCount(0)
  } finally {
    release()
  }
})
test('RW-06 own-only detail, second account and Back after logout', async ({
  page,
  context,
}, info) => {
  await join(context)
  const record = await seed(context)
  await page.goto(`/records/${record.id}`)
  await expect(page.getByText('fixture-not-release', { exact: true })).toBeVisible()
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  await page.goBack()
  await expect(page.getByText('fixture-not-release', { exact: true })).toHaveCount(0)
  await join(context)
  await page.goto('/records')
  await expect(
    page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }),
  ).toBeVisible()
  const foreign = await context.request.get(`/api/v1/records/stretch/${record.id}`)
  expect(foreign.status()).toBe(404)
  await page.goto(`/records/${record.id}`)
  await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
  await expect(page.getByText('fixture-not-release', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('record-unavailable.png'), fullPage: true })
  await page.goto('/records/not-an-id')
  await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
})
