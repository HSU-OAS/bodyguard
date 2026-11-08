// Test-only: public prerecorded motion as a fake camera; no input frames or landmarks saved.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import { instrumentWorkerFailure } from '../e2e/fixtures/nativeWorkerDiagnosticsTransform.ts'
import config from '../vite.config.ts'

const [input, output] = process.argv.slice(2)
assert(input?.endsWith('.y4m') && existsSync(input), 'Supply a local Y4M fake-camera video')
assert(output?.endsWith('.json') && !existsSync(output), 'Choose a new output JSON')
const sources = [
  'src/pose/workerInference.ts',
  'src/pose/workerInferenceRuntime.ts',
  'src/pose/workerNativeEngine.ts',
  'src/pose/nativeInference.worker.ts',
  'src/pose/ownedModelAssets.ts',
  'e2e/fixtures/nativeCleanupDiagnostics.ts',
  'e2e/fixtures/nativeWorkerDiagnosticsTransform.ts',
  'pnpm-lock.yaml',
  'src/avatar/directionalRig.ts',
  'src/avatar/referenceStage.ts',
  'src/avatar/observedComparison.ts',
  'src/avatar/observedPoseRig.ts',
  'scripts/local-avatar-pose-proof.mjs',
  'e2e/fixtures/publicVideoProbe.html',
]
const hash = (name) => createHash('sha256').update(readFileSync(name)).digest('hex')
const before = Object.fromEntries(sources.map((name) => [name, hash(name)]))
let browser,
  page,
  workerFailures = []
let result = null,
  failure = null,
  externalRequests = 0,
  writes = 0,
  sourceChanged = false
const pageErrors = [],
  workerLogs = []
