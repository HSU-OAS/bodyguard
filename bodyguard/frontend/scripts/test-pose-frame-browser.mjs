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
assert(['blank', 'video', 'playback', 'resources'].includes(mode))
assert(
  (mode === 'blank'
    ? /^\/private\/tmp\/bodyguard-pose-frame-proof\.[A-Za-z0-9]+$/
    : mode === 'video'
      ? /^\/private\/tmp\/bodyguard-video-pose-proof\.[A-Za-z0-9]+$/
      : mode === 'resources'
        ? /^\/private\/tmp\/bodyguard-playback-resources-proof\.[A-Za-z0-9]+$/
        : /^\/private\/tmp\/bodyguard-pose-playback-proof\.[A-Za-z0-9]+$/
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
  'src/avatar/ownedPosePlayback.ts',
  'src/coaching/ownedPlaybackResources.ts',
  'src/coaching/resources.ts',
  'src/coaching/session.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/directionalRig.ts',
  'src/avatar/eightWeightSkin.ts',
  'e2e/fixtures/ownedPoseFrameProbe.ts',
  'e2e/fixtures/ownedPoseFrame.vite.ts',
  'e2e/fixtures/ownedVideoPoseProbe.ts',
  'e2e/fixtures/ownedVideoPose.vite.ts',
  'e2e/fixtures/ownedPosePlaybackProbe.ts',
  'e2e/fixtures/ownedPosePlayback.vite.ts',
  'e2e/fixtures/ownedPlaybackResourcesProbe.ts',
  'e2e/fixtures/ownedPlaybackResources.vite.ts',
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
      mode === 'resources'
        ? '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 세션 자원 검증</title><body style="margin:0;background:white"><p>미완성 A37 · 가짜 카메라/합성 세션 · 코칭 아님</p><canvas id="avatar"></canvas><script type="module">import{mountPlaybackResourcesProbe}from"/probe.js";window.openPoseFrame=async gender=>{await window.probe?.close();window.probe=mountPlaybackResourcesProbe(document.querySelector("#avatar"),gender);return window.probe.snapshot()};</script>'
        : mode === 'playback'
          ? '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 연속 재생 검증</title><body style="margin:0;background:white"><p>미완성 A37 · native 미검출 / 긍정 움직임 합성 · 코칭 아님</p><canvas id="avatar"></canvas><script type="module">import{mountVideoPoseProbe,mountPoseFrameProbe}from"/probe.js";window.openPoseFrame=async(gender,kind="video")=>{await window.probe?.close();window.probe=kind==="video"?await mountVideoPoseProbe(document.querySelector("#avatar"),gender):await mountPoseFrameProbe(document.querySelector("#avatar"),gender);return window.probe.snapshot()};</script>'
          : mode === 'video'
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
  actualFakeCamera: mode !== 'blank',
  actualVideoFrame: mode !== 'blank',
  actualRAF: mode === 'playback' || mode === 'resources',
  actualHuman: false,
  syntheticPositiveMovement: mode === 'blank' || mode === 'playback',
  syntheticSessionGates: mode === 'resources',
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
      mode !== 'blank'
        ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
        : [],
    proxy: { server: originOf(proxy), bypass: '127.0.0.1,localhost,[::1]' },
  })
  report.browser = browser.version()
  context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    serviceWorkers: 'block',
    permissions: mode !== 'blank' ? ['camera'] : [],
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
  }, mode !== 'blank')
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openPoseFrame === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    const initial = await page.evaluate((value) => window.openPoseFrame(value), gender)
    if (mode === 'resources') {
      assert.equal(initial.models, 0)
      assert.equal(initial.cameras, 0)
      assert.equal(initial.nativeCalls, 0)
      assert.equal(initial.renderFrames, 0)
      sample.stages.push({ case: 'constructor-acquisition-zero', ...initial })
      await page.evaluate(() => window.probe.start())
      await page.waitForFunction(() => window.probe.snapshot().nativeCloses >= 4)
      await page.evaluate(() => window.probe.holdNextResult())
      await page.waitForFunction(() => window.probe.snapshot().held)
      const held = await page.evaluate(() => window.probe.snapshot())
      assert(held.cameraLive && held.rawVideoHidden && held.framing.every(Boolean))
      assert.equal(held.models, 2)
      assert.equal(held.nativeCloses, held.nativeCalls - 1)
      sample.stages.push({ case: 'prepared-running-native-result-held', ...held })
      const preview = join(scratch, `${label}-${gender}.png`)
      await page.locator('#avatar').screenshot({ path: preview })
      sample.previewSha = sha(readFileSync(preview))
      await page.evaluate(() => {
        window.pendingRuntimeClose = window.probe.pause()
      })
      const pausing = await page.evaluate(() => window.probe.snapshot())
      assert.equal(pausing.session.status, 'paused')
      assert(pausing.cameraLive && pausing.held)
      assert.equal(pausing.detectorCloses, 0)
      assert.equal(pausing.cameraCloses, 0)
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
      const waiting = await page.evaluate(() => window.probe.snapshot())
      assert.equal(waiting.renderFrames, pausing.renderFrames)
      assert.equal(waiting.nativeCalls, held.nativeCalls)
      sample.stages.push({ case: 'paused-awaiting-result-native-still-owned', ...waiting })
      await page.evaluate(() => window.probe.releaseHeldResult())
      const paused = await page.evaluate(() => window.pendingRuntimeClose)
      assert(paused.tracksEnded && paused.detached && paused.allFramesClosed)
      assert.equal(paused.models, 0)
      assert.equal(paused.detectorCloses, 1)
      assert.equal(paused.cameraCloses, 1)
      assert.equal(paused.nativeCloses, held.nativeCalls)
      assert.equal(paused.frameCloses, paused.frames)
      assert.deepEqual(paused.memory, paused.baseline)
      sample.stages.push({ case: 'result-input-settled-sdk-camera-closed', ...paused })
      await page.evaluate(() => {
        window.pendingRuntimeClose = null
      })
      const resumed = await page.evaluate(() => window.probe.resume())
      assert.equal(resumed.session.generation, 2)
      assert.equal(resumed.resources.status, 'running')
      assert.equal(resumed.cameras, 2)
      await page.waitForFunction(
        (minimum) => window.probe.snapshot().nativeCloses > minimum + 3,
        paused.nativeCalls,
      )
      const running = await page.evaluate(() => window.probe.snapshot())
      assert(running.cameraLive && running.framing.every(Boolean))
      sample.stages.push({ case: 'explicit-resume-fresh-generation', ...running })
      const expired = await page.evaluate(() => window.probe.expire())
      assert.equal(expired.session.reason, 'session-expired')
      assert.equal(expired.session.verifiedMs, 0)
      assert(expired.tracksEnded && expired.detached && expired.allFramesClosed)
      assert.equal(expired.models, 0)
      assert.equal(expired.detectorCloses, 2)
      assert.equal(expired.cameraCloses, 2)
      assert.equal(expired.nativeCloses, expired.nativeCalls)
      assert.equal(expired.frameCloses, expired.frames)
      assert.equal(expired.frameErrors, 0)
      assert.deepEqual(expired.memory, expired.baseline)
      assert.deepEqual(expired.failures, [])
      sample.stages.push({ case: 'synthetic-session-expiry-no-completion', ...expired })
      const closed = await page.evaluate(() => window.probe.close())
      const again = await page.evaluate(() => window.probe.close())
      assert.equal(again.detectorCloses, 2)
      assert.equal(again.cameraCloses, 2)
      assert.equal(closed.models, 0)
      sample.stages.push({ case: 'idempotent-whole-close', ...closed })
      sample.passed = true
      continue
    }
    assert.equal(initial.models, 2)
    assert(initial.framing.every(Boolean))
    assert.equal(initial.nativeCalls, 0)
    assert.equal(initial.syntheticCalls, 0)
    sample.stages.push({ case: 'prepared', ...initial })
    if (mode === 'playback') {
      assert(initial.cameraLive && initial.rawVideoHidden)
      assert.equal(initial.renderFrames, 0)
      assert.equal(initial.frames, 0)
      assert(await page.evaluate(() => window.probe.startPlayback('video')))
      await page.waitForFunction(() => window.probe.snapshot().nativeCloses >= 6)
      await page.evaluate(() => window.probe.holdNextResult())
      await page.waitForFunction(() => window.probe.snapshot().held)
      const holding = await page.evaluate(() => window.probe.snapshot())
      assert(holding.nativeCalls >= 7 && holding.playback.pending)
      assert.equal(holding.nativeCloses, holding.nativeCalls - 1)
      assert.equal(holding.frames, holding.nativeCalls)
      assert.equal(holding.frameCloseCalls, holding.frames - 1)
      assert.equal(holding.allFramesClosed, false)
      assert.equal(holding.state.tracked, 0)
      sample.stages.push({ case: 'native-video-result-held', ...holding })
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
          ),
      )
      const rendering = await page.evaluate(() => window.probe.snapshot())
      assert(rendering.renderFrames > holding.renderFrames)
      assert.equal(rendering.nativeCalls, holding.nativeCalls)
      assert(rendering.referenceUnchanged && rendering.framing.every(Boolean))
      sample.stages.push({ case: 'raf-continues-during-native-pending', ...rendering })
      await page.evaluate(() => {
        window.heldDeadline = performance.now() + 300
      })
      await page.waitForFunction(() => performance.now() >= window.heldDeadline)
      await page.evaluate(() => window.probe.releaseHeldResult())
      await page.waitForFunction(
        (minimum) => window.probe.snapshot().nativeCloses > minimum,
        holding.nativeCalls,
      )
      const recovered = await page.evaluate(() => window.probe.snapshot())
      assert.equal(recovered.playback.status, 'running')
      assert.equal(recovered.playback.failure, null)
      assert.equal(recovered.state.tracked, 0)
      sample.stages.push({
        case: 'expired-native-result-discarded-new-frame-continues',
        ...recovered,
      })
      await page.evaluate(() => window.probe.holdNextResult())
      await page.waitForFunction(() => window.probe.snapshot().held)
      const heldClosing = await page.evaluate(() => window.probe.snapshot())
      await page.evaluate(() => {
        window.pendingRuntimeClose = window.probe.close()
      })
      const closing = await page.evaluate(() => window.probe.snapshot())
      assert(closing.closed && closing.cameraLive && closing.playback.pending)
      assert.equal(closing.nativeCloses, heldClosing.nativeCalls - 1)
      assert.equal(closing.detectorCloses, 0)
      assert.equal(closing.models, 2)
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
      const waiting = await page.evaluate(() => window.probe.snapshot())
      assert.equal(waiting.renderFrames, closing.renderFrames)
      await page.evaluate(() => window.probe.releaseHeldResult())
      const stopped = await page.evaluate(() => window.pendingRuntimeClose)
      assert(stopped.tracksEnded && stopped.detached && stopped.allFramesClosed)
      assert.equal(stopped.models, 0)
      assert.equal(stopped.nativeCloses, heldClosing.nativeCalls)
      assert.equal(stopped.detectorCloses, 1)
      assert.deepEqual(stopped.memory, stopped.baseline)
      sample.stages.push({
        case: 'late-native-result-reclaimed-before-sdk-camera-close',
        ...stopped,
      })
      await page.evaluate((value) => window.openPoseFrame(value, 'synthetic'), gender)
      await page.evaluate(() => {
        window.pendingRuntimeClose = null
      })
      assert(await page.evaluate(() => window.probe.startPlayback('synthetic')))
      await page.waitForFunction(() => {
        const s = window.probe.snapshot()
        return s.held && s.movingFrames >= 3
      })
      const moving = await page.evaluate(() => window.probe.snapshot())
      assert(moving.userChanged && moving.referenceUnchanged && moving.framing.every(Boolean))
      assert.equal(moving.syntheticCalls, 3)
      assert.equal(moving.syntheticCloses, 2)
      assert.equal(moving.nativeCalls, 0)
      assert(moving.playback.pending)
      sample.stages.push({ case: 'synthetic-positive-smoothed-while-source-pending', ...moving })
      const preview = join(scratch, `${label}-${gender}.png`)
      await page.locator('#avatar').screenshot({ path: preview })
      sample.previewSha = sha(readFileSync(preview))
      await page.waitForFunction(() => window.probe.snapshot().state.tracked === 0)
      const expired = await page.evaluate(() => window.probe.snapshot())
      assert(
        expired.held &&
          expired.playback.pending &&
          expired.userChanged &&
          expired.referenceUnchanged,
      )
      assert(expired.renderFrames > moving.renderFrames)
      assert.equal(expired.syntheticCalls, 3)
      sample.stages.push({ case: 'observation-expires-without-invented-correct-pose', ...expired })
      await page.evaluate(() => {
        window.pendingRuntimeClose = window.probe.close()
      })
      await page.evaluate(() => window.probe.releaseHeldResult())
      const closed = await page.evaluate(() => window.pendingRuntimeClose)
      assert.equal(closed.models, 0)
      assert.equal(closed.syntheticCloses, 3)
      assert.equal(closed.nativeCloses, 0)
      assert.equal(closed.detectorCloses, 1)
      assert.deepEqual(closed.memory, closed.baseline)
      const again = await page.evaluate(() => window.probe.close())
      assert.equal(again.syntheticCloses, 3)
      sample.stages.push({ case: 'synthetic-source-and-pair-closed-idempotently', ...closed })
      sample.passed = true
      continue
    }
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
  assert.equal(counts.camera, mode === 'resources' ? 4 : mode !== 'blank' ? 2 : 0)
  assert.equal(routedExternal, 0)
  assert.equal(errors.length, 0)
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
} finally {
  if (page && !page.isClosed()) {
    try {
      report.lastCleanup = await page.evaluate(() => {
        window.probe?.releaseHeldResult()
        return window.pendingRuntimeClose ?? window.probe?.close()
      })
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
