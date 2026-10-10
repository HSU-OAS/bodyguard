// NFR-08 / Q-11: 실제 선별 package의 Chrome/loopback HTTP 전달만 검증한다.
// NGINX·Docker·TLS·API·카메라·법무 승인을 모의 서버 결과로 대체하지 않는다.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer as httpServer } from 'node:http'
import { createServer as tcpServer } from 'node:net'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { checkBuildNotices } from './check-build-notices.ts'

const sha = (data) => createHash('sha256').update(data).digest('hex')
const noticeTypes = new Map([
  ['/licenses/bundled-js.json', 'application/json'],
  ['/licenses/bundled-packages.json', 'application/json'],
  ['/licenses/tailwindcss.txt', 'text/plain'],
])
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
const close = (server) =>
  new Promise((resolve, reject) => {
    if (!server.listening) return resolve()
    server.close((error) => (error ? reject(error) : resolve()))
  })
const sink = tcpServer((socket) => socket.destroy())
let browser
let server
let externalRequests = 0
let stage = 'input'
try {
  assert(process.argv.length === 3, 'Explicit package directory required')
  const directory = resolve(process.argv[2])
  const frontend = fileURLToPath(new URL('../', import.meta.url))
  const notices = checkBuildNotices(frontend, directory)
  const input = new Map(
    [...noticeTypes.keys()].map((path) => [path, readFileSync(join(directory, path.slice(1)))]),
  )
  server = httpServer((request, response) => {
    // 시험 server는 고지3개 외에는 모두404이며 API/SPA 성공을 만들어내지 않는다.
    if (request.method !== 'GET' || !input.has(request.url)) {
      response.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' })
      return response.end('Not found')
    }
    response.writeHead(200, {
      'Content-Type': `${noticeTypes.get(request.url)}; charset=utf-8`,
      'X-Content-Type-Options': 'nosniff',
    })
    response.end(input.get(request.url))
  })
  stage = 'server'
  await listen(server)
  await listen(sink)
  const origin = `http://127.0.0.1:${server.address().port}`
  stage = 'browser'
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    proxy: { server: `http://127.0.0.1:${sink.address().port}`, bypass: '127.0.0.1' },
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      externalRequests += 1
      return route.abort()
    }
    return route.continue()
  })
  const page = await context.newPage()
  const delivered = []
  stage = 'delivery'
  for (const [path, type] of noticeTypes) {
    const response = await page.goto(`${origin}${path}`, { waitUntil: 'load', timeout: 10000 })
    assert(response && response.status() === 200, 'Notice response failed')
    assert.equal(
      response.headers()['content-type'].split(';')[0].trim().toLowerCase(),
      type,
      'Wrong notice content-type',
    )
    assert.equal(response.headers()['x-content-type-options'], 'nosniff')
    const body = await response.body()
    assert.equal(sha(body), sha(input.get(path)), 'Browser notice bytes differ')
    assert.equal(
      sha(readFileSync(join(directory, path.slice(1)))),
      sha(input.get(path)),
      'Package changed during delivery',
    )
    delivered.push({
      path,
      status: response.status(),
      contentType: response.headers()['content-type'],
      bodySHA256: sha(body),
    })
  }
  const denied = []
  stage = 'denials'
  for (const path of [
    '/licenses/missing.txt',
    '/licenses/bundled-js.json/extra',
    '/.env',
    '/api/auth/me',
  ]) {
    const response = await page.goto(`${origin}${path}`, { waitUntil: 'load', timeout: 10000 })
    assert(response && response.status() === 404, 'Unexpected fallback')
    denied.push({ path, status: 404 })
  }
  assert.equal(externalRequests, 0)
  const report = {
    browser: browser.version(),
    delivered,
    denied,
    noticeFilesUnchanged: true,
    externalRequests,
    jsNotices: notices.jsNotices.length,
    server: 'Owned test HTTP server, not NGINX',
    dockerVerified: false,
    tlsVerified: false,
    accountFlowVerified: false,
    legalApproved: false,
  }
  await context.close()
  await browser.close()
  browser = undefined
  await close(server)
  await close(sink)
  assert(!server.listening && !sink.listening)
  console.log(JSON.stringify({ ...report, ownedResourcesClosed: true }, null, 2))
} catch {
  console.error(
    `Packaged notice browser verification failed (${stage}); no release approval granted`,
  )
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server) {
    server.closeAllConnections()
    await close(server)
  }
  await close(sink)
}
