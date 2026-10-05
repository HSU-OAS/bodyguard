// FR-R-03/FR-U-04: actual Chrome/HTTP/SQL, synthetic engine observations and mail only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { prepareResultProbe } from './fixtures/resultRecordProbe'

const origin = 'http://localhost:4173'
const password = '기록 연결 브라우저 시험 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_RESULT_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle?.startsWith('/private/tmp/bodyguard-result-record-proof.') ||
  !bundle.endsWith('/browser-probe')
)
  throw new Error('Isolated result probe required')
type Probe = Awaited<ReturnType<typeof prepareResultProbe>>
type PrivateWindow = Window & { resultProbe: Probe }
let posts = 0
let writeStatuses: number[] = []
let cameraCalls = 0
let externalCalls = 0
test.beforeEach(async ({ context, page }) => {
  posts = 0
  writeStatuses = []
  cameraCalls = 0
  externalCalls = 0
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/records/stretch' && request.method() === 'POST') posts++
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      /\.glb|\.wasm|mediapipe|pose_landmarker/.test(url.pathname)
    )
      externalCalls++
  })
  context.on('response', (response) => {
    if (
      new URL(response.url()).pathname === '/api/v1/records/stretch' &&
      response.request().method() === 'POST'
    )
      writeStatuses.push(response.status())
  })
  await page.route('**/__private-result-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
  await context.exposeBinding('__unexpectedCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __unexpectedCamera(): Promise<void> }).__unexpectedCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
})
test.afterEach(async ({ page }) => {
  expect(cameraCalls).toBe(0)
  expect(externalCalls).toBe(0)
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
  const email = `result-${randomUUID()}@example.com`
  const signup = await post(context, '/auth/signup', { email, password })
  expect(signup.status()).toBe(202)
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
        challenge_id: (await signup.json()).challenge_id,
        code,
      })
    ).status(),
  ).toBe(201)
  return email
}
async function prepare(
  page: Page,
  context: BrowserContext,
  kind: Parameters<typeof prepareResultProbe>[0]['kind'],
) {
  const csrfProof = (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  const options = {
    kind,
    recordId: randomUUID(),
    startedUtcAt: new Date(Date.now() - 1000).toISOString(),
    csrfProof,
  }
  await page.evaluate(async (supplied) => {
    const path = '/__private-result-probe.js'
    const module = (await import(path)) as { prepareResultProbe: typeof prepareResultProbe }
    ;(window as unknown as PrivateWindow).resultProbe = await module.prepareResultProbe(supplied)
  }, options)
  return page.evaluate(() => {
    const probe = (window as unknown as PrivateWindow).resultProbe
    return { row: probe.row, before: probe.before, metadata: probe.metadata }
  })
}
test('R06 real completed result saves once, same-content replay is safe and public record detail works', async ({
  page,
  context,
}, info) => {
  await join(context)
  await page.goto('/start')
  const prepared = await prepare(page, context, 'completed')
  expect(prepared.before).toEqual({ status: 'idle', failure: null })
  expect(posts).toBe(0)
  await page.evaluate(async () => {
    const probe = (window as unknown as PrivateWindow).resultProbe
    await Promise.all([probe.submit(), probe.submit()])
  })
  expect(posts).toBe(1)
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.snapshot()),
  ).toEqual({ status: 'saved', failure: null })
  const replay = await post(context, '/records/stretch', prepared.row)
  expect(replay.status()).toBe(200)
  const conflict = await post(context, '/records/stretch', { ...prepared.row, observed_ms: 99 })
  expect(conflict.status()).toBe(409)
  await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.close())
  await page.goto('/records')
  await page.getByRole('link', { name: /^fixture-not-release .*기록 상세/ }).click()
  await expect(page.getByRole('heading', { name: '수행 기록 상세' })).toBeVisible()
  await expect(page.getByText('완료', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('result-record-detail.png'), fullPage: true })
  await info.attach('result-metadata.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify(
        {
          ...prepared.metadata,
          record_outcome: prepared.row.outcome,
          observed_ms: prepared.row.observed_ms,
          repetitions: prepared.row.repetitions,
          duplicate_browser_posts: posts,
        },
        null,
        2,
      ),
    ),
  })
})
test('R06 partial skip and pause/resume preserve performed time; entire skip alone is skipped', async ({
  page,
  context,
}, info) => {
  await join(context)
  await page.goto('/start')
  const metadata = []
  for (const kind of ['partial-skip', 'paused-interrupted', 'skipped'] as const) {
    const prepared = await prepare(page, context, kind)
    await page.evaluate(async () => {
      const probe = (window as unknown as PrivateWindow).resultProbe
      await probe.submit()
      probe.close()
    })
    metadata.push({
      ...prepared.metadata,
      kind,
      outcome: prepared.row.outcome,
      observed_ms: prepared.row.observed_ms,
    })
  }
  expect(metadata.map((value) => [value.outcome, value.observed_ms])).toEqual([
    ['interrupted', 100],
    ['interrupted', 40],
    ['skipped', 0],
  ])
  expect(metadata[0].original_outcome).toBe('skipped')
  expect(metadata[0].pending_steps).toBe(1)
  const items = (await (await context.request.get('/api/v1/records/stretch')).json()).items
  expect(items).toHaveLength(3)
  expect(items.every((row: { provenance: string }) => row.provenance === 'client-reported')).toBe(
    true,
  )
  await page.goto('/records')
  await expect(page.getByRole('table')).toBeVisible()
  await info.attach('result-metadata.json', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(metadata, null, 2)),
  })
})
test('R06 stale captured proof cannot write under a different cookie even if caller misses owner notification', async ({
  page,
  context,
}, info) => {
  const email = await join(context)
  await page.goto('/start')
  await prepare(page, context, 'completed')
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await join(context)
  await page.evaluate(async () => (window as unknown as PrivateWindow).resultProbe.submit())
  expect(writeStatuses).toEqual([403])
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.snapshot()),
  ).toEqual({ status: 'failed', failure: 'session-expired' })
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  await page.evaluate(async () => {
    const probe = (window as unknown as PrivateWindow).resultProbe
    probe.changeOwner()
    await probe.retry()
  })
  expect(posts).toBe(1)
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.snapshot()),
  ).toEqual({ status: 'closed', failure: 'ownership-error' })
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  expect((await post(context, '/auth/login', { email, password })).status()).toBe(200)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  await info.attach('result-metadata.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        stale_cookie_write_status: 403,
        new_account_rows: 0,
        original_account_rows: 0,
        post_owner_change_retry_posts: 0,
        human_accuracy_verified: false,
      }),
    ),
  })
})
test('R06 accepted write with lost response retries explicitly without duplicating SQL record', async ({
  page,
  context,
}, info) => {
  await join(context)
  await page.goto('/start')
  await prepare(page, context, 'completed')
  let loseResponse = true
  await page.route('**/api/v1/records/stretch', async (route) => {
    if (route.request().method() !== 'POST' || !loseResponse) {
      await route.continue()
      return
    }
    loseResponse = false
    const accepted = await route.fetch()
    expect(accepted.status()).toBe(201)
    await route.abort('failed')
  })
  await page.evaluate(async () => (window as unknown as PrivateWindow).resultProbe.submit())
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.snapshot()),
  ).toEqual({ status: 'failed', failure: 'network' })
  expect(posts).toBe(1)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    1,
  )
  await page.evaluate(async () => (window as unknown as PrivateWindow).resultProbe.retry())
  expect(posts).toBe(2)
  expect(writeStatuses).toEqual([200])
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.snapshot()),
  ).toEqual({ status: 'saved', failure: null })
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    1,
  )
  await info.attach('result-metadata.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        lost_response_server_status: 201,
        explicit_retry_status: 200,
        sql_rows: 1,
        automatic_retry: false,
        synthetic_only: true,
      }),
    ),
  })
})
test('R06 delayed accepted response cannot reopen writer after session lease disposal', async ({
  page,
  context,
}, info) => {
  const email = await join(context)
  await page.goto('/start')
  await prepare(page, context, 'completed')
  let accepted = false
  let release: (() => void) | undefined
  const held = new Promise<void>((done) => {
    release = done
  })
  await page.route('**/api/v1/records/stretch', async (route) => {
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    accepted = true
    await held
    await route.fulfill({ response }).catch(() => {})
  })
  const pending = page.evaluate(async () =>
    (window as unknown as PrivateWindow).resultProbe.submit(),
  )
  try {
    await expect.poll(() => accepted).toBe(true)
    await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.changeOwner())
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    await join(context)
    release?.()
    await pending
    expect(
      await page.evaluate(() => (window as unknown as PrivateWindow).resultProbe.snapshot()),
    ).toEqual({ status: 'closed', failure: 'ownership-error' })
    expect(
      (await (await context.request.get('/api/v1/records/stretch')).json()).items,
    ).toHaveLength(0)
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    expect((await post(context, '/auth/login', { email, password })).status()).toBe(200)
    expect(
      (await (await context.request.get('/api/v1/records/stretch')).json()).items,
    ).toHaveLength(1)
    await info.attach('result-metadata.json', {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({
          accepted_before_disposal: true,
          rollback_claimed: false,
          closed_after_late_response: true,
          original_account_rows: 1,
          other_account_rows: 0,
          synthetic_only: true,
        }),
      ),
    })
  } finally {
    release?.()
    await pending
  }
})
