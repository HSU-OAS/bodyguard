// release-plan6/FR-U-02/04/05/FR-R-03/NFR-07/08: actual web/HTTP/SQL, synthetic mail/summary.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type APIResponse, type Browser, type BrowserContext, expect, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const apiOrigin = 'http://localhost:8000'
const password = '합성 보안 검증 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const proxy = process.env.BODYGUARD_TEST_BLOCKED_PROXY
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned synthetic mailbox required')
if (!proxy || !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxy))
  throw new Error('Owned closed-port proxy required')

let cameraCalls = 0
let unexpectedRequests: string[] = []
let pageErrors: string[] = []
let statuses: number[] = []
let corsReadRejected = false
let corsWriteRejected = false
let corsConsoleErrors = 0
async function guard(context: BrowserContext) {
  await context.exposeBinding('__securityCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    // A newly opened about:blank has no mediaDevices; instrument actual secure web documents.
    if (!navigator.mediaDevices) return
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __securityCamera: () => Promise<void> }).__securityCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
  context.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(error.message)))
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (
      ![origin, apiOrigin].includes(url.origin) ||
      /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname)
    )
      unexpectedRequests.push(url.origin + url.pathname)
  })
}
test.beforeEach(async ({ page, context }) => {
  cameraCalls = 0
  unexpectedRequests = []
  pageErrors = []
  statuses = []
  corsReadRejected = false
  corsWriteRejected = false
  corsConsoleErrors = 0
  await guard(context)
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
})
test.afterEach(async ({ page }, info) => {
  const storageLengths = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('security-boundaries.json', {
    body: Buffer.from(
      JSON.stringify({
        actualWebHttpSql: true,
        actualProvider: false,
        actualHumanCamera: false,
        actualExercise: false,
        actualProductionTls: false,
        externalSecurityAudit: false,
        statuses,
        corsReadRejected,
        corsWriteRejected,
        corsConsoleErrors,
        cameraCalls,
        unexpectedRequests,
        pageErrors,
        storageLengths,
        browserVersion: page.context().browser()?.version(),
      }),
    ),
    contentType: 'application/json',
  })
  expect(cameraCalls).toBe(0)
  expect(unexpectedRequests).toEqual([])
  expect(pageErrors).toEqual([])
  expect(storageLengths).toEqual([0, 0])
})
async function check(response: APIResponse, status: number) {
  statuses.push(response.status())
  expect(response.status()).toBe(status)
  expect(response.headers()['cache-control']).toBe('no-store')
  expect(response.headers()['x-content-type-options']).toBe('nosniff')
  expect(response.headers()['referrer-policy']).toBe('no-referrer')
}
async function csrf(context: BrowserContext): Promise<string> {
  const response = await context.request.get('/api/v1/auth/csrf')
  await check(response, 200)
  return (await response.json()).csrf_token
}
async function post(context: BrowserContext, path: string, data?: unknown) {
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf(context) },
    data,
  })
}
async function join(context: BrowserContext) {
  const email = `security-${randomUUID()}@example.com`
  const sent = await post(context, '/auth/signup', { email, password })
  await check(sent, 202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return /^[0-9]{6}$/.test(code)
    })
    .toBe(true)
  const verified = await post(context, '/auth/verify', {
    challenge_id: (await sent.json()).challenge_id,
    code,
  })
  await check(verified, 201)
  return { email, id: (await verified.json()).id as string }
}
async function otherContext(browser: Browser) {
  const context = await browser.newContext({
    baseURL: origin,
    proxy: { server: proxy as string, bypass: 'localhost,127.0.0.1,[::1]' },
  })
  await guard(context)
  return context
}
async function seed(context: BrowserContext, motion: string) {
  const ended = new Date(Date.now() - 120_000)
  const record = {
    id: randomUUID(),
    motion_id: motion,
    protocol_version: 'fixture-not-release',
    started_at: new Date(ended.getTime() - 90_000).toISOString(),
    ended_at: ended.toISOString(),
    outcome: 'interrupted',
    observed_ms: 65_000,
    repetitions: 0,
  }
  const saved = await post(context, '/records/stretch', record)
  await check(saved, 201)
  expect((await saved.json()).provenance).toBe('client-reported')
  return record
}
async function listIds(context: BrowserContext) {
  const response = await context.request.get('/api/v1/records/stretch')
  await check(response, 200)
  return (await response.json()).items.map((item: { id: string }) => item.id)
}

