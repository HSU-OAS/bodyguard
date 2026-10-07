// FR-A-01/02/03·FR-M-07/NFR-07/08: real Chrome/WebGL/GLB, synthetic resource ports and observations.
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
assert(/^\/private\/tmp\/bodyguard-owned-avatar-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const reportPath = join(scratch, `browser-${label}.json`)
assert(!existsSync(reportPath))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const files = [
  'src/avatar/ownedAvatarPair.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/directionalRig.ts',
  'src/avatar/eightWeightSkin.ts',
  'src/coaching/resources.ts',
  'e2e/fixtures/ownedAvatarPairProbe.ts',
  'e2e/fixtures/ownedAvatarPair.vite.ts',
  'scripts/test-owned-avatar-browser.mjs',
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
const probe = readFileSync(join(scratch, 'probe/probe.js'))
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: snapshot(),
  assetCommit,
  assetHashes: Object.fromEntries(
    Object.entries(assets).map(([name, bytes]) => [name, sha(bytes)]),
  ),
  actualChrome: true,
  actualWebGL: true,
  syntheticPorts: true,
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
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 아바타 자원 검증</title><style>body{margin:0;background:white;font:16px system-ui;color:#173356}p{position:absolute;margin:20px}canvas{display:block;width:1440px;height:900px}</style><p>미완성 A37 · 자원 검증 · 코칭 아님</p><canvas></canvas><script type="module">import{mountOwnedAvatarProbe}from"/probe.js";window.openOwnedAvatar=async gender=>{await window.avatar?.close();window.avatar=await mountOwnedAvatarProbe(document.querySelector("canvas"),gender);return window.avatar.snapshot()};</script></html>',
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
  external = 0,
  camera = 0
const errors = []
const reclaimed = (state) => {
  for (const source of state.sources) {
    assert.equal(source.geometry, source.geometryTotal)
    assert.equal(source.material, source.materialTotal)
    assert.equal(source.skeleton, source.skeletonTotal)
    if (source.mode !== 'invalid') assert(source.unchanged)
  }
  assert.equal(state.clonesReleased, state.cloneTotal)
  assert.equal(state.models, 0)
  assert.equal(state.attached, 0)
  assert.equal(state.rendererBaseline.geometries, 0)
  assert.deepEqual(state.memory, state.rendererBaseline)
}
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
        throw new Error('Camera forbidden in resource fixture')
      }
  })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openOwnedAvatar === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    const initial = await page.evaluate((value) => window.openOwnedAvatar(value), gender)
    assert.equal(initial.models, 2)
    assert.equal(initial.attached, 2)
    assert(initial.independent)
    assert(initial.framing.every(Boolean))
    assert(initial.calls > 0 && initial.triangles > 0)
    assert(initial.sources.every((s) => s.unchanged))
    sample.stages.push({ case: 'prepared', ...initial })
    const moved = await page.evaluate(() => window.avatar.move())
    assert.equal(moved.state.tracked, 8)
    assert(moved.userChanged && moved.referenceUnchanged)
    assert(moved.sources.every((s) => s.unchanged))
    assert(moved.framing.every(Boolean))
    sample.stages.push({ case: 'observed-move', ...moved })
    const preview = join(scratch, `${label}-${gender}.png`)
    await page.screenshot({ path: preview })
    sample.previewSha = sha(readFileSync(preview))
    const released = await page.evaluate(() => window.avatar.release())
    reclaimed(released)
    assert.equal(released.state.status, 'closed')
    sample.stages.push({ case: 'released', ...released })
    const invalid = await page.evaluate(() => window.avatar.request('invalid'))
    reclaimed(invalid)
    assert.deepEqual(invalid.notices.at(-1), {
      type: 'error',
      generation: 2,
      reason: 'asset-error',
    })
    sample.stages.push({ case: 'invalid-rig', ...invalid })
    const retried = await page.evaluate(() => window.avatar.request())
    assert.equal(retried.models, 2)
    assert.equal(retried.notices.at(-1).type, 'ready')
    assert(retried.framing.every(Boolean))
    sample.stages.push({ case: 'explicit-retry', ...retried })
    await page.evaluate(() => window.avatar.startLate())
    await page.waitForFunction(() => window.avatar.snapshot().lateReady)
    const replacement = await page.evaluate(() => window.avatar.request())
    const late = await page.evaluate(() => window.avatar.finishLate())
    assert.equal(late.models, 2)
    assert.deepEqual(late.notices, replacement.notices)
    const previous = late.sources.find((s) => s.mode === 'late')
    assert(previous)
    assert.equal(previous.geometry, previous.geometryTotal)
    assert.equal(previous.material, previous.materialTotal)
    assert.equal(previous.skeleton, previous.skeletonTotal)
    assert(late.sources.every((s) => s.mode === 'invalid' || s.unchanged))
    sample.stages.push({ case: 'cancelled-late-source', ...late })
    await page.evaluate(() => window.avatar.startLate(true))
    await page.waitForFunction(() => window.avatar.snapshot().lateReady)
    await page.evaluate(() => window.avatar.request())
    const poisoned = await page.evaluate(() => window.avatar.finishLate())
    reclaimed(poisoned)
    assert.deepEqual(poisoned.notices.at(-1), {
      type: 'error',
      generation: 6,
      reason: 'cleanup-error',
    })
    sample.stages.push({ case: 'late-cleanup-failure', ...poisoned })
    const blocked = await page.evaluate(() => window.avatar.request())
    reclaimed(blocked)
    assert.deepEqual(blocked.notices, poisoned.notices)
    sample.stages.push({ case: 'quarantined', ...blocked })
    const stopped = await page.evaluate(() => window.avatar.close())
    reclaimed(stopped)
    assert(stopped.closed)
    assert.equal(stopped.state.status, 'closed')
    sample.stages.push({ case: 'closed', ...stopped })
    sample.passed = true
  }
  camera = await page.evaluate(() => window.__cameraCalls)
  assert.equal(external, 0)
  assert.equal(camera, 0)
  assert.equal(errors.length, 0)
  await context.close()
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
  if (page && !page.isClosed())
    try {
      report.failureState = await page.evaluate(() => window.avatar?.snapshot())
    } catch {
      /* fixed technical state only */
    }
} finally {
  if (page && !page.isClosed())
    try {
      camera = await page.evaluate(() => window.__cameraCalls)
    } catch {
      /* preserve last count */
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
