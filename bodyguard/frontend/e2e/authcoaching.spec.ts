// FR-U-04/FR-R-03/NFR-08: actual AuthProvider/Chrome/API/SQL; clocks/ports/frames/mail synthetic.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { mountAuthCoachingProbe } from './fixtures/authCoachingProbe'

const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_COACHING_AUTH_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle?.startsWith('/private/tmp/bodyguard-coaching-auth-proof.') ||
  !bundle.endsWith('/browser-probe')
)
  throw new Error('Owned auth probe required')
type Probe = ReturnType<typeof mountAuthCoachingProbe>
type PrivateWindow = Window & { authCoachingProbe: Probe }
let posts = 0
let unexpected = 0
test.beforeEach(async ({ context, page }) => {
  posts = 0
  unexpected = 0
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/records/stretch' && request.method() === 'POST') posts++
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      /\.glb|\.wasm|mediapipe/.test(url.pathname)
    )
      unexpected++
  })
  await page.route('**/__private-auth-coaching-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
  await context.exposeBinding('__unexpectedCamera', () => {
    unexpected++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __unexpectedCamera(): Promise<void> }).__unexpectedCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
})
test.afterEach(async ({ page }) => {
  expect(unexpected).toBe(0)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})
async function join(context: BrowserContext) {
  const csrf = async () =>
    (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  const email = `auth-coach-${randomUUID()}@example.com`
  const response = await context.request.post('/api/v1/auth/signup', {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
    data: { email, password: '로그인 코칭 연결 시험 비밀번호 12345' },
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
      await context.request.post('/api/v1/auth/verify', {
        headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
        data: { challenge_id: (await response.json()).challenge_id, code },
      })
    ).status(),
  ).toBe(201)
}
async function mount(page: Page, delayed = false) {
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작', exact: true })).toBeVisible()
  const options = {
    recordId: randomUUID(),
    utc: new Date(Date.now() - 2000).toISOString(),
    delayed,
  }
  await page.evaluate(async (options) => {
    const path = '/__private-auth-coaching-probe.js'
    const module = (await import(path)) as { mountAuthCoachingProbe: typeof mountAuthCoachingProbe }
    ;(window as unknown as PrivateWindow).authCoachingProbe = module.mountAuthCoachingProbe(options)
  }, options)
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.state().auth),
    )
    .toBe('ready')
  return options
}
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.state())
test('H02 actual provider prepares inert; explicit synthetic performance saves to own public record', async ({
  page,
  context,
}, info) => {
  await join(context)
  const data = await mount(page)
  expect(await state(page)).toMatchObject({ hook: 'idle', acquired: 0, owned: false })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  expect(await state(page)).toMatchObject({ hook: 'prepared', acquired: 0, owned: true })
  expect(posts).toBe(0)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.perform())
  expect(await state(page)).toMatchObject({ session: 'ended', acquired: 3, disposed: 3 })
  expect(posts).toBe(0)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  expect(await state(page)).toMatchObject({ record: 'saved' })
  expect(posts).toBe(1)
  const rows = await (await context.request.get('/api/v1/records/stretch')).json()
  expect(rows.items).toHaveLength(1)
  expect(rows.items[0]).toMatchObject({
    id: data.recordId,
    outcome: 'completed',
    observed_ms: 100,
    repetitions: 0,
    provenance: 'client-reported',
  })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  await expect.poll(() => state(page)).toMatchObject({ lifecycleClosed: 1 })
  await page.goto(`/records/${data.recordId}`)
  await expect(page.getByRole('heading', { name: '수행 기록 상세', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('auth-coaching-record.png'), fullPage: true })
})
test('H03 actual same-account refresh revokes old running session; no automatic recreation', async ({
  page,
  context,
}) => {
  await join(context)
  await mount(page)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.refresh())
  await expect
    .poll(() => state(page))
    .toMatchObject({
      auth: 'ready',
      hook: 'idle',
      owned: false,
      session: 'ended',
      disposed: 3,
      lifecycleClosed: 1,
    })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.resume())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  expect(posts).toBe(0)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
})
test('H03 failed logout is not permission to keep coaching or save', async ({ page, context }) => {
  await join(context)
  await mount(page)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  await page.route('**/api/v1/auth/logout', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  )
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.signOut())
  await expect
    .poll(() => state(page))
    .toMatchObject({
      auth: 'logout-error',
      hook: 'idle',
      owned: false,
      disposed: 3,
      lifecycleClosed: 1,
    })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  expect(posts).toBe(0)
  expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
    0,
  )
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
})
test('H04 pagehide during synthetic pending permission reclaims late resource; pageshow never starts', async ({
  page,
  context,
}) => {
  await join(context)
  await mount(page, true)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  await expect.poll(() => state(page)).toMatchObject({ waiting: true, session: 'preparing' })
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  await expect
    .poll(() => state(page))
    .toMatchObject({ hook: 'idle', owned: false, lifecycleClosed: 1 })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.release())
  expect(await state(page)).toMatchObject({ acquired: 1, disposed: 1, session: 'ended' })
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  )
  await expect
    .poll(() => state(page))
    .toMatchObject({ auth: 'ready', hook: 'idle', acquired: 1, disposed: 1, owned: false })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  expect(posts).toBe(0)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
})

test('H05 actual logout succeeds but never permits old session resume or save', async ({
  page,
  context,
}) => {
  await join(context)
  await mount(page)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.signOut())
  await expect
    .poll(() => state(page))
    .toMatchObject({
      auth: 'guest',
      owned: false,
      disposed: 3,
      lifecycleClosed: 1,
    })
  expect((await context.request.get('/api/v1/me')).status()).toBe(401)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.resume())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  expect(posts).toBe(0)
  expect(await state(page)).toMatchObject({ acquired: 3, lifecycleClosed: 1 })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
})

test('H05 actual server revoked account returns 401 and refresh retires the owned lifecycle', async ({
  page,
  context,
}) => {
  await join(context)
  await mount(page)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  const csrf = (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  expect(
    (
      await context.request.post('/api/v1/auth/logout', {
        headers: { Origin: origin, 'X-CSRF-Token': csrf },
      })
    ).status(),
  ).toBe(204)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.refresh())
  await expect
    .poll(() => state(page))
    .toMatchObject({
      auth: 'guest',
      owned: false,
      disposed: 3,
      lifecycleClosed: 1,
    })
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  expect(posts).toBe(0)
  await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
})
