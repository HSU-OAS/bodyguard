// FR-N-03/04/05/FR-U-04: actual Chrome/AuthProvider/API/SQL, synthetic mail and alert inputs.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, type CDPSession, expect, type Page, test } from '@playwright/test'
import type { mountOwnedAlertProbe } from './fixtures/ownedAlertProbe'

type ProbeWindow = Window & { ownedAlertProbe: ReturnType<typeof mountOwnedAlertProbe> }
const bundle = process.env.BODYGUARD_TEST_OWNED_ALERT_PROBE
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (
  !bundle ||
  !/^\/private\/tmp\/bodyguard-owned-alert-proof\.[A-Za-z0-9]+\/browser-probe$/.test(bundle)
)
  throw new Error('Owned alert lifecycle bundle required')
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned mailbox required')
let unexpected = 0
let camera = 0
let errors = 0
let settingsReads = 0
let permissionCdp: CDPSession | null = null
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: 'http://localhost:4173', 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function register(context: BrowserContext) {
  const email = `owned-alert-${randomUUID()}@example.com`
  const sent = await post(context, '/auth/signup', {
    email,
    password: '격리된 알림 연결 시험 비밀번호 12345',
  })
  expect(sent.status()).toBe(202)
  const challenge = await sent.json()
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  expect(
    (await post(context, '/auth/verify', { challenge_id: challenge.challenge_id, code })).status(),
  ).toBe(201)
}
test.beforeEach(async ({ context, page }) => {
  unexpected = 0
  camera = 0
  errors = 0
  settingsReads = 0
  page.on('pageerror', () => {
    errors++
  })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (
      url.origin !== 'http://localhost:4173' ||
      /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname) ||
      (request.method() === 'POST' &&
        !['/api/v1/auth/logout', '/api/v1/settings/notifications'].includes(url.pathname))
    )
      unexpected++
    if (url.pathname === '/api/v1/settings/notifications' && request.method() === 'GET')
      settingsReads++
  })
  await context.exposeBinding('__ownedAlertUnexpectedCamera', () => {
    camera++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { __ownedAlertUnexpectedCamera(): Promise<void> }
      ).__ownedAlertUnexpectedCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  const cdp = await context.newCDPSession(page)
  permissionCdp = cdp
  const { targetInfo } = await cdp.send('Target.getTargetInfo')
  expect(targetInfo.browserContextId).toBeTruthy()
  await cdp.send('Browser.setPermission', {
    permission: { name: 'notifications' },
    setting: 'denied',
    origin: 'http://localhost:4173',
    browserContextId: targetInfo.browserContextId,
  })
  await page.route('**/__private-owned-alert-probe.js', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`, 'utf8'),
    }),
  )
  await register(context)
})
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('owned-alert-boundaries.json', {
    body: Buffer.from(
      JSON.stringify({
        actualChromeAuthHttpSql: true,
        syntheticMailAndTriggers: true,
        actualCoachingOrGrantedOsDisplay: false,
        camera,
        unexpected,
        errors,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
    contentType: 'application/json',
  })
  try {
    expect(camera).toBe(0)
    expect(unexpected).toBe(0)
    expect(errors).toBe(0)
    expect(storage).toEqual([0, 0])
  } finally {
    await permissionCdp?.detach()
    permissionCdp = null
  }
})
async function mount(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'BODYGUARD 서비스 소개', exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => ({ secure: isSecureContext, permission: Notification.permission })),
  ).toEqual({ secure: true, permission: 'denied' })
  await page.addStyleTag({ content: readFileSync(`${bundle}/probe.css`, 'utf8') })
  await page.evaluate(async () => {
    const path = '/__private-owned-alert-probe.js'
    const module = (await import(path)) as { mountOwnedAlertProbe: typeof mountOwnedAlertProbe }
    ;(window as unknown as ProbeWindow).ownedAlertProbe = module.mountOwnedAlertProbe()
  })
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as ProbeWindow).ownedAlertProbe.state().auth),
    )
    .toBe('ready')
  await expect(page.getByTestId('owned-alert-state')).toHaveText('idle')
}
async function prepare(page: Page) {
  await page.getByRole('button', { name: '설정 연결', exact: true }).click()
  await expect(page.getByTestId('owned-alert-state')).toHaveText('prepared')
}
test('O01/02/05 actual settings form→owned prepare→enabled-only screen action', async ({
  page,
  context,
}, info) => {
  await page.goto('/account/notifications')
  await expect(page.getByRole('button', { name: '설정 저장', exact: true })).toBeEnabled()
  await page.getByLabel('자세 알림 사용').uncheck()
  await page.getByRole('button', { name: '설정 저장', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('설정을 저장했습니다.')
  expect(
    (await (await context.request.get('/api/v1/settings/notifications')).json()).posture_enabled,
  ).toBe(false)
  await mount(page)
  const before = settingsReads
  expect(
    await page.evaluate(() => (window as unknown as ProbeWindow).ownedAlertProbe.state()),
  ).toMatchObject({ status: 'idle', last: null, permissionRequests: 0, notificationShows: 0 })
  await prepare(page)
  expect(settingsReads - before).toBe(1)
  await page.getByRole('button', { name: '합성 자세 안내', exact: true }).click()
  await expect(page.getByRole('group', { name: '자세 스트레칭 안내', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '합성 장시간 안내', exact: true }).click()
  const choose = page.getByRole('button', { name: '장시간 안내 스트레칭 살펴보기', exact: true })
  await expect(choose).toBeVisible()
  await page.screenshot({ path: info.outputPath('owned-settings-delivery.png'), fullPage: true })
  await choose.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('region', { name: '스트레칭 알림', exact: true }).getByRole('status'),
  ).toHaveText('안내가 없습니다.')
  expect(
    await page.evaluate(() => (window as unknown as ProbeWindow).ownedAlertProbe.state()),
  ).toMatchObject({
    chosen: 'sitting',
    permissionRequests: 0,
    notificationShows: 0,
    syntheticTriggers: true,
  })
})
test('O03/05 actual same-account recheck closes old delivery and explicit prepare rereads settings', async ({
  page,
  context,
}) => {
  await mount(page)
  await prepare(page)
  await page.getByRole('button', { name: '합성 자세 안내', exact: true }).click()
  await expect(page.getByRole('group', { name: '자세 스트레칭 안내', exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as ProbeWindow).ownedAlertProbe.refresh())
  await expect(page.getByTestId('owned-alert-state')).toHaveText('idle')
  await expect(page.getByRole('region', { name: '스트레칭 알림', exact: true })).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      (window as unknown as ProbeWindow).ownedAlertProbe.receiveOld('posture'),
    ),
  ).toBe(false)
  const value = await (await context.request.get('/api/v1/settings/notifications')).json()
  expect(
    (await post(context, '/settings/notifications', { ...value, sitting_enabled: false })).status(),
  ).toBe(200)
  await prepare(page)
  await page.getByRole('button', { name: '합성 장시간 안내', exact: true }).click()
  await expect(
    page.getByRole('region', { name: '스트레칭 알림', exact: true }).getByRole('status'),
  ).toHaveText('안내가 없습니다.')
  await page.getByRole('button', { name: '합성 자세 안내', exact: true }).click()
  await expect(page.getByRole('group', { name: '자세 스트레칭 안내', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '연결 닫기', exact: true }).click()
  await expect(page.getByTestId('owned-alert-state')).toHaveText('idle')
})
test('O03/05 actual logout204→guest invalidates old screen actions and settings authority', async ({
  page,
  context,
}) => {
  await mount(page)
  await prepare(page)
  await page.getByRole('button', { name: '합성 자세 안내', exact: true }).click()
  const completed = page.waitForResponse(
    (res) => res.url().endsWith('/api/v1/auth/logout') && res.status() === 204,
  )
  await page.evaluate(() => (window as unknown as ProbeWindow).ownedAlertProbe.signOut())
  await completed
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as ProbeWindow).ownedAlertProbe.state().auth),
    )
    .toBe('guest')
  await expect(page.getByRole('region', { name: '스트레칭 알림', exact: true })).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      (window as unknown as ProbeWindow).ownedAlertProbe.receiveOld('posture'),
    ),
  ).toBe(false)
  const before = settingsReads
  await page.getByRole('button', { name: '설정 연결', exact: true }).click()
  await expect(page.getByTestId('owned-alert-state')).toHaveText('idle')
  expect(settingsReads).toBe(before)
  expect((await context.request.get('/api/v1/me')).status()).toBe(401)
})
