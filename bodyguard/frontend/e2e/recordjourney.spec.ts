// FR-R-01/03/06, FR-U-04/05: actual Chrome/HTTP/SQL, synthetic observation/mail only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { mountRecordJourneyProbe } from './fixtures/recordJourneyProbe'

const origin = 'http://localhost:4173',
  mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_RECORD_JOURNEY_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle ||
  !/^\/private\/tmp\/bodyguard-record-journey\.[A-Za-z0-9]+\/browser-probe$/.test(bundle)
)
  throw new Error('Owned record journey probe required')
type ProbeWindow = Window & {
  recordJourney: ReturnType<typeof mountRecordJourneyProbe>
  heldUpload?: Promise<boolean>
}
const anchor = new Date()
anchor.setUTCDate(anchor.getUTCDate() - 2)
anchor.setUTCHours(12, 0, 0, 0)
const date = anchor.toISOString().slice(0, 10),
  utc = anchor.toISOString()
const query = { date, period: 'day' as const, timezone: 'UTC' }
const password = '연속 기록 격리 시험 비밀번호 12345'
let cameras = 0,
  external = 0,
  errors = 0,
  uploads = 0,
  deletions = 0
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as ProbeWindow).recordJourney.state())
const read = (page: Page) =>
  page.evaluate(async () => {
    await (window as unknown as ProbeWindow).recordJourney.read()
  })
const observe = (page: Page) =>
  page.evaluate(() => (window as unknown as ProbeWindow).recordJourney.observe())
const upload = (page: Page) =>
  page.evaluate(async () => {
    await (window as unknown as ProbeWindow).recordJourney.upload()
  })
async function prepare(page: Page, instant = utc) {
  await page.evaluate(async (value) => {
    await (window as unknown as ProbeWindow).recordJourney.prepare(value)
  }, instant)
}
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `record-journey-${randomUUID()}@example.com`
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
async function mount(page: Page) {
  await page.evaluate(async (value) => {
    const path = '/__private-record-journey-probe.js'
    const module = (await import(path)) as {
      mountRecordJourneyProbe: typeof mountRecordJourneyProbe
    }
    ;(window as unknown as ProbeWindow).recordJourney = module.mountRecordJourneyProbe(value)
  }, query)
  await expect.poll(async () => (await state(page)).auth).toBe('ready')
}
async function records(page: Page) {
  await page.evaluate(() => (window as unknown as ProbeWindow).recordJourney.unmount())
  await page.goto(`/posture-records?from=${date}&to=${date}`)
  await expect(page.getByRole('heading', { name: '내 자세 기록', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '삭제 대상 확인', exact: true })).toBeVisible()
  await mount(page)
}
const rows = (context: BrowserContext) =>
  context.request
    .get('/api/v1/summaries')
    .then((r) => r.json())
    .then((r) => r.items)
const table = (page: Page) => page.getByRole('table', { name: '분별 평균 편차와 전체 측정 시간' })
async function preview(page: Page, count: number) {
  await page.getByRole('button', { name: '삭제 대상 확인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '자세 기록 삭제 확인' })).toBeVisible()
  await expect(page.getByText(`삭제 대상 ${count}건`, { exact: true })).toBeVisible()
}
test.beforeEach(async ({ context, page }) => {
  cameras = external = errors = uploads = deletions = 0
  page.on('pageerror', () => errors++)
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.wasm|\.task|mediapipe/i.test(url.pathname)) external++
    if (url.pathname === '/api/v1/summaries/batch' && request.method() === 'POST') uploads++
    if (url.pathname === '/api/v1/summaries/delete' && request.method() === 'POST') deletions++
  })
  await context.exposeBinding('__unexpectedJourneyCamera', () => cameras++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { __unexpectedJourneyCamera(): Promise<void> }
      ).__unexpectedJourneyCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  await page.route('**/__private-record-journey-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
  await join(context)
  await page.goto('/start')
  await mount(page)
})
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('record-journey-boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualChromeProviderAggregationHttpSqlAndExistingRecordUi: true,
        syntheticAccountsMailIntervals: true,
        actualBodyAvatarClinical: false,
        cameras,
        external,
        errors,
        uploads,
        deletions,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
  })
  expect(cameras + external + errors).toBe(0)
  expect(storage).toEqual([0, 0])
})

