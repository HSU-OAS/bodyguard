// FR-M-01/07·FR-U-04·FR-S-04/NFR-08: actual native adapter/API, synthetic device/events.
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { mountNativeRecoveryProbe } from './fixtures/nativeRecoveryProbe'

const origin = 'http://localhost:4173',
  mailbox = process.env.BODYGUARD_TEST_MAILBOX,
  bundle = process.env.BODYGUARD_TEST_NATIVE_RECOVERY_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle ||
  !/^\/private\/tmp\/bodyguard-native-recovery-proof\.[A-Za-z0-9]+\/probe$/.test(bundle)
)
  throw new Error('Owned native recovery harness required')
type Probe = ReturnType<typeof mountNativeRecoveryProbe>
type Controls = {
  holdCamera(): void
  releaseCamera(): void
  disconnect(): void
  snapshot(): {
    calls: number
    streams: number
    held: boolean
    tracksEnded: boolean
    detached: boolean
    hidden: boolean
    connected: boolean
    cspAttempts: number
  }
}
type PrivateWindow = Window & { nativeRecoveryProbe: Probe; nativeRecoveryControls: Controls }
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.snapshot())
const camera = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryControls.snapshot())
let posts = 0,
  external = 0,
  errors: string[] = []
const stages: unknown[] = []
test.setTimeout(60_000)
test.beforeEach(async ({ page, context }) => {
  posts = 0
  external = 0
  errors = []
  stages.length = 0
  page.on('pageerror', (e) => errors.push(e.name))
  context.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/v1/records/stretch' && r.method() === 'POST') posts++
  })
  await context.route('**/*', async (r) => {
    if (!r.request().url().startsWith(`${origin}/`)) {
      external++
      await r.abort()
    } else await r.continue()
  })
  await page.route('**/__private-native-recovery-probe.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: readFileSync(`${bundle}/probe.js`) }),
  )
  for (const gender of ['male', 'female'])
    await page.route(`**/__private-recovery-${gender}.glb`, (r) =>
      r.fulfill({
        contentType: 'model/gltf-binary',
        body: readFileSync(`${bundle}/../${gender}.glb`),
      }),
    )
  await page.route('**/start', async (r) => {
    const response = await r.fetch()
    await r.fulfill({
      response,
      headers: { ...response.headers(), 'Content-Security-Policy': "connect-src 'self'" },
    })
  })
  await context.addInitScript(() => {
    const w = window as unknown as PrivateWindow,
      streams: MediaStream[] = [],
      videos: HTMLVideoElement[] = []
    let calls = 0,
      hold = false,
      held = false,
      release: (() => void) | undefined,
      cspAttempts = 0
    const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      calls++
      const stream = await native(constraints)
      streams.push(stream)
      if (!hold) return stream
      hold = false
      held = true
      return new Promise<MediaStream>((resolve) => {
        release = () => {
          held = false
          release = undefined
          resolve(stream)
        }
      })
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject')
    if (!descriptor?.set || !descriptor.get) throw new Error('Native media descriptor required')
    const setter = descriptor.set
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      ...descriptor,
      set(value) {
        if (this instanceof HTMLVideoElement && !videos.includes(this)) videos.push(this)
        setter.call(this, value)
      },
    })
    document.addEventListener('securitypolicyviolation', (e) => {
      if (e.violatedDirective === 'connect-src') cspAttempts++
    })
    w.nativeRecoveryControls = {
      holdCamera() {
        hold = true
      },
      releaseCamera() {
        release?.()
      },
      disconnect() {
        for (const s of streams)
          for (const track of s.getVideoTracks()) {
            if (track.readyState === 'live') {
              track.stop()
              track.dispatchEvent(new Event('ended'))
            }
          }
      },
      snapshot: () => ({
        calls,
        streams: streams.length,
        held,
        tracksEnded: streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')),
        detached: videos.every((v) => v.srcObject === null),
        hidden: videos.every((v) => v.hidden),
        connected: videos.some((v) => v.isConnected),
        cspAttempts,
      }),
    }
  })
})
test.afterEach(async ({ page, browser }, info) => {
  const final = await page.evaluate(async () => {
    const w = window as unknown as PrivateWindow
    w.nativeRecoveryControls.releaseCamera()
    return w.nativeRecoveryProbe ? await w.nativeRecoveryProbe.close() : null
  })
  const native = await camera(page)
  expect(native.tracksEnded && native.detached && native.hidden).toBe(true)
  expect(native.connected).toBe(false)
  expect(external).toBe(0)
  expect(posts).toBe(0)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  if (final) {
    expect(final.allFramesClosed).toBe(true)
    expect(final.frameCloses).toBe(final.frames)
    expect(final.models).toBe(0)
    expect(final.memory).toEqual(final.baseline)
  }
  const file = info.outputPath('native-recovery-summary.json')
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        browser: browser.version(),
        stages,
        final,
        native,
        posts,
        external,
        errors,
        actualHuman: false,
        actualCamera: false,
        actualPermissionPopup: false,
        actualUnplug: false,
        productPolicyApproved: false,
      },
      null,
      2,
    )}\n`,
  )
  await info.attach('native-recovery-summary', { path: file, contentType: 'application/json' })
})
async function join(context: BrowserContext) {
  const csrf = async () =>
    (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  const email = `native-recovery-${randomUUID()}@example.com`
  const response = await context.request.post('/api/v1/auth/signup', {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
    data: { email, password: '합성 계정 복구 시험 비밀번호 12345' },
  })
  expect(response.status()).toBe(202)
  let code = ''
  await expect
    .poll(() => {
      code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
      return code
    })
    .toMatch(/^[0-9]{6}$/)
  expect(
    (
      await context.request.post('/api/v1/auth/verify', {
        headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
        data: { challenge_id: (await response.json()).challenge_id, code },
      })
    ).status(),
  ).toBe(201)
}
async function mark(page: Page, name: string) {
  stages.push({ name, state: await state(page), native: await camera(page) })
}
async function mount(page: Page, gender: 'male' | 'female') {
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작', exact: true })).toBeVisible()
  await page.evaluate(async (gender) => {
    const path = '/__private-native-recovery-probe.js',
      module = (await import(path)) as { mountNativeRecoveryProbe: typeof mountNativeRecoveryProbe }
    const label = document.createElement('p')
    label.textContent = '내부 복구 시험 · 미완성 A37 · 가짜 카메라 · 코칭 아님'
    document.body.append(label)
    const canvas = document.createElement('canvas')
    canvas.id = 'native-recovery-avatar'
    document.body.append(canvas)
    ;(window as unknown as PrivateWindow).nativeRecoveryProbe = module.mountNativeRecoveryProbe(
      canvas,
      gender,
    )
  }, gender)
  await expect
    .poll(() => state(page))
    .toMatchObject({ auth: 'ready', hook: 'idle', frames: 0, renderFrames: 0 })
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.prepare())
  expect((await camera(page)).calls).toBe(0)
  expect((await state(page)).hook).toBe('prepared')
}
async function restart(page: Page) {
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.prepare())
  const before = await camera(page)
  const beforeFrames = (await state(page)).frames
  expect((await state(page)).hook).toBe('prepared')
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
  await expect.poll(async () => (await state(page)).frames).toBeGreaterThan(beforeFrames + 3)
  expect(await state(page)).toMatchObject({
    session: 'running',
    models: 2,
    framing: [true, true],
    verifiedMs: 0,
    resources: { cameraError: null },
  })
  expect((await camera(page)).calls).toBe(before.calls + 1)
  await mark(page, 'explicit-native-restart')
}
async function cameraPermission(context: BrowserContext, page: Page) {
  const protocol = await context.newCDPSession(page)
  const { targetInfo } = await protocol.send('Target.getTargetInfo')
  if (!targetInfo.browserContextId) {
    await protocol.detach()
    throw new Error('Owned browser context required')
  }
  // Keep the owning CDP session until the native request/retry finishes: detaching resets it.
  return {
    async set(setting: 'denied' | 'granted') {
      await protocol.send('Browser.setPermission', {
        permission: { name: 'camera' },
        setting,
        origin,
        browserContextId: targetInfo.browserContextId,
      })
      await expect
        .poll(() =>
          page.evaluate(
            async () =>
              (await navigator.permissions.query({ name: 'camera' as PermissionName })).state,
          ),
        )
        .toBe(setting)
    },
    dispose: () => protocol.detach(),
  }
}
for (const gender of ['male', 'female'] as const) {
  test(`${gender} browser permission denied→explicit retry`, async ({ page, context }, info) => {
    await join(context)
    await mount(page, gender)
    const permission = await cameraPermission(context, page)
    try {
      await permission.set('denied')
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
      await expect
        .poll(() => state(page))
        .toMatchObject({
          session: 'ended',
          reason: 'camera-error',
          resources: { cameraError: 'denied' },
          models: 0,
          frames: 0,
        })
      expect((await camera(page)).streams).toBe(0)
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.save())
      expect(posts).toBe(0)
      await mark(page, 'browser-denied-no-ready-or-record')
      await permission.set('granted')
      await restart(page)
      const preview = info.outputPath(`${gender}-restarted-avatar-only.png`)
      await page.locator('#native-recovery-avatar').screenshot({ path: preview })
      await info.attach('WIP-avatar-only-no-camera', { path: preview, contentType: 'image/png' })
    } finally {
      await permission.dispose()
    }
  })
  test(`${gender} delayed native camera→cancel→late reclaim→explicit retry`, async ({
    page,
    context,
  }) => {
    await join(context)
    await mount(page, gender)
    await page.evaluate(() => {
      const w = window as unknown as PrivateWindow
      w.nativeRecoveryControls.holdCamera()
      void w.nativeRecoveryProbe.start()
    })
    await expect.poll(() => camera(page)).toMatchObject({ held: true, streams: 1, calls: 1 })
    await page.evaluate(() => {
      const p = (window as unknown as PrivateWindow).nativeRecoveryProbe
      p.beginCancel()
      p.beginPrepare()
    })
    await expect
      .poll(() => state(page))
      .toMatchObject({
        owned: false,
        hook: 'preparing',
        prepareFinished: false,
        frames: 0,
        models: 0,
      })
    expect((await camera(page)).calls).toBe(1)
    await mark(page, 'cancel-and-replacement-wait-native-camera')
    await page.evaluate(() =>
      (window as unknown as PrivateWindow).nativeRecoveryControls.releaseCamera(),
    )
    await page.evaluate(async () => {
      const p = (window as unknown as PrivateWindow).nativeRecoveryProbe
      await p.finishCancel()
      await p.finishPrepare()
    })
    expect(await camera(page)).toMatchObject({ tracksEnded: true, calls: 1, detached: true })
    await mark(page, 'late-native-stream-reclaimed-no-auto-start')
    await restart(page)
  })
  test(`${gender} native track lost→stop→explicit retry`, async ({ page, context }) => {
    await join(context)
    await mount(page, gender)
    await restart(page)
    await page.evaluate(() =>
      (window as unknown as PrivateWindow).nativeRecoveryControls.disconnect(),
    )
    await expect
      .poll(() => state(page))
      .toMatchObject({ session: 'ended', reason: 'inference-error', models: 0 })
    await expect.poll(() => camera(page)).toMatchObject({ tracksEnded: true, detached: true })
    await mark(page, 'native-track-stop-synthetic-ended-event')
    const frames = (await state(page)).frames
    await restart(page)
    await expect.poll(async () => (await state(page)).frames).toBeGreaterThan(frames + 3)
  })
  test(`${gender} GLB HTTP404→native cleanup→explicit retry`, async ({ page, context }) => {
    await join(context)
    await mount(page, gender)
    const pattern = `**/__private-recovery-${gender}.glb`,
      handler = (r: import('@playwright/test').Route) =>
        r.fulfill({ status: 404, body: 'Fixture asset unavailable' })
    await page.route(pattern, handler)
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
    await expect
      .poll(() => state(page))
      .toMatchObject({ session: 'ended', reason: 'asset-error', models: 0, frames: 0 })
    await expect.poll(() => camera(page)).toMatchObject({ tracksEnded: true, detached: true })
    await mark(page, 'asset-http404-no-ready-or-record')
    await page.unroute(pattern, handler)
    await restart(page)
  })
}
