// FR-A-01/03·NFR-08: actual React/Chrome/WebGL with synthetic observation and controlled account.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const sourceFiles = [
  'src/avatar/workspaceAvatar.ts',
  'src/avatar/reviewAvatarAssets.ts',
  'src/avatar/observedDetailAlignment.ts',
  'src/avatar/observedHandRig.ts',
  'src/pages/CameraPreparation.tsx',
  'src/pages/CoachingPage.tsx',
  'src/pages/CoachingPage.css',
  'scripts/dev-review-avatar.ts',
  'e2e/fixtures/workspaceAvatarSource.ts',
  'scripts/test-workspace-avatar.mjs',
  'pnpm-lock.yaml',
]
const snapshot = () =>
  Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash('sha256').update(readFileSync(path)).digest('hex'),
    ]),
  )
const sourceBefore = snapshot()
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-workspace-avatar\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const cases = [],
  errors = [],
  assets = []
let account = true,
  browser,
  failure,
  external = 0,
  tamper = false
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.url === '/api/v1/me') {
    res.writeHead(account ? 200 : 401)
    res.end(account ? '{"id":"workspace-fixture","email":"fixture@example.com"}' : '{}')
  } else {
    res.writeHead(404)
    res.end('{}')
  }
})
await new Promise((resolve, reject) => {
  api.once('error', reject)
  api.listen(0, '127.0.0.1', resolve)
})
const target = resolve('src/pose/cameraPreparation.ts')
const source = readFileSync(resolve('e2e/fixtures/workspaceAvatarSource.ts'), 'utf8')
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    plugins: [
      {
        name: 'synthetic-workspace-observation',
        enforce: 'pre',
        load(id) {
          if (id.split('?')[0] === target) return source
        },
        transform(code, id) {
          if (id.split('?')[0] !== resolve('src/avatar/workspaceAvatar.ts')) return
          // Technical coverage only in this synthetic harness, never product diagnostics/points.
          assert(code.includes('head?.render(now, deltaMs)'))
          return code
            .replace(
              'head?.render(now, deltaMs)',
              'window.workspaceViewProof.head = head?.render(now, deltaMs)',
            )
            .replace(
              'hands?.render(now, deltaMs)',
              'window.workspaceViewProof.hands = hands?.render(now, deltaMs)',
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
let stats
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    window.workspaceViewProof = { camera: 0, draws: 0 }
    navigator.mediaDevices.getUserMedia = async () => {
      window.workspaceViewProof.camera++
      throw new Error('Physical camera forbidden')
    }
    const draw = WebGL2RenderingContext.prototype.drawElements
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      window.workspaceViewProof.draws++
      return draw.apply(this, args)
    }
  })
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (new URL(url).origin !== new URL(origin).origin) {
      external++
      return route.abort()
    }
    if (url.includes('/__bodyguard/review-avatar/')) {
      assets.push(new URL(url).pathname)
      if (tamper)
        return route.fulfill({
          status: 200,
          contentType: 'model/gltf-binary',
          body: 'tampered review fixture',
        })
    }
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  const canvas = page.locator('.coaching-avatar-canvas')
  const ready = () => canvas.waitFor({ state: 'visible', timeout: 16000 })
  const open = async () => {
    await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
    await page.getByRole('button', { name: '입력 확인', exact: true }).click()
  }
  const stop = async () => {
    await page.getByRole('button', { name: '카메라 끄기', exact: true }).click()
    await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
    assert.equal(await canvas.isVisible(), false)
  }
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  assert.equal(assets.length, 0)
  assert.equal(await canvas.isVisible(), false)
  cases.push('before explicit input: no GLB, physical camera, automatic renderer or verdict')
  await page.evaluate(() => {
    window.workspaceAvatarFixture.empty = true
  })
  await open()
  await page.getByText('신체 입력을 기다리고 있습니다', { exact: true }).waitFor()
  assert.equal(assets.length, 0)
  cases.push('empty detector observation waits without inventing a displayed body or loading GLB')
  await page.evaluate(() => {
    window.workspaceAvatarFixture.empty = false
  })
  await ready()
  await page.waitForFunction(() => window.workspaceViewProof.draws > 20)
  assert.deepEqual(assets, ['/__bodyguard/review-avatar/male.glb'])
  await page.screenshot({ path: `${scratch}/${label}-male-full.png`, fullPage: true })
  const clip = await canvas.boundingBox()
  assert(clip)
  const right = {
    x: clip.x + clip.width / 2,
    y: clip.y,
    width: Math.floor(clip.width / 2),
    height: Math.floor(clip.height),
  }
  const left = { ...right, x: clip.x }
  await page.waitForTimeout(1000)
  const leftBefore = await page.screenshot({ clip: left }),
    rightBefore = await page.screenshot({ clip: right })
  await page.evaluate(() => {
    window.workspaceAvatarFixture.angle = 0.7
  })
  await page.waitForTimeout(1000)
  const leftAfter = await page.screenshot({ clip: left }),
    rightAfter = await page.screenshot({ clip: right })
  assert.notEqual(sha(leftBefore), sha(leftAfter))
  assert.equal(sha(rightBefore), sha(rightAfter))
  writeFileSync(`${scratch}/${label}-user-moved.png`, leftAfter, { flag: 'wx' })
  cases.push(
    'real professional GLB + eight-weight owned pair: left synthetic limbs move; right reference pixels unchanged',
  )
  await page.getByRole('button', { name: '움직임 맞추기', exact: true }).click()
  await page.getByText('머리·손 표시 기준 설정됨', { exact: true }).waitFor()
  // Footer clicks scroll the page; compare the original full canvas, not lower-body crops.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.waitForTimeout(1000)
  assert.deepEqual(await canvas.boundingBox(), clip)
  const alignedLeft = await page.screenshot({ clip: left }),
    alignedRight = await page.screenshot({ clip: right })
  await page.evaluate(() => {
    window.workspaceAvatarFixture.headAngle = 0.5
  })
  await page.waitForTimeout(1000)
  const headMoved = await page.screenshot({ clip: left })
  console.log(
    JSON.stringify({
      detailCoverage: await page.evaluate(() => ({
        head: window.workspaceViewProof.head,
        hands: window.workspaceViewProof.hands,
      })),
    }),
  )
  assert.notEqual(sha(alignedLeft), sha(headMoved))
  assert.equal(sha(alignedRight), sha(await page.screenshot({ clip: right })))
  writeFileSync(`${scratch}/${label}-head-moved.png`, headMoved, { flag: 'wx' })
  cases.push(
    'explicit fresh-frame display alignment: only left head changes, reference pixels unchanged',
  )
  await page.evaluate(() => {
    window.workspaceAvatarFixture.handBend = 0.5
  })
  await page.waitForTimeout(1000)
  const fingersMoved = await page.screenshot({ clip: left })
  assert.notEqual(sha(headMoved), sha(fingersMoved))
  assert.equal(sha(alignedRight), sha(await page.screenshot({ clip: right })))
  writeFileSync(`${scratch}/${label}-fingers-moved.png`, fingersMoved, { flag: 'wx' })
  cases.push(
    'same-frame generated finger bends change only left model; no reference or coaching verdict',
  )
  await page.evaluate(() => {
    window.workspaceAvatarFixture.details = false
  })
  await page.getByRole('button', { name: '움직임 맞추기', exact: true }).click()
  await page.getByText('얼굴과 양손을 보여주고 다시 맞춰주세요.', { exact: true }).waitFor()
  cases.push(
    'explicit real UI alignment without supplied face/hands fails visibly, no invented reference',
  )
  await page.evaluate(() => {
    window.workspaceAvatarFixture.details = true
  })
  const starts = await page.evaluate(() => window.workspaceAvatarFixture.starts)
  const viewHashes = []
  for (const name of ['상반신', '자세히', '전신']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.waitForTimeout(100)
    assert.equal(await canvas.isVisible(), true)
    const pixels = await canvas.screenshot({
      path: `${scratch}/${label}-view-${viewHashes.length}.png`,
    })
    viewHashes.push(sha(pixels))
  }
  assert.equal(new Set(viewHashes).size, 3)
  assert.equal(await page.evaluate(() => window.workspaceAvatarFixture.starts), starts)
  assert.equal(assets.length, 1)
  assert.equal(await page.getByRole('button', { name: '코칭 준비 중' }).isDisabled(), true)
  assert.equal(
    await page.getByRole('button', { name: '전체 시범', exact: true }).isDisabled(),
    true,
  )
  cases.push(
    'full/upper/detail display controls do not reacquire camera/model or enable coaching/reference verdict',
  )
  await stop()
  assert.equal(
    await page.getByRole('button', { name: '움직임 맞추기', exact: true }).isDisabled(),
    true,
  )
  const draws = await page.evaluate(() => window.workspaceViewProof.draws)
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.workspaceViewProof.draws), draws)
  cases.push('explicit stop hides display and stops subsequent WebGL draws')
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByLabel('아바타 형태').selectOption('female')
  await page.getByRole('button', { name: '화면 설정 닫기', exact: true }).click()
  assert.equal(assets.length, 1)
  await open()
  await ready()
  assert.equal(assets.at(-1), '/__bodyguard/review-avatar/female.glb')
  await page.getByRole('button', { name: '움직임 맞추기', exact: true }).click()
  await page.getByText('머리·손 표시 기준 설정됨', { exact: true }).waitFor()
  await page.setViewportSize({ width: 800, height: 1000 })
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: `${scratch}/${label}-female-full-800.png`, fullPage: true })
  cases.push(
    'explicit female preparation, same shared canvas at notebook800px without horizontal overflow',
  )
  await stop()
  tamper = true
  await open()
  await page.getByText('모델 연결 실패 · 카메라를 다시 확인해 주세요', { exact: true }).waitFor()
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  assert.equal(await canvas.isVisible(), false)
  await page.screenshot({ path: `${scratch}/${label}-integrity-error.png`, fullPage: true })
  cases.push(
    'altered GLB rejected by SHA before parsing/display; capture stopped, explicit retry only',
  )
  tamper = false
  await open()
  await ready()
  const lossStarts = await page.evaluate(() => window.workspaceAvatarFixture.starts)
  await page.evaluate(() => {
    const canvas = document.querySelector('.coaching-avatar-canvas')
    const gl = canvas.getContext('webgl2')
    window.workspaceLostContext = gl.getExtension('WEBGL_lose_context')
    if (!window.workspaceLostContext) throw new Error('Context loss extension unavailable')
    window.workspaceLostContext.loseContext()
  })
  await page.getByText('모델 연결 실패 · 카메라를 다시 확인해 주세요', { exact: true }).waitFor()
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  assert.equal(await canvas.isVisible(), false)
  assert.equal(await page.evaluate(() => window.workspaceAvatarFixture.starts), lossStarts)
  await page.evaluate(() => window.workspaceLostContext.restoreContext())
  await page.waitForFunction(
    () => !document.querySelector('.coaching-avatar-canvas').getContext('webgl2').isContextLost(),
  )
  await open()
  await ready()
  cases.push(
    'actual WebGL context loss stops capture/display, no automatic restart; restored context requires explicit input',
  )
  account = false
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  const afterExit = await page.evaluate(() => window.workspaceViewProof.draws)
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.workspaceViewProof.draws), afterExit)
  cases.push('explicit retry succeeds; controlled account401 removes workspace and retires draws')
  stats = await page.evaluate(() => window.workspaceViewProof)
  assert.equal(stats.camera, 0)
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
  await context.close()
} catch (e) {
  failure = { name: e.name, message: e.message.split('\n')[0] }
  process.exitCode = 1
} finally {
  await browser?.close()
  await server.close()
  api.closeAllConnections()
  await new Promise((yes) => api.close(yes))
  const sourceAfter = snapshot()
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) {
    failure = { name: 'SourceChanged', message: 'Runtime source changed during verification' }
    process.exitCode = 1
  }
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        cases,
        head,
        sourceBefore,
        sourceAfter,
        assets,
        errors,
        external,
        stats,
        failure: failure ?? null,
        syntheticObservations: true,
        controlledAccountAPI: true,
        actualSDK: false,
        actualPeople: false,
        releaseAvatar: false,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
  console.log(
    JSON.stringify({
      result: `${scratch}/${label}.json`,
      passed: cases.length,
      failure: failure ?? null,
    }),
  )
}
