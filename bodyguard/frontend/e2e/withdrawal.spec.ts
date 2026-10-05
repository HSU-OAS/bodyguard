// FR-U-04/05/NFR-08: real production Chrome + HTTP/SQL, synthetic test-only mail/clock.
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test'

const origin = 'http://localhost:4173'
const password = '격리된 계정 웹 시험 비밀번호 12345'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const clock = process.env.BODYGUARD_TEST_RECORD_CLOCK
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !clock?.startsWith('/private/tmp/bodyguard-browser-')
)
  throw new Error('Isolated mailbox/clock required')
let requests: string[] = [],
  cameraCalls = 0,
  errors: string[] = []
test.beforeEach(async ({ context, page }) => {
  requests = []
  cameraCalls = 0
  errors = []
  writeFileSync(clock as string, '{"offset_seconds":0}')
  context.on('request', (request) => requests.push(request.url()))
  page.on('pageerror', (error) => errors.push(error.message))
  await context.exposeBinding('__accountWebCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __accountWebCamera: () => Promise<void> }).__accountWebCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
})
test.afterEach(async ({ page }) => {
  writeFileSync(clock as string, '{"offset_seconds":0}')
  expect(cameraCalls).toBe(0)
  expect(errors).toEqual([])
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true)
  expect(requests.some((url) => /\.glb|\.task|\.wasm|mediapipe/.test(url))).toBe(false)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})
async function post(context: BrowserContext, path: string, data?: unknown) {
  const csrf = await (await context.request.get(`${origin}/api/v1/auth/csrf`)).json()
  return context.request.post(`${origin}/api/v1${path}`, {
    headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
    data,
  })
}
async function mailCode(email: string) {
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  return code
}
async function join(context: BrowserContext) {
  const email = `account-web-${randomUUID()}@example.com`
  const result = await post(context, '/auth/signup', { email, password })
  expect(result.status()).toBe(202)
  const verified = await post(context, '/auth/verify', {
    challenge_id: (await result.json()).challenge_id,
    code: await mailCode(email),
  })
  expect(verified.status()).toBe(201)
  return email
}
async function seed(context: BrowserContext) {
  const end = new Date(Date.now() - 1000)
  const row = {
    id: randomUUID(),
    motion_id: 'synthetic-withdrawal',
    protocol_version: 'fixture-not-release',
    started_at: new Date(end.getTime() - 40000).toISOString(),
    ended_at: end.toISOString(),
    outcome: 'interrupted',
    observed_ms: 12000,
    repetitions: 0,
  }
  expect((await post(context, '/records/stretch', row)).status()).toBe(201)
  return row.id
}
async function begin(page: Page, email: string) {
  await page.goto('/account')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '회원 탈퇴 안내' }).click()
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  await expect(page.getByLabel('탈퇴 인증 코드')).toBeVisible()
  return mailCode(email)
}
async function consent(page: Page, code: string) {
  await page.getByLabel('탈퇴 인증 코드').fill(code)
  await page.getByLabel('확인문').fill('탈퇴')
  await page.getByRole('button', { name: '계정과 기록 삭제', exact: true }).click()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function contrast(element: Locator, property: 'color' | 'borderTopColor' | 'outlineColor') {
  return element.evaluate((node, prop) => {
    let parent: Element | null = node,
      background = 'rgb(255, 255, 255)'
    while (parent) {
      const value = getComputedStyle(parent).backgroundColor
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
        background = value
        break
      }
      parent = parent.parentElement
    }
    const luminance = (color: string) => {
      const values = color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number)
        .map((v) => {
          const n = v / 255
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
        })
      if (values?.length !== 3) throw new Error('Unsupported rendered color')
      return (values[0] ?? 0) * 0.2126 + (values[1] ?? 0) * 0.7152 + (values[2] ?? 0) * 0.0722
    }
    const front = luminance(getComputedStyle(node)[prop]),
      back = luminance(background)
    return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
  }, property)
}

