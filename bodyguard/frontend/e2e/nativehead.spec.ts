// FR-U-04/FR-S-04·FR-R-03/NFR-07/08: native Chrome/API/SQL, fake camera/mail/motion gates.
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { mountNativeHeadAuthProbe } from './fixtures/nativeHeadAuthProbe'

const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const bundle = process.env.BODYGUARD_TEST_NATIVE_HEAD_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle ||
  !/^\/private\/tmp\/bodyguard-native-body-head-proof\.[A-Za-z0-9]+\/probe$/.test(bundle)
)
  throw new Error('Owned native auth harness required')
type Probe = ReturnType<typeof mountNativeHeadAuthProbe>
type PrivateWindow = Window & { nativeAuthProbe: Probe; cameraCalls: number; cspAttempts: number }
type Snapshot = ReturnType<Probe['snapshot']>
let posts = 0,
  external = 0,
  errors: string[] = []
const stages: { name: string; snapshot: Snapshot }[] = []
test.setTimeout(60_000)
test.beforeEach(async ({ context, page }) => {
  posts = 0
  external = 0
  errors = []
  stages.length = 0
  page.on('pageerror', (error) => errors.push(error.name))
  context.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/records/stretch' && request.method() === 'POST') posts++
  })
  await context.route('**/*', async (route) => {
    if (!route.request().url().startsWith(`${origin}/`)) {
      external++
      await route.abort()
      return
    }
    await route.continue()
  })
  await page.route('**/__private-native-head-probe.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/probe.js`),
    }),
  )
  for (const gender of ['male', 'female']) {
    await page.route(`**/__private-native-${gender}.glb`, (route) =>
      route.fulfill({
        contentType: 'model/gltf-binary',
        body: readFileSync(`${bundle}/../${gender}.glb`),
      }),
    )
  }
  await page.route('**/start', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'Content-Security-Policy': "connect-src 'self'" },
    })
  })
  await context.addInitScript(() => {
    const current = window as unknown as PrivateWindow
    current.cameraCalls = 0
    current.cspAttempts = 0
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.violatedDirective === 'connect-src') current.cspAttempts++
    })
    const native = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = (constraints) => {
      current.cameraCalls++
      return native(constraints)
    }
  })
})
test.afterEach(async ({ page, browser }, info) => {
  const final = await page.evaluate(async () => {
    const p = (window as unknown as PrivateWindow).nativeAuthProbe
    return p ? await p.close() : null
  })
  expect(external).toBe(0)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  const counters = await page.evaluate(() => {
    const w = window as unknown as PrivateWindow
    return { cameraCalls: w.cameraCalls, cspAttempts: w.cspAttempts }
  })
  if (final) {
    expect(final.tracksEnded && final.detached && final.allFramesClosed).toBe(true)
    expect(final.frameErrors).toBe(0)
    expect(final.frameCloses).toBe(final.frames)
    expect(final.nativeCloses).toBe(final.nativeCalls)
    expect(final.nativePeopleMax).toBe(0)
    expect(final.nativeFacesMax).toBe(0)
    expect(final.sameInput).toBe(true)
    expect(final.faceCalls).toBe(final.nativeCalls)
    expect(final.faceDetectorCloses).toBe(final.cameras)
    expect(final.productionAdapter).toBe(true)
    expect(final.cameraCloses).toBe(final.cameras)
    expect(final.detectorCloses).toBe(final.cameras)
    expect(final.models).toBe(0)
    expect(final.failures).toEqual([])
    expect(final.memory).toEqual(final.baseline)
  }
  const file = info.outputPath('native-head-summary.json')
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        browser: browser.version(),
        stages,
        final,
        counters,
        posts,
        external,
        errors,
        actualHuman: false,
        actualCamera: false,
        productPolicyApproved: false,
      },
      null,
      2,
    )}\n`,
  )
  await info.attach('native-head-summary', { path: file, contentType: 'application/json' })
})
async function join(context: BrowserContext) {
  const csrf = async () =>
    (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  const email = `native-auth-${randomUUID()}@example.com`
  const response = await context.request.post('/api/v1/auth/signup', {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
    data: { email, password: '실제 계정 native 통합 시험 비밀번호 12345' },
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
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.snapshot())
async function mark(page: Page, name: string) {
  const snapshot = await state(page)
  stages.push({ name, snapshot })
  return snapshot
}
async function mount(page: Page, gender: 'male' | 'female') {
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작', exact: true })).toBeVisible()
  await page.evaluate(async (gender) => {
    const path = '/__private-native-head-probe.js'
    const module = (await import(path)) as {
      mountNativeHeadAuthProbe: typeof mountNativeHeadAuthProbe
    }
    const text = document.createElement('p')
    text.textContent = '미완성 A37 · 가짜 카메라 · native 계정 시험 · 코칭 아님'
    document.body.append(text)
    const canvas = document.createElement('canvas')
    canvas.id = 'native-avatar'
    document.body.append(canvas)
    ;(window as unknown as PrivateWindow).nativeAuthProbe = module.mountNativeHeadAuthProbe(
      canvas,
      gender,
    )
  }, gender)
  await expect
    .poll(() => state(page))
    .toMatchObject({ auth: 'ready', hook: 'idle', cameras: 0, nativeCalls: 0, renderFrames: 0 })
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.prepare())
  expect(await state(page)).toMatchObject({
    hook: 'prepared',
    cameras: 0,
    nativeCalls: 0,
    models: 0,
  })
  expect(posts).toBe(0)
}
async function running(page: Page) {
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.start())
  await expect.poll(async () => (await state(page)).nativeCloses).toBeGreaterThanOrEqual(3)
  const value = await mark(page, 'native-running')
  expect(value.session).toBe('running')
  expect(value.resources?.status).toBe('running')
  expect(value.models).toBe(2)
  expect(value.framing).toEqual([true, true])
  expect(value.cameraLive && value.rawVideoHidden).toBe(true)
}
async function hold(page: Page) {
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.holdNextResult())
  await expect.poll(() => state(page)).toMatchObject({ held: true })
  const value = await mark(page, 'native-result-held')
  expect(value.nativeCloses).toBe(value.nativeCalls - 1)
  expect(value.heldStage).toBe('face')
  expect(value.faceCalls).toBe(value.nativeCalls)
}
async function revokedWhileHeld(page: Page) {
  const value = await mark(page, 'authority-revoked-while-native-held')
  expect(value.owned).toBe(false)
  expect(value.cameraLive && value.held).toBe(true)
  const renders = value.renderFrames,
    calls = value.nativeCalls
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  expect(await state(page)).toMatchObject({
    renderFrames: renders,
    nativeCalls: calls,
    detectorCloses: 0,
    faceDetectorCloses: 0,
    faceCalls: value.faceCalls,
    cameraCloses: 0,
  })
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.beginOldActions())
  expect(posts).toBe(0)
}
async function release(page: Page) {
  await page.evaluate(() =>
    (window as unknown as PrivateWindow).nativeAuthProbe.releaseHeldResult(),
  )
  await expect
    .poll(() => state(page))
    .toMatchObject({
      held: false,
      tracksEnded: true,
      detectorCloses: 1,
      faceDetectorCloses: 1,
      cameraCloses: 1,
      models: 0,
    })
  await mark(page, 'native-input-result-and-resources-closed')
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.finishOldActions())
  expect(posts).toBe(0)
}
for (const gender of ['male', 'female'] as const) {
  test(`${gender} native start→stop→own interrupted record`, async ({ page, context }, info) => {
    await join(context)
    await mount(page, gender)
    await running(page)
    await page
      .locator('#native-avatar')
      .screenshot({ path: info.outputPath(`avatar-${gender}.png`) })
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.stop())
    const stopped = await mark(page, 'explicit-user-stop')
    expect(stopped.verifiedMs).toBe(0)
    expect(stopped.tracksEnded).toBe(true)
    expect(posts).toBe(0)
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.save())
    expect(await state(page)).toMatchObject({ record: 'saved' })
    expect(posts).toBe(1)
    const rows = (await (await context.request.get('/api/v1/records/stretch')).json()).items
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: stopped.recordId,
      outcome: 'interrupted',
      observed_ms: 0,
      repetitions: 0,
      provenance: 'client-reported',
    })
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.close())
    const closed = await mark(page, 'native-closed-before-public-record')
    expect(closed.tracksEnded && closed.detached && closed.allFramesClosed).toBe(true)
    expect(closed.frameCloses).toBe(closed.frames)
    expect(closed.nativeCloses).toBe(closed.nativeCalls)
    expect(closed.memory).toEqual(closed.baseline)
    await page.goto(`/records/${rows[0].id}`)
    await expect(page.getByRole('heading', { name: '수행 기록 상세', exact: true })).toBeVisible()
    await expect(page.getByText('중단', { exact: true })).toBeVisible()
    await page.screenshot({
      path: info.outputPath(`native-record-${gender}.png`),
      fullPage: true,
    })
  })
  test(`${gender} native held result→same-account refresh→new owner explicit restart`, async ({
    page,
    context,
  }) => {
    await join(context)
    await mount(page, gender)
    await running(page)
    await hold(page)
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.refresh())
    await expect
      .poll(() => state(page))
      .toMatchObject({ auth: 'ready', hook: 'idle', owned: false })
    await revokedWhileHeld(page)
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.beginPrepare())
    await expect
      .poll(() => state(page))
      .toMatchObject({ hook: 'preparing', prepareFinished: false })
    expect(await state(page)).toMatchObject({ cameras: 1, held: true, owned: false })
    await release(page)
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.finishPrepare())
    expect(await state(page)).toMatchObject({ hook: 'prepared', cameras: 1 })
    const before = (await state(page)).nativeCalls
    await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.start())
    await expect.poll(async () => (await state(page)).nativeCloses).toBeGreaterThan(before + 2)
    expect(await state(page)).toMatchObject({
      cameras: 2,
      sessionGeneration: 1,
      session: 'running',
    })
    await mark(page, 'fresh-record-owner-fresh-native-bridge')
  })
  for (const revocation of ['logout', 'server401', 'pagehide', 'unmount'] as const) {
    test(`${gender} native held result→${revocation}→no old resume/save`, async ({
      page,
      context,
    }) => {
      await join(context)
      await mount(page, gender)
      await running(page)
      await hold(page)
      if (revocation === 'logout')
        await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.signOut())
      else if (revocation === 'server401') {
        const csrf = (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
        expect(
          (
            await context.request.post('/api/v1/auth/logout', {
              headers: { Origin: origin, 'X-CSRF-Token': csrf },
            })
          ).status(),
        ).toBe(204)
        await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.refresh())
      } else if (revocation === 'unmount')
        await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.unmount())
      else await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
      await expect.poll(() => state(page)).toMatchObject({ owned: false })
      if (revocation !== 'unmount') expect((await state(page)).hook).toBe('idle')
      await revokedWhileHeld(page)
      await release(page)
      await page.evaluate(() =>
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
      )
      expect(await state(page)).toMatchObject({
        cameras: 1,
        owned: false,
        nativePeopleMax: 0,
        verifiedMs: 0,
      })
      if (revocation === 'logout' || revocation === 'server401')
        expect((await context.request.get('/api/v1/me')).status()).toBe(401)
      await mark(page, 'no-automatic-restart')
    })
  }
}
