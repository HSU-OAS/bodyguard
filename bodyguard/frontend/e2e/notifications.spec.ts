// FR-N-03/FR-U-04/NFR-08: actual production Chrome/HTTP/SQL; mailbox/faults synthetic.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned synthetic mailbox required')
const defaults = {
  posture_enabled: true,
  posture_minutes: 5,
  sitting_enabled: true,
  sitting_minutes: 50,
  sound_enabled: false,
}
const password = '격리된 설정 브라우저 시험 비밀번호 12345'
const address = () => `notifications-${randomUUID()}@example.com`
function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const rgb = color
      .match(/[\d.]+/g)
      ?.slice(0, 3)
      .map(Number)
    if (rgb?.length !== 3) throw new Error('Unsupported computed color')
    const linear = rgb.map((n) =>
      n / 255 <= 0.04045 ? n / 255 / 12.92 : ((n / 255 + 0.055) / 1.055) ** 2.4,
    )
    return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722
  }
  const front = luminance(a),
    back = luminance(b)
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
}
async function code(email: string) {
  let value = ''
  await expect
    .poll(() => {
      value = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return value
    })
    .toMatch(/^[0-9]{6}$/)
  return value
}
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function register(context: BrowserContext, email = address()) {
  const sent = await post(context, '/auth/signup', { email, password })
  expect(sent.status()).toBe(202)
  const challenge = await sent.json()
  expect(
    (
      await post(context, '/auth/verify', {
        challenge_id: challenge.challenge_id,
        code: await code(email),
      })
    ).status(),
  ).toBe(201)
  return email
}
async function settings(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/v1/me') && response.status() === 200,
    ),
    page.goto('/account/notifications'),
  ])
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await formRendered(page)
}
async function formRendered(page: Page) {
  // Actual DOM precondition with Node-side intervals, not a synthetic frame/value or longer gate.
  const save = page.getByRole('button', { name: '설정 저장', exact: true })
  await expect.poll(() => save.count(), { intervals: [100, 250, 500], timeout: 5000 }).toBe(1)
  await expect(save).toBeEnabled()
}
let cameraCalls = 0
let unexpected: string[] = []
let errors: string[] = []
let networkTiming: Array<{ method: string; path: string; durationMs: number }> = []
test.beforeEach(async ({ context, page }) => {
  cameraCalls = 0
  unexpected = []
  errors = []
  networkTiming = []
  context.on('requestfinished', (request) => {
    const url = new URL(request.url())
    if (url.origin === origin && url.pathname.startsWith('/api/v1/'))
      networkTiming.push({
        method: request.method(),
        path: url.pathname,
        durationMs: request.timing().responseEnd,
      })
  })
  await context.exposeBinding('__notificationCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __notificationCamera(): Promise<void> }).__notificationCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname))
      unexpected.push(url.origin + url.pathname)
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
})
test.afterEach(async ({ page }, info) => {
  const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('notification-boundaries.json', {
    body: Buffer.from(
      JSON.stringify({
        actualProductionChromeHttpSql: true,
        syntheticMailAndFaults: true,
        actualNotificationOrExercise: false,
        cameraCalls,
        unexpected,
        errors,
        networkTiming,
        storage,
        browser: page.context().browser()?.version(),
      }),
    ),
    contentType: 'application/json',
  })
  expect(cameraCalls).toBe(0)
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
  expect(storage).toEqual([0, 0])
})

test('N-W01 실제 가입→내 계정→설정 저장→새로고침·키보드·화이트 블루/920px', async ({
  page,
  context,
}, info) => {
  test.setTimeout(90_000)
  const email = address()
  await page.goto('/signup')
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(password)
  const [sent] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/auth/signup') && response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: '인증 코드 받기', exact: true }).click(),
  ])
  expect(sent.status()).toBe(202)
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  await page.getByLabel('인증 코드', { exact: true }).fill(await code(email))
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await page.getByRole('link', { name: '내 계정', exact: true }).click()
  await page.getByRole('link', { name: '알림 설정 관리' }).click()
  await expect(page.getByRole('button', { name: '설정 저장', exact: true })).toBeEnabled()
  await expect(page.getByRole('heading', { level: 1, name: '알림 설정' })).toBeFocused()
  await expect(page).toHaveTitle('알림 설정 · BODYGUARD')
  await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const save = page.getByRole('button', { name: '설정 저장', exact: true })
  await page.mouse.move(0, 0)
  await expect(save).toHaveCSS('background-color', 'rgb(30, 90, 168)')
  await expect(save).toHaveCSS('border-radius', '8px')
  const actionColors = await save.evaluate((node) => {
    const s = getComputedStyle(node)
    return { color: s.color, background: s.backgroundColor }
  })
  expect(contrast(actionColors.color, actionColors.background)).toBeGreaterThanOrEqual(4.5)
  await expect(page.getByRole('group', { name: '자세 알림', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: '장시간 앉음 알림', exact: true })).toBeVisible()
  const input = page.getByLabel('자세 알림 시간 (분)')
  await expect(input).toHaveCSS('height', '48px')
  await input.focus()
  await expect(input).toHaveCSS('outline-width', '3px')
  const inputColors = await input.evaluate((node) => {
    const s = getComputedStyle(node)
    return { border: s.borderTopColor, outline: s.outlineColor, background: s.backgroundColor }
  })
  expect(contrast(inputColors.border, inputColors.background)).toBeGreaterThanOrEqual(3)
  expect(contrast(inputColors.outline, inputColors.background)).toBeGreaterThanOrEqual(3)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('장시간 앉음 알림 사용')).toBeFocused()
  await page.screenshot({ path: info.outputPath('notifications-desktop.png'), fullPage: true })
  await page.getByLabel('자세 알림 시간 (분)').fill('7')
  await page.getByLabel('장시간 앉음 알림 시간 (분)').fill('60')
  await page.getByLabel('장시간 앉음 알림 사용').uncheck()
  await page.getByLabel('알림 소리 사용').check()
  await save.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('설정을 저장했습니다.')
  const persisted = await context.request.get('/api/v1/settings/notifications')
  expect(persisted.headers()['cache-control']).toBe('no-store')
  expect(await persisted.json()).toEqual({
    ...defaults,
    posture_minutes: 7,
    sitting_minutes: 60,
    sitting_enabled: false,
    sound_enabled: true,
  })
  await page.screenshot({ path: info.outputPath('notifications-saved.png'), fullPage: true })
  await page.reload()
  await formRendered(page)
  await expect(page.getByLabel('자세 알림 시간 (분)')).toHaveValue('7')
  await expect(page.getByLabel('장시간 앉음 알림 시간 (분)')).toHaveValue('60')
  await expect(page.getByLabel('장시간 앉음 알림 시간 (분)')).toBeDisabled()
  await expect(page.getByLabel('알림 소리 사용')).toBeChecked()
  await page.setViewportSize({ width: 920, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await expect(save).toHaveCSS('transition-duration', '0s')
  await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  await page.screenshot({ path: info.outputPath('notifications-920.png'), fullPage: true })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = '2'
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('notifications-css-zoom-200.png'), fullPage: true })
})

