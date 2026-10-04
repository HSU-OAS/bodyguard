import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { expect, test } from '@playwright/test'

function nativeModel(gender: 'male' | 'female') {
  const override = process.env.BODYGUARD_AVATAR_QA_DIRECTORY
  if (override && !isAbsolute(override))
    throw new Error('Absolute native QA export directory required')
  const filename = `bodyguard-${gender}-candidate${override ? '' : '-a37'}.glb`
  const body = readFileSync(join(override || resolve('src/avatar/models'), filename))
  if (
    body.length < 20 ||
    body.toString('ascii', 0, 4) !== 'glTF' ||
    body.readUInt32LE(4) !== 2 ||
    body.readUInt32LE(8) !== body.length ||
    body.readUInt32LE(16) !== 0x4e4f534a ||
    20 + body.readUInt32LE(12) > body.length
  )
    throw new Error('Complete native GLB2 with JSON chunk required')
  const gltf: {
    meshes: { primitives: { attributes: Record<string, number> }[] }[]
    nodes: { name?: string; mesh?: number; skin?: number }[]
  } = JSON.parse(body.toString('utf8', 20, 20 + body.readUInt32LE(12)))
  const bodyNode = gltf.nodes.find(
    (node) => node.name === `BODYGUARD ${gender === 'male' ? 'Male' : 'Female'} sculpt WIP`,
  )
  const bodyMesh = bodyNode?.mesh === undefined ? undefined : gltf.meshes[bodyNode.mesh]
  const eightWeights = ({ attributes }: { attributes: Record<string, number> }) =>
    attributes.JOINTS_1 !== undefined && attributes.WEIGHTS_1 !== undefined
  if (
    bodyNode?.skin === undefined ||
    !bodyMesh?.primitives.length ||
    !bodyMesh.primitives.every(eightWeights)
  )
    throw new Error('Authored body must retain native JOINTS_1 and WEIGHTS_1')
  const primitives = gltf.meshes.flatMap((mesh) => mesh.primitives)
  if (
    primitives.some(
      ({ attributes }) =>
        (attributes.JOINTS_1 === undefined) !== (attributes.WEIGHTS_1 === undefined),
    )
  )
    throw new Error('Incomplete native second weight set')
  return {
    body,
    filename,
    bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
    eightWeightPrimitives: primitives.filter(eightWeights).length,
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  // FR-A-05/06: test a new native export without overwriting the current assets.
  for (const gender of ['male', 'female'] as const) {
    const { body, ...metadata } = nativeModel(gender)
    await testInfo.attach(`${gender}-native-asset`, {
      body: JSON.stringify(metadata),
      contentType: 'application/json',
    })
    if (process.env.BODYGUARD_AVATAR_QA_DIRECTORY) {
      await page.route(new RegExp(`/bodyguard-${gender}-candidate-a37\\.glb(?:\\?.*)?$`), (route) =>
        route.fulfill({ body, contentType: 'model/gltf-binary' }),
      )
    }
  }
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

test('A-00 native proxy는 브라우저의 외부 연결을 차단한다', async ({ page }) => {
  await expect(page.goto('https://example.invalid')).rejects.toThrow('ERR_PROXY_CONNECTION_FAILED')
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
  for (const [gender, assetGender] of [
    ['남성', 'male'],
    ['여성', 'female'],
  ] as const) {
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
    // Removed garments/seams must not be counted; both body clones retain eight weights.
    expect(result.eight_weight_meshes).toBe(2 * nativeModel(assetGender).eightWeightPrimitives)
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
  await page.route('**/*bodyguard-male-candidate-a37.glb*', (route) =>
    route.fulfill({ status: 503, body: '' }),
  )
  await page.goto('/dev/avatar')
  await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다', {
    timeout: 30_000,
  })
  await page.unroute('**/*bodyguard-male-candidate-a37.glb*')
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
