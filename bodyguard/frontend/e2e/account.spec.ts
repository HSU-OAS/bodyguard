// FR-U-02/03/04: real API and PostgreSQL; mailbox is test-process IPC only.

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'

let cameraCalls = 0
test.beforeEach(async ({ context }) => {
  cameraCalls = 0
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
})

test('B-02 actual 60-second resend retires the old code and verifies the new email code', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const email = address()
  await page.goto('/signup')
  await fillCredentials(page, email)
  await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  const old = await codeFor(email)
  await expect(page.getByRole('button', { name: /재발송까지/ })).toBeDisabled()
  const sendAgain = page.getByRole('button', { name: '인증 코드 다시 받기', exact: true })
  await expect(sendAgain).toBeEnabled({ timeout: 70_000 })
  await sendAgain.click()
  await expect(page.getByRole('status')).toContainText('새 코드를 보냈습니다')
  const fresh = await codeFor(email)
  expect(fresh).not.toBe(old)
  await page.getByLabel('인증 코드', { exact: true }).fill(old)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByRole('alert')).toContainText('인증 코드를 확인')
  await page.getByLabel('인증 코드', { exact: true }).fill(fresh)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
})

test('B-02 actual email quota shows 429 and disables repeated signup', async ({
  page,
  context,
}) => {
  const email = address()
  await page.goto('/signup')
  const csrfResponse = await context.request.get('/api/v1/auth/csrf')
  const csrf = await csrfResponse.json()
  for (let index = 0; index < 5; index++) {
    const sent = await context.request.post('/api/v1/auth/signup', {
      headers: { Origin: 'http://localhost:4173', 'X-CSRF-Token': csrf.csrf_token },
      data: { email, password },
    })
    expect(sent.status()).toBe(202)
  }
  await fillCredentials(page, email)
  await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('요청이 많습니다')
  await expect(page.getByRole('button', { name: '인증 코드 받기', exact: true })).toBeDisabled()
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toHaveCount(0)
})

test('B-02/03 pending signup blocks duplicates and navigation discards late response', async ({
  page,
}) => {
  let submissions = 0
  let release: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/signup', async (route) => {
    submissions++
    const actual = await route.fetch()
    await held
    try {
      await route.fulfill({ response: actual })
    } catch {
      /* navigation cancels delivery */
    }
  })
  try {
    await page.goto('/signup')
    await fillCredentials(page, address())
    await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
    await expect(page.getByRole('button', { name: '처리 중…' })).toBeDisabled()
    await expect.poll(() => submissions).toBe(1)
    await page.getByRole('link', { name: '서비스 소개로 돌아가기', exact: true }).click()
    release?.()
    await expect(page.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toHaveCount(0)
    expect(submissions).toBe(1)
  } finally {
    release?.()
  }
})

const password = '브라우저 시험 전용 비밀번호 12345'
const address = () => `browser-${randomUUID()}@example.com`
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Isolated mailbox required')

async function fillCredentials(page: Page, email: string) {
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(password)
}
async function codeFor(email: string) {
  let code = ''
  await expect
    .poll(() => {
      try {
        code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      } catch {
        code = ''
      }
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  return code
}
async function join(page: Page, email: string) {
  await page.goto('/signup')
  await fillCredentials(page, email)
  await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  await page.getByLabel('인증 코드', { exact: true }).fill(await codeFor(email))
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toBeVisible()
}

test('B-01 공개·제품 개발 경로·카메라 0·좁은 창·키보드', async ({ page }, info) => {
  const errors: string[] = [],
    requests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('public-desktop.png'), fullPage: true })
  await page.goto('/dev/measure')
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible()
  await expect(page.getByRole('button', { name: '측정 시작' })).toHaveCount(0)
  await page.goto('/start')
  await expect(page).toHaveURL(/\/login\?next=%2Fstart$/)
  await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('login-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 700, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByLabel('이메일', { exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('비밀번호', { exact: true })).toBeFocused()
  await page.screenshot({ path: info.outputPath('login-narrow.png'), fullPage: true })
  expect(
    requests.some((url) => /\.wasm|pose_landmarker|MeasureDemoPage|three|mediapipe/.test(url)),
  ).toBe(false)
  expect(errors).toEqual([])
})

test('B-01/02 실제 가입·오답·재발송 대기·로그아웃·로그인·내부 복귀', async ({
  page,
  context,
}, info) => {
  const email = address()
  await page.goto('/signup')
  await fillCredentials(page, email)
  await page.screenshot({ path: info.outputPath('signup.png'), fullPage: true })
  await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  await expect(page.getByRole('button', { name: /재발송까지/ })).toBeDisabled()
  const code = await codeFor(email)
  await page
    .getByLabel('인증 코드', { exact: true })
    .fill(`${(Number(code[0]) + 1) % 10}${code.slice(1)}`)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByRole('alert')).toContainText('인증 코드를 확인')
  await page.screenshot({ path: info.outputPath('verification-error.png'), fullPage: true })
  await page.getByLabel('인증 코드', { exact: true }).fill(code)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page).toHaveURL('/start')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('protected-start.png'), fullPage: true })
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'bodyguard_session')?.httpOnly,
  ).toBe(true)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  await page.reload()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/login?next=https%3A%2F%2Fevil.example')
  await fillCredentials(page, email)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL('/start')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
})

test('B-02 실제 가입 단계 새로고침은 인증 권한 없이 안전하게 재시작', async ({ page }) => {
  await page.goto('/signup')
  await fillCredentials(page, address())
  await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '나를 위한 움직임의 시작' })).toBeVisible()
  await expect(page.getByLabel('이메일', { exact: true })).toHaveValue('')
  await page.goto('/start')
  await expect(page).toHaveURL(/\/login/)
})

test('B-02 서버 연결 실패를 게스트로 표시하지 않고 실제 API로 재시도', async ({ page }, info) => {
  await page.route('**/api/v1/me', (route) => route.abort('failed'))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: '연결을 확인해 주세요' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('connection-error.png'), fullPage: true })
  await page.unroute('**/api/v1/me')
  await page.getByRole('button', { name: '다시 확인' }).click()
  await expect(page).toHaveURL(/\/login/)
})

test('B-03 실패한 로그아웃은 개인 화면 차단·재시도·다른 탭 폐기', async ({ page, context }) => {
  const email = address()
  await join(page, email)
  const other = await context.newPage()
  await other.goto('/start')
  await expect(other.getByText(email, { exact: true })).toBeVisible()
  await page.route('**/api/v1/auth/logout', (route) => route.abort('failed'))
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page.getByRole('heading', { name: '로그아웃을 확인하지 못했습니다' })).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toHaveCount(0)
  await page.unroute('**/api/v1/auth/logout')
  await page.getByRole('button', { name: '로그아웃 다시 시도' }).click()
  await expect(page).toHaveURL(/\/login/)
  await expect(other).toHaveURL(/\/login/)
  await expect(other.getByText(email, { exact: true })).toHaveCount(0)
  await other.close()
})

test('B-01/03 삭제된 실제 세션 쿠키는 보호 화면을 열지 않는다', async ({ page, context }) => {
  const email = address()
  await join(page, email)
  await context.clearCookies()
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText(email, { exact: true })).toHaveCount(0)
})
