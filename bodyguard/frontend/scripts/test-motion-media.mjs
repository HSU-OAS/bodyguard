// FR-S-06·NFR-08: actual decoded own Blender media/React; controlled account, camera forbidden.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, label] = process.argv.slice(2)
const sourceFiles = [
  'src/catalog/motionMedia.ts',
  'src/pages/CoachingPage.tsx',
  'src/pages/MotionSelectionPage.tsx',
  'src/pages/MotionPreview.tsx',
  'src/pages/CoachingPage.css',
  'scripts/dev-motion-media.ts',
  'scripts/test-motion-media.mjs',
  'vite.config.ts',
  'pnpm-lock.yaml',
  '../docs/review/motion-preview-content/media/manifest.json',
]
const snapshot = () =>
  Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash('sha256').update(readFileSync(path)).digest('hex'),
    ]),
  )
const sourceBefore = snapshot()
assert(/^\/private\/tmp\/bodyguard-motion-media\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label) && !existsSync(`${scratch}/${label}.json`))
let account = true,
  browser,
  failure,
  external = 0,
  camera = 0,
  tamper = false
let tamperPoster = false
const cases = [],
  decoded = [],
  errors = [],
  requests = []
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/api/v1/me') {
    res.statusCode = account ? 200 : 401
    res.end(account ? '{"id":"media-fixture","email":"fixture@example.com"}' : '{}')
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
const sha = (b) => createHash('sha256').update(b).digest('hex')
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    channel: 'chrome',
    proxy: { server: 'http://127.0.0.1:1', bypass: `<-loopback>,${new URL(origin).host}` },
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    serviceWorkers: 'block',
    reducedMotion: 'no-preference',
  })
  await context.exposeFunction('forbiddenMediaCamera', () => camera++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.forbiddenMediaCamera()
      return Promise.reject(new Error('Physical camera forbidden'))
    }
  })
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== new URL(origin).origin) {
      external++
      return route.abort()
    }
    if (url.pathname.startsWith('/__bodyguard/motion-media/')) requests.push(url.pathname)
    if (tamper && url.pathname.endsWith('/male/neck-side.mp4'))
      return route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: 'controlled invalid video',
      })
    if (tamperPoster && url.pathname.endsWith('/male/neck-side.png'))
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: 'controlled invalid poster',
      })
    return route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.name))
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await page.getByRole('button', { name: '동작 변경', exact: true }).waitFor()
  assert.equal(await page.locator('video').count(), 0)
  assert.equal(requests.length, 0)
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByLabel('아바타 형태').selectOption('female')
  await page.getByRole('button', { name: '화면 설정 닫기', exact: true }).click()
  await page.getByRole('button', { name: '동작 변경', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '동작 고르기' })
  await dialog.locator('video').first().waitFor({ state: 'attached' })
  assert.equal(await dialog.locator('.motion-visual img').first().isVisible(), true)
  assert.equal(await dialog.locator('video').count(), 3)
  assert(
    (await dialog.locator('video').evaluateAll((videos) => videos.map((v) => v.src))).every((url) =>
      url.includes('/female/'),
    ),
  )
  await dialog.getByRole('group', { name: '목 옆으로 기울이기 미리보기' }).hover()
  await page.waitForFunction(() =>
    [...document.querySelectorAll('video')].some((v) => v.currentTime > 0.4 && !v.paused),
  )
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelectorAll('video').length === 0)
  cases.push(
    'closed coaching picker loads no media; open female picker decodes preview; Escape retires all videos',
  )
  await page.goto(`${origin}dev/select`)
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
  const videos = page.locator('video')
  assert.equal(await videos.count(), 3)
  assert(
    (
      await videos.evaluateAll((list) =>
        list.map((v) => v.preload === 'none' && v.paused && v.srcObject === null && v.muted),
      )
    ).every(Boolean),
  )
  const neck = page.getByRole('group', { name: '목 옆으로 기울이기 미리보기' }),
    neckVideo = neck.locator('video')
  await neck.hover()
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.1)
  const initial = await neckVideo.screenshot()
  await page.waitForFunction(() => document.querySelector('video').currentTime > 1.7)
  const moved = await neckVideo.screenshot({ path: `${scratch}/${label}-neck-moving.png` })
  assert.notEqual(sha(initial), sha(moved))
  assert(await neckVideo.evaluate((v) => v.getVideoPlaybackQuality().totalVideoFrames > 1))
  const next = page.getByRole('button', { name: '어깨 으쓱·이완 미리보기 재생' })
  await next.focus()
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('video')].filter((v) => !v.paused).length === 1 &&
      document.querySelector('video').paused,
  )
  cases.push(
    'actual h264 decode and changing avatar pixels on hover; keyboard focus transfers the only active preview',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).focus()
  await neck.hover()
  assert((await videos.evaluateAll((list) => list.map((v) => v.paused))).every(Boolean))
  await neck.getByRole('button', { name: '목 옆으로 기울이기 미리보기 재생' }).click()
  await page.waitForFunction(() => !document.querySelector('video').paused)
  await neck.getByRole('button', { name: '목 옆으로 기울이기 미리보기 정지' }).click()
  assert(await neckVideo.evaluate((v) => v.paused))
  cases.push(
    'native reduced-motion blocks hover/focus autoplay; explicit keyboard-accessible play/stop still works',
  )
  tamper = true
  await page.reload()
  await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
  await page.getByRole('button', { name: '목 옆으로 기울이기 미리보기 재생' }).click()
  await page.getByText('미리보기를 불러오지 못했습니다', { exact: true }).waitFor()
  tamper = false
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click()
  await page.getByRole('button', { name: '목 옆으로 기울이기 미리보기 재생' }).click()
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.2)
  cases.push(
    'controlled invalid decoded video fails visibly; explicit reload/replay recovers with actual media',
  )
  tamperPoster = true
  await page.reload()
  await page.getByText('미리보기를 불러오지 못했습니다', { exact: true }).waitFor()
  tamperPoster = false
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click()
  await page.waitForFunction(() => {
    const img = document.querySelector('.motion-visual img')
    return img?.complete && img.naturalWidth > 0
  })
  await page.getByRole('button', { name: '목 옆으로 기울이기 미리보기 재생' }).click()
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.2)
  cases.push(
    'controlled broken poster fails visibly; owned poster reload recovers without camera or automatic playback',
  )
  const demonstrate = async (scope, gender) => {
    for (const [id, title] of [
      ['neck-side', '목 옆으로 기울이기'],
      ['shoulder-shrug', '어깨 으쓱·이완'],
      ['arm-overhead', '팔 위로 뻗기'],
    ]) {
      const group = scope.getByRole('group', { name: `${title} 미리보기` })
      const stop = group.getByRole('button', { name: `${title} 미리보기 정지` })
      if (await stop.count()) await stop.click()
      await group.getByRole('button', { name: `${title} 미리보기 재생` }).click()
      await group.locator('video').evaluate(
        (video) =>
          new Promise((resolve, reject) => {
            const limit = setTimeout(() => reject(new Error('Decoded frame missing')), 5000)
            const check = () => {
              if (video.currentTime > 0.3 && video.getVideoPlaybackQuality().totalVideoFrames > 1) {
                clearTimeout(limit)
                resolve()
              } else requestAnimationFrame(check)
            }
            check()
          }),
      )
      assert.equal(await group.locator('video').evaluate((video) => video.videoWidth), 512)
      decoded.push(`${gender}/${id}`)
      await stop.click()
      assert.equal(await group.locator('img').isVisible(), true)
      assert.equal(await group.locator('video').isVisible(), false)
    }
  }
  await demonstrate(page, 'male')
  await page.screenshot({ path: `${scratch}/${label}-catalog.png`, fullPage: true })
  await page.setViewportSize({ width: 800, height: 1000 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert(
    await page
      .locator('.motion-list .motion-visual')
      .evaluateAll((groups) =>
        groups.every(
          (group) =>
            group.getBoundingClientRect().width <=
            group.closest('li').getBoundingClientRect().width + 1,
        ),
      ),
  )
  await page.screenshot({ path: `${scratch}/${label}-catalog-800.png`, fullPage: true })
  await page.goto(`${origin}dev/coaching?motion=neck-side`)
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await page.getByLabel('아바타 형태').selectOption('female')
  await page.getByRole('button', { name: '화면 설정 닫기', exact: true }).click()
  await page.getByRole('button', { name: '동작 변경', exact: true }).click()
  await demonstrate(page.getByRole('dialog', { name: '동작 고르기' }), 'female')
  assert.equal(new Set(decoded).size, 6)
  assert(
    await page
      .locator('.coaching-motion-grid .motion-visual')
      .evaluateAll((groups) =>
        groups.every(
          (group) =>
            group.getBoundingClientRect().width <=
            group.closest('li').getBoundingClientRect().width + 1,
        ),
      ),
  )
  cases.push(
    'all six own Blender clips decode actual512px frames; stopping restores the representative poster',
  )
  await page.screenshot({ path: `${scratch}/${label}-female-picker.png`, fullPage: true })
  account = false
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
  assert.equal(await page.locator('video').count(), 0)
  assert.equal(page.workers().length, 0)
  assert.equal(camera, 0)
  assert.equal(external, 0)
  assert.equal(errors.length, 0)
  cases.push('controlled401 removes private previews; camera/SDK workers/external/page errors0')
  await context.close()
} catch (e) {
  failure = { name: e.name, message: e.message.split('\n')[0] }
  process.exitCode = 1
} finally {
  await browser?.close()
  await server.close()
  api.closeAllConnections()
  await new Promise((yes) => api.close(yes))
  const sourceAfter = snapshot()
  if (JSON.stringify(sourceBefore) !== JSON.stringify(sourceAfter)) {
    failure = { name: 'SourceChanged', message: 'Runtime source changed during verification' }
    process.exitCode = 1
  }
  writeFileSync(
    `${scratch}/${label}.json`,
    JSON.stringify(
      {
        sourceBefore,
        sourceAfter,
        decoded,
        browserVersion: browser?.version(),
        cases,
        requests,
        errors,
        external,
        camera,
        failure: failure ?? null,
        actualDecodedMedia: true,
        syntheticAccountAPI: true,
        actualPeople: false,
        clinicalVerification: false,
        finalAvatar: false,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(
  JSON.stringify({
    output: `${scratch}/${label}.json`,
    passed: cases.length,
    failure: failure ?? null,
  }),
)
