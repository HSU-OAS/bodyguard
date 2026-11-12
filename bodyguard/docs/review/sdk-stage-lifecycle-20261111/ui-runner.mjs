// FR-M-01/02/07·FR-S-04: real Worker/SDK and GLBs with Chrome's blank fake device; no person.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as http } from 'node:http'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import { instrumentWorkerFailure } from '../e2e/fixtures/nativeWorkerDiagnosticsTransform.ts'
import config from '../vite.config.ts'
import { SDK_DEV_POLICY } from './sdk-network-policy.ts'

const [scratch, label, selected = 'neck-side', diagnostics] = process.argv.slice(2)
assert(diagnostics === undefined || diagnostics === 'diagnostics')
assert(selected === 'neck-side' || selected === 'shoulder-shrug')
assert(
  /^\/private\/tmp\/bodyguard-(?:neck-(?:workspace|surface)|shrug-workspace)\.[A-Za-z0-9]+$/.test(
    scratch,
  ),
)
const entry =
    selected === 'shoulder-shrug'
      ? 'e2e/fixtures/shrugWorkspaceEntry.tsx'
      : 'e2e/fixtures/neckWorkspaceEntry.tsx',
  preparation = selected === 'shoulder-shrug' ? '양쪽 · 준비' : '왼쪽 · 준비'
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const files = [
  'src/coaching/neckWorkspacePlayback.ts',
  'src/pages/NeckCoachingRun.tsx',
  'src/pose/workerInference.ts',
  'src/pose/workerInferenceRuntime.ts',
  'src/pose/workerNativeEngine.ts',
  'src/coaching/ownedPlaybackResources.ts',
  'src/avatar/ownedPosePlayback.ts',
  'src/pose/videoPoseSource.ts',
  'src/pose/nativeInference.worker.ts',
  'src/avatar/referenceStage.ts',
  'src/avatar/neckSurfaceFeedback.ts',
  'src/avatar/projectedSurfaceRegions.ts',
  'src/avatar/surfaceFeedback.ts',
  'src/avatar/observedShoulderElevation.ts',
  'src/avatar/observedPoseRig.ts',
  'src/avatar/observedComparison.ts',
  'src/stretch/shrugCandidateClassifier.ts',
  'src/coaching/shrugCandidateFeedback.ts',
  'src/posture/shoulderShrugObservation.ts',
  'src/posture/thresholds.ts',
  'e2e/fixtures/shrugWorkspaceEntry.tsx',
  'e2e/fixtures/shrugWorkspaceSource.ts',
  'e2e/fixtures/shrugCandidate.ts',
  'e2e/fixtures/neckWorkspaceEntry.tsx',
  'e2e/fixtures/neckWorkspaceSource.ts',
  'scripts/local-candidate-ui-20261111.mjs',
  '/private/tmp/bodyguard-worker-candidate-20261111.js',
  'e2e/fixtures/nativeCleanupDiagnostics.ts',
  'e2e/fixtures/nativeWorkerDiagnosticsTransform.ts',
  'vite.config.ts',
  'pnpm-lock.yaml',
]
const snapshot = () =>
  Object.fromEntries(
    files.map((file) => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]),
  )
const before = snapshot(),
  cases = [],
  errors = [],
  paths = []
let rafReceiver,
  browser,
  page,
  failure = null,
  failureCleanupObservation = 'not-requested',
  writes = 0,
  external = 0
