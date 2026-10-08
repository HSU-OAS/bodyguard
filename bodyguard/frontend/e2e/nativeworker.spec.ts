// S6.11: actual Chrome/SDK/API/isolated SQL, fake camera/mail/plan and unfinished avatars.
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { mountNativeHeadAuthProbe } from './fixtures/nativeHeadAuthProbe'

const origin = 'http://localhost:4173',
  mailbox = process.env.BODYGUARD_TEST_MAILBOX,
  bundle = process.env.BODYGUARD_TEST_NATIVE_FEEDBACK_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle ||
  !/^\/private\/tmp\/bodyguard-native-feedback-proof\.[A-Za-z0-9]+\/probe-worker$/.test(bundle)
)
  throw new Error('Owned worker auth harness required')
type Probe = ReturnType<typeof mountNativeHeadAuthProbe>
type WindowProbe = Window & { nativeAuthProbe: Probe }
let posts = 0,
  external = 0,
  workerStarts = 0,
  workerCloses = 0
let errors: string[] = []
let delayedPreparation = false
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.snapshot())
test.setTimeout(60_000)
test.beforeEach(async ({ context, page }) => {
  posts = external = workerStarts = workerCloses = 0
  errors = []
  delayedPreparation = false
  page.on('pageerror', (e) => errors.push(e.name))
  page.on('worker', (worker) => {
    workerStarts++
    worker.on('close', () => workerCloses++)
  })
  context.on('request', (request) => {
    if (
      new URL(request.url()).pathname === '/api/v1/records/stretch' &&
      request.method() === 'POST'
    )
      posts++
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
  const workers = [
    ...new Set(
      readFileSync(`${bundle}/probe.js`, 'utf8').match(/nativeInference\.worker-[\w-]+\.js/g) ?? [],
    ),
  ]
  if (workers.length !== 1) throw new Error('Exact worker bundle required')
  await page.route(`**/assets/${workers[0]}`, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: readFileSync(`${bundle}/assets/${workers[0]}`),
      headers: { 'Content-Security-Policy': "connect-src 'self'" },
    }),
  )
  for (const gender of ['male', 'female'])
    await page.route(`**/__private-native-${gender}.glb`, (route) =>
      route.fulfill({
        contentType: 'model/gltf-binary',
        body: readFileSync(`${bundle}/../${gender}.glb`),
      }),
    )
  await page.route('**/start', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'Content-Security-Policy': "connect-src 'self'" },
    })
  })
})
test.afterEach(async ({ page, browser }, info) => {
  const before = await state(page),
    final = await page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.close())
  await expect.poll(() => workerCloses).toBe(workerStarts)
  expect(final.tracksEnded && final.detached && final.allFramesClosed).toBe(true)
  expect(final.frameCloses).toBe(final.frames)
  expect(final.frameErrors).toBe(0)
  expect(final.models).toBe(0)
  expect(final.failures).toEqual([])
  expect(final.memory).toEqual(final.baseline)
  // Main realm instrumentation MUST NOT count actual SDK inference in the worker realm.
  expect(final.nativeCalls).toBe(0)
  expect(final.faceCalls).toBe(0)
  expect(final.handCalls).toBe(0)
  expect(final.verifiedMs).toBe(0)
  expect(external).toBe(0)
  expect(errors).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  writeFileSync(
    info.outputPath('worker-owner-summary.json'),
    JSON.stringify(
      {
        browser: browser.version(),
        before,
        final,
        posts,
        external,
        errors,
        workerStarts,
        workerCloses,
        delayedPreparation,
        actualHuman: false,
        actualCamera: false,
        productPolicyApproved: false,
      },
      null,
      2,
    ),
  )
})
async function join(context: BrowserContext) {
  const csrf = async () =>
    (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  const email = `worker-${randomUUID()}@example.com`
  const response = await context.request.post('/api/v1/auth/signup', {
    headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
    data: { email, password: 'Worker 가상 계정 검증 비밀번호 12345' },
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
async function mount(page: Page, gender: 'male' | 'female') {
  await page.goto('/start')
  await page.evaluate(async (gender) => {
    const path = '/__private-native-head-probe.js',
      module = (await import(path)) as { mountNativeHeadAuthProbe: typeof mountNativeHeadAuthProbe }
    const canvas = document.createElement('canvas')
    document.body.append(canvas)
    const label = document.createElement('p')
    label.textContent = '미완성 아바타 · 가짜 카메라 · Worker 내부 검증'
    document.body.append(label)
    ;(window as unknown as WindowProbe).nativeAuthProbe = module.mountNativeHeadAuthProbe(
      canvas,
      gender,
      {
        cameraReferences: { left: [0, 0, 0, 1], right: [0, 0, 0, 1] },
        sceneFromCamera: [0, 0, 0, 1],
      },
      false,
      false,
      false,
      false,
      false,
      true,
    )
  }, gender)
  await expect
    .poll(() => state(page))
    .toMatchObject({ auth: 'ready', hook: 'idle', cameras: 0, workerConfigured: true })
  await page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.prepare())
  expect(await state(page)).toMatchObject({ hook: 'prepared', cameras: 0, models: 0 })
}
async function running(page: Page, before = 0) {
  await page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.start())
  await expect.poll(async () => (await state(page)).frameCloses).toBeGreaterThanOrEqual(before + 3)
  expect(await state(page)).toMatchObject({
    session: 'running',
    models: 2,
    framing: [true, true],
    verifiedMs: 0,
    rawVideoHidden: true,
  })
  expect(page.workers()).toHaveLength(1)
}
for (const gender of ['male', 'female'] as const) {
  test(`${gender} worker→two avatars→stop→own interrupted record`, async ({ page, context }) => {
    await join(context)
    await mount(page, gender)
    await running(page)
    await page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.stop())
    expect(await state(page)).toMatchObject({ tracksEnded: true, verifiedMs: 0 })
    await page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.save())
    expect(posts).toBe(1)
    const rows = (await (await context.request.get('/api/v1/records/stretch')).json()).items
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      outcome: 'interrupted',
      observed_ms: 0,
      repetitions: 0,
      provenance: 'client-reported',
    })
  })
  test(`${gender} worker preparation→logout→no stale resume/save`, async ({ page, context }) => {
    await join(context)
    await mount(page, gender)
    // Test-only delayed real model fetch makes preparation cancellation deterministic.
    // The SDK/bytes remain actual; this is NOT normal-start performance evidence.
    let held = false,
      release!: () => void
    const barrier = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/models/pose_landmarker_lite.task', async (route) => {
      held = true
      await barrier
      await route.continue()
    })
    delayedPreparation = true
    try {
      await page.evaluate(() => {
        void (window as unknown as WindowProbe).nativeAuthProbe.start()
      })
      await expect.poll(() => held).toBe(true)
      expect(await state(page)).toMatchObject({
        hook: 'prepared',
        resources: { status: 'preparing' },
      })
      const logout = page.evaluate(() =>
        (window as unknown as WindowProbe).nativeAuthProbe.signOut(),
      )
      await expect.poll(() => state(page)).toMatchObject({ owned: false, tracksEnded: true })
      release()
      await logout
    } finally {
      release()
    }
    await expect
      .poll(() => state(page))
      .toMatchObject({ owned: false, tracksEnded: true, models: 0 })
    await page.evaluate(async () => {
      await (window as unknown as WindowProbe).nativeAuthProbe.resume()
      await (window as unknown as WindowProbe).nativeAuthProbe.save()
    })
    expect(posts).toBe(0)
  })
  test(`${gender} worker running→same-account refresh→explicit new owner`, async ({
    page,
    context,
  }) => {
    await join(context)
    await mount(page, gender)
    await running(page)
    const before = (await state(page)).frameCloses
    await page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.refresh())
    await expect
      .poll(() => state(page))
      .toMatchObject({ auth: 'ready', hook: 'idle', owned: false, tracksEnded: true, models: 0 })
    await page.evaluate(() => (window as unknown as WindowProbe).nativeAuthProbe.prepare())
    expect(await state(page)).toMatchObject({ hook: 'prepared', cameras: 1 })
    await running(page, before)
    expect(await state(page)).toMatchObject({ cameras: 2, verifiedMs: 0 })
    expect(posts).toBe(0)
  })
}
