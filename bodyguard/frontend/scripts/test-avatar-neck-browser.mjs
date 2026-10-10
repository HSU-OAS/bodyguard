// FR-A-02/03/08·NFR-07: new Blender neck candidate, actual two rigs, synthetic directions only.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const [scratch, label, modelDirectory] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-rig-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
assert(/^\/private\/tmp\/bodyguard-avatar-neck\.[A-Za-z0-9]+\/glb$/.test(modelDirectory ?? ''))
assert.equal(realpathSync(modelDirectory), modelDirectory)
const result = join(scratch, `browser-${label}.json`)
assert(!existsSync(result))
const sourceFiles = [
  'src/avatar/directionalRig.ts',
  'src/avatar/eightWeightSkin.ts',
  'e2e/fixtures/avatarRigProbe.ts',
  'scripts/test-avatar-neck-browser.mjs',
  '../assets/blender/integration-neck/author_neck.py',
  '../assets/blender/integration-neck/artist_snapshot_values.py',
  '../assets/blender/integration-neck/render_comparison.py',
  '../assets/blender/integration-neck/review_avatar.py',
  '../assets/blender/integration-neck/export_avatar_candidate.py',
  '../assets/blender/integration-neck/web_surface_topology.py',
  'pnpm-lock.yaml',
]
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const snapshot = () =>
  Object.fromEntries(sourceFiles.map((path) => [path, sha(readFileSync(join(root, path)))]))
const inputSourceSha256 = '2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff'
const candidateSourceSha256 = 'ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b'
const expectedAssets = {
  male: 'ca63bf417cf8a53bf8b9bf3c328450bf683509a020dc1d2c521a754f6444b0c1',
  female: '3aeaf32e7bd4084d2faf80975968a8e66515ef4c8c536af69ef990e2b18e808c',
}
const assets = Object.fromEntries(
  ['male', 'female'].map((gender) => {
    const bytes = readFileSync(join(modelDirectory, `bodyguard-${gender}-candidate.glb`))
    assert.equal(sha(bytes), expectedAssets[gender])
    return [gender, bytes]
  }),
)
const probe = readFileSync(join(scratch, 'probe/probe.js'))
const report = {
  label,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: snapshot(),
  inputSourceSha256,
  candidateSourceSha256,
  assetHashes: Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, sha(v)])),
  actualChrome: true,
  actualWebGL: true,
  actualCamera: false,
  syntheticDirections: true,
  releaseAvatar: false,
  samples: [],
}
const server = createServer((req, res) => {
  const path = req.url?.split('?')[0]
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 아바타 변형 검증</title><style>body{margin:0;background:white;font:16px system-ui;color:#173356}p{position:absolute;margin:20px}canvas{display:block;width:1440px;height:900px}</style><p>외형 후보 · 시험 움직임</p><canvas></canvas><script type="module">import{mountRigProbe}from"/probe.js";window.openRig=async gender=>{window.rig?.close();window.rig=await mountRigProbe(document.querySelector("canvas"),gender);return window.rig.snapshot()};</script></html>',
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
let browser
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
  let external = 0,
    camera = 0
  const errors = []
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
        throw new Error('Camera forbidden in rig fixture')
      }
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openRig === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false }
    report.samples.push(sample)
    sample.initial = await page.evaluate((gender) => window.openRig(gender), gender)
    assert(sample.initial.independent && sample.initial.sourceUnchanged)
    assert(sample.initial.eightWeightMeshes.every((count) => count > 0))
    assert(sample.initial.states.every((state) => state.tracked === 8))
    assert(
      sample.initial.framing.every((value) => value.inside),
      'Full-body framing including feet',
    )
    const beforePath = join(scratch, `${label}-${gender}-before.png`)
    await page.screenshot({ path: beforePath })
    sample.beforeSha = sha(readFileSync(beforePath))
    await page.evaluate(() => window.rig.start())
    await page.waitForFunction(() => window.rig.snapshot().sequence >= 60, undefined, {
      timeout: 10_000,
    })
    sample.settled = await page.evaluate(() => window.rig.settle())
    assert(
      sample.settled.framing.every((value) => value.inside),
      'Moving full-body framing including feet',
    )
    assert(sample.settled.sourceUnchanged && sample.settled.maxDirectionError < 0.002)
    assert(sample.settled.calls > 0 && sample.settled.triangles > 0)
    const afterPath = join(scratch, `${label}-${gender}-after.png`)
    await page.screenshot({ path: afterPath })
    sample.afterSha = sha(readFileSync(afterPath))
    assert.notEqual(sample.beforeSha, sample.afterSha)
    sample.closed = await page.evaluate(() => {
      window.rig.close()
      return window.rig.snapshot().closed
    })
    assert(sample.closed)
    sample.passed = true
  }
  camera = await page.evaluate(() => window.__cameraCalls)
  report.boundary = { external, camera, errors }
  assert.equal(external, 0)
  assert.equal(camera, 0)
  assert.equal(errors.length, 0)
  await context.close()
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  report.sourceAfter = snapshot()
  assert.deepEqual(report.sourceAfter, report.sourceBefore)
  writeFileSync(result, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: report.samples.filter((s) => s.passed).length,
      failed: report.samples.filter((s) => !s.passed).length,
      result,
    }),
  )
}
