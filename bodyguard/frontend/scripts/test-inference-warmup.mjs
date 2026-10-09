// FR-M-07/FR-A-03/NFR-07/08: fixed private comparison; no images/body values exported.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const [proof, executable, label, mode = 'normal', runName = 'final'] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-inference-warmup-proof\.[A-Za-z0-9]+$/.test(proof))
assert(/^chrome-(154|155)$/.test(label) && existsSync(executable))
assert(['normal', 'cancel'].includes(mode))
assert(/^[a-z][a-z0-9-]*$/.test(runName))
const output = resolve(proof, `${label}-${mode}-${runName}.json`)
assert(!existsSync(output))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const probe = readFileSync(resolve(proof, 'probe/probe.js'))
const workerFiles = [
  ...new Set(probe.toString().match(/nativeInference\.worker-[\w-]+\.js/g) ?? []),
]
assert.equal(workerFiles.length, 1)
const worker = workerFiles[0],
  glbs = {}
for (const gender of ['male', 'female']) {
  const result = spawnSync(
    'git',
    ['show', `25a9bd6:bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`],
    { maxBuffer: 20 * 1024 * 1024 },
  )
  assert.equal(result.status, 0)
  glbs[gender] = result.stdout
}
const pageErrors = [],
  external = [],
  results = [],
  requested = new Set()
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  requested.add(path)
  res.setHeader('Content-Security-Policy', "connect-src 'self'; worker-src 'self'")
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><body><canvas></canvas><script type="module">import{mountNativeContentionProbe}from"/probe.js";window.mount=mountNativeContentionProbe</script></body></html>',
    )
    return
  }
  let bytes,
    mime = 'application/octet-stream'
  if (path === '/probe.js') {
    bytes = probe
    mime = 'application/javascript'
  } else if (path === '/assets/' + worker) {
    bytes = readFileSync(resolve(proof, 'probe/assets', worker))
    mime = 'application/javascript'
  } else if (
    /^\/mediapipe\/wasm\/vision_wasm_(?:module_|nosimd_)?internal\.(?:js|wasm)$/.test(path)
  ) {
    bytes = readFileSync(resolve('public', path.slice(1)))
    mime = path.endsWith('.js') ? 'application/javascript' : 'application/wasm'
  } else if (
    /^\/models\/(?:pose_landmarker_lite|face_landmarker|gesture_recognizer)\.task$/.test(path)
  )
    bytes = readFileSync(resolve('public', path.slice(1)))
  else if (path === '/__private-native-male.glb') bytes = glbs.male
  else if (path === '/__private-native-female.glb') bytes = glbs.female
  else {
    res.writeHead(404)
    res.end()
    return
  }
  res.setHeader('Content-Type', mime)
  res.end(bytes)
})
await new Promise((yes, no) => {
  server.once('error', no)
  server.listen(0, '127.0.0.1', yes)
})
const origin = 'http://127.0.0.1:' + server.address().port
let browser,
  failed = false
// GPU preparation always enabled. Only warmup changes; fresh context / fixed order / retries0.
const plan =
  mode === 'cancel'
    ? [
        ['male', 'main', true],
        ['female', 'main', true],
      ]
    : [
        ['male', 'main', false],
        ['male', 'main', true],
        ['male', 'worker', true],
        ['male', 'worker', false],
        ['female', 'main', true],
        ['female', 'main', false],
        ['female', 'worker', false],
        ['female', 'worker', true],
      ]