const api = http((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') writes++
  if (req.url === '/api/v1/me')
    res.end('{"id":"11111111-1111-4111-8111-111111111111","email":"fixture@example.com"}')
  else if (req.url === '/api/v1/auth/csrf') res.end(JSON.stringify({ csrf_token: 'a'.repeat(64) }))
  else {
    res.statusCode = 404
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
    plugins: [
      {
        name: 'candidate-protocol-only',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === './pages/CoachingPage' && importer?.split('?')[0] === resolve('src/App.tsx'))
            return resolve(entry)
        },
        transform(source, id) {
          if (diagnostics && id.split('?')[0] === resolve('src/pose/workerInference.ts'))
            return instrumentWorkerFailure(source)
          if (!diagnostics || id.split('?')[0] !== resolve('src/coaching/neckWorkspacePlayback.ts'))
            return
          const names = [
            'prepareReferenceStage',
            'closeCamera',
            'createVideoPoseSource',
            'createWorkerPoseInference',
          ]
          for (const name of names) {
            const original = new RegExp(`(?<=import \\{[^}]*)(?<![A-Za-z])${name}(?=[, }])`)
            assert(original.test(source), `Missing diagnostic import ${name}`)
            source = source.replace(original, `${name} as native_${name}`)
          }
          return (
            source +
            `
import { cleanupNote, traceCleanup } from '/e2e/fixtures/nativeCleanupDiagnostics.ts';
const prepareReferenceStage = async (...args) => traceCleanup('avatars', await native_prepareReferenceStage(...args));
const createVideoPoseSource = (...args) => traceCleanup('source', native_createVideoPoseSource(...args));
const createWorkerPoseInference = async (...args) => traceCleanup('inference', await native_createWorkerPoseInference(...args));
const closeCamera = (...args) => {
  cleanupNote('camera', 'start');
  try { const value = native_closeCamera(...args); cleanupNote('camera', 'clean'); return value }
  catch (error) { cleanupNote('camera', 'failed'); throw error }
};`
          )
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      open: false,
      proxy: { '/api': `http://127.0.0.1:${api.address().port}` },
    },
  }),
)
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    serviceWorkers: 'block',
  })
  await context.addInitScript(() => {
    window.nativeRunCounters = { opens: 0, stops: 0 }
    const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices),
      stop = MediaStreamTrack.prototype.stop
    navigator.mediaDevices.getUserMedia = (constraints) => {
      window.nativeRunCounters.opens++
      return open(constraints)
    }
    MediaStreamTrack.prototype.stop = function () {
      window.nativeRunCounters.stops++
      return stop.call(this)
    }
  })
  if (diagnostics)
    await context.addInitScript(() => {
      window.nativeCleanupTrace = []
      window.nativeWorkerTrace = []
      window.nativeWorkerCounts = { frames: 0, results: 0 }
      window.nativeWorkerFailures = []
      const NativeWorker = window.Worker
      let next = 0
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args)
          this.traceId = ++next
          this.framePosts = 0
          this.frameResults = 0
          this.note('created')
          this.addEventListener('message', (event) => {
            const data = event.data
            if (data?.type === 'result') {
              window.nativeWorkerCounts.results++
              // Keep cold-frame timings bounded without crowding out cleanup ACKs.
              if (++this.frameResults <= 3) this.note('frame-result')
            }
            if (['boot', 'ready', 'error', 'closed'].includes(data?.type))
              this.note(data.type, data.type === 'closed' ? data.clean === true : undefined)
          })
          this.addEventListener('error', () => this.note('worker-error'))
          this.addEventListener('messageerror', () => this.note('message-error'))
        }
        note(phase, clean) {
          if (window.nativeWorkerTrace.length < 120)
            window.nativeWorkerTrace.push({
              worker: this.traceId,
              phase,
              ms: Math.round(performance.now()),
              ...(clean === undefined ? {} : { clean }),
            })
        }
        postMessage(data, ...args) {
          if (data?.type === 'frame') {
            window.nativeWorkerCounts.frames++
            if (++this.framePosts <= 3) this.note('frame-post')
          }
          if (data?.type === 'init' || data?.type === 'close') this.note(`send-${data.type}`)
          return super.postMessage(data, ...args)
        }
        terminate() {
          this.note('terminate')
          return super.terminate()
        }
      }
    })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    paths.push(url.pathname)
    if (url.origin === new URL(origin).origin && url.pathname === '/__bodyguard/inference-worker.js')
      return route.fulfill({status:200, contentType:'application/javascript', headers:{'content-security-policy':SDK_DEV_POLICY}, body:readFileSync('/private/tmp/bodyguard-worker-candidate-20261111.js')})
    if (url.origin !== new URL(origin).origin) {
      external++
      return route.abort()
    }
    return route.continue()
  })
  page = await context.newPage()
  rafReceiver = await page.evaluate(() => {
    let direct = 'ok'
    try {
      window.cancelAnimationFrame.call({}, 0)
    } catch (error) {
      direct = error.name
    }
    cancelAnimationFrame(0)
    return { direct, wrapped: 'ok' }
  })
  assert.deepEqual(rafReceiver, { direct: 'TypeError', wrapped: 'ok' })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}dev/coaching?motion=${selected}`)
  await page.getByRole('button', { name: '검수 시작', exact: true }).click()
  await page.getByText(preparation, { exact: true }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(1200)
  assert.equal(await page.getByRole('progressbar').getAttribute('value'), '0')
  assert.equal(await page.getByRole('alert').count(), 0)
  cases.push(
    'real same-origin Worker/SDK/GLB ready; blank fake camera does not pass motion or accrue hold',
  )
  const old = await page.getByRole('img', { name: '실행 중인 두 아바타 후보' }).elementHandle()
  await page.getByRole('button', { name: '일시정지', exact: true }).click()
  const resume = page.getByRole('button', { name: '다시 준비하고 재개', exact: true })
  await resume.waitFor()
  await page.waitForFunction(() => window.nativeRunCounters.stops >= 1)
  await page.waitForFunction((node) => node.getContext('webgl2')?.isContextLost() === true, old)
  await old.dispose()
  await resume.click()
  await page.getByText(preparation, { exact: true }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)
  assert.equal(await page.getByRole('alert').count(), 0)
  await page.getByRole('button', { name: '불편하면 중단', exact: true }).click()
  await page.getByRole('heading', { name: '불편으로 중단했습니다' }).waitFor()
  await page.waitForFunction(
    () => window.nativeRunCounters.opens === 2 && window.nativeRunCounters.stops === 2,
  )
  assert.equal(
    await page
      .getByText(selected === 'shoulder-shrug' ? '양쪽 · 완료' : '왼쪽 · 완료', { exact: true })
      .count(),
    0,
  )
  assert.equal(writes, 0)
  assert.equal(external, 0)
  assert.deepEqual(errors, [])
  assert(paths.some((path) => path.endsWith('/__bodyguard/inference-worker.js')))
  assert(paths.some((path) => path.endsWith('.task')))
  assert(paths.some((path) => path.endsWith('.wasm')))
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  cases.push(
    'actual native pause/SDK-camera-GPU cleanup and explicit fresh resume/stop; no candidate result write or automatic success',
  )
} catch (error) {
  failure = { name: error.name, message: error.message, stack: error.stack }
  if (page) {
    failure.sessionFailure = await page
      .locator('[data-session-failure]')
      .getAttribute('data-session-failure')
      .catch(() => null)
    writeFileSync(`${scratch}/${label}-failure-ui.txt`, await page.locator('body').innerText(), {
      flag: 'wx',
    })
    // Observe the original owner barriers before destroying Chrome, not a larger SDK budget.
    try {
      await page.waitForFunction(
        () => window.nativeRunCounters.opens === window.nativeRunCounters.stops,
        undefined,
        { timeout: 11000 },
      )
      failureCleanupObservation = 'camera-retired'
    } catch {
      failureCleanupObservation = 'not-observed-within-bound'
    }
  }
} finally {
  const cleanupDiagnostics =
    diagnostics && page
      ? await page
          .evaluate(() => ({
            resources: window.nativeCleanupTrace,
            workers: window.nativeWorkerTrace,
            counts: window.nativeWorkerCounts,
            failures: window.nativeWorkerFailures,
          }))
          .catch(() => null)
      : null
  const version = browser?.version()
  await browser?.close()
  await server.close()
  await new Promise((yes) => api.close(yes))
  const after = snapshot()
  assert.deepEqual(after, before)
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual Chrome blank fake device + actual Worker/MediaPipe/GLBs/native resource ownership; generated protocol/controlled auth, no person/accuracy/clinical proof',
        motion: selected,
        version,
        rafReceiver,
        cleanupDiagnostics,
        failureCleanupObservation,
        preparation: 'same-source-before-avatar-GPU',
        before,
        after,
        cases,
        errors,
        writes,
        external,
        paths,
        failure,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output: `${scratch}/${label}.json`, passed: cases.length, failure }))
if (failure) process.exitCode = 1
