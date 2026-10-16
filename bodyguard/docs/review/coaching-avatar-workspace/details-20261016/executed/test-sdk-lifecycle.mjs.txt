// FR-M-02/07·NFR-08: localhost blank-input diagnostic, never a participant/accuracy test.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { build, createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'
import { SDK_DEV_POLICY } from './sdk-network-policy.ts'

const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-sdk-lifecycle\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const sources = [
  'src/pose/workerNativeEngine.ts',
  'src/pose/workerInference.ts',
  'src/pose/workerInferenceRuntime.ts',
  'e2e/fixtures/sdkLifecycle.worker.ts',
  'e2e/fixtures/sdkLifecycleProbe.ts',
  'scripts/test-sdk-lifecycle.mjs',
  'pnpm-lock.yaml',
]
const hashes = () =>
  Object.fromEntries(
    sources.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
  )
const before = hashes(),
  runs = [],
  errors = []
let browser,
  failure = null,
  external = 0,
  cameraRequests = 0,
  bundle
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
    plugins: [
      {
        name: 'private-sdk-lifecycle-probe',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/__private-sdk-lifecycle') {
              res.setHeader('Content-Type', 'text/html')
              res.setHeader('Content-Security-Policy', SDK_DEV_POLICY)
              res.setHeader('Cache-Control', 'no-store')
              res.end(
                '<script type="module">import {runSdkLifecycle} from "/e2e/fixtures/sdkLifecycleProbe.ts"; window.runSdkLifecycle=runSdkLifecycle</script>',
              )
            } else if (req.url === '/__private-sdk-lifecycle-worker.js') {
              bundle ??= build({
                configFile: false,
                envDir: false,
                publicDir: false,
                logLevel: 'error',
                build: {
                  write: false,
                  emptyOutDir: false,
                  copyPublicDir: false,
                  minify: false,
                  lib: {
                    entry: fileURLToPath(
                      new URL('../e2e/fixtures/sdkLifecycle.worker.ts', import.meta.url),
                    ),
                    name: 'PrivateSdkLifecycle',
                    formats: ['iife'],
                  },
                },
              }).then((result) => {
                const chunks = (Array.isArray(result) ? result : [result])
                  .flatMap((item) => item.output)
                  .filter((item) => item.type === 'chunk')
                assert.equal(chunks.length, 1)
                return chunks[0].code
              })
              res.setHeader('Content-Type', 'application/javascript')
              res.setHeader('Content-Security-Policy', SDK_DEV_POLICY)
              res.setHeader('Cache-Control', 'no-store')
              void bundle
                .then((code) => res.end(code))
                .catch(() => {
                  res.statusCode = 503
                  res.end('throw new Error("Private probe unavailable")')
                })
            } else next()
          })
        },
      },
    ],
  }),
)
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  for (const cancelAt of ['none', 'body', 'face', 'hands']) {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    await context.exposeFunction('probeCameraRequest', () => cameraRequests++)
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => {
        void window.probeCameraRequest()
        return Promise.reject(new Error('No camera allowed in blank diagnostic'))
      }
    })
    context.on('request', (r) => {
      if (new URL(r.url()).origin !== new URL(origin).origin) external++
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(e.name))
    try {
      await page.goto(`${origin}__private-sdk-lifecycle`)
      await page.waitForFunction(() => typeof window.runSdkLifecycle === 'function')
      const result = await page.evaluate((mode) => window.runSdkLifecycle(mode), cancelAt)
      const events = result.events
      const clean = events.some(
        (e) => e.task === 'parent' && e.phase === 'receive-closed' && e.clean,
      )
      const expectedState = cancelAt === 'none' ? 'ready-and-read' : 'cancelled'
      const passed =
        result.state === expectedState &&
        result.failure !== 'cleanup' &&
        clean &&
        result.created === result.terminated
      runs.push({ ...result, passed })
      console.log(JSON.stringify({ cancelAt, state: result.state, clean, passed }))
    } finally {
      await context.close()
    }
  }
  assert(runs.every((run) => run.passed))
  assert.equal(external, 0)
  assert.equal(cameraRequests, 0)
  assert.equal(errors.length, 0)
} catch (e) {
  failure = { name: e.name, message: e.message.split('\n')[0] }
} finally {
  const version = browser?.version()
  await browser?.close()
  await server.close()
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual Chrome/SDK heavy+face+hands; generated blank input; private metadata instrumentation; fresh documents, shared browser and worker bundle cache',
        version,
        before,
        after: hashes(),
        runs,
        external,
        cameraRequests,
        errors,
        failure,
        notProven: [
          'real people/pose accuracy',
          'original intermittent P2 root cause',
          'cold driver/cache performance',
          'correct stretching/reference/recommendation',
          'production deployment',
        ],
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output: `${scratch}/${label}.json`, failure }))
if (failure) process.exitCode = 1
