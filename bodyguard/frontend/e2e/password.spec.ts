// PW-01~04: real HTTP/SQL/production Chrome; only mail delivery is synthetic IPC.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const oldPassword = '브라우저 복구 전용 비밀번호 12345'
const newPassword = '새로운 브라우저 복구 비밀번호 67890'
const address = () => `recovery-${randomUUID()}@example.com`
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Isolated mailbox required')

let cameraCalls = 0
const requests: string[] = []
test.beforeEach(async ({ context }) => {
  cameraCalls = 0
  requests.length = 0
  context.on('request', (request) => requests.push(request.url()))
  await context.exposeBinding('__bodyguardTestCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { __bodyguardTestCamera: () => Promise<void> }
      ).__bodyguardTestCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
})
test.afterEach(() => {
  expect(cameraCalls).toBe(0)
  expect(
    requests.some((url) => /\.glb|\.wasm|pose_landmarker|MeasureDemoPage|mediapipe/.test(url)),
  ).toBe(false)
})

async function post(context: BrowserContext, path: string, data: unknown) {
  const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  return context.request.post(`/api/v1/auth/${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function message(email: string, pattern: RegExp, previous = '') {
  let value = ''
  await expect
    .poll(() => {
      value = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return value === previous ? '' : value
    })
    .toMatch(pattern)
  return value
}
async function join(context: BrowserContext, email: string, password = oldPassword) {
  const signup = await post(context, 'signup', { email, password })
  expect(signup.status()).toBe(202)
  const verified = await post(context, 'verify', {
    challenge_id: (await signup.json()).challenge_id,
    code: await message(email, /^[0-9]{6}$/),
  })
  expect(verified.status()).toBe(201)
}
async function requestLink(page: Page, email: string, previous = '') {
  await page.goto('/password/forgot')
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('요청을 접수했습니다')
  return message(
    email,
    /^http:\/\/localhost:4173\/password\/reset#token=[A-Za-z0-9_-]{43}$/,
    previous,
  )
}
async function fill(page: Page) {
  await page.getByLabel('새 비밀번호', { exact: true }).fill(newPassword)
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(newPassword)
}

test('PW-01/02/04 actual reset, URL/referrer/storage, old session/credential revocation and keyboard', async ({
  page,
  context,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/login')
  await page.getByRole('link', { name: '비밀번호를 잊으셨나요?' }).click()
  await page.getByLabel('이메일', { exact: true }).fill(address())
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('등록된 이메일이면')
  const generic = await page.getByRole('status').textContent()
  await page.screenshot({ path: info.outputPath('forgot-desktop.png'), fullPage: true })

  const email = address()
  await join(context, email)
  const other = await context.newPage()
  await other.goto('/start')
  await expect(other.getByText(email, { exact: true })).toBeVisible()
  const link = await requestLink(page, email)
  expect(await page.getByRole('status').textContent()).toBe(generic)
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token')
  const referrers: string[] = []
  page.on('request', (request) => referrers.push(request.headers().referer ?? ''))
  await page.goto(link)
  await expect(page).toHaveURL('/password/reset')
  await expect(page.getByRole('heading', { name: '새 비밀번호 설정' })).toBeVisible()
  await page.getByRole('button', { name: '본문으로 이동' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveURL('/password/reset')
  // Opening the link must not consume it or change credentials.
  expect((await context.request.get('/api/v1/me')).status()).toBe(200)
  await fill(page)
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(`${newPassword}wrong`)
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('alert')).toContainText('일치하지')
  await expect(page.getByLabel('새 비밀번호 확인', { exact: true })).toBeFocused()
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(newPassword)
  await page.getByLabel('새 비밀번호', { exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '비밀번호 표시' })).toBeFocused()
  await page.screenshot({ path: info.outputPath('reset-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 700, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('reset-narrow.png'), fullPage: true })
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('heading', { name: '비밀번호를 변경했습니다' })).toBeFocused()
  await expect(other).toHaveURL(/\/login/)
  await expect(other.getByText(email, { exact: true })).toHaveCount(0)
  expect((await context.request.get('/api/v1/me')).status()).toBe(401)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  expect(await page.locator('body').textContent()).not.toContain(token)
  expect(requests.some((url) => token && url.includes(token))).toBe(false)
  expect(referrers.every((value) => value === '')).toBe(true)
  await page.screenshot({ path: info.outputPath('reset-complete.png'), fullPage: true })
  await page.getByRole('link', { name: '로그인으로 돌아가기' }).click()
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(oldPassword)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('이메일 또는 비밀번호')
  await page.getByLabel('비밀번호', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  expect(errors).toEqual([])
  await other.close()
})

test('PW-03 actual latest-only, consumed, forged and missing link handling', async ({
  page,
  context,
}, info) => {
  const email = address()
  await join(context, email)
  const old = await requestLink(page, email)
  const fresh = await requestLink(page, email, old)
  await page.goto(old)
  await fill(page)
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('heading', { name: '새 링크가 필요합니다' })).toBeFocused()
  await expect(page.getByLabel('새 비밀번호', { exact: true })).toHaveCount(0)
  await page.goto(fresh)
  await fill(page)
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('heading', { name: '비밀번호를 변경했습니다' })).toBeVisible()
  await page.goto(fresh)
  await fill(page)
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('heading', { name: '새 링크가 필요합니다' })).toBeVisible()
  await page.goto(`/password/reset#token=${'x'.repeat(43)}`)
  await fill(page)
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('heading', { name: '새 링크가 필요합니다' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('invalid-link.png'), fullPage: true })
  await page.goto(`/password/reset?token=${'x'.repeat(43)}`)
  await expect(page).toHaveURL('/password/reset')
  await expect(page.getByRole('heading', { name: '새 링크가 필요합니다' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '새 링크가 필요합니다' })).toBeVisible()
})

