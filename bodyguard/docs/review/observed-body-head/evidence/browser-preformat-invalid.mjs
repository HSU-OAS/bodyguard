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
assert(/^\/private\/tmp\/bodyguard-body-head-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const receipt = join(scratch, `browser-${label}.json`)
assert(!existsSync(receipt))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sourcePaths = [
  'src/avatar/observedBodyHead.test.ts',\n  'src/avatar/ownedAvatarPair.ts',\n  'src/avatar/directionalRig.ts',\n  'src/avatar/eightWeightSkin.ts',\n  'src/pose/bodyFaceVideoSource.ts',
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
  'e2e/fixtures/observedBodyHeadProbe.ts',
  'e2e/fixtures/observedBodyHead.vite.ts',
  'scripts/test-observed-body-head-browser.mjs',
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
  ['/probe.js', readFileSync(join(scratch, 'probe-'+label+'/probe.js'))],
  ...['male', 'female'].map((gender) => {\n    const bytes = execFileSync('git', ['show', '25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:bodyguard/frontend/src/avatar/models/bodyguard-'+gender+'-candidate-a37.glb'], {cwd:root,maxBuffer:20*1024*1024});\n    assert.equal(sha(bytes), gender === 'male' ? 'cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927' : '27c10902aa377e995bdbc115ab773cf22f8ea38582c49820304a33ad7685f25a');\n    return ['/'+gender+'.glb',bytes];\n  }),\n  ...['pose_landmarker_lite.task', 'face_landmarker.task'].map((n) => [
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
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 연결 시험</title><body><p>미완성 후보 · 합성/가짜 카메라 · 코칭 아님</p><canvas width="1440" height="900"></canvas><script type="module">import{mountObservedBodyHead}from"/probe.js";window.openProbe=async(g)=>{window.probe?.release();await window.probe?.close();window.probe=await mountObservedBodyHead(document.querySelector("canvas"),g);return window.probe.snapshot()}</script></body></html>',
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
  stages: [],\n  previews: [],\n  positiveMovement: "synthetic-only",
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

  for (const gender of ['male','female']) {
    const states=[]
    const initial = await page.evaluate((g) => window.openProbe(g), gender)
    assert(initial.cameraLive && initial.independent && initial.framing.every(Boolean))
    assert.equal(initial.nativeBodies, 0)
    assert.equal(initial.nativeFaces, 0)
    states.push({case:'owned-pair-prepared',...initial})
    const missing = await page.evaluate(() => window.probe.next('native'))
    assert(missing.accepted && missing.sourceUnchanged && missing.referenceUnchanged)
    assert.equal(missing.latestState.tracked, 0)
    assert.equal(missing.latestState.head.tracked, 0)
    assert.equal(missing.nativeBodies, 1)
    assert.equal(missing.nativeFaces, 1)
    states.push({case:'native-fake-camera-missing',...missing})
    const positive = await page.evaluate(() => window.probe.next('synthetic'))
    assert(positive.accepted && positive.limbMovement)
    assert.equal(positive.latestState.tracked, 8)
    assert.equal(positive.latestState.head.tracked, 1)
    assert(positive.headError < 0.00001)
    assert.equal(positive.nativeBodies, 1)
    assert.equal(positive.nativeFaces, 1)
    states.push({case:'synthetic-same-frame-body-head',...positive})
    await page.waitForFunction((n) => window.probe.counters().frames > n+20, positive.frames)
    const animated = await page.evaluate(() => window.probe.snapshot())
    assert(animated.calls > 0 && animated.triangles > 0)
    assert(animated.sourceUnchanged && animated.referenceUnchanged && animated.weightsUnchanged && animated.lengthsAndOtherBones)
    assert(animated.framing.every(Boolean) && animated.headError < 0.00001)
    states.push({case:'actual-webgl-raf-synthetic',...animated})
    const image = await page.locator('canvas').screenshot()
    const preview = gender+'-'+label+'.png'
    writeFileSync(join(scratch,preview), image, {flag:'wx'})
    report.previews.push({file:preview,sha256:sha(image),avatarOnly:true,unfinishedCandidate:true})
    const noFace = await page.evaluate(() => window.probe.next('missing-face'))
    assert(noFace.accepted && noFace.headFrozen)
    assert.equal(noFace.latestState.tracked, 8)
    assert.equal(noFace.latestState.head.tracked, 0)
    states.push({case:'synthetic-face-missing-body-continues',...noFace})
    const restored = await page.evaluate(() => window.probe.next('synthetic'))
    assert(restored.accepted && restored.headError < 0.00001)
    assert.equal(restored.latestState.head.tracked, 1)
    states.push({case:'fresh-synthetic-head-resumes',...restored})
    const multi = await page.evaluate(() => window.probe.next('multiple-body'))
    assert(multi.accepted && multi.headFrozen)
    assert.equal(multi.latestState.tracked, 0)
    assert.equal(multi.latestState.head.tracked, 0)
    states.push({case:'synthetic-multiple-body-clears-both',...multi})
    const native = await page.evaluate(() => window.probe.next('native'))
    assert(native.accepted && native.headFrozen && native.sourceUnchanged && native.referenceUnchanged)
    assert.equal(native.latestState.tracked, 0)
    assert.equal(native.latestState.head.tracked, 0)
    assert.equal(native.nativeBodies, 2)
    assert.equal(native.nativeFaces, 2)
    assert.equal(native.syntheticBodies, 4)
    assert.equal(native.syntheticFaces, 4)
    states.push({case:'native-miss-revokes-prior-synthetic',...native})
    await page.evaluate(() => {window.probe.holdNext(); window.reading=window.probe.next('native')})
    await page.waitForFunction(() => window.probe.counters().pendingFace)
    const before = await page.evaluate(() => window.probe.snapshot())
    await page.evaluate(() => { window.cleaned=false; window.closing=window.probe.close().then(v=>{window.cleaned=true;return v}) })
    await page.evaluate(() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
    const pending = await page.evaluate(async () => ({...await window.probe.snapshot(),completed:window.cleaned}))
    assert(pending.closed && !pending.cleaned && !pending.completed && pending.pendingFace && pending.inputOpen && pending.cameraLive)
    assert.equal(pending.latestState.status,'closed')
    assert.equal(pending.latestState.head.status,'closed')
    assert.equal(pending.bodyCloses,before.bodyCloses)
    assert.equal(pending.poseCloses,0)
    assert.equal(pending.faceCloses,0)
    states.push({case:'pair-closed-native-pending-barrier',...pending})
    const final = await page.evaluate(async()=>{window.probe.release();const late=await window.reading;const result=await window.closing;return {lateAccepted:late.accepted,...result}})
    assert(!final.lateAccepted && final.cleaned && final.closed && final.tracksEnded && final.videoDetached && !final.inputOpen)
    assert.equal(final.bodyCloses,final.nativeBodies+final.syntheticBodies)
    assert.equal(final.coherent,final.bodyCloses)
    assert.equal(final.poseCloses,1)
    assert.equal(final.faceCloses,1)
    assert(final.weightsUnchanged && final.sourceUnchanged && final.referenceUnchanged && final.lengthsAndOtherBones)
    states.push({case:'late-discard-before-detectors-close',...final})
    report.stages.push({gender,states})
  }
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
  await context.close()
  report.passed = true
} catch (error) {
  // Never publish SDK/input-bearing error text. Fixed codes and source receipts suffice.
  report.failure = { name: error.name, code: 'observed-body-head-browser-failed' }
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
      await page.evaluate(async () => {window.probe?.release();await window.probe?.close()})
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


