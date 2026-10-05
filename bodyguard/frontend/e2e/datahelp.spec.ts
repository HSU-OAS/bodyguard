// FR-V-01/FR-U-04/05/NFR-08: production web and real API/SQL; synthetic mail only.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, type Locator, type Page, test } from '@playwright/test'

const mailbox = process.env.BODYGUARD_TEST_MAILBOX
if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  throw new Error('Owned mailbox required')
let cameraCalls = 0
let unexpectedRequests: string[] = []
let pageErrors: string[] = []
let apiRequests: string[] = []
test.beforeEach(async ({ page, context }) => {
  cameraCalls = 0
  unexpectedRequests = []
  pageErrors = []
  apiRequests = []
  await context.exposeBinding('__helpCamera', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (window as unknown as { __helpCamera: () => Promise<void> }).__helpCamera()
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
    if (url.pathname.startsWith('/api/')) apiRequests.push(`${request.method()} ${url.pathname}`)
  })
})
test.afterEach(async ({ page }) => {
  expect(cameraCalls).toBe(0)
  expect(unexpectedRequests).toEqual([])
  expect(pageErrors).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function contrast(element: Locator, property: 'color' | 'outlineColor') {
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
      const channels = numbers.map((channel) => {
        const v = channel / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722
    }
    const front = luminance(style[prop]),
      back = luminance(background)
    return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
  }, property)
}
test('DH-B01 공개 진입·FAQ 키보드·실제 스타일·좁은 웹·정보 조회 부작용0', async ({
  page,
}, info) => {
  await page.goto('/')
  await page
    .getByRole('navigation', { name: '서비스 안내' })
    .getByRole('link', { name: '도움말', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeFocused()
  await expect(page).toHaveTitle('도움말 · BODYGUARD')
  await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).focus()
  await page.keyboard.press('Tab')
  const summaries = page.locator('.guide-faq summary')
  await expect(summaries).toHaveCount(5)
  await expect(summaries.first()).toBeFocused()
  await expect(summaries.first()).toHaveCSS('outline-width', '3px')
  expect(await contrast(summaries.first(), 'outlineColor')).toBeGreaterThanOrEqual(3)
  await page.screenshot({ path: info.outputPath('help-keyboard-focus.png'), fullPage: true })
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Enter')
    await expect(page.locator('.guide-faq details').nth(index)).toHaveAttribute('open', '')
    await page.keyboard.press('Tab')
  }
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await noOverflow(page)
    expect(
      await contrast(page.locator('.guide-intro > p:last-child'), 'color'),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      await contrast(page.locator('.guide-faq details > p').first(), 'color'),
    ).toBeGreaterThanOrEqual(4.5)
    await page.screenshot({ path: info.outputPath(`help-${width}.png`), fullPage: true })
    for (const action of await page
      .locator('.guide-actions .button, .guide-link, .footer-link, .guide-faq summary')
      .all())
      expect(
        await action.evaluate((node) => node.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(48)
  }
  await page.getByRole('link', { name: '카메라·데이터 안내 보기' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '카메라와 데이터 안내' })).toBeFocused()
  await expect(page).toHaveTitle('카메라와 데이터 안내 · BODYGUARD')
  await expect(page.getByText('현재 카메라 코칭은 연결 전입니다.', { exact: true })).toBeVisible()
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.guide-actions .primary')).toHaveCSS('transition-duration', '0s')
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await noOverflow(page)
    expect(
      await contrast(page.locator('.guide-data-list dd').first(), 'color'),
    ).toBeGreaterThanOrEqual(4.5)
    expect(await contrast(page.locator('.guide-caption'), 'color')).toBeGreaterThanOrEqual(4.5)
    expect(await contrast(page.locator('.guide-actions .primary'), 'color')).toBeGreaterThanOrEqual(
      4.5,
    )
    await page.screenshot({ path: info.outputPath(`data-${width}.png`), fullPage: true })
  }
  await page.locator('.website').evaluate((node) => {
    ;(node as HTMLElement).style.zoom = '2'
  })
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('data-css-zoom-200.png'), fullPage: true })
  expect(apiRequests.every((entry) => entry === 'GET /api/v1/me')).toBe(true)
})
test('DH-B02 도움말→실제 가입→데이터→기록→계정→복구와 돌아가기', async ({ page }, info) => {
  const email = `help-${randomUUID()}@example.com`
  await page.goto('/help')
  await page.getByRole('link', { name: '이메일 가입', exact: true }).click()
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill('격리된 도움말 시험 비밀번호 12345')
  await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  await page.getByLabel('인증 코드', { exact: true }).fill(code)
  await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toBeVisible()
  apiRequests = []
  await page
    .getByRole('navigation', { name: '서비스 안내' })
    .getByRole('link', { name: '카메라·데이터 안내' })
    .click()
  await expect(page.getByRole('heading', { name: '카메라와 데이터 안내' })).toBeVisible()
  expect(apiRequests.every((entry) => entry === 'GET /api/v1/me')).toBe(true)
  await page.screenshot({ path: info.outputPath('data-member.png'), fullPage: true })
  await page.getByRole('link', { name: '수행 기록 관리', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 수행 기록' })).toBeVisible()
  await expect(page.getByText('이 기간에는 수행 기록이 없습니다', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '내 계정', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
  await page
    .getByRole('navigation', { name: '서비스 안내' })
    .getByRole('link', { name: '도움말', exact: true })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  await page.getByRole('link', { name: '계정 복구', exact: true }).click()
  await expect(page.getByRole('heading', { name: '비밀번호 재설정 요청' })).toBeVisible()
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('요청을 접수했습니다')
  await expect
    .poll(() => {
      const value = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      if (!value.startsWith('http://localhost:4173/password/reset#')) return false
      const url = new URL(value)
      const fragment = new URLSearchParams(url.hash.slice(1))
      // FR-U-03: verify the synthetic link without printing its token on assertion failure.
      return (
        url.pathname === '/password/reset' &&
        !url.search &&
        fragment.size === 1 &&
        /^[A-Za-z0-9_-]{43}$/.test(fragment.get('token') ?? '')
      )
    })
    .toBe(true)
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
})
test('DH-B03 계정 연결 실패 주입 중에도 공개 안내·FAQ·직접 주소 접근', async ({ page }, info) => {
  await page.route('**/api/v1/me', (route) => route.abort('failed'))
  await page.goto('/data')
  await expect(page.getByRole('heading', { level: 1, name: '카메라와 데이터 안내' })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 900 })
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('data-account-offline-375.png'), fullPage: true })
  await page.getByRole('link', { name: '이용 도움말 보기' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).click()
  await expect(page.getByRole('heading', { name: '연결을 확인해 주세요' })).toBeVisible()
  await page
    .getByRole('navigation', { name: '서비스 안내' })
    .getByRole('link', { name: '카메라·데이터 안내' })
    .click()
  await expect(page.getByRole('heading', { name: '카메라와 데이터 안내' })).toBeVisible()
  expect(apiRequests.every((entry) => entry === 'GET /api/v1/me')).toBe(true)
})
