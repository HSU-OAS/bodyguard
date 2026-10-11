// FR-M-03/FR-U-04: actual Chrome/HTTP/SQL; synthetic accounts/mail and metric values.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { baselineClientProbe } from './fixtures/baselineClientProbe'

const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_BASELINE_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle?.startsWith('/private/tmp/bodyguard-baseline-client.') ||
  !bundle.endsWith('/probe')
)
  throw new Error('Owned baseline proof required')
type Probe = Awaited<ReturnType<typeof baselineClientProbe>>
type PrivateWindow = Window & { baseline: Probe }
const input = () => ({
  id: randomUUID(),
  client_version: 'Fixture+V1',
  neck: null,
  trunk: null,
  shoulder: { method: 'fixture-shoulder', unit: 'deg', value: 1.25 },
})
const password = '기준선 연결 시험 전용 비밀번호 12345'
let external = 0,
  posts = 0
test.beforeEach(async ({ context, page }) => {
  external = 0
  posts = 0
  context.on('request', (r) => {
    const u = new URL(r.url())
    if (
      !['localhost', '127.0.0.1'].includes(u.hostname) ||
      /\.glb|\.wasm|mediapipe/.test(u.pathname)
    )
      external++
    if (u.pathname === '/api/v1/baselines' && r.method() === 'POST') posts++
  })
  await page.route('**/__private-baseline-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
})
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('boundaries.json', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        actualChromeHttpSql: true,
        actualBodyCalibration: false,
        realMail: false,
        external,
        posts,
        storage,
      }),
    ),
  })
  expect(external).toBe(0)
  expect(storage).toEqual([0, 0])
})
async function post(context: BrowserContext, path: string, data?: unknown) {
  const proof = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: 'http://localhost:4173', 'X-CSRF-Token': proof.csrf_token },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `baseline-${randomUUID()}@example.com`
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
async function prepare(page: Page, context: BrowserContext) {
  const user = await (await context.request.get('/api/v1/me')).json()
  await page.goto('/start')
  await page.evaluate(async (user) => {
    const path = '/__private-baseline-probe.js'
    const module = (await import(path)) as { baselineClientProbe: typeof baselineClientProbe }
    ;(window as unknown as PrivateWindow).baseline = await module.baselineClientProbe({
      status: 'ready',
      user,
    })
  }, user)
}
test('save, replacement, immutable history/retry, conflict and other-account separation', async ({
  page,
  context,
}) => {
  await join(context)
  await prepare(page, context)
  expect(
    await page.evaluate(() =>
      (window as unknown as PrivateWindow).baseline.active(new AbortController().signal),
    ),
  ).toBeNull()
  const first = input(),
    second = input()
  const saved = await page.evaluate(
    (body) =>
      (window as unknown as PrivateWindow).baseline.save(body, new AbortController().signal),
    first,
  )
  expect(saved.is_active).toBe(true)
  await page.evaluate(
    (body) =>
      (window as unknown as PrivateWindow).baseline.save(body, new AbortController().signal),
    second,
  )
  const retry = await page.evaluate(
    (body) =>
      (window as unknown as PrivateWindow).baseline.save(body, new AbortController().signal),
    first,
  )
  expect(retry.created_at).toBe(saved.created_at)
  expect(retry.is_active).toBe(false)
  expect(
    (
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).baseline.active(new AbortController().signal),
      )
    )?.id,
  ).toBe(second.id)
  expect(
    (
      await page.evaluate(
        (id) =>
          (window as unknown as PrivateWindow).baseline.detail(id, new AbortController().signal),
        first.id,
      )
    ).is_active,
  ).toBe(false)
  expect(
    await page.evaluate(
      async (body) => {
        try {
          await (window as unknown as PrivateWindow).baseline.save(
            body,
            new AbortController().signal,
          )
          return 0
        } catch (e) {
          return (e as { status: number }).status
        }
      },
      { ...first, client_version: 'different' },
    ),
  ).toBe(409)
  expect(posts).toBe(4)
  // Existing browser account API, not a provider login. New account sees none of A's snapshots.
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await join(context)
  await prepare(page, context)
  expect(
    await page.evaluate(() =>
      (window as unknown as PrivateWindow).baseline.active(new AbortController().signal),
    ),
  ).toBeNull()
  expect((await context.request.get(`/api/v1/baselines/${first.id}`)).status()).toBe(404)
})
test('server accepted response is lost: explicit same-ID retry makes only one snapshot', async ({
  page,
  context,
}) => {
  await join(context)
  await prepare(page, context)
  let dropped = false
  await page.route('**/api/v1/baselines', async (route) => {
    if (route.request().method() !== 'POST' || dropped) return route.continue()
    dropped = true
    const response = await route.fetch()
    expect(response.status()).toBe(201)
    await route.abort('failed')
  })
  const body = input()
  expect(
    await page.evaluate(async (body) => {
      try {
        await (window as unknown as PrivateWindow).baseline.save(body, new AbortController().signal)
        return 0
      } catch (e) {
        return (e as { status: number }).status
      }
    }, body),
  ).toBe(503)
  await prepare(page, context)
  const saved = await page.evaluate(
    (body) =>
      (window as unknown as PrivateWindow).baseline.save(body, new AbortController().signal),
    body,
  )
  expect(saved.id).toBe(body.id)
  expect(posts).toBe(2)
})
test('cookie account changes silently: original read and save authority cannot transfer', async ({
  page,
  context,
  browser,
}) => {
  await join(context)
  await prepare(page, context)
  const other = await browser.newContext({ baseURL: 'http://localhost:4173' })
  try {
    await join(other)
    const original = await context.cookies()
    await context.clearCookies()
    await context.addCookies(await other.cookies())
    expect(
      await page.evaluate(async () => {
        try {
          await (window as unknown as PrivateWindow).baseline.active(new AbortController().signal)
          return 0
        } catch (e) {
          return (e as { status: number }).status
        }
      }),
    ).toBe(403)
    await context.clearCookies()
    await context.addCookies(original)
    await prepare(page, context)
    await context.clearCookies()
    await context.addCookies(await other.cookies())
    expect(
      await page.evaluate(async (body) => {
        try {
          await (window as unknown as PrivateWindow).baseline.save(
            body,
            new AbortController().signal,
          )
          return 0
        } catch (e) {
          return (e as { status: number }).status
        }
      }, input()),
    ).toBe(403)
    expect((await other.request.get('/api/v1/baselines/active')).status()).toBe(200)
    expect(await (await other.request.get('/api/v1/baselines/active')).json()).toBeNull()
  } finally {
    await other.close()
  }
})
