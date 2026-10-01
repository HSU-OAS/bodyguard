import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0
    navigator.mediaDevices.getUserMedia = () => {
      calls++
      return Promise.reject(new Error('검수에 카메라를 요청하면 안 됩니다'))
    }
    Object.defineProperty(window, 'avatarCameraCalls', { get: () => calls })
  })
  await page.route('http://localhost:5182/api/**', (route) =>
    route.fulfill({ status: 401, body: '{}' }),
  )
})

test('A-06 실제 남녀 GLB 두 복제본을 로드하고 한쪽 기술 변형이 다른 뼈대를 바꾸지 않는다', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    // The account endpoint is intentionally guest/401, not part of this GPU test.
    const guestFixture =
      message.location().url === 'http://localhost:5182/api/v1/me' &&
      message.text() ===
        'Failed to load resource: the server responded with a status of 401 (Unauthorized)'
    if (message.type() === 'error' && !guestFixture) errors.push(message.text())
  })
  await page.goto('/dev/avatar')
  const read = async () =>
    JSON.parse((await page.getByTestId('avatar-report').getAttribute('data-report')) || '{}')
  for (const gender of ['남성', '여성']) {
    await page.getByRole('button', { name: gender, exact: true }).click()
    await expect(page.getByRole('status', { name: '모델 연결 상태' })).toHaveText(
      '동일한 모델 · 독립된 두 뼈대',
      {
        timeout: 30_000,
      },
    )
    await expect.poll(async () => (await read()).samples, { timeout: 30_000 }).toBe(180)
    let result = await read()
    expect(result.draw_calls).toBeGreaterThan(0)
    expect(result.triangles).toBeGreaterThan(100_000)
    expect(result.skeletons_independent).toBe(true)
    expect(result.eight_weight_meshes).toBeGreaterThanOrEqual(4)
    expect(result.static_angle_max).toBeLessThan(0.00001)
    expect(result.moving_angle_max).toBeLessThan(0.00001)
    await page.getByRole('button', { name: '기술 변형 시작' }).click()
    await expect.poll(async () => (await read()).samples, { timeout: 30_000 }).toBe(180)
    result = await read()
    expect(result.static_angle_max).toBeLessThan(0.00001)
    expect(result.moving_angle_max).toBeGreaterThan(0.1)
    await testInfo.attach(`${gender}-technical-render`, {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json',
    })
    await page.screenshot({ path: testInfo.outputPath(`${gender}-two-models.png`), fullPage: true })
    await page.getByRole('button', { name: '기술 변형 멈추기' }).click()
    await expect.poll(async () => (await read()).samples, { timeout: 30_000 }).toBe(180)
    result = await read()
    expect(result.moving_angle_max).toBeLessThan(0.00001)
  }
  expect(await page.evaluate(() => Reflect.get(window, 'avatarCameraCalls'))).toBe(0)
  await page.getByRole('link', { name: '서비스로 돌아가기' }).click()
  await expect(page).toHaveURL('/')
  expect(errors).toEqual([])
})

test('A-06 GLB 실패와 WebGL 연결 상실에서 재시도하여 새 모델을 연다', async ({ page }) => {
  await page.route('**/*bodyguard-male-candidate.glb*', (route) =>
    route.fulfill({ status: 503, body: '' }),
  )
  await page.goto('/dev/avatar')
  await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다', {
    timeout: 30_000,
  })
  await page.unroute('**/*bodyguard-male-candidate.glb*')
  await page.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(page.getByRole('status', { name: '모델 연결 상태' })).toHaveText(
    '동일한 모델 · 독립된 두 뼈대',
    {
      timeout: 30_000,
    },
  )
  await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('실제 WebGL context-loss 확장 미지원')
    extension.loseContext()
  })
  await expect(page.getByRole('alert')).toContainText('그래픽 연결이 끊겼습니다')
  await page.getByRole('button', { name: '다시 불러오기' }).click()
  await expect(page.getByRole('status', { name: '모델 연결 상태' })).toHaveText(
    '동일한 모델 · 독립된 두 뼈대',
    {
      timeout: 30_000,
    },
  )
  expect(await page.evaluate(() => Reflect.get(window, 'avatarCameraCalls'))).toBe(0)
})
