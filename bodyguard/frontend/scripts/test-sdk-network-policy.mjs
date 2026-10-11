// Actual built policy + actual SDK; no routes/CSP headers used to fake enforcement.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-sdk-policy\.[A-Za-z0-9]+$/.test(scratch))
assert(existsSync(executable) && /^[a-z][a-z0-9-]+$/.test(label))
const output = join(scratch, `${label}.json`)
assert(!existsSync(output), 'Preserve earlier evidence')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const product = readFileSync(join(scratch, 'product/index.html'), 'utf8')
const fixture = readFileSync(join(scratch, 'probe/e2e/fixtures/sdkNetworkProbe.html'), 'utf8')
const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/i
assert.equal(product.match(meta)?.[1], fixture.match(meta)?.[1])
const decodedPolicy = product.match(meta)?.[1].replaceAll('&#39;', "'")
assert(decodedPolicy?.includes("connect-src 'self'"))
assert(!decodedPolicy?.includes("script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"))
assert(product.indexOf('Content-Security-Policy') < product.indexOf('<script'))
const assets = new Map()
for (const [directory, prefix] of [
  ['product', ''],
  ['probe', '/probe'],
]) {
  for (const name of readdirSync(join(scratch, directory), { recursive: true })) {
    if (!/\.(js|css|wasm|task)$/.test(name)) continue
    const bytes = readFileSync(join(scratch, directory, name))
    assets.set(`${prefix}/${name}`, bytes)
    if (directory === 'probe' && name.startsWith('assets/')) assets.set(`/${name}`, bytes)
  }
}
let trapRequests = 0,
  proxyAttempts = 0,
  externalRequests = 0,
  sdkProxyAttempts = 0
function observeProxy(destination) {
  proxyAttempts++
  const host = new URL(destination.startsWith('http') ? destination : `https://${destination}`)
    .hostname
  if (host === 'odml.pa.googleapis.com') sdkProxyAttempts++
}
const trap = createServer((_req, res) => {
  trapRequests++
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end('owned negative control')
})
const proxy = createServer((req, res) => {
  observeProxy(req.url)
  res.writeHead(403)
  res.end()
})
proxy.on('connect', (req, socket) => {
  observeProxy(req.url)
  socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
})
const requested = new Set(),
  pageErrors = [],
  results = []
let target, browser, failure
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost'),
    path = url.pathname
  requested.add(path)
  // Deliberately no response CSP: the built product meta must enforce the boundary.
  if (path === '/' || path === '/login') {
    res.setHeader('Content-Type', 'text/html')
    res.end(product)
  } else if (path === '/probe/' || path === '/control/') {
    res.setHeader('Content-Type', 'text/html')
    const html = path === '/control/' ? fixture.replace(meta, '') : fixture
    res.end(
      html
        .replaceAll('src="/assets/', 'src="/probe/assets/')
        .replaceAll('href="/assets/', 'href="/probe/assets/'),
    )
  } else if (path === '/network-worker.js' && url.searchParams.get('target') === target) {
    res.setHeader('Content-Type', 'application/javascript')
    res.end(
      `let count=0;addEventListener('securitypolicyviolation',()=>count++);(async()=>{let blocked=false;try{await fetch(${JSON.stringify(target)})}catch{blocked=true}setTimeout(()=>postMessage({workerBlocked:blocked,workerViolations:count}),50)})()`,
    )
  } else if (path === '/api/v1/me') {
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(401)
    res.end('{"detail":"Unauthorized"}')
  } else if (path === '/api/v1/auth/google/status') {
    res.setHeader('Content-Type', 'application/json')
    res.end('{"configured":false}')
  } else if (path === '/api/policy-probe') {
    res.setHeader('Content-Type', 'application/json')
    res.end('{"owned":true}')
  } else if (assets.has(path)) {
    res.setHeader(
      'Content-Type',
      path.endsWith('.js')
        ? 'application/javascript'
        : path.endsWith('.css')
          ? 'text/css'
          : path.endsWith('.wasm')
            ? 'application/wasm'
            : 'application/octet-stream',
    )
    res.end(assets.get(path))
  } else {
    res.writeHead(404)
    res.end()
  }
})
const listen = (s) =>
  new Promise((yes, no) => {
    s.once('error', no)
    s.listen(0, '127.0.0.1', yes)
  })
const stop = (s) =>
  new Promise((yes) => {
    if (!s.listening) return yes()
    s.closeAllConnections()
    s.close(yes)
  })
