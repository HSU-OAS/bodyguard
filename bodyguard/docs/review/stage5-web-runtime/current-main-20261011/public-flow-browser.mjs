// Actual exported production HTML/JS/CSS in Chrome; API answers are synthetic.
// This is not Docker, NGINX, TLS, authentication/provider, coaching, or clinical proof.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { createServer as createSink } from 'node:net'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const [frontendInput, packageInput] = process.argv.slice(2)
assert(frontendInput && packageInput, 'Explicit frontend and package directories required')
const frontend = resolve(frontendInput)
const directory = resolve(packageInput)
const { chromium } = createRequire(join(frontend, 'package.json'))('@playwright/test')
const sha = (data) => createHash('sha256').update(data).digest('hex')
const files = ['index.html', 'brand/google-icon.png', 'licenses/bundled-js.json',
  'licenses/bundled-packages.json', 'licenses/tailwindcss.txt',
  ...readdirSync(join(directory, 'assets')).map((file) => `assets/${file}`)]
const inputs = new Map(files.map((file) => [`/${file}`, readFileSync(join(directory, file))]))
const hashes = Object.fromEntries([...inputs].map(([path, bytes]) => [path, sha(bytes)]))
assert.equal(files.length, 7)
// Explicit test-server routes only; do not infer NGINX behavior from this server.
const spa = /^\/(?:start|explore|login|signup|help|data|posture-records|password\/(?:forgot|reset)|account(?:\/(?:delete|notifications))?|records(?:\/[^/]+)?)\/?$/i
const apiRequests = []
const mime = { html: 'text/html', js: 'text/javascript', css: 'text/css',
  png: 'image/png', json: 'application/json', txt: 'text/plain' }
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  if (path.startsWith('/api/')) {
    apiRequests.push({ method: request.method, path })
    const google = request.method === 'GET' && path === '/api/v1/auth/google/status'
    const guest = request.method === 'GET' && path === '/api/v1/me'
    response.writeHead(google ? 200 : guest ? 401 : 503,
      { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    return response.end(JSON.stringify(google ? { configured: false } :
      { detail: 'Synthetic unavailable/guest response; no real account operation' }))
  }
  const selected = inputs.has(path) ? path : path === '/' || spa.test(path) ? '/index.html' : null
  if (request.method !== 'GET' || !selected) {
    response.writeHead(404, { 'Content-Type': 'text/plain' })
    return response.end('Not found')
  }
  response.writeHead(200, { 'Content-Type': `${mime[selected.split('.').pop()]}; charset=utf-8`,
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' })
  response.end(inputs.get(selected))
})
const sink = createSink((socket) => socket.destroy())
const listen = (resource) => new Promise((done, reject) => {
  resource.once('error', reject)
  resource.listen(0, '127.0.0.1', done)
})
const close = (resource) => new Promise((done, reject) => {
  if (!resource.listening) return done()
  resource.close((error) => error ? reject(error) : done())
})
let browser
let stage = 'server'
let externalRequests = 0
const pageErrors = []
const screens = []
try {
  await listen(server)
  await listen(sink)
  const origin = `http://127.0.0.1:${server.address().port}`
  stage = 'launch'
  browser = await chromium.launch({ channel: 'chrome', headless: true,
    proxy: { server: `http://127.0.0.1:${sink.address().port}`, bypass: '127.0.0.1' } })
  for (const width of [1440, 1024]) {
    stage = `viewport-${width}`
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        externalRequests += 1
        return route.abort()
      }
      return route.continue()
    })
    await context.addInitScript(() => {
      window.__captureCalls = 0
      window.__storageWrites = 0
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => {
        window.__captureCalls += 1
        throw new Error('Camera prohibited in public-flow test')
      }
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (...args) {
        window.__storageWrites += 1
        return original.apply(this, args)
      }
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const screen = async (heading, title) => {
      await page.getByRole('heading', { level: 1, name: heading }).waitFor()
      assert.equal(await page.title(), `${title} · BODYGUARD`)
      const state = await page.evaluate(() => ({
        cameraCalls: window.__captureCalls, storageWrites: window.__storageWrites,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      }))
      assert.deepEqual(state, { cameraCalls: 0, storageWrites: 0, horizontalOverflow: false })
      screens.push({ width, path: new URL(page.url()).pathname, heading, ...state })
    }
    await page.goto(`${origin}/`, { waitUntil: 'load' })
    await screen('내 몸을 이해하는 스트레칭', '서비스 소개')
    await page.getByRole('link', { name: '시작하기', exact: false }).click()
    await screen('다시 만나 반갑습니다', '로그인')
    assert.equal(new URL(page.url()).searchParams.get('next'), '/start')
    await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).waitFor()
    assert(await page.getByRole('button', { name: 'Google로 계속하기' }).isDisabled())
    await page.getByRole('button', { name: '비밀번호 표시', exact: true }).click()
    assert.equal(await page.locator('#account-password').getAttribute('type'), 'text')
    await page.getByRole('button', { name: '비밀번호 숨기기', exact: true }).click()
    assert.equal(await page.locator('#account-password').getAttribute('type'), 'password')
    await page.getByRole('link', { name: '비밀번호를 잊으셨나요?', exact: true }).click()
    await screen('비밀번호 재설정 요청', '계정 복구')
    await page.goto(`${origin}/signup?next=%2Fstart`)
    await screen('나를 위한 움직임의 시작', '이메일 가입')
    await page.getByRole('link', { name: '로그인', exact: true }).last().click()
    await screen('다시 만나 반갑습니다', '로그인')
    for (const [path, heading, title] of [
      ['/HELP/', '도움말', '도움말'],
      ['/DaTa/', '카메라와 데이터 안내', '카메라와 데이터 안내'],
      ['/LoGiN/', '다시 만나 반갑습니다', '로그인'],
      ['/PaSsWoRd/RESET/', '새 링크가 필요합니다', '계정 복구'],
    ]) {
      await page.goto(`${origin}${path}`)
      await screen(heading, title)
      await page.reload()
      await screen(heading, title)
    }
    await page.getByRole('link', { name: '재설정 다시 요청', exact: true }).click()
    await screen('비밀번호 재설정 요청', '계정 복구')
    if (width === 1440) await page.screenshot({ path: join(directory, '..', 'public-recovery.png') })
    await context.close()
  }
  assert.equal(externalRequests, 0)
  assert.deepEqual(pageErrors, [])
  assert(apiRequests.length > 0)
  assert(apiRequests.every(({ method, path }) => method === 'GET' &&
    ['/api/v1/me', '/api/v1/auth/google/status'].includes(path)))
  for (const [path, expected] of Object.entries(hashes)) {
    assert.equal(sha(readFileSync(join(directory, path.slice(1)))), expected)
  }
  const report = { browser: browser.version(), screens, apiRequests, externalRequests,
    pageErrors, packageHashes: hashes, packageUnchanged: true,
    server: 'Owned loopback HTTP test server, not NGINX', api: 'Synthetic guest and Google-unavailable fixtures',
    actualAuthenticationVerified: false, smtpVerified: false, googleLoginVerified: false,
    dockerVerified: false, nginxVerified: false, tlsVerified: false, coachingVerified: false }
  await browser.close()
  browser = undefined
  server.closeAllConnections()
  await close(server)
  await close(sink)
  assert(!server.listening && !sink.listening)
  console.log(JSON.stringify({ ...report, ownedResourcesClosed: true }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ stage, failure: String(error), screens, pageErrors, externalRequests,
    verified: false }, null, 2))
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.closeAllConnections()
  await close(server)
  await close(sink)
}
