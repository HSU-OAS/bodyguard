// FR-M-02/07 / S2.M4: actual Chrome UI with synthetic hook, then separate real SDK/no-person camera.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const destination = process.argv[2]
assert(destination?.startsWith('/private/tmp/bodyguard-observer-framing-proof.'))
const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(destination, 'browser')
mkdirSync(proof, { recursive: false })
const origin = 'http://127.0.0.1:4198'
const sources = [
  'src/pages/MeasureDemoPage.tsx',
  'src/posture/framingTrial.ts',
  'scripts/test-framing-trial-browser.mjs',
]
const hashes = () =>
  Object.fromEntries(
    sources.map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(resolve(root, file)))
        .digest('hex'),
    ]),
  )
const report = {
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  source: hashes(),
  provenance:
    'Development UI / actual Chrome / controlled synthetic measurement hook. SDK camera regression is separate and has no person. Not participant, observer independence, clinical accuracy or release validation.',
  flows: [],
  screens: [],
  errors: [],
  externalRequests: [],
  storageWrites: 0,
  controlledCameraCalls: 0,
}
const sink = createServer((socket) => socket.destroy())
await new Promise((accept, reject) => {
  sink.once('error', reject)
  sink.listen(0, '127.0.0.1', accept)
})
const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4198', '--strictPort'],
  { cwd: root, stdio: 'ignore' },
)
let browser
async function context(controlled) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    permissions: ['camera'],
    reducedMotion: 'reduce',
  })
  await ctx.exposeBinding('__trialStorage', () => report.storageWrites++)
  await ctx.addInitScript(() => {
    Storage.prototype.setItem = () => {
      void window.__trialStorage()
    }
  })
  await ctx.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      report.externalRequests.push(url.origin)
      return route.abort('blockedbyclient')
    }
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
    return route.continue()
  })
  if (controlled) {
    await ctx.exposeBinding('__trialCamera', () => report.controlledCameraCalls++)
    await ctx.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => {
        void window.__trialCamera()
        return Promise.reject(new Error('Camera prohibited in controlled UI test'))
      }
      window.__framingFixture = {
        status: 'running',
        error: null,
        fpsLimit: 30,
        framingMode: 'seated',
        model: 'full',
        handsEnabled: false,
        faceEnabled: false,
        stats: {
          fps: 30,
          inferenceMs: 10,
          handMs: null,
          faceMs: null,
          detected: true,
          confidence: 0.9,
          delegate: 'CPU',
          hint: null,
          gesture: null,
        },
        poseRef: {
          current: {
            sampledAt: performance.now(),
            personCount: 1,
            image: Array.from({ length: 33 }, (_, i) => ({
              x: 0.481234,
              y: i >= 23 ? 1.3 : 0.5,
              z: 0,
              visibility: 0.9,
            })),
            world: null,
            hands: [],
            face: null,
          },
        },
      }
    })
    await ctx.route('**/src/pose/useMeasurement.ts*', async (route) => {
      const original = await route.fetch()
      const text = await original.text()
      const path = text.match(/from ["']([^"']*\/react(?:\.js)?[^"']*)["']/)?.[1]
      assert(path?.startsWith('/node_modules/.vite/deps/react'))
      const body = `import React from ${JSON.stringify(path)};
const {useState} = React;
export function useMeasurement() {
  const [,update] = useState(0);
  const fixture = window.__framingFixture;
  const change = (key,value) => {fixture[key]=value; update(n=>n+1)};
  return {...fixture, setFpsLimit:v=>change('fpsLimit',v), setFramingMode:v=>change('framingMode',v), setModel:v=>change('model',v), setHandsEnabled:v=>change('handsEnabled',v), setFaceEnabled:v=>change('faceEnabled',v), start:()=>change('status','running'), stop:()=>change('status','idle')};
}`
      await route.fulfill({ status: 200, contentType: 'text/javascript', body })
    })
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', (error) => report.errors.push(error.message))
  return { ctx, page }
}
async function newFrame(page, result = 'sufficient') {
  await page.evaluate((kind) => {
    const pose = window.__framingFixture.poseRef.current
    pose.sampledAt = performance.now()
    pose.personCount = kind === 'multiple' ? 2 : 1
    pose.image =
      kind === 'unavailable'
        ? null
        : Array.from({ length: 33 }, (_, i) => ({
            x: 0.481234,
            y: i >= 23 ? 1.3 : 0.5,
            z: 0,
            visibility: 0.9,
            presence: kind === 'insufficient' && i === 11 ? 0 : 0.9,
          }))
  }, result)
}
async function screen(page, name, width) {
  await page.setViewportSize({ width, height: 1100 })
  const panel = page.getByRole('region', { name: '동작 촬영 검증' })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  assert(!(await panel.innerText()).includes('0.481234'))
  assert(await panel.getByRole('combobox', { name: '관찰자 판단' }).isVisible())
  // Panel only: never capture camera pixels or raw coordinate/metric panels.
  await panel.screenshot({ path: resolve(proof, `${name}-${width}.png`) })
  report.screens.push({
    name,
    width,
    horizontalOverflow: false,
    rawCoordinatesDisplayed: false,
    syntheticInput: true,
  })
}
try {
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error('Development server exited')
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    if (i === 79) throw new Error('Development server unavailable')
    await delay(100)
  }
  const address = sink.address()
  assert(address && typeof address !== 'string')
  browser = await chromium.launch({
    executablePath:
      process.env.BODYGUARD_TEST_CHROME ||
      '/Users/gongman/.browser-driver-manager/chrome/mac_arm-154.0.8037.57/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    headless: true,
    proxy: { server: `http://127.0.0.1:${address.port}`, bypass: '127.0.0.1,localhost' },
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  })
  report.chrome = browser.version()
  {
    const { ctx, page } = await context(true)
    await page.goto(`${origin}/dev/measure`)
    const panel = page.getByRole('region', { name: '동작 촬영 검증' })
    const label = panel.getByRole('combobox', { name: '관찰자 판단' })
    const record = panel.getByRole('button', { name: '현재 프레임 기록' })
    const begin = panel.getByRole('button', { name: '튜닝 마치고 검증 시작' })
    assert(await begin.isDisabled())
    await label.focus()
    await label.press('Tab')
    assert(await record.evaluate((element) => document.activeElement === element))
    await label.selectOption('sufficient')
    assert.equal(await label.inputValue(), 'sufficient')
    await newFrame(page)
    await record.press('Enter')
    assert.equal(await label.inputValue(), 'unrated')
    assert.equal(await panel.getByRole('listitem').count(), 1)
    assert((await panel.getByRole('listitem').innerText()).endsWith(' · 일치'))
    await label.selectOption('insufficient')
    await newFrame(page)
    await record.click()
    assert((await panel.getByRole('listitem').nth(1).innerText()).endsWith(' · 불일치'))
    await screen(page, 'tuning', 1440)
    await panel.getByRole('checkbox', { name: '튜닝에 쓰지 않은 촬영 조건' }).check()
    await begin.click()
    assert(await label.evaluate((element) => document.activeElement === element))
    await record.click()
    assert((await panel.getByRole('status').innerText()).includes('관찰자 판단을 먼저'))
    await label.selectOption('sufficient')
    await record.click()
    assert((await panel.getByRole('status').innerText()).includes('검증 시작 뒤 새 프레임'))
    await newFrame(page)
    await record.click()
    assert.equal(await panel.getByRole('listitem').count(), 3)
    await label.selectOption('sufficient')
    await record.click()
    assert((await panel.getByRole('status').innerText()).includes('이미 사용한 프레임'))
    await label.selectOption('multiple')
    await newFrame(page, 'multiple')
    await record.click()
    await label.selectOption('sufficient')
    await newFrame(page, 'unavailable')
    await record.click()
    assert((await panel.getByRole('listitem').nth(4).innerText()).endsWith('대조 보류'))
    report.flows.push(
      'Keyboard Tab from labelled native select to record and Enter activation; options selected by Playwright / categorical mismatch / explicit freeze / unlabelled and reused frames rejected / fresh matching and multiple / unavailable held',
    )
    for (const width of [1440, 1024, 800]) await screen(page, 'validation', width)
    await page.getByRole('combobox', { name: '안내 기준 (데모용)' }).selectOption('standing')
    assert(await record.isDisabled())
    await page.getByRole('combobox', { name: '안내 기준 (데모용)' }).selectOption('seated')
    assert(await record.isDisabled())
    assert.equal(await panel.getByRole('listitem').count(), 5)
    await screen(page, 'settings-invalidated', 800)
    await panel.getByRole('button', { name: '기록 지우기' }).click()
    assert.equal(await panel.getByRole('listitem').count(), 0)
    assert(await record.isEnabled())
    assert(!(await panel.getByRole('checkbox', { name: '튜닝에 쓰지 않은 촬영 조건' }).isChecked()))
    assert(await label.evaluate((element) => document.activeElement === element))
    report.flows.push(
      'Settings change and restoration remain blocked / records preserved / explicit clear returns to fresh tuning',
    )
    await ctx.close()
  }
  report.controlledExternalRequests = report.externalRequests.length
  {
    const { ctx, page } = await context(false)
    await page.addInitScript(() => {
      window.__trialTracks = []
      const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await open(constraints)
        window.__trialTracks.push(...stream.getTracks())
        return stream
      }
    })
    await page.goto(`${origin}/dev/measure`)
    // Lower model is a test condition, not a production/default performance change.
    await page.getByRole('combobox', { name: '포즈 모델 (데모용)' }).selectOption('lite')
    await page.getByRole('combobox', { name: '손가락 인식 (데모용)' }).selectOption('off')
    await page.getByRole('combobox', { name: '얼굴 인식 (데모용)' }).selectOption('off')
    await page.getByRole('button', { name: '측정 시작', exact: true }).click()
    await page.getByRole('button', { name: '측정 중지', exact: true }).waitFor({ timeout: 45000 })
    await page.waitForFunction(
      () => Number(document.querySelector('[data-testid="fps"]')?.textContent) > 0,
      undefined,
      { timeout: 15000 },
    )
    await page.getByRole('button', { name: '현재 프레임 기록' }).click()
    assert(
      !(await page.getByRole('listitem').innerText()).includes('촬영 범위 충족 (동작 성공 아님)'),
    )
    await page.getByRole('button', { name: '측정 중지', exact: true }).click()
    assert(
      await page.evaluate(() =>
        window.__trialTracks.every((track) => track.readyState === 'ended'),
      ),
    )
    await page.getByRole('button', { name: '측정 시작', exact: true }).click()
    await page.getByRole('button', { name: '측정 중지', exact: true }).waitFor({ timeout: 45000 })
    await page.getByRole('link', { name: '서비스로 돌아가기' }).click()
    await page.waitForURL(`${origin}/`)
    report.cameraExitBeforeCleanup = await page.evaluate(() =>
      window.__trialTracks.map((track) => track.readyState),
    )
    await page.waitForFunction(
      () =>
        window.__trialTracks.length === 2 &&
        window.__trialTracks.every((track) => track.readyState === 'ended'),
      undefined,
      { timeout: 5000 },
    )
    assert(
      await page.evaluate(
        () =>
          window.__trialTracks.length === 2 &&
          window.__trialTracks.every((track) => track.readyState === 'ended'),
      ),
    )
    report.sdkCamera = {
      realSDK: true,
      camera: 'no-person browser fake device',
      model: 'lite',
      hands: false,
      face: false,
      startStopRestartExit: true,
      endedTracks: 2,
      noFrameScreenshots: true,
    }
    await ctx.close()
  }
  assert.equal(report.storageWrites, 0)
  assert.equal(report.controlledCameraCalls, 0)
  assert.deepEqual(report.errors, [])
  assert.deepEqual(hashes(), report.source)
  report.pass = true
} catch (error) {
  report.pass = false
  report.failure = error.stack
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
  await new Promise((accept) => {
    if (server.exitCode !== null) accept()
    else server.once('exit', accept)
  })
  await new Promise((accept) => sink.close(accept))
  writeFileSync(resolve(proof, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
}
