// FR-S-02/03/04·FR-U-04: actual page/GLB/classifier/engine, generated input and account.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as http } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, label, colour] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-neck-(?:workspace|surface)\.[A-Za-z0-9]+$/.test(scratch))
assert(colour === undefined || colour === 'with-surface')
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const sha = (value) => createHash('sha256').update(value).digest('hex')
const files = [
  'src/coaching/neckWorkspacePlayback.ts',
  'src/pages/NeckCoachingRun.tsx',
  'src/pages/CoachingPage.tsx',
  'src/avatar/observedComparison.ts',
  'src/avatar/neckSurfaceFeedback.ts',
  'src/avatar/projectedSurfaceRegions.ts',
  'src/avatar/surfaceFeedback.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/referenceStage.ts',
  'src/pages/CoachingPage.css',
  'e2e/fixtures/neckWorkspaceEntry.tsx',
  'e2e/fixtures/neckWorkspaceSource.ts',
  'e2e/fixtures/neckCandidate.ts',
  'scripts/test-neck-workspace.mjs',
  'vite.config.ts',
  'pnpm-lock.yaml',
]
const snapshot = () => Object.fromEntries(files.map((file) => [file, sha(readFileSync(file))]))
const before = snapshot(),
  cases = [],
  errors = [],
  requests = []
let browser,
  page,
  failure = null,
  account = true,
  writes = 0,
  physical = 0,
  external = 0
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
  } else if (req.url === '/api/v1/auth/csrf')
    res.end(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
  else {
    res.statusCode = 404
    res.end('{}')
  }
})
await new Promise((yes, no) => {
  api.once('error', no)
  api.listen(0, '127.0.0.1', yes)
})
const entry = resolve('e2e/fixtures/neckWorkspaceEntry.tsx'),
  source = resolve('e2e/fixtures/neckWorkspaceSource.ts')
