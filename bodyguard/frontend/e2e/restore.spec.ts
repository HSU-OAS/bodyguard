// FR-U-04/NFR-08: real Chrome cache/API/SQL; bad wire and mail are synthetic.
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { type BrowserContext, type CDPSession, expect, type Page, test } from '@playwright/test'

declare global {
  interface Window {
    __accountRestoreProbe: {
      document: string
      restored: number
      settled: boolean
      blocked: boolean
      leaks: number
    }
  }
}
const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  process.env.BODYGUARD_TEST_PAGE_RESTORE !== '1'
)
  throw new Error('Owned restore harness required')
let cameraCalls = 0
let unexpected: string[] = []
let errors: string[] = []
test.beforeEach(async ({ page, context }) => {
  cameraCalls = 0
  unexpected = []
  errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname))
      unexpected.push(url.origin + url.pathname)
  })
  await context.exposeBinding('__restoreCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __restoreCamera: () => Promise<void> }).__restoreCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
    const probe = {
      document: crypto.randomUUID(),
      restored: 0,
      settled: false,
      blocked: false,
      leaks: 0,
    }
    window.__accountRestoreProbe = probe
    // Bounded observation: only a fixed selector presence/count, never DOM text or account data.
    const observer = new MutationObserver(() => {
      if (probe.restored && probe.blocked && document.querySelector('.account-email')) probe.leaks++
    })
    observer.observe(document, { subtree: true, childList: true })
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return
      probe.restored++
      probe.settled = false
      setTimeout(() => {
        probe.settled = true
      }, 500)
    })
  })
})
test.afterEach(async ({ page, context }) => {
  expect(cameraCalls).toBe(0)
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
  const protocol = await context.newCDPSession(page)
  try {
    expect(await value(protocol, '[localStorage.length, sessionStorage.length]')).toEqual([0, 0])
  } finally {
    await protocol.detach()
  }
})
// Native cache navigation/readout: Playwright's goBack/load state is not used after restore.
async function value<T>(protocol: CDPSession, expression: string): Promise<T> {
  const response = await protocol.send('Runtime.evaluate', { expression, returnByValue: true })
  expect(Boolean(response.exceptionDetails)).toBe(false)
  return response.result.value as T
}
async function back(page: Page, context: BrowserContext, documentId: string) {
  const protocol = await context.newCDPSession(page)
  try {
    await protocol.send('Page.enable')
    const history = await protocol.send('Page.getNavigationHistory')
    const previous = history.entries[history.currentIndex - 1]
    expect(
      new URL(previous.url).origin === origin && new URL(previous.url).pathname === '/start',
    ).toBe(true)
    await protocol.send('Page.navigateToHistoryEntry', { entryId: previous.id })
    await expect
      .poll(() =>
        value(
          protocol,
          `Boolean(window.__accountRestoreProbe?.document === ${JSON.stringify(documentId)} && window.__accountRestoreProbe.restored === 1)`,
        ),
      )
      .toBe(true)
    return protocol
  } catch (error) {
    await protocol.detach()
    throw error
  }
}
async function post(context: BrowserContext, path: string, data: unknown) {
  const response = await context.request.get('/api/v1/auth/csrf')
  expect(response.status()).toBe(200)
  const csrf = await response.json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `restore-${randomUUID()}@example.com`
  const response = await post(context, '/auth/signup', {
    email,
    password: '캐시 복원 시험 전용 비밀번호 12345',
  })
  expect(response.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return /^[0-9]{6}$/.test(code)
    })
    .toBe(true)
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