test('WEB-S01 타인 기록 차단·소유권 입력 거부·본인 웹 보존', async ({
  browser,
  context,
  page,
}, info) => {
  await join(context)
  const own = await seed(context, 'fixture-security-own')
  const other = await otherContext(browser)
  try {
    const user = await join(other)
    const foreign = await seed(other, 'fixture-security-foreign')
    await check(await context.request.get(`/api/v1/records/stretch/${foreign.id}`), 404)
    await check(await other.request.get(`/api/v1/records/stretch/${own.id}`), 404)
    const forged = await context.request.get(`/api/v1/records/stretch?user_id=${user.id}`, {
      headers: { 'X-User-ID': user.id },
    })
    await check(forged, 200)
    expect((await forged.json()).items.map((item: { id: string }) => item.id)).toEqual([own.id])
    // Independent inputs keep one rejected field from masking another guard's regression.
    for (const invalidField of [
      { user_id: user.id },
      { motion_id: '<script>window.__securityInjected=true</script>' },
      { password: 'SYNTHETIC-INPUT-MUST-NOT-REFLECT' },
    ]) {
      const invalid = await post(context, '/records/stretch', {
        ...own,
        id: randomUUID(),
        ...invalidField,
      })
      await check(invalid, 422)
      expect(await invalid.json()).toEqual({ detail: '입력 형식을 확인해 주세요.' })
    }
    expect(await listIds(context)).toEqual([own.id])
    expect(await listIds(other)).toEqual([foreign.id])
    await page.goto(`/records/${foreign.id}`)
    await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('본인의 기록을 다시 선택')
    await expect(page.getByText('fixture-security-foreign', { exact: true })).toHaveCount(0)
    await page.screenshot({
      path: info.outputPath('security-foreign-record-blocked.png'),
      fullPage: true,
    })
    await page.getByRole('link', { name: '기록 목록으로 돌아가기' }).click()
    await expect(
      page.getByRole('link', { name: /^fixture-security-own .*기록 상세/ }),
    ).toBeVisible()
    await page.screenshot({
      path: info.outputPath('security-own-record-preserved.png'),
      fullPage: true,
    })
  } finally {
    await other.close()
  }
})

