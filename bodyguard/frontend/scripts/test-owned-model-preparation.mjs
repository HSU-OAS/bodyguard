// FR-M-02/07·NFR-08: actual current SDK with controlled local download faults, no external forwarding.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const [scratch, executable, label, profile = 'all'] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-owned-models\.[A-Za-z0-9]+$/.test(scratch))
assert(existsSync(executable) && /^[a-z][a-z0-9-]+$/.test(label))
assert(['all', 'latency-only', 'current-clock', 'fixed-clock', 'body-gate'].includes(profile))
const output = join(scratch, `${label}.json`)
assert(!existsSync(output), 'Keep earlier evidence')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const sourceFiles = [
  'src/pose/ownedModelAssets.ts',
  'src/pose/workerInference.ts',
  'src/pose/workerInferenceRuntime.ts',
  'src/pose/workerNativeEngine.ts',
  'scripts/sdk-network-policy.ts',
  'e2e/fixtures/ownedModelProbe.ts',
  'scripts/test-owned-model-preparation.mjs',
]
const source = Object.fromEntries(sourceFiles.map((file) => [file, sha(readFileSync(file))]))
const built = new Map()
for (const name of readdirSync(join(scratch, 'probe'), { recursive: true }))
  if (/\.(js|html)$/.test(name)) built.set(`/${name}`, readFileSync(join(scratch, 'probe', name)))
const html = built.get('/e2e/fixtures/ownedModelProbe.html')
const product = readFileSync(join(scratch, 'product/index.html'))
const policy = (bytes) =>
  bytes.toString().match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1]
assert.equal(policy(html), policy(product))
assert(policy(html).includes('connect-src &#39;self&#39;'))
const assets = new Map()
for (const dir of ['models', 'mediapipe/wasm'])
  for (const name of readdirSync(join('public', dir), { recursive: true }))
    if (/\.(task|js|wasm)$/.test(name))
      assets.set(`/${dir}/${name}`, readFileSync(join('public', dir, name)))
let mode = 'idle',
  held = false,
  forbidden = 0,
  external = 0,
  browser,
  failure
const requests = [],
  results = [],
  errors = [],
  timers = new Set()
