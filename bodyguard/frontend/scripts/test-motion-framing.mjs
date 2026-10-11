// FR-M-07/FR-S-06/NFR-08: actual private React/native fake camera/SDK; no avatar/person claim.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-motion-framing\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/pages/CameraPreparation.tsx',
  'src/pages/CoachingPage.tsx',
  'src/posture/cameraFraming.ts',
  'scripts/test-motion-framing.mjs',
]
const hashes = () =>
  files.map((file) => ({
    file,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
  }))
const before = hashes(),
  cases = [],
  errors = []
let browser,
  page,
  server,
  failure,
  diagnostic,
  phase = 'setup',
  external = 0,
  avatars = 0,
  writes = 0
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    writes++
    res.writeHead(403)
    res.end('{}')
  } else if (req.url === '/api/v1/me')
    res.end('{"id":"framing-fixture","email":"fixture@example.com"}')
  else if (req.url === '/api/v1/auth/google/status') res.end('{"configured":false}')
  else {
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
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  context.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(origin).origin) external++
    if (/\.glb(?:\?|$)/.test(r.url())) avatars++
  })
  await context.addInitScript(() => {
    const p = { calls: 0, streams: [], frames: 0 }
    window.framingProbe = p
    const camera = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (options) => {
      p.calls++
      const s = await camera(options)
      p.streams.push(s)
      return s
    }
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (data, transfer) {
      if (data?.type === 'frame') p.frames++
      return post.call(this, data, transfer)
    }
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  const button = (name) => page.getByRole('button', { name, exact: true })
  const hint = page.getByRole('status', { name: '현재 동작 촬영 안내' })
  const counts = () =>
    page.evaluate(() => ({ calls: window.framingProbe.calls, frames: window.framingProbe.frames }))
  const ended = async () => {
    await page.waitForFunction(() =>
      window.framingProbe.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    )
    for (let i = 0; i < 50 && page.workers().length; i++)
      await new Promise((yes) => setTimeout(yes, 100))
    assert.equal(page.workers().length, 0)
    assert.equal(await page.locator('video,canvas').count(), 0)
  }
  const prepare = async () => {
    const scope = phase
    phase = `${scope}/prepare`
    const old = await counts()
    await button('카메라 확인').click()
    await button('카메라 끄기').waitFor({ timeout: 16000 })
    assert.deepEqual(await counts(), { calls: old.calls + 1, frames: old.frames + 1 })
    phase = scope
  }
  const observe = async () => {
    const scope = phase
    phase = `${scope}/observe`
    const old = await counts()
    await button('입력 확인').click()
    await page.waitForFunction((frames) => window.framingProbe.frames >= frames + 3, old.frames, {
      timeout: 8000,
    })
    await hint.filter({ hasText: '화면 안에 몸이 보이도록' }).waitFor({ timeout: 8000 })
    assert.equal(await button('코칭 준비 중').isDisabled(), true)
    assert.equal(await button('전체 시범').isDisabled(), true)
    phase = scope
  }
  phase = 'initial'
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await button('카메라 확인').waitFor()
  assert.equal((await counts()).calls, 0)
  assert.match(await hint.innerText(), /머리와 양쪽 어깨/)
  cases.push('selected motion guidance before any camera/SDK acquisition')
  phase = 'native-input'
  await prepare()
  await observe()
  cases.push(
    'actual native fake camera/heavy SDK: warmup discarded, separate continuous input → no body positioning hint; no judgement/reference/write',
  )
  phase = 'display-framing'
  const old = await counts()
  await button('전신').click()
  await button('상반신').click()
  await button('자세히').click()
  assert.equal((await counts()).calls, old.calls)
  assert.equal(page.workers().length, 1)
  assert.match(await hint.innerText(), /화면 안에 몸이 보이도록/)
  cases.push('display framing changes neither acquisition nor motion coverage requirements')
  phase = 'motion-change'
  await button('동작 변경').click()
  await button('팔 위로 뻗기 화면에서 보기').click()
  await page.getByRole('heading', { name: '팔 위로 뻗기', level: 1 }).waitFor()
  await button('카메라 확인').waitFor()
  await ended()
  assert.equal((await counts()).calls, old.calls)
  assert.match(await hint.innerText(), /골반/)
  cases.push(
    'actual motion picker change closes old native camera/Worker, discards old hint, no automatic replacement',
  )
  // Capture only the existing DOM control region after all camera/Worker resources end.
  await page
    .getByRole('region', { name: '카메라 준비 확인' })
    .screenshot({ path: `${scratch}/${label}-motion-change.png` })
  phase = 'fresh-motion-input'
  await prepare()
  await observe()
  cases.push('new motion requires explicit fresh preparation and separate input check')
  phase = 'unknown-motion'
  const calls = (await counts()).calls
  await page.evaluate(() => {
    history.pushState(null, '', '/dev/coaching?motion=__proto__')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByRole('heading', { name: '동작을 찾을 수 없습니다', level: 1 }).waitFor()
  await ended()
  assert.equal(await button('카메라 확인').count(), 0)
  assert.equal((await counts()).calls, calls)
  cases.push(
    'unknown route motion closes old resources and provides no camera start/default success',
  )
  assert.equal(external, 0)
  assert.equal(avatars, 0)
  assert.equal(writes, 0)
  assert.deepEqual(errors, [])
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  assert.deepEqual(hashes(), before)
  await context.close()
} catch (e) {
  failure = { phase, name: e.name, code: 'motion-framing-verification-failed' }
  try {
    diagnostic = await page?.evaluate(() => {
      const text = document.querySelector('[aria-label="카메라 준비 확인"]')?.textContent ?? ''
      return {
        calls: window.framingProbe?.calls,
        frames: window.framingProbe?.frames,
        tracks: window.framingProbe?.streams.map((s) => s.getTracks().map((t) => t.readyState)),
        ui: text.includes('분석 연결을 준비하지 못했습니다')
          ? 'inference-error'
          : text.includes('카메라 입력을 확인하지 못했습니다')
            ? 'frame-error'
            : text.includes('연속 입력 확인 중')
              ? 'observing'
              : text.includes('카메라·분석 연결 확인됨')
                ? 'ready'
                : 'other',
      }
    })
  } catch {
    diagnostic = { unavailable: true }
  }
} finally {
  await browser?.close()
  await server?.close()
  api.closeAllConnections()
  if (api.listening) await new Promise((yes) => api.close(yes))
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual React/native fake camera/heavy SDK; controlled account GET fixture; no person/positive body accuracy proof',
        cases,
        failure: failure ?? null,
        diagnostic: diagnostic ?? null,
        external,
        avatars,
        writes,
        errors,
        sourceBefore: before,
        sourceAfter: hashes(),
        ownedResourcesClosed: true,
        notProven: [
          'physical webcam/person accuracy/identity',
          'avatar/reference/clinical judgement/recommendation/result recording',
          'original startup P2 resolution',
          'real provider/Docker/HTTPS/deployment/whole1-6',
        ],
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(
  JSON.stringify({
    output: `${scratch}/${label}.json`,
    passed: cases.length,
    failure: failure ?? null,
  }),
)
if (failure) process.exitCode = 1
