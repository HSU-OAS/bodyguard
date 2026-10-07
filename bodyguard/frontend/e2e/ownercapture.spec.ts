// FR-U-04/FR-R-03: real Chrome/API/SQL, synthetic mail/authority object/summary only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { prepareOwnerProbe } from './fixtures/recordOwnerProbe'

const origin = 'http://localhost:4173'
const password = '소유 캡처 브라우저 시험 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_OWNER_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle?.startsWith('/private/tmp/bodyguard-record-capture-proof.') ||
  !bundle.endsWith('/browser-probe')
)
  throw new Error('Isolated owner probe required')
type Probe = ReturnType<typeof prepareOwnerProbe>
type PrivateWindow = Window & { ownerProbe: Probe }
let posts = 0
let external = 0
let cameras = 0
let writeStatuses: number[] = []
test.beforeEach(async ({ context, page }) => {
  posts = 0
  external = 0
  cameras = 0
  writeStatuses = []
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/records/stretch' && request.method() === 'POST') posts++
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      /\.glb|\.wasm|mediapipe/.test(url.pathname)
    )
      external++
  })
  context.on('response', (response) => {
    if (
      new URL(response.url()).pathname === '/api/v1/records/stretch' &&
      response.request().method() === 'POST'
    )
      writeStatuses.push(response.status())
  })
  await page.route('**/__private-owner-probe.js', (route) =>
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
test.afterEach(async ({ page }) => {
  expect(external).toBe(0)
  expect(cameras).toBe(0)
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
  const email = `owner-${randomUUID()}@example.com`
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
async function prepare(page: Page, context: BrowserContext) {
  const user = await (await context.request.get('/api/v1/me')).json()
  await page.evaluate(
    async (options) => {
      const path = '/__private-owner-probe.js'
      const module = (await import(path)) as { prepareOwnerProbe: typeof prepareOwnerProbe }
      ;(window as unknown as PrivateWindow).ownerProbe = module.prepareOwnerProbe(options)
    },
    {
      authority: { status: 'ready' as const, user },
      recordId: randomUUID(),
      startedUtcAt: new Date(Date.now() - 1000).toISOString(),
    },
  )
}
test('O05 real me/csrf/me captures authority and writes own record without exporting proof', async ({
  page,
  context,
}, info) => {
  await join(context)
  await page.goto('/start')
  await prepare(page, context)
  await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.wait())
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.state()),
  ).toEqual({
    captured: true,
    failed: false,
    active: true,
    writer: { status: 'idle', failure: null },
  })
  expect(posts).toBe(0)
  await page.evaluate(async () => (window as unknown as PrivateWindow).ownerProbe.submit())
  expect(writeStatuses).toEqual([201])
  await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.close())
  await page.goto('/records')
  await expect(page.getByRole('link', { name: /^fixture-not-release .*기록 상세/ })).toBeVisible()
  await page.screenshot({ path: info.outputPath('owner-record-list.png'), fullPage: true })
})
test('O05 account changes during capture: original ready authority cannot become new server account', async ({
  page,
  context,
}) => {
  const email = await join(context)
  await page.goto('/start')
  await page.route('**/api/v1/auth/csrf', async (route) => {
    const response = await route.fetch()
    expect((await post(context, '/auth/logout')).status()).toBe(204)
    await join(context)
    await route.fulfill({ response })
  })
  await prepare(page, context)
  await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.wait())
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.state()),
  ).toEqual({ captured: false, failed: true, active: false, writer: null })
  expect(posts).toBe(0)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  expect((await post(context, '/auth/login', { email, password })).status()).toBe(200)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
})
test('O05 missed caller account notification still cannot write with captured old proof under new cookie', async ({
  page,
  context,
}) => {
  await join(context)
  await page.goto('/start')
  await prepare(page, context)
  await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.wait())
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await join(context)
  await page.evaluate(async () => (window as unknown as PrivateWindow).ownerProbe.submit())
  expect(writeStatuses).toEqual([403])
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.state()),
  ).toMatchObject({ writer: { status: 'failed', failure: 'session-expired' } })
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.replace())
  expect(
    await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.state()),
  ).toMatchObject({ active: false, writer: null })
  expect(posts).toBe(1)
})
test('O05 abort during held real CSRF closes late capture, with no POST', async ({
  page,
  context,
}) => {
  await join(context)
  await page.goto('/start')
  let entered = false
  let release: (() => void) | undefined
  const held = new Promise<void>((done) => {
    release = done
  })
  await page.route('**/api/v1/auth/csrf', async (route) => {
    const response = await route.fetch()
    entered = true
    await held
    await route.fulfill({ response }).catch(() => {})
  })
  try {
    await prepare(page, context)
    await expect.poll(() => entered).toBe(true)
    await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.abort())
    release?.()
    await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.wait())
    expect(
      await page.evaluate(() => (window as unknown as PrivateWindow).ownerProbe.state()),
    ).toEqual({ captured: false, failed: true, active: false, writer: null })
    expect(posts).toBe(0)
  } finally {
    release?.()
  }
})
