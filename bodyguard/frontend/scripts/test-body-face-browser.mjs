// FR-M-01/02/07/NFR-07/08: native fake-camera same-frame test; no camera/image screenshots.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-body-face-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const receipt = join(scratch, `browser-${label}.json`)
assert(!existsSync(receipt))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sourcePaths = [
  'src/pose/bodyFaceVideoSource.ts',
  'src/pose/bodyFaceVideoSource.test.ts',
  'src/pose/ownedPoseFrame.ts',
  'src/pose/videoPoseSource.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/headOrientationRig.ts',
  'src/pose/face.ts',
  'src/pose/landmarker.ts',
  'src/pose/camera.ts',
  'src/pose/constants.ts',
  'src/coaching/resources.ts',
  'e2e/fixtures/bodyFaceFrameProbe.ts',
  'e2e/fixtures/bodyFaceFrame.vite.ts',
  'scripts/test-body-face-browser.mjs',
  'scripts/check-selection-production.mjs',
  'pnpm-lock.yaml',
]
const snapshot = () =>
  Object.fromEntries(sourcePaths.map((p) => [p, sha(readFileSync(join(root, p)))]))
const wasm = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
]
const resources = Object.fromEntries([
  ['/probe.js', readFileSync(join(scratch, 'probe/probe.js'))],
  ...['pose_landmarker_lite.task', 'face_landmarker.task'].map((n) => [
    `/models/${n}`,
    readFileSync(join(root, 'public/models', n)),
  ]),
  ...wasm.map((n) => [
    `/mediapipe/wasm/${n}`,
    readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/wasm', n)),
  ]),
])
let proxyDenied = 0,
  proxySocketErrors = 0,
  injectedResetHandled = 0,
  external = 0,
  cspBlocked = 0,
  browser,
  page
