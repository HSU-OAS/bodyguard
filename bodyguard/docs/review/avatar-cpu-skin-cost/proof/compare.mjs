// FR-A-03/04: paired exact CPU bounds of immutable synthetic assets, not real-time FPS.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const [frontend, scratch, label] = process.argv.slice(2)
assert(/^[a-z][a-z0-9-]*$/.test(label))
const { chromium } = await import(pathToFileURL(join(frontend, 'node_modules/@playwright/test/index.mjs')))
const bundles = { before: readFileSync(join(scratch, 'before-probe.js')), after: readFileSync(join(scratch, 'probe/probe.js')) }
const assets = Object.fromEntries(['male', 'female'].map(g => [g, execFileSync('git', ['show', `2be0ebebe731d4b2e44cd93f453ddbf76b6b581f:bodyguard/docs/review/avatar-final-refinement/continuous-20261014/models/bodyguard-${g}-candidate.glb`], { cwd: frontend, maxBuffer: 32 * 1024 * 1024 })]))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const report = { label, bundles: Object.fromEntries(Object.entries(bundles).map(([k,v]) => [k,sha(v)])), assetHashes: Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,sha(v)])), synthetic: true, actualCamera: false, samples: [], external: 0, errors: [] }
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html><meta charset="utf-8"><canvas id="before"></canvas><canvas id="after"></canvas><script type="module">import{mountRigProbe as before}from"/before.js";import{mountRigProbe as after}from"/after.js";window.openPairs=async(g)=>{window.rigs={before:await before(document.querySelector("#before"),g),after:await after(document.querySelector("#after"),g)};return Object.values(window.rigs).map(r=>r.settle())};</script></html>')
  } else if (req.url === '/before.js' || req.url === '/after.js') {
    res.setHeader('Content-Type', 'text/javascript');res.end(bundles[req.url.slice(1,-3)])
  } else if (req.url === '/male.glb' || req.url === '/female.glb') {
    res.setHeader('Content-Type', 'model/gltf-binary');res.end(assets[req.url.slice(1,-4)])
  } else res.writeHead(404).end()
})
let browser
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  report.browser = browser.version()
  for (const gender of ['male','female']) {
    const context = await browser.newContext({ serviceWorkers:'block' })
    await context.route('**/*', route => {
      if (!route.request().url().startsWith(`${origin}/`)) { report.external++; return route.abort() }
      return route.continue()
    })
    await context.addInitScript(() => {
      window.__cameraCalls = 0
      navigator.mediaDevices.getUserMedia = async () => { window.__cameraCalls++; throw new Error('Camera forbidden') }
    })
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push(error.name))
    await page.goto(origin)
    await page.waitForFunction(() => typeof window.openPairs === 'function')
    const initial = await page.evaluate(g => window.openPairs(g), gender)
    for (const s of initial) assert(s.sourceUnchanged && s.framing.every(f=>f.inside) && s.maxDirectionError < .002 && s.eightWeightMeshes.every(n=>n>0))
    assert.equal(initial[0].triangles, initial[1].triangles)
    const times = await page.evaluate(() => {
      const values = []
      // ABBA alternates order, preserves first samples, and yields no hidden warm-up.
      for (let round = 0; round < 5; round++) {
        for (const variant of ['before','after','after','before']) {
          const start = performance.now()
          const s = window.rigs[variant].snapshot()
          if (!s.sourceUnchanged || !s.framing.every(f=>f.inside)) throw new Error('Bounds invariant failed')
          values.push({ variant, round, ms: performance.now() - start })
        }
      }
      return values
    })
    report.samples.push({ gender, initial, times, camera: await page.evaluate(()=>window.__cameraCalls) })
    await page.evaluate(()=>Object.values(window.rigs).forEach(r=>r.close()))
    await context.close()
  }
  assert.equal(report.external + report.errors.length + report.samples.reduce((sum,s)=>sum+s.camera,0),0)
} catch(error) { report.failure={name:error.name,message:error.message};process.exitCode=1 }
finally {
  await browser?.close()
  await new Promise(resolve=>server.close(resolve))
  writeFileSync(join(scratch,`${label}.json`),JSON.stringify(report,null,2),{flag:'wx'})
  for(const s of report.samples) console.log(JSON.stringify({gender:s.gender, before:s.times.filter(t=>t.variant==='before').map(t=>t.ms),after:s.times.filter(t=>t.variant==='after').map(t=>t.ms)}))
  console.log(JSON.stringify({failure:report.failure??null,result:join(scratch,`${label}.json`)}))
}
