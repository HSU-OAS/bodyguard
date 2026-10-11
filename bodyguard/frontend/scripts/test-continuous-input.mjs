// FR-M-01/02/07·FR-U-04/NFR-08: actual private React/SDK; native fake camera, controlled account.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-continuous-input\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/pose/cameraPreparation.ts',
  'src/pages/CameraPreparation.tsx',
  'scripts/test-continuous-input.mjs',
]
const hashes = () =>
  files.map((file) => ({
    file,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  }))
const before = hashes(),
  cases = [],
  errors = []
let browser,
  server,
  failure,
  phase = 'setup',
  account = true,
  external = 0,
  avatars = 0,
  writes = 0
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    writes++
    res.writeHead(403)
    res.end('{}')
    return
  }
  if (req.url === '/api/v1/me') {
    res.writeHead(account ? 200 : 401)
    res.end(account ? '{"id":"continuous-fixture","email":"fixture@example.com"}' : '{}')
  } else if (req.url === '/api/v1/auth/google/status') res.end('{"configured":false}')
  else {
    res.writeHead(403)
    res.end('{}')
  }
})
try {
  await new Promise((yes, no) => {
    api.once('error', no)
    api.listen(0, '127.0.0.1', yes)
  })
  server = await createServer(
    mergeConfig(config, {
      configFile: false,
      envDir: scratch,
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        open: false,
        proxy: { '/api': `http://127.0.0.1:${api.address().port}` },
      },
    }),
  )
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    executablePath: executable,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  context.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(origin).origin) external++
    if (/\.glb(?:\?|$)/.test(request.url())) avatars++
  })
  await context.addInitScript(() => {
    const p = {
      calls: 0,
      streams: [],
      frames: 0,
      inFlight: 0,
      maxInFlight: 0,
      mode: 'normal',
      held: null,
      cancelled: 0,
    }
    window.continuousProbe = p
    const camera = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (options) => {
      p.calls++
      const stream = await camera(options)
      p.streams.push(stream)
      return stream
    }
    const post = Worker.prototype.postMessage
    const bound = new WeakSet()
    Worker.prototype.postMessage = function (data, transfer) {
      if (!bound.has(this)) {
        bound.add(this)
        this.addEventListener('message', (event) => {
          if (event.data?.type === 'result') p.inFlight--
          if (event.data?.type === 'closed') p.inFlight = 0
        })
      }
      if (data?.type === 'frame') {
        p.frames++
        p.inFlight++
        p.maxInFlight = Math.max(p.maxInFlight, p.inFlight)
      }
      return post.call(this, data, transfer)
    }
    const request = HTMLVideoElement.prototype.requestVideoFrameCallback,
      cancel = HTMLVideoElement.prototype.cancelVideoFrameCallback
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (cb) {
      if (p.mode === 'hold') {
        p.held = cb
        return 2147000000
      }
      return request.call(this, cb)
    }
    HTMLVideoElement.prototype.cancelVideoFrameCallback = function (id) {
      if (id === 2147000000) {
        p.cancelled++
        return
      }
      return cancel.call(this, id)
    }
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  const button = (name) => page.getByRole('button', { name, exact: true })
  const ended = async () => {
    await page.waitForFunction(() =>
      window.continuousProbe.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    )
    for (let i = 0; i < 50 && page.workers().length; i++)
      await new Promise((yes) => setTimeout(yes, 100))
    assert.equal(page.workers().length, 0)
    assert.equal(await page.locator('video,canvas').count(), 0)
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  }
  const prepare = async () => {
    await button('카메라 확인').click()
    await button('카메라 끄기').waitFor({ timeout: 16000 })
  }
  const observe = async () => {
    await button('입력 확인').click()
    await page
      .getByRole('status')
      .filter({ hasText: '연속 입력 확인 중' })
      .waitFor({ timeout: 5000 })
  }
  phase = 'explicit-continuous-input'
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await button('카메라 확인').waitFor()
  assert.equal(await page.evaluate(() => window.continuousProbe.calls), 0)
  await prepare()
  assert.equal(await page.evaluate(() => window.continuousProbe.frames), 1)
  await observe()
  await page.waitForFunction(() => window.continuousProbe.frames >= 6)
  assert.equal(await page.evaluate(() => window.continuousProbe.calls), 1)
  assert.equal(page.workers().length, 1)
  assert.equal(await button('입력 확인').isDisabled(), true)
  assert.equal(await button('코칭 준비 중').isDisabled(), true)
  assert.equal(await page.evaluate(() => window.continuousProbe.maxInFlight), 1)
  assert.equal(await page.locator('video,canvas').count(), 0)
  await page.getByRole('region', { name: '카메라 준비 확인' }).screenshot({
    path: `${scratch}/${label}-input-controls.png`,
  })
  await button('카메라 끄기').click()
  await button('카메라 확인').waitFor()
  await ended()
  cases.push(
    'explicit native fake-camera preparation1 → separate input confirmation → >=5 subsequent actual heavy body/face/hands Worker frames; same camera/Worker, max in-flight1 → explicit stop',
  )
  await page.screenshot({ path: `${scratch}/${label}-stopped.png`, fullPage: true })
  phase = 'cancel-held-decoder'
  await prepare()
  const initial = await page.evaluate(() => window.continuousProbe.frames)
  await page.evaluate(() => {
    window.continuousProbe.mode = 'hold'
  })
  await button('입력 확인').click()
  await page.waitForFunction(() => window.continuousProbe.held !== null)
  await button('카메라 끄기').click()
  await button('카메라 확인').waitFor({ timeout: 5000 })
  await ended()
  await page.evaluate(() => {
    const p = window.continuousProbe
    p.mode = 'normal'
    p.held(performance.now(), { presentedFrames: 900, mediaTime: 9 })
    p.held = null
  })
  assert.equal(await page.evaluate(() => window.continuousProbe.frames), initial)
  cases.push(
    'controlled held decoded callback cancelled during connecting; late callback cannot create an input or revive readiness',
  )
  phase = 'router-retirement'
  await prepare()
  await observe()
  await page.getByRole('link', { name: '나가기', exact: true }).click()
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
  await ended()
  const calls = await page.evaluate(() => window.continuousProbe.calls)
  await page.getByRole('link', { name: '코칭 화면 구조 보기', exact: true }).click()
  await button('카메라 확인').waitFor()
  assert.equal(await page.evaluate(() => window.continuousProbe.calls), calls)
  cases.push(
    'actual Router exit from running input releases source/camera/Worker; remount does not restart automatically',
  )
  phase = 'pagehide-retirement'
  await prepare()
  await observe()
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  await button('카메라 확인').waitFor()
  await ended()
  cases.push('controlled pagehide event during actual running input ends source/camera/Worker')
  phase = 'hidden-retirement'
  await prepare()
  await observe()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await button('카메라 확인').waitFor()
  await ended()
  await page.evaluate(() => {
    delete document.hidden
    delete document.visibilityState
  })
  cases.push('controlled hidden event during actual running input ends source/camera/Worker')
  phase = 'keyboard-narrow'
  await page.setViewportSize({ width: 800, height: 1000 })
  await prepare()
  const input = button('입력 확인')
  await input.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await input.evaluate((node) => node === document.activeElement), true)
  assert.equal(await input.evaluate((node) => getComputedStyle(node).outlineWidth), '3px')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const box = await input.boundingBox()
  assert(box && box.width >= 44 && box.height >= 44)
  await button('카메라 끄기').click()
  await button('카메라 확인').waitFor()
  await ended()
  await page.screenshot({ path: `${scratch}/${label}-stopped-800.png`, fullPage: true })
  cases.push(
    '800px notebook window/reduced motion/keyboard focus and44px input control; no horizontal overflow',
  )
  phase = 'account-retirement'
  await page.setViewportSize({ width: 1440, height: 1100 })
  await prepare()
  await observe()
  account = false
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  await ended()
  cases.push(
    'actual AuthProvider controlled401 refresh during running input removes private UI and ends resources',
  )
  assert.equal(external, 0)
  assert.equal(avatars, 0)
  assert.equal(writes, 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(hashes(), before)
  await context.close()
} catch (e) {
  failure = { phase, name: e.name, code: 'continuous-input-verification-failed' }
} finally {
  await browser?.close()
  await server?.close()
  api.closeAllConnections()
  if (api.listening) await new Promise((yes) => api.close(yes))
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual React/AuthProvider/Vite/Chrome + native fake camera/actual heavy SDK; controlled account/held-decoder/401',
        cases,
        external,
        avatars,
        writes,
        errors,
        failure: failure ?? null,
        sourceBefore: before,
        sourceAfter: hashes(),
        ownedResourcesClosed: true,
        notProven: [
          'physical camera/people/accuracy/15fps',
          'avatar/clinical judgement/reference',
          'real provider/SQL',
          'original startup P2 resolution',
          'Docker/TLS/deployment/public coaching',
        ],
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(
  JSON.stringify({
    output: `${scratch}/${label}.json`,
    passed: cases.length,
    failure: failure ?? null,
  }),
)
if (failure) process.exitCode = 1