test('N-W02 실제 저장 수락 후 응답 단절·자동 재저장0·명시 재조회', async ({
  page,
  context,
}, info) => {
  await register(context)
  await settings(page)
  let posts = 0
  await page.route('**/api/v1/settings/notifications', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    posts++
    const actual = await route.fetch()
    expect(actual.status()).toBe(200)
    await route.abort('failed')
  })
  await page.getByLabel('자세 알림 시간 (분)').fill('13')
  await page.getByRole('button', { name: '설정 저장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('저장 결과를 확인하지 못했습니다')
  await expect(page.getByLabel('자세 알림 사용')).toBeDisabled()
  expect(posts).toBe(1)
  expect(
    (await (await context.request.get('/api/v1/settings/notifications')).json()).posture_minutes,
  ).toBe(13)
  await page.screenshot({ path: info.outputPath('notifications-uncertain.png'), fullPage: true })
  await page.getByRole('button', { name: '저장된 설정 다시 조회' }).click()
  await expect(page.getByLabel('자세 알림 시간 (분)')).toHaveValue('13')
  await expect(page.getByLabel('자세 알림 사용')).toBeEnabled()
  expect(posts).toBe(1)
})

test('N-W03 기존 A 폼·쿠키 B 교체·실제 old-proof403·타인 설정 보존', async ({
  page,
  context,
}, info) => {
  const a = await register(context)
  expect(
    (await post(context, '/settings/notifications', { ...defaults, posture_minutes: 11 })).status(),
  ).toBe(200)
  await settings(page)
  await page.getByLabel('자세 알림 시간 (분)').fill('17')
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  await register(context)
  let result = 0
  await page.route('**/api/v1/settings/notifications', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    const actual = await route.fetch()
    result = actual.status()
    await route.fulfill({ response: actual })
  })
  await page.getByRole('button', { name: '설정 저장', exact: true }).click()
  await expect.poll(() => result).toBe(403)
  await expect(page.getByLabel('자세 알림 시간 (분)')).toHaveValue('5')
  expect(await (await context.request.get('/api/v1/settings/notifications')).json()).toEqual(
    defaults,
  )
  await page.screenshot({
    path: info.outputPath('notifications-account-rebound.png'),
    fullPage: true,
  })
  expect((await post(context, '/auth/logout')).status()).toBe(204)
  expect((await post(context, '/auth/login', { email: a, password })).status()).toBe(200)
  expect(
    (await (await context.request.get('/api/v1/settings/notifications')).json()).posture_minutes,
  ).toBe(11)
})

