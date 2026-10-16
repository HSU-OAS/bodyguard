// FR-S-06/FR-U-04: actual existing recommendation pane + owned preparation and visual media.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as http } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, label, mode] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-recommendation\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
assert(['generated', 'native'].includes(mode))
const files = [
  'src/App.tsx',
  'src/pages/ExplorePage.tsx',
  'src/pages/CameraRecommendations.tsx',
  'src/pages/CameraRecommendations.css',
  'src/pages/CameraPreparation.tsx',
  'src/catalog/cameraRecommendations.ts',
  'src/posture/cameraFraming.ts',
  'src/posture/landmarks.ts',
  'src/catalog/motions.ts',
  'src/catalog/motionMedia.ts',
  'src/pages/MotionPreview.tsx',
  'src/pose/cameraPreparation.ts',
  'src/pose/workerInference.ts',
  'src/pose/nativeInference.worker.ts',
  'e2e/fixtures/recommendationSource.ts',
  'scripts/test-camera-recommendation.mjs',
  'vite.config.ts',
  'pnpm-lock.yaml',
]
const hash = (b) => createHash('sha256').update(b).digest('hex'),
  hashes = () => Object.fromEntries(files.map((f) => [f, hash(readFileSync(f))]))
const before = hashes(),
  cases = [],
  errors = [],
  requests = []
let account = true,
  writes = 0,
  physical = 0,
  external = 0,
  browser,
  page,
  failure = null