test('AW-B01 계정·취소·기록 보존·좁은 웹·키보드·대비', async ({ page, context }, info) => {
  const email = await join(context),
    id = await seed(context)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: '내 계정' })).toBeVisible()
  await expect(page.getByRole('link', { name: '내 계정', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('link', { name: '수행 기록 관리' })).toHaveCSS(
    'background-color',
    'rgb(30, 90, 168)',
  )
  await page.screenshot({ path: info.outputPath('account-desktop.png'), fullPage: true })
  for (const width of [768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`account-${width}.png`), fullPage: true })
  }
  await page.getByRole('link', { name: '회원 탈퇴 안내' }).click()
  await page.screenshot({ path: info.outputPath('withdrawal-intro-375.png'), fullPage: true })
  expect(await contrast(page.locator('.member-lead'), 'color')).toBeGreaterThanOrEqual(4.5)
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  const code = page.getByLabel('탈퇴 인증 코드')
  await expect(code).toBeFocused()
  await expect(page.locator('.withdrawal-form')).toHaveCSS('margin-top', '32px')
  expect(await contrast(code, 'borderTopColor')).toBeGreaterThanOrEqual(3)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('확인문')).toBeFocused()
  await expect(page.getByLabel('확인문')).toHaveCSS('outline-width', '3px')
  expect(await contrast(page.getByLabel('확인문'), 'outlineColor')).toBeGreaterThanOrEqual(3)
  await page.getByLabel('탈퇴 인증 코드').fill(await mailCode(email))
  await expect(page.getByRole('button', { name: '계정과 기록 삭제', exact: true })).toBeDisabled()
  await page.getByLabel('확인문').fill('탈퇴')
  const final = page.getByRole('button', { name: '계정과 기록 삭제', exact: true })
  await page.mouse.move(0, 0)
  await expect(final).toHaveCSS('background-color', 'rgb(148, 58, 50)')
  expect(await contrast(final, 'color')).toBeGreaterThanOrEqual(4.5)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await expect(final).toHaveCSS('transition-duration', '0s')
  await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  await noOverflow(page)
  await page.screenshot({
    path: info.outputPath('withdrawal-confirm-375.png'),
    fullPage: true,
    mask: [code],
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    path: info.outputPath('withdrawal-confirm-desktop.png'),
    fullPage: true,
    mask: [code],
  })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = '2'
  })
  await noOverflow(page)
  await page.screenshot({
    path: info.outputPath('withdrawal-css-zoom-200.png'),
    fullPage: true,
    mask: [code],
  })
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = ''
  })
  await page.getByRole('link', { name: '탈퇴 취소하고 돌아가기' }).click()
  await expect(page.getByRole('heading', { name: '내 계정' })).toBeVisible()
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
  expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(0)
})

