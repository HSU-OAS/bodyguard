// FR-R-03/FR-U-04/05: original production UI; controlled API/records, no SQL/body capture.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'

const [proof, label, executable] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-summary-focus\.[A-Za-z0-9]+$/.test(proof))
assert(/^[a-z][a-z0-9-]+$/.test(label) && existsSync(executable))
const output = join(proof, `${label}.json`)
assert(!existsSync(output), 'Keep previous results')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const html = readFileSync('dist/index.html')
const js = html.toString().match(/src="\/([^"]+\.js)"/)?.[1]
const css = html.toString().match(/href="\/([^"]+\.css)"/)?.[1]
assert(js && css)
const source = Object.fromEntries(
  [
    'src/pages/MinuteSummaryPage.tsx',
    'src/pages/MinuteSummaryPage.focus.test.tsx',
    'scripts/test-summary-focus.mjs',
    'src/api/minuteSummaries.ts',
    'src/auth.tsx',
    'pnpm-lock.yaml',
  ].map((file) => [file, sha(readFileSync(file))]),
)
const product = {
  js: { path: js, sha256: sha(readFileSync(join('dist', js))) },
  css: { path: css, sha256: sha(readFileSync(join('dist', css))) },
  html: sha(html),
}
for (const [name, file] of [
  ['product.js', join('dist', js)],
  ['product.css', join('dist', css)],
  ['product.html', 'dist/index.html'],
  ['source.tsx', 'src/pages/MinuteSummaryPage.tsx'],
])
  writeFileSync(join(proof, `${label}-${name}`), readFileSync(file), { flag: 'wx' })
