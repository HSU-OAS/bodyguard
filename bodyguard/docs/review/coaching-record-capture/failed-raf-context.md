# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: selection.spec.ts >> L08 actual RAF loop start-pause-resume-close with synthetic resources, no camera
- Location: e2e/selection.spec.ts:4:1

# Error details

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

# Test source

```ts
  1   | // FR-S-01/06, FR-U-04, FR-V-03: actual Chrome with mocked /me, not actual auth/clinical approval.
  2   | import { expect, test } from '@playwright/test'
  3   |
  4   | test('L08 actual RAF loop start-pause-resume-close with synthetic resources, no camera', async ({
  5   |   page,
  6   | }, info) => {
  7   |   await page.goto('/dev/select')
> 8   |   const result = await page.evaluate(async () => {
      |                             ^ Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
  9   |     const path = '/e2e/fixtures/observationLoopProbe.ts'
  10  |     const module = (await import(path)) as typeof import('./fixtures/observationLoopProbe')
  11  |     return module.probeObservationLoop()
  12  |   })
  13  |   await info.attach('observation-loop-browser.json', {
  14  |     contentType: 'application/json',
  15  |     body: Buffer.from(JSON.stringify(result, null, 2)),
  16  |   })
  17  |   expect(result.pause_stopped).toBe(true)
  18  |   expect(result.old_signals_aborted).toBe(true)
  19  |   expect(result.close_stopped).toBe(true)
  20  |   expect(result.all_signals_aborted).toBe(true)
  21  |   expect(result.resources_created).toBe(6)
  22  |   expect(result.all_resources_disposed_once).toBe(true)
  23  |   expect(result.generation).toBe(2)
  24  |   expect(result.outcome).toBe('interrupted')
  25  |   expect(result.reason).toBe('page-hidden')
  26  |   expect(result.verified_ms).toBe(0)
  27  | })
  28  |
  29  | // FR-S-06: production entry screen, mocked account, no body analysis claim.
  30  | test('S3.2 protected production explore paths and purpose selection', async ({ page }, info) => {
  31  |   await page.goto('http://localhost:4182/start')
  32  |   await page.getByRole('link', { name: '스트레칭 시작 경로 선택' }).click()
  33  |   await expect(page.getByRole('heading', { name: '스트레칭 시작 경로' })).toBeVisible()
  34  |   await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  35  |   await page.getByRole('button', { name: '추천받기', exact: true }).click()
  36  |   await page.getByRole('radio', { name: '어깨', exact: true }).check()
  37  |   await expect(page.getByRole('status')).toContainText('신체 확인 정보가 없어')
  38  |   await page.screenshot({ path: info.outputPath('explore-recommendation.png'), fullPage: true })
  39  |   await page.getByRole('button', { name: '직접 선택으로 이동' }).click()
  40  |   await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  41  |   await page.screenshot({ path: info.outputPath('explore-selection.png'), fullPage: true })
  42  |   await page.getByRole('link', { name: '내 시작으로 돌아가기' }).click()
  43  |   await expect(page).toHaveURL(/\/start$/)
  44  | })
  45  |
  46  | let meStatus = 200
  47  |
  48  | test('S3.3 expanded library search, guidance detail and return', async ({ page }, info) => {
  49  |   await page.goto('/dev/select')
  50  |   await expect(page.getByRole('heading', { name: '원하는 동작을 골라보세요' })).toBeVisible()
  51  |   await expect(page.getByRole('status')).toContainText('안내 5개')
  52  |   await page.getByRole('button', { name: '어깨', exact: true }).click()
  53  |   await page.getByRole('link', { name: '팔 교차 어깨 늘이기 안내 보기' }).click()
  54  |   await expect(page.getByText('안내만 후보 · 자동 판정 없음')).toBeVisible()
  55  |   await expect(page.getByRole('button', { name: '코칭 준비 중' })).toBeDisabled()
  56  |   await page.screenshot({ path: info.outputPath('guidance-shoulder.png'), fullPage: true })
  57  |   await page.getByRole('link', { name: '목록으로 돌아가기' }).click()
  58  |   await page.getByRole('button', { name: '상체', exact: true }).click()
  59  |   await expect(page.getByRole('status')).toContainText('안내 2개')
  60  |   await page.screenshot({ path: info.outputPath('library-torso.png'), fullPage: true })
  61  | })
  62  | let cameraCalls = 0
  63  | let requests: string[] = []
  64  | let errors: string[] = []
  65  | let loginVisited = false
  66  |
  67  | test.beforeEach(async ({ context, page }) => {
  68  |   meStatus = 200
  69  |   cameraCalls = 0
  70  |   requests = []
  71  |   errors = []
  72  |   loginVisited = false
  73  |   page.on('pageerror', (error) => errors.push(error.message))
  74  |   page.on('request', (request) => requests.push(request.url()))
  75  |   page.on('framenavigated', (frame) => {
  76  |     if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/login')
  77  |       loginVisited = true
  78  |   })
  79  |   await context.exposeBinding('__selectionCameraTest', () => {
  80  |     cameraCalls++
  81  |   })
  82  |   await context.addInitScript(() => {
  83  |     navigator.mediaDevices.getUserMedia = () => {
  84  |       void (
  85  |         window as unknown as { __selectionCameraTest: () => Promise<void> }
  86  |       ).__selectionCameraTest()
  87  |       return Promise.reject(new Error('Unexpected camera request'))
  88  |     }
  89  |   })
  90  |   await context.route('**/*', async (route) => {
  91  |     const url = new URL(route.request().url())
  92  |     if (url.hostname !== 'localhost' || !['5182', '4182'].includes(url.port)) {
  93  |       await route.abort('blockedbyclient')
  94  |     } else if (url.pathname === '/api/v1/me') {
  95  |       await route.fulfill({
  96  |         status: meStatus,
  97  |         contentType: 'application/json',
  98  |         body: JSON.stringify(
  99  |           meStatus === 200 ? { id: 'selection-fixture', email: 'fixture@example.com' } : {},
  100 |         ),
  101 |       })
  102 |     } else if (url.pathname === '/api/v1/auth/google/status') {
  103 |       await route.fulfill({
  104 |         status: 200,
  105 |         contentType: 'application/json',
  106 |         body: '{"configured":false}',
  107 |       })
  108 |     } else if (url.pathname.startsWith('/api/')) {
```