const proxy = createServer((_req, res) => {
  forbidden++
  res.writeHead(403)
  res.end()
})
proxy.on('connect', (_req, socket) => {
  forbidden++
  // Browser background proxy connections may reset after the deliberate refusal.
  socket.on('error', () => {})
  socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
})
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  const bytes = path === '/' ? html : (built.get(path) ?? assets.get(path))
  if (!bytes) {
    res.writeHead(404)
    res.end()
    return
  }
  const delayed =
    (mode.startsWith('latency') && path.endsWith('.task')) ||
    (['slow', 'cancel'].includes(mode) && !held && path === '/models/pose_landmarker_heavy.task')
  if (delayed) held = true
  const at = Date.now(),
    row = { mode, path, delayed, requestedAt: at, servedMs: null, aborted: false }
  requests.push(row)
  res.on('close', () => {
    if (!res.writableEnded) row.aborted = true
  })
  const serve = () => {
    row.servedMs = Date.now() - at
    if (res.destroyed) return
    res.setHeader(
      'Content-Type',
      path === '/'
        ? 'text/html'
        : path.endsWith('.js')
          ? 'application/javascript'
          : path.endsWith('.wasm')
            ? 'application/wasm'
            : 'application/octet-stream',
    )
    res.setHeader('Cache-Control', 'no-store')
    let outputBytes = bytes
    if (mode === 'tamper' && path === '/models/pose_landmarker_heavy.task') {
      outputBytes = Buffer.from(bytes)
      outputBytes[100] ^= 1
    }
    res.end(outputBytes)
  }
  if (delayed) {
    const timer = setTimeout(
      () => {
        timers.delete(timer)
        serve()
      },
      mode.startsWith('latency') ? 900 : 6000,
    )
    timers.add(timer)
  } else serve()
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
try {
  await listen(proxy)
  await listen(server)
  const host = `127.0.0.1:${server.address().port}`,
    origin = `http://${host}`
  browser = await chromium.launch({
    executablePath: executable,
    proxy: { server: `http://127.0.0.1:${proxy.address().port}`, bypass: `<-loopback>,${host}` },
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'],
  })
  for (const name of profile === 'body-gate'
    ? ['body-gate-normal-1', 'body-gate-cpu4-1', 'body-gate-normal-2', 'body-gate-cpu4-2']
    : ['current-clock', 'fixed-clock'].includes(profile)
      ? ['baseline']
      : profile === 'latency-only'
        ? ['latency', 'latency-cpu4']
        : ['baseline', 'slow', 'cancel', 'tamper', 'latency', 'latency-cpu4']) {
    mode = name
    held = false
    const context = await browser.newContext({ serviceWorkers: 'block' }),
      page = await context.newPage()
    let workers = 0,
      closed = 0
    page.on('worker', (w) => {
      workers++
      w.on('close', () => closed++)
    })
    page.on('pageerror', (e) => errors.push({ mode: name, name: e.name }))
    context.on('request', (r) => {
      if (!r.url().startsWith(`${origin}/`) && !r.url().startsWith('blob:')) external++
    })
    try {
      if (name.includes('cpu4')) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      }
      await page.goto(`${origin}/`)
      const job = page.evaluate(() => window.ownedModelProbe.begin())
      if (name === 'cancel') {
        await page.waitForTimeout(250)
        await page.evaluate(() => window.ownedModelProbe.close())
      }
      const prepared = await job
      const row = {
        name,
        prepared,
        final: null,
        workers,
        closed,
        storage: null,
        cdpCpuRate: name.includes('cpu4') ? 4 : 1,
        phase: 'prepared',
        inferenceMs: null,
      }
      results.push(row)
      const success =
        name.startsWith('body-gate-') ||
        ['baseline', 'slow', 'latency', 'latency-cpu4'].includes(name)
      if (success) {
        assert.equal(prepared.state, 'ready')
        assert.equal(prepared.failure, null)
        row.phase = 'inference'
        const samples = []
        for (let i = 0; i < (profile === 'body-gate' ? 3 : 1); i++) {
          const inferAt = Date.now()
          const observed = await page.evaluate(
            ({ current, at }) => window.ownedModelProbe.infer(current ? performance.now() : at),
            { current: ['current-clock', 'latency-only'].includes(profile), at: 1 + i * 20 },
          )
          const roundTripMs = Date.now() - inferAt
          assert.deepEqual(observed.lastBodyGate, {
            bodies: 0,
            worlds: 0,
            headUnavailable: true,
            hands: 0,
          })
          assert.equal(observed.frames, i + 1)
          samples.push({ roundTripMs, shape: observed.lastBodyGate })
        }
        row.inferenceMs = samples[0].roundTripMs
        row.samples = samples
      } else {
        assert.equal(prepared.failure, 'preparation')
        assert.equal(prepared.frames, 0)
      }
      const final = await page.evaluate(() => window.ownedModelProbe.close())
      row.final = final
      await page.waitForTimeout(100)
      const storage = await page.evaluate(() => localStorage.length + sessionStorage.length)
      assert.equal(final.failure, success ? null : 'preparation')
      assert.equal(workers, 1)
      assert.equal(closed, 1)
      assert.equal(storage, 0)
      const taskRequests = requests.filter((r) => r.mode === name && r.path.endsWith('.task'))
      assert.equal(taskRequests.length, 3)
      assert.equal(new Set(taskRequests.map((r) => r.path)).size, taskRequests.length)
      Object.assign(row, { final, workers, closed, storage, phase: 'complete' })
    } finally {
      await context.close()
    }
  }
  assert.equal(external, 0)
  assert.deepEqual(errors, [])
} catch (e) {
  failure = { name: e.name, message: e.message.split('\n')[0] }
} finally {
  await browser?.close()
  for (const t of timers) clearTimeout(t)
  await stop(server)
  await stop(proxy)
}
for (const [file, hash] of Object.entries(source)) assert.equal(sha(readFileSync(file)), hash)
const report = {
  createdAt: new Date().toISOString(),
  browserVersion: browser?.version(),
  profile,
  generatedInputClock: ['current-clock', 'latency-only'].includes(profile)
    ? 'current-performance'
    : 'fixed-1ms',
  readerProvenance: existsSync(join(scratch, 'model-reader-provenance.json'))
    ? JSON.parse(readFileSync(join(scratch, 'model-reader-provenance.json'), 'utf8'))
    : null,
  source,
  results,
  requests,
  errors,
  external,
  forbidden,
  failure: failure ?? null,
  serversStopped: !server.listening && !proxy.listening,
  actualCamera: false,
  actualHuman: false,
  avatar: false,
  controlledDownloadDelayMs: 6000,
  selectedLatencyDelayMs: 900,
  oldStartupP2Resolved: false,
  stages1to6Complete: false,
}
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ output, results, external, forbidden, failure: failure ?? null }))
if (failure) process.exitCode = 1