const diagnostics = process.env.BODYGUARD_DIAGNOSTICS === '1'
const avatar = process.env.BODYGUARD_AVATAR === '1'
const avatarGender = process.env.BODYGUARD_AVATAR_GENDER ?? 'female'
assert(['female', 'male'].includes(avatarGender), 'Unknown avatar gender')
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    plugins: [
      {
        name: 'local-worker-diagnostics',
        enforce: 'pre',
        transform(source, id) {
          if (id.split('?')[0] === resolve('src/avatar/referenceStage.ts')) {
            const needle = '      beginObservation: (ownerGeneration: number) => {'
            assert.equal(source.split(needle).length, 2)
            const crop = "const cropY = bodyHeight * (view === 'upper' ? 0.35 : 0.24)"
            assert.equal(source.split(crop).length, 2)
            source = source.replace(crop, `let farthest = bodyHeight * 0.25;
            for (const candidate of [user, guide]) {
              for (const name of ['head', 'wristL', 'wristR', 'lowerarm01L', 'lowerarm01R']) {
                const node = candidate.getObjectByName(name);
                if (!node) continue;
                const position = node.getWorldPosition(new DebugVector3());
                if (Number.isFinite(position.x)) farthest = Math.max(farthest, Math.abs(position.x - candidate.position.x) + bodyHeight * 0.17);
              }
            }
            const cropY = view === 'upper' && !globalThis.__bgBaselineView ? Math.max(bodyHeight * 0.35, (farthest * height) / paneWidth) : bodyHeight * (view === 'upper' ? 0.35 : 0.24)`)
            return "import { Vector3 as DebugVector3 } from 'three';\n" + source.replace(needle, `      debugUserArmExtent: () => {
        let farthest = 0;
        for (const name of ['wristL', 'wristR', 'lowerarm01L', 'lowerarm01R']) {
          const node = user.getObjectByName(name);
          if (node) farthest = Math.max(farthest, Math.abs(node.getWorldPosition(new DebugVector3()).x - user.position.x) / bodyHeight);
        }
        return farthest;
      },
      debugTorsoDegrees: () => {
        const lower = user.getObjectByName('spine05'), upper = user.getObjectByName('neck01');
        if (!lower || !upper) return null;
        const direction = upper.getWorldPosition(new DebugVector3()).sub(lower.getWorldPosition(new DebugVector3()));
        return Math.atan2(Math.abs(direction.x), direction.y) * 180 / Math.PI;
      },\n` + needle)
          }
          if (diagnostics && id.split('?')[0] === resolve('src/pose/workerInference.ts'))
            return instrumentWorkerFailure(source)
        },
      },
    ],
    cacheDir: resolve(output, '..', 'vite-cache'),
    server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
  }),
)
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: 'chrome',
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${resolve(input)}`,
    ],
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  if (diagnostics)
    await context.addInitScript(() => {
      window.nativeWorkerFailures = []
    })
  await context.route('**/*', async (route) => {
    const request = route.request()
    if (new URL(request.url()).origin !== new URL(origin).origin) {
      externalRequests++
      await route.abort()
      return
    }
    if (request.method() !== 'GET') writes++
    if (diagnostics && new URL(request.url()).pathname === '/__bodyguard/inference-worker.js') {
      const response = await fetch(request.url())
      assert.equal(response.status, 200)
      let body = await response.text()
      const substitute = (before, after) => {
        assert.equal(body.split(before).length, 2, 'Worker diagnostic source mismatch')
        body = body.replace(before, after)
      }
      substitute(
        'async function close() {\n\t\t\tif (state',
        'async function close() {\n\t\t\tconsole.log("[BG-QC] runtime-close-enter");\n\t\t\tif (state',
      )
      substitute(
        'await inFlight;\n\t\t\ttry {\n\t\t\t\tawait engine?.dispose();',
        'await inFlight;\n\t\t\tconsole.log("[BG-QC] engine-dispose-start");\n\t\t\ttry {\n\t\t\t\tawait engine?.dispose();\n\t\t\t\tconsole.log("[BG-QC] engine-dispose-end");',
      )
      substitute(
        'for (const release of releases.reverse()) try {\n\t\t\t\t\trelease();',
        'let diagnosticIndex = 0;\n\t\t\t\tfor (const release of releases.reverse()) try {\n\t\t\t\t\tconsole.log("[BG-QC] task-close-start", ++diagnosticIndex);\n\t\t\t\t\trelease();\n\t\t\t\t\tconsole.log("[BG-QC] task-close-end", diagnosticIndex);',
      )
      workerLogs.push(
        `transformed-worker-sha256 ${createHash('sha256').update(body).digest('hex')}`,
      )
      await route.fulfill({
        status: response.status,
        headers: {
          'content-type': 'application/javascript',
          'content-security-policy': response.headers.get('content-security-policy') ?? '',
        },
        body,
      })
      return
    }
    await route.continue()
  })
  page = await context.newPage()
  await page.exposeFunction('saveAvatarPreview', (data, suffix = '') => {
    const prefix = 'data:image/png;base64,'
    assert(typeof data === 'string' && data.startsWith(prefix))
    writeFileSync(
      output.replace(/\.json$/, `${suffix}.avatar.png`),
      Buffer.from(data.slice(prefix.length), 'base64'),
      { flag: 'wx' },
    )
  })
  assert.equal(hash(input), '1df697eccf5e050538de3a5720dae25d56ed62a4d118dbf94aa09f675aa6df53', 'Only the known public video may be captured')
  await page.exposeFunction('savePublicFrame', (data) => {
    const prefix = 'data:image/png;base64,'
    assert(typeof data === 'string' && data.startsWith(prefix))
    writeFileSync(output.replace(/\.json$/, '.public-input.png'), Buffer.from(data.slice(prefix.length), 'base64'), { flag: 'wx' })
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.text().startsWith('[BG-QC]')) workerLogs.push(message.text())
  })
  await page.goto(`${origin}e2e/fixtures/publicVideoProbe.html`)
  result = await page.evaluate(
    async ({ avatar, avatarGender }) => {
      const { createWorkerPoseInference } = await import('/src/pose/workerInference.ts')
      const { observedLimbDirections } = await import('/src/avatar/directionalRig.ts')
      const abort = new AbortController()
      let stream, owner, stage, canvas
      const aggregate = {
        frames: 0,
        singleBodies: 0,
        withWorldBody: 0,
        withFace: 0,
        withHands: 0,
        directionFrames: 0,
        directionNames: [],
        boneMotionRadians: {},
        shoulderImageVerticalRange: null,
        cameraStopped: false,
        workerClean: false,
        stage: 'camera',
        inferenceFailure: null,
        cleanupFailure: null,
        avatarFailure: false,
        avatarCoveredFrames: 0,
        avatarMaxTracked: 0,
        avatarClean: false,
      }
      let minimum = Infinity,
        maximum = -Infinity
      const names = new Set(),
        firstDirections = new Map()
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 360, height: 640 },
          audio: false,
        })
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.srcObject = stream
        await video.play()
        aggregate.stage = 'initializing'
        owner = await createWorkerPoseInference(
          { generation: 1, signal: abort.signal },
          { model: 'lite', face: true, hands: true, matrixLayout: 'column-major' },
        )
        if (avatar) {
          aggregate.stage = 'avatar'
          const { prepareReferenceStage } = await import('/src/avatar/referenceStage.ts')
          canvas = document.createElement('canvas')
          canvas.style.width = '960px'
          canvas.style.height = '640px'
          document.body.appendChild(canvas)
          stage = await prepareReferenceStage(
            { generation: 1, signal: abort.signal },
            {
              canvas,
              gender: avatarGender,
              motion: 'shoulder-shrug',
              onFailure: () => {
                aggregate.avatarFailure = true
              },
            },
          )
          if (!stage.beginObservation(1)) throw new Error('Avatar observation unavailable')
          stage.alignObservation()
        }
        aggregate.stage = 'inference'
        let lastRenderAt = null, savedComparison = false
        for (let index = 0; index < 45; index++) {
          await new Promise((resolve) => setTimeout(resolve, 180))
          aggregate.stage = 'detect'
          const now = performance.now()
          const frame = new VideoFrame(video, { timestamp: Math.floor(now * 1000) })
          if (index === 25) {
            const capture = document.createElement('canvas')
            capture.width = frame.displayWidth
            capture.height = frame.displayHeight
            capture.getContext('2d').drawImage(frame, 0, 0)
            await window.savePublicFrame(capture.toDataURL('image/png'))
          }
          let observed
          try {
            observed = await owner.detect(frame, now)
            aggregate.frames++
            if (observed.landmarks.length === 1 && observed.landmarks[0].length === 33) {
              aggregate.singleBodies++
              const left = observed.landmarks[0][11],
                right = observed.landmarks[0][12]
              const mid = (left.y + right.y) / 2
              if (Number.isFinite(mid)) {
                minimum = Math.min(minimum, mid)
                maximum = Math.max(maximum, mid)
              }
            }
            if (observed.worldLandmarks.length === 1 && observed.worldLandmarks[0].length === 33)
              aggregate.withWorldBody++
            if (observed.headOrientation) aggregate.withFace++
            if (observed.hands?.length) aggregate.withHands++
            if (stage) {
              aggregate.stage = 'avatar-observe'
              const accepted = stage.observe({
                generation: 1,
                sequence: index + 1,
                at: now,
                image: {
                  width: video.videoWidth,
                  height: video.videoHeight,
                  imageIsMirrored: false,
                },
                result: observed,
              })
              aggregate.stage = 'avatar-render'
              const renderAt = performance.now()
              const delta = lastRenderAt === null ? 0 : renderAt - lastRenderAt
              lastRenderAt = renderAt
              const snapshot = stage.render(renderAt, delta, {
                phase: 'waiting-start',
                stepId: 'both',
                playing: true,
                revision: 0,
                view: 'upper',
              })
              if (
                accepted &&
                snapshot?.tracked > 0 &&
                ['tracking', 'partial'].includes(snapshot.status)
              )
                aggregate.avatarCoveredFrames++
              aggregate.avatarMaxTracked = Math.max(
                aggregate.avatarMaxTracked,
                snapshot?.tracked ?? 0,
              )
              if (!savedComparison && accepted && snapshot?.tracked > 0 && stage.debugUserArmExtent() > 0.35) {
                savedComparison = true
                aggregate.comparisonExtent = stage.debugUserArmExtent()
                await window.saveAvatarPreview(canvas.toDataURL('image/png'), '.dynamic')
                globalThis.__bgBaselineView = true
                stage.render(renderAt + 0.001, 0, { phase: 'waiting-start', stepId: 'both', playing: true, revision: 0, view: 'upper' })
                await window.saveAvatarPreview(canvas.toDataURL('image/png'), '.baseline')
                globalThis.__bgBaselineView = false
              }
              if (index === 25) {
                const image = observed.landmarks[0], world = observed.worldLandmarks[0]
                if (image?.length === 33 && world?.length === 33) {
                  const angle = (points, scaleX, scaleY) => {
                    const dx = ((points[11].x + points[12].x) - (points[23].x + points[24].x)) * scaleX
                    const dy = ((points[11].y + points[12].y) - (points[23].y + points[24].y)) * scaleY
                    return Math.atan2(Math.abs(dx), -dy) * 180 / Math.PI
                  }
                  aggregate.trunkAtPreview = { imageDegrees: angle(image, video.videoWidth, video.videoHeight), worldDegrees: angle(world, 1, 1), rigDegrees: stage.debugTorsoDegrees() }
                }
                await window.saveAvatarPreview(canvas.toDataURL('image/png'))
              }
            }
            aggregate.stage = 'directions'
            const directions = observedLimbDirections(
              observed.landmarks[0] ?? null,
              observed.worldLandmarks[0] ?? null,
              false,
            )
            const keys = Object.keys(directions)
            if (keys.length) aggregate.directionFrames++
            keys.forEach((key) => {
              names.add(key)
              const vector = directions[key],
                length = Math.hypot(...vector)
              if (!Number.isFinite(length) || length === 0) return
              const current = vector.map((value) => value / length)
              if (!firstDirections.has(key)) firstDirections.set(key, current)
              else {
                const first = firstDirections.get(key)
                const dot = Math.max(
                  -1,
                  Math.min(
                    1,
                    current.reduce((sum, value, i) => sum + value * first[i], 0),
                  ),
                )
                const angle = Math.acos(dot)
                aggregate.boneMotionRadians[key] = Math.max(
                  aggregate.boneMotionRadians[key] ?? 0,
                  angle,
                )
              }
            })
          } finally {
            observed?.close()
            frame.close()
          }
        }
        aggregate.directionNames = Array.from(names).sort()
        aggregate.shoulderImageVerticalRange =
          Number.isFinite(minimum) && Number.isFinite(maximum) ? maximum - minimum : null
      } catch (error) {
        aggregate.inferenceFailure = {
          stage: aggregate.stage,
          name: error?.name ?? 'Error',
          message:
            error?.message === 'Worker inference unavailable' ? error.message : 'unexpected error',
        }
      } finally {
        if (stage) {
          try {
            stage.dispose()
            aggregate.avatarClean = true
          } catch {
            aggregate.avatarFailure = true
          }
        }
        try {
          if (owner) {
            await owner.dispose()
            aggregate.workerClean = true
          }
        } catch (error) {
          aggregate.cleanupFailure = { name: error?.name ?? 'Error' }
        } finally {
          stream?.getTracks().forEach((track) => {
            track.stop()
          })
          aggregate.cameraStopped =
            !!stream && stream.getTracks().every((track) => track.readyState === 'ended')
        }
      }
      return aggregate
    },
    { avatar, avatarGender },
  )
  assert.equal(result.inferenceFailure, null, 'Inference failed')
  assert.equal(result.cleanupFailure, null, 'Worker cleanup failed')
  if (avatar) {
    assert.equal(result.avatarFailure, false, 'Avatar stage failed')
    assert(
      result.avatarClean && result.avatarCoveredFrames > 0 && result.avatarMaxTracked > 0,
      'Avatar did not track',
    )
  }
  assert.equal(result.frames, 45)
  assert(result.singleBodies > 0 && result.withWorldBody > 0, 'No complete body detected')
  assert(result.directionFrames > 0, 'No avatar limb directions derived')
  assert(
    Object.values(result.boneMotionRadians).some((angle) => angle > 0.02),
    'No direction change detected',
  )
  assert(result.shoulderImageVerticalRange > 0.001, 'No shoulder position change detected')
  assert(result.workerClean && result.cameraStopped)
  assert.equal(externalRequests, 0)
  assert.equal(writes, 0)
  assert.deepEqual(pageErrors, [])
} catch (error) {
  failure = { name: error.name, message: error.message }
} finally {
  if (diagnostics && page)
    workerFailures = await page.evaluate(() => window.nativeWorkerFailures ?? []).catch(() => [])
  const version = browser?.version()
  await browser?.close()
  await server.close()
  const after = Object.fromEntries(sources.map((name) => [name, hash(name)]))
  sourceChanged = JSON.stringify(before) !== JSON.stringify(after)
  writeFileSync(
    output,
    JSON.stringify(
      {
        method:
          'public prerecorded video as Chrome fake camera, actual local Worker/MediaPipe, no clinical or live-person claim',
        inputY4mSha256: hash(input),
        version,
        before,
        after,
        sourceChanged,
        result,
        failure,
        externalRequests,
        writes,
        pageErrors,
        diagnostics,
        avatar,
        avatarGender,
        workerLogs,
        workerFailures,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output, result, failure }))
if (failure || sourceChanged) process.exitCode = 1
