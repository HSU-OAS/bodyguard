// NFR-08: inspect real Vite document/Worker response policies and HMR socket.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'
import { SDK_DEV_POLICY } from './sdk-network-policy.ts'

const [scratch, executable] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-sdk-policy\.[A-Za-z0-9]+$/.test(scratch))
const output = `${scratch}/development.json`
assert(!existsSync(output))
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    envDir: scratch,
    server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
  }),
)
let browser, failure
const result = { workerHeader: false, documentPolicy: false, pageErrors: [], hmrConnected: false }
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  const worker = await fetch(`${origin}src/pose/nativeInference.worker.ts?worker_file&type=classic`)
  assert(worker.ok)
  assert.equal(worker.headers.get('content-security-policy'), SDK_DEV_POLICY)
  result.workerHeader = true
  browser = await chromium.launch({
    executablePath: executable,
    proxy: { server: 'http://127.0.0.1:1', bypass: '127.0.0.1' },
  })
  const page = await browser.newPage()
  page.on('pageerror', (e) => result.pageErrors.push(e.name))
  page.on('websocket', (socket) => {
    socket.on('framereceived', (event) => {
      if (typeof event.payload === 'string' && event.payload.includes('"connected"'))
        result.hmrConnected = true
    })
  })
  await page.goto(origin)
  await page.getByRole('link', { name: '로그인', exact: true }).first().waitFor()
  assert.equal(
    await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content'),
    SDK_DEV_POLICY,
  )
  result.documentPolicy = true
  assert.equal(result.hmrConnected, true)
  assert.equal(result.pageErrors.length, 0)
} catch (e) {
  failure = { name: e.name, message: e.message }
} finally {
  await browser?.close()
  await server.close()
  writeFileSync(
    output,
    JSON.stringify(
      {
        ...result,
        policySHA256: createHash('sha256').update(SDK_DEV_POLICY).digest('hex'),
        failure: failure ?? null,
        boundary: 'actual dev response/header/document/HMR only; no dev native SDK inference claim',
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output, failure: failure ?? null }))
if (failure) process.exitCode = 1
