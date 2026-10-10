// Actual SDK only: blank input; no camera/avatar, images, landmarks, or clinical claims.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-inference-thread\.[A-Za-z0-9]+$/.test(scratch))
assert(existsSync(executable) && /^[a-z][a-z0-9-]+$/.test(label))
const output = resolve(scratch, `${label}.json`)
assert(!existsSync(output), 'Preserve earlier evidence')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const probe = readFileSync(resolve(scratch, 'probe/probe.js'))
const workerNames = [
  ...new Set(probe.toString().match(/nativeInference\.worker-[\w-]+\.js/g) ?? []),
]
assert.equal(workerNames.length, 1)
const workerName = workerNames[0]
const worker = readFileSync(resolve(scratch, 'probe/assets', workerName))
const assets = new Map([
  ['/probe.js', [probe, 'application/javascript']],
  [`/assets/${workerName}`, [worker, 'application/javascript']],
])
for (const name of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
])
  assets.set(`/mediapipe/wasm/${name}`, [
    readFileSync(resolve('public/mediapipe/wasm', name)),
    name.endsWith('.js') ? 'application/javascript' : 'application/wasm',
  ])
for (const name of ['pose_landmarker_lite', 'face_landmarker', 'gesture_recognizer'])
  assets.set(`/models/${name}.task`, [
    readFileSync(resolve('public/models', `${name}.task`)),
    'application/octet-stream',
  ])
let proxyAttempts = 0
const proxy = createServer((_req, res) => {
  proxyAttempts++
  res.writeHead(403)
  res.end()
})
proxy.on('connect', (_req, socket) => {
  proxyAttempts++
  socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
})
const requested = new Set(),
  pageErrors = [],
  results = []
let blocked = 0,
  browser,
  failure
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  requested.add(path)
  res.setHeader('Content-Security-Policy', "connect-src 'self'; worker-src 'self'")
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><body><script type="module">import{mountInferenceThreadProbe}from"/probe.js";window.mount=mountInferenceThreadProbe</script></body></html>',
    )
  } else if (assets.has(path)) {
    const [bytes, mime] = assets.get(path)
    res.setHeader('Content-Type', mime)
    res.end(bytes)
  } else {
    res.writeHead(404)
    res.end()
  }
})
const listen = (server) =>
  new Promise((yes, no) => {
    server.once('error', no)
    server.listen(0, '127.0.0.1', yes)
  })
const stop = (server) =>
  new Promise((yes) => {
    server.closeAllConnections()
    server.close(yes)
  })
// Harness liveness only; preserve the existing 5s Worker request bound.
async function bounded(pending) {
  let timer
  try {
    return await Promise.race([
      pending,
      new Promise((_yes, no) => {
        timer = setTimeout(() => no(new Error('Private comparison exceeded 5000ms')), 5000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
try {
  await listen(server)
  await listen(proxy)
  const host = `127.0.0.1:${server.address().port}`,
    origin = `http://${host}`
  browser = await chromium.launch({
    executablePath: executable,
    proxy: { server: `http://127.0.0.1:${proxy.address().port}`, bypass: `<-loopback>,${host}` },
  })
  for (const thread of ['main', 'worker', 'worker', 'main']) {
    const item = { thread, passed: false }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
    })
    await context.route('**/*', (route) => {
      if (route.request().url().startsWith(`${origin}/`)) return route.continue()
      blocked++
      return route.abort()
    })
    await context.addInitScript(() => {
      let cameras = 0,
        workers = 0,
        terminations = 0
      if (navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async () => {
          cameras++
          throw new Error('No camera in this comparison')
        }
      const NativeWorker = Worker
      globalThis.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args)
          workers++
        }
        terminate() {
          terminations++
          return super.terminate()
        }
      }
      window.ownership = () => ({
        cameras,
        workers,
        terminations,
        storageKeys: localStorage.length + sessionStorage.length,
      })
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.name))
    try {
      await page.goto(origin)
      await page.waitForFunction(() => typeof window.mount === 'function', null, { timeout: 5000 })
      await page.evaluate((mode) => {
        window.probe = window.mount(mode)
      }, thread)
      await bounded(page.evaluate(() => window.probe.begin()))
      await bounded(page.evaluate(() => window.probe.run()))
      item.result = await page.evaluate(() => window.probe.snapshot())
      item.closed = await bounded(page.evaluate(() => window.probe.close()))
      item.ownership = await page.evaluate(() => window.ownership())
      assert.equal(item.result.state, 'ready')
      assert.equal(item.closed.state, 'closed')
      assert.equal(item.result.timings.length, 3)
      assert.equal(item.result.frames, 3)
      assert.equal(item.result.closes, 3)
      assert.equal(item.ownership.cameras, 0)
      assert.equal(item.ownership.storageKeys, 0)
      assert.equal(item.ownership.workers, thread === 'worker' ? 1 : 0)
      assert.equal(item.ownership.terminations, item.ownership.workers)
      assert.equal(item.result.concurrentRejected, thread === 'worker')
      assert(item.result.timings.every((n) => Number.isFinite(n) && n > 0))
      assert(Number.isFinite(item.result.clickDelayMs))
      item.passed = true
    } catch (error) {
      item.failure = { name: error.name, message: error.message }
      try {
        item.closed = await bounded(page.evaluate(() => window.probe?.close()))
        item.ownership = await page.evaluate(() => window.ownership())
      } catch {
        item.cleanupFailed = true
      }
      throw error
    } finally {
      results.push(item)
      await context.close()
    }
  }
  assert.equal(pageErrors.length, 0)
  assert.equal(blocked, 0)
  assert(![...requested].some((path) => /^\/api(?:\/|$)|\.glb$|avatar/.test(path)))
  // A responsiveness comparison, not a clinical threshold or whole-startup pass.
  for (const [a, b] of [
    [0, 1],
    [3, 2],
  ]) {
    assert(results[a].result.maxGapMs > results[b].result.maxGapMs)
    assert(results[a].result.clickDelayMs > results[b].result.clickDelayMs)
  }
} catch (error) {
  failure = { name: error.name, message: error.message }
} finally {
  try {
    await browser?.close()
  } catch {
    failure ??= { name: 'CleanupError', message: 'Browser close failed' }
  }
  await stop(server)
  await stop(proxy)
  writeFileSync(
    output,
    JSON.stringify(
      {
        method:
          'fresh context ABBA; lite body+face+hand; synthetic blank 640x480; timer-dispatched click; no camera/avatar',
        executable,
        bundle: sha(probe),
        worker: sha(worker),
        assetHashes: Object.fromEntries([...assets].map(([name, [bytes]]) => [name, sha(bytes)])),
        results,
        requested: [...requested],
        blocked,
        proxyAttempts,
        pageErrors,
        failure: failure ?? null,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(
  JSON.stringify({
    output,
    passed: results.filter((x) => x.passed).length,
    failure: failure ?? null,
  }),
)
if (failure) process.exitCode = 1