for (const status of [200, 503]) {
  test(`AR-WEB actual cached failed-logout${status} stays blocked then retry204`, async ({
    page,
    context,
  }, info) => {
    const email = await join(context)
    await page.goto('/start')
    await expect(page.getByText(email, { exact: true })).toBeVisible()
    const old = (await context.cookies()).find((cookie) => cookie.name === 'bodyguard_session')
    expect(Boolean(old?.httpOnly)).toBe(true)
    await page.route('**/api/v1/auth/logout', (route) =>
      route.fulfill({ status, json: { logged_out: true } }),
    )
    await page.getByRole('button', { name: '로그아웃', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: '로그아웃을 확인하지 못했습니다' }),
    ).toBeVisible()
    expect((await context.request.get('/api/v1/me')).status()).toBe(200)
    await page.unroute('**/api/v1/auth/logout')
    const documentId = await page.evaluate(() => {
      window.__accountRestoreProbe.blocked = true
      return window.__accountRestoreProbe.document
    })
    await page.goto('/help')
    expect(
      await page.evaluate((id) => window.__accountRestoreProbe.document !== id, documentId),
    ).toBe(true)
    const protocol = await back(page, context, documentId)
    try {
      const sameDocument = true
      await expect.poll(() => value(protocol, 'window.__accountRestoreProbe.settled')).toBe(true)
      const observation = await value<{ nativePersistedRestores: number; leaks: number }>(
        protocol,
        '({nativePersistedRestores: window.__accountRestoreProbe.restored, leaks: window.__accountRestoreProbe.leaks})',
      )
      const emailVisible = await value<boolean>(
        protocol,
        'Boolean(document.querySelector(".account-email")?.getClientRects().length)',
      )
      await info.attach('restored-boundary.json', {
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify({
            statusInjected: status,
            sameDocument,
            ...observation,
            emailVisible,
            observationWindowMs: 500,
            actualWebHttpSql: true,
            actualCache: true,
            actualCamera: false,
            cameraCalls,
            unexpected,
            errors,
            browserVersion: context.browser()?.version(),
          }),
        ),
      })
      const screenshot = await protocol.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(info.outputPath('restored-page.png'), Buffer.from(screenshot.data, 'base64'), {
        flag: 'wx',
      })
      expect(observation.leaks).toBe(0)
      expect(
        await value(
          protocol,
          'document.querySelector("main h1")?.textContent === "로그아웃을 확인하지 못했습니다"',
        ),
      ).toBe(true)
      expect(emailVisible).toBe(false)
      let confirmed = false
      protocol.on('Network.responseReceived', (event) => {
        if (
          new URL(event.response.url).pathname === '/api/v1/auth/logout' &&
          event.response.status === 204
        )
          confirmed = true
      })
      await protocol.send('Network.enable')
      await value(
        protocol,
        'Array.from(document.querySelectorAll("button")).find(button => button.textContent === "로그아웃 다시 시도").click()',
      )
      await expect.poll(() => confirmed).toBe(true)
      await expect.poll(() => value(protocol, 'location.pathname === "/login"')).toBe(true)
      expect(
        (
          await context.request.get('/api/v1/me', {
            headers: { Cookie: `bodyguard_session=${old?.value}` },
          })
        ).status(),
      ).toBe(401)
      await info.attach('retry-confirmation.json', {
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify({ actualLogout204: confirmed, loginRoute: true, oldCookieMe401: true }),
        ),
      })
    } finally {
      await protocol.detach()
    }
  })
}

test('AR-WEB actual cached ready page still rechecks a server-revoked old cookie', async ({
  page,
  context,
  request,
}, info) => {
  const email = await join(context)
  await page.goto('/start')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  const old = (await context.cookies()).find((cookie) => cookie.name === 'bodyguard_session')
  expect(Boolean(old?.httpOnly)).toBe(true)
  const documentId = await page.evaluate(() => window.__accountRestoreProbe.document)
  await page.goto('/help')
  // Isolated HTTP context revokes server session; original browser cookie is not modified.
  const cookie = `bodyguard_session=${old?.value}`
  const csrfResponse = await request.get('/api/v1/auth/csrf', { headers: { Cookie: cookie } })
  expect(csrfResponse.status()).toBe(200)
  const csrf = await csrfResponse.json()
  expect(
    (
      await request.post('/api/v1/auth/logout', {
        headers: {
          Cookie: cookie,
          Origin: origin,
          'X-CSRF-Token': csrf.csrf_token,
        },
      })
    ).status(),
  ).toBe(204)
  const unchanged = (await context.cookies()).find((value) => value.name === 'bodyguard_session')
  expect(Boolean(unchanged?.value && unchanged.value === old?.value)).toBe(true)
  const protocol = await back(page, context, documentId)
  try {
    const sameDocument = true
    await expect.poll(() => value(protocol, 'location.pathname === "/login"')).toBe(true)
    expect(await value(protocol, 'Boolean(document.querySelector(".account-email"))')).toBe(false)
    expect((await context.request.get('/api/v1/me')).status()).toBe(401)
    await info.attach('fresh-authority.json', {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({
          sameDocument,
          nativePersistedRestores: 1,
          actualLogout204: true,
          unchangedBrowserCookie: true,
          nativeMe401: true,
          cameraCalls,
          unexpected,
          errors,
          browserVersion: context.browser()?.version(),
        }),
      ),
    })
  } finally {
    await protocol.detach()
  }
})
