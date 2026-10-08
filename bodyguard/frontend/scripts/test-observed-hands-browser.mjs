// Local private GLB-only WebGL harness; never captures webcam/pose/face inputs.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url)),
  [proof, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-hand-proof\.[A-Za-z0-9]+$/.test(proof ?? ''))
assert.equal(realpathSync(proof), proof)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const reportPath = join(proof, `browser-${label}.json`)
assert(!existsSync(reportPath))
const sha = (b) => createHash('sha256').update(b).digest('hex')
const names = [
  'src/avatar/observedHandRig.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/ownedAvatarPair.ts',
  'src/avatar/headOrientationRig.ts',
  'src/pose/ownedPoseFrame.ts',
  'e2e/fixtures/observedHandsProbe.ts',
  'scripts/test-observed-hands-browser.mjs',
  'scripts/check-selection-production.mjs',
  'pnpm-lock.yaml',
]
const hashes = () => Object.fromEntries(names.map((n) => [n, sha(readFileSync(join(root, n)))]))
const authored = JSON.parse(readFileSync(join(proof, 'authored-read.json'), 'utf8'))
assert.equal(authored.exit, 0)
const data = JSON.parse(
  authored.stdout
    .split('\n')
    .find((l) => l.startsWith('BODYGUARD_AUTHORED_HANDS '))
    .slice('BODYGUARD_AUTHORED_HANDS '.length),
)
const lengths = Object.fromEntries(
  data.reports.map((r) => [r.gender, Object.fromEntries(r.bones.map((b) => [b.name, b.length]))]),
)
const assets = Object.fromEntries(
  ['male', 'female'].map((g) => {
    const b = readFileSync(join(proof, `${g}.glb`))
    assert(
      b.equals(
        execFileSync(
          'git',
          [
            'show',
            `25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:bodyguard/frontend/src/avatar/models/bodyguard-${g}-candidate-a37.glb`,
          ],
          { cwd: root, maxBuffer: 32 * 1024 * 1024 },
        ),
      ),
    )
    return [g, b]
  }),
)
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: hashes(),
  assets: Object.fromEntries(Object.entries(assets).map(([g, b]) => [g, sha(b)])),
  actualChrome: true,
  actualWebGL: true,
  actualSDK: false,
  actualCamera: false,
  releaseAvatar: false,
  synthetic: true,
  samples: [],
}
const server = createServer((req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; worker-src 'none'",
  )
  const p = req.url?.split('?')[0]
  if (p === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 손 연결</title><style>body{margin:0;background:white;color:#173356;font:16px system-ui}p{position:absolute;margin:20px}canvas{display:block;width:1440px;height:900px}</style><p>미완성 A37 · 합성 손 · 코칭 아님</p><canvas></canvas><script type="module">import{mountHandsProbe}from"/probe.js";window.openHands=async g=>{window.rig?.close();const lengths=await(await fetch("/lengths.json")).json();window.rig=await mountHandsProbe(document.querySelector("canvas"),g,lengths[g]);return window.rig.snapshot()};</script></html>',
    )
    return
  }
  if (p === '/probe.js') {
    res.setHeader('Content-Type', 'text/javascript')
    res.end(readFileSync(join(proof, 'probe/probe.js')))
    return
  }
  if (p === '/lengths.json') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(lengths))
    return
  }
  if (p === '/male.glb' || p === '/female.glb') {
    res.setHeader('Content-Type', 'model/gltf-binary')
    res.end(assets[p.slice(1, -4)])
    return
  }
  res.writeHead(404)
  res.end()
})
let browser,
  context,
  page,
  external = 0
const errors = []
try {
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const address = server.address()
  assert(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  report.browser = browser.version()
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  })
  await context.route('**/*', async (route) => {
    if (!route.request().url().startsWith(`${origin}/`)) {
      external++
      await route.abort()
    } else await route.continue()
  })
  await context.addInitScript(() => {
    window.__cameraCalls = 0
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async () => {
        window.__cameraCalls++
        throw new Error('Camera forbidden in synthetic hand probe')
      }
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openHands === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    const initial = await page.evaluate((g) => window.openHands(g), gender)
    assert.equal(initial.state.hands.tracked, 32)
    for (const [mode, count] of [
      ['bend', 32],
      ['turn', 32],
      ['tip-crop', 31],
      ['one', 16],
      ['none', 0],
      ['duplicate', 0],
      ['palm-crop', 0],
      ['body-multiple', 0],
      ['open', 32],
    ]) {
      const start = await page.evaluate((m) => window.rig.setMode(m).sequence, mode)
      await page.waitForFunction((s) => window.rig.snapshot().sequence >= s + 30, start, {
        timeout: 10000,
      })
      const s = await page.evaluate(() => window.rig.snapshot())
      assert.equal(s.state.hands.tracked, count)
      assert(
        s.sourceUnchanged &&
          s.referenceUnchanged &&
          s.shapeUnchanged &&
          s.independent &&
          s.eightWeights &&
          s.framing.every(Boolean),
      )
      assert(s.calls > 0 && s.triangles > 0)
      if (count) {
        assert(s.maxDirectionError < 0.002)
        assert(s.maxWristError < 0.002)
      } else assert(s.freeze)
      if (mode === 'bend') assert(s.handMoved && s.distalMoved)
      if (mode === 'bend' || mode === 'turn') {
        const path = join(proof, `${label}-${gender}-${mode}.png`)
        await page.screenshot({ path })
        s.preview = { name: path.split('/').at(-1), sha: sha(readFileSync(path)) }
      }
      sample.stages.push(s)
    }
    await page.evaluate(() => window.rig.setMode('expire'))
    await page.waitForFunction(() => window.rig.snapshot().state.hands.tracked === 0)
    const marked = await page.evaluate(() => window.rig.markFrozen().ticks)
    await page.waitForFunction((ticks) => window.rig.snapshot().ticks >= ticks + 4, marked)
    const expired = await page.evaluate(() => window.rig.snapshot())
    assert(expired.freeze)
    sample.stages.push(expired)
    await page.evaluate(() => window.rig.close())
    const closed = await page.evaluate(() => window.rig.snapshot())
    assert.equal(closed.state.hands.status, 'closed')
    sample.closed = closed.state
    sample.passed = true
  }
  report.camera = await page.evaluate(() => window.__cameraCalls)
  assert.equal(report.camera, 0)
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
} catch (e) {
  report.failure = { name: e.name, message: e.message }
  process.exitCode = 1
} finally {
  await context?.close()
  await browser?.close()
  await new Promise((r) => server.close(r))
  report.external = external
  report.errors = errors
  report.sourceAfter = hashes()
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
