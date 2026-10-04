# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: selection.spec.ts >> S3.3 expanded library search, guidance detail and return
- Location: e2e/selection.spec.ts:23:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('status')
Expected substring: "안내 5개"
Error: strict mode violation: getByRole('status') resolved to 2 elements:
    1) <span role="status" class="muted small">계정 확인 중</span> aka getByText('계정 확인 중')
    2) <section role="status" class="status-screen">…</section> aka getByText('계정을 확인하고 있습니다잠시만 기다려 주세요')

Call log:
  - Expect "toContainText" getByRole('status') with timeout 5000ms
  - waiting for getByRole('status')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - button "본문으로 이동" [ref=e4]
  - banner [ref=e5]:
    - link "BODYGUARD 서비스 소개" [ref=e6] [cursor=pointer]:
      - /url: /
      - text: BODYGUARD.
    - navigation "계정 메뉴" [ref=e7]:
      - link "내 시작" [ref=e8] [cursor=pointer]:
        - /url: /start
  - main [ref=e9]:
    - status [ref=e10]: 동작 안내를 여는 중입니다
  - contentinfo [ref=e11]:
    - generic [ref=e12]: BODYGUARD
    - paragraph [ref=e13]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
```

# Test source

```ts
  1   | // FR-S-01/06, FR-U-04, FR-V-03: actual Chrome with mocked /me, not actual auth/clinical approval.
  2   | import { expect, test } from '@playwright/test'
  3   | 
  4   | // FR-S-06: production entry screen, mocked account, no body analysis claim.
  5   | test('S3.2 protected production explore paths and purpose selection', async ({ page }, info) => {
  6   |   await page.goto('http://localhost:4182/start')
  7   |   await page.getByRole('link', { name: '스트레칭 시작 경로 선택' }).click()
  8   |   await expect(page.getByRole('heading', { name: '스트레칭 시작 경로' })).toBeVisible()
  9   |   await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  10  |   await page.getByRole('button', { name: '추천받기', exact: true }).click()
  11  |   await page.getByRole('radio', { name: '어깨', exact: true }).check()
  12  |   await expect(page.getByRole('status')).toContainText('신체 확인 정보가 없어')
  13  |   await page.screenshot({ path: info.outputPath('explore-recommendation.png'), fullPage: true })
  14  |   await page.getByRole('button', { name: '직접 선택으로 이동' }).click()
  15  |   await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  16  |   await page.screenshot({ path: info.outputPath('explore-selection.png'), fullPage: true })
  17  |   await page.getByRole('link', { name: '내 시작으로 돌아가기' }).click()
  18  |   await expect(page).toHaveURL(/\/start$/)
  19  | })
  20  | 
  21  | let meStatus = 200
  22  | 
  23  | test('S3.3 expanded library search, guidance detail and return', async ({ page }, info) => {
  24  |   await page.goto('/dev/select')
> 25  |   await expect(page.getByRole('status')).toContainText('안내 5개')
      |                                          ^ Error: expect(locator).toContainText(expected) failed
  26  |   await page.getByRole('button', { name: '어깨', exact: true }).click()
  27  |   await page.getByRole('link', { name: '팔 교차 어깨 늘이기 안내 보기' }).click()
  28  |   await expect(page.getByText('안내만 후보 · 자동 판정 없음')).toBeVisible()
  29  |   await expect(page.getByRole('button', { name: '코칭 준비 중' })).toBeDisabled()
  30  |   await page.screenshot({ path: info.outputPath('guidance-shoulder.png'), fullPage: true })
  31  |   await page.getByRole('link', { name: '목록으로 돌아가기' }).click()
  32  |   await page.getByRole('button', { name: '상체', exact: true }).click()
  33  |   await expect(page.getByRole('status')).toContainText('안내 2개')
  34  |   await page.screenshot({ path: info.outputPath('library-torso.png'), fullPage: true })
  35  | })
  36  | let cameraCalls = 0
  37  | let requests: string[] = []
  38  | let errors: string[] = []
  39  | let loginVisited = false
  40  | 
  41  | test.beforeEach(async ({ context, page }) => {
  42  |   meStatus = 200
  43  |   cameraCalls = 0
  44  |   requests = []
  45  |   errors = []
  46  |   loginVisited = false
  47  |   page.on('pageerror', (error) => errors.push(error.message))
  48  |   page.on('request', (request) => requests.push(request.url()))
  49  |   page.on('framenavigated', (frame) => {
  50  |     if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/login')
  51  |       loginVisited = true
  52  |   })
  53  |   await context.exposeBinding('__selectionCameraTest', () => {
  54  |     cameraCalls++
  55  |   })
  56  |   await context.addInitScript(() => {
  57  |     navigator.mediaDevices.getUserMedia = () => {
  58  |       void (
  59  |         window as unknown as { __selectionCameraTest: () => Promise<void> }
  60  |       ).__selectionCameraTest()
  61  |       return Promise.reject(new Error('Unexpected camera request'))
  62  |     }
  63  |   })
  64  |   await context.route('**/*', async (route) => {
  65  |     const url = new URL(route.request().url())
  66  |     if (url.hostname !== 'localhost' || !['5182', '4182'].includes(url.port)) {
  67  |       await route.abort('blockedbyclient')
  68  |     } else if (url.pathname === '/api/v1/me') {
  69  |       await route.fulfill({
  70  |         status: meStatus,
  71  |         contentType: 'application/json',
  72  |         body: JSON.stringify(
  73  |           meStatus === 200 ? { id: 'selection-fixture', email: 'fixture@example.com' } : {},
  74  |         ),
  75  |       })
  76  |     } else if (url.pathname === '/api/v1/auth/google/status') {
  77  |       await route.fulfill({
  78  |         status: 200,
  79  |         contentType: 'application/json',
  80  |         body: '{"configured":false}',
  81  |       })
  82  |     } else if (url.pathname.startsWith('/api/')) {
  83  |       await route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
  84  |     } else {
  85  |       await route.continue()
  86  |     }
  87  |   })
  88  | })
  89  | test.afterEach(async ({ page }) => {
  90  |   const apiPaths = requests
  91  |     .filter((url) => new URL(url).pathname.startsWith('/api/'))
  92  |     .map((url) => new URL(url).pathname)
  93  |   await test.info().attach('observations.json', {
  94  |     body: Buffer.from(
  95  |       JSON.stringify({
  96  |         apiPaths,
  97  |         cameraCalls,
  98  |         pageErrors: errors,
  99  |         viewport: page.viewportSize(),
  100 |         browserVersion: page.context().browser()?.version(),
  101 |         storageLengths: await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  102 |         actualAuthServer: false,
  103 |         actualHumanCamera: false,
  104 |       }),
  105 |     ),
  106 |     contentType: 'application/json',
  107 |   })
  108 |   expect(cameraCalls).toBe(0)
  109 |   expect(errors).toEqual([])
  110 |   expect(
  111 |     requests.some((url) => /\.wasm|\.task|\.glb|MeasureDemoPage|mediapipe|three\.js/.test(url)),
  112 |   ).toBe(false)
  113 |   expect(
  114 |     apiPaths.filter(
  115 |       (value) =>
  116 |         value !== '/api/v1/me' && !(loginVisited && value === '/api/v1/auth/google/status'),
  117 |     ),
  118 |   ).toEqual([])
  119 |   expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  120 | })
  121 | 
  122 | test('C-02/03/04/07 desktop selection, literal search, detail sources and Back', async ({
  123 |   page,
  124 | }, info) => {
  125 |   await page.goto('/dev/select')
```