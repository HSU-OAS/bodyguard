// FR-V-03/NFR-07/08: owned synthetic diagnostics; never a product performance pass.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer as createSink } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer, preview } from 'vite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const [outputRoot, candidateCssPath, mode = 'comparison'] = process.argv.slice(2)
assert(['comparison', 'profile'].includes(mode))
assert(
  /^\/private\/tmp\/bodyguard-startup-(?:recurrence|profile)\.[A-Za-z0-9]+$/.test(outputRoot ?? ''),
)
assert.equal(realpathSync(outputRoot), outputRoot)
assert.equal(candidateCssPath, join(outputRoot, 'candidate.css'))
assert.equal(realpathSync(candidateCssPath), candidateCssPath)
const output = join(outputRoot, 'observations.json')
assert(!existsSync(output), 'Preserve earlier observations')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
function capture(folder, relative = '') {
  return readdirSync(join(root, folder, relative), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(relative, entry.name)
      if (entry.isDirectory()) return capture(folder, path)
      assert(entry.isFile())
      return [{ path: join(folder, path), sha256: hash(readFileSync(join(root, folder, path))) }]
    })
}
const sourceHashes = () => [
  ...capture('src'),
  ...capture('dist'),
  ...[
    'vite.config.ts',
    'package.json',
    'pnpm-lock.yaml',
    'scripts/probe-startup-recurrence.mjs',
  ].map((path) => ({ path, sha256: hash(readFileSync(join(root, path))) })),
]
const executedHead = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const sourceBefore = sourceHashes()
const candidateCss = readFileSync(candidateCssPath)
const index = readFileSync(join(root, 'dist/index.html'), 'utf8')
assert.equal((index.match(/href="\/assets\/[^"\s]+\.css"/g) ?? []).length, 1)
const candidateIndex = index.replace(/href="\/assets\/[^"\s]+\.css"/, 'href="/__candidate.css"')
const me = '{"id":"startup-fixture","email":"fixture@example.com"}'
const heading = '내 몸을 위한 시작'
const native = `<!doctype html><meta charset="utf-8"><main><p role="status">checking</p></main>
<script>fetch('/api/v1/me',{cache:'no-store'}).then(r=>r.json()).then(()=>{
const h=document.createElement('h1');h.textContent='${heading}';
document.querySelector('main').replaceChildren(h);});</script>`
const plugin = {
  name: 'local-recurrence-only',
  configureServer(server) {
    installFixture(server)
  },
  configurePreviewServer(server) {
    installFixture(server)
  },
}
function installFixture(server) {
  server.middlewares.use((request, response, next) => {
    const path = request.url
    if (path === '/__native-control') return send(response, 'text/html', native)
    if (path === '/__candidate.css') return send(response, 'text/css', candidateCss)
    if (path === '/start?candidate-css') return send(response, 'text/html', candidateIndex)
    if (!path?.startsWith('/api')) return next()
    response.statusCode = request.method === 'GET' && path === '/api/v1/me' ? 200 : 403
    return send(response, 'application/json', response.statusCode === 200 ? me : '{}')
  })
}
function send(response, type, body) {
  response.setHeader('Content-Type', `${type}; charset=utf-8`)
  response.setHeader('Cache-Control', 'no-store')
  response.end(body)
}
function origin(server) {
  const address = server.address()
  assert(address && typeof address !== 'string' && address.address === '127.0.0.1')
  return `http://127.0.0.1:${address.port}`
}
function install({ expectedHeading }) {
  const data = {
    headingMs: null,
    fetch: [],
    longTasks: 0,
    longTaskTotalMs: 0,
    longTaskMaxMs: 0,
    timerCount: 0,
    timerMaxLateMs: 0,
    rafCount: 0,
    rafMaxGapMs: 0,
    cameraCalls: 0,
    headingFocused: false,
  }
  window.__recurrenceNumeric = data
  const fetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const input = args[0]
    const url = new URL(input instanceof Request ? input.url : String(input), location.href)
    if (url.origin !== location.origin || url.pathname !== '/api/v1/me') return fetch(...args)
    const item = { startMs: performance.now(), responseMs: null, jsonEndMs: null, failed: false }
    if (data.fetch.length < 10) data.fetch.push(item)
    try {
      const response = await fetch(...args)
      item.responseMs = performance.now()
      const json = response.json.bind(response)
      response.json = async () => {
        const value = await json()
        item.jsonEndMs = performance.now()
        return value
      }
      return response
    } catch {
      item.failed = true
      throw new Error('Synthetic request failed')
    }
  }
  if (navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async () => {
      data.cameraCalls++
      throw new Error('No diagnostic camera')
    }
  const observer = new MutationObserver(() => {
    if (document.querySelector('main h1')?.textContent?.trim() === expectedHeading) {
      data.headingMs = performance.now()
      observer.disconnect()
    }
  })
  observer.observe(document, { childList: true, subtree: true, characterData: true })
  const tasks = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      data.longTasks++
      data.longTaskTotalMs += entry.duration
      data.longTaskMaxMs = Math.max(data.longTaskMaxMs, entry.duration)
    }
  })
  tasks.observe({ entryTypes: ['longtask'] })
  let due = performance.now() + 100
  const tick = () => {
    data.timerCount++
    data.timerMaxLateMs = Math.max(data.timerMaxLateMs, performance.now() - due)
    due = performance.now() + 100
    if (data.timerCount < 50) setTimeout(tick, 100)
  }
  setTimeout(tick, 100)
  let last = performance.now()
  const frame = () => {
    const now = performance.now()
    data.rafCount++
    data.rafMaxGapMs = Math.max(data.rafMaxGapMs, now - last)
    last = now
    if (data.rafCount < 120) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
const report = {
  actualBrowser: true,
  actualAuth: false,
  actualHuman: false,
  productGatePassed: false,
  executedHead,
  sourceBefore,
  candidateCssSha256: hash(candidateCss),
  mode,
  profilingChangesTiming: mode === 'profile',
  observationsCompleted: false,
  samples: [],
}
const sink = createSink((socket) => socket.destroy())
let built, development, browser
try {
  await new Promise((resolve, reject) => {
    sink.once('error', reject)
    sink.listen(0, '127.0.0.1', resolve)
  })
  // NFR-08: preview first sets an unset NODE_ENV to production in this process.
  // Create the actual development server first; never override caller environment.
  development = await createServer({
    root,
    plugins: [plugin],
    server: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  })
  report.developmentIsProduction = development.config.isProduction
  assert.equal(
    development.config.isProduction,
    false,
    'A development comparison must be development',
  )
  await development.listen()
  built = await preview({
    root,
    plugins: [plugin],
    preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  })
  const owned = origin(built.httpServer)
  const dev = origin(development.httpServer)
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    proxy: {
      server: origin(sink),
      bypass: `<-loopback>,127.0.0.1:${new URL(owned).port},127.0.0.1:${new URL(dev).port}`,
    },
  })
  report.browserVersion = browser.version()
  // NFR-08: a different measurement, not a retry of an earlier successful sample.
  const cases =
    mode === 'profile'
      ? ['native', 'baseline'].map((surface) => ({ transport: 'http', surface }))
      : ['http', 'fulfill'].flatMap((transport) =>
          ['native', 'baseline', 'candidate-css'].map((surface) => ({ transport, surface })),
        )
  cases.push(
    { transport: 'fulfill', surface: 'development-selection' },
    { transport: 'fulfill', surface: 'public-help' },
  )
  for (const { transport, surface } of cases) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
    })
    const expectedHeading =
      surface === 'development-selection'
        ? '원하는 동작을 골라보세요'
        : surface === 'public-help'
          ? '도움말'
          : heading
    await context.addInitScript(install, { expectedHeading })
    if (transport === 'fulfill')
      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (![owned, dev].includes(url.origin)) return route.abort('blockedbyclient')
        if (url.pathname !== '/api/v1/me') return route.continue()
        return route.fulfill({ status: 200, contentType: 'application/json', body: me })
      })
    const page = await context.newPage()
    let cdp
    if (mode === 'profile') {
      cdp = await context.newCDPSession(page)
      await cdp.send('Performance.enable', { timeDomain: 'threadTicks' })
      await cdp.send('Profiler.enable')
      await cdp.send('Profiler.setSamplingInterval', { interval: 1000 })
      await cdp.send('Profiler.start')
    }
    let pageErrors = 0,
      external = 0,
      unexpectedApi = 0,
      models = 0
    page.on('pageerror', () => pageErrors++)
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (![owned, dev].includes(url.origin)) external++
      if (
        url.pathname.startsWith('/api') &&
        (url.pathname !== '/api/v1/me' || url.search || request.method() !== 'GET')
      )
        unexpectedApi++
      if (/\.glb$|\.task$|\.wasm$|\/models\//.test(url.pathname)) models++
    })
    const target =
      surface === 'development-selection'
        ? `${dev}/dev/select`
        : owned +
          (surface === 'native'
            ? '/__native-control'
            : surface === 'candidate-css'
              ? '/start?candidate-css'
              : surface === 'public-help'
                ? '/help'
                : '/start')
    const sample = {
      transport,
      surface,
      navigationPassed: false,
      selectorPassed: false,
      gotoMs: null,
    }
    const before = performance.now()
    try {
      await page.goto(target, { timeout: 15000 })
      sample.navigationPassed = true
      sample.gotoMs = performance.now() - before
      await page
        .getByRole('heading', { name: expectedHeading, exact: true, level: 1 })
        .waitFor({ state: 'visible', timeout: 5000 })
      sample.selectorPassed = true
    } catch {
      // NFR-08: fixed label/booleans only, never a raw locator/DOM error snapshot.
      sample.failurePhase = sample.navigationPassed ? 'heading' : 'navigation'
    }
    sample.observed = await page.evaluate(
      (expected) => ({
        probe: window.__recurrenceNumeric,
        visible: document.visibilityState === 'visible',
        localStorageCount: localStorage.length,
        sessionStorageCount: sessionStorage.length,
        observedMs: performance.now(),
        headingFocused: document.activeElement === document.querySelector('main h1'),
        expectedHeadingPresent: document.querySelector('main h1')?.textContent?.trim() === expected,
        notFoundHeadingPresent:
          document.querySelector('main h1')?.textContent?.trim() === '페이지를 찾을 수 없습니다',
      }),
      expectedHeading,
    )
    sample.boundary = { pageErrors, external, unexpectedApi, models }
    if (cdp) {
      const { metrics } = await cdp.send('Performance.getMetrics')
      sample.metrics = Object.fromEntries(
        metrics
          .filter(({ name }) =>
            [
              'ScriptDuration',
              'LayoutDuration',
              'RecalcStyleDuration',
              'TaskDuration',
              'JSHeapUsedSize',
            ].includes(name),
          )
          .map(({ name, value }) => [name, value]),
      )
      const { profile } = await cdp.send('Profiler.stop')
      const times = new Map()
      for (const [index, id] of (profile.samples ?? []).entries())
        times.set(id, (times.get(id) ?? 0) + (profile.timeDeltas?.[index] ?? 0))
      // NFR-07: do not persist CDP raw traces/URLs/arguments/DOM/account values.
      sample.profile = {
        durationMs: (profile.endTime - profile.startTime) / 1000,
        samples: profile.samples?.length ?? 0,
        top: profile.nodes
          .map(({ id, callFrame }) => {
            let source = 'browser-or-harness'
            if (callFrame.url) {
              try {
                const url = new URL(callFrame.url)
                if ([owned, dev].includes(url.origin))
                  source =
                    url.pathname.startsWith('/assets/') || url.pathname.startsWith('/src/')
                      ? 'product'
                      : 'native-or-harness'
              } catch {
                /* Unknown names do not become stored source URLs. */
              }
            }
            return {
              symbol: /^[\w $().<>-]{0,80}$/.test(callFrame.functionName)
                ? callFrame.functionName || '(anonymous)'
                : '(redacted)',
              source,
              sampledMs: (times.get(id) ?? 0) / 1000,
            }
          })
          .filter(({ sampledMs }) => sampledMs > 0)
          .sort((a, b) => b.sampledMs - a.sampledMs)
          .slice(0, 15),
      }
      await cdp.detach()
    }
    report.samples.push(sample)
    console.log(
      JSON.stringify({
        surface,
        transport,
        navigationPassed: sample.navigationPassed,
        selectorPassed: sample.selectorPassed,
        headingMs: sample.observed.probe?.headingMs,
        jsonEndMs: sample.observed.probe?.fetch.at(-1)?.jsonEndMs,
        pageErrors,
      }),
    )
    if (!sample.selectorPassed) process.exitCode = 1
    assert.equal(sample.observed.probe.cameraCalls, 0)
    assert.equal(sample.observed.localStorageCount + sample.observed.sessionStorageCount, 0)
    assert.equal(pageErrors + external + unexpectedApi + models, 0)
    await context.close()
  }
  report.observationsCompleted = report.samples.length === (mode === 'profile' ? 4 : 8)
} catch {
  report.diagnosticFailed = true
  process.exitCode = 1
  console.log('Diagnostic failed; numeric partial evidence preserved')
} finally {
  report.sourceAfter = sourceHashes()
  report.sourceUnchanged = JSON.stringify(sourceBefore) === JSON.stringify(report.sourceAfter)
  report.headUnchanged =
    executedHead ===
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  report.candidateCssUnchanged = hash(candidateCss) === hash(readFileSync(candidateCssPath))
  if (!report.sourceUnchanged || !report.headUnchanged || !report.candidateCssUnchanged)
    process.exitCode = 1
  // NFR-08: even a cleanup failure must preserve the numeric partial evidence.
  const cleanup = await Promise.allSettled([
    browser?.close(),
    development?.close(),
    built &&
      new Promise((resolve, reject) => {
        built.httpServer.closeAllConnections()
        built.httpServer.close((error) => (error ? reject(error) : resolve()))
      }),
    new Promise((resolve, reject) => {
      sink.close((error) => (error ? reject(error) : resolve()))
    }),
  ])
  report.normalCleanupCompleted = cleanup.every((result) => result.status === 'fulfilled')
  if (!report.normalCleanupCompleted || !report.observationsCompleted) process.exitCode = 1
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
}
