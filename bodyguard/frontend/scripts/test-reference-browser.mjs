// FR-S-03/04, FR-A-01/02: private WebGL, no webcam/SDK/participants/approved motion.
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
assert(/^\/private\/tmp\/bodyguard-reference-proof\.[A-Za-z0-9]+$/.test(proof ?? ''))
assert.equal(realpathSync(proof), proof)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const output = join(proof, `browser-${label}.json`)
assert(!existsSync(output))
const sha = (b) => createHash('sha256').update(b).digest('hex')
const source = () =>
  Object.fromEntries(
    [
      'src/avatar/referencePlayback.ts',
      'src/avatar/ownedAvatarPair.ts',
      'src/avatar/eightWeightSkin.ts',
      'src/avatar/observedPoseRig.ts',
      'e2e/fixtures/referenceProbe.ts',
      'e2e/fixtures/reference-probe.config.ts',
      'scripts/test-reference-browser.mjs',
      'scripts/create-reference-fixture.py',
      'pnpm-lock.yaml',
    ].map((name) => [name, sha(readFileSync(join(root, name)))]),
  )
const fixture = JSON.parse(readFileSync(join(proof, 'authored-fixture.json'), 'utf8'))
assert.equal(fixture.fixture_not_release, true)
const assets = Object.fromEntries(
  ['male', 'female'].map((gender) => {
    const data = readFileSync(join(proof, `${gender}.glb`))
    assert(
      data.equals(
        execFileSync(
          'git',
          [
            'show',
            '25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad:bodyguard/frontend/src/avatar/models/bodyguard-' +
              gender +
              '-candidate-a37.glb',
          ],
          { cwd: root, maxBuffer: 32 * 1024 * 1024 },
        ),
      ),
    )
    return [gender, data]
  }),
)
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: source(),
  assets: Object.fromEntries(Object.entries(assets).map(([g, b]) => [g, sha(b)])),
  authoredFixtureSHA: sha(readFileSync(join(proof, 'authored-fixture.json'))),
  actualChrome: true,
  actualWebGL: true,
  actualBlender: fixture.blender,
  synthetic: true,
  actualCamera: false,
  actualSDK: false,
  releaseAvatar: false,
  approvedMotion: false,
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
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 단계 재생</title><style>body{margin:0;color:#173356;background:#f7faff;font:14px system-ui}p{position:absolute;margin:20px}canvas{display:block;width:1440px;height:900px}span{position:absolute;top:65px;left:370px}.right{left:1030px}</style><p>A37 미완성 · 제작 테스트 · 코칭 아님</p><span>시범 테스트</span><span class="right">관찰 리그 대기</span><canvas></canvas><script type="module">import{mountReferenceProbe}from"/probe.js";window.openReference=async gender=>{window.rig?.close();const f=await(await fetch("/fixture.json")).json();window.rig=await mountReferenceProbe(document.querySelector("canvas"),gender,f.reports.find(r=>r.gender===gender));return window.rig.snapshot()};</script></html>',
    )
    return
  }
  if (p === '/fixture.json') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(fixture))
    return
  }
  if (p === '/probe.js') {
    res.setHeader('Content-Type', 'text/javascript')
    res.end(readFileSync(join(proof, `probe-${label}`, 'probe.js')))
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
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
        throw new Error('Camera forbidden in reference fixture')
      }
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openReference === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    const check = (s) => {
      assert(
        s.sourceUnchanged &&
          s.userUnchanged &&
          s.shapeUnchanged &&
          s.independent &&
          s.eightWeights &&
          s.framing.every(Boolean),
      )
      assert(s.calls > 0 && s.triangles > 0)
      sample.stages.push(s)
    }
    check(await page.evaluate((g) => window.openReference(g), gender))
    let s = await page.evaluate(() => window.rig.setPhase('seeking-target'))
    assert.equal(s.freeze, true)
    check(s)
    s = await page.evaluate(() => window.rig.advance(300))
    assert(s.referenceMoved)
    check(s)
    const time = s.state.reference.clipMs
    check(await page.evaluate(() => window.rig.pause()))
    s = await page.evaluate(() => window.rig.wait(5000))
    assert(s.freeze)
    assert.equal(s.state.reference.status, 'paused')
    assert.equal(s.state.reference.clipMs, time)
    check(s)
    s = await page.evaluate(() => window.rig.resume())
    assert.equal(s.state.reference.clipMs, time)
    check(s)
    s = await page.evaluate(() => window.rig.advance(1000))
    assert.equal(s.state.reference.clipMs, 1000)
    assert(s.maxTargetError < 0.0001)
    check(s)
    s = await page.evaluate(() => window.rig.setPhase('holding'))
    assert(s.freeze)
    check(s)
    s = await page.evaluate(() => window.rig.advance(1200))
    assert(s.maxTargetError < 0.0001)
    check(s)
    const preview = join(proof, `${label}-${gender}-hold.png`)
    await page.screenshot({ path: preview })
    sample.preview = { name: preview.split('/').at(-1), sha: sha(readFileSync(preview)) }
    s = await page.evaluate(() => window.rig.expire())
    assert(s.freeze)
    assert.equal(s.state.reference.status, 'stale')
    check(s)
    s = await page.evaluate(() => window.rig.resume())
    assert(s.freeze)
    check(s)
    s = await page.evaluate(() => window.rig.setPhase('waiting-return'))
    assert(s.freeze)
    check(s)
    s = await page.evaluate(() => window.rig.advance(1200))
    assert(s.maxTargetError < 0.0001)
    check(s)
    s = await page.evaluate(() => window.rig.close())
    assert.equal(s.state.reference.status, 'closed')
    sample.closed = s.state
    sample.passed = true
  }
  report.camera = await page.evaluate(() => window.__cameraCalls)
  assert.equal(report.camera, 0)
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
} finally {
  await context?.close()
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  report.external = external
  report.errors = errors
  report.sourceAfter = source()
  assert.deepEqual(report.sourceBefore, report.sourceAfter)
  writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: report.samples.filter((s) => s.passed).length,
      failed: report.samples.filter((s) => !s.passed).length,
      output,
    }),
  )
}