test('WEB-S02 다른 세션 CSRF·삭제 proof 거부·로그아웃 cookie 재전송 차단', async ({
  browser,
  context,
  page,
}, info) => {
  const user = await join(context)
  const own = await seed(context, 'fixture-security-session')
  const oldCsrf = await csrf(context)
  const preview = await post(context, '/records/stretch/delete-preview', {
    start: new Date(Date.parse(own.ended_at) - 1).toISOString(),
    end: new Date(Date.parse(own.ended_at) + 1).toISOString(),
  })
  await check(preview, 200)
  const proof = await preview.json()
  expect(proof.count).toBe(1)
  const second = await otherContext(browser)
  try {
    await check(await post(second, '/auth/login', { email: user.email, password }), 200)
    const currentCsrf = await csrf(second)
    expect(currentCsrf === oldCsrf).toBe(false)
    await check(
      await second.request.post('/api/v1/records/stretch', {
        headers: { Origin: origin, 'X-CSRF-Token': oldCsrf },
        data: { ...own, id: randomUUID() },
      }),
      403,
    )
    await check(
      await post(second, '/records/stretch/delete', {
        ...proof,
        confirmation: 'delete-stretch-records',
      }),
      403,
    )
    expect(await listIds(second)).toEqual([own.id])
    const cookie = (await second.cookies(origin)).find((item) => item.name === 'bodyguard_session')
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('Lax')
    const secondPage = await second.newPage()
    await secondPage.goto('/account')
    expect(
      await secondPage.evaluate(() => isSecureContext && Boolean(navigator.mediaDevices)),
    ).toBe(true)
    await expect(secondPage.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
    await secondPage.getByRole('button', { name: '로그아웃', exact: true }).click()
    await expect(secondPage.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    const replayHeaders = { Cookie: `bodyguard_session=${cookie?.value}` }
    await check(await second.request.get('/api/v1/me', { headers: replayHeaders }), 401)
    await check(
      await second.request.post('/api/v1/records/stretch', {
        headers: { ...replayHeaders, Origin: origin, 'X-CSRF-Token': currentCsrf },
        data: { ...own, id: randomUUID() },
      }),
      403,
    )
    await secondPage.goto('/records')
    await expect(secondPage.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    expect(await secondPage.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([
      0, 0,
    ])
    await check(await context.request.get('/api/v1/me'), 200)
    expect(await listIds(context)).toEqual([own.id])
    await page.goto('/records')
    await expect(
      page.getByRole('link', { name: /^fixture-security-session .*기록 상세/ }),
    ).toBeVisible()
    await page.screenshot({
      path: info.outputPath('security-other-session-preserved.png'),
      fullPage: true,
    })
  } finally {
    await second.close()
  }
})

test('WEB-S03 실제 Chrome CORS·origin/CSRF 변경 거부·정상 계정 보존', async ({
  context,
  page,
}, info) => {
  await join(context)
  const validCsrf = await csrf(context)
  await page.goto('/account')
  await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('CORS policy')) corsConsoleErrors++
  })
  // Raw HTTP can read its own record. CORS is browser read isolation, not authentication.
  const direct = await context.request.get(`${apiOrigin}/api/v1/me`, {
    headers: { Origin: origin },
  })
  await check(direct, 200)
  expect(direct.headers()['access-control-allow-origin']).toBeUndefined()
  const preflight = await context.request.fetch(`${apiOrigin}/api/v1/auth/logout`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'x-csrf-token',
    },
  })
  await check(preflight, 405)
  expect(preflight.headers()['access-control-allow-origin']).toBeUndefined()
  const rejected = await page.evaluate(
    async ({ apiOrigin, validCsrf }) => {
      async function rejects(url: string, init: RequestInit) {
        try {
          await fetch(url, init)
          return false
        } catch (error) {
          return error instanceof TypeError
        }
      }
      return [
        await rejects(`${apiOrigin}/api/v1/me`, { credentials: 'include' }),
        await rejects(`${apiOrigin}/api/v1/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRF-Token': validCsrf },
        }),
      ]
    },
    { apiOrigin, validCsrf },
  )
  ;[corsReadRejected, corsWriteRejected] = rejected
  expect(rejected).toEqual([true, true])
  await expect.poll(() => corsConsoleErrors).toBe(2)
  const invalidHeaders: Record<string, string>[] = [
    { Origin: apiOrigin, 'X-CSRF-Token': validCsrf },
    { Origin: 'null', 'X-CSRF-Token': validCsrf },
    { Origin: 'http://localhost:41730', 'X-CSRF-Token': validCsrf },
    { Referer: `${origin}/account`, 'X-CSRF-Token': validCsrf },
    { Origin: origin },
  ]
  for (const headers of invalidHeaders) {
    await check(await context.request.post('/api/v1/auth/logout', { headers }), 403)
  }
  await check(await context.request.get('/api/v1/me'), 200)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
  await page.screenshot({
    path: info.outputPath('security-cors-account-preserved.png'),
    fullPage: true,
  })
})