const part = { method: 'fixture', unit: 'deg', dev_mean: null, measured_sec: 0, bad_sec: 0 }
const row = {
  minute_start: '2026-10-01T12:00:00Z',
  baseline_id: null,
  client_version: 'Fixture+V1',
  coverage_sec: 60,
  measured_sec: 30,
  unmeasurable_sec: 20,
  present_sec: 45,
  background_sec: 10,
  any_bad_sec: 15,
  neck: part,
  trunk: part,
  shoulder: { ...part, dev_mean: 1.25, measured_sec: 30, bad_sec: 15 },
  created_at: '2026-10-01T12:01:00Z',
  provenance: 'client-reported',
}
const first = {
  items: Array.from({ length: 20 }, (_, i) => ({
    ...row,
    minute_start: new Date(Date.parse(row.minute_start) - i * 60000).toISOString(),
  })),
  has_more: true,
}
const account = { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' }
const report = {
  createdAt: new Date().toISOString(),
  executedHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source,
  product,
  cases: [],
  errors: [],
  external: 0,
  modelRequests: 0,
  actualProductionUI: true,
  actualChrome: true,
  actualAuthSql: false,
  API: 'controlled fixture',
  actualCamera: false,
  actualHuman: false,
  actualOSAccessibility: false,
  stages1to6Complete: false,
}
let browser,
  failure,
  refused = 0
const proxy = createServer((_req, res) => {
  refused++
  res.writeHead(403)
  res.end()
})
proxy.on('connect', (_req, socket) => {
  refused++
  socket.on('error', () => {})
  socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
})
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  const file =
    path === '/brand.svg' ? 'brand.svg' : path === `/${js}` ? js : path === `/${css}` ? css : null
  const bytes = file ? readFileSync(join('dist', file)) : html
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader(
    'Content-Type',
    file?.endsWith('.js')
      ? 'application/javascript'
      : file?.endsWith('.css')
        ? 'text/css'
        : file?.endsWith('.svg')
          ? 'image/svg+xml'
          : 'text/html',
  )
  res.end(bytes)
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
  report.browserVersion = browser.version()
  for (const name of [
    'wait-empty',
    'date-ready',
    'date-error',
    'same-key',
    'same-pointer',
    'same-wheel',
    'error-retry',
  ]) {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 1000 },
    })
    const page = await context.newPage()
    page.setDefaultTimeout(5000)
    page.setDefaultNavigationTimeout(15000)
    const result = { name, passed: false, queryCount: 0, firstCommit: null, finalFocus: null }
    report.cases.push(result)
    let held
    try {
      await context.addInitScript(() => {
        window.focusProbe = { armed: false, commit: null, cameraCalls: 0, wheelCalls: 0 }
        document.addEventListener(
          'wheel',
          () => {
            window.focusProbe.wheelCalls++
          },
          { passive: true },
        )
        if (navigator.mediaDevices)
          navigator.mediaDevices.getUserMedia = async () => {
            window.focusProbe.cameraCalls++
            throw new Error('Camera forbidden')
          }
        new MutationObserver(() => {
          const probe = window.focusProbe
          const region = document.querySelector('.records-results')
          if (!probe.armed || probe.commit || region?.getAttribute('aria-busy') !== 'false') return
          probe.commit = {
            focusId: document.activeElement?.id ?? '',
            focusTag: document.activeElement?.tagName ?? '',
          }
        }).observe(document, { subtree: true, childList: true, attributes: true })
      })
      page.on('pageerror', (e) => report.errors.push(e.name))
      context.on('request', (request) => {
        if (!request.url().startsWith(`${origin}/`)) report.external++
        if (/\.glb|\.task|\.wasm|\/mediapipe\//.test(request.url())) report.modelRequests++
      })
      await context.route('**/api/**', async (route) => {
        const request = route.request(),
          url = new URL(request.url())
        assert.equal(url.origin, origin)
        if (url.pathname === '/api/v1/me') return route.fulfill({ json: account })
        if (url.pathname === '/api/v1/auth/csrf')
          return route.fulfill({ json: { csrf_token: 'a'.repeat(64) } })
        if (url.pathname === '/api/v1/summaries' && request.method() === 'GET') {
          assert.equal(request.headers()['x-account-id'], account.id)
          assert.equal(request.headers()['x-csrf-token'], 'a'.repeat(64))
          if (++result.queryCount === 1) return route.fulfill({ json: first })
          assert(!held, 'No overlapping query is allowed in this fixture')
          held = route
          return
        }
        throw new Error('Unexpected API request')
      })
      await page.goto(`${origin}/posture-records?from=2026-10-01&to=2026-10-02`)
      const next = page.getByRole('button', { name: '다음 기록', exact: true })
      await next.waitFor()
      const period = page.getByRole('button', { name: '기간 조회', exact: true })
      const action = name.startsWith('same-') ? period : next
      await action.focus()
      await action.press('Enter')
      await expect.poll(() => Boolean(held)).toBe(true)
      await page.evaluate(() => {
        window.focusProbe.armed = true
        window.focusProbe.commit = null
      })
      const date = page.getByLabel('시작 날짜', { exact: true })
      if (name.startsWith('date-')) await date.focus()
      if (name === 'same-key') await action.press('ArrowRight')
      if (name === 'same-wheel') {
        await page.mouse.wheel(0, 100)
        await expect.poll(() => page.evaluate(() => window.focusProbe.wheelCalls)).toBe(1)
        assert(await action.evaluate((node) => node === document.activeElement))
      }
      if (name === 'same-pointer') {
        const box = await action.boundingBox(),
          heading = await page
            .getByRole('heading', { name: '내 자세 기록', exact: true })
            .boundingBox()
        assert(box && heading)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(heading.x + heading.width / 2, heading.y + heading.height / 2)
        await page.mouse.up()
        assert(await action.evaluate((node) => node === document.activeElement))
      }
      const pending = held
      held = undefined
      await pending.fulfill(
        name.endsWith('error') || name === 'error-retry'
          ? { status: 503, body: '' }
          : { json: { items: [], has_more: false } },
      )
      await expect(page.getByRole('region', { name: /자세 기록$/ })).toHaveAttribute(
        'aria-busy',
        'false',
      )
      await page.waitForTimeout(100)
      result.firstCommit = await page.evaluate(() => window.focusProbe.commit)
      result.finalFocus = await page.evaluate(() => ({
        id: document.activeElement?.id ?? '',
        tag: document.activeElement?.tagName ?? '',
      }))
      if (name.startsWith('date-')) {
        assert(
          await date.evaluate((node) => node === document.activeElement),
          'Late response stole date focus',
        )
        assert.equal(await date.inputValue(), '2026-10-01')
      } else if (name.startsWith('same-'))
        assert(
          await action.evaluate((node) => node === document.activeElement),
          'Late response stole continuing interaction focus',
        )
      else {
        assert.equal(result.finalFocus.id, 'summary-results-heading')
        assert.equal(
          result.firstCommit.focusId,
          'summary-results-heading',
          'Results were committed before focus was handed over',
        )
      }
      if (name === 'error-retry') {
        await page.getByRole('button', { name: '다시 조회', exact: true }).press('Enter')
        await expect.poll(() => Boolean(held)).toBe(true)
        const retry = held
        held = undefined
        await retry.fulfill({ json: { items: [], has_more: false } })
        await expect(page.getByRole('region', { name: /자세 기록$/ })).toHaveAttribute(
          'aria-busy',
          'false',
        )
        assert.equal(
          await page.evaluate(() => document.activeElement?.id),
          'summary-results-heading',
        )
      }
      assert.equal(result.queryCount, name === 'error-retry' ? 3 : 2)
      assert.equal(await page.evaluate(() => window.focusProbe.cameraCalls), 0)
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
      if (['wait-empty', 'date-ready', 'date-error'].includes(name))
        await page.screenshot({ path: join(proof, `${label}-${name}.png`), fullPage: true })
      result.passed = true
    } catch (error) {
      result.failure = { name: error.name, message: error.message.split('\n')[0] }
    } finally {
      await context.close()
    }
  }
  assert(
    report.cases.every((row) => row.passed),
    'Some UI flows failed; preserve all case outcomes',
  )
  assert.deepEqual(report.errors, [])
  assert.equal(report.external, 0)
  assert.equal(report.modelRequests, 0)
} catch (error) {
  failure = { name: error.name, message: error.message.split('\n')[0] }
} finally {
  await browser?.close()
  await stop(server)
  await stop(proxy)
}
for (const [file, hash] of Object.entries(source)) assert.equal(sha(readFileSync(file)), hash)
Object.assign(report, {
  failure: failure ?? null,
  serversStopped: !server.listening && !proxy.listening,
  proxyRefusals: refused,
})
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
console.log(
  JSON.stringify({
    output,
    passed: report.cases.filter((row) => row.passed).length,
    failure: report.failure,
    cases: report.cases.map(({ name, passed, failure, firstCommit, finalFocus }) => ({
      name,
      passed,
      failure,
      firstCommit,
      finalFocus,
    })),
  }),
)
if (failure) process.exitCode = 1
