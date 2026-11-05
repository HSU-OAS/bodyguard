// FR-M-01/02/07: native fake camera, real SDK and reference stage; no participant.
import assert from 'node:assert/strict'
import { createServer as createHTTPServer } from 'node:http'
import { isAbsolute } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const executable = process.argv[2]
assert(executable && isAbsolute(executable), 'Chrome 절대 경로가 필요합니다')
const api = createHTTPServer((request, response) => {
  response.setHeader('Content-Type', 'application/json')
  if (request.url === '/api/v1/me') response.end('{"id":"fixture","email":"fixture@example.com"}')
  else {
    response.statusCode = 404
    response.end('{}')
  }
})
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve))
const server = await createServer(
  mergeConfig(config, {
    configFile: false,
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      open: false,
      proxy: { '/api': `http://127.0.0.1:${api.address().port}` },
    },
  }),
)
let browser
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    executablePath: executable,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  })
  await context.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.fixtureStreams = []
    navigator.mediaDevices.getUserMedia = async (options) => {
      const stream = await real(options)
      window.fixtureStreams.push(stream)
      return stream
    }
  })
  const page = await context.newPage()
  let external = 0
  context.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(origin).origin) external++
  })
  await page.goto(`${origin}dev/coaching?motion=neck-side&preview=1`)
  await page.getByText('시범 후보 · 자동 판정 없음', { exact: true }).waitFor({ timeout: 30000 })
  assert.equal(await page.evaluate(() => window.fixtureStreams.length), 0)
  await page.getByRole('button', { name: '카메라로 내 움직임 연결', exact: true }).click()
  await page.getByText('연속 입력 확인 중', { exact: true }).waitFor({ timeout: 30000 })
  assert.equal(await page.evaluate(() => window.fixtureStreams.length), 1)
  await page.getByRole('button', { name: '카메라 끄기', exact: true }).click()
  await page.getByRole('button', { name: '카메라 확인', exact: true }).waitFor({ timeout: 15000 })
  await page.waitForFunction(() =>
    window.fixtureStreams.every((stream) =>
      stream.getTracks().every((track) => track.readyState === 'ended'),
    ),
  )
  assert.equal(external, 0)
  console.log(
    'PASS: explicit camera + observation action, native fake camera stopped, no external requests',
  )
  await context.close()
} finally {
  await browser?.close()
  await server.close()
  api.closeAllConnections()
  await new Promise((resolve) => api.close(resolve))
}