test('AW-B02 오답·최종 동의·204·기존 세션 이탈·타 계정 보존', async ({
  page,
  context,
  browser,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  const oldSession = await browser.newContext({ baseURL: origin })
  const other = await browser.newContext({ baseURL: origin })
  const otherTab = await context.newPage()
  otherTab.on('pageerror', (error) => errors.push(error.message))
  try {
    await otherTab.goto('/account')
    await expect(otherTab.getByText(email, { exact: true })).toBeVisible()
    expect((await post(oldSession, '/auth/login', { email, password })).status()).toBe(200)
    await join(other)
    const otherId = await seed(other)
    const code = await begin(page, email)
    await consent(page, `${(Number(code[0]) + 1) % 10}${code.slice(1)}`)
    await expect(page.getByRole('alert')).toContainText('인증 코드를 확인')
    expect(
      (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
        (row: { id: string }) => row.id,
      ),
    ).toEqual([id])
    await page.screenshot({ path: info.outputPath('withdrawal-wrong-code.png'), fullPage: true })
    let release: (() => void) | undefined
    const held = new Promise<void>((done) => {
      release = done
    })
    await page.route('**/api/v1/me/delete/confirm', async (route) => {
      const actual = await route.fetch()
      expect(actual.status()).toBe(204)
      await held
      await route.fulfill({ response: actual })
    })
    try {
      await consent(page, code)
      await expect(page.getByRole('button', { name: '삭제 결과 확인 중…' })).toBeDisabled()
      await expect(page.getByRole('link', { name: '내 계정', exact: true })).toHaveCount(0)
      await page.screenshot({
        path: info.outputPath('withdrawal-pending.png'),
        fullPage: true,
        mask: [page.getByLabel('탈퇴 인증 코드')],
      })
    } finally {
      release?.()
    }
    await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeFocused()
    await expect(otherTab.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    await page.setViewportSize({ width: 375, height: 900 })
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('withdrawal-completed-375.png'), fullPage: true })
    expect((await context.request.get(`${origin}/api/v1/me`)).status()).toBe(401)
    expect((await oldSession.request.get(`${origin}/api/v1/records/stretch/${id}`)).status()).toBe(
      401,
    )
    expect(
      (await (await other.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
        (row: { id: string }) => row.id,
      ),
    ).toEqual([otherId])
    await page.goto('/account')
    await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
    expect((await post(context, '/auth/login', { email, password })).status()).toBe(401)
    expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(2)
  } finally {
    await otherTab.close()
    await oldSession.close()
    await other.close()
  }
})

test('AW-B03 실제10분 확인 만료·새 발송·이전 확인 거부·기록 보존', async ({
  page,
  context,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  let first = ''
  page.on('response', async (response) => {
    if (response.url().endsWith('/me/delete/start') && response.status() === 202 && !first)
      first = (await response.json()).challenge_id
  })
  const oldCode = await begin(page, email)
  const next = `${clock}.next`
  writeFileSync(next, '{"offset_seconds":601}')
  renameSync(next, clock as string)
  await consent(page, oldCode)
  await expect(page.getByRole('alert')).toContainText('만료')
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
  await page.screenshot({ path: info.outputPath('withdrawal-expired.png'), fullPage: true })
  await page.getByRole('button', { name: '인증 코드 다시 받기' }).click()
  await expect(page.getByLabel('탈퇴 인증 코드')).toBeVisible()
  expect(
    (
      await post(context, '/me/delete/confirm', {
        challenge_id: first,
        code: oldCode,
        confirmation: 'delete-my-account',
      })
    ).status(),
  ).toBe(400)
  await consent(page, await mailCode(email))
  await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toBeVisible()
})

test('AW-B04 서버 삭제 후 응답 단절은 완료 추정·자동 삭제 재시도0', async ({
  page,
  context,
}, info) => {
  const email = await join(context)
  await seed(context)
  const code = await begin(page, email)
  await page.route('**/api/v1/me/delete/confirm', async (route) => {
    const actual = await route.fetch()
    expect(actual.status()).toBe(204)
    await route.abort('failed')
  })
  await consent(page, code)
  await expect(page.getByRole('heading', { name: '계정 상태를 다시 확인해 주세요' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCSS('color', 'rgb(156, 44, 35)')
  expect(await contrast(page.getByRole('alert'), 'color')).toBeGreaterThanOrEqual(4.5)
  await expect(page.getByRole('heading', { name: '회원 탈퇴가 완료되었습니다' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('withdrawal-response-lost.png'), fullPage: true })
  await page.getByRole('button', { name: '계정 상태 확인' }).click()
  await expect(page.getByRole('link', { name: '로그인하여 계정 확인' })).toBeVisible()
  expect((await context.request.get(`${origin}/api/v1/me`)).status()).toBe(401)
  expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(1)
})

test('AW-B05 서버 전 미전송 실패·결과 불확실 복구는 실제 계정·기록 보존', async ({
  page,
  context,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  const code = await begin(page, email)
  await page.route('**/api/v1/me/delete/confirm', (route) => route.abort('failed'))
  await consent(page, code)
  await expect(page.getByRole('heading', { name: '계정 상태를 다시 확인해 주세요' })).toBeVisible()
  await page.getByRole('button', { name: '계정 상태 확인' }).click()
  await page.getByRole('link', { name: '계정 관리로 돌아가기' }).click()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
  await page.screenshot({
    path: info.outputPath('withdrawal-failure-restored-account.png'),
    fullPage: true,
  })
  expect(requests.filter((url) => url.endsWith('/me/delete/confirm'))).toHaveLength(1)
})

test('AW-B06 429·메일 실패 응답 UI는 전송 완료·삭제로 표시하지 않음', async ({
  page,
  context,
}, info) => {
  const email = await join(context),
    id = await seed(context)
  await page.goto('/account/delete')
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  // Fault responses are injected here; real mail rejection/quota are API tests, not SMTP.
  await page.route('**/api/v1/me/delete/start', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  )
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  await expect(page.getByRole('alert')).toContainText('전송을 확인하지 못했습니다')
  await page.screenshot({ path: info.outputPath('withdrawal-send-error.png'), fullPage: true })
  await page.unroute('**/api/v1/me/delete/start')
  await page.route('**/api/v1/me/delete/start', (route) =>
    route.fulfill({ status: 429, headers: { 'Retry-After': '20' }, body: '{}' }),
  )
  await page.getByRole('button', { name: '탈퇴 인증 코드 받기' }).click()
  await expect(page.getByText(/다시 요청까지 \d+초/)).toBeVisible()
  await expect(page.getByRole('button', { name: '탈퇴 인증 코드 받기' })).toBeDisabled()
  await expect(page.getByLabel('탈퇴 인증 코드')).toHaveCount(0)
  await page.setViewportSize({ width: 375, height: 900 })
  await noOverflow(page)
  await page.screenshot({
    path: info.outputPath('withdrawal-rate-limited-375.png'),
    fullPage: true,
  })
  expect(
    (await (await context.request.get(`${origin}/api/v1/records/stretch`)).json()).items.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([id])
})
