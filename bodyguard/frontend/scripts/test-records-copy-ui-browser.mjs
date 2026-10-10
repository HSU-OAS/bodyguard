// S4.D6 / FR-R-03/FR-U-04/05/NFR-08: actual production Chrome, synthetic HTTP only.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const [phase] = process.argv.slice(2)
assert(/^(baseline|final)(?:-[1-9][0-9]*)?$/.test(phase))
const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(root, '../docs/review/records-minimal-copy', phase)
mkdirSync(proof, { recursive: false })
const origin = 'http://127.0.0.1:4198'
const files = [
  'src/pages/RecordsPage.tsx',
  'src/pages/RecordDeletion.tsx',
  'src/pages/RecordsPage.css',
  'src/index.css',
  'src/api/records.ts',
  'src/api/recordDeletion.ts',
  'src/App.tsx',
  'src/auth.tsx',
  'scripts/test-records-copy-ui-browser.mjs',
  'pnpm-lock.yaml',
]
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const report = {
  phase,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  provenance:
    'Actual production Chrome; synthetic account, HTTP records and delete proofs. No real SQL, provider, participant, camera or avatar validation.',
  source: {},
  screens: [],
  flows: [],
  failures: [],
}
for (const [index, file] of files.entries()) {
  const bytes = readFileSync(resolve(root, file))
  report.source[file] = sha(bytes)
  writeFileSync(resolve(proof, `source-${index}.gz`), gzipSync(bytes), { flag: 'wx' })
}
const sink = createServer((socket) => socket.destroy())
await new Promise((done, reject) => {
  sink.once('error', reject)
  sink.listen(0, '127.0.0.1', done)
})
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4198',
    '--strictPort',
  ],
  { cwd: root, stdio: 'ignore' },
)
let browser
let cameraCalls = 0
const external = [],
  errors = [],
  requests = []
