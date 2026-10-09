// FR-U-04/FR-S-04·FR-R-03/NFR-07/08: native Chrome/API/SQL, fake camera/mail/motion gates.
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import type { mountNativeHeadAuthProbe } from './fixtures/nativeHeadAuthProbe'

const origin = 'http://localhost:4173'
const mailbox = process.env.BODYGUARD_TEST_MAILBOX
const withFeedback = Boolean(process.env.BODYGUARD_TEST_NATIVE_FEEDBACK_PROBE)
const withNeck = process.env.BODYGUARD_TEST_NATIVE_NECK === '1'
const withRenderPreparation = process.env.BODYGUARD_TEST_RENDER_PREPARATION === '1'
const withReference = withFeedback || Boolean(process.env.BODYGUARD_TEST_NATIVE_REFERENCE_PROBE)
const withHands = withReference || Boolean(process.env.BODYGUARD_TEST_NATIVE_HANDS_PROBE)
const bundle =
  process.env.BODYGUARD_TEST_NATIVE_FEEDBACK_PROBE ??
  process.env.BODYGUARD_TEST_NATIVE_REFERENCE_PROBE ??
  process.env.BODYGUARD_TEST_NATIVE_HANDS_PROBE ??
  process.env.BODYGUARD_TEST_NATIVE_HEAD_PROBE