test('RJ-W01 observation→upload→owned query→detail→cancel→confirmed delete→empty', async ({
  page,
  context,
  browser,
}, info) => {
  await prepare(page)
  await upload(page)
  expect(uploads).toBe(0)
  await read(page)
  expect(await state(page)).toMatchObject({ minutes: 0, provenance: 'client-reported' })
  await observe(page)
  await observe(page)
  await upload(page)
  await read(page)
  expect(await state(page)).toMatchObject({
    minutes: 2,
    totals: { coverage_sec: 120, measured_sec: 60, unmeasurable_sec: 60, any_bad_sec: 60 },
  })
  const saved = await rows(context)
  expect(saved).toHaveLength(2)
  expect(saved[0]).toMatchObject({
    neck: { dev_mean: null, measured_sec: 0 },
    shoulder: { dev_mean: 1.25, measured_sec: 30, bad_sec: 30 },
    provenance: 'client-reported',
  })
  const other = await browser.newContext({
    baseURL: origin,
    proxy: {
      server: process.env.BODYGUARD_TEST_BLOCKED_PROXY as string,
      bypass: 'localhost,127.0.0.1,[::1]',
    },
  })
  try {
    await join(other)
    const { created_at: _created, provenance: _provenance, ...input } = saved[0]
    expect((await post(other, '/summaries/batch', { items: [input] })).status()).toBe(201)
    await records(page)
    await expect(table(page).locator('tbody tr')).toHaveCount(2)
    await table(page).getByRole('button').first().click()
    const detail = page.getByRole('table', { name: '선택한 분의 부위별 측정 지표' })
    await expect(detail.getByRole('row', { name: /목/ })).toContainText('—')
    await expect(detail.getByRole('row', { name: /어깨/ })).toContainText('100%')
    await page.screenshot({ path: info.outputPath('saved-record-detail.png'), fullPage: true })
    await preview(page, 2)
    await page.getByRole('button', { name: '취소', exact: true }).click()
    expect(deletions).toBe(0)
    await read(page)
    expect((await state(page)).minutes).toBe(2)
    await preview(page, 2)
    await page.getByRole('button', { name: '확인한 자세 기록 삭제', exact: true }).click()
    await expect(page.locator('.record-deletion [role="status"]')).toContainText(
      '2건을 삭제했습니다',
    )
    expect(deletions).toBe(1)
    await page.getByRole('button', { name: '기간 다시 조회', exact: true }).click()
    await expect(page.getByText('이 기간에는 자세 기록이 없습니다', { exact: true })).toBeVisible()
    await read(page)
    expect((await state(page)).minutes).toBe(0)
    expect(await rows(context)).toHaveLength(0)
    expect(await rows(other)).toHaveLength(1)
    await page.screenshot({ path: info.outputPath('deleted-record-empty.png'), fullPage: true })
  } finally {
    await other.close()
  }
})
test('RJ-W02 lost accepted upload and delete responses reconcile only by explicit actions', async ({
  page,
  context,
}) => {
  await prepare(page)
  await observe(page)
  const bodies: string[] = [],
    statuses: number[] = []
  await page.route('**/api/v1/summaries/batch', async (route) => {
    bodies.push(route.request().postData() as string)
    const response = await route.fetch()
    statuses.push(response.status())
    if (bodies.length === 1) await route.abort('connectionreset')
    else await route.fulfill({ response })
  })
  await upload(page)
  expect((await state(page)).upload).toMatchObject({ status: 'uncertain', queuedMinutes: 1 })
  await read(page)
  expect((await state(page)).minutes).toBe(1)
  await upload(page)
  expect(bodies).toHaveLength(1)
  await page.evaluate(async () => {
    await (window as unknown as ProbeWindow).recordJourney.retry()
  })
  expect(statuses).toEqual([201, 200])
  expect(bodies[0]).toBe(bodies[1])
  expect(await rows(context)).toHaveLength(1)
  await records(page)
  await preview(page, 1)
  await page.route('**/api/v1/summaries/delete', async (route) => {
    expect((await route.fetch()).status()).toBe(200)
    await route.abort('connectionreset')
  })
  await page.getByRole('button', { name: '확인한 자세 기록 삭제', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('삭제 결과를 확인하지 못했습니다')
  expect(deletions).toBe(1)
  await page.getByRole('button', { name: '기간 다시 조회', exact: true }).click()
  await expect(page.getByText('이 기간에는 자세 기록이 없습니다', { exact: true })).toBeVisible()
  await read(page)
  expect((await state(page)).minutes).toBe(0)
  expect(deletions).toBe(1)
})
test('RJ-W03 account replacement discards queued observations before a new owner writes', async ({
  page,
  context,
}) => {
  await prepare(page)
  await observe(page)
  expect((await state(page)).upload).toMatchObject({ queuedMinutes: 1 })
  await page.evaluate(() => (window as unknown as ProbeWindow).recordJourney.signOut())
  await expect.poll(async () => (await state(page)).auth).toBe('guest')
  await join(context)
  await page.evaluate(() => (window as unknown as ProbeWindow).recordJourney.refresh())
  await expect.poll(async () => (await state(page)).auth).toBe('ready')
  await upload(page)
  expect(uploads).toBe(0)
  expect((await state(page)).upload).toMatchObject({ status: 'closed', queuedMinutes: 0 })
  await read(page)
  expect((await state(page)).minutes).toBe(0)
  await prepare(page)
  await observe(page)
  await upload(page)
  await read(page)
  expect((await state(page)).minutes).toBe(1)
  await records(page)
  await expect(table(page).locator('tbody tr')).toHaveCount(1)
})
test('RJ-W04 a minute uploaded after preview survives the earlier confirmed deletion', async ({
  page,
  context,
}) => {
  await prepare(page)
  await observe(page)
  await upload(page)
  await records(page)
  await preview(page, 1)
  await prepare(page, new Date(anchor.getTime() + 60000).toISOString())
  await observe(page)
  await upload(page)
  await read(page)
  expect((await state(page)).minutes).toBe(2)
  await page.getByRole('button', { name: '확인한 자세 기록 삭제', exact: true }).click()
  await expect(page.locator('.record-deletion [role="status"]')).toContainText('1건을 삭제했습니다')
  await page.getByRole('button', { name: '기간 다시 조회', exact: true }).click()
  await expect(table(page).locator('tbody tr')).toHaveCount(1)
  await read(page)
  expect((await state(page)).minutes).toBe(1)
  const saved = await rows(context)
  expect(saved).toHaveLength(1)
  expect(Date.parse(saved[0].minute_start)).toBe(anchor.getTime() + 60000)
})
test('RJ-W05 an old accepted response cannot restore upload state after owner replacement', async ({
  page,
  context,
  browser,
}) => {
  const originalEmail = (await (await context.request.get('/api/v1/me')).json()).email
  await prepare(page)
  await observe(page)
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
  let first = true
  await page.route('**/api/v1/summaries/batch', async (route) => {
    const response = await route.fetch()
    if (first) {
      first = false
      expect(response.status()).toBe(201)
      arrived()
      await held
      await route.fulfill({ response })
      finished()
    } else await route.fulfill({ response })
  })
  await page.evaluate(() => {
    const target = window as unknown as ProbeWindow
    target.heldUpload = target.recordJourney.upload()?.then(() => true)
  })
  await captured
  await page.evaluate(() => (window as unknown as ProbeWindow).recordJourney.signOut())
  await join(context)
  await page.evaluate(() => (window as unknown as ProbeWindow).recordJourney.refresh())
  await expect.poll(async () => (await state(page)).auth).toBe('ready')
  await prepare(page)
  await observe(page)
  await upload(page)
  release()
  await fulfilled
  await page.evaluate(async () => {
    await (window as unknown as ProbeWindow).heldUpload
  })
  await read(page)
  expect(await state(page)).toMatchObject({
    auth: 'ready',
    minutes: 1,
    upload: { status: 'ready', queuedMinutes: 0 },
  })
  const original = await browser.newContext({
    baseURL: origin,
    proxy: {
      server: process.env.BODYGUARD_TEST_BLOCKED_PROXY as string,
      bypass: 'localhost,127.0.0.1,[::1]',
    },
  })
  try {
    expect((await post(original, '/auth/login', { email: originalEmail, password })).status()).toBe(
      200,
    )
    expect(await rows(original)).toHaveLength(1)
    expect(await rows(context)).toHaveLength(1)
  } finally {
    await original.close()
  }
})
