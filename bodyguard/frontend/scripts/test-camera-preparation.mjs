// FR-M-01/02/07·NFR-08: actual React + native fake-camera/SDK; controlled account API.
import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable, label, mode] = process.argv.slice(2)
assert(mode === undefined || mode === 'with-reference')
assert(/^\/private\/tmp\/bodyguard-camera-preparation\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
let account = 'ready',
  browser,
  failure,
  external = 0,
  avatars = 0
const errors = [],
  cases = []
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/api/v1/me') {
    res.writeHead(account === 'ready' ? 200 : 401)
    res.end(
      account === 'ready' ? '{"id":"preparation-fixture","email":"fixture@example.com"}' : '{}',
    )
  } else if (req.url === '/api/v1/auth/google/status') res.end('{"configured":false}')
  else {
    res.writeHead(404)
    res.end('{}')
  }
})
await new Promise((yes, no) => {
  api.once('error', no)
  api.listen(0, '127.0.0.1', yes)
})
const server = await createServer(
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
let visibleError,
  syntaxError = false
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    executablePath: executable,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    proxy: {
      server: 'http://127.0.0.1:1',
      bypass: `<-loopback>,${new URL(origin).host}`,
    },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  await context.addInitScript(() => {
    const actual = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.preparationProbe = { calls: 0, streams: [], mode: 'normal', release: null }
    navigator.mediaDevices.getUserMedia = async (options) => {
      const p = window.preparationProbe
      p.calls++
      if (p.mode === 'deny') throw new DOMException('Controlled denial', 'NotAllowedError')
      const stream = await actual(options)
      p.streams.push(stream)
      if (p.mode === 'hold')
        await new Promise((yes) => {
          p.release = yes
        })
      return stream
    }
  })
  const page = await context.newPage()
  context.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(origin).origin) external++
    if (/\.glb(?:\?|$)/.test(request.url())) avatars++
  })
  page.on('pageerror', (e) => errors.push(e.name))
  page.on('console', (msg) => {
    if (msg.text().includes('Cannot use import statement outside a module')) syntaxError = true
  })
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.preparationProbe.calls), 0)
  assert.equal(page.workers().length, 0)
  assert.equal(await page.locator('video,canvas').count(), 0)
  cases.push('initial: camera/worker/video/canvas0')
  const openReference = async () => {
    if (mode !== 'with-reference') return
    await page.getByRole('button', { name: '시범 미리보기', exact: true }).click()
    await page.getByText('시범 후보 · 자동 판정 없음', { exact: true }).waitFor({ timeout: 16000 })
  }
  await openReference()
  const panel = page.getByRole('region', { name: '카메라 준비 확인' })
  const ended = async () => {
    await page.waitForFunction(() =>
      window.preparationProbe.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    )
    await page.waitForFunction(() => localStorage.length + sessionStorage.length === 0)
    for (let i = 0; i < 50 && page.workers().length; i++)
      await new Promise((yes) => setTimeout(yes, 100))
    assert.equal(page.workers().length, 0)
  }
  await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
  try {
    await page.getByRole('button', { name: '카메라 끄기', exact: true }).waitFor({ timeout: 16000 })
  } catch (e) {
    visibleError = await panel.innerText()
    throw e
  }
  assert.equal(await page.getByRole('button', { name: '코칭 준비 중' }).isDisabled(), true)
  if (mode === 'with-reference') {
    await page.getByRole('button', { name: '수행 시범 단계 재생' }).click()
    await page.getByRole('button', { name: '입력 확인', exact: true }).click()
    await page.getByText('연속 입력 확인 중', { exact: true }).waitFor({ timeout: 16000 })
    await page.waitForTimeout(500)
    await page.getByText('내 움직임 연결 대기', { exact: true }).waitFor()
    cases.push(
      'actual own GLB guide + real heavy/face/hands SDK continuous fake-camera input; no invented user/clinical judgement',
    )
  }
  const inferenceWorker = page.workers()[0]
  assert(inferenceWorker)
  // Confirm native policy violations, not merely a refused proxy or empty request count.
  const blockedByPolicy = () =>
    new Promise((yes, no) => {
      const timer = setTimeout(() => no(new Error('Policy violation event missing')), 3000)
      addEventListener(
        'securitypolicyviolation',
        (event) => {
          clearTimeout(timer)
          yes(event.effectiveDirective)
        },
        { once: true },
      )
      void fetch('https://sdk-network-policy.invalid/blocked').catch(() => {})
    })
  assert.equal(await page.evaluate(blockedByPolicy), 'connect-src')
  assert.equal(await inferenceWorker.evaluate(blockedByPolicy), 'connect-src')
  cases.push(
    'actual document + actual SDK Worker external fetch blocked by native connect-src violation',
  )
  await page.getByRole('button', { name: '카메라 끄기', exact: true }).click()
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  await ended()
  cases.push(
    'native fake-camera + actual heavy body/face/hands Worker: first inference/discard → explicit stop, tracks/worker ended',
  )
  await page.screenshot({ path: `${scratch}/${label}-stopped-1440.png`, fullPage: true })
  await page.evaluate(() => {
    window.preparationProbe.mode = 'deny'
  })
  await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
  await panel.getByRole('alert').filter({ hasText: '카메라 권한을 허용' }).waitFor()
  await ended()
  await page.screenshot({ path: `${scratch}/${label}-denied-1440.png`, fullPage: true })
  cases.push('synthetic camera denial → fixed recoverable error, no worker')
  await page.evaluate(() => {
    window.preparationProbe.mode = 'hold'
  })
  await page.getByRole('button', { name: '다시 확인', exact: true }).click()
  await page.waitForFunction(() => window.preparationProbe.release !== null)
  await page.getByRole('button', { name: '준비 취소', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '정리 중', exact: true }).isDisabled(), true)
  await page.evaluate(() => {
    window.preparationProbe.mode = 'normal'
    window.preparationProbe.release()
  })
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  await ended()
  cases.push('synthetically held native stream: cancel → late result closed, no SDK readiness')
  await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
  await page.getByRole('button', { name: '카메라 끄기', exact: true }).waitFor({ timeout: 16000 })
  await page.getByRole('link', { name: '나가기', exact: true }).click()
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
  await ended()
  cases.push('fresh explicit native preparation → actual router exit releases')
  await page.getByRole('link', { name: '코칭 화면 구조 보기', exact: true }).click()
  await page.evaluate(() => {
    window.preparationProbe.mode = 'hold'
  })
  await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
  await page.waitForFunction(
    () =>
      window.preparationProbe.release !== null &&
      window.preparationProbe.streams
        .at(-1)
        .getTracks()
        .some((t) => t.readyState === 'live'),
  )
  const oldCalls = await page.evaluate(() => window.preparationProbe.calls)
  await page.getByRole('link', { name: '나가기', exact: true }).click()
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
  await page.getByRole('link', { name: '코칭 화면 구조 보기', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '정리 중', exact: true }).isDisabled(), true)
  assert.equal(await page.evaluate(() => window.preparationProbe.calls), oldCalls)
  await page.evaluate(() => {
    window.preparationProbe.mode = 'normal'
    window.preparationProbe.release()
    window.preparationProbe.release = null
  })
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor()
  await ended()
  assert.equal(await page.evaluate(() => window.preparationProbe.calls), oldCalls)
  cases.push(
    'actual SPA route remount waits for synthetically held native permission; late stream ends, no auto reacquisition',
  )
  await page.setViewportSize({ width: 800, height: 1000 })
  const cameraButton = page.getByRole('button', { name: '카메라 확인', exact: true })
  await cameraButton.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  assert.equal(await cameraButton.evaluate((button) => button === document.activeElement), true)
  assert.equal(
    await cameraButton.evaluate((button) => getComputedStyle(button).outlineWidth),
    '3px',
  )
  // Narrow desktop window, not mobile browser or actual browser 200% zoom.
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const box = await cameraButton.boundingBox()
  assert(box && box.width >= 44 && box.height >= 44)
  await page.screenshot({ path: `${scratch}/${label}-stopped-800.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await openReference()
  await page.getByRole('button', { name: '카메라 확인', exact: true }).click()
  await page.getByRole('button', { name: '카메라 끄기', exact: true }).waitFor({ timeout: 16000 })
  account = 'guest'
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  await ended()
  cases.push(
    'actual AuthProvider controlled401 refresh → private UI removed, native resources ended',
  )
  assert.equal(external, 0)
  assert.equal(avatars, mode === 'with-reference' ? 4 : 0)
  assert.equal(errors.length, 0)
  await context.close()
} catch (e) {
  failure = { name: e.name, message: e.message.split('\n')[0] }
} finally {
  await browser?.close()
  await server.close()
  api.closeAllConnections()
  await new Promise((yes) => api.close(yes))
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual React/Chrome/Vite + actual SDK/native fake camera; controlled account API and explicitly synthetic fault/401 triggers',
        referenceStage: mode === 'with-reference',
        cases,
        external,
        avatars,
        errors,
        syntaxError,
        visibleError,
        failure: failure ?? null,
        notProven: [
          'real participants/body accuracy',
          'real permission popup denial',
          'SQL/provider auth',
          'avatar/GLB/deformation',
          'clinical judgement/startup P2 resolution',
          'public coaching/production deployment',
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