test('PW-01/03 controlled transport failure/late reply and actual quota', async ({
  page,
  context,
}) => {
  // Only this network fault is injected; retry/held response use the real API.
  await page.route('**/api/v1/auth/password/forgot', (route) => route.abort('failed'))
  await page.goto('/password/forgot')
  await page.getByLabel('이메일', { exact: true }).fill(address())
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('연결이 끊겼습니다')
  await expect(page.getByText(/요청을 접수했습니다/)).toHaveCount(0)
  await page.unroute('**/api/v1/auth/password/forgot')
  let submissions = 0
  let release: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/password/forgot', async (route) => {
    submissions++
    const actual = await route.fetch()
    await held
    try {
      await route.fulfill({ response: actual })
    } catch {
      /* SPA leave cancels request */
    }
  })
  try {
    await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
    await expect(page.getByRole('button', { name: '처리 중…' })).toBeDisabled()
    await expect.poll(() => submissions).toBe(1)
    await page.getByRole('link', { name: '서비스 소개로 돌아가기' }).click()
    release?.()
    await expect(page.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeVisible()
    await expect(page.getByText(/요청을 접수했습니다/)).toHaveCount(0)
    expect(submissions).toBe(1)
  } finally {
    release?.()
  }
  await page.unroute('**/api/v1/auth/password/forgot')
  const email = address()
  for (let index = 0; index < 5; index++)
    expect((await post(context, 'password/forgot', { email })).status()).toBe(202)
  await page.goto('/password/forgot')
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('요청이 많습니다')
  await expect(page.getByRole('button', { name: '재설정 요청', exact: true })).toBeDisabled()
  await expect(page.getByRole('status')).toContainText('다시 요청까지')
})

test('PW-03 reset committed before a cancelled reply cannot restore stale private UI', async ({
  page,
  context,
}) => {
  const email = address()
  await join(context, email)
  const link = await requestLink(page, email)
  let committed = false
  let release: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/password/reset', async (route) => {
    const actual = await route.fetch()
    expect(actual.status()).toBe(204)
    committed = true
    await held
    try {
      await route.fulfill({ response: actual })
    } catch {
      /* cancelled after commit */
    }
  })
  try {
    await page.goto(link)
    await fill(page)
    await page.getByRole('button', { name: '비밀번호 변경' }).click()
    await expect(page.getByRole('button', { name: '처리 중…' })).toBeDisabled()
    await expect.poll(() => committed).toBe(true)
    await page.getByRole('link', { name: '서비스 소개로 돌아가기' }).click()
    release?.()
    await expect(page.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '비밀번호를 변경했습니다' })).toHaveCount(0)
    await page.goto('/start')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText(email, { exact: true })).toHaveCount(0)
    expect((await context.request.get('/api/v1/me')).status()).toBe(401)
    expect((await post(context, 'login', { email, password: newPassword })).status()).toBe(200)
  } finally {
    release?.()
  }
})

test('PW-02 existing Unicode length policy remains usable through reset and login', async ({
  page,
  context,
}) => {
  const email = address()
  const original = '😀'.repeat(128)
  const changed = '😁'.repeat(128)
  await join(context, email, original)
  expect((await post(context, 'logout', undefined)).status()).toBe(204)
  await page.goto('/login')
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(original)
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue(original)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  const link = await requestLink(page, email)
  await page.goto(link)
  await page.getByLabel('새 비밀번호', { exact: true }).fill(changed)
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(changed)
  await expect(page.getByLabel('새 비밀번호', { exact: true })).toHaveValue(changed)
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('heading', { name: '비밀번호를 변경했습니다' })).toBeVisible()
  await page.getByRole('link', { name: '로그인으로 돌아가기' }).click()
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(changed)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
})
