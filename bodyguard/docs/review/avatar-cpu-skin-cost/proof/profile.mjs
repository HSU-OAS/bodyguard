import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const [frontend, evidence, label] = process.argv.slice(2)
assert(/^[a-z][a-z0-9-]*$/.test(label))
const { chromium } = await import(pathToFileURL(join(frontend, 'node_modules/@playwright/test/index.mjs')))
const bundle = readFileSync(join(evidence, 'probe/probe.js'))
const assets = Object.fromEntries(['male', 'female'].map(gender => [gender, execFileSync('git', ['show', `2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${gender}-candidate.glb`], { cwd: frontend, maxBuffer: 32 * 1024 * 1024 })]))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const report = { label, sourceSha: sha(readFileSync(join(frontend, 'src/avatar/eightWeightSkin.ts'))), bundleSha: sha(bundle), assets: Object.fromEntries(Object.entries(assets).map(([key, bytes]) => [key, sha(bytes)])), actualPeople: false, samples: [] }
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><meta charset="utf-8"><canvas></canvas><script type="module">import{mountRigProbe}from"/probe.js";window.openRig=async g=>{window.rig=await mountRigProbe(document.querySelector("canvas"),g);return window.rig.snapshot()};</script></html>')
  } else if (req.url === '/probe.js') {
    res.setHeader('Content-Type', 'text/javascript')
    res.end(bundle)
  } else if (req.url === '/male.glb' || req.url === '/female.glb') {
    res.setHeader('Content-Type', 'model/gltf-binary')
    res.end(assets[req.url.slice(1, -4)])
  } else res.writeHead(404).end()
})
let browser
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  report.browser = browser.version()
  for (const gender of ['male', 'female']) {
    const sample = { gender, external: 0, camera: 0, errors: [] }
    report.samples.push(sample)
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
    await context.route('**/*', route => {
      if (!route.request().url().startsWith(`${origin}/`)) { sample.external++; return route.abort() }
      return route.continue()
    })
    await context.addInitScript(() => {
      window.__cameraCalls = 0
      navigator.mediaDevices.getUserMedia = async () => { window.__cameraCalls++; throw new Error('Camera forbidden') }
    })
    const page = await context.newPage()
    page.on('pageerror', error => sample.errors.push(error.name))
    const cdp = await context.newCDPSession(page)
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 })
    await page.goto(origin)
    await page.waitForFunction(() => typeof window.openRig === 'function')
    await cdp.send('Profiler.start')
    const start = performance.now()
    sample.initial = await page.evaluate(g => window.openRig(g), gender)
    sample.openWallMs = performance.now() - start
    assert(sample.initial.framing.every(value => value.inside))
    await page.evaluate(() => window.rig.start())
    await page.waitForFunction(() => window.rig.performance().sequence >= 60, undefined, { timeout: 10_000 })
    sample.performance = await page.evaluate(() => window.rig.performance())
    sample.settled = await page.evaluate(() => window.rig.settle())
    assert(sample.settled.sourceUnchanged && sample.settled.maxDirectionError < 0.002)
    sample.exactBoundsMs = await page.evaluate(() => {
      const durations = []
      for (let i = 0; i < 10; i++) {
        const at = performance.now()
        const snapshot = window.rig.snapshot()
        if (!snapshot.sourceUnchanged || !snapshot.framing.every(value => value.inside)) throw new Error('Exact bounds regression')
        durations.push(performance.now() - at)
      }
      return durations
    })
    const { profile } = await cdp.send('Profiler.stop')
    writeFileSync(join(evidence, `${label}-${gender}.cpuprofile.gz`), gzipSync(JSON.stringify(profile)), { flag: 'wx' })
    const nodes = new Map(profile.nodes.map(node => [node.id, node]))
    const parents = new Map(profile.nodes.flatMap(node => (node.children ?? []).map(id => [id, node.id])))
    const self = new Map(), inclusive = new Map()
    for (let i = 0; i < profile.samples.length; i++) {
      let id = profile.samples[i]
      const ms = profile.timeDeltas[i] / 1000
      self.set(id, (self.get(id) ?? 0) + ms)
      while (id !== undefined) { inclusive.set(id, (inclusive.get(id) ?? 0) + ms); id = parents.get(id) }
    }
    const top = map => [...map].sort((a,b) => b[1] - a[1]).slice(0, 35).map(([id, ms]) => ({ function: nodes.get(id).callFrame.functionName, line: nodes.get(id).callFrame.lineNumber + 1, ms }))
    sample.cpu = { self: top(self), inclusive: top(inclusive) }
    sample.camera = await page.evaluate(() => window.__cameraCalls)
    await page.evaluate(() => window.rig.close())
    assert.equal(sample.external + sample.camera + sample.errors.length, 0)
    await context.close()
  }
} catch(error) { report.failure = { name: error.name, message: error.message }; process.exitCode = 1 }
finally {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
  writeFileSync(join(evidence, `${label}.json`), JSON.stringify(report, null, 2), { flag: 'wx' })
  console.log(JSON.stringify(report))
}