const replacements = new Set(
  ['src/pose/camera.ts', 'src/pose/workerInference.ts', 'src/pose/videoPoseSource.ts'].map((f) =>
    resolve(f),
  ),
)
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    plugins: [
      {
        name: 'generated-neck-workspace',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === './pages/CoachingPage' && importer?.split('?')[0] === resolve('src/App.tsx'))
            return entry
        },
        load(id) {
          if (replacements.has(id.split('?')[0]))
            return readFileSync(source, 'utf8').replace(
              "'./neckCandidate'",
              JSON.stringify(resolve('e2e/fixtures/neckCandidate.ts')),
            )
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      open: false,
      proxy: { '/api': `http://127.0.0.1:${api.address().port}` },
    },
  }),
)
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: 'chrome',
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  await context.exposeFunction('physicalCameraForbidden', () => physical++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.physicalCameraForbidden()
      return Promise.reject(new Error('Forbidden physical camera'))
    }
  })
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
  page.on('pageerror', (e) => errors.push(e.message))
  const image = async (name) => {
    const bytes = await page.screenshot({ fullPage: true })
    writeFileSync(`${scratch}/${label}-${name}.png`, bytes, { flag: 'wx' })
    return sha(bytes)
  }
  const status = (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 20000 })
  const set = (value) =>
    page.evaluate((value) => Object.assign(window.neckWorkspaceFixture, value), value)
  const redness = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => {
            const canvas = document.querySelector('canvas'),
              gl = canvas.getContext('webgl2')
            const width = gl.drawingBufferWidth,
              height = gl.drawingBufferHeight,
              pixels = new Uint8Array(width * height * 4)
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
            const halves = [
              { count: 0, sumY: 0 },
              { count: 0, sumY: 0 },
            ]
            for (let y = 0; y < height; y++)
              for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4
                // Render-only chroma separation, NOT pose/clinical thresholds or a camera image.
                if (
                  pixels[i] > pixels[i + 1] + 15 &&
                  pixels[i] > pixels[i + 2] + 10 &&
                  pixels[i + 3] > 0
                ) {
                  const h = halves[x < width / 2 ? 0 : 1]
                  h.count++
                  h.sumY += y
                }
              }
            resolve(
              halves.map((h) => ({
                count: h.count,
                meanY: h.count ? h.sumY / h.count / height : null,
              })),
            )
          }),
        ),
    )
  const start = async () => {
    // This simulates a new user's preparation; never weaken the application's start gate.
    await set({ angle: 0, shoulder: 0, head: true, empty: false, pausedInput: false })
    await page.getByRole('button', { name: /^(검수 시작|새 검수 시작)$/ }).click()
    await status('왼쪽 · 수행')
  }
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await page.getByRole('button', { name: '검수 시작', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.neckWorkspaceFixture.cameras), 0)
  await set({ allow: false })
  await page.getByRole('button', { name: '검수 시작', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.evaluate(() => window.neckWorkspaceFixture.cameras), 0)
  cases.push(
    'false motion gate refuses camera/Worker/GLB/start; no clinical gate granted by profile shape',
  )
  await set({ allow: true })
  await start()
  await page.getByRole('button', { name: '움직임 맞추기', exact: true }).click()
  await image('both-started')
  await set({ shoulder: 0.2 })
  await status('어깨선 확인 · 준비 시범을 다시 보세요')
  await image('shoulder-feedback')
  await set({ shoulder: 0, angle: 0.4 })
  await status('선택한 방향의 시범을 확인해 주세요')
  if (colour) {
    const neck = await redness()
    assert(neck[0].count > 0 && neck[1].count === 0)
    await set({ head: false })
    await page.waitForTimeout(200)
    const missing = await redness()
    assert.equal(missing[0].count, 0)
    await set({ head: true })
    await page.waitForTimeout(200)
    assert((await redness())[0].count > 0)
    await set({ pausedInput: true })
    await page.waitForTimeout(1300)
    assert.equal((await redness())[0].count, 0)
    await set({ pausedInput: false, angle: 0 })
    await status('왼쪽 · 수행')
    await set({ shoulder: 0.2 })
    await status('어깨선 확인 · 준비 시범을 다시 보세요')
    const shoulder = await redness()
    assert(shoulder[0].count > 0 && shoulder[1].count === 0)
    assert(neck[0].meanY > shoulder[0].meanY)
    await image('surface-shoulder')
    await set({ shoulder: 0, angle: 0.4 })
    await status('선택한 방향의 시범을 확인해 주세요')
    await image('surface-neck')
    cases.push(
      'actual GPU pixels: user-only distinct neck/shoulder region; missing head and stale capture revoke red, fresh input recovers',
    )
  }
  await image('wrong-direction')
  await set({ angle: 0, empty: true })
  await status('왼쪽 · 준비')
  assert.equal(await page.locator('progress').getAttribute('value'), '0')
  await image('empty-disarmed')
  await set({ empty: false })
  await status('왼쪽 · 수행')
  const old = await page.getByRole('img', { name: '실행 중인 두 아바타 후보' }).elementHandle()
  await page.getByRole('button', { name: '일시정지', exact: true }).click()
  await page.getByRole('button', { name: '다시 준비하고 재개', exact: true }).waitFor()
  await page.waitForFunction((node) => node.getContext('webgl2')?.isContextLost() === true, old)
  assert.equal(await page.evaluate(() => window.neckWorkspaceFixture.cameras), 1)
  await page.getByRole('button', { name: '다시 준비하고 재개', exact: true }).click()
  await status('왼쪽 · 수행')
  assert.equal(await page.evaluate(() => window.neckWorkspaceFixture.cameras), 2)
  await page.getByRole('button', { name: '움직임 맞추기', exact: true }).click()
  await page.waitForTimeout(200)
  await old.dispose()
  cases.push(
    'actual classifier shoulder/wrong-side feedback; empty cannot accrue; pause retires GPU/camera and explicit resume creates fresh generation/canvas',
  )
  await set({ angle: -0.4 })
  await status('왼쪽 · 복귀')
  await page.waitForTimeout(400)
  await image('left-return')
  await set({ angle: 0 })
  await status('오른쪽 · 수행')
  await set({ angle: 0.4 })
  await status('오른쪽 · 복귀')
  await image('right-return')
  await set({ angle: 0 })
  await page.getByRole('heading', { name: '검수 흐름 완료', exact: true }).waitFor()
  await image('completed-result')
  await status('왼쪽 · 완료')
  await status('오른쪽 · 완료')
  assert.equal(writes, 0)
  cases.push(
    'generated joints → actual classifier → left/right phase/hold/return → visible completed results; candidate result writes0',
  )
  await page.getByLabel('검수 아바타 형태').selectOption('female')
  await start()
  if (colour) {
    await page.getByRole('button', { name: '움직임 맞추기', exact: true }).click()
    await page.waitForTimeout(200)
    await set({ shoulder: 0.2 })
    await status('어깨선 확인 · 준비 시범을 다시 보세요')
    const shoulders = await redness()
    assert(shoulders[0].count > 0 && shoulders[1].count === 0)
    await image('female-surface-shoulders')
    await set({ shoulder: 0, angle: 0.4 })
    await status('선택한 방향의 시범을 확인해 주세요')
    const neck = await redness()
    assert(neck[0].count > 0 && neck[1].count === 0)
    await image('female-surface-neck')
    cases.push(
      'female actual GPU neck/shoulder masks and neutral guide; same native-owned flow without additional capture',
    )
  }
  await image('female-running')
  for (const name of ['상반신', '자세히', '전신']) {
    await page.getByRole('button', { name, exact: true }).click()
    await image(`female-${name}`)
  }
  await page.setViewportSize({ width: 800, height: 1000 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await image('female-800')
  await page.getByRole('button', { name: '불편하면 중단', exact: true }).click()
  await page.getByRole('heading', { name: '불편으로 중단했습니다' }).waitFor()
  await image('pain-result')
  cases.push(
    'female/full/upper/detail800 and actual pain-stop result, not a clinical/real-person accuracy test',
  )
  const prior = await page.evaluate(() => ({
    cameras: window.neckWorkspaceFixture.cameras,
    workers: window.neckWorkspaceFixture.workers,
  }))
  await set({ delay: true })
  await page.getByRole('button', { name: '새 검수 시작', exact: true }).click()
  await page.waitForFunction(() => window.neckWorkspaceFixture.waiting)
  await page.getByRole('button', { name: '종료', exact: true }).click()
  assert.equal(await page.evaluate(() => window.neckWorkspaceFixture.cameras), prior.cameras + 1)
  await page.evaluate(() => window.neckWorkspaceFixture.release?.())
  await page.getByRole('button', { name: '검수 시작', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.neckWorkspaceFixture.workers), prior.workers)
  assert.equal(await page.getByRole('alert').count(), 0)
  await set({ delay: false })
  cases.push(
    'pending permission cancelled, late owned camera reclaimed once; no Worker/avatar or automatic replacement',
  )
  await start()
  await set({ fail: true })
  await page.getByRole('alert').waitFor()
  await image('inference-error')
  await set({ fail: false })
  await start()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction(
    () =>
      window.neckWorkspaceFixture.cameras === window.neckWorkspaceFixture.stops &&
      window.neckWorkspaceFixture.workers === window.neckWorkspaceFixture.workerStops,
  )
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const count = await page.evaluate(() => window.neckWorkspaceFixture.cameras)
  await page.waitForTimeout(200)
  assert.equal(await page.evaluate(() => window.neckWorkspaceFixture.cameras), count)
  account = false
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  assert.equal(await page.locator('canvas').count(), 0)
  assert.equal(writes, 0)
  assert.equal(physical, 0)
  assert.equal(external, 0)
  assert.deepEqual(errors, [])
  assert.equal(
    requests.filter((p) => /\.(?:task|wasm)$|vision_wasm|nativeInference\.worker/.test(p)).length,
    0,
  )
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  cases.push(
    'inference error/explicit retry; hide and401 retire owners; no automatic restart, real camera/SDK/storage/external/write0',
  )
} catch (e) {
  failure = { name: e.name, message: e.message, stack: e.stack }
  if (page)
    failure.sessionFailure = await page
      .locator('[data-session-failure]')
      .getAttribute('data-session-failure')
      .catch(() => null)
  if (page) {
    await page.screenshot({ path: `${scratch}/${label}-failure.png` })
    writeFileSync(`${scratch}/${label}-failure-ui.txt`, await page.locator('body').innerText(), {
      flag: 'wx',
    })
  }
} finally {
  const version = browser?.version()
  await browser?.close()
  await server.close()
  await new Promise((yes) => api.close(yes))
  const after = snapshot()
  assert.deepEqual(after, before)
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual Chrome/React/WebGL/native-authored GLB + actual classifier/session; generated poses and mocked camera/Worker/account, not SDK/person/clinical proof',
        version,
        before,
        after,
        cases,
        errors,
        writes,
        physical,
        external,
        failure,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output: `${scratch}/${label}.json`, passed: cases.length, failure }))
if (failure) process.exitCode = 1
