// FR-A-01/03·FR-M-02/07: real React/WebGL/GLBs; generated observations, no person/SDK proof.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as http } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-shared-reference\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/avatar/observedComparison.ts',
  'src/avatar/observedDetailAlignment.ts',
  'src/avatar/observedHandRig.ts',
  'src/avatar/referenceStage.ts',
  'src/pages/ReferenceDemonstration.tsx',
  'src/pages/CameraPreparation.tsx',
  'src/pages/CoachingPage.tsx',
  'src/pages/CoachingPage.css',
  'e2e/fixtures/workspaceAvatarSource.ts',
  'scripts/test-shared-reference.mjs',
  'vite.config.ts',
  'pnpm-lock.yaml',
]
const sha = (b) => createHash('sha256').update(b).digest('hex')
const snapshot = () => Object.fromEntries(files.map((f) => [f, sha(readFileSync(f))]))
const before = snapshot(),
  cases = [],
  errors = []
let browser,
  page,
  failure = null,
  account = true,
  external = 0,
  cameras = 0
const api = http((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.statusCode = req.url === '/api/v1/me' ? (account ? 200 : 401) : 404
  res.end(account ? '{"id":"comparison-fixture","email":"fixture@example.com"}' : '{}')
})
await new Promise((yes, no) => {
  api.once('error', no)
  api.listen(0, '127.0.0.1', yes)
})
const fixture = readFileSync('e2e/fixtures/workspaceAvatarSource.ts', 'utf8')
const target = resolve('src/pose/cameraPreparation.ts')
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    plugins: [
      {
        name: 'generated-comparison-input',
        enforce: 'pre',
        load(id) {
          if (id.split('?')[0] === target) return fixture
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
  await context.exposeFunction('comparisonCameraDenied', () => cameras++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.comparisonCameraDenied()
      return Promise.reject(new Error('Physical camera forbidden'))
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
  page.on('pageerror', (e) => errors.push(e.message))
  const canvas = page.getByRole('img', { name: '3D 시범 후보' })
  const image = async (name) => {
    const b = await canvas.screenshot()
    if (name) writeFileSync(`${scratch}/${label}-${name}.png`, b, { flag: 'wx' })
    return sha(b)
  }
  const halves = async (name) => {
    await canvas.scrollIntoViewIfNeeded()
    const b = await canvas.boundingBox()
    assert(b)
    const x = Math.floor(b.x),
      y = Math.floor(b.y),
      w = Math.floor(b.width),
      h = Math.floor(b.height)
    return Promise.all(
      [0, 1].map(async (i) => {
        const bytes = await page.screenshot({
          clip: { x: x + i * Math.floor(w / 2), y, width: Math.floor(w / 2), height: h },
        })
        if (name) writeFileSync(`${scratch}/${label}-${name}-half${i}.png`, bytes, { flag: 'wx' })
        return sha(bytes)
      }),
    )
  }
  const open = async () => {
    await page.getByRole('button', { name: '시범 미리보기', exact: true }).click()
    await page.getByText('시범 후보 · 자동 판정 없음', { exact: true }).waitFor({ timeout: 16000 })
  }
  const capture = async () => {
    await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
    await page.getByRole('button', { name: '입력 확인', exact: true }).click()
    await page.getByText('내 움직임 · 관찰 표시', { exact: true }).waitFor({ timeout: 5000 })
  }
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await page.getByRole('button', { name: '시범 미리보기', exact: true }).waitFor()
  assert.equal(await page.locator('canvas,video').count(), 0)
  await open()
  assert.equal(await page.evaluate(() => window.workspaceAvatarFixture.starts), 0)
  await capture()
  await page.waitForTimeout(1000)
  const rest = await halves('rest')
  await image('male-both-ready')
  await page.evaluate(() => (window.workspaceAvatarFixture.angle = 0.6))
  await page.waitForTimeout(1200)
  const moved = await halves('moved')
  assert.notEqual(moved[0], rest[0])
  assert.equal(moved[1], rest[1])
  await image('male-user-moved')
  cases.push(
    'same copied source moves only left user; right authored guide paused; no second capture/inference',
  )
  await page.getByRole('button', { name: '움직임 맞추기', exact: true }).click()
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    window.workspaceAvatarFixture.headAngle = 0.35
    window.workspaceAvatarFixture.handBend = 0.7
  })
  // Let the existing50ms half-life reach floating-point rest before exact pixel independence.
  await page.waitForTimeout(2600)
  const detail = await halves('detail')
  assert.notEqual(detail[0], moved[0])
  assert.equal(detail[1], moved[1])
  await image('male-details-moved')
  await page.getByRole('button', { name: '수행 시범 단계 재생' }).click()
  await page.waitForTimeout(1500)
  const perform = await halves('perform')
  assert.equal(perform[0], detail[0])
  assert.notEqual(perform[1], detail[1])
  await image('male-guide-perform')
  cases.push('explicit next-frame head/hand alignment; authored phase moves only right copy')
  await page.evaluate(() => (window.workspaceAvatarFixture.empty = true))
  await page.getByText('내 움직임 연결 대기', { exact: true }).waitFor()
  await image('empty-input')
  await page.evaluate(() => (window.workspaceAvatarFixture.empty = false))
  await page.getByText('내 움직임 · 관찰 표시', { exact: true }).waitFor()
  await page.getByRole('button', { name: '카메라 끄기', exact: true }).click()
  await page.getByText('내 움직임 연결 대기', { exact: true }).waitFor()
  await capture()
  assert.equal(await page.evaluate(() => window.workspaceAvatarFixture.starts), 2)
  cases.push(
    'empty input hides unobserved user; fresh input recovers; stop/restart binds fresh original generation',
  )
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByLabel('아바타 형태').selectOption('female')
  await page.getByRole('button', { name: '화면 설정 닫기', exact: true }).click()
  assert.equal(await page.locator('canvas').count(), 0)
  await open()
  await capture()
  await page.waitForTimeout(800)
  await image('female-both-full')
  for (const name of ['상반신', '자세히', '전신']) {
    await page.getByRole('button', { name, exact: true }).click()
    await image(`female-${name}`)
  }
  await page.setViewportSize({ width: 800, height: 1000 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await image('female-full-800')
  cases.push('gender change retires camera and stage; female same-source/guide/full/detail800px')
  const old = await canvas.elementHandle()
  assert(old)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction((n) => n.getContext('webgl2')?.isContextLost() === true, old, {
    timeout: 5000,
  })
  assert.equal(await page.locator('canvas').count(), 0)
  await old.dispose()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(150)
  assert.equal(await page.locator('canvas').count(), 0)
  await open()
  await capture()
  account = false
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  assert.equal(await page.locator('canvas').count(), 0)
  assert.equal(external, 0)
  assert.equal(cameras, 0)
  assert.deepEqual(errors, [])
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  cases.push(
    'hide401 retires owned display/camera; no automatic resume, actual camera/SDK/storage/external0',
  )
} catch (e) {
  failure = { name: e.name, message: e.message, stack: e.stack }
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
          'actual React/Chrome/WebGL and own native GLB+animations; generated observation source/controlled account, not actual SDK/person/clinical evidence',
        version,
        before,
        after,
        cases,
        errors,
        external,
        cameras,
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