try {
  browser = await chromium.launch({
    executablePath: executable,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })
  for (const [gender, thread, warmup] of plan) {
    const item = { gender, thread, warmup, passed: false }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ['camera'],
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    await context.route('**/*', (route) => {
      if (
        route
          .request()
          .url()
          .startsWith(origin + '/')
      )
        return route.continue()
      external.push('blocked-external')
      return route.abort()
    })
    page.on('pageerror', (error) => pageErrors.push(error.name))
    await context.addInitScript(() => {
      let cameras = 0,
        workers = 0,
        terminations = 0,
        frames = 0,
        closes = 0
      const tracks = [],
        get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async (options) => {
        const stream = await get(options)
        cameras++
        tracks.push(...stream.getTracks())
        return stream
      }
      const NativeWorker = Worker,
        NativeFrame = VideoFrame
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
      globalThis.VideoFrame = class extends NativeFrame {
        constructor(...args) {
          super(...args)
          frames++
        }
        close() {
          closes++
          return super.close()
        }
      }
      window.cleanup = () => ({
        cameras,
        workers,
        terminations,
        frames,
        closes,
        tracksEnded: tracks.length > 0 && tracks.every((track) => track.readyState === 'ended'),
        storageKeys: localStorage.length + sessionStorage.length,
      })
    })
    try {
      await page.goto(origin)
      await page.waitForFunction(() => typeof window.mount === 'function', null, { timeout: 5000 })
      await page.evaluate(
        ([gender, thread, warmup, hold]) => {
          window.probe = window.mount(
            document.querySelector('canvas'),
            gender,
            thread,
            true,
            false,
            warmup,
            hold,
          )
          void window.probe.begin()
        },
        [gender, thread, warmup, mode === 'cancel'],
      )
      if (mode === 'cancel') {
        await page.waitForFunction(() => window.probe.snapshot().warmupHeld, null, {
          timeout: 30000,
        })
        item.held = await page.evaluate(() => window.probe.snapshot())
        assert.equal(item.held.resourceStatus, 'preparing')
        assert.equal(item.held.deliveries, 0)
        assert.equal(item.held.renders, 0)
        // Artificial result-return barrier, not a hung CPU/GPU. Release after requesting stop.
        item.final = await page.evaluate(async () => {
          const closing = window.probe.close()
          window.probe.releaseWarmup()
          return closing
        })
        assert.equal(item.final.failure, 'cancelled')
        assert.equal(item.final.deliveries, 0)
        assert.equal(item.final.renders, 0)
      } else {
        await page.waitForFunction(
          () => ['running', 'failed'].includes(window.probe.snapshot().state),
          null,
          { timeout: 30000 },
        )
        item.ready = await page.evaluate(() => window.probe.snapshot())
        assert.equal(item.ready.state, 'running')
        assert.deepEqual(item.ready.atReady, { deliveries: 0, renders: 0 })
        const observedAt = Date.now()
        await new Promise((yes) => setTimeout(yes, 5000))
        item.observed = await page.evaluate(() => window.probe.snapshot())
        item.nodeObservationMs = Date.now() - observedAt
        item.thirdWithinWindow = item.observed.thirdMs !== null && item.observed.thirdMs <= 5000
        assert(item.thirdWithinWindow, 'Third native result exceeds unchanged 5s window')
        if (thread === 'main') {
          const first = ['body', 'face', 'hands'].map((stage) =>
            item.observed.costs.find((cost) => cost.stage === stage),
          )
          assert(first.every((cost) => cost?.phase === (warmup ? 'preparing' : 'running')))
        }
        item.final = await page.evaluate(() => window.probe.close())
        assert.equal(item.final.failure, null)
      }
      item.cleanup = await page.evaluate(() => window.cleanup())
      assert.equal(item.cleanup.cameras, 1)
      assert.equal(item.cleanup.workers, thread === 'worker' ? 1 : 0)
      assert.equal(item.cleanup.terminations, item.cleanup.workers)
      assert(item.cleanup.tracksEnded)
      assert.equal(item.cleanup.frames, item.cleanup.closes)
      assert.equal(item.cleanup.storageKeys, 0)
      assert(item.final.closed)
      item.passed = true
    } catch (error) {
      failed = true
      item.error = error.name
      item.message = String(error.message).slice(0, 200)
      await page.evaluate(() => window.probe?.close()).catch(() => {})
    } finally {
      results.push(item)
      await context.close()
    }
  }
} finally {
  await browser?.close()
  await new Promise((yes) => server.close(yes))
  const report = {
    timestamp: new Date().toISOString(),
    label,
    executable,
    mode,
    runName,
    plan,
    retries: 0,
    scope:
      'Actual browser/SDK/WebGL and owned native pipeline; fake camera; private opt-in; not auth/clinical/final avatar/startup P2 closure',
    probe: sha(probe),
    worker: sha(readFileSync(resolve(proof, 'probe/assets', worker))),
    glbs: Object.fromEntries(Object.entries(glbs).map(([gender, bytes]) => [gender, sha(bytes)])),
    results,
    externalRequests: external.length,
    pageErrors,
    requestedPaths: [...requested],
    actualPeople: 0,
    physicalCameras: 0,
    originalAuth26Run: false,
    defaultChanged: false,
  }
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  console.log(
    JSON.stringify(
      results.map((item) => ({
        gender: item.gender,
        thread: item.thread,
        warmup: item.warmup,
        passed: item.passed,
        readyMs: item.ready?.readyMs,
        firstMs: item.observed?.firstMs,
        thirdMs: item.observed?.thirdMs,
        maxGapMs: item.observed?.maxGapMs,
        runningMaxGapMs: item.observed?.runningMaxGapMs,
        cleanup: item.cleanup,
        error: item.error,
        message: item.message,
      })),
    ),
  )
}
if (failed || external.length || pageErrors.length) process.exitCode = 1
