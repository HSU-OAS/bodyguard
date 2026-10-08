// FR-A-01/03·FR-M-02/07: private immutable GLBs; synthetic-only canvas previews.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const [scratch, label, assetScratch] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-head-proof\.[A-Za-z0-9]+$/.test(scratch ?? ''))
assert.equal(realpathSync(scratch), scratch)
assert(/^\/private\/tmp\/bodyguard-native-recovery-proof\.[A-Za-z0-9]+$/.test(assetScratch ?? ''))
assert.equal(realpathSync(assetScratch), assetScratch)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const result = join(scratch, `browser-${label}.json`),
  output = join(scratch, `probe-${label}`)
assert(!existsSync(result) && !existsSync(output))
const sourceFiles = [
  'src/avatar/headOrientationRig.ts',
  'src/avatar/headOrientationRig.test.ts',
  'src/avatar/eightWeightSkin.ts',
  'e2e/fixtures/headOrientationProbe.ts',
  'scripts/test-head-orientation-browser.mjs',
  'pnpm-lock.yaml',
]
const sha = (b) => createHash('sha256').update(b).digest('hex')
const snapshot = () =>
  Object.fromEntries(sourceFiles.map((path) => [path, sha(readFileSync(join(root, path)))]))
const sourceCommit = '25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad'
const assets = Object.fromEntries(
  ['male', 'female'].map((gender) => {
    const path = `bodyguard/frontend/src/avatar/models/bodyguard-${gender}-candidate-a37.glb`
    const bytes = readFileSync(join(assetScratch, `${gender}.glb`))
    assert(
      bytes.equals(
        execFileSync('git', ['show', `${sourceCommit}:${path}`], {
          cwd: root,
          maxBuffer: 32 * 1024 * 1024,
        }),
      ),
    )
    return [gender, bytes]
  }),
)
const report = {
  label,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: snapshot(),
  assetCommit: sourceCommit,
  assetHashes: Object.fromEntries(Object.entries(assets).map(([k, b]) => [k, sha(b)])),
  actualChrome: false,
  actualWebGL: false,
  actualCamera: false,
  nativeInference: false,
  syntheticInput: true,
  releaseAvatar: false,
  samples: [],
}
let browser, server, activePage
try {
  await build({
    root,
    configFile: false,
    build: {
      outDir: output,
      emptyOutDir: false,
      lib: {
        entry: join(root, 'e2e/fixtures/headOrientationProbe.ts'),
        formats: ['es'],
        fileName: () => 'probe.js',
      },
    },
  })
  const probe = readFileSync(join(output, 'probe.js'))
  report.probeHash = sha(probe)
  const entry =
    'import{mountHeadProbe}from"/probe.js";window.openHead=async gender=>{window.headProbe?.close();window.headProbe=await mountHeadProbe(document.querySelector("canvas"),gender);return window.headProbe.snapshot()};'
  server = createServer((req, res) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'",
    )
    const path = req.url?.split('?')[0]
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html')
      res.end(
        '<!doctype html><html lang="ko"><meta charset="utf-8"><title>미완성 A37 · 합성 머리 방향 · 코칭 아님</title><link rel="stylesheet" href="/style.css"><canvas></canvas><script type="module" src="/entry.js"></script></html>',
      )
      return
    }
    if (path === '/style.css') {
      res.setHeader('Content-Type', 'text/css')
      res.end('body{margin:0;background:white}canvas{display:block;width:1440px;height:900px}')
      return
    }
    if (path === '/entry.js' || path === '/probe.js') {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(path === '/entry.js' ? entry : probe)
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
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  report.actualChrome = true
  report.browser = browser.version()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  })
  let external = 0
  await context.route('**/*', async (route) => {
    if (!route.request().url().startsWith(`${origin}/`)) {
      external++
      await route.abort()
    } else await route.continue()
  })
  await context.addInitScript(() => {
    window.__cameraCalls = 0
    navigator.mediaDevices.getUserMedia = async () => {
      window.__cameraCalls++
      throw new Error('Camera forbidden')
    }
  })
  const page = await context.newPage(),
    errors = []
  activePage = page
  report.pageErrors = errors
  page.on('pageerror', (e) => errors.push(e.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openHead === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false }
    report.samples.push(sample)
    sample.initial = await page.evaluate((gender) => window.openHead(gender), gender)
    assert(sample.initial.calls > 0 && sample.initial.triangles > 0)
    report.actualWebGL = true
    assert(
      sample.initial.sourceUnchanged &&
        sample.initial.independent &&
        sample.initial.weightsUnchanged &&
        sample.initial.otherBonesUnchanged,
    )
    assert(sample.initial.framing.every(Boolean))
    assert(sample.initial.states.every((s) => s.tracked === 1))
    const before = join(scratch, `${label}-${gender}-before.png`)
    await page.locator('canvas').screenshot({ path: before })
    sample.beforeSha = sha(readFileSync(before))
    await page.evaluate(() => window.headProbe.start())
    await page.waitForFunction(() => window.headProbe.ready(), undefined, { timeout: 15_000 })
    sample.moving = await page.evaluate(() => window.headProbe.snapshot())
    assert(
      sample.moving.sourceUnchanged &&
        sample.moving.weightsUnchanged &&
        sample.moving.otherBonesUnchanged &&
        sample.moving.independent,
    )
    assert(
      sample.moving.framing.every(Boolean) &&
        sample.moving.calls > 0 &&
        sample.moving.triangles > 0,
    )
    const after = join(scratch, `${label}-${gender}-after.png`)
    await page.locator('canvas').screenshot({ path: after })
    sample.afterSha = sha(readFileSync(after))
    assert.notEqual(sample.beforeSha, sample.afterSha)
    sample.revoked = await page.evaluate(() => window.headProbe.revoke())
    assert(sample.revoked.frozen && sample.revoked.states.every((s) => s.tracked === 0))
    sample.closed = await page.evaluate(() => window.headProbe.close())
    assert(sample.closed.every((s) => s.status === 'closed'))
    sample.passed = true
  }
  report.boundary = { external, camera: await page.evaluate(() => window.__cameraCalls), errors }
  assert.equal(external, 0)
  assert.equal(report.boundary.camera, 0)
  assert.equal(errors.length, 0)
  await context.close()
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  if (activePage) {
    try {
      report.failedSnapshot = await activePage.evaluate(() => window.headProbe?.snapshot())
    } catch {
      report.failedSnapshotUnavailable = true
    }
  }
  process.exitCode = 1
} finally {
  await browser?.close()
  if (server) await new Promise((resolve) => server.close(resolve))
  report.sourceAfter = snapshot()
  assert.deepEqual(report.sourceBefore, report.sourceAfter)
  writeFileSync(result, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: report.samples.filter((s) => s.passed).length,
      failed: report.samples.filter((s) => !s.passed).length,
      result,
    }),
  )
}
