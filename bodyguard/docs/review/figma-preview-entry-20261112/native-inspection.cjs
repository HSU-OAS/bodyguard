const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const { chromium } = require(
  require.resolve('@playwright/test', { paths: [path.join(process.cwd(), 'bodyguard/frontend')] }),
)
const [root, fixture, output, seconds = '15'] = process.argv.slice(2)
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
}
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(
    /^\/bodyguard\/?/,
    '',
  )
  const file = path.resolve(root, name || 'index.html')
  if (!file.startsWith(root + '/')) {
    res.writeHead(403)
    return res.end()
  }
  fs.readFile(file, (error, bytes) => {
    res.writeHead(error ? 404 : 200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    })
    res.end(error ? 'not found' : bytes)
  })
})
;(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${server.address().port}`
  const errors = []
  let browser
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-video-capture=${fixture}`,
      ],
    })
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
    })
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    )
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      const Base = window.Worker
      window.__timings = []
      window.Worker = class extends Base {
        constructor(...args) {
          super(...args)
          const pending = new Map()
          const send = this.postMessage.bind(this)
          this.postMessage = (message, ...rest) => {
            if (message?.type === 'frame') pending.set(message.id, performance.now())
            return send(message, ...rest)
          }
          this.addEventListener('message', (e) => {
            if (e.data?.type === 'result' && pending.has(e.data.id)) {
              window.__timings.push(performance.now() - pending.get(e.data.id))
              pending.delete(e.data.id)
            }
          })
        }
      }
    })
    await page.goto(origin + '/bodyguard/inspection.html?motion=neck-side')
    if(process.env.BODYGUARD_FEMALE==='1')await page.locator('#gender').selectOption('female');
    const before = Date.now()
    if (process.env.BODYGUARD_DETAIL_HANDS === '1') await page.locator('#detailed-hands').check()
    await page.getByRole('button', { name: '웹캠 시작', exact: true }).click()
    await page.waitForFunction(
      () => window.bodyguardLivePreview?.snapshot().phase === 'running',
      {},
      { timeout: 45000 },
    )
    const startMs = Date.now() - before
    const samples = await page.evaluate(async (duration) => {
      const points = []
      let raf = 0
      const tick = () => {
        raf++
        id = requestAnimationFrame(tick)
      }
      let id = requestAnimationFrame(tick)
      const until = performance.now() + duration
      while (performance.now() < until) {
        await new Promise((r) => setTimeout(r, 250))
        const s = window.bodyguardLivePreview.snapshot()
        points.push({
          frames: s.frames,
          tracked: s.tracked,
          headTracked: s.headTracked,
          bodySignal: s.bodySignal,
          phase: s.phase,
        })
      }
      cancelAnimationFrame(id)
      return { points, renderFps: raf / (duration / 1000), timings: window.__timings }
    }, Number(seconds) * 1000)
    await page.getByRole('button', { name: '웹캠 종료', exact: true }).click()
    await page.waitForFunction(
      () => window.bodyguardLivePreview.snapshot().phase === 'idle',
      {},
      { timeout: 15000 },
    )
    const timings = samples.timings.sort((a, b) => a - b)
    const result = {
      avatarGender: process.env.BODYGUARD_FEMALE==='1'?'female':'male',
      view: await page.locator('#view').inputValue(),
      method:
        'prerecorded fixture via Chrome fake camera; actual SDK/Worker and WebGL, not live-user accuracy validation',
      fixtureSha256: require('node:crypto')
        .createHash('sha256')
        .update(fs.readFileSync(fixture))
        .digest('hex'),
      startMs,
      inference: {
        count: timings.length,
        median: timings[Math.floor(timings.length * 0.5)],
        p95: timings[Math.floor(timings.length * 0.95)],
        max: timings.at(-1),
      },
      renderFps: samples.renderFps,
      first: samples.points[0],
      last: samples.points.at(-1),
      trackedSamples: samples.points.filter((p) => p.tracked > 0).length,
      headSamples: samples.points.filter((p) => p.headTracked).length,
      totalSamples: samples.points.length,
      after: await page.evaluate(() => window.bodyguardLivePreview.snapshot()),
      errors,
    }
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
    if (result.after.cameraLive || result.after.error || errors.length) process.exitCode = 1
  } finally {
    await browser?.close()
    server.close()
  }
})().catch((e) => {
  console.error(e)
  server.close()
  process.exitCode = 1
})
