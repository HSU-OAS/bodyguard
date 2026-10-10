// FR-A-01/03·FR-M-07/NFR-07/08: localhost real WebGL, immutable GLB and synthetic provider results.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-observed-rig-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const reportPath = join(scratch, `browser-${label}.json`)
assert(!existsSync(reportPath))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const files = [
  'src/avatar/observedPoseRig.ts',
  'src/avatar/directionalRig.ts',
  'src/avatar/eightWeightSkin.ts',
  'e2e/fixtures/observedPoseRigProbe.ts',
  'scripts/test-observed-rig-browser.mjs',
  'pnpm-lock.yaml',
]
const snapshot = () =>
  Object.fromEntries(files.map((path) => [path, sha(readFileSync(join(root, path)))]))
const commit = '25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad'
const assets = Object.fromEntries(
  ['male', 'female'].map((gender) => {
    const path = `bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`
    const bytes = readFileSync(join(scratch, path))
    assert(
      bytes.equals(
        execFileSync('git', ['show', `${commit}:${path}`], {
          cwd: root,
          maxBuffer: 32 * 1024 * 1024,
        }),
      ),
    )
    return [gender, bytes]
  }),
)
const probe = readFileSync(join(scratch, 'probe/probe.js'))
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: snapshot(),
  assetCommit: commit,
  assetHashes: Object.fromEntries(
    Object.entries(assets).map(([name, bytes]) => [name, sha(bytes)]),
  ),
  actualChrome: true,
  actualWebGL: true,
  syntheticObservations: true,
  actualSDK: false,
  actualCamera: false,
  releaseAvatar: false,
  samples: [],
}
const server = createServer((req, res) => {
  const path = req.url?.split('?')[0]
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 관찰 연결</title><style>body{margin:0;background:white;font:16px system-ui;color:#173356}p{position:absolute;margin:20px}canvas{display:block;width:1440px;height:900px}</style><p>미완성 A37 · 합성 관찰 · 코칭 아님</p><canvas></canvas><script type="module">import{mountObservedRigProbe}from"/probe.js";window.openObservedRig=async gender=>{window.rig?.close();window.rig=await mountObservedRigProbe(document.querySelector("canvas"),gender);return window.rig.snapshot()};</script></html>',
    )
    return
  }
  if (path === '/probe.js') {
    res.setHeader('Content-Type', 'text/javascript')
    res.end(probe)
    return
  }
  if (path === '/male.glb' || path === '/female.glb') {
    res.setHeader('Content-Type', 'model/gltf-binary')
    res.end(assets[path.slice(1, -4)])
    return
  }
  res.writeHead(404)
  res.end()
})
let browser, page
let external = 0,
  camera = 0
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
        throw new Error('Camera forbidden in observation fixture')
      }
  })
  page = await context.newPage()
  page.on('pageerror', (error) =>
    errors.push(
      error.message === 'Private pose observation rejected' ? 'private-frame-rejected' : error.name,
    ),
  )
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openObservedRig === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    sample.initial = await page.evaluate((value) => window.openObservedRig(value), gender)
    assert(
      sample.initial.independent &&
        sample.initial.sourceUnchanged &&
        sample.initial.referenceUnchanged,
    )
    assert.equal(sample.initial.state.tracked, 8)
    assert(sample.initial.framing.every((value) => value.inside))
    await page.evaluate(() => window.rig.setMode('single'))
    await page.waitForFunction(() => window.rig.peek().sequence >= 60, undefined, {
      timeout: 10_000,
    })
    const single = await page.evaluate(() => window.rig.snapshot())
    assert(single.userChanged && single.referenceUnchanged && single.sourceUnchanged)
    assert(single.userArmMoved && single.maxDirectionError < 0.002)
    assert.equal(single.state.tracked, 8)
    assert(single.calls > 0 && single.triangles > 0)
    sample.stages.push(single)
    const imagePath = join(scratch, `${label}-${gender}-single.png`)
    await page.screenshot({ path: imagePath })
    sample.previewSha = sha(readFileSync(imagePath))
    for (const mode of ['crop', 'multiple', 'mismatch', 'none', 'recover']) {
      const start = await page.evaluate((mode) => window.rig.setMode(mode).sequence, mode)
      await page.waitForFunction(
        ({ sequence, count }) => window.rig.peek().sequence >= sequence + count,
        { sequence: start, count: mode === 'recover' ? 60 : 4 },
        { timeout: 10_000 },
      )
      const state = await page.evaluate(() => window.rig.snapshot())
      assert(state.sourceUnchanged && state.referenceUnchanged)
      assert(state.framing.every((value) => value.inside))
      assert.equal(state.state.tracked, mode === 'crop' ? 4 : mode === 'recover' ? 8 : 0)
      if (mode === 'crop') assert(state.missingLegsFrozen)
      if (['multiple', 'mismatch', 'none'].includes(mode)) assert(state.poseFrozen)
      if (mode === 'recover') assert(state.userChanged)
      if (mode === 'recover') assert(state.userArmMoved && state.maxDirectionError < 0.002)
      sample.stages.push(state)
    }
    await page.evaluate(() => window.rig.setMode('expire'))
    await page.waitForFunction(() => window.rig.peek().state.tracked === 0)
    const expired = await page.evaluate(() => window.rig.snapshot())
    assert.equal(expired.state.status, 'untracked')
    assert(expired.sourceUnchanged && expired.referenceUnchanged)
    sample.stages.push(expired)
    sample.closed = await page.evaluate(() => {
      window.rig.close()
      return window.rig.snapshot().state.status === 'closed'
    })
    assert(sample.closed)
    sample.passed = true
  }
  camera = await page.evaluate(() => window.__cameraCalls)
  report.boundary = { external, camera, errors }
  assert.equal(external, 0)
  assert.equal(report.boundary.camera, 0)
  assert.equal(errors.length, 0)
  await context.close()
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  if (page && !page.isClosed()) {
    try {
      report.failureState = await page.evaluate(() => window.rig?.peek())
    } catch {
      /* Fixed technical state only. */
    }
  }
  process.exitCode = 1
} finally {
  if (page && !page.isClosed()) {
    try {
      camera = await page.evaluate(() => window.__cameraCalls)
    } catch {
      /* Preserve last count. */
    }
  }
  report.boundary = { external, camera, errors }
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  report.sourceAfter = snapshot()
  assert.deepEqual(report.sourceAfter, report.sourceBefore)
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: report.samples.filter((s) => s.passed).length,
      failed: report.samples.filter((s) => !s.passed).length,
      reportPath,
    }),
  )
}