const errors = []
const proxy = createServer((_req, res) => {
  proxyDenied++
  res.writeHead(403)
  res.end()
})
proxy.on('connect', (req, socket) => {
  proxyDenied++
  // Chrome may reset an already refused CONNECT socket. This remains denied, not a
  // process-wide uncaught exception. No URL/native error content is logged.
  const injected = new Error('Closed proxy fixture reset')
  socket.on('error', (error) => {
    if (error === injected) injectedResetHandled++
    else proxySocketErrors++
  })
  if (req.url === 'closed-proxy-probe.invalid:443') socket.emit('error', injected)
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
})
const server = createServer((req, res) => {
  const path = req.url?.split('?')[0]
  if (path === '/') {
    // TEST ONLY. This does not adopt an SDK egress policy for the product.
    res.setHeader('Content-Security-Policy', "connect-src 'self'")
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 연결 시험</title><body><p>가짜 카메라 · 코칭 아님</p><script type="module">import{mountBodyFaceProbe}from"/probe.js";window.openProbe=async()=>{await window.probe?.close();window.probe=await mountBodyFaceProbe();return window.probe.snapshot()}</script></body></html>',
    )
  } else if (Object.hasOwn(resources, path)) {
    res.setHeader(
      'Content-Type',
      path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.wasm')
          ? 'application/wasm'
          : 'application/octet-stream',
    )
    res.end(resources[path])
  } else {
    res.writeHead(404)
    res.end()
  }
})
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: snapshot(),
  actualChrome: true,
  actualSDK: true,
  fakeCamera: true,
  actualHuman: false,
  physicalCamera: false,
  identityVerified: false,
  positiveHeadVerified: false,
  cameraScreenshots: 0,
  productSDKPolicy: false,
  stages: [],
  sdk: JSON.parse(
    readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'),
  ).version,
  resources: Object.fromEntries(
    Object.entries(resources).map(([name, bytes]) => [
      name,
      { bytes: bytes.length, sha256: sha(bytes) },
    ]),
  ),
}
function listen(target) {
  return new Promise((resolve, reject) => {
    target.once('error', reject)
    target.listen(0, '127.0.0.1', resolve)
  })
}
try {
  await listen(proxy)
  await listen(server)
  const proxyAddress = proxy.address(),
    address = server.address()
  assert(proxyAddress && typeof proxyAddress !== 'string')
  assert(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  // Deterministic TEST ONLY reset on a local refused socket; no remote connection.
  const refused = await new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port: proxyAddress.port })
    let response = ''
    socket.setTimeout(5000, () => {
      socket.destroy()
      reject(new Error('Closed proxy probe timeout'))
    })
    socket.on('error', reject)
    socket.on('connect', () =>
      socket.write(
        'CONNECT closed-proxy-probe.invalid:443 HTTP/1.1\r\nHost: closed-proxy-probe.invalid:443\r\n\r\n',
      ),
    )
    socket.on('data', (bytes) => {
      response += bytes.toString()
    })
    socket.on('end', () => resolve(response.startsWith('HTTP/1.1 403 Forbidden')))
  })
  assert(refused)
  assert.equal(injectedResetHandled, 1)
  report.proxyResetInjection = { synthetic: true, refused: true, handled: true }
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--proxy-bypass-list=localhost;127.0.0.1',
    ],
    proxy: { server: `http://127.0.0.1:${proxyAddress.port}`, bypass: 'localhost,127.0.0.1' },
  })
  report.browser = browser.version()
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' })
  await context.route('**/*', async (route) => {
    if (!route.request().url().startsWith(`${origin}/`)) {
      external++
      await route.abort()
    } else await route.continue()
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  page.on('console', (message) => {
    if (
      message.text().includes('Content Security Policy') ||
      message.text().includes('connect-src')
    )
      cspBlocked++
  })
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openProbe === 'function')
  const initial = await page.evaluate(() => window.openProbe())
  assert(initial.cameraLive && initial.inputHidden)
  assert.equal(initial.bodyCalls, 0)
  assert.equal(initial.faceCalls, 0)
  report.stages.push({ case: 'inert-source-prepared', ...initial })
  for (let i = 0; i < 3; i++) {
    const state = await page.evaluate(() => window.probe.read())
    assert(state.accepted && state.increasing && state.headOnlyFields)
    assert.equal(state.bodyCalls, state.faceCalls)
    assert.equal(state.coherent, state.faceCalls)
    assert.equal(state.bodyCloses, state.bodyCalls)
    assert.equal(state.openInputs, state.bodyCalls * 2)
    assert.equal(state.allInputsClosed, state.bodyCalls)
    assert.equal(state.nullHeads, state.delivered)
    assert.equal(state.emptyBodies, state.delivered)
    assert.equal(state.emptyFaces, state.faceCalls)
    assert(state.plainFaceResults && !state.heldInputOpen)
    report.stages.push({ case: 'native-same-frame-missing', ...state })
  }
  await page.evaluate(() => {
    window.probe.holdNext()
    window.reading = window.probe.read()
  })
  await page.waitForFunction(() => window.probe.snapshot().facePending)
  const before = await page.evaluate(() => window.probe.snapshot())
  await page.evaluate(() => {
    window.retired = false
    window.retiring = window.probe.retire().then((v) => {
      window.retired = true
      return v
    })
  })
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  const pending = await page.evaluate(() => ({
    retired: window.retired,
    ...window.probe.snapshot(),
  }))
  assert(!pending.retired && pending.facePending && pending.cameraLive && pending.heldInputOpen)
  assert.equal(pending.bodyCloses, before.bodyCloses)
  assert.equal(pending.poseCloses, 0)
  assert.equal(pending.faceCloses, 0)
  report.stages.push({ case: 'retire-waits-for-face', ...pending })
  const late = await page.evaluate(async () => {
    window.probe.release()
    const result = await window.reading
    await window.retiring
    return result
  })
  assert(!late.accepted)
  assert.equal(late.bodyCloses, late.bodyCalls)
  assert.equal(late.allInputsClosed, late.bodyCalls)
  assert(!late.heldInputOpen)
  assert.equal(late.delivered, 3)
  report.stages.push({ case: 'late-result-discarded', ...late })
  const resumed = await page.evaluate(() => window.probe.resume())
  assert.equal(resumed.generation, 2)
  assert(resumed.cameraLive)
  report.stages.push({ case: 'explicit-fresh-source', ...resumed })
  const next = await page.evaluate(() => window.probe.read())
  assert(next.accepted && next.increasing && next.headOnlyFields)
  assert.equal(next.delivered, 4)
  assert.equal(next.coherent, next.bodyCalls)
  assert.equal(next.bodyCloses, next.bodyCalls)
  assert.equal(next.allInputsClosed, next.bodyCalls)
  assert.equal(next.nullHeads, 4)
  assert.equal(next.emptyFaces, next.faceCalls)
  assert(next.plainFaceResults && !next.heldInputOpen)
  report.stages.push({ case: 'native-new-generation', ...next })
  const closed = await page.evaluate(() => window.probe.close())
  assert(closed.closed && closed.tracksEnded && closed.videoDetached)
  assert.equal(closed.poseCloses, 1)
  assert.equal(closed.faceCloses, 1)
  assert.equal(closed.bodyCloses, closed.bodyCalls)
  assert.equal(closed.bodyCalls, closed.faceCalls)
  report.stages.push({ case: 'owned-source-before-native-close', ...closed })
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
  await context.close()
  report.passed = true
} catch (error) {
  // Never publish SDK/input-bearing error text. Fixed codes and source receipts suffice.
  report.failure = { name: error.name, code: 'body-face-browser-failed' }
  process.exitCode = 1
  if (page && !page.isClosed())
    try {
      report.failureState = await page.evaluate(() => window.probe?.snapshot())
    } catch {
      /* fixed counters only */
    }
} finally {
  if (page && !page.isClosed())
    try {
      await page.evaluate(() => window.probe?.close())
    } catch {
      report.cleanupFailure = true
      process.exitCode = 1
    }
  await browser?.close()
  for (const target of [server, proxy])
    if (target.listening) {
      target.closeAllConnections()
      await new Promise((resolve) => target.close(resolve))
    }
  report.sourceAfter = snapshot()
  report.externalRoutes = external
  report.proxyDenied = proxyDenied
  report.proxySocketErrors = proxySocketErrors
  report.injectedResetHandled = injectedResetHandled
  report.cspBlockedAttempts = cspBlocked
  report.pageErrorNames = errors
  assert.deepEqual(report.sourceBefore, report.sourceAfter)
  writeFileSync(receipt, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: !!report.passed,
      stages: report.stages.length,
      actualSDK: true,
      fakeCamera: true,
      actualHuman: false,
      identityVerified: false,
      positiveHeadVerified: false,
      cameraScreenshots: 0,
      cspBlockedAttempts: cspBlocked,
    }),
  )
}
