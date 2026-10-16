// FR-S-02/04·FR-A-01/03: actual UI/GLB/engine; mathematical capture/worker/auth only.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as http } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-shrug-workspace\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/pages/NeckCoachingRun.tsx',
  'src/coaching/neckWorkspacePlayback.ts',
  'src/coaching/shrugCandidateFeedback.ts',
  'src/stretch/shrugCandidateClassifier.ts',
  'src/avatar/observedShoulderElevation.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/observedComparison.ts',
  'src/avatar/neckSurfaceFeedback.ts',
  'src/avatar/referenceStage.ts',
  'src/avatar/surfaceFeedback.ts',
  'src/avatar/projectedSurfaceRegions.ts',
  'src/posture/shoulderShrugObservation.ts',
  'src/posture/thresholds.ts',
  'e2e/fixtures/shrugWorkspaceEntry.tsx',
  'e2e/fixtures/shrugWorkspaceSource.ts',
  'e2e/fixtures/shrugCandidate.ts',
  'scripts/test-shrug-workspace.mjs',
  'vite.config.ts',
  'pnpm-lock.yaml',
]
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  hashes = () => Object.fromEntries(files.map((f) => [f, sha(readFileSync(f))])),
  before = hashes(),
  cases = [],
  errors = []
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
        name: 'mathematical-shrug-capture',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === './pages/CoachingPage' && importer?.split('?')[0] === resolve('src/App.tsx'))
            return resolve('e2e/fixtures/shrugWorkspaceEntry.tsx')
        },
        load(id) {
          if (replacements.has(id.split('?')[0]))
            return readFileSync('e2e/fixtures/shrugWorkspaceSource.ts', 'utf8').replace(
              "'./shrugCandidate'",
              JSON.stringify(resolve('e2e/fixtures/shrugCandidate.ts')),
            )
        },
      },
    ],
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
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  })
  await context.exposeFunction('forbiddenPhysicalCamera', () => physical++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.forbiddenPhysicalCamera()
      return Promise.reject(new Error('Forbidden physical capture'))
    }
  })
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== new URL(origin).origin) {
      external++
      return route.abort()
    }
    return route.continue()
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  const button = (name) => page.getByRole('button', { name, exact: true }),
    status = (text) => page.getByText(text, { exact: true }).waitFor({ timeout: 20000 }),
    set = (value) => page.evaluate((v) => Object.assign(window.shrugWorkspaceFixture, v), value),
    image = async (name) =>
      writeFileSync(`${scratch}/${label}-${name}.png`, await page.screenshot({ fullPage: true }), {
        flag: 'wx',
      })
  const start = async () => {
    await page.getByRole('button', { name: /^(검수 시작|새 검수 시작)$/ }).click()
    await status('양쪽 · 수행')
  }
  const redness = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => {
            const gl = document.querySelector('canvas').getContext('webgl2'),
              w = gl.drawingBufferWidth,
              h = gl.drawingBufferHeight,
              p = new Uint8Array(w * h * 4),
              counts = [0, 0]
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, p)
            for (let y = 0; y < h; y++)
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4
                if (p[i] > p[i + 1] * 1.2 && p[i] > p[i + 2] * 1.1 && p[i] > 100)
                  counts[x < w / 2 ? 0 : 1]++
              }
            resolve(counts)
          }),
        ),
    )
  await page.goto(`${origin}dev/coaching?motion=shoulder-shrug`)
  await button('검수 시작').waitFor()
  assert.equal(await page.evaluate(() => window.shrugWorkspaceFixture.cameras), 0)
  await set({ allow: false })
  await button('검수 시작').click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.evaluate(() => window.shrugWorkspaceFixture.cameras), 0)
  await set({ allow: true })
  await start()
  await image('male-neutral')
  await set({ rise: 40, right: 40 })
  await status('양쪽 · 복귀')
  await image('male-raised')
  await set({ right: 0 })
  await status('양쪽 어깨의 움직임을 함께 확인해 주세요')
  await page.waitForTimeout(180)
  const asym = await redness()
  assert(asym[0] > 0 && asym[1] === 0)
  await image('male-asymmetry')
  await set({ rise: 0, right: 0, headDown: true })
  await status('머리 위치 확인 · 준비 시범을 다시 보세요')
  await page.waitForTimeout(180)
  const head = await redness()
  assert(head[0] > 0 && head[1] === 0)
  await image('male-head-feedback')
  await set({ head: false })
  await page.waitForTimeout(180)
  assert.equal((await redness())[0], 0)
  await set({ head: true })
  await page.waitForTimeout(180)
  assert((await redness())[0] > 0)
  await set({ empty: true })
  await status('양쪽 · 준비')
  await page.waitForTimeout(160)
  assert.equal((await redness())[0], 0)
  assert.equal(await page.locator('progress').getAttribute('value'), '0')
  await image('empty-no-success')
  await set({ empty: false, headDown: false })
  await status('양쪽 · 수행')
  await set({ paused: true })
  await page.waitForTimeout(1300)
  assert.equal((await redness())[0], 0)
  await set({ paused: false })
  await status('양쪽 · 수행')
  cases.push(
    'actual male GLB/phase-aware guide and user shoulder rise; same-frame asymmetry/head red user-only; empty/stale cannot accrue or retain colour',
  )
  const old = await page.getByRole('img', { name: '실행 중인 두 아바타 후보' }).elementHandle()
  await button('일시정지').click()
  await button('다시 준비하고 재개').waitFor()
  await page.waitForFunction((n) => n.getContext('webgl2')?.isContextLost() === true, old)
  await button('다시 준비하고 재개').click()
  await status('양쪽 · 수행')
  await old.dispose()
  for (let i = 0; i < 2; i++) {
    await set({ rise: 40, right: 40 })
    await status('양쪽 · 복귀')
    await set({ rise: 0, right: 0 })
    if (i === 0) await status('양쪽 · 수행')
  }
  await page.getByRole('heading', { name: '검수 흐름 완료', exact: true }).waitFor()
  await status('양쪽 · 완료')
  await image('completed-result')
  assert.equal(await button('시험 기록 저장').count(), 0)
  cases.push(
    'pause retires old camera/Worker/GPU; explicit fresh generation calibrates and completes two real-engine repetitions/results, no record write',
  )
  await page.getByLabel('검수 아바타 형태').selectOption('female')
  await start()
  await image('female-neutral')
  await set({ rise: 40, right: 0 })
  await status('양쪽 어깨의 움직임을 함께 확인해 주세요')
  await page.waitForTimeout(180)
  const female = await redness()
  assert(female[0] > 0 && female[1] === 0)
  await image('female-asymmetry')
  await page.setViewportSize({ width: 1280, height: 800 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await image('female-laptop')
  await page.setViewportSize({ width: 1440, height: 1100 })
  await button('불편하면 중단').click()
  await page.getByRole('heading', { name: '불편으로 중단했습니다' }).waitFor()
  await set({ rise: 0, right: 0 })
  cases.push(
    'actual female GLB independent shoulder retarget and user-only feedback; pain stops without a completed result',
  )
  await set({ delay: true })
  await page.getByRole('button', { name: /^(검수 시작|새 검수 시작)$/ }).click()
  await button('종료').waitFor()
  await button('종료').click()
  await page.evaluate(() => window.shrugWorkspaceFixture.release?.())
  await page.getByRole('button', { name: /^(검수 시작|새 검수 시작)$/ }).waitFor()
  await page.waitForFunction(() => {
    const f = window.shrugWorkspaceFixture
    return f.cameras === f.stops && f.workers === f.workerStops
  })
  await start()
  account = false
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  await page.waitForFunction(() => {
    const f = window.shrugWorkspaceFixture
    return f.cameras === f.stops && f.workers === f.workerStops
  })
  cases.push(
    'late camera permission cancellation reclaims without automatic start; auth401 removes current UI and retires camera/Worker',
  )
  assert.equal(writes, 0)
  assert.equal(physical, 0)
  assert.equal(external, 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0])
  assert.deepEqual(hashes(), before)
} catch (e) {
  failure = { name: e.name, message: e.message }
  if (page) {
    await page.screenshot({ path: `${scratch}/${label}-failure.png`, fullPage: true })
    writeFileSync(`${scratch}/${label}-failure-ui.txt`, await page.locator('body').innerText(), {
      flag: 'wx',
    })
  }
} finally {
  const cleanup = await Promise.allSettled([
    browser?.close(),
    server.close(),
    new Promise((yes, no) => api.close((e) => (e ? no(e) : yes()))),
  ])
  if (cleanup.some((r) => r.status === 'rejected') && !failure)
    failure = { name: 'CleanupError', message: 'Owned test cleanup failed' }
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual Chrome/React/GLB/GPU/classifier/engine; mathematical camera/Worker/points/profile and mocked account; not actual people/SDK/SQL proof',
        before,
        after: hashes(),
        cases,
        errors,
        writes,
        physical,
        external,
        failure,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ passed: cases.length, failure }))
if (failure) process.exitCode = 1
