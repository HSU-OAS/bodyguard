// FR-A-03/NFR-08: actual local Chrome + WebGL, authored test motion, never webcam or clinical input.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer as httpServer } from 'node:http'
import { createServer as netServer } from 'node:net'
import { chromium } from '@playwright/test'

const [directory, assets, executable, label, buildLabel] = process.argv.slice(2)
assert(
  directory &&
    /^\/private\/tmp\/bodyguard-motion-preview-proof\.[A-Za-z0-9]+$/.test(directory) &&
    realpathSync(directory) === directory,
)
assert(assets && realpathSync(assets) === assets)
assert(executable && existsSync(executable))
assert(label && /^[a-z0-9-]+$/.test(label))
assert(buildLabel && /^[a-z0-9-]+$/.test(buildLabel))
const output = `${directory}/browser-${label}.json`
assert(!existsSync(output), 'Preserve earlier browser output')
const files = {
  '/probe.js': `${directory}/probe-${buildLabel}/probe.js`,
  '/__private-native-male.glb': `${assets}/male.glb`,
  '/__private-native-female.glb': `${assets}/female.glb`,
  '/__private-native-reference-fixture.json': `${assets}/authored-fixture.json`,
}
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const results = {
  fixtureNotRelease: true,
  label,
  browser: null,
  assets: Object.fromEntries(Object.entries(files).map(([route, file]) => [route, sha256(file)])),
  cases: [],
  failed: false,
}
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>BODYGUARD 기술 시험</title>
<style>body{margin:24px;color:#173854;background:#fff;font:16px system-ui}button{border:1px solid #bed1e3;border-radius:20px;background:#f5f9fd;display:block;padding:12px;margin:12px}button:focus-visible{outline:3px solid #2268ad}canvas{display:block;width:480px;height:680px}small{display:block}</style>
<p>기술 시험 · 임시 모델 · 출시 동작 아님</p><button id="preview" aria-label="시험 동작 미리보기"><canvas aria-hidden="true"></canvas></button><button id="play">재생 / 정지</button>
<script type="module">import{mountMotionPreviewProbe}from'/probe.js';window.probe=mountMotionPreviewProbe();</script></html>`
const server = httpServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(html)
    return
  }
  const file = files[req.url]
  if (!file) {
    res.statusCode = 404
    res.end()
    return
  }
  res.setHeader(
    'Content-Type',
    req.url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream',
  )
  res.end(readFileSync(file))
})
const sink = netServer((socket) => socket.destroy())
const listen = (srv) =>
  new Promise((resolve, reject) => {
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', resolve)
  })
await listen(server)
await listen(sink)
const base = `http://127.0.0.1:${server.address().port}`
let browser
const check = (name, action) => {
  assert(action, name)
  results.cases.push({ name, passed: true })
}
try {
  browser = await chromium.launch({
    executablePath: executable,
    headless: true,
    proxy: { server: `http://127.0.0.1:${sink.address().port}`, bypass: '127.0.0.1' },
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--no-first-run',
    ],
  })
  results.browser = browser.version()
  for (const gender of ['male', 'female']) {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 900 },
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()
    const errors = [],
      external = []
    page.on('pageerror', () => errors.push('page-error'))
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== base) {
        external.push('blocked-external')
        return route.abort()
      }
      return route.continue()
    })
    await page.goto(base)
    await page.waitForFunction(() => window.probe)
    await page.evaluate((next) => window.probe.choose(next), gender)
    const snapshot = () => page.evaluate(() => window.probe.snapshot())
    const idle = await snapshot()
    check(`${gender}: no input no load`, idle.loads === 0 && idle.queued === 0)
    await page.locator('#preview').hover()
    await page.waitForFunction(() => window.probe.snapshot().status === 'playing', {
      timeout: 20000,
    })
    await page.waitForFunction(() => !window.probe.snapshot().poseIsPoster)
    const moving = await snapshot()
    check(
      `${gender}: hover actual authored motion`,
      moving.frames > 2 && !moving.poseIsPoster && moving.live === 1,
    )
    const screen = `${directory}/${label}-${gender}-moving.png`
    assert(!existsSync(screen))
    await page.screenshot({ path: screen })
    await page.mouse.move(1000, 10)
    await page.waitForFunction(() => window.probe.snapshot().status === 'idle')
    const stopped = await snapshot()
    check(
      `${gender}: leave reset release`,
      stopped.positionMs === 0 &&
        stopped.poseIsPoster &&
        stopped.live === 0 &&
        stopped.queued === 0,
    )
    await page.keyboard.press('Tab')
    await page.waitForFunction(() => window.probe.snapshot().status === 'playing')
    const focused = await page.locator('#preview').evaluate((el) => el === document.activeElement)
    check(`${gender}: keyboard focus equivalent`, focused && (await snapshot()).live === 1)
    await page.locator('#preview').hover()
    await page.mouse.move(1000, 10)
    check(`${gender}: focused pointer leave continues`, (await snapshot()).status === 'playing')
    await page.keyboard.press('Tab')
    await page.waitForFunction(() => window.probe.snapshot().status === 'idle')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('#preview').hover()
    check(
      `${gender}: reduced motion no autoplay`,
      (await snapshot()).status === 'idle' && (await snapshot()).queued === 0,
    )
    await page.locator('#play').click()
    await page.waitForFunction(() => window.probe.snapshot().status === 'playing')
    check(`${gender}: explicit reduced-motion play`, (await snapshot()).live === 1)
    await page.evaluate(() => window.probe.hide(true))
    check(
      `${gender}: synthetic hidden state stops`,
      (await snapshot()).queued === 0 && (await snapshot()).live === 0,
    )
    await page.locator('#play').click()
    await page.evaluate(() => window.probe.hide(false))
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.mouse.move(1000, 10)
    await page.evaluate(() => window.probe.failNextLoad())
    await page.locator('#preview').hover()
    await page.waitForFunction(() => window.probe.snapshot().status === 'failed')
    check(
      `${gender}: failed load no animation`,
      (await snapshot()).failure === 'load-failed' && (await snapshot()).queued === 0,
    )
    await page.evaluate(() => window.probe.retry())
    await page.waitForFunction(() => window.probe.snapshot().status === 'playing')
    await page.evaluate(() =>
      window.probe.choose(window.probe.snapshot().selection === 'male' ? 'female' : 'male'),
    )
    await page.waitForFunction(() => window.probe.snapshot().status === 'playing')
    check(
      `${gender}: replacement single owned asset`,
      (await snapshot()).live === 1 && (await snapshot()).peak === 1,
    )
    await page.evaluate(() => window.probe.remove())
    const ended = await snapshot()
    check(
      `${gender}: removal settles all assets`,
      ended.status === 'closed' &&
        ended.live === 0 &&
        ended.queued === 0 &&
        ended.loads === ended.releases + 1,
    )
    check(
      `${gender}: no page error or external request`,
      errors.length === 0 && external.length === 0,
    )
    results.cases.push({
      name: `${gender}: actual browser counters`,
      counters: ended,
      passed: true,
    })
    await context.close()
  }
} catch (error) {
  results.failed = true
  results.failure = error instanceof Error ? error.message : 'Browser proof failed'
  process.exitCode = 1
} finally {
  await browser?.close()
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    new Promise((resolve) => sink.close(resolve)),
  ])
  writeFileSync(output, JSON.stringify(results, null, 2))
  process.stdout.write(
    `${output}: ${results.cases.filter((item) => item.passed).length} passed; failed=${results.failed}\n`,
  )
}