const record = {
  id: '00000000-0000-4000-8000-000000000001',
  motion_id: 'synthetic-motion',
  protocol_version: 'fixture-not-release',
  started_at: new Date(Date.now() - 65000).toISOString(),
  ended_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  outcome: 'completed',
  observed_ms: 60000,
  repetitions: 1,
  provenance: 'client-reported',
}
async function contextFor(options = {}) {
  const state = { signedIn: true, mode: 'list', deletes: 0, previews: 0, release: null }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options })
  await context.exposeBinding('__recordsCopyCamera', () => cameraCalls++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.__recordsCopyCamera()
      return Promise.reject(new Error('Camera prohibited in record UI test'))
    }
  })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    requests.push(url.pathname)
    if (url.origin !== origin) {
      external.push(url.origin)
      return route.abort('blockedbyclient')
    }
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const json = (status, body = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: status === 204 ? undefined : JSON.stringify(body),
      })
    if (url.pathname === '/api/v1/me')
      return json(
        state.signedIn ? 200 : 401,
        state.signedIn ? { id: 'synthetic-owner', email: 'synthetic@example.com' } : {},
      )
    if (url.pathname === '/api/v1/auth/google/status') return json(200, { configured: false })
    if (url.pathname === '/api/v1/auth/csrf') return json(200, { csrf_token: 'synthetic-csrf' })
    if (url.pathname === '/api/v1/auth/logout') {
      state.signedIn = false
      return json(204)
    }
    if (url.pathname === '/api/v1/records/stretch/delete-preview') {
      state.previews++
      const period = route.request().postDataJSON()
      const now = new Date()
      return json(200, {
        ...period,
        cutoff: now.toISOString(),
        expires_at: new Date(now.getTime() + 600000).toISOString(),
        count: 1,
        fingerprint: 'a'.repeat(64),
        signature: 'b'.repeat(64),
      })
    }
    if (url.pathname === '/api/v1/records/stretch/delete') {
      state.deletes++
      return json(200, { deleted: 1 })
    }
    if (url.pathname === '/api/v1/records/stretch') {
      if (state.mode === 'loading')
        await new Promise((done) => {
          state.release = done
        })
      if (state.mode === 'error') return json(503, { detail: 'PRIVATE_RAW_ERROR' })
      if (state.mode === 'empty') return json(200, { items: [], has_more: false })
      if (state.mode === 'paging' && url.searchParams.get('offset') === '20')
        return json(200, {
          items: [
            {
              ...record,
              id: '00000000-0000-4000-8000-000000000021',
              motion_id: 'synthetic-page-two',
            },
          ],
          has_more: false,
        })
      return json(200, {
        items: [
          {
            ...record,
            motion_id: state.mode === 'long' ? 'synthetic-long-'.padEnd(64, 'a') : record.motion_id,
          },
        ],
        has_more: state.mode === 'paging',
      })
    }
    if (url.pathname === `/api/v1/records/stretch/${record.id}`)
      return state.mode === 'missing' ? json(404) : json(200, record)
    errors.push(`Unexpected API: ${url.pathname}`)
    return json(503)
  })
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page, state }
}
async function screen(page, name, width) {
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Unexpected document overflow',
  )
  const text = await page.locator('main').innerText()
  const notice = await page.locator('.records-explanation').innerText()
  assert(await page.locator('.records-explanation').isVisible())
  if (phase.startsWith('final'))
    assert.equal(notice, '‘완료’는 수행 종료입니다. 자세 정확성·효과를 보장하지 않습니다.')
  const labels = await page.locator('main label').allTextContents()
  const buttons = await page.locator('main button').allTextContents()
  const links = await page
    .locator('main a')
    .evaluateAll((all) => all.map((link) => [link.textContent, link.getAttribute('href')]))
  const filename = `${report.screens.length + 1}-${name}-${width}.png`
  await page.screenshot({ path: resolve(proof, filename), fullPage: true })
  report.screens.push({
    filename,
    name,
    width,
    charsWithoutSpace: text.replace(/\s/g, '').length,
    notice,
    labels,
    buttons,
    links,
  })
  assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0])
}
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview server exited')
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    if (attempt === 79) throw new Error('Preview unavailable')
    await delay(100)
  }
  const address = sink.address()
  assert(address && typeof address !== 'string')
  browser = await chromium.launch({
    executablePath:
      '/Users/gongman/.browser-driver-manager/chrome/mac_arm-154.0.8037.57/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    headless: true,
    proxy: { server: `http://127.0.0.1:${address.port}`, bypass: '127.0.0.1,localhost' },
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'],
  })
  report.chrome = browser.version()
  for (const width of [1440, 1024, 800]) {
    const { context, page, state } = await contextFor({ viewport: { width, height: 1000 } })
    await page.goto(`${origin}/records`)
    await page.getByRole('table').waitFor()
    await screen(page, 'list', width)
    await page.getByRole('link', { name: /synthetic-motion.*기록 상세/ }).click()
    await page.getByText('fixture-not-release', { exact: true }).waitFor()
    const privacy = phase.startsWith('final')
      ? '수행 요약만 저장하며, 영상·관절 좌표는 저장하지 않습니다.'
      : '수행 요약만 저장합니다. 원본 영상과 관절 좌표는 저장하지 않습니다.'
    assert(await page.getByText(privacy, { exact: true }).isVisible())
    await screen(page, 'detail', width)
    await page.getByRole('link', { name: '기록 목록으로 돌아가기' }).click()
    await page.getByRole('table').waitFor()
    const from = await page.getByLabel('시작일', { exact: true }).inputValue()
    const to = await page.getByLabel('종료일', { exact: true }).inputValue()
    assert(from && to && new URL(page.url()).searchParams.get('from') === from)
    await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
    await page.getByText('삭제 대상: 1건', { exact: true }).waitFor()
    assert(await page.getByText(/복구할 수 없습니다.*계정이나 다른 기간/).isVisible())
    assert(await page.getByText(/조회한 기간의 전체 페이지/).isVisible())
    await screen(page, 'delete-confirm', width)
    await page.getByRole('button', { name: '취소', exact: true }).click()
    assert.equal(state.deletes, 0)
    assert.equal(state.previews, 1)
    assert(
      await page
        .getByRole('button', { name: '이 기간 기록 삭제', exact: true })
        .evaluate((el) => el === document.activeElement),
    )
    report.flows.push(`list-detail-period-return-delete-cancel-${width}`)
    await context.close()
  }
  const { context, page, state } = await contextFor({ viewport: { width: 800, height: 1000 } })
  state.mode = 'loading'
  await page.goto(`${origin}/records`)
  await page.getByText('기록을 불러오고 있습니다.', { exact: true }).waitFor()
  await screen(page, 'loading', 800)
  state.mode = 'empty'
  state.release?.()
  await page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }).waitFor()
  await screen(page, 'empty', 800)
  state.mode = 'error'
  await page.getByRole('button', { name: '기간 조회', exact: true }).click()
  await page.getByRole('heading', { name: '기록을 불러오지 못했습니다' }).waitFor()
  assert(!(await page.locator('main').innerText()).includes('PRIVATE_RAW_ERROR'))
  assert.equal(await page.getByRole('table').count(), 0)
  await screen(page, 'error', 800)
  state.mode = 'paging'
  await page.getByRole('button', { name: '다시 조회', exact: true }).click()
  await page.getByRole('table').waitFor()
  await page.getByRole('button', { name: '다음 페이지', exact: true }).click()
  await page.getByRole('link', { name: /synthetic-page-two.*기록 상세/ }).waitFor()
  assert.equal(await page.getByRole('link', { name: /synthetic-motion.*기록 상세/ }).count(), 0)
  await screen(page, 'page-two', 800)
  report.flows.push('loading-empty-error-retry-page-no-stale-records')
  state.mode = 'missing'
  await page.goto(`${origin}/records/${record.id}`)
  await page.getByRole('heading', { name: '기록을 찾을 수 없습니다' }).waitFor()
  await screen(page, 'missing', 800)
  state.mode = 'long'
  await page.goto(`${origin}/records`)
  await page.getByRole('table').waitFor()
  await screen(page, 'long', 800)
  await page.getByLabel('시작일', { exact: true }).fill('2026-09-02')
  await page.getByLabel('종료일', { exact: true }).fill('2026-09-01')
  await page.getByRole('button', { name: '기간 조회', exact: true }).click()
  await page.getByRole('alert').waitFor()
  await screen(page, 'invalid-period', 800)
  report.flows.push('missing-detail-long-content-date-recovery')
  await context.close()
  for (const options of [{ colorScheme: 'dark' }, { reducedMotion: 'reduce' }]) {
    const { context, page } = await contextFor({
      ...options,
      viewport: { width: 1024, height: 1000 },
    })
    await page.goto(`${origin}/records`)
    await page.getByRole('table').waitFor()
    await page.getByLabel('종료일', { exact: true }).focus()
    // Native date inputs have multiple keyboard segments before the next control.
    for (let step = 0; step < 8; step++) {
      await page.keyboard.press('Tab')
      if (
        await page
          .getByRole('button', { name: '기간 조회', exact: true })
          .evaluate((el) => el === document.activeElement)
      )
        break
    }
    assert(
      await page
        .getByRole('button', { name: '기간 조회', exact: true })
        .evaluate(
          (el) => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none',
        ),
    )
    await screen(page, options.colorScheme ? 'dark' : 'reduced-motion', 1024)
    await context.close()
  }
  report.flows.push('dark-and-reduced-preference-keyboard-focus')
  const logout = await contextFor()
  await logout.page.goto(`${origin}/records`)
  await logout.page.getByRole('table').waitFor()
  await logout.page.getByRole('link', { name: '내 계정', exact: true }).click()
  await logout.page.getByRole('heading', { name: '내 계정', exact: true }).waitFor()
  await logout.page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await logout.page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  await logout.page.goto(`${origin}/records`)
  await logout.page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  assert.equal(await logout.page.getByRole('table').count(), 0)
  await logout.context.close()
  report.flows.push('logout-private-records-closed')
  assert.equal(cameraCalls, 0)
  assert.deepEqual(external, [])
  assert.deepEqual(errors, [])
  assert(
    !requests.some((path) => /\.glb|\.wasm|pose_landmarker|mediapipe|MeasureDemoPage/.test(path)),
  )
  report.passed = true
} catch (error) {
  report.failures.push(error.stack ?? String(error))
  report.passed = false
  process.exitCode = 1
} finally {
  report.cameraCalls = cameraCalls
  report.externalOrigins = external
  report.pageErrors = errors
  await browser?.close()
  server.kill('SIGTERM')
  await new Promise((done) => sink.close(done))
  writeFileSync(resolve(proof, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' })
  process.stdout.write(
    `${JSON.stringify({ phase, passed: report.passed, chrome: report.chrome, screens: report.screens.length, flows: report.flows.length, failures: report.failures })}\n`,
  )
}
