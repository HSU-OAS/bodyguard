// FR-U-04/05 / release-plan4·6 / NFR-07/08: real production UI, synthetic API only.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { preview } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const [outputRoot, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-focus-recovery\.[A-Za-z0-9]+$/.test(outputRoot ?? ''))
assert.equal(realpathSync(outputRoot), outputRoot)
assert(['red', 'green'].includes(label))
const output = join(outputRoot, `browser-${label}.json`)
assert(!existsSync(output), 'Preserve previous evidence before starting resources')
const sha = (path) =>
  createHash('sha256')
    .update(readFileSync(join(root, path)))
    .digest('hex')
const index = readFileSync(join(root, 'dist/index.html'), 'utf8')
const asset = /src="\/([^"]+\.js)"/.exec(index)?.[1]
assert(asset)
const snapshot = () =>
  Object.fromEntries(
    ['src/App.tsx', 'scripts/test-focus-browser.mjs', `dist/${asset}`, 'pnpm-lock.yaml'].map(
      (path) => [path, sha(path)],
    ),
  )
const report = {
  label,
  executedHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  actualProductionChrome: true,
  actualAuthSql: false,
  actualHumanCamera: false,
  actualInactiveWindow: false,
  inactiveConditionInjected: true,
  retries: 0,
  deadlineMs: 5000,
  before: snapshot(),
  samples: [],
}
const sink = createServer((socket) => socket.destroy())
let server, browser
try {
  await new Promise((resolve, reject) => {
    sink.once('error', reject)
    sink.listen(0, '127.0.0.1', resolve)
  })
  server = await preview({
    root,
    preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false },
  })
  const address = server.httpServer.address()
  const proxy = sink.address()
  assert(address && proxy && typeof address !== 'string' && typeof proxy !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    proxy: {
      server: `http://127.0.0.1:${proxy.port}`,
      bypass: `<-loopback>,127.0.0.1:${address.port}`,
    },
  })
  report.browserVersion = browser.version()
  for (const [path, heading] of [
    ['/start', '내 몸을 위한 시작'],
    ['/explore', '스트레칭 시작 경로'],
    ['/account', '내 계정'],
    ['/start/', '내 몸을 위한 시작'],
    ['/EXPLORE', '스트레칭 시작 경로'],
  ])
    await sample(`F01 ${path}`, path, async (page, fixture) => {
      await check(page, '계정을 확인하고 있습니다')
      await fixture.release(200)
      await check(page, heading)
    })
  await sample('F02 retry', '/start', async (page, fixture) => {
    await fixture.release(503)
    await check(page, '연결을 확인해 주세요')
    fixture.hold()
    await page.getByRole('button', { name: '다시 확인', exact: true }).click()
    await check(page, '계정을 확인하고 있습니다')
    await fixture.release(200)
    await check(page, '내 몸을 위한 시작')
  })
  for (const target of ['header', 'main'])
    await sample(`F03 ${target}`, '/start', async (page, fixture) => {
      const element =
        target === 'header'
          ? page.getByRole('link', { name: 'BODYGUARD 서비스 소개' })
          : page.getByRole('main')
      await element.focus()
      await fixture.release(200)
      await present(page, '내 몸을 위한 시작')
      assert(await element.evaluate((node) => document.activeElement === node))
    })
  await sample('F04 public input', '/login', async (page, fixture) => {
    const input = page.getByLabel('이메일', { exact: true })
    await input.fill('input@example.com')
    await fixture.release(401)
    assert(await input.evaluate((node) => document.activeElement === node))
    assert.equal(await input.inputValue(), 'input@example.com')
  })
  await sample('F04 public FAQ', '/help', async (page, fixture) => {
    const summary = page.locator('summary').first()
    await summary.focus()
    await summary.press('Enter')
    await fixture.release(503)
    assert(await summary.evaluate((node) => document.activeElement === node))
    assert(await summary.evaluate((node) => node.parentElement.open))
  })
  await sample('F05 inactive condition', '/start', async (page, fixture) => {
    await fixture.release(200)
    await present(page, '내 몸을 위한 시작')
    assert.equal(await page.evaluate(() => window.__focusCalls), 0)
  })
  async function sample(name, path, exercise) {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 1000 },
    })
    const page = await context.newPage()
    page.setDefaultTimeout(5000)
    page.setDefaultNavigationTimeout(15_000)
    const counters = { camera: 0, errors: 0, external: 0, models: 0, unexpectedApi: 0 }
    let mode = 'hold'
    const pending = []
    const observations = { name, passed: false }
    const fixture = {
      hold: () => {
        mode = 'hold'
      },
      release: async (status) => {
        await expect.poll(() => pending.length > 0, { timeout: 5000 }).toBe(true)
        mode = status === 200 ? 'ready' : 'guest'
        await pending.shift().fulfill({
          status,
          contentType: 'application/json',
          body: status === 200 ? '{"id":"focus-fixture","email":"fixture@example.com"}' : '{}',
        })
      },
    }
    try {
      page.on('pageerror', () => counters.errors++)
      await context.addInitScript(
        ({ inactive }) => {
          window.__cameraCalls = 0
          window.__focusCalls = 0
          if (navigator.mediaDevices)
            navigator.mediaDevices.getUserMedia = async () => {
              window.__cameraCalls++
              throw new Error('Camera forbidden')
            }
          if (inactive) {
            // Only a test condition, not a native background-window measurement.
            document.hasFocus = () => false
            const focus = HTMLElement.prototype.focus
            HTMLElement.prototype.focus = function (...args) {
              window.__focusCalls++
              return focus.apply(this, args)
            }
          }
        },
        { inactive: name === 'F05 inactive condition' },
      )
      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.origin !== origin) {
          counters.external++
          return route.abort('blockedbyclient')
        }
        if (/\.glb|\.task|\.wasm|\/models\/|\/mediapipe\//i.test(url.pathname)) {
          counters.models++
          return route.abort('blockedbyclient')
        }
        if (url.pathname === '/api/v1/me' && !url.search && request.method() === 'GET') {
          if (mode === 'hold') {
            pending.push(route)
            return
          }
          return route.fulfill({
            status: mode === 'ready' ? 200 : 401,
            contentType: 'application/json',
            body: mode === 'ready' ? '{"id":"focus-fixture","email":"fixture@example.com"}' : '{}',
          })
        }
        if (
          url.pathname === '/api/v1/auth/google/status' &&
          !url.search &&
          request.method() === 'GET'
        )
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{"configured":false}',
          })
        if (url.pathname.startsWith('/api')) {
          counters.unexpectedApi++
          return route.fulfill({ status: 403, body: '{}' })
        }
        return route.continue()
      })
      await page.goto(origin + path)
      await exercise(page, fixture)
      observations.passed = true
    } catch {
      // Never serialize DOM, typed inputs, API bodies, errors or account identifiers.
      observations.failed = true
      process.exitCode = 1
    } finally {
      observations.boundary = await page
        .evaluate(
          (numeric) => ({
            ...numeric,
            camera: window.__cameraCalls,
            storage: localStorage.length + sessionStorage.length,
          }),
          counters,
        )
        .catch(() => ({ observationMissing: true }))
      observations.boundaryPassed =
        !observations.boundary.observationMissing &&
        Object.values(observations.boundary).every((value) => value === 0)
      if (!observations.boundaryPassed) process.exitCode = 1
      report.samples.push(observations)
      console.log(JSON.stringify(observations))
      await context.close()
    }
  }
  async function present(page, heading) {
    await expect
      .poll(
        () =>
          page.evaluate((text) => {
            const node = document.querySelector('main h1')
            return node?.textContent?.trim() === text && node.getBoundingClientRect().height > 0
          }, heading),
        { timeout: 5000 },
      )
      .toBe(true)
  }
  async function check(page, heading) {
    await present(page, heading)
    await expect
      .poll(
        () =>
          page.evaluate(
            (text) =>
              document.activeElement === document.querySelector('main h1') &&
              document.activeElement?.textContent?.trim() === text,
            heading,
          ),
        { timeout: 5000 },
      )
      .toBe(true)
  }
} catch {
  report.runnerFailed = true
  process.exitCode = 1
} finally {
  report.after = snapshot()
  report.sourceUnchanged = JSON.stringify(report.before) === JSON.stringify(report.after)
  const cleanup = await Promise.allSettled([
    browser?.close(),
    server &&
      new Promise((resolve, reject) => {
        server.httpServer.closeAllConnections()
        server.httpServer.close((error) => (error ? reject(error) : resolve()))
      }),
    new Promise((resolve, reject) => sink.close((error) => (error ? reject(error) : resolve()))),
  ])
  report.cleanupCompleted = cleanup.every((result) => result.status === 'fulfilled')
  report.completed = report.samples.length === 11
  if (!report.sourceUnchanged || !report.cleanupCompleted || !report.completed) process.exitCode = 1
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
}