async function bounded(job) {
  let timer
  try {
    return await Promise.race([
      job,
      new Promise((_yes, no) => {
        timer = setTimeout(() => no(new Error('SDK policy probe exceeded 5000ms')), 5000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
try {
  await listen(trap)
  await listen(proxy)
  await listen(server)
  const host = `127.0.0.1:${server.address().port}`,
    trapHost = `127.0.0.1:${trap.address().port}`,
    origin = `http://${host}`
  target = `http://${trapHost}/owned-network-probe`
  browser = await chromium.launch({
    executablePath: executable,
    proxy: {
      server: `http://127.0.0.1:${proxy.address().port}`,
      bypass: `<-loopback>,${host},${trapHost}`,
    },
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'],
  })
  for (const mode of ['control', 'policy', 'main', 'worker', 'web']) {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const page = await context.newPage()
    const item = { mode, passed: false }
    page.on('pageerror', (e) => pageErrors.push(e.name))
    context.on('request', (req) => {
      if (
        !req.url().startsWith(origin) &&
        !req.url().startsWith(`http://${trapHost}/`) &&
        !req.url().startsWith('blob:')
      )
        externalRequests++
    })
    await context.addInitScript(() => {
      let cameras = 0,
        workers = 0,
        terminations = 0,
        violations = 0
      navigator.mediaDevices.getUserMedia = async () => {
        cameras++
        throw new Error('No camera in this test')
      }
      addEventListener('securitypolicyviolation', () => violations++)
      const NativeWorker = Worker
      globalThis.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args)
          workers++
        }
        terminate() {
          terminations++
          return super.terminate()
        }
      }
      window.policyOwnership = () => ({
        cameras,
        workers,
        terminations,
        violations,
        storageKeys: localStorage.length + sessionStorage.length,
      })
    })
    try {
      await page.goto(
        `${origin}/${mode === 'web' ? '' : mode === 'control' ? 'control/' : 'probe/'}`,
      )
      if (mode === 'web') {
        await page.getByRole('link', { name: '로그인', exact: true }).first().click()
        await page.getByLabel('이메일', { exact: true }).waitFor()
        item.sameOrigin = await page.evaluate(async () => (await fetch('/api/policy-probe')).ok)
        assert.equal(item.sameOrigin, true)
      } else {
        await page.waitForFunction(() => !!window.sdkPolicyProbe)
        if (mode === 'control' || mode === 'policy') {
          const before = trapRequests
          item.network = await page.evaluate((t) => window.sdkPolicyProbe.network(t), target)
          item.trapRequests = trapRequests - before
          assert.equal(item.trapRequests, mode === 'control' ? 2 : 0)
          assert.equal(item.network.mainBlocked, mode !== 'control')
          assert.equal(item.network.workerBlocked, mode !== 'control')
          if (mode === 'policy') assert(item.network.workerViolations > 0)
        } else {
          await page.evaluate((thread) => {
            window.probe = window.sdkPolicyProbe.mount(thread)
          }, mode)
          await bounded(page.evaluate(() => window.probe.begin()))
          await bounded(page.evaluate(() => window.probe.run()))
          item.result = await bounded(page.evaluate(() => window.probe.close()))
          assert.equal(item.result.state, 'closed')
          assert.equal(item.result.frames, 3)
          assert.equal(item.result.closes, 3)
          assert.equal(item.result.concurrentRejected, mode === 'worker')
        }
      }
      item.ownership = await page.evaluate(() => window.policyOwnership())
      assert.equal(item.ownership.cameras, 0)
      assert.equal(item.ownership.storageKeys, 0)
      assert.equal(item.ownership.workers, item.ownership.terminations)
      item.passed = true
    } catch (e) {
      item.failure = { name: e.name, message: e.message }
      try {
        await bounded(page.evaluate(() => window.probe?.close()))
      } catch {
        item.cleanupFailed = true
      }
      throw e
    } finally {
      results.push(item)
      await context.close()
    }
  }
  assert.equal(pageErrors.length, 0)
  assert.equal(externalRequests, 0)
  for (const model of ['pose_landmarker_lite', 'face_landmarker', 'gesture_recognizer'])
    assert(requested.has(`/models/${model}.task`))
  // Chromium process-level background networking is not a document/SDK request.
  // Refuse all of it, retain its count, and separately assert the installed SDK endpoint.
  assert.equal(sdkProxyAttempts, 0)
  assert(![...requested].some((path) => /\.glb$|avatar/.test(path)))
} catch (e) {
  failure = { name: e.name, message: e.message }
} finally {
  await browser?.close()
  await stop(server)
  await stop(trap)
  await stop(proxy)
  writeFileSync(
    output,
    JSON.stringify(
      {
        method:
          'built product CSP; no test response CSP or route interception; owned different-origin positive control; blank SDK body+face+hands; no camera/avatar',
        chrome: browser?.version(),
        product: sha(product),
        fixture: sha(fixture),
        results,
        trapRequests,
        externalRequests,
        proxyAttempts,
        sdkProxyAttempts,
        pageErrors,
        requested: [...requested],
        failure: failure ?? null,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(
  JSON.stringify({
    output,
    passed: results.filter((x) => x.passed).length,
    failure: failure ?? null,
  }),
)
if (failure) process.exitCode = 1