if (
  !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  !bundle ||
  !(
    withFeedback
      ? /^\/private\/tmp\/bodyguard-native-feedback-proof\.[A-Za-z0-9]+\/probe-[a-z0-9-]+$/
      : withReference
        ? /^\/private\/tmp\/bodyguard-native-reference-proof\.[A-Za-z0-9]+\/probe-[a-z0-9-]+$/
        : withHands
          ? /^\/private\/tmp\/bodyguard-native-hands-proof\.[A-Za-z0-9]+\/probe$/
          : /^\/private\/tmp\/bodyguard-native-body-head-proof\.[A-Za-z0-9]+\/probe$/
  ).test(bundle)
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
  if (withReference)
    await page.route('**/__private-native-reference-fixture.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: readFileSync(`${bundle}/../authored-fixture.json`),
      }),
    )
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
  const beforeClose = await page.evaluate(() => {
    const p = (window as unknown as PrivateWindow).nativeAuthProbe
    return p ? p.snapshot() : null
  })
  writeFileSync(
    info.outputPath('before-close.json'),
    JSON.stringify({ stages, beforeClose }, null, 2),
  )
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
    if (withNeck)
      expect(final).toMatchObject({ neckStatus: 'unavailable', neckCurrentGeneration: true })
    expect(final.tracksEnded && final.detached && final.allFramesClosed).toBe(true)
    expect(final.frameErrors).toBe(0)
    expect(final.frameCloses).toBe(final.frames)
    expect(final.nativeCloses).toBe(final.nativeCalls)
    expect(final.nativePeopleMax).toBe(0)
    expect(final.nativeFacesMax).toBe(0)
    expect(final.sameInput).toBe(true)
    expect(final.faceCalls).toBe(final.nativeCalls)
    expect(final.faceDetectorCloses).toBe(
      withRenderPreparation ? final.faceDetectorInitializations : final.cameras,
    )
    expect(final.handCalls).toBe(withHands ? final.nativeCalls : 0)
    expect(final.handDetectorCloses).toBe(
      withRenderPreparation ? final.handDetectorInitializations : withHands ? final.cameras : 0,
    )
    expect(final.nativeHandsMax).toBe(0)
    expect(final.productionAdapter).toBe(true)
    expect(final.cameraCloses).toBe(final.cameras)
    expect(final.detectorCloses).toBe(
      withRenderPreparation ? final.detectorInitializations : final.cameras,
    )
    expect(final.models).toBe(0)
    expect(final.failures).toEqual([])
    expect(final.memory).toEqual(final.baseline)
    expect(final.capturedImageFailures).toBe(0)
    expect(final.capturedNeckChecks).toBe(final.feedbackEvaluations)
  }
  const file = info.outputPath(withHands ? 'native-hands-summary.json' : 'native-head-summary.json')
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
async function mount(
  page: Page,
  gender: 'male' | 'female',
  withAdaptive = false,
  withTiming = false,
  withTrunk = false,
) {
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: '내 몸을 위한 시작', exact: true })).toBeVisible()
  await page.evaluate(
    async ({
      gender,
      withHands,
      withReference,
      withFeedback,
      withAdaptive,
      withTiming,
      withTrunk,
      withNeck,
      withRenderPreparation,
    }) => {
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
        // Synthetic display basis only. A blank fake camera cannot calibrate anatomy.
        withHands
          ? {
              cameraReferences: { left: [0, 0, 0, 1], right: [0, 0, 0, 1] },
              sceneFromCamera: [0, 0, 0, 1],
            }
          : undefined,
        withReference,
        withFeedback,
        withAdaptive,
        withTiming,
        withTrunk,
        false,
        withNeck,
        withRenderPreparation,
      )
    },
    {
      gender,
      withHands,
      withReference,
      withFeedback,
      withAdaptive,
      // FR-M-07/NFR-08: a global TEST opt-in includes callers that pass false explicitly.
      withTiming: withTiming || process.env.BODYGUARD_TEST_NATIVE_STARTUP_TIMING === '1',
      withTrunk,
      withNeck,
      withRenderPreparation,
    },
  )
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
  expect(value.handsConfigured).toBe(withHands)
  expect(value.handCalls).toBe(withHands ? value.nativeCalls : 0)
  expect(value.nativeHandsMax).toBe(0)
  if (withNeck) expect(value.neckStatus).toBe('unavailable')
  if (withRenderPreparation) {
    expect(value.rendererReady).toBeGreaterThan(0)
    expect(value.gpuPreparationDraws).toBe(value.rendererReady)
  }
}
async function hold(page: Page) {
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.holdNextResult())
  await expect.poll(() => state(page)).toMatchObject({ held: true })
  const value = await mark(page, 'native-result-held')
  expect(value.nativeCloses).toBe(value.nativeCalls - 1)
  expect(value.heldStage).toBe(withHands ? 'hands' : 'face')
  expect(value.faceCalls).toBe(value.nativeCalls)
  expect(value.handCalls).toBe(withHands ? value.nativeCalls : 0)
}
async function revokedWhileHeld(page: Page) {
  const value = await mark(page, 'authority-revoked-while-native-held')
  expect(value.owned).toBe(false)
  expect(value.cameraLive && value.held).toBe(true)
  if (withNeck) expect(value.neckStatus).toBe('unavailable')
  if (withReference)
    expect(
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.oldCommand()),
    ).toBe(false)
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
    handDetectorCloses: 0,
    handCalls: value.handCalls,
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
      handDetectorCloses: withHands ? 1 : 0,
      cameraCloses: 1,
      models: 0,
    })
  await mark(page, 'native-input-result-and-resources-closed')
  await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.finishOldActions())
  expect(posts).toBe(0)
}
for (const gender of ['male', 'female'] as const) {
  if (withNeck)
    test(`${gender} native neck captured aspect→presence→retirement→new generation`, async ({
      page,
      context,
    }) => {
      await join(context)
      await mount(page, gender)
      await running(page)
      expect(await state(page)).toMatchObject({
        neckConfigured: true,
        neckStatus: 'unavailable',
        nativePeopleMax: 0,
      })
      await mark(page, 'native-blank-no-observation')
      const mode = (mode: 'error' | 'crop' | 'multiple' | 'none') =>
        page.evaluate(
          (mode) => (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode(mode),
          mode,
        )
      await mode('error')
      await expect
        .poll(() => state(page))
        .toMatchObject({
          neckStatus: 'available',
          neckMatchesAuthoredAspect: true,
          neckCurrentGeneration: true,
          verifiedMs: 0,
        })
      await mark(page, 'authored-positive-same-captured-aspect-not-clinical')
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.setNeckPresenceHidden(true),
      )
      await expect
        .poll(() => state(page))
        .toMatchObject({ neckStatus: 'unavailable', verifiedMs: 0 })
      await mark(page, 'low-presence-not-removed-in-native-handoff')
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.setNeckPresenceHidden(false),
      )
      for (const value of ['crop', 'multiple', 'none'] as const) {
        await mode(value)
        await expect
          .poll(() => state(page))
          .toMatchObject({ neckStatus: 'unavailable', verifiedMs: 0 })
        await mark(page, `generated-${value}-no-old-observation`)
        await mode('error')
        await expect
          .poll(() => state(page))
          .toMatchObject({
            neckStatus: 'available',
            neckMatchesAuthoredAspect: true,
            verifiedMs: 0,
          })
      }
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.pause())
      expect(await state(page)).toMatchObject({
        session: 'paused',
        neckStatus: 'unavailable',
        tracksEnded: true,
        models: 0,
      })
      await mark(page, 'pause-removes-current-observation')
      await mode('none')
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.resume())
      await expect
        .poll(() => state(page))
        .toMatchObject({
          session: 'running',
          sessionGeneration: 2,
          neckStatus: 'unavailable',
          cameras: 2,
        })
      await mode('error')
      await expect
        .poll(() => state(page))
        .toMatchObject({
          neckStatus: 'available',
          neckMatchesAuthoredAspect: true,
          neckCurrentGeneration: true,
          verifiedMs: 0,
        })
      await mark(page, 'fresh-generation-new-input-only')
      expect(posts).toBe(0)
    })
  if (withRenderPreparation)
    for (const revocation of ['logout', 'pagehide'] as const)
      test(`${gender} renderer preparation→${revocation}→late compile cannot start/save`, async ({
        page,
        context,
      }) => {
        await join(context)
        await mount(page, gender)
        await page.evaluate(() => {
          const p = (window as unknown as PrivateWindow).nativeAuthProbe
          p.holdNextRenderPreparation()
          p.beginStart()
        })
        await expect
          .poll(() => state(page))
          .toMatchObject({
            renderPreparationHeld: true,
            rendererPreparations: 1,
            rendererReady: 0,
            gpuPreparationDraws: 0,
            renderFrames: 0,
            nativeCalls: 0,
            cameras: 1,
          })
        await mark(page, 'actual-compile-started-test-barrier-not-gpu-hang')
        if (revocation === 'logout')
          await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.signOut())
        else await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
        await expect.poll(() => state(page)).toMatchObject({ owned: false })
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.releaseHeldRenderPreparation(),
        )
        await expect
          .poll(() => state(page))
          .toMatchObject({
            renderPreparationHeld: false,
            rendererReady: 0,
            gpuPreparationDraws: 0,
            renderFrames: 0,
            nativeCalls: 0,
            cameraCloses: 1,
            tracksEnded: true,
            models: 0,
          })
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.finishStart(),
        )
        expect(posts).toBe(0)
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.beginOldActions(),
        )
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.finishOldActions(),
        )
        expect(posts).toBe(0)
        await mark(page, 'no-late-ready-render-observation-record-or-automatic-restart')
      })
  if (withFeedback)
    test(`${gender} native first-start stage timing without raw input`, async ({
      page,
      context,
    }, info) => {
      await join(context)
      await mount(page, gender, false, true)
      await running(page)
      const timing = (await mark(page, 'native-startup-timed')).startupTiming
      expect(timing).not.toBeNull()
      if (!timing) throw new Error('Native startup timing unavailable')
      writeFileSync(info.outputPath('native-startup-timing.json'), JSON.stringify(timing, null, 2))
      expect(timing.invalid).toBe(false)
      expect(timing.events.length).toBeLessThanOrEqual(30)
      for (const stage of [
        'camera',
        'body-sdk',
        'face-sdk',
        'hands-sdk',
        'avatar',
        'render',
        'body',
        'face',
        'hands',
        'result',
      ]) {
        const rows = timing.events.filter((row) => row.stage === stage)
        expect(rows.length).toBeGreaterThan(0)
        expect(rows.length).toBeLessThanOrEqual(3)
        for (const row of rows) {
          expect(row.startMs).toBeGreaterThanOrEqual(0)
          expect(row.endMs).not.toBeNull()
          expect(row.endMs).toBeGreaterThanOrEqual(row.startMs)
        }
      }
      const first = (stage: string) => timing.events.find((row) => row.stage === stage)
      expect(first('body-sdk')?.startMs).toBeGreaterThanOrEqual(first('camera')?.endMs ?? Infinity)
      expect(first('avatar')?.startMs).toBeGreaterThanOrEqual(first('camera')?.endMs ?? Infinity)
      expect(first('render')?.startMs).toBeGreaterThanOrEqual(first('hands-sdk')?.endMs ?? Infinity)
      expect(first('render')?.startMs).toBeGreaterThanOrEqual(first('avatar')?.endMs ?? Infinity)
      expect(first('body')?.startMs).toBeGreaterThanOrEqual(first('render')?.endMs ?? Infinity)
      expect(timing.events.filter((row) => row.stage === 'result')).toHaveLength(3)
      expect(posts).toBe(0)
    })
  if (withFeedback) {
    test(`${gender} native aggregate trunk→required endpoints→fresh generation→own record`, async ({
      page,
      context,
    }, info) => {
      await join(context)
      await mount(page, gender, false, false, true)
      await running(page)
      expect(await state(page)).toMatchObject({
        trunkConfigured: true,
        highlighted: false,
        nativePeopleMax: 0,
      })
      await mark(page, 'native-blank-miss-not-generated-positive')
      for (const pose of ['side', 'forward'] as const) {
        await page.evaluate((pose) => {
          const p = (window as unknown as PrivateWindow).nativeAuthProbe
          p.setTrunkPose(pose)
          p.setFeedbackMode('error')
        }, pose)
        await expect.poll(async () => (await state(page)).trunkDirectionError).toBeLessThan(0.002)
        expect(await state(page)).toMatchObject({
          highlighted: true,
          verifiedMs: 0,
          nativePeopleMax: 0,
          protectedTrunkStructureUnchanged: true,
        })
        // Preserve an avatar-only preview even if the following pixel assertion fails.
        await page.locator('#native-avatar').screenshot({
          path: info.outputPath(`trunk-${gender}-${pose}.png`),
        })
        await expect
          .poll(() =>
            page.evaluate(
              () => (window as unknown as PrivateWindow).nativeAuthProbe.pixelCounts().right,
            ),
          )
          .toBeGreaterThan(0)
        expect(
          await page.evaluate(() =>
            (window as unknown as PrivateWindow).nativeAuthProbe.pixelCounts(),
          ),
        ).toMatchObject({ sampled: true, left: 0, error: 0 })
        await mark(page, `generated-trunk-${pose}-current-colour-not-correctness`)
      }
      for (const endpoint of [11, 12, 23, 24] as const) {
        await page.evaluate(
          (endpoint) =>
            (window as unknown as PrivateWindow).nativeAuthProbe.setTrunkHiddenEndpoint(endpoint),
          endpoint,
        )
        await expect.poll(() => state(page)).toMatchObject({ highlighted: false, verifiedMs: 0 })
        await expect
          .poll(() =>
            page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.pixelCounts()),
          )
          .toMatchObject({ sampled: true, left: 0, right: 0, error: 0 })
        await mark(page, `generated-hidden-${endpoint}-no-trunk-colour-or-success`)
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.setTrunkHiddenEndpoint(null),
        )
        await expect.poll(() => state(page)).toMatchObject({ highlighted: true, verifiedMs: 0 })
      }
      for (const mode of ['multiple', 'none'] as const) {
        await page.evaluate(
          (mode) => (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode(mode),
          mode,
        )
        await expect.poll(() => state(page)).toMatchObject({ highlighted: false, verifiedMs: 0 })
        await mark(page, `generated-${mode}-trunk-cleared`)
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode('error'),
        )
        await expect.poll(() => state(page)).toMatchObject({ highlighted: true, verifiedMs: 0 })
      }
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.pause())
      expect(await state(page)).toMatchObject({ models: 0, tracksEnded: true, verifiedMs: 0 })
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.resume())
      await expect
        .poll(() => state(page))
        .toMatchObject({ sessionGeneration: 2, highlighted: true, verifiedMs: 0 })
      await expect.poll(async () => (await state(page)).trunkDirectionError).toBeLessThan(0.002)
      await mark(page, 'fresh-trunk-owner-and-current-observation')
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.stop())
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.save())
      const stopped = await mark(page, 'explicit-trunk-stop-own-record')
      expect(stopped.record).toBe('saved')
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
    })
    test(`${gender} native aggregate trunk→held result→logout cannot revive colour/save`, async ({
      page,
      context,
    }) => {
      await join(context)
      await mount(page, gender, false, false, true)
      await running(page)
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode('error'),
      )
      await expect.poll(() => state(page)).toMatchObject({ highlighted: true, verifiedMs: 0 })
      await hold(page)
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.signOut())
      await expect
        .poll(() => state(page))
        .toMatchObject({
          owned: false,
          highlighted: false,
          canvasHidden: true,
          verifiedMs: 0,
        })
      await revokedWhileHeld(page)
      await release(page)
      expect(posts).toBe(0)
      await mark(page, 'retired-trunk-generation-no-old-render-or-save')
    })
  }
  if (withFeedback)
    test(`${gender} native current error code→authored correction→different cause→occlusion`, async ({
      page,
      context,
    }, info) => {
      await join(context)
      await mount(page, gender, true)
      await running(page)
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode('error'),
      )
      await expect
        .poll(() => state(page))
        .toMatchObject({
          adaptiveConfigured: true,
          highlighted: true,
          phase: 'seeking-target',
          verifiedMs: 0,
        })
      // Wait for many actual deliveries so the unchanged neutral pose cannot falsely pass
      // before an incorrectly selected ordinary phase clip has had time to move.
      const before = (await state(page)).feedbackEvaluations
      await expect
        .poll(async () => (await state(page)).feedbackEvaluations)
        .toBeGreaterThan(before + 20)
      await expect.poll(async () => (await state(page)).referenceTargetError).toBeLessThan(2e-6)
      await mark(page, 'synthetic-raised-code-authored-neutral-guide')
      await page
        .locator('#native-avatar')
        .screenshot({ path: info.outputPath(`adaptive-${gender}-raised.png`) })
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackCode('direction'),
      )
      await expect.poll(async () => (await state(page)).referenceTargetError).toBeLessThan(2e-6)
      expect(await state(page)).toMatchObject({
        expectedCorrectionId: 'fixture-align',
        verifiedMs: 0,
        highlighted: true,
        referenceMoved: true,
      })
      await mark(page, 'synthetic-other-code-authored-different-guide')
      await page
        .locator('#native-avatar')
        .screenshot({ path: info.outputPath(`adaptive-${gender}-direction.png`) })
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode('crop'),
      )
      await expect
        .poll(() => state(page))
        .toMatchObject({ highlighted: false, verifiedMs: 0, expectedCorrectionId: null })
      await mark(page, 'synthetic-occluded-current-error-cleared-not-success')
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.pause())
      expect(await state(page)).toMatchObject({ models: 0, tracksEnded: true, verifiedMs: 0 })
      await mark(page, 'current-guide-pause-resources-closed')
    })
  if (withFeedback)
    test(`${gender} native delivery→current session→surface feedback→crop/multiple/none→recovery`, async ({
      page,
      context,
    }, info) => {
      await join(context)
      await mount(page, gender)
      await running(page)
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode('error'),
      )
      await expect
        .poll(() => state(page))
        .toMatchObject({
          highlighted: true,
          feedbackConfigured: true,
          canvasHidden: false,
          verifiedMs: 0,
          phase: 'seeking-target',
        })
      const highlighted = await mark(page, 'generated-native-error-with-current-owner-state')
      expect(highlighted.syntheticBodyDeliveries).toBeGreaterThan(0)
      expect(highlighted.feedbackEvaluations).toBeGreaterThan(0)
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as PrivateWindow).nativeAuthProbe.pixelCounts().right,
          ),
        )
        .toBeGreaterThan(0)
      const pixels = await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.pixelCounts(),
      )
      expect(pixels).toMatchObject({ sampled: true, left: 0, error: 0 })
      writeFileSync(info.outputPath('feedback-pixels.json'), JSON.stringify(pixels))
      await page
        .locator('#native-avatar')
        .screenshot({ path: info.outputPath(`feedback-${gender}-error.png`) })
      for (const mode of ['crop', 'multiple', 'none'] as const) {
        const previous = (await state(page)).feedbackEvaluations
        await page.evaluate(
          (mode) => (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode(mode),
          mode,
        )
        await expect
          .poll(async () => (await state(page)).feedbackEvaluations)
          .toBeGreaterThan(previous)
        await expect.poll(() => state(page)).toMatchObject({ highlighted: false, verifiedMs: 0 })
        await expect
          .poll(() =>
            page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.pixelCounts()),
          )
          .toMatchObject({ sampled: true, left: 0, right: 0, error: 0 })
        await mark(page, `generated-${mode}-no-highlight-or-pass`)
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode('error'),
        )
        await expect.poll(() => state(page)).toMatchObject({ highlighted: true, verifiedMs: 0 })
      }
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.pause())
      expect(await state(page)).toMatchObject({ models: 0, tracksEnded: true, verifiedMs: 0 })
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.resume())
      await expect
        .poll(() => state(page))
        .toMatchObject({ sessionGeneration: 2, highlighted: true, verifiedMs: 0 })
      await mark(page, 'fresh-native-generation-new-error-not-old-frame')
    })
  if (withReference)
    test(`${gender} actual owned phase→pause→fresh generation reference`, async ({
      page,
      context,
    }, info) => {
      await join(context)
      await mount(page, gender)
      await running(page)
      const pulse = async (ms: number) => {
        const end = Date.now() + ms
        while (Date.now() < end) {
          await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.tick())
          await page.waitForTimeout(80)
        }
      }
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.observe('start'),
      )
      await pulse(1300)
      const seeking = await mark(page, 'owned-seeking-target-guide')
      expect(seeking).toMatchObject({
        phase: 'seeking-target',
        verifiedMs: 0,
        referenceMoved: true,
        userUnchanged: true,
      })
      expect(seeking.referenceTargetError).not.toBeNull()
      expect(seeking.referenceTargetError as number).toBeLessThan(2e-6)
      await page
        .locator('#native-avatar')
        .screenshot({ path: info.outputPath(`reference-${gender}-seeking.png`) })
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.observe('target'),
      )
      await pulse(1300)
      const holding = await mark(page, 'owned-holding-guide-with-no-synthesized-progress')
      expect(holding).toMatchObject({ phase: 'holding', verifiedMs: 0, userUnchanged: true })
      expect(holding.referenceTargetError as number).toBeLessThan(2e-6)
      await page.waitForTimeout(700)
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.markReference(),
      )
      await page.waitForTimeout(300)
      await expect.poll(() => state(page)).toMatchObject({ referenceFrozen: true, verifiedMs: 0 })
      await mark(page, 'cue-expired-guide-frozen')
      await page.evaluate(() =>
        (window as unknown as PrivateWindow).nativeAuthProbe.observe('target'),
      )
      expect(await state(page)).toMatchObject({ phase: 'waiting-return', verifiedMs: 2000 })
      await pulse(1300)
      const returned = await mark(page, 'owned-return-guide')
      expect(returned.referenceTargetError as number).toBeLessThan(2e-6)
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.pause())
      expect(await state(page)).toMatchObject({
        session: 'paused',
        models: 0,
        tracksEnded: true,
        verifiedMs: 2000,
      })
      await page.evaluate(() => (window as unknown as PrivateWindow).nativeAuthProbe.resume())
      await expect
        .poll(() => state(page))
        .toMatchObject({ session: 'running', sessionGeneration: 2, cameras: 2 })
      await pulse(300)
      expect(await state(page)).toMatchObject({
        phase: 'waiting-start',
        verifiedMs: 2000,
        userUnchanged: true,
      })
      await mark(page, 'fresh-generation-no-old-clip-resume')
    })
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
    expect(closed.sameInput).toBe(true)
    expect(closed.faceCalls).toBe(closed.nativeCalls)
    expect(closed.faceDetectorCloses).toBe(closed.cameras)
    expect(closed.handCalls).toBe(withHands ? closed.nativeCalls : 0)
    expect(closed.handDetectorCloses).toBe(withHands ? closed.cameras : 0)
    expect(closed.nativeHandsMax).toBe(0)
    expect(closed.nativeFacesMax).toBe(0)
    expect(closed.productionAdapter).toBe(true)
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
      if (withFeedback) {
        await page.evaluate(() =>
          (window as unknown as PrivateWindow).nativeAuthProbe.setFeedbackMode('error'),
        )
        await expect
          .poll(() => state(page))
          .toMatchObject({ highlighted: true, canvasHidden: false, verifiedMs: 0 })
      }
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
      if (withFeedback)
        expect(await state(page)).toMatchObject({ canvasHidden: true, highlighted: false })
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
