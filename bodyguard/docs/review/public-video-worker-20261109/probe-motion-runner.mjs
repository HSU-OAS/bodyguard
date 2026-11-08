// Test-only: public prerecorded motion as a fake camera; no input frames or landmarks saved.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [input, output] = process.argv.slice(2)
assert(input?.endsWith('.y4m') && existsSync(input), 'Supply a local Y4M fake-camera video')
assert(output?.endsWith('.json') && !existsSync(output), 'Choose a new output JSON')
const sources = [
  'src/pose/workerInference.ts',
  'src/pose/workerInferenceRuntime.ts',
  'src/pose/workerNativeEngine.ts',
  'src/avatar/directionalRig.ts',
  'scripts/test-public-video-worker.mjs',
  'e2e/fixtures/publicVideoProbe.html',
]
const hash = (name) => createHash('sha256').update(readFileSync(name)).digest('hex')
const before = Object.fromEntries(sources.map((name) => [name, hash(name)]))
let browser, page
let result = null, failure = null, externalRequests = 0, writes = 0
const pageErrors = []
const server = await createServer(mergeConfig(config, {
  configFile: false,
  cacheDir: resolve(output, '..', 'vite-cache'),
  server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
}))
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
  await context.route('**/*', async (route) => {
    const request = route.request()
    if (new URL(request.url()).origin !== new URL(origin).origin) {
      externalRequests++
      await route.abort()
      return
    }
    if (request.method() !== 'GET') writes++
    await route.continue()
  })
  page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${origin}e2e/fixtures/publicVideoProbe.html`)
  result = await page.evaluate(async () => {
    const { createWorkerPoseInference } = await import('/src/pose/workerInference.ts')
    const { observedLimbDirections } = await import('/src/avatar/directionalRig.ts')
    const abort = new AbortController()
    let stream, owner
    const aggregate = {
      frames: 0, singleBodies: 0, withWorldBody: 0, withFace: 0, withHands: 0,
      directionFrames: 0, directionNames: [], boneMotionRadians: {}, shoulderImageVerticalRange: null,
      cameraStopped: false, workerClean: false,
    }
    let minimum = Infinity, maximum = -Infinity
    const names = new Set(), firstDirections = new Map()
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 360, height: 640 }, audio: false })
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await video.play()
      owner = await createWorkerPoseInference(
        { generation: 1, signal: abort.signal },
        { model: 'lite', face: true, hands: true, matrixLayout: 'column-major' },
      )
      for (let index = 0; index < 45; index++) {
        await new Promise((resolve) => setTimeout(resolve, 180))
        const now = performance.now()
        const frame = new VideoFrame(video, { timestamp: Math.floor(now * 1000) })
        let observed
        try {
          observed = await owner.detect(frame, now)
          aggregate.frames++
          if (observed.landmarks.length === 1 && observed.landmarks[0].length === 33) {
            aggregate.singleBodies++
            const left = observed.landmarks[0][11], right = observed.landmarks[0][12]
            const mid = (left.y + right.y) / 2
            if (Number.isFinite(mid)) { minimum = Math.min(minimum, mid); maximum = Math.max(maximum, mid) }
          }
          if (observed.worldLandmarks.length === 1 && observed.worldLandmarks[0].length === 33)
            aggregate.withWorldBody++
          if (observed.headOrientation) aggregate.withFace++
          if (observed.hands?.length) aggregate.withHands++
          const directions = observedLimbDirections(observed.landmarks[0] ?? null, observed.worldLandmarks[0] ?? null, false)
          const keys = Object.keys(directions)
          if (keys.length) aggregate.directionFrames++
          keys.forEach((key) => {
            names.add(key)
            const vector = directions[key], length = Math.hypot(...vector)
            if (!Number.isFinite(length) || length === 0) return
            const current = vector.map((value) => value / length)
            if (!firstDirections.has(key)) firstDirections.set(key, current)
            else {
              const first = firstDirections.get(key)
              const dot = Math.max(-1, Math.min(1, current.reduce((sum, value, i) => sum + value * first[i], 0)))
              const angle = Math.acos(dot)
              aggregate.boneMotionRadians[key] = Math.max(aggregate.boneMotionRadians[key] ?? 0, angle)
            }
          })
        } finally {
          observed?.close()
          frame.close()
        }
      }
      aggregate.directionNames = Array.from(names).sort()
      aggregate.shoulderImageVerticalRange = Number.isFinite(minimum) && Number.isFinite(maximum) ? maximum - minimum : null
    } finally {
      try {
        if (owner) { await owner.dispose(); aggregate.workerClean = true }
      } finally {
        stream?.getTracks().forEach((track) => track.stop())
        aggregate.cameraStopped = !!stream && stream.getTracks().every((track) => track.readyState === 'ended')
      }
    }
    return aggregate
  })
  assert.equal(result.frames, 45)
  assert(result.singleBodies > 0 && result.withWorldBody > 0, 'No complete body detected')
  assert(result.directionFrames > 0, 'No avatar limb directions derived')
  assert(Object.values(result.boneMotionRadians).some((angle) => angle > 0.02), 'No direction change detected')
  assert(result.shoulderImageVerticalRange > 0.001, 'No shoulder position change detected')
  assert(result.workerClean && result.cameraStopped)
  assert.equal(externalRequests, 0)
  assert.equal(writes, 0)
  assert.deepEqual(pageErrors, [])
} catch (error) {
  failure = { name: error.name, message: error.message }
} finally {
  const version = browser?.version()
  await browser?.close()
  await server.close()
  const after = Object.fromEntries(sources.map((name) => [name, hash(name)]))
  writeFileSync(output, JSON.stringify({
    method: 'public prerecorded video as Chrome fake camera, actual local Worker/MediaPipe, no clinical or live-person claim',
    inputY4mSha256: hash(input), version, before, after, result, failure, externalRequests, writes, pageErrors,
  }, null, 2), { flag: 'wx' })
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Sources changed during test')
}
console.log(JSON.stringify({ output, result, failure }))
if (failure) process.exitCode = 1