test('N-W04 loading·읽기 장애 복구·잘못된 시간 오류 초점·POST0', async ({
  page,
  context,
}, info) => {
  await register(context)
  let release: () => void = () => {}
  const held = new Promise<void>((r) => {
    release = r
  })
  let failed = true
  let posts = 0
  await page.route('**/api/v1/settings/notifications', async (route) => {
    if (route.request().method() === 'POST') posts++
    if (failed) {
      await held
      await route.abort('failed')
      return
    }
    await route.continue()
  })
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/v1/me') && response.status() === 200,
    ),
    page.goto('/account/notifications'),
  ])
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
  await expect
    .poll(() => page.getByText('설정을 불러오고 있습니다.').count(), {
      intervals: [100, 250, 500],
      timeout: 5000,
    })
    .toBe(1)
  await expect(page.getByText('설정을 불러오고 있습니다.')).toBeVisible()
  await page.screenshot({ path: info.outputPath('notifications-loading.png'), fullPage: true })
  release()
  await expect(page.getByRole('alert')).toContainText('설정을 불러오지 못했습니다')
  await page.screenshot({ path: info.outputPath('notifications-read-error.png'), fullPage: true })
  failed = false
  await page.getByRole('button', { name: '다시 조회' }).click()
  await expect(page.getByLabel('자세 알림 시간 (분)')).toHaveValue('5')
  await page.getByLabel('자세 알림 시간 (분)').fill('0')
  await page.getByRole('button', { name: '설정 저장', exact: true }).click()
  await expect(page.getByRole('alert')).toBeFocused()
  await expect(page.getByLabel('자세 알림 시간 (분)')).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: /자세 알림 시간: 1~1440분/ }).click()
  await expect(page.getByLabel('자세 알림 시간 (분)')).toBeFocused()
  await page.screenshot({ path: info.outputPath('notifications-validation.png'), fullPage: true })
  expect(posts).toBe(0)
})
