// Actual Chrome/React/session/writer/HTTP; account/ports/clock/classification are controlled.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-recorded-playback\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/coaching/useRecordedPlayback.ts',
  'e2e/fixtures/authCoachingProbe.ts',
  'scripts/test-recorded-playback.mjs',
]
const hashes = () =>
  files.map((file) => ({
    file,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  }))
const before = hashes(),
  cases = [],
  rows = [],
  errors = []
let guest = false,
  external = 0,
  avatars = 0,
  camera = 0,
  worker = 0
let browser,
  server,
  failure,
  phase = 'setup'
const api = createHTTPServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/api/v1/me') {
    res.writeHead(guest ? 401 : 200)
    res.end(
      JSON.stringify(
        guest ? {} : { id: '00000000-0000-4000-8000-000000000001', email: 'fixture@example.com' },
      ),
    )
  } else if (req.url === '/api/v1/auth/csrf')
    res.end(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
  else if (req.url === '/api/v1/auth/google/status') res.end('{"configured":false}')
  else if (req.url === '/api/v1/records/stretch' && req.method === 'POST') {
    assert.equal(req.headers['x-csrf-token'], 'a'.repeat(64))
    let text = ''
    for await (const chunk of req) text += chunk
    const row = JSON.parse(text)
    rows.push({ ...row, created_at: row.ended_at, provenance: 'client-reported' })
    res.writeHead(201)
    res.end(JSON.stringify(rows.at(-1)))
  } else if (req.url?.startsWith('/api/v1/records/stretch/')) {
    const row = rows.find((r) => req.url.endsWith(r.id))
    res.writeHead(row ? 200 : 404)
    res.end(JSON.stringify(row ?? {}))
  } else {
    res.writeHead(403)
    res.end('{}')
  }
})
try {
  await new Promise((yes, no) => {
    api.once('error', no)
    api.listen(0, '127.0.0.1', yes)
  })
  server = await createServer(
    mergeConfig(config, {
      configFile: false,
      envDir: scratch,
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        open: false,
        proxy: { '/api': `http://127.0.0.1:${api.address().port}` },
      },
    }),
  )
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    executablePath: executable,
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  })
  context.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(origin).origin) external++
    if (/\.glb(?:\?|$)/.test(r.url())) avatars++
  })
  await context.exposeBinding('__unexpectedCamera', () => {
    camera++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.__unexpectedCamera()
      return Promise.reject(new Error('Unexpected camera'))
    }
  })
  const page = await context.newPage()
  page.on('worker', () => {
    worker++
  })
  page.on('pageerror', (e) => errors.push(e.name))
  const state = () => page.evaluate(() => window.assemblyProbe.state())
  const action = (name) => page.evaluate((name) => window.assemblyProbe[name](), name)
  async function mount(delayed = false) {
    const options = {
      recordId: randomUUID(),
      utc: new Date(Date.now() - 2000).toISOString(),
      delayed,
    }
    await page.evaluate(async (options) => {
      const { mountAuthCoachingProbe } = await import('/e2e/fixtures/authCoachingProbe.ts')
      window.assemblyProbe = mountAuthCoachingProbe(options)
    }, options)
    await page.waitForFunction(
      (expected) => window.assemblyProbe.state().auth === expected,
      guest ? 'guest' : 'ready',
    )
    return options
  }
  await page.goto(`${origin}start`)
  phase = 'complete-and-save'
  const options = await mount()
  assert.equal((await state()).acquired, 0)
  await action('prepare')
  assert.equal((await state()).acquired, 0)
  assert.equal(rows.length, 0)
  await action('start')
  await action('perform')
  assert.equal((await state()).session, 'ended')
  assert.equal((await state()).playbackStarts, 1)
  assert.equal((await state()).disposed, 3)
  assert.equal(rows.length, 0)
  await action('save')
  assert.equal((await state()).record, 'saved')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, options.recordId)
  assert.equal(rows[0].outcome, 'completed')
  assert.equal(rows[0].observed_ms, 100)
  assert(!/landmark|worldLandmark|image|video|coordinates|matrix/.test(JSON.stringify(rows[0])))
  cases.push(
    'inert prepare → one owned playback start → synthetic observation sequence → actual engine result → explicit own HTTP save',
  )
  await action('unmount')
  await page.waitForFunction(() => window.assemblyProbe.state().lifecycleClosed === 1)
  phase = 'record-detail'
  await page.goto(`${origin}records/${options.recordId}`)
  await page.getByRole('heading', { name: '수행 기록 상세', exact: true }).waitFor()
  await page.getByText('관찰된 수행 시간', { exact: true }).waitFor()
  await page.screenshot({ path: `${scratch}/${label}-record.png`, fullPage: true })
  cases.push(
    'saved fixture row displayed through existing own-record detail UI; SQL/actual exercise not claimed',
  )
  phase = 'refresh-revocation'
  await page.goto(`${origin}start`)
  await mount()
  await action('prepare')
  await action('start')
  await action('refresh')
  await page.waitForFunction(
    () => !window.assemblyProbe.state().owned && window.assemblyProbe.state().lifecycleClosed === 1,
  )
  await action('perform')
  await action('save')
  assert.equal(rows.length, 1)
  assert.equal((await state()).playbackStarts, 1)
  await action('unmount')
  cases.push(
    'same-account authority refresh retires original playback and blocks retained observations/save',
  )
  phase = 'held-permission-cancel'
  await mount(true)
  await action('prepare')
  await action('start')
  await page.waitForFunction(() => window.assemblyProbe.state().waiting)
  await page.evaluate(() => {
    window.assemblyCancel = window.assemblyProbe.cancel()
  })
  assert.equal((await state()).owned, false)
  await action('release')
  await page.evaluate(() => window.assemblyCancel)
  assert.equal((await state()).acquired, 1)
  assert.equal((await state()).disposed, 1)
  assert.equal((await state()).playbackStarts, 0)
  await action('save')
  assert.equal(rows.length, 1)
  await action('unmount')
  cases.push(
    'cancel while synthetic permission is held: late resource disposed, no inference/avatar/playback/save acquisition',
  )
  phase = 'guest'
  guest = true
  await mount()
  await action('prepare')
  assert.equal((await state()).acquired, 0)
  assert.equal((await state()).lifecycleClosed, 0)
  assert.equal((await state()).playbackStarts, 0)
  await action('unmount')
  assert.equal(external, 0)
  assert.equal(avatars, 0)
  assert.equal(camera, 0)
  assert.equal(worker, 0)
  assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0])
  assert.deepEqual(errors, [])
  assert.deepEqual(hashes(), before)
  cases.push('guest inert; external/GLB/camera/Worker/storage/page error0; tested source unchanged')
} catch (e) {
  failure = { phase, name: e.name }
  process.exitCode = 1
} finally {
  await browser?.close()
  await server?.close()
  await new Promise((yes) => api.close(yes))
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        sourceBefore: before,
        sourceAfter: hashes(),
        cases,
        failure: failure ?? null,
        controls: { external, avatars, camera, worker, rows: rows.length, errors },
        notProven: [
          'actual identity provider/SQL',
          'webcam/native SDK',
          'clinical motion accuracy',
          'avatar/deformation/appearance',
          'Docker/HTTPS/whole1~6',
        ],
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
  console.log(JSON.stringify({ cases: cases.length, failure: failure ?? null }))
}
