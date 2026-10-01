// FR-U-01~04: actual Chrome/API/PG/RSA/SDK; external Google consent/HTTPS is mocked.
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const callback = `${origin}/api/v1/auth/google/callback`
const fixtureFile = process.env.BODYGUARD_TEST_GOOGLE_FIXTURE
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (
  !fixtureFile?.startsWith('/private/tmp/bodyguard-browser-') ||
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-')
)
  throw new Error('Run the isolated google browser harness')
let offset = 0,
  cameraCalls = 0,
  externalCalls = 0
let email: string, sub: string, fault: string, cancelled: boolean, lastCallback: string
function fixture(value: unknown) {
  const next = `${fixtureFile}.next`
  writeFileSync(next, JSON.stringify(value), { mode: 0o600 })
  renameSync(next, fixtureFile as string)
}
test.beforeEach(async ({ context }) => {
  offset += 61 // Controlled server clock only; not evidence of a real 60-second wait.
  fixture({ offset_seconds: offset, responses: {} })
  email = `google-${randomUUID()}@example.com`
  sub = `synthetic-${randomUUID()}`
  fault = ''
  cancelled = false
  lastCallback = ''
  cameraCalls = 0
  externalCalls = 0
  await context.exposeBinding('__googleCameraTest', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __googleCameraTest: () => Promise<void> }).__googleCameraTest()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      externalCalls++
      await route.abort()
      return
    }
    if (url.pathname !== '/api/v1/auth/google/login') {
      await route.continue()
      return
    }
    // Route handlers do not intercept every hop of a redirect chain. Capture
    // the real local response with zero automatic redirects before mocking consent.
    const actual = await route.fetch({ maxRedirects: 0 })
    const target = new URL(actual.headers().location)
    if (target.origin === origin) {
      await route.fulfill({ response: actual })
      return
    }
    expect(actual.status()).toBe(303)
    expect(target.origin).toBe('https://accounts.google.com')
    expect(target.pathname).toBe('/o/oauth2/v2/auth')
    const values = target.searchParams
    expect(values.get('redirect_uri')).toBe(callback)
    expect(values.get('scope')).toBe('openid email')
    expect(values.get('code_challenge_method')).toBe('S256')
    const code = randomBytes(32).toString('base64url')
    const saved = JSON.parse(readFileSync(fixtureFile as string, 'utf8'))
    saved.responses[code] = {
      challenge: values.get('code_challenge'),
      nonce: values.get('nonce'),
      sub,
      email,
      fault,
    }
    fixture(saved)
    const query = new URLSearchParams({ state: values.get('state') as string })
    if (cancelled) query.set('error', 'access_denied')
    else query.set('code', code)
    lastCallback = `${callback}?${query}`
    await route.fulfill({ status: 302, headers: { location: lastCallback } })
  })
})
test.afterEach(() => {
  expect(cameraCalls).toBe(0)
  expect(externalCalls).toBe(0)
})
async function start(page: Page, mode = 'login') {
  await page.goto(`/${mode}?next=https%3A%2F%2Fattacker.invalid`)
  const button = page.getByRole('button', { name: 'Google로 계속하기', exact: true })
  await expect(button).toBeEnabled()
  await button.click()
}
async function own(page: Page) {
  await expect(page).toHaveURL('/start')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  const result = await page.request.get('/api/v1/me')
  expect(result.status()).toBe(200)
  return result.json()
}
test('GW-00 browser egress is refused even without route interception', async ({
  page,
  context,
}) => {
  await context.unroute('**/*')
  await expect(page.goto('https://example.invalid')).rejects.toThrow(/ERR_PROXY_CONNECTION_FAILED/)
})
test('GW-02/06 native signup/login, fixed return, keyboard and cookie/storage', async ({
  page,
  context,
}, info) => {
  const errors: string[] = [],
    requests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/signup')
  const button = page.getByRole('button', { name: 'Google로 계속하기', exact: true })
  await expect(button).toBeEnabled()
  await page.screenshot({ path: info.outputPath('google-signup-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 700, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await button.focus()
  await expect(button).toBeFocused()
  await page.screenshot({ path: info.outputPath('google-signup-narrow.png'), fullPage: true })
  await page.keyboard.press('Enter')
  await own(page)
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'bodyguard_session')?.httpOnly,
  ).toBe(true)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  expect(
    requests.some((url) => /\.wasm|pose_landmarker|three|mediapipe|gsi\/client/.test(url)),
  ).toBe(false)
  expect(errors).toEqual([])
})
test('GW-02 repeated sub returns to the same actual account after logout', async ({ page }) => {
  await start(page)
  const first = await own(page)
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await start(page)
  expect((await own(page)).id).toBe(first.id)
})
test('GW-03 cancel is not success; a new native flow can log in', async ({ page }, info) => {
  cancelled = true
  await start(page)
  await expect(page).toHaveURL('/login?google=cancelled')
  await expect(page.getByRole('alert')).toContainText('취소')
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
  await page.screenshot({ path: info.outputPath('google-cancelled.png'), fullPage: true })
  cancelled = false
  await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await own(page)
})
for (const invalid of ['audience-with-azp', 'nonce-bypass']) {
  test(`GW-03 native signed ${invalid} token is rejected`, async ({ page }) => {
    fault = invalid
    await start(page)
    await expect(page).toHaveURL('/login?google=failed')
    await expect(page.getByRole('alert')).toContainText('다시 시도')
    expect((await page.request.get('/api/v1/me')).status()).toBe(401)
    expect(await page.locator('body').textContent()).not.toMatch(
      /synthetic-access-secret|synthetic-client-secret/,
    )
  })
}
test('GW-03 consumed callback replay after logout cannot authenticate', async ({ page }) => {
  await start(page)
  await own(page)
  const used = lastCallback
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto(used)
  await expect(page).toHaveURL('/login?google=failed')
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
})
test('GW-04 existing email account is never linked and original password still logs in', async ({
  page,
  context,
}, info) => {
  const password = '구글 충돌 시험용 비밀번호 12345'
  const csrf = await (await context.request.get(`${origin}/api/v1/auth/csrf`)).json()
  const headers = { Origin: origin, 'X-CSRF-Token': csrf.csrf_token }
  const signup = await context.request.post(`${origin}/api/v1/auth/signup`, {
    headers,
    data: { email, password },
  })
  expect(signup.status()).toBe(202)
  const challenge = (await signup.json()).challenge_id
  const code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email]
  expect(
    (
      await context.request.post(`${origin}/api/v1/auth/verify`, {
        headers,
        data: { challenge_id: challenge, code },
      })
    ).status(),
  ).toBe(201)
  await page.goto('/start')
  const owner = (await own(page)).id
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await start(page)
  await expect(page).toHaveURL('/login?google=account-conflict')
  await expect(page.getByRole('alert')).toContainText('기존 방식')
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
  await page.screenshot({ path: info.outputPath('google-account-conflict.png'), fullPage: true })
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  expect((await own(page)).id).toBe(owner)
})
test('GW-01 status failure/late reply recovers without reviving the previous form', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/google/status', (route) => route.abort())
  await page.goto('/login')
  await expect(page.getByRole('button', { name: '구글 연결 다시 확인' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Google로 계속하기', exact: true })).toBeDisabled()
  await expect(page.getByLabel('이메일', { exact: true })).toBeEnabled()
  await page.unroute('**/api/v1/auth/google/status')
  await page.getByRole('button', { name: '구글 연결 다시 확인' }).click()
  await expect(page.getByRole('button', { name: 'Google로 계속하기', exact: true })).toBeEnabled()
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let entered = false
  await page.route('**/api/v1/auth/google/status', async (route) => {
    entered = true
    const actual = await route.fetch()
    await held
    try {
      await route.fulfill({ response: actual })
    } catch {
      /* navigation cancelled */
    }
  })
  try {
    await page.goto('/signup')
    await expect.poll(() => entered).toBe(true)
    await page.getByRole('link', { name: '서비스 소개로 돌아가기', exact: true }).click()
    release()
    await expect(page.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Google로 계속하기', exact: true })).toHaveCount(
      0,
    )
    expect((await page.request.get('/api/v1/me')).status()).toBe(401)
  } finally {
    release()
  }
})
test('GW-05 actual quota native navigation returns to the usable login page', async ({
  page,
  context,
}) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await context.request.get(`${origin}/api/v1/auth/google/login`, {
      maxRedirects: 0,
    })
    expect(result.status()).toBe(303)
  }
  await page.goto('/login')
  await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect(page).toHaveURL('/login?google=rate-limited')
  await expect(page.getByRole('alert')).toContainText('잠시 후')
  await expect(page.getByLabel('이메일', { exact: true })).toBeEnabled()
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
})
