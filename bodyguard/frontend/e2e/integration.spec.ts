// release-plan6/FR-U-02/04/05/FR-R-03: actual web/HTTP/SQL, synthetic mail/summary only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type BrowserContext, expect, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned synthetic mailbox required')
let cameraCalls = 0
let unexpectedRequests: string[] = []
let pageErrors: string[] = []
test.beforeEach(async ({ page, context }) => {
  cameraCalls = 0
  unexpectedRequests = []
  pageErrors = []
  await context.exposeBinding('__integrationCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __integrationCamera: () => Promise<void> }).__integrationCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname))
      unexpectedRequests.push(url.origin + url.pathname)
  })
})
test.afterEach(async ({ page }, info) => {
  const storageLengths = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  await info.attach('integration-boundaries.json', {
    body: Buffer.from(
      JSON.stringify({
        actualWebHttpSql: true,
        actualProvider: false,
        actualHumanCamera: false,
        actualExercise: false,
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
async function post(context: BrowserContext, path: string, data?: unknown) {
  const response = await context.request.get('/api/v1/auth/csrf')
  expect(response.status()).toBe(200)
  const csrf = await response.json()
  return context.request.post(`/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}

test('WEB-I01 공개→가입→탐색 준비→기록 상세·취소·삭제→계정·로그아웃', async ({
  page,
  context,
}, info) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })).toBeVisible()
  await page
    .getByRole('navigation', { name: '서비스 안내' })
    .getByRole('link', { name: '도움말', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeFocused()
  await page.getByRole('link', { name: '카메라·데이터 안내 보기' }).click()
  await expect(page.getByRole('heading', { name: '카메라와 데이터 안내' })).toBeFocused()
  await page
    .getByRole('navigation', { name: '서비스 안내' })
    .getByRole('link', { name: '도움말', exact: true })
    .click()
  await page.getByRole('link', { name: '이메일 가입', exact: true }).click()
  const email = `integration-${randomUUID()}@example.com`
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill('합성 통합 시험 비밀번호 12345')
  await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return /^[0-9]{6}$/.test(code)
    })
    .toBe(true)
  await page.getByLabel('인증 코드', { exact: true }).fill(code)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toBeVisible()
  await page.getByRole('link', { name: '스트레칭 시작 경로 선택', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  await page.getByRole('button', { name: '추천받기', exact: true }).click()
  await page.getByRole('radio', { name: '어깨', exact: true }).check()
  await expect(page.getByRole('status')).toContainText('신체 확인 정보가 없어')
  await page.screenshot({
    path: info.outputPath('integration-explore-pending.png'),
    fullPage: true,
  })
  await page.getByRole('link', { name: '내 시작으로 돌아가기' }).click()
  await page.getByRole('link', { name: '내 수행 기록 확인' }).click()
  await expect(page.getByText('이 기간에는 수행 기록이 없습니다', { exact: true })).toBeVisible()
  // Fixture insertion is not a coaching producer and not evidence of an actual stretch.
  const ended = new Date(Date.now() - 120_000)
  const record = {
    id: randomUUID(),
    motion_id: 'fixture-web-integration',
    protocol_version: 'fixture-not-release',
    started_at: new Date(ended.getTime() - 90_000).toISOString(),
    ended_at: ended.toISOString(),
    outcome: 'interrupted',
    observed_ms: 65_000,
    repetitions: 0,
  }
  const saved = await post(context, '/records/stretch', record)
  expect(saved.status()).toBe(201)
  expect((await saved.json()).provenance).toBe('client-reported')
  await page.reload()
  await page.getByRole('link', { name: /^fixture-web-integration .*기록 상세/ }).click()
  await expect(page.getByRole('heading', { name: '수행 기록 상세' })).toBeVisible()
  await expect(
    page.getByText(
      '완료는 수행 흐름의 종료를 뜻하며, 자세 정확성이나 효과를 보장하는 점수가 아닙니다.',
    ),
  ).toBeVisible()
  await page.screenshot({ path: info.outputPath('integration-record-detail.png'), fullPage: true })
  await page.getByRole('link', { name: '기록 목록으로 돌아가기' }).click()
  await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(
    page.getByRole('link', { name: /^fixture-web-integration .*기록 상세/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  await expect(page.getByText('1건의 수행 기록을 삭제했습니다.', { exact: true })).toBeVisible()
  const records = await context.request.get('/api/v1/records/stretch')
  expect(records.status()).toBe(200)
  expect((await records.json()).items).toEqual([])
  await page.getByRole('link', { name: '내 계정', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeFocused()
  await page.setViewportSize({ width: 700, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('integration-account-700.png'), fullPage: true })
  // FR-U-04/NFR-08: bounded test-only operation boundary; never credentials or bodies.
  let logoutConfirmed = 0
  let logoutFailed = 0
  let csrfFailed = 0
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/api/v1/auth/logout' && response.status() === 204)
      logoutConfirmed++
  })
  page.on('requestfailed', (request) => {
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/auth/logout') logoutFailed++
    if (path === '/api/v1/auth/csrf') csrfFailed++
  })
  const confirmedLogout = page.waitForResponse(
    (response) =>
      new URL(response.url()).origin === origin &&
      new URL(response.url()).pathname === '/api/v1/auth/logout' &&
      response.request().method() === 'POST',
    { timeout: 5000 },
  )
  await page.getByRole('button', { name: '로그아웃', exact: true }).focus()
  await page.keyboard.press('Enter')
  expect((await confirmedLogout).status()).toBe(204)
  await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  const movedBeforeConfirmation = logoutConfirmed === 0
  try {
    expect(movedBeforeConfirmation).toBe(false)
    await page.goto('/records')
    await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    expect((await context.request.get('/api/v1/me')).status()).toBe(401)
  } finally {
    await info.attach('logout-completion-boundary.json', {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({ movedBeforeConfirmation, logoutConfirmed, logoutFailed, csrfFailed }),
      ),
    })
  }
})

test('WEB-I02 계정 장애 주입·공개 안내 보존·production 개발 경로 차단', async ({ page }, info) => {
  await page.route('**/api/v1/me', (route) => route.abort('failed'))
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: '연결을 확인해 주세요' })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toHaveCount(0)
  await page
    .getByRole('navigation', { name: '서비스 안내' })
    .getByRole('link', { name: '도움말', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: '도움말', level: 1 })).toBeVisible()
  await page.getByRole('link', { name: '카메라·데이터 안내 보기' }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: '카메라와 데이터 안내' })).toBeVisible()
  await page.setViewportSize({ width: 700, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: info.outputPath('integration-public-offline-700.png'),
    fullPage: true,
  })
  for (const path of ['/dev/measure', '/dev/select']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible()
    await expect(page.getByRole('button', { name: '측정 시작', exact: true })).toHaveCount(0)
  }
})
