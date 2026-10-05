// FR-V-01/FR-U-04/NFR-08: real production CSS, API and SQL; synthetic mailbox only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, type Locator, type Page, test } from '@playwright/test'

const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Isolated mailbox required')
let cameraCalls = 0
let unexpectedRequests: string[] = []
let pageErrors: string[] = []
test.beforeEach(async ({ page, context }) => {
  cameraCalls = 0
  unexpectedRequests = []
  pageErrors = []
  await context.exposeBinding('__designCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __designCamera: () => Promise<void> }).__designCamera()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (
      url.origin !== 'http://localhost:4173' ||
      /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname)
    )
      unexpectedRequests.push(url.origin + url.pathname)
  })
})
test.afterEach(async ({ page }) => {
  expect(cameraCalls).toBe(0)
  expect(unexpectedRequests).toEqual([])
  expect(pageErrors).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})

async function ratio(element: Locator, property: 'color' | 'borderTopColor' | 'outlineColor') {
  return element.evaluate((node, prop) => {
    const style = getComputedStyle(node)
    let parent: Element | null = node
    let background = 'rgb(255, 255, 255)'
    while (parent) {
      const value = getComputedStyle(parent).backgroundColor
      if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
        background = value
        break
      }
      parent = parent.parentElement
    }
    const luminance = (color: string) => {
      const numbers =
        color
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number) ?? []
      if (numbers.length !== 3) throw new Error('Unsupported rendered color')
      const values = numbers.map((channel) => {
        const v = channel / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return (values[0] ?? 0) * 0.2126 + (values[1] ?? 0) * 0.7152 + (values[2] ?? 0) * 0.0722
    }
    const front = luminance(style[prop]),
      back = luminance(background)
    return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
  }, property)
}
async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function blueAction(action: Locator) {
  // A previous click leaves :hover active; check normal and hover separately.
  await action.page().mouse.move(0, 0)
  await expect(action).toHaveCSS('background-color', 'rgb(30, 90, 168)')
  expect(await ratio(action, 'color')).toBeGreaterThanOrEqual(4.5)
}

test('D-01 소개·로그인·가입·복구의 실제 블루·좁은 웹·키보드·동작 감소', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible()
  const start = page.getByRole('link', { name: '시작하기', exact: true })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await blueAction(start)
  await start.hover()
  await expect(start).toHaveCSS('background-color', 'rgb(22, 71, 128)')
  expect(await ratio(start, 'color')).toBeGreaterThanOrEqual(4.5)
  await page.mouse.move(0, 0)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await page.emulateMedia({ colorScheme: 'light' })
  expect(await ratio(page.locator('.hero-description'), 'color')).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: info.outputPath('home-desktop.png'), fullPage: true })
  for (const width of [700, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await noPageOverflow(page)
    await expect(start).toBeVisible()
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const [route, imageName] of [
    ['/login', 'login'],
    ['/signup', 'signup'],
    ['/password/forgot', 'recovery'],
  ]) {
    await page.goto(route as string)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const input = page.getByLabel('이메일', { exact: true })
    expect(await ratio(input, 'borderTopColor')).toBeGreaterThanOrEqual(3)
    await page.screenshot({ path: info.outputPath(`${imageName}-desktop.png`), fullPage: true })
    await page.setViewportSize({ width: 375, height: 900 })
    await noPageOverflow(page)
    await page.screenshot({ path: info.outputPath(`${imageName}-375.png`), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  await page.goto('/login')
  await page.getByLabel('이메일', { exact: true }).focus()
  await page.keyboard.press('Tab')
  const password = page.getByLabel('비밀번호', { exact: true })
  await expect(password).toBeFocused()
  await expect(password).toHaveCSS('outline-width', '3px')
  expect(await ratio(password, 'outlineColor')).toBeGreaterThanOrEqual(3)
  await page.screenshot({ path: info.outputPath('login-focus.png'), fullPage: true })
  const submit = page.getByRole('button', { name: '로그인', exact: true })
  await expect(submit).toHaveCSS('transition-duration', '0.12s, 0.12s')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(submit).toHaveCSS('transition-duration', '0s')
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = '2'
  })
  await noPageOverflow(page)
  await page.screenshot({ path: info.outputPath('login-css-zoom-200.png'), fullPage: true })
})

test('D-02 실제 가입 처리중·오답·성공과 시작·경로 선택·기록 빈 화면', async ({ page }, info) => {
  const email = `design-${randomUUID()}@example.com`
  await page.goto('/signup')
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill('격리된 디자인 시험 비밀번호 12345')
  let release: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/auth/signup', async (route) => {
    const actual = await route.fetch()
    await held
    await route.fulfill({ response: actual })
  })
  try {
    await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
    await expect(page.getByRole('button', { name: '처리 중…' })).toBeDisabled()
    await page.screenshot({ path: info.outputPath('signup-pending.png'), fullPage: true })
  } finally {
    release?.()
  }
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  await page
    .getByLabel('인증 코드', { exact: true })
    .fill(`${(Number(code[0]) + 1) % 10}${code.slice(1)}`)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByRole('alert')).toContainText('인증 코드를 확인')
  expect(await ratio(page.getByRole('alert'), 'color')).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: info.outputPath('verification-error.png'), fullPage: true })
  await page.getByLabel('인증 코드', { exact: true }).fill(code)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('start-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 375, height: 900 })
  await noPageOverflow(page)
  await page.screenshot({ path: info.outputPath('start-375.png'), fullPage: true })
  await page.getByRole('link', { name: '스트레칭 시작 경로 선택' }).click()
  const selection = page.getByRole('button', { name: '직접 고르기', exact: true })
  await blueAction(selection)
  await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  await noPageOverflow(page)
  await page.getByRole('button', { name: '추천받기', exact: true }).click()
  await blueAction(page.getByRole('button', { name: '추천받기', exact: true }))
  await page.getByRole('radio', { name: '어깨', exact: true }).check()
  await expect(page.getByRole('radio', { name: '어깨', exact: true })).toBeChecked()
  await page.screenshot({ path: info.outputPath('explore-375.png'), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: info.outputPath('explore-desktop.png'), fullPage: true })
  await page.getByRole('link', { name: '수행 기록', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 수행 기록' })).toBeVisible()
  await expect(page.getByText('이 기간에는 수행 기록이 없습니다', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('records-empty-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 375, height: 900 })
  await noPageOverflow(page)
  await page.screenshot({ path: info.outputPath('records-empty-375.png'), fullPage: true })
})

test('D-03 주입한 연결 실패에서도 안전한 재시도·화이트 블루 유지', async ({ page }, info) => {
  await page.route('**/api/v1/me', (route) => route.abort('failed'))
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: '연결을 확인해 주세요' })).toBeVisible()
  await blueAction(page.getByRole('button', { name: '다시 확인' }))
  await page.setViewportSize({ width: 375, height: 900 })
  await noPageOverflow(page)
  await page.screenshot({ path: info.outputPath('connection-error-375.png'), fullPage: true })
  await page.unroute('**/api/v1/me')
  await page.getByRole('button', { name: '다시 확인' }).click()
  await expect(page).toHaveURL(/\/login/)
})
