// FR-S-03/04·FR-A-01/03: actual React/Chrome/WebGL/own GLB, no camera or clinical claims.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-reference-content\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
const sha = (b) => createHash('sha256').update(b).digest('hex')
const files = [
  'src/pages/CoachingPage.tsx',
  'src/pages/CoachingPage.css',
  'src/pages/ReferenceDemonstration.tsx',
  'src/avatar/referenceStage.ts',
  'src/avatar/referenceFraming.ts',
  'src/avatar/blenderReferenceProgram.ts',
  'src/avatar/referenceContentAssets.ts',
  'src/avatar/reviewAvatarAssets.ts',
  'src/avatar/verifiedReferenceAsset.ts',
  'scripts/dev-reference-content.ts',
  'scripts/test-reference-content.mjs',
  'vite.config.ts',
  'pnpm-lock.yaml',
]
const snapshot = () => Object.fromEntries(files.map((file) => [file, sha(readFileSync(file))]))
const before = snapshot(),
  cases = [],
  requests = [],
  errors = [],
  displayed = []
let browser,
  failure = null,
  external = 0,
  cameras = 0,
  account = true,
  tamper = false
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/api/v1/me') {
    res.statusCode = account ? 200 : 401
    res.end(account ? '{"id":"reference-fixture","email":"fixture@example.com"}' : '{}')
  } else {
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
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  await context.exposeFunction('referenceCameraDenied', () => cameras++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.referenceCameraDenied()
      return Promise.reject(new Error('Physical camera forbidden'))
    }
  })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== new URL(origin).origin) {
      external++
      return route.abort()
    }
    if (url.pathname.endsWith('.glb')) requests.push(url.pathname)
    if (tamper && url.pathname.startsWith('/__bodyguard/reference-content/'))
      return route.fulfill({
        status: 200,
        contentType: 'model/gltf-binary',
        body: 'Controlled corrupt candidate',
      })
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  const canvas = page.getByRole('img', { name: '3D 시범 후보', exact: true })
  const image = async (name) => {
    await page.evaluate(() => scrollTo(0, 0))
    const bytes = await canvas.screenshot()
    if (name) writeFileSync(`${scratch}/${label}-${name}.png`, bytes, { flag: 'wx' })
    return sha(bytes)
  }
  const open = async () => {
    await page.getByRole('button', { name: '시범 미리보기', exact: true }).click()
    await page.getByText('시범 후보 · 자동 판정 없음', { exact: true }).waitFor({ timeout: 16000 })
    assert.equal(
      await page.getByRole('button', { name: '시범 재생', exact: true }).isEnabled(),
      true,
    )
    assert.equal(await page.getByRole('button', { name: '코칭 준비 중' }).isDisabled(), true)
  }
  const ownedCanvas = async () => {
    const element = await canvas.elementHandle()
    assert(element)
    assert.equal(
      await element.evaluate((node) =>
        Boolean(node.getContext('webgl2') && !node.getContext('webgl2').isContextLost()),
      ),
      true,
    )
    return element
  }
  const retired = async (element) => {
    await page.waitForFunction(
      (node) => node.getContext('webgl2')?.isContextLost() === true,
      element,
      { timeout: 5000 },
    )
    await element.dispose()
    assert.equal(await page.locator('canvas').count(), 0)
  }
  const close = async () => {
    const element = await ownedCanvas()
    await page.getByRole('button', { name: '시범 닫기', exact: true }).click()
    await retired(element)
  }
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await page.getByRole('button', { name: '시범 미리보기', exact: true }).waitFor()
  assert.equal(await page.locator('canvas,video').count(), 0)
  assert.equal(requests.length, 0)
  await open()
  const rest = await image('male-neck-ready')
  await page.waitForTimeout(300)
  assert.equal(await image(), rest, 'Opening/reduced-motion must not start animation')
  cases.push('explicit open only; actual GLB/shaders prepared but no autoplay under reduced-motion')
  await page.getByRole('button', { name: '수행 시범 단계 재생' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '시범 일시정지', exact: true }).click()
  await page.waitForTimeout(100)
  const paused = await image('male-neck-paused')
  assert.notEqual(paused, rest)
  await page.waitForTimeout(350)
  assert.equal(await image(), paused, 'Paused guide must not catch up in background')
  await page.getByRole('button', { name: '시범 재생', exact: true }).click()
  await page.waitForTimeout(1400)
  const left = await image('male-neck-left')
  assert.notEqual(left, paused)
  await page.getByRole('button', { name: '오른쪽 시범', exact: true }).click()
  await page.waitForTimeout(1700)
  const right = await image('male-neck-right')
  assert.notEqual(right, left)
  await page.getByRole('button', { name: '복귀 시범 단계 재생' }).click()
  await page.waitForTimeout(1700)
  assert.notEqual(await image('male-neck-return'), right)
  cases.push(
    'actual changing guide pixels, pause/resume, distinct authored left/right and return phases',
  )
  await close()
  for (const gender of ['male', 'female'])
    for (const motion of ['neck-side', 'shoulder-shrug', 'arm-overhead']) {
      await page.goto(`${origin}dev/coaching?motion=${motion}`)
      await page.getByRole('button', { name: '설정', exact: true }).click()
      await page.getByLabel('아바타 형태').selectOption(gender)
      await page.getByRole('button', { name: '화면 설정 닫기', exact: true }).click()
      await open()
      const neutral = await image()
      await page.getByRole('button', { name: '수행 시범 단계 재생' }).click()
      await page.waitForTimeout(1800)
      assert.notEqual(await image(`${gender}-${motion}-perform`), neutral)
      displayed.push(`${gender}/${motion}`)
      if (gender === 'female' && motion === 'arm-overhead') {
        for (const label of ['상반신', '자세히', '전신']) {
          await page.getByRole('button', { name: label, exact: true }).click()
          await image(`female-overhead-${label}`)
        }
        await page.setViewportSize({ width: 800, height: 1000 })
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        )
        await image('female-overhead-800')
        await page.setViewportSize({ width: 1440, height: 1100 })
      }
      await close()
    }
  cases.push(
    'all six actual authored candidates render changing WebGL pixels; manual phase controls, views and800px layout',
  )
  await open()
  const lost = await ownedCanvas()
  assert.equal(
    await lost.evaluate((node) => {
      const extension = node.getContext('webgl2').getExtension('WEBGL_lose_context')
      if (!extension) return false
      extension.loseContext()
      return true
    }),
    true,
  )
  await page.getByRole('alert').filter({ hasText: '시범을 준비하지 못했습니다' }).waitFor()
  await page.getByRole('button', { name: '시범 다시 불러오기', exact: true }).click()
  await page.getByText('시범 후보 · 자동 판정 없음', { exact: true }).waitFor({ timeout: 16000 })
  assert.equal(await lost.evaluate((node) => node.getContext('webgl2').isContextLost()), true)
  assert.equal(await lost.evaluate((node) => node.isConnected), false)
  await lost.dispose()
  cases.push(
    'actual WebGL context loss stops guide; explicit reload creates a fresh canvas/context',
  )
  await close()
  tamper = true
  await page.getByRole('button', { name: '시범 미리보기', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '시범을 준비하지 못했습니다' }).waitFor()
  await page.screenshot({ path: `${scratch}/${label}-corrupt-error.png` })
  tamper = false
  await page.getByRole('button', { name: '시범 다시 불러오기', exact: true }).click()
  await page.getByText('시범 후보 · 자동 판정 없음', { exact: true }).waitFor({ timeout: 16000 })
  cases.push('corrupt GLB rejected before parsing; explicit reload recovers the real candidate')
  const hiddenCanvas = await ownedCanvas()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await retired(hiddenCanvas)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(150)
  assert.equal(await page.locator('canvas').count(), 0)
  await open()
  const revokedCanvas = await ownedCanvas()
  account = false
  await page.evaluate(() => dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '로그인', exact: true }).waitFor()
  await retired(revokedCanvas)
  assert.equal(page.workers().length, 0)
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
  assert.equal(external, 0)
  assert.equal(cameras, 0)
  assert.equal(errors.length, 0)
  cases.push(
    'hide retires preview with no auto resume; controlled401 removes private canvas; camera/SDK workers/storage/external0',
  )
} catch (e) {
  failure = { name: e.name, message: e.message.split('\n')[0] }
} finally {
  const version = browser?.version()
  await browser?.close()
  await server.close()
  await new Promise((yes) => api.close(yes))
  const after = snapshot()
  assert.deepEqual(before, after)
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        method:
          'actual React/Chrome/WebGL and preserved professional GLB + Blender animation assets; controlled account API and corrupt GLB; no camera/people',
        version,
        before,
        after,
        cases,
        displayed,
        requests,
        external,
        cameras,
        errors,
        failure,
        finalAvatar: false,
        clinicalVerification: false,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output: `${scratch}/${label}.json`, passed: cases.length, failure }))
if (failure) process.exitCode = 1
