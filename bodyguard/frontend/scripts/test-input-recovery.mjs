// FR-M-01/02/07·FR-U-04/NFR-08: real private React/SDK with test-only native faults.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-input-recovery\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/pose/cameraPreparation.ts',
  'src/pose/videoPoseSource.ts',
  'src/pose/workerInference.ts',
  'src/pages/CameraPreparation.tsx',
  'scripts/test-input-recovery.mjs',
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
    res.end('{"id":"recovery-fixture","email":"fixture@example.com"}')
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
    const p = {
      calls: 0,
      streams: [],
      workers: [],
      frames: 0,
      mode: 'normal',
      held: [],
      cancelled: 0,
      faultCalls: 0,
    }
    window.recoveryProbe = p
    const camera = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (options) => {
      p.calls++
      const s = await camera(options)
      p.streams.push(s)
      for (const track of s.getTracks()) {
        const stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          if (p.mode === 'cleanup-fault') {
            p.faultCalls++
            throw Error('PRIVATE_NATIVE_FAILURE')
          }
        }
      }
      return s
    }
    const NativeFrame = window.VideoFrame
    window.VideoFrame = class extends NativeFrame {
      constructor(...args) {
        if (p.mode === 'capture-fault') {
          p.faultCalls++
          throw Error('PRIVATE_NATIVE_FAILURE')
        }
        super(...args)
      }
    }
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (data, transfer) {
      if (data?.type === 'init') p.workers.push(this)
      if (data?.type === 'frame') {
        p.frames++
        if (p.mode === 'worker-fault') {
          p.mode = 'normal'
          p.faultCalls++
          queueMicrotask(() =>
            this.dispatchEvent(new ErrorEvent('error', { message: 'PRIVATE_NATIVE_FAILURE' })),
          )
        }
      }
      return post.call(this, data, transfer)
    }
    const request = HTMLVideoElement.prototype.requestVideoFrameCallback,
      cancel = HTMLVideoElement.prototype.cancelVideoFrameCallback
    HTMLVideoElement.prototype.requestVideoFrameCallback = function (cb) {
      if (p.mode === 'hold') {
        p.held.push(cb)
        return 2147000000
      }
      return request.call(this, cb)
    }
    HTMLVideoElement.prototype.cancelVideoFrameCallback = function (id) {
      if (id === 2147000000) {
        p.cancelled++
        return
      }
      return cancel.call(this, id)
    }
  })
  page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  const button = (name) => page.getByRole('button', { name, exact: true })
  const panel = page.getByRole('region', { name: '카메라 준비 확인' })
  const ended = async () => {
    await page.waitForFunction(() =>
      window.recoveryProbe.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    )
    for (let i = 0; i < 50 && page.workers().length; i++)
      await new Promise((yes) => setTimeout(yes, 100))
    assert.equal(page.workers().length, 0)
    assert.equal(await page.locator('video,canvas').count(), 0)
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    assert.equal(await page.getByRole('button', { name: '코칭 준비 중' }).isDisabled(), true)
    assert.equal((await panel.innerText()).includes('PRIVATE_NATIVE_FAILURE'), false)
  }
  const prepare = async () => {
    const frames = await page.evaluate(() => window.recoveryProbe.frames)
    await button((await button('다시 확인').count()) ? '다시 확인' : '카메라 확인').click()
    await button('카메라 끄기').waitFor({ timeout: 16000 })
    assert.equal(await page.evaluate(() => window.recoveryProbe.frames), frames + 1)
  }
  const observe = async () => {
    const frames = await page.evaluate(() => window.recoveryProbe.frames)
    await button('입력 확인').click()
    await panel
      .getByRole('status')
      .filter({ hasText: '연속 입력 확인 중' })
      .waitFor({ timeout: 5000 })
    await page.waitForFunction((n) => window.recoveryProbe.frames >= n + 3, frames)
  }
  const recover = async () => {
    const calls = await page.evaluate(() => window.recoveryProbe.calls)
    await page.evaluate(() => {
      window.recoveryProbe.mode = 'normal'
    })
    assert.equal(await page.evaluate(() => window.recoveryProbe.calls), calls)
    await prepare()
    assert.equal(await page.evaluate(() => window.recoveryProbe.calls), calls + 1)
    await observe()
    assert.equal(page.workers().length, 1)
    await button('카메라 끄기').click()
    await button('카메라 확인').waitFor()
    await ended()
  }
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await button('카메라 확인').waitFor()
  for (const mode of ['capture-fault', 'worker-fault']) {
    phase = mode
    await prepare()
    await observe()
    const calls = await page.evaluate(() => window.recoveryProbe.calls)
    const faults = await page.evaluate(() => window.recoveryProbe.faultCalls)
    await page.evaluate((value) => {
      window.recoveryProbe.mode = value
    }, mode)
    await panel
      .getByRole('alert')
      .filter({ hasText: '카메라 입력을 확인하지 못했습니다' })
      .waitFor({ timeout: 8000 })
    await ended()
    assert.equal(await page.evaluate(() => window.recoveryProbe.faultCalls), faults + 1)
    assert.equal(await page.evaluate(() => window.recoveryProbe.calls), calls)
    assert.equal(await button('다시 확인').isDisabled(), false)
    await panel.screenshot({ path: `${scratch}/${label}-${mode}.png` })
    await recover()
    cases.push(
      `${mode}: controlled fault during actual running input → fixed error/resources ended → explicit prepare1/discard → separate input/actual SDK frames → stop`,
    )
  }
  phase = 'held-input-deadline'
  await prepare()
  await observe()
  const count = await page.evaluate(() => window.recoveryProbe.held.length)
  await page.evaluate(() => {
    window.recoveryProbe.mode = 'hold'
  })
  await page.waitForFunction((n) => window.recoveryProbe.held.length > n, count)
  phase = 'held-input-deadline/await-error'
  await panel
    .getByRole('alert')
    .filter({ hasText: '카메라 입력을 확인하지 못했습니다' })
    .waitFor({ timeout: 9000 })
  await ended()
  assert.equal(await page.evaluate(() => window.recoveryProbe.cancelled > 0), true)
  const beforeLate = await page.evaluate(() => window.recoveryProbe.frames)
  const callsBeforeRetry = await page.evaluate(() => window.recoveryProbe.calls)
  await page.evaluate(() => {
    window.recoveryProbe.mode = 'normal'
  })
  phase = 'held-input-deadline/fresh-prepare'
  await prepare()
  assert.equal(await page.evaluate(() => window.recoveryProbe.calls), callsBeforeRetry + 1)
  await page.evaluate(() => {
    const p = window.recoveryProbe
    for (const cb of p.held) cb(performance.now(), { presentedFrames: 900, mediaTime: 9 })
    p.held = []
  })
  assert.equal(await page.evaluate(() => window.recoveryProbe.frames), beforeLate + 1)
  assert.equal(
    await page.evaluate(() =>
      window.recoveryProbe.streams
        .at(-1)
        .getTracks()
        .every((t) => t.readyState === 'live'),
    ),
    true,
  )
  phase = 'held-input-deadline/fresh-observe'
  await observe()
  phase = 'held-input-deadline/fresh-stop'
  await button('카메라 끄기').click()
  await button('카메라 확인').waitFor()
  await ended()
  cases.push(
    'held decoded callback exceeds existing5000ms deadline → fixed error/ends → fresh explicit prepare/discard → late old callback cannot detach fresh camera/create frame → separate input/stop',
  )
  phase = 'cleanup-fault'
  await prepare()
  await observe()
  const faults = await page.evaluate(() => window.recoveryProbe.faultCalls)
  await page.evaluate(() => {
    window.recoveryProbe.mode = 'cleanup-fault'
  })
  await button('카메라 끄기').click()
  await panel
    .getByRole('alert')
    .filter({ hasText: '카메라 정리를 확인하지 못했습니다' })
    .waitFor({ timeout: 8000 })
  await ended()
  assert.equal(await page.evaluate(() => window.recoveryProbe.faultCalls), faults + 1)
  assert.equal(await button('다시 확인').isDisabled(), true)
  assert.equal(await button('입력 확인').count(), 0)
  const calls = await page.evaluate(() => window.recoveryProbe.calls)
  await page.getByRole('link', { name: '나가기', exact: true }).click()
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
  await page.getByRole('link', { name: '코칭 화면 구조 보기', exact: true }).click()
  await panel.getByRole('alert').filter({ hasText: '카메라 정리를 확인하지 못했습니다' }).waitFor()
  assert.equal(await button('다시 확인').isDisabled(), true)
  assert.equal(await page.evaluate(() => window.recoveryProbe.calls), calls)
  await ended()
  await panel.screenshot({ path: `${scratch}/${label}-cleanup.png` })
  cases.push(
    'controlled native stop fault after actual end → remaining Worker/source ended → fixed cleanup error; restart blocked also after actual router remount',
  )
  assert.equal(external, 0)
  assert.equal(avatars, 0)
  assert.equal(writes, 0)
  assert.deepEqual(errors, [])
  assert.deepEqual(hashes(), before)
  await context.close()
} catch (e) {
  failure = { phase, name: e.name, code: 'input-recovery-verification-failed' }
  // Only controlled fixture counters and fixed UI categories; never raw exception/DOM data.
  try {
    diagnostic = await page?.evaluate(() => {
      const p = window.recoveryProbe
      const text = document.querySelector('[aria-label="카메라 준비 확인"]')?.textContent ?? ''
      return {
        calls: p?.calls,
        frames: p?.frames,
        faults: p?.faultCalls,
        held: p?.held.length,
        cancelled: p?.cancelled,
        tracks: p?.streams.map((s) => s.getTracks().map((t) => t.readyState)),
        ui: text.includes('카메라 정리를 확인하지 못했습니다')
          ? 'cleanup-error'
          : text.includes('카메라 입력을 확인하지 못했습니다')
            ? 'frame-error'
            : text.includes('분석 연결을 준비하지 못했습니다')
              ? 'inference-error'
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
          'actual React/AuthProvider/Vite/Chrome/native fake camera/actual heavy SDK; test-only capture, Worker event, held callback and native stop faults',
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
          'physical camera/device failure/person accuracy/15fps',
          'avatar/clinical judgement/reference/public coaching',
          'real provider/SQL',
          'original startup P2 resolution',
          'Docker/TLS/deployment',
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
