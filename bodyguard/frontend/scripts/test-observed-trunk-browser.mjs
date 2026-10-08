// FR-A-01/03·FR-M-07/NFR-07/08: actual GLB/Chrome, synthetic body, no webcam capture.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url)),
  [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-observed-trunk-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const receipt = join(scratch, `browser-${label}.json`)
assert(!existsSync(receipt))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const sourcePaths = [
  'src/avatar/observedTrunk.ts',
  'src/avatar/observedTrunk.test.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/ownedAvatarPair.ts',
  'src/avatar/ownedAvatarPair.test.ts',
  'src/coaching/nativePlaybackResources.ts',
  'src/coaching/nativePlaybackResources.test.ts',
  'src/avatar/directionalRig.ts',
  'src/avatar/eightWeightSkin.ts',
  'e2e/fixtures/observedTrunkProbe.ts',
  'e2e/fixtures/observedTrunk.vite.ts',
  'scripts/test-observed-trunk-browser.mjs',
  'pnpm-lock.yaml',
]
const snapshot = () =>
  Object.fromEntries(sourcePaths.map((path) => [path, sha(readFileSync(join(root, path)))]))
const assetCommit = '25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad'
const assets = Object.fromEntries(
  ['male', 'female'].map((gender) => {
    const bytes = execFileSync(
      'git',
      [
        'show',
        `${assetCommit}:bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`,
      ],
      { cwd: root, maxBuffer: 32 * 1024 * 1024 },
    )
    assert.equal(
      sha(bytes),
      gender === 'male'
        ? 'cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927'
        : '27c10902aa377e995bdbc115ab773cf22f8ea38582c49820304a33ad7685f25a',
    )
    return [gender, bytes]
  }),
)
const probe = readFileSync(join(scratch, 'probe/probe.js'))
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: snapshot(),
  assetCommit,
  assetHashes: Object.fromEntries(Object.entries(assets).map(([key, bytes]) => [key, sha(bytes)])),
  actualChrome: true,
  actualWebGL: true,
  syntheticObservations: true,
  actualSDK: false,
  actualCamera: false,
  finalAvatar: false,
  samples: [],
}
const server = createServer((req, res) => {
  const path = req.url?.split('?')[0]
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>몸통 연결 검수</title><style>body{margin:0;background:white;font:16px system-ui;color:#173356}p{position:absolute;margin:20px}canvas{display:block;width:1440px;height:900px}</style><p>미완성 A37 · 생성 관찰 · 코칭 아님</p><canvas></canvas><script type="module">import{mountObservedTrunk}from"/probe.js";window.openTrunk=async gender=>{window.trunk?.close();window.trunk=await mountObservedTrunk(document.querySelector("canvas"),gender);return window.trunk.snapshot()};</script></html>',
    )
  } else if (path === '/probe.js') {
    res.setHeader('Content-Type', 'text/javascript')
    res.end(probe)
  } else if (path === '/male.glb' || path === '/female.glb') {
    res.setHeader('Content-Type', 'model/gltf-binary')
    res.end(assets[path.slice(1, -4)])
  } else {
    res.writeHead(404)
    res.end()
  }
})
let browser,
  page,
  external = 0
const errors = []
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  report.browser = browser.version()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  })
  await context.route('**/*', async (route) => {
    if (!route.request().url().startsWith(`${origin}/`)) {
      external++
      await route.abort()
      return
    }
    await route.continue()
  })
  await context.addInitScript(() => {
    window.__cameraCalls = 0
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async () => {
        window.__cameraCalls++
        throw new Error('Camera forbidden in generated fixture')
      }
  })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openTrunk === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    await page.evaluate((value) => window.openTrunk(value), gender)
    for (const mode of ['side', 'forward', 'hidden', 'multiple', 'recover', 'expired']) {
      const start = await page.evaluate((mode) => window.trunk.setMode(mode).sequence, mode)
      if (mode === 'expired') {
        await page.waitForFunction(() => window.trunk.peek().state.tracked === 0)
        // The last observation may interpolate until its original expiry. Freeze is
        // required after expiry, not at the moment the provider stops returning frames.
        const frame = await page.evaluate(() => window.trunk.markPose())
        await page.waitForFunction(
          (frame) => window.trunk.peek().renderedFrames >= frame + 4,
          frame,
        )
      } else
        await page.waitForFunction(
          (sequence) => window.trunk.peek().sequence >= sequence + 60,
          start,
          { timeout: 10_000 },
        )
      const state = await page.evaluate(() => window.trunk.snapshot())
      assert(
        state.sourceUnchanged &&
          state.referenceUnchanged &&
          state.positionsScalesPreserved &&
          state.authoredAnatomyPreserved,
      )
      assert(state.fullBodyInside && state.calls > 0 && state.triangles > 0)
      assert.equal(
        state.state.tracked,
        mode === 'hidden' ? 7 : ['multiple', 'expired'].includes(mode) ? 0 : 9,
      )
      if (['side', 'forward', 'recover'].includes(mode)) {
        assert(state.trunkChanged)
        assert(state.maxDirectionError < 0.002)
      }
      if (mode === 'hidden') assert(state.trunkFrozen)
      if (['multiple', 'expired'].includes(mode)) assert(state.poseFrozen)
      sample.stages.push(state)
      if (mode === 'side' || mode === 'forward') {
        const path = join(scratch, `${label}-${gender}-${mode}.png`)
        // Avatar-only canvas: no camera pixels/body coordinates exported.
        await page.locator('canvas').screenshot({ path })
        sample[`${mode}PreviewSha`] = sha(readFileSync(path))
      }
    }
    sample.weightsPreserved = await page.evaluate(() => window.trunk.preservedWeights())
    assert(sample.weightsPreserved)
    sample.closed = await page.evaluate(() => {
      window.trunk.close()
      return window.trunk.snapshot().state.status === 'closed'
    })
    assert(sample.closed)
    sample.passed = true
  }
  report.boundary = await page.evaluate(() => ({
    cameraCalls: window.__cameraCalls,
    storageEntries: localStorage.length + sessionStorage.length,
  }))
  assert.equal(report.boundary.cameraCalls, 0)
  assert.equal(report.boundary.storageEntries, 0)
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
  await context.close()
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
} finally {
  report.external = external
  report.errors = errors
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  report.sourceAfter = snapshot()
  assert.deepEqual(report.sourceAfter, report.sourceBefore)
  writeFileSync(receipt, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: report.samples.filter((s) => s.passed).length,
      failed: report.samples.filter((s) => !s.passed).length,
      receipt,
    }),
  )
}
