// FR-R-03/FR-U-04: actual UI/classifier/GLB/API/SQL; generated capture/profile and test mail.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173',
  mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned mailbox required')
let bodies: string[], errors: string[], unexpected: number, csrfReads: number
test.beforeEach(async ({ context, page }) => {
  bodies = []
  errors = []
  unexpected = 0
  csrfReads = 0
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.wasm|mediapipe|tasks-vision/.test(url.pathname)) unexpected++
    if (url.pathname === '/api/v1/records/stretch' && request.method() === 'POST')
      bodies.push(request.postData() ?? '')
    if (url.pathname === '/api/v1/auth/csrf') csrfReads++
  })
  page.on('worker', () => unexpected++)
  page.on('pageerror', (error) => errors.push(error.name))
  await context.exposeBinding('unexpectedPhysicalCamera', () => unexpected++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { unexpectedPhysicalCamera(): Promise<void> }
      ).unexpectedPhysicalCamera()
      return Promise.reject(new Error('Forbidden physical camera'))
    }
  })
})
test.afterEach(async ({ page }) => {
  expect(unexpected).toBe(0)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})
async function join(context: BrowserContext) {
  const csrf = async () =>
    (await (await context.request.get(`${origin}/api/v1/auth/csrf`)).json()).csrf_token
  const email = `neck-record-${randomUUID()}@example.com`
  const response = await context.request.post(`${origin}/api/v1/auth/signup`, {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
    data: { email, password: '목 코칭 격리 시험 비밀번호 12345' },
  })
  expect(response.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return /^[0-9]{6}$/.test(code)
    })
    .toBe(true)
  const verified = await context.request.post(`${origin}/api/v1/auth/verify`, {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
    data: { challenge_id: (await response.json()).challenge_id, code },
  })
  expect(verified.status()).toBe(201)
}
const set = (page: Page, value: Partial<Window['neckWorkspaceFixture']>) =>
  page.evaluate((value) => Object.assign(window.neckWorkspaceFixture, value), value)
const status = (page: Page, name: string) =>
  expect(page.getByText(name, { exact: true })).toBeVisible()
