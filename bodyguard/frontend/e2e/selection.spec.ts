// FR-S-01/06, FR-U-04, FR-V-03: actual Chrome with mocked /me, not actual auth/clinical approval.
import { expect, test } from '@playwright/test'

// FR-S-06: production entry screen, mocked account, no body analysis claim.
test('S3.2 protected production explore paths and purpose selection', async ({ page }, info) => {
  await page.goto('http://localhost:4182/start')
  await page.getByRole('link', { name: '스트레칭 시작 경로 선택' }).click()
  await expect(page.getByRole('heading', { name: '스트레칭 시작 경로' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  await page.getByRole('button', { name: '추천받기', exact: true }).click()
  await page.getByRole('radio', { name: '어깨', exact: true }).check()
  await expect(page.getByRole('status')).toContainText('신체 확인 정보가 없어')
  await page.screenshot({ path: info.outputPath('explore-recommendation.png'), fullPage: true })
  await page.getByRole('button', { name: '직접 선택으로 이동' }).click()
  await expect(page.getByRole('status')).toContainText('현재 이용 가능한 동작이 없습니다')
  await page.screenshot({ path: info.outputPath('explore-selection.png'), fullPage: true })
  await page.getByRole('link', { name: '내 시작으로 돌아가기' }).click()
  await expect(page).toHaveURL(/\/start$/)
})

let meStatus = 200

test('S3.3 expanded library search, guidance detail and return', async ({ page }, info) => {
  await page.goto('/dev/select')
  await expect(page.getByRole('heading', { name: '원하는 동작을 골라보세요' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('안내 5개')
  await page.getByRole('button', { name: '어깨', exact: true }).click()
  await page.getByRole('link', { name: '팔 교차 어깨 늘이기 안내 보기' }).click()
  await expect(page.getByText('안내만 후보 · 자동 판정 없음')).toBeVisible()
  await expect(page.getByRole('button', { name: '코칭 준비 중' })).toBeDisabled()
  await page.screenshot({ path: info.outputPath('guidance-shoulder.png'), fullPage: true })
  await page.getByRole('link', { name: '목록으로 돌아가기' }).click()
  await page.getByRole('button', { name: '상체', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('안내 2개')
  await page.screenshot({ path: info.outputPath('library-torso.png'), fullPage: true })
})
let cameraCalls = 0
let requests: string[] = []
let errors: string[] = []
let loginVisited = false

test.beforeEach(async ({ context, page }) => {
  meStatus = 200
  cameraCalls = 0
  requests = []
  errors = []
  loginVisited = false
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(request.url()))
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === '/login')
      loginVisited = true
  })
  await context.exposeBinding('__selectionCameraTest', () => {
    cameraCalls++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void (
        window as unknown as { __selectionCameraTest: () => Promise<void> }
      ).__selectionCameraTest()
      return Promise.reject(new Error('Unexpected camera request'))
    }
  })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== 'localhost' || !['5182', '4182'].includes(url.port)) {
      await route.abort('blockedbyclient')
    } else if (url.pathname === '/api/v1/me') {
      await route.fulfill({
        status: meStatus,
        contentType: 'application/json',
        body: JSON.stringify(
          meStatus === 200 ? { id: 'selection-fixture', email: 'fixture@example.com' } : {},
        ),
      })
    } else if (url.pathname === '/api/v1/auth/google/status') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"configured":false}',
      })
    } else if (url.pathname.startsWith('/api/')) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{}' })
    } else {
      await route.continue()
    }
  })
})
test.afterEach(async ({ page }) => {
  const apiPaths = requests
    .filter((url) => new URL(url).pathname.startsWith('/api/'))
    .map((url) => new URL(url).pathname)
  await test.info().attach('observations.json', {
    body: Buffer.from(
      JSON.stringify({
        apiPaths,
        cameraCalls,
        pageErrors: errors,
        viewport: page.viewportSize(),
        browserVersion: page.context().browser()?.version(),
        storageLengths: await page.evaluate(() => [localStorage.length, sessionStorage.length]),
        actualAuthServer: false,
        actualHumanCamera: false,
      }),
    ),
    contentType: 'application/json',
  })
  expect(cameraCalls).toBe(0)
  expect(errors).toEqual([])
  expect(
    requests.some((url) => /\.wasm|\.task|\.glb|MeasureDemoPage|mediapipe|three\.js/.test(url)),
  ).toBe(false)
  expect(
    apiPaths.filter(
      (value) =>
        value !== '/api/v1/me' && !(loginVisited && value === '/api/v1/auth/google/status'),
    ),
  ).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})

