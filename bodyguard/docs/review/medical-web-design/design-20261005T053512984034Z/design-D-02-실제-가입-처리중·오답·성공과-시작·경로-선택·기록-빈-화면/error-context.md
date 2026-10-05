# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: design.spec.ts >> D-02 실제 가입 처리중·오답·성공과 시작·경로 선택·기록 빈 화면
- Location: e2e/design.spec.ts:130:1

# Error details

```
Error: expect(locator).toHaveCSS(expected) failed

Locator:  getByRole('button', { name: '추천받기', exact: true })
Expected: "rgb(30, 90, 168)"
Received: "rgb(22, 71, 128)"
Timeout:  5000ms

Call log:
  - Expect "toHaveCSS" getByRole('button', { name: '추천받기', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: '추천받기', exact: true })
    - locator resolved to <button type="button" aria-pressed="true" class="button secondary">추천받기</button>
    - unexpected value "rgba(22, 71, 128, 0.416)"
    11 × locator resolved to <button type="button" aria-pressed="true" class="button secondary">추천받기</button>
       - unexpected value "rgb(22, 71, 128)"

```

```yaml
- button "추천받기" [pressed]
```

# Test source

```ts
  1   | // FR-V-01/FR-U-04/NFR-08: real production CSS, API and SQL; synthetic mailbox only.
  2   | import { randomUUID } from 'node:crypto'
  3   | import { readFileSync } from 'node:fs'
  4   | import { expect, type Locator, type Page, test } from '@playwright/test'
  5   |
  6   | const mailbox = process.env.BODYGUARD_TEST_MAILBOX
  7   | if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  8   |   throw new Error('Isolated mailbox required')
  9   | let cameraCalls = 0
  10  | let unexpectedRequests: string[] = []
  11  | let pageErrors: string[] = []
  12  | test.beforeEach(async ({ page, context }) => {
  13  |   cameraCalls = 0
  14  |   unexpectedRequests = []
  15  |   pageErrors = []
  16  |   await context.exposeBinding('__designCamera', () => {
  17  |     cameraCalls++
  18  |   })
  19  |   await context.addInitScript(() => {
  20  |     navigator.mediaDevices.getUserMedia = () => {
  21  |       void (window as unknown as { __designCamera: () => Promise<void> }).__designCamera()
  22  |       return Promise.reject(new Error('Unexpected camera request'))
  23  |     }
  24  |   })
  25  |   page.on('pageerror', (error) => pageErrors.push(error.message))
  26  |   page.on('request', (request) => {
  27  |     const url = new URL(request.url())
  28  |     if (
  29  |       url.origin !== 'http://localhost:4173' ||
  30  |       /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname)
  31  |     )
  32  |       unexpectedRequests.push(url.origin + url.pathname)
  33  |   })
  34  | })
  35  | test.afterEach(async ({ page }) => {
  36  |   expect(cameraCalls).toBe(0)
  37  |   expect(unexpectedRequests).toEqual([])
  38  |   expect(pageErrors).toEqual([])
  39  |   expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  40  | })
  41  |
  42  | async function ratio(element: Locator, property: 'color' | 'borderTopColor' | 'outlineColor') {
  43  |   return element.evaluate((node, prop) => {
  44  |     const style = getComputedStyle(node)
  45  |     let parent: Element | null = node
  46  |     let background = 'rgb(255, 255, 255)'
  47  |     while (parent) {
  48  |       const value = getComputedStyle(parent).backgroundColor
  49  |       if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
  50  |         background = value
  51  |         break
  52  |       }
  53  |       parent = parent.parentElement
  54  |     }
  55  |     const luminance = (color: string) => {
  56  |       const numbers =
  57  |         color
  58  |           .match(/[\d.]+/g)
  59  |           ?.slice(0, 3)
  60  |           .map(Number) ?? []
  61  |       if (numbers.length !== 3) throw new Error('Unsupported rendered color')
  62  |       const values = numbers.map((channel) => {
  63  |         const v = channel / 255
  64  |         return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  65  |       })
  66  |       return (values[0] ?? 0) * 0.2126 + (values[1] ?? 0) * 0.7152 + (values[2] ?? 0) * 0.0722
  67  |     }
  68  |     const front = luminance(style[prop]),
  69  |       back = luminance(background)
  70  |     return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05)
  71  |   }, property)
  72  | }
  73  | async function noPageOverflow(page: Page) {
  74  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  75  | }
  76  | async function blueAction(action: Locator) {
> 77  |   await expect(action).toHaveCSS('background-color', 'rgb(30, 90, 168)')
      |                        ^ Error: expect(locator).toHaveCSS(expected) failed
  78  |   expect(await ratio(action, 'color')).toBeGreaterThanOrEqual(4.5)
  79  | }
  80  |
  81  | test('D-01 소개·로그인·가입·복구의 실제 블루·좁은 웹·키보드·동작 감소', async ({ page }, info) => {
  82  |   await page.goto('/')
  83  |   const start = page.getByRole('link', { name: '시작하기', exact: true })
  84  |   await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  85  |   await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  86  |   await blueAction(start)
  87  |   expect(await ratio(page.locator('.hero-description'), 'color')).toBeGreaterThanOrEqual(4.5)
  88  |   await page.screenshot({ path: info.outputPath('home-desktop.png'), fullPage: true })
  89  |   for (const width of [700, 375]) {
  90  |     await page.setViewportSize({ width, height: 900 })
  91  |     await noPageOverflow(page)
  92  |     await expect(start).toBeVisible()
  93  |     await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true })
  94  |   }
  95  |   await page.setViewportSize({ width: 1440, height: 1000 })
  96  |   for (const [route, imageName] of [
  97  |     ['/login', 'login'],
  98  |     ['/signup', 'signup'],
  99  |     ['/password/forgot', 'recovery'],
  100 |   ]) {
  101 |     await page.goto(route as string)
  102 |     await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  103 |     const input = page.getByLabel('이메일', { exact: true })
  104 |     expect(await ratio(input, 'borderTopColor')).toBeGreaterThanOrEqual(3)
  105 |     await page.screenshot({ path: info.outputPath(`${imageName}-desktop.png`), fullPage: true })
  106 |     await page.setViewportSize({ width: 375, height: 900 })
  107 |     await noPageOverflow(page)
  108 |     await page.screenshot({ path: info.outputPath(`${imageName}-375.png`), fullPage: true })
  109 |     await page.setViewportSize({ width: 1440, height: 1000 })
  110 |   }
  111 |   await page.goto('/login')
  112 |   await page.getByLabel('이메일', { exact: true }).focus()
  113 |   await page.keyboard.press('Tab')
  114 |   const password = page.getByLabel('비밀번호', { exact: true })
  115 |   await expect(password).toBeFocused()
  116 |   await expect(password).toHaveCSS('outline-width', '3px')
  117 |   expect(await ratio(password, 'outlineColor')).toBeGreaterThanOrEqual(3)
  118 |   await page.screenshot({ path: info.outputPath('login-focus.png'), fullPage: true })
  119 |   const submit = page.getByRole('button', { name: '로그인', exact: true })
  120 |   await expect(submit).toHaveCSS('transition-duration', '0.12s, 0.12s')
  121 |   await page.emulateMedia({ reducedMotion: 'reduce' })
  122 |   await expect(submit).toHaveCSS('transition-duration', '0s')
  123 |   await page.locator('.website').evaluate((node) => {
  124 |     ;(node as HTMLElement).style.zoom = '2'
  125 |   })
  126 |   await noPageOverflow(page)
  127 |   await page.screenshot({ path: info.outputPath('login-css-zoom-200.png'), fullPage: true })
  128 | })
  129 |
  130 | test('D-02 실제 가입 처리중·오답·성공과 시작·경로 선택·기록 빈 화면', async ({ page }, info) => {
  131 |   const email = `design-${randomUUID()}@example.com`
  132 |   await page.goto('/signup')
  133 |   await page.getByLabel('이메일', { exact: true }).fill(email)
  134 |   await page.getByLabel('비밀번호', { exact: true }).fill('격리된 디자인 시험 비밀번호 12345')
  135 |   let release: (() => void) | undefined
  136 |   const held = new Promise<void>((resolve) => {
  137 |     release = resolve
  138 |   })
  139 |   await page.route('**/api/v1/auth/signup', async (route) => {
  140 |     const actual = await route.fetch()
  141 |     await held
  142 |     await route.fulfill({ response: actual })
  143 |   })
  144 |   try {
  145 |     await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  146 |     await expect(page.getByRole('button', { name: '처리 중…' })).toBeDisabled()
  147 |     await page.screenshot({ path: info.outputPath('signup-pending.png'), fullPage: true })
  148 |   } finally {
  149 |     release?.()
  150 |   }
  151 |   await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  152 |   let code = ''
  153 |   await expect
  154 |     .poll(() => {
  155 |       code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
  156 |       return code
  157 |     })
  158 |     .toMatch(/^[0-9]{6}$/)
  159 |   await page
  160 |     .getByLabel('인증 코드', { exact: true })
  161 |     .fill(`${(Number(code[0]) + 1) % 10}${code.slice(1)}`)
  162 |   await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  163 |   await expect(page.getByRole('alert')).toContainText('인증 코드를 확인')
  164 |   expect(await ratio(page.getByRole('alert'), 'color')).toBeGreaterThanOrEqual(4.5)
  165 |   await page.screenshot({ path: info.outputPath('verification-error.png'), fullPage: true })
  166 |   await page.getByLabel('인증 코드', { exact: true }).fill(code)
  167 |   await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  168 |   await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toBeVisible()
  169 |   await page.screenshot({ path: info.outputPath('start-desktop.png'), fullPage: true })
  170 |   await page.setViewportSize({ width: 375, height: 900 })
  171 |   await noPageOverflow(page)
  172 |   await page.screenshot({ path: info.outputPath('start-375.png'), fullPage: true })
  173 |   await page.getByRole('link', { name: '스트레칭 시작 경로 선택' }).click()
  174 |   const selection = page.getByRole('button', { name: '직접 고르기', exact: true })
  175 |   await blueAction(selection)
  176 |   await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  177 |   await noPageOverflow(page)
```