// FR-M-01/07·NFR-08: actual private React/SDK, native fake camera + explicit playback faults.
import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-camera-cancel\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
let browser,
  server,
  failure,
  phase = 'setup',
  external = 0,
  avatars = 0
const errors = [],
  cases = []
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/api/v1/me')
    res.end('{"id":"cancellation-fixture","email":"fixture@example.com"}')
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
  context.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(origin).origin) external++
    if (/\.glb(?:\?|$)/.test(request.url())) avatars++
  })
  await context.addInitScript(() => {
    const nativeCamera = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    const nativePlay = HTMLMediaElement.prototype.play
    window.cancellationProbe = { mode: 'stall', calls: 0, streams: [], held: [] }
    navigator.mediaDevices.getUserMedia = async (options) => {
      const p = window.cancellationProbe
      p.calls++
      const stream = await nativeCamera(options)
      p.streams.push(stream)
      if (p.mode === 'cleanup') {
        const track = stream.getVideoTracks()[0],
          stop = track.stop.bind(track)
        track.stop = () => {
          stop()
          throw Error('Controlled cleanup failure')
        }
      }
      return stream
    }
    HTMLMediaElement.prototype.play = function () {
      const p = window.cancellationProbe
      if (this.srcObject instanceof MediaStream && p.mode !== 'normal')
        return new Promise((resolve, reject) => {
          p.held.push({ resolve, reject })
        })
      return nativePlay.call(this)
    }
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.name))
  const button = (name) => page.getByRole('button', { name, exact: true })
  const stopped = async () => {
    await page.waitForFunction(() =>
      window.cancellationProbe.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    )
    assert.equal(page.workers().length, 0)
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
    assert.equal(await page.locator('video').count(), 0)
    assert.equal(await page.locator('canvas').count(), 1)
    assert.equal(await page.locator('canvas').isVisible(), false)
  }
  phase = 'explicit-prepare-cancel'
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await button('카메라 확인').waitFor()
  assert.equal(await page.evaluate(() => window.cancellationProbe.calls), 0)
  await button('카메라 확인').click()
  await page.waitForFunction(() => window.cancellationProbe.held.length === 1)
  await button('준비 취소').click()
  await button('카메라 확인').waitFor({ timeout: 5000 })
  await stopped()
  assert.equal(await page.evaluate(() => window.cancellationProbe.held.length), 1)
  cases.push(
    'actual React: cancelled stalled playback settled while controlled native-play promise remains pending; native tracks ended/SDK0',
  )
  await page.screenshot({ path: `${scratch}/${label}-cancelled.png`, fullPage: true })
  phase = 'explicit-retry-and-late-play'
  await page.evaluate(() => {
    window.cancellationProbe.mode = 'normal'
  })
  await button('카메라 확인').click()
  await button('카메라 끄기').waitFor({ timeout: 16000 })
  assert.equal(page.workers().length, 1)
  assert.equal(await button('코칭 준비 중').isDisabled(), true)
  await page.evaluate(() => {
    window.cancellationProbe.held[0].resolve()
  })
  assert.equal(await button('카메라 끄기').isVisible(), true)
  assert.equal(
    await page.evaluate(() =>
      window.cancellationProbe.streams
        .at(-1)
        .getTracks()
        .every((t) => t.readyState === 'live'),
    ),
    true,
  )
  await button('카메라 끄기').click()
  await button('카메라 확인').waitFor()
  await stopped()
  cases.push(
    'explicit retry: actual heavy body/face/hands Worker first inference; late old play resolution cannot detach fresh camera; stop closes all',
  )
  phase = 'late-play-rejection'
  await page.evaluate(() => {
    window.cancellationProbe.mode = 'stall'
  })
  await button('카메라 확인').click()
  await page.waitForFunction(() => window.cancellationProbe.held.length === 2)
  await button('준비 취소').click()
  await button('카메라 확인').waitFor({ timeout: 5000 })
  await page.evaluate(() => {
    window.cancellationProbe.held[1].reject(Error('Controlled late playback rejection'))
  })
  await stopped()
  cases.push('cancelled old play rejection consumed; no native/SDK readiness revival or pageerror')
  phase = 'router-retirement'
  await button('카메라 확인').click()
  await page.waitForFunction(() => window.cancellationProbe.held.length === 3)
  const calls = await page.evaluate(() => window.cancellationProbe.calls)
  await page.getByRole('link', { name: '나가기', exact: true }).click()
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
  await page.getByRole('link', { name: '코칭 화면 구조 보기', exact: true }).click()
  await button('카메라 확인').waitFor({ timeout: 5000 })
  await stopped()
  assert.equal(await page.evaluate(() => window.cancellationProbe.calls), calls)
  await page.evaluate(() => {
    window.cancellationProbe.held[2].resolve()
  })
  assert.equal(await button('카메라 확인').isVisible(), true)
  cases.push(
    'actual SPA exit/remount retires acquired stalled playback without releasing old play; no automatic new camera',
  )
  phase = 'cleanup-failure'
  await page.evaluate(() => {
    window.cancellationProbe.mode = 'cleanup'
  })
  await button('카메라 확인').click()
  await page.waitForFunction(() => window.cancellationProbe.held.length === 4)
  await button('준비 취소').click()
  await page.getByRole('alert').filter({ hasText: '카메라 정리' }).waitFor()
  assert.equal(await button('다시 확인').isDisabled(), true)
  await stopped()
  await page.evaluate(() => {
    window.cancellationProbe.held[3].resolve()
  })
  assert.equal(await button('다시 확인').isDisabled(), true)
  cases.push(
    'controlled stop fault after native end: fixed cleanup error, no raw exception/restart; camera actually ended',
  )
  assert.equal(external, 0)
  assert.equal(avatars, 0)
  assert.deepEqual(errors, [])
  await context.close()
} catch (error) {
  failure = { phase, name: error.name, code: 'camera-cancellation-verification-failed' }
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
          'actual React/AuthProvider/Chrome/Vite + native fake-camera/actual heavy SDK; controlled account and explicit stalled playback/stop faults',
        cases,
        external,
        avatars,
        errors,
        failure: failure ?? null,
        notProven: [
          'physical camera/person accuracy/performance',
          'real provider/SQL',
          'original startup P2 resolution',
          'avatar/clinical/public coaching',
          'Docker/TLS/deployment',
        ],
        ownedResourcesClosed: true,
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