test('C-02/03/04/07 desktop selection, literal search, detail sources and Back', async ({
  page,
}, info) => {
  await page.goto('/dev/select')
  await expect(page.getByRole('heading', { name: '원하는 동작을 골라보세요' })).toBeVisible()
  await page.getByRole('link', { name: '내 시작', exact: true }).click()
  await page.getByRole('link', { name: '동작 선택 개발 검수' }).click()
  await expect(page).toHaveTitle('동작 선택 · BODYGUARD')
  await page.getByLabel('동작 검색').fill('목')
  await page.getByRole('button', { name: '목', exact: true }).click()
  await expect(page.getByRole('button', { name: '목', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.screenshot({ path: info.outputPath('catalog-desktop.png'), fullPage: true })
  await page.getByRole('link', { name: '목 옆으로 기울이기 안내 보기' }).click()
  await expect(page.getByRole('heading', { name: '목 옆으로 기울이기', level: 1 })).toBeFocused()
  await expect(page).toHaveTitle('목 옆으로 기울이기 · BODYGUARD')
  await expect(page.getByRole('button', { name: '코칭 준비 중' })).toBeDisabled()
  await page.getByText('참고 자료', { exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Cambridge University Hospitals · 원문' }),
  ).toHaveAttribute('rel', 'noopener noreferrer')
  await page.screenshot({ path: info.outputPath('detail-desktop.png'), fullPage: true })
  await page.goBack()
  await expect(page.getByLabel('동작 검색')).toHaveValue('목')
  await expect(page.getByRole('button', { name: '목', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('C-02/07 narrow laptop empty reset and keyboard operation', async ({ page }, info) => {
  await page.setViewportSize({ width: 700, height: 800 })
  await page.goto('/dev/select')
  const input = page.getByLabel('동작 검색')
  await input.fill('.*')
  await expect(page.getByText('조건에 맞는 동작이 없습니다')).toBeVisible()
  await page.getByRole('button', { name: '검색과 필터 초기화' }).click()
  await expect(input).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '전체', exact: true })).toBeFocused()
  await page.getByRole('link', { name: '목 옆으로 기울이기 안내 보기' }).click()
  await expect(page.getByRole('heading', { name: '목 옆으로 기울이기', level: 1 })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('detail-narrow.png'), fullPage: true })
})

test('C-04 missing direct ID is recoverable and not an external navigation', async ({
  page,
}, info) => {
  await page.goto('/dev/select?motion=https%3A%2F%2Fevil.example')
  await expect(page.getByRole('heading', { name: '동작을 찾을 수 없습니다' })).toBeVisible()
  await expect(page.getByRole('button', { name: '코칭 준비 중' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('missing-motion.png'), fullPage: true })
  await page.getByRole('link', { name: '목록으로 돌아가기' }).click()
  await expect(page.getByRole('heading', { name: '원하는 동작을 골라보세요' })).toBeVisible()
})

test('C-01 guest and server failure close the preview without a candidate fallback', async ({
  page,
}, info) => {
  meStatus = 401
  await page.goto('/dev/select?motion=neck-side')
  await expect(page).toHaveURL(/\/login\?next=%2Fstart$/)
  await expect(page.getByText('목 옆으로 기울이기', { exact: true })).toHaveCount(0)
  meStatus = 503
  await page.goto('/dev/select')
  await expect(page.getByRole('heading', { name: '연결을 확인해 주세요' })).toBeVisible()
  await page.screenshot({ path: info.outputPath('account-unavailable.png'), fullPage: true })
  meStatus = 200
  await page.getByRole('button', { name: '다시 확인' }).click()
  await expect(page.getByRole('heading', { name: '원하는 동작을 골라보세요' })).toBeVisible()
})

test('C-06 actual production hides the dev route, catalog and entry link', async ({
  page,
}, info) => {
  await page.goto('http://localhost:4182/dev/select?motion=neck-side')
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible()
  await expect(page.getByText('목 옆으로 기울이기', { exact: true })).toHaveCount(0)
  await page.goto('http://localhost:4182/start')
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toBeVisible()
  await expect(page.getByRole('link', { name: '동작 선택 개발 검수' })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('production-start.png'), fullPage: true })
})
