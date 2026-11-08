// Local-only delegate comparison; writes aggregate statistics, never input frames or landmarks.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [videoPath, referencePath, output] = process.argv.slice(2)
assert(videoPath && referencePath && existsSync(videoPath) && existsSync(referencePath))
assert(output?.endsWith('.json') && !existsSync(output), 'Choose a new output JSON')
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const sources = [
  'e2e/fixtures/handDelegateProbe.html',
  'e2e/fixtures/handDelegateProbe.ts',
  'e2e/fixtures/handDelegateProbe.worker.ts',
  'scripts/test-hand-delegates-video.mjs',
  'pnpm-lock.yaml',
  'public/models/gesture_recognizer.task',
]
const before = Object.fromEntries(sources.map((path) => [path, hash(path)]))
const reference = JSON.parse(readFileSync(referencePath, 'utf8'))
assert(Array.isArray(reference) && reference.length === 325)
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
    cacheDir: resolve(output, '..', 'hand-vite-cache'),
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
  await context.exposeFunction('handProbeCameraDenied', () => {
    cameraRequests++
  })
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.handProbeCameraDenied()
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
  await page.goto(`${origin}e2e/fixtures/handDelegateProbe.html`)
  result = await page.evaluate(
    async ({ videoBase64, reference }) => {
      const { compareHandDelegates } = await import('/e2e/fixtures/handDelegateProbe.ts')
      return compareHandDelegates(videoBase64, reference)
    },
    { videoBase64, reference },
  )
  assert.equal(result.failure, null)
  assert.equal(result.processed, 325)
  assert.equal(result.cleanup, 'clean')
  assert(result.summary?.counts?.both > 0, 'Neither delegate produced comparable hands')
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
          'public prerecorded hand video, same decoded frames to CPU and GPU GestureRecognizer in one local Worker; reference is another model prediction, not ground truth',
        videoSha256: hash(videoPath),
        referenceSha256: hash(referencePath),
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
