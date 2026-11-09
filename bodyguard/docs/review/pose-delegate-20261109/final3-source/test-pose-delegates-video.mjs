// Local-only delegate comparison; writes aggregate statistics, never input frames or landmarks.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { build, createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'
import { SDK_DEV_POLICY } from './sdk-network-policy.ts'

const [videoPath, output] = process.argv.slice(2)
assert(videoPath && existsSync(videoPath))
assert(output?.endsWith('.json') && !existsSync(output), 'Choose a new output JSON')
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const sources = [
  'e2e/fixtures/poseDelegateProbe.html',
  'e2e/fixtures/poseDelegateProbe.ts',
  'e2e/fixtures/poseDelegateProbe.worker.ts',
  'scripts/test-pose-delegates-video.mjs',
  'pnpm-lock.yaml',
  'public/models/pose_landmarker_lite.task',
  'public/mediapipe/VERSION',
  'public/mediapipe/wasm/vision_wasm_internal.js',
  'public/mediapipe/wasm/vision_wasm_internal.wasm',
  'public/mediapipe/wasm/vision_wasm_module_internal.js',
  'public/mediapipe/wasm/vision_wasm_module_internal.wasm',
  'public/mediapipe/wasm/vision_wasm_nosimd_internal.js',
  'public/mediapipe/wasm/vision_wasm_nosimd_internal.wasm',
  'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs',
]
const before = Object.fromEntries(sources.map((path) => [path, hash(path)]))
const videoBase64 = readFileSync(videoPath).toString('base64')
let browser,
  result = null,
  failure = null,
  cameraRequests = 0,
  external = 0,
  writes = 0
const pageErrors = []
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    plugins: [
      {
        name: 'test-classic-pose-worker',
        configureServer(server) {
          let bundle
          server.middlewares.use((req, res, next) => {
            if (req.url?.split('?')[0] !== '/__bodyguard/test-pose-delegates.js') return next()
            bundle ??= build({
              configFile: false,
              root: process.cwd(),
              envDir: false,
              publicDir: false,
              logLevel: 'error',
              build: {
                write: false,
                emptyOutDir: false,
                copyPublicDir: false,
                minify: false,
                lib: {
                  entry: resolve('e2e/fixtures/poseDelegateProbe.worker.ts'),
                  name: 'PoseDelegateProbe',
                  formats: ['iife'],
                },
              },
            }).then((result) => {
              const outputs = Array.isArray(result) ? result : [result]
              const chunks = outputs
                .flatMap((item) => ('output' in item ? item.output : []))
                .filter((item) => item.type === 'chunk')
              if (chunks.length !== 1) throw new Error('Worker bundle unavailable')
              return chunks[0].code
            })
            res.setHeader('Content-Type', 'application/javascript')
            res.setHeader('Content-Security-Policy', SDK_DEV_POLICY)
            res.setHeader('Cache-Control', 'no-store')
            void bundle
              .then((code) => res.end(code))
              .catch(() => {
                res.statusCode = 503
                res.end('throw new Error("Worker unavailable")')
              })
          })
        },
      },
    ],
    cacheDir: resolve(output, '..', 'pose-vite-cache'),
    server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
  }),
)
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: 'chrome',
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  await context.exposeFunction('poseProbeCameraDenied', () => {
    cameraRequests++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.poseProbeCameraDenied()
      return Promise.reject(new Error('Physical camera is not used'))
    }
  })
  await context.route('**/*', async (route) => {
    const request = route.request()
    if (new URL(request.url()).origin !== new URL(origin).origin) {
      external++
      await route.abort()
      return
    }
    if (request.method() !== 'GET') writes++
    await route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(error.name))
  await page.goto(`${origin}e2e/fixtures/poseDelegateProbe.html`)
  result = await page.evaluate(
    async ({ videoBase64 }) => {
      const { comparePoseDelegates } = await import('/e2e/fixtures/poseDelegateProbe.ts')
      return comparePoseDelegates(videoBase64)
    },
    { videoBase64 },
  )
  assert.equal(result.failure, null)
  assert.equal(result.processed, 65)
  assert.equal(result.cleanup, 'clean')
  assert(result.summary?.counts?.both > 0, 'Neither delegate produced comparable poses')
  assert.equal(cameraRequests, 0)
  assert.equal(external, 0)
  assert.equal(writes, 0)
  assert.deepEqual(pageErrors, [])
} catch (error) {
  failure = { name: error.name, message: error.message }
} finally {
  const version = browser?.version()
  await browser?.close()
  await server.close()
  const after = Object.fromEntries(sources.map((path) => [path, hash(path)]))
  const sourceChanged = JSON.stringify(before) !== JSON.stringify(after)
  writeFileSync(
    output,
    JSON.stringify(
      {
        method:
          'public prerecorded pose video, same decoded frames to CPU and GPU GestureRecognizer in one local Worker; reference is another model prediction, not ground truth',
        videoSha256: hash(videoPath),
        version,
        before,
        after,
        sourceChanged,
        result,
        failure,
        cameraRequests,
        external,
        writes,
        pageErrors,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
  if (sourceChanged) process.exitCode = 1
}
console.log(JSON.stringify({ output, result, failure }))
if (failure) process.exitCode = 1