async function start(page: Page) {
  await expect(page.getByRole('button', { name: /^(검수 시작|새 검수 시작)$/ })).toBeVisible()
  await set(page, { angle: 0, shoulder: 0, empty: false, head: true, pausedInput: false })
  await page.getByRole('button', { name: /^(검수 시작|새 검수 시작)$/ }).click()
  await status(page, '왼쪽 · 수행')
  expect(bodies).toHaveLength(0)
}
async function complete(page: Page) {
  await set(page, { angle: -0.4 })
  await status(page, '왼쪽 · 복귀')
  await set(page, { angle: 0 })
  await status(page, '오른쪽 · 수행')
  await set(page, { angle: 0.4 })
  await status(page, '오른쪽 · 복귀')
  await set(page, { angle: 0 })
  await expect(page.getByRole('heading', { name: '검수 흐름 완료', exact: true })).toBeFocused()
}
async function endedResources(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const f = window.neckWorkspaceFixture,
          canvas = document.querySelector('canvas')
        return (
          f.cameras === f.stops &&
          f.workers === f.workerStops &&
          canvas?.getContext('webgl2')?.isContextLost() === true
        )
      }),
    )
    .toBe(true)
}
async function save(page: Page) {
  await page.getByRole('button', { name: '시험 기록 저장', exact: true }).click()
  await expect(page.getByText('시험 기록을 저장했습니다.', { exact: true })).toBeFocused()
}
test('N01 actual ended UI saves completed and interrupted summaries; current record detail and other-account isolation', async ({
  page,
  context,
  browser,
}, info) => {
  await join(context)
  await page.goto('/dev/coaching?motion=neck-side')
  await start(page)
  await complete(page)
  await endedResources(page)
  await page.screenshot({ path: info.outputPath('completed-unsaved.png'), fullPage: true })
  await save(page)
  expect(bodies).toHaveLength(1)
  const row = JSON.parse(bodies[0])
  expect(Object.keys(row).sort()).toEqual(
    [
      'id',
      'motion_id',
      'protocol_version',
      'started_at',
      'ended_at',
      'outcome',
      'observed_ms',
      'repetitions',
    ].sort(),
  )
  expect(row).toMatchObject({ motion_id: 'neck-side', outcome: 'completed', repetitions: 0 })
  expect(row.observed_ms).toBeGreaterThanOrEqual(100)
  expect(row.observed_ms).toBeLessThanOrEqual(Date.parse(row.ended_at) - Date.parse(row.started_at))
  await page.screenshot({ path: info.outputPath('completed-saved.png'), fullPage: true })
  await page.getByRole('link', { name: '저장한 시험 기록 보기' }).click()
  await expect(page.getByRole('heading', { name: '수행 기록 상세', exact: true })).toBeVisible()
  await expect(page.getByText('math-neck-v1', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('actual-record-detail.png'), fullPage: true })
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch/${row.id}`)).json())
      .provenance,
  ).toBe('client-reported')
  bodies = []
  await page.goto('/dev/coaching?motion=neck-side')
  await start(page)
  await set(page, { angle: -0.4 })
  await status(page, '왼쪽 · 복귀')
  await page.getByRole('button', { name: '불편하면 중단' }).click()
  await expect(page.getByRole('heading', { name: '불편으로 중단했습니다' })).toBeVisible()
  await endedResources(page)
  await save(page)
  expect(bodies).toHaveLength(1)
  expect(JSON.parse(bodies[0]).outcome).toBe('interrupted')
  const rows = await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()
  expect(rows.items).toHaveLength(2)
  const other = await browser.newContext({ baseURL: origin })
  try {
    await join(other)
    expect((await other.request.get(`${origin}/api/v1/records/stretch/${row.id}`)).status()).toBe(
      404,
    )
    expect(
      (await (await other.request.get(`${origin}/api/v1/records/stretch`)).json()).items,
    ).toHaveLength(0)
  } finally {
    await other.close()
  }
})
test('N02 actual API accepts201 then response loss; explicit identical retry returns200 and only one SQL-backed row', async ({
  page,
  context,
}, info) => {
  await join(context)
  await page.goto('/dev/coaching?motion=neck-side')
  await start(page)
  await complete(page)
  await endedResources(page)
  let accepted = false,
    retried = false
  await page.route('**/api/v1/records/stretch', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    if (!accepted) {
      expect(response.status()).toBe(201)
      accepted = true
      await route.abort('connectionreset')
    } else {
      expect(response.status()).toBe(200)
      retried = true
      await route.fulfill({ response })
    }
  })
  const csrfBefore = csrfReads
  await page.getByRole('button', { name: '시험 기록 저장', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 시험 기록 다시 저장' })).toBeVisible()
  expect(accepted).toBe(true)
  expect(bodies).toHaveLength(1)
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items,
  ).toHaveLength(1)
  await page.screenshot({ path: info.outputPath('accepted-response-loss.png'), fullPage: true })
  await page.getByRole('button', { name: '같은 시험 기록 다시 저장' }).click()
  await expect(page.getByText('시험 기록을 저장했습니다.', { exact: true })).toBeFocused()
  expect(retried).toBe(true)
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toBe(bodies[0])
  expect(csrfReads).toBe(csrfBefore)
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items,
  ).toHaveLength(1)
})
test('N03 female run with silent cookie account replacement rejects old proof403; no retry or cross-account record', async ({
  page,
  context,
  browser,
}, info) => {
  await join(context)
  await page.goto('/dev/coaching?motion=neck-side')
  await page.getByLabel('검수 아바타 형태').selectOption('female')
  await start(page)
  await complete(page)
  await endedResources(page)
  const owner = await browser.newContext({
    baseURL: origin,
    storageState: await context.storageState(),
  })
  try {
    await context.clearCookies()
    await join(context)
    const csrfBefore = csrfReads
    await page.getByRole('button', { name: '시험 기록 저장', exact: true }).click()
    await expect(page.getByRole('button', { name: '계정 다시 확인' })).toBeVisible()
    expect(bodies).toHaveLength(1)
    expect(csrfReads).toBe(csrfBefore)
    await expect(page.getByRole('button', { name: '같은 시험 기록 다시 저장' })).toHaveCount(0)
    expect(
      (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items,
    ).toHaveLength(0)
    expect(
      (await (await owner.request.get(`${origin}/api/v1/records/stretch`)).json()).items,
    ).toHaveLength(0)
    await page.screenshot({ path: info.outputPath('old-proof-rejected.png'), fullPage: true })
    await page.getByRole('button', { name: '계정 다시 확인' }).click()
    await expect(page.getByRole('button', { name: '검수 시작', exact: true })).toBeVisible()
    expect(bodies).toHaveLength(1)
  } finally {
    await owner.close()
  }
})
