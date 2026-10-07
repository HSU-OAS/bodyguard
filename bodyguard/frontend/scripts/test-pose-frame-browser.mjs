// FR-M-02/07·FR-A-03/NFR-07/08: actual SDK blank input; private GLB + synthetic positive frame.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const [scratch, label, mode = 'blank'] = process.argv.slice(2)
assert(mode === 'blank' || mode === 'video')
assert(
  (mode === 'blank'
    ? /^\/private\/tmp\/bodyguard-pose-frame-proof\.[A-Za-z0-9]+$/
    : /^\/private\/tmp\/bodyguard-video-pose-proof\.[A-Za-z0-9]+$/
  ).test(scratch ?? ''),
)
assert.equal(realpathSync(scratch), scratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const reportPath = join(scratch, `browser-${label}.json`)
assert(!existsSync(reportPath))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const files = [
  'src/pose/ownedPoseFrame.ts',
  'src/pose/videoPoseSource.ts',
  'src/pose/landmarker.ts',
  'src/pose/constants.ts',
  'src/avatar/ownedAvatarPair.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/directionalRig.ts',
  'src/avatar/eightWeightSkin.ts',
  'e2e/fixtures/ownedPoseFrameProbe.ts',
  'e2e/fixtures/ownedPoseFrame.vite.ts',
  'e2e/fixtures/ownedVideoPoseProbe.ts',
  'e2e/fixtures/ownedVideoPose.vite.ts',
  'scripts/test-pose-frame-browser.mjs',
  'pnpm-lock.yaml',
]
const snapshot = () =>
  Object.fromEntries(files.map((path) => [path, sha(readFileSync(join(root, path)))]))
const assetCommit = '25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad'
const assets = Object.fromEntries(
  ['male', 'female'].map((gender) => {
    const path = `bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`
    const bytes = readFileSync(join(scratch, path))
    assert(
      bytes.equals(
        execFileSync('git', ['show', `${assetCommit}:${path}`], {
          cwd: root,
          maxBuffer: 32 * 1024 * 1024,
        }),
      ),
    )
    return [gender, bytes]
  }),
)
const wasmNames = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
]
const resources = Object.fromEntries([
  ['/probe.js', readFileSync(join(scratch, 'probe/probe.js'))],
  [
    '/models/pose_landmarker_lite.task',
    readFileSync(join(root, 'public/models/pose_landmarker_lite.task')),
  ],
  ...wasmNames.map((name) => [
    `/mediapipe/wasm/${name}`,
    readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/wasm', name)),
  ]),
  ...Object.entries(assets).map(([gender, bytes]) => [`/${gender}.glb`, bytes]),
])
let proxyDenied = 0
const proxy = createServer((_req, res) => {
  proxyDenied++
  res.writeHead(403)
  res.end()
})
proxy.on('connect', (_req, socket) => {
  proxyDenied++
  socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
})
const server = createServer((req, res) => {
  const path = req.url?.split('?')[0]
  if (path === '/') {
    // TEST ONLY. The product SDK egress policy is still awaiting separate approval.
    res.setHeader('Content-Security-Policy', "connect-src 'self'")
    res.setHeader('Content-Type', 'text/html')
    res.end(
      mode === 'video'
        ? '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 영상 전달 검증</title><body style="margin:0;background:white"><p>미완성 A37 · 가짜 카메라 · 실제 SDK · 코칭 아님</p><canvas id="avatar"></canvas><script type="module">import{mountVideoPoseProbe}from"/probe.js";window.openPoseFrame=async gender=>{await window.probe?.close();window.probe=await mountVideoPoseProbe(document.querySelector("#avatar"),gender);return window.probe.snapshot()};</script>'
        : '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 추론 전달 검증</title><body style="margin:0;background:white"><p>미완성 A37 · blank SDK 입력 · 긍정 동작 합성 · 코칭 아님</p><canvas id="avatar"></canvas><script type="module">import{mountPoseFrameProbe}from"/probe.js";window.openPoseFrame=async gender=>{await window.probe?.close();window.probe=await mountPoseFrameProbe(document.querySelector("#avatar"),gender);return window.probe.snapshot()};</script>',
    )
  } else if (Object.hasOwn(resources, path)) {
    res.setHeader(
      'Content-Type',
      path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.wasm')
          ? 'application/wasm'
          : path.endsWith('.glb')
            ? 'model/gltf-binary'
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
  assetCommit,
  assetHashes: Object.fromEntries(
    Object.entries(assets).map(([name, bytes]) => [name, sha(bytes)]),
  ),
  sdk: JSON.parse(
    readFileSync(join(root, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8'),
  ).version,
  resources: Object.fromEntries(
    Object.entries(resources).map(([path, bytes]) => [
      path,
      { bytes: bytes.length, sha: sha(bytes) },
    ]),
  ),
  actualSDK: true,
  actualChrome: true,
  actualWebGL: true,
  actualCamera: false,
  actualFakeCamera: mode === 'video',
  actualVideoFrame: mode === 'video',
  actualHuman: false,
  syntheticPositiveMovement: mode === 'blank',
  releaseAvatar: false,
  productPolicyApproved: false,
  inputStored: false,
  rawPointsLogged: false,
  samples: [],
}
let browser,
  page,
  context,
  routedExternal = 0
const errors = []
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
const originOf = (server) => {
  const address = server.address()
  assert(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}
try {
  await listen(proxy)
  await listen(server)
  const origin = originOf(server)
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args:
      mode === 'video'
        ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
        : [],
    proxy: { server: originOf(proxy), bypass: '127.0.0.1,localhost,[::1]' },
  })
  report.browser = browser.version()
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    serviceWorkers: 'block',
    permissions: mode === 'video' ? ['camera'] : [],
  })
  await context.route('**/*', async (route) => {
    if (!route.request().url().startsWith(`${origin}/`)) {
      routedExternal++
      await route.abort()
      return
    }
    await route.continue()
  })
  await context.addInitScript((videoMode) => {
    window.__cameraCalls = 0
    window.__cspAttempts = 0
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.violatedDirective === 'connect-src') window.__cspAttempts++
    })
    if (navigator.mediaDevices) {
      const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        window.__cameraCalls++
        if (videoMode) return native(constraints)
        throw new Error('Camera forbidden in pose frame fixture')
      }
    }
  }, mode === 'video')
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openPoseFrame === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    const initial = await page.evaluate((value) => window.openPoseFrame(value), gender)
    assert.equal(initial.models, 2)
    assert(initial.framing.every(Boolean))
    assert.equal(initial.nativeCalls, 0)
    assert.equal(initial.syntheticCalls, 0)
    sample.stages.push({ case: 'prepared', ...initial })
    if (mode === 'video') {
      assert(initial.cameraLive && initial.rawVideoHidden)
      assert.equal(initial.frames, 0)
      for (let index = 0; index < 6; index++) {
        const frame = await page.evaluate(() => window.probe.read())
        assert(frame.delivered)
        assert.equal(frame.persons, 0)
        assert.equal(frame.state.tracked, 0)
        assert.equal(frame.nativeCalls, index + 1)
        assert.equal(frame.nativeCloses, index + 1)
        assert.equal(frame.frames, index + 1)
        assert.equal(frame.frameCloseCalls, index + 1)
        assert.equal(frame.frameCloseErrors, 0)
        assert(frame.allFramesClosed)
        assert(frame.referenceUnchanged && frame.framing.every(Boolean))
        sample.stages.push({ case: `decoded-native-frame-${index + 1}`, ...frame })
      }
      await page.evaluate(() => {
        window.pendingVideoRead = window.probe.startPending()
      })
      const stopped = await page.evaluate(() => window.probe.stopSource())
      const cancelled = await page.evaluate(() => window.pendingVideoRead)
      assert(!cancelled.delivered)
      assert(stopped.cameraLive)
      assert.equal(stopped.nativeCalls, 6)
      assert.equal(stopped.frames, 6)
      sample.stages.push({ case: 'paused-decoder-cancelled-read', ...stopped })
      const after = await page.evaluate(() => window.probe.read())
      assert(!after.delivered)
      assert.equal(after.nativeCalls, 6)
      await page.evaluate(() => window.probe.resume())
      const resumed = await page.evaluate(() => window.probe.read())
      assert(resumed.delivered && resumed.allFramesClosed)
      assert.equal(resumed.nativeCalls, 7)
      assert.equal(resumed.frameCloseCalls, 7)
      sample.stages.push({ case: 'explicit-source-resume', ...resumed })
      const preview = join(scratch, `${label}-${gender}.png`)
      await page.locator('#avatar').screenshot({ path: preview })
      sample.previewSha = sha(readFileSync(preview))
      const closed = await page.evaluate(() => window.probe.close())
      assert(closed.closed && closed.tracksEnded && closed.detached && closed.allFramesClosed)
      assert.equal(closed.models, 0)
      assert.equal(closed.attached, 0)
      assert.equal(closed.detectorCloses, 1)
      assert.equal(closed.frameCloseCalls, 7)
      assert.deepEqual(closed.memory, closed.baseline)
      const again = await page.evaluate(() => window.probe.close())
      assert.equal(again.detectorCloses, 1)
      assert.equal(again.frameCloseCalls, 7)
      sample.stages.push({ case: 'camera-detached-native-closed', ...closed })
      sample.passed = true
      continue
    }
    const blank = await page.evaluate(() => window.probe.read('native'))
    assert.equal(blank.persons, 0)
    assert.equal(blank.state.tracked, 0)
    assert(blank.stampsPreserved)
    assert.equal(blank.nativeCalls, 1)
    assert.equal(blank.nativeCloses, 1)
    sample.stages.push({ case: 'actual-sdk-generated-blank', ...blank })
    const moved = await page.evaluate(() => window.probe.read('synthetic'))
    assert(moved.delivered && moved.stampsPreserved)
    assert.equal(moved.persons, 1)
    assert.equal(moved.state.tracked, 8)
    assert(moved.userChanged && moved.referenceUnchanged)
    assert(moved.framing.every(Boolean))
    assert.equal(moved.syntheticCloses, 1)
    sample.stages.push({ case: 'synthetic-positive-handoff', ...moved })
    const preview = join(scratch, `${label}-${gender}.png`)
    await page.locator('#avatar').screenshot({ path: preview })
    sample.previewSha = sha(readFileSync(preview))
    const revoke = await page.evaluate(() => window.probe.read('native'))
    assert.equal(revoke.persons, 0)
    assert.equal(revoke.state.tracked, 0)
    assert(revoke.stampsPreserved && revoke.referenceUnchanged)
    assert.equal(revoke.nativeCalls, 2)
    assert.equal(revoke.nativeCloses, 2)
    sample.stages.push({ case: 'actual-sdk-no-person-revokes-synthetic-coverage', ...revoke })
    const repeated = await page.evaluate(() => window.probe.read('native', true))
    assert(!repeated.delivered)
    assert.equal(repeated.nativeCalls, 2)
    sample.stages.push({ case: 'repeated-capture-no-inference', ...repeated })
    const closed = await page.evaluate(() => window.probe.close())
    assert(closed.closed)
    assert.equal(closed.state.status, 'closed')
    assert.equal(closed.models, 0)
    assert.equal(closed.attached, 0)
    assert.equal(closed.detectorCloses, 1)
    assert.deepEqual(closed.memory, closed.baseline)
    const closedAgain = await page.evaluate(() => window.probe.close())
    assert.equal(closedAgain.detectorCloses, 1)
    const after = await page.evaluate(() => window.probe.read('native'))
    assert(!after.delivered)
    assert.equal(after.nativeCalls, 2)
    sample.stages.push({ case: 'closed-idempotent-no-delivery', ...after })
    sample.passed = true
  }
  // Fixed counters only, no attempted URLs or SDK/raw input messages.
  await page.waitForTimeout(250)
  const counts = await page.evaluate(() => ({
    camera: window.__cameraCalls,
    csp: window.__cspAttempts,
  }))
  report.boundary = { ...counts, routedExternal, proxyDenied, errors }
  assert.equal(counts.camera, mode === 'video' ? 2 : 0)
  assert.equal(routedExternal, 0)
  assert.equal(errors.length, 0)
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
} finally {
  if (page && !page.isClosed()) {
    try {
      report.lastCleanup = await page.evaluate(() => window.probe?.close())
    } catch {
      report.cleanupFailed = true
    }
    try {
      report.boundary = {
        ...(await page.evaluate(() => ({
          camera: window.__cameraCalls,
          csp: window.__cspAttempts,
        }))),
        routedExternal,
        proxyDenied,
        errors,
      }
    } catch {
      /* preserve counters */
    }
  }
  for (const operation of [
    () => context?.close(),
    () => browser?.close(),
    () => new Promise((resolve) => server.close(resolve)),
    () => new Promise((resolve) => proxy.close(resolve)),
  ]) {
    try {
      await operation()
    } catch {
      report.cleanupFailed = true
      process.exitCode = 1
    }
  }
  report.sourceAfter = snapshot()
  try {
    assert.deepEqual(report.sourceAfter, report.sourceBefore)
  } catch {
    report.sourceChanged = true
    process.exitCode = 1
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: report.samples.filter((s) => s.passed).length,
      failed: report.samples.filter((s) => !s.passed).length,
      reportPath,
    }),
  )
}