const api = http((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') writes++
  if (req.url === '/api/v1/me') {
    res.statusCode = account ? 200 : 401
    res.end(
      account
        ? '{"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}'
        : '{}',
    )
  } else {
    res.statusCode = 404
    res.end('{}')
  }
})
await new Promise((yes, no) => {
  api.once('error', no)
  api.listen(0, '127.0.0.1', yes)
})
const replacements = new Set(
  [
    'src/pose/camera.ts',
    'src/pose/workerInference.ts',
    'src/pose/videoPoseSource.ts',
    'src/pose/preparationFrame.ts',
  ].map((f) => resolve(f)),
)
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    plugins:
      mode === 'generated'
        ? [
            {
              name: 'generated-recommendation-input',
              enforce: 'pre',
              load(id) {
                if (replacements.has(id.split('?')[0]))
                  return readFileSync('e2e/fixtures/recommendationSource.ts', 'utf8')
              },
            },
          ]
        : [],
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      open: false,
      hmr: false,
      proxy: { '/api': `http://127.0.0.1:${api.address().port}` },
    },
  }),
)
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: 'chrome',
    args:
      mode === 'native'
        ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
        : [],
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    ...(mode === 'native' ? { permissions: ['camera'] } : {}),
  })
  await context.exposeFunction('forbiddenPhysicalCamera', () => physical++)
  await context.addInitScript((native) => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.recommendationTracks = []
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!native) {
        void window.forbiddenPhysicalCamera()
        throw new Error('Forbidden physical camera')
      }
      const stream = await original(constraints)
      window.recommendationTracks.push(...stream.getTracks())
      return stream
    }
  }, mode === 'native')
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    requests.push(url.pathname)
    if (url.origin !== new URL(origin).origin) {
      external++
      return route.abort()
    }
    return route.continue()
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  const button = (name) => page.getByRole('button', { name, exact: true }),
    visible = (locator) => locator.waitFor({ timeout: 20000 }),
    image = async (name) =>
      writeFileSync(`${scratch}/${label}-${name}.png`, await page.screenshot({ fullPage: true }), {
        flag: 'wx',
      }),
    set = (value) =>
      page.evaluate((value) => Object.assign(window.recommendationFixture, value), value)
  const connect = async () => {
    await button('카메라 확인').click()
    await visible(page.getByText('카메라·분석 연결 확인됨', { exact: true }))
    await button('입력 확인').click()
    await visible(page.getByText('연속 입력 확인 중', { exact: true }))
  }
  await page.goto(`${origin}explore`)
  await visible(page.getByRole('heading', { name: '스트레칭 시작 경로' }))
  await button('추천받기').click()
  await page.getByRole('radio', { name: '목', exact: true }).check()
  await visible(button('카메라 확인'))
  assert.equal(await button('촬영 조건으로 후보 보기').isDisabled(), true)
  if (mode === 'native') {
    await connect()
    await page.waitForTimeout(600)
    assert.equal(await button('촬영 조건으로 후보 보기').isDisabled(), true)
    assert.equal(await page.getByRole('heading', { name: '촬영 조건이 맞는 후보' }).count(), 0)
    await image('blank-input-no-candidates')
    await button('카메라 끄기').click()
    await visible(page.getByText('카메라 꺼짐', { exact: true }))
    assert(
      await page.evaluate(
        () =>
          window.recommendationTracks.length > 0 &&
          window.recommendationTracks.every((t) => t.readyState === 'ended'),
      ),
    )
    assert(requests.some((p) => p.endsWith('.wasm')))
    assert(requests.some((p) => /\.task(?:$|\?)/.test(p)))
    cases.push(
      'actual Worker/SDK/models/WASM + blank fake Chrome camera: no candidates, explicit stop ends native tracks; not positive/person evidence',
    )
  } else {
    assert.equal(await page.evaluate(() => window.recommendationFixture.cameras), 0)
    await set({ mode: 'upper' })
    await connect()
    await button('촬영 조건으로 후보 보기').waitFor({ state: 'visible' })
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === '촬영 조건으로 후보 보기',
        )?.disabled,
    )
    await button('촬영 조건으로 후보 보기').click()
    await visible(page.getByRole('heading', { name: '촬영 조건이 맞는 후보' }))
    await page.waitForFunction(() => document.activeElement?.id === 'recommendation-heading')
    assert.deepEqual(
      await page.evaluate(() => {
        const f = window.recommendationFixture
        return [f.cameras, f.stops, f.workers, f.workerStops]
      }),
      [1, 1, 1, 1],
    )
    assert.equal(
      await page.getByRole('link', { name: '목 옆으로 기울이기 안내 보기' }).getAttribute('href'),
      '/dev/select?region=neck&motion=neck-side',
    )
    await image('neck-candidate')
    const preview = page.getByRole('group', { name: '목 옆으로 기울이기 미리보기' })
    await preview.hover()
    await visible(button('목 옆으로 기울이기 미리보기 정지'))
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0)
    await page.getByLabel('후보 미리보기 형태').selectOption('female')
    await button('목 옆으로 기울이기 미리보기 재생').click()
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0)
    await image('female-playing')
    cases.push(
      'explicit purpose + upper-body coverage -> neck visual candidate only after camera/Worker teardown; native video hover/explicit female playback and focused results',
    )
    await page.getByRole('link', { name: '목 옆으로 기울이기 안내 보기' }).click()
    await visible(page.getByRole('heading', { name: '목 옆으로 기울이기', level: 1 }))
    await page.goBack()
    await visible(button('추천받기'))
    await button('추천받기').click()
    await page.getByRole('radio', { name: '어깨', exact: true }).check()
    await visible(button('카메라 확인'))
    await set({ mode: 'upper' })
    await connect()
    await page.waitForTimeout(200)
    assert.equal(await button('촬영 조건으로 후보 보기').isDisabled(), true)
    await set({ mode: 'multiple' })
    await visible(page.getByText('한 사람만 화면에 들어오게 해 주세요.', { exact: true }))
    assert.equal(await button('촬영 조건으로 후보 보기').isDisabled(), true)
    await set({ mode: 'all' })
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === '촬영 조건으로 후보 보기',
        )?.disabled,
    )
    await set({ paused: true })
    await page.waitForTimeout(1150)
    assert.equal(await button('촬영 조건으로 후보 보기').isDisabled(), true)
    await set({ paused: false })
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.trim() === '촬영 조건으로 후보 보기',
        )?.disabled,
    )
    await button('촬영 조건으로 후보 보기').click()
    await visible(page.getByRole('heading', { name: '촬영 조건이 맞는 후보' }))
    assert.equal(await page.getByRole('link', { name: /안내 보기$/ }).count(), 2)
    await image('shoulder-candidates')
    cases.push(
      'upper-only cannot recommend shoulder/trunk requirements; multiple/stale capture revokes; fresh full coverage offers two shoulder candidates without clinical ranking',
    )
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForFunction(() => !document.getElementById('recommendation-heading'))
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    assert.equal(await page.evaluate(() => window.recommendationFixture.cameras), 2)
    await set({ delay: true })
    await button('카메라 확인').click()
    await visible(button('준비 취소'))
    await page.getByRole('radio', { name: '목', exact: true }).check()
    await visible(button('정리 중'))
    await page.evaluate(() => window.recommendationFixture.release?.())
    await visible(button('카메라 확인'))
    assert.equal(await page.evaluate(() => window.recommendationFixture.cameras), 3)
    cases.push(
      'hidden discards recommendations without restart; purpose replacement waits for delayed permission and reclaims late camera before a new inert owner',
    )
    await page.getByRole('radio', { name: '몸통', exact: true }).check()
    await visible(page.getByRole('link', { name: '직접 선택에서 모두 보기' }))
    assert.equal(await button('카메라 확인').count(), 0)
    assert.equal(await page.evaluate(() => window.recommendationFixture.cameras), 3)
    await page.getByRole('radio', { name: '목', exact: true }).check()
    await visible(button('카메라 확인'))
    await set({ mode: 'all' })
    await connect()
    account = false
    await page.evaluate(() => dispatchEvent(new Event('focus')))
    await visible(page.getByRole('heading', { name: '다시 만나 반갑습니다' }))
    await page.waitForFunction(() => {
      const f = window.recommendationFixture
      return f.cameras === f.stops && f.workers === f.workerStops
    })
    cases.push(
      'no torso automatic candidates -> direct guidance without camera; auth401 retires active capture and removes all prior candidate/media UI',
    )
  }
  assert.equal(writes, 0)
  assert.equal(physical, 0)
  assert.equal(external, 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0])
  assert.deepEqual(hashes(), before)
} catch (e) {
  failure = { name: e.name, message: e.message }
  if (page && !page.isClosed()) {
    await imageFallback()
  }
} finally {
  const cleanup = await Promise.allSettled([
    browser?.close(),
    server.close(),
    new Promise((yes, no) => api.close((error) => (error ? no(error) : yes()))),
  ])
  if (cleanup.some((result) => result.status === 'rejected') && !failure)
    failure = { name: 'CleanupError', message: 'Owned test cleanup failed' }
  writeFileSync(
    `${scratch}/${label}.json`,
    `${JSON.stringify({ mode, method: mode === 'native' ? 'actual SDK/Worker + blank fake device, mocked account' : 'actual React/preparation/policy/Blender media, mathematical capture/Worker and mocked account', before, after: hashes(), cases, errors, writes, physical, external, requests, failure }, null, 2)}\n`,
    { flag: 'wx' },
  )
}
async function imageFallback() {
  try {
    await page.screenshot({ path: `${scratch}/${label}-failure.png`, fullPage: true })
    writeFileSync(`${scratch}/${label}-failure-ui.txt`, await page.locator('body').innerText(), {
      flag: 'wx',
    })
  } catch {}
}
console.log(JSON.stringify({ mode, passed: cases.length, failure }))
if (failure) process.exitCode = 1
