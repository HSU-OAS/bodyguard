// FR-A-01/03·FR-M-07: actual private WebGL; synthetic observations/errors, no camera/person.
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
assert(/^\/private\/tmp\/bodyguard-surface-feedback-proof\.[A-Za-z0-9]+$/.test(proof ?? ''))
assert.equal(realpathSync(proof), proof)
assert(/^[a-z][a-z0-9-]*$/.test(label ?? ''))
const output = join(proof, `browser-${label}.json`)
assert(!existsSync(output))
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  names = [
    'src/avatar/surfaceFeedback.ts',
    'src/avatar/ownedAvatarPair.ts',
    'src/avatar/observedPoseRig.ts',
    'src/avatar/eightWeightSkin.ts',
    'e2e/fixtures/surfaceFeedbackProbe.ts',
    'e2e/fixtures/surfaceFeedback.vite.ts',
    'scripts/test-surface-feedback-browser.mjs',
    'pnpm-lock.yaml',
  ]
const sources = () =>
  Object.fromEntries(names.map((name) => [name, sha(readFileSync(join(root, name)))]))
const assets = Object.fromEntries(
  ['male', 'female'].map((gender) => {
    const bytes = readFileSync(join(proof, `${gender}.glb`))
    assert(
      bytes.equals(
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
    return [gender, bytes]
  }),
)
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceBefore: sources(),
  assets: Object.fromEntries(Object.entries(assets).map(([gender, bytes]) => [gender, sha(bytes)])),
  actualChrome: true,
  actualWebGL: true,
  syntheticObservation: true,
  syntheticError: true,
  actualSDK: false,
  actualCamera: false,
  actualParticipant: false,
  releaseAvatar: false,
  qualifiedMotion: false,
  samples: [],
}
const server = createServer((req, res) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; worker-src 'none'",
  )
  const path = req.url?.split('?')[0]
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="ko"><meta charset="utf-8"><title>비공개 오류 표면 검증</title><style>body{margin:0;color:#173356;background:white;font:14px system-ui}p{position:absolute;margin:20px}canvas{display:block;width:1440px;height:900px}span{position:absolute;top:65px;left:330px}.right{left:970px}</style><p>A37 미완성 · 합성 오류 · 코칭/확정 디자인 아님</p><span>사용자 표시 시험</span><span class="right">시범 원형 보존</span><canvas></canvas><script type="module">import{mountSurfaceFeedbackProbe}from"/probe.js";window.openFeedback=async gender=>{window.rig?.close();window.rig?.disposeRenderer();window.rig=await mountSurfaceFeedbackProbe(document.querySelector("canvas"),gender);return window.rig.snapshot()};</script></html>',
    )
    return
  }
  if (path === '/probe.js') {
    res.setHeader('Content-Type', 'text/javascript')
    res.end(readFileSync(join(proof, `probe-${label}`, 'probe.js')))
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
let browser,
  context,
  page,
  external = 0
const errors = [],
  shaderErrors = []
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
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
        throw new Error('Camera forbidden in surface fixture')
      }
  })
  page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  page.on('console', (message) => {
    if (message.type() === 'error' && /shader|WebGLProgram/i.test(message.text()))
      shaderErrors.push(message.text())
  })
  await page.goto(origin)
  await page.waitForFunction(() => typeof window.openFeedback === 'function')
  for (const gender of ['male', 'female']) {
    const sample = { gender, passed: false, stages: [] }
    report.samples.push(sample)
    const check = (name, state) => {
      assert(state.sourceUnchanged && state.referenceUnchanged)
      assert(state.framing.every(Boolean))
      assert.equal(state.redPixels.error, 0)
      if (!state.closed) assert(state.calls > 0 && state.triangles > 0)
      sample.stages.push({ name, ...state })
      return state
    }
    const baseline = check('prepare', await page.evaluate((g) => window.openFeedback(g), gender))
    let state = check('observed-deviation', await page.evaluate(() => window.rig.feed('single')))
    assert(state.lastAccepted)
    assert.deepEqual(state.state.feedback.activeRegionIds, ['arm-left'])
    assert(state.redPixels.left > baseline.redPixels.left + 200)
    assert.equal(state.redPixels.right, baseline.redPixels.right)
    const preview = join(proof, `${label}-${gender}-deviation.png`)
    await page.screenshot({ path: preview })
    sample.preview = { name: preview.split('/').at(-1), sha: sha(readFileSync(preview)) }
    state = check('moving-highlight', await page.evaluate(() => window.rig.feed('moved')))
    assert(state.userMoved)
    assert(state.redPixels.left > baseline.redPixels.left + 200)
    for (const mode of ['crop', 'multiple', 'none']) {
      state = check(mode, await page.evaluate((value) => window.rig.feed(value), mode))
      assert(!state.lastAccepted)
      assert.deepEqual(state.state.feedback.activeRegionIds, [])
      assert.equal(state.redPixels.left, baseline.redPixels.left)
    }
    state = check('recover', await page.evaluate(() => window.rig.feed('moved')))
    assert(state.lastAccepted)
    assert.deepEqual(state.state.feedback.activeRegionIds, ['arm-left'])
    state = check('old-generation', await page.evaluate(() => window.rig.old()))
    assert(!state.lastAccepted)
    assert.deepEqual(state.state.feedback.activeRegionIds, ['arm-left'])
    state = check('expire', await page.evaluate(() => window.rig.expire()))
    assert.deepEqual(state.state.feedback.activeRegionIds, [])
    assert.equal(state.redPixels.left, baseline.redPixels.left)
    state = check('new-observation', await page.evaluate(() => window.rig.recover()))
    assert(state.lastAccepted)
    state = check('attention', await page.evaluate(() => window.rig.feed('single', 'attention')))
    assert(state.lastAccepted)
    assert.deepEqual(state.state.feedback.activeRegionIds, ['arm-left'])
    state = check(
      'other-region',
      await page.evaluate(() => window.rig.feed('single', 'deviation', 'leg-left')),
    )
    assert(state.lastAccepted)
    assert.deepEqual(state.state.feedback.activeRegionIds, ['leg-left'])
    state = check('explicit-no-error', await page.evaluate(() => window.rig.feed('neutral')))
    assert(state.lastAccepted)
    assert.deepEqual(state.state.feedback.activeRegionIds, [])
    assert.equal(state.redPixels.left, baseline.redPixels.left)
    state = check('abort-dispose', await page.evaluate(() => window.rig.close()))
    assert.equal(state.state.feedback.status, 'closed')
    assert.deepEqual(state.memory, state.baseline)
    sample.passed = true
  }
  report.camera = await page.evaluate(() => window.__cameraCalls)
  report.storage = await page.evaluate(() => localStorage.length + sessionStorage.length)
  assert.equal(report.camera, 0)
  assert.equal(report.storage, 0)
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
  assert.equal(shaderErrors.length, 0)
} catch (error) {
  report.failure = { name: error.name, message: error.message }
  process.exitCode = 1
} finally {
  await context?.close()
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  report.external = external
  report.errors = errors
  report.shaderErrors = shaderErrors
  report.sourceAfter = sources()
  assert.deepEqual(report.sourceBefore, report.sourceAfter)
  writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(
    JSON.stringify({
      passed: report.samples.filter((sample) => sample.passed).length,
      failed: report.samples.filter((sample) => !sample.passed).length,
      output,
    }),
  )
}
