// FR-V-01/03·FR-S-06·NFR-08: actual React UI; controlled account API, no SDK/avatar.
import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import { createServer as createHTTPServer } from 'node:http'
import { chromium } from '@playwright/test'
import { createServer, mergeConfig } from 'vite'
import config from '../vite.config.ts'

const [scratch, executable, label] = process.argv.slice(2)
assert(/^\/private\/tmp\/bodyguard-coaching-ui\.[A-Za-z0-9]+$/.test(scratch))
assert(/^[a-z][a-z0-9-]+$/.test(label))
const output = `${scratch}/${label}.json`
assert(!existsSync(output))
let account = 'ready',
  cameraCalls = 0,
  external = 0,
  modelRequests = 0
const errors = [],
  results = []
const api = createHTTPServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  if (req.url === '/api/v1/me') {
    res.writeHead(account === 'ready' ? 200 : account === 'guest' ? 401 : 503)
    res.end(
      account === 'ready' ? '{"id":"controlled-ui-fixture","email":"fixture@example.com"}' : '{}',
    )
  } else if (req.url === '/api/v1/auth/google/status') res.end('{"configured":false}')
  else {
    res.writeHead(404)
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
let browser, failure
try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({
    executablePath: executable,
    proxy: { server: 'http://127.0.0.1:1', bypass: '127.0.0.1' },
  })
  // Desktop/narrow laptop web; not a mobile-browser support claim.
  for (const width of [1440, 1024, 800]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    })
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        window.cameraCalls = (window.cameraCalls ?? 0) + 1
        throw new Error('No camera in structure review')
      }
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => errors.push(e.name))
    context.on('request', (request) => {
      if (!request.url().startsWith(origin)) external++
      if (/\.glb|\.task|mediapipe/.test(request.url())) modelRequests++
    })
    try {
      account = 'ready'
      await page.goto(`${origin}dev/select?search=${encodeURIComponent('목')}&region=neck`)
      await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
      await page.screenshot({ path: `${scratch}/${label}-selection-${width}.png`, fullPage: true })
      await page.getByRole('link', { name: '목 옆으로 기울이기 안내 보기' }).click()
      await page.getByRole('link', { name: '코칭 화면 구조 보기' }).click()
      await page.getByRole('heading', { name: '목 옆으로 기울이기', level: 1 }).waitFor()
      const space = page.getByRole('region', { name: '두 아바타 공간' })
      assert.equal(await space.getAttribute('data-view'), 'full')
      await page.getByRole('button', { name: '상반신', exact: true }).click()
      assert.equal(await space.getAttribute('data-view'), 'upper')
      assert.equal(await page.getByRole('button', { name: '코칭 준비 중' }).isDisabled(), true)
      assert.equal(await page.getByRole('button', { name: '전체 시범' }).isDisabled(), true)
      await page.getByRole('button', { name: '전신', exact: true }).click()
      await page.screenshot({ path: `${scratch}/${label}-workspace-${width}.png`, fullPage: true })
      const trigger = page.getByRole('button', { name: '동작 변경', exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: '동작 고르기' })
      await dialog.waitFor()
      assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true)
      await page.getByLabel('동작 검색', { exact: true }).fill('없는 동작')
      await dialog.getByText('조건에 맞는 동작이 없습니다').waitFor()
      await dialog.getByRole('button', { name: '검색과 필터 초기화' }).click()
      await page.screenshot({ path: `${scratch}/${label}-picker-${width}.png`, fullPage: true })
      await page.keyboard.press('Escape')
      assert.equal(await trigger.evaluate((node) => node === document.activeElement), true)
      await trigger.press('Enter')
      await page.keyboard.press('Tab')
      assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true)
      await page.keyboard.press('Shift+Tab')
      await dialog.getByRole('button', { name: '어깨', exact: true }).click()
      const choice = dialog.getByRole('button', { name: '어깨 으쓱·이완 화면에서 보기' })
      // A mouse-origin programmatic focus is not necessarily :focus-visible.
      // Reach the card with actual keyboard input before checking its focus ring.
      for (let tab = 0; tab < 12; tab++) {
        await page.keyboard.press('Tab')
        if (await choice.evaluate((node) => node === document.activeElement)) break
      }
      assert.equal(await choice.evaluate((node) => node === document.activeElement), true)
      assert.equal(await choice.evaluate((node) => node.matches(':focus-visible')), true)
      assert.equal(await choice.evaluate((node) => getComputedStyle(node).outlineOffset), '-4px')
      if (width === 800) {
        await dialog.evaluate((node) => {
          node.style.zoom = '2'
        })
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        )
        await dialog.evaluate((node) => {
          node.style.zoom = ''
        })
      }
      await dialog.getByRole('button', { name: '어깨 으쓱·이완 화면에서 보기' }).click()
      await page.getByRole('heading', { name: '어깨 으쓱·이완', level: 1 }).waitFor()
      assert.equal(
        await page
          .getByRole('heading', { level: 1 })
          .evaluate((node) => node === document.activeElement),
        true,
      )
      await page.getByRole('button', { name: '설정', exact: true }).click()
      const settings = page.getByRole('dialog', { name: '화면 설정' })
      await settings.getByLabel('표시 구도').selectOption('detail')
      await settings.getByLabel('아바타 형태').selectOption('female')
      await settings.getByRole('button', { name: '화면 설정 닫기' }).click()
      assert.equal(await space.getAttribute('data-view'), 'detail')
      assert.equal(await space.getAttribute('data-avatar'), 'female')
      await page.getByText('수행 안내', { exact: true }).click()
      await page
        .getByText('통증이나 어지러움이 생기면 즉시 멈추고 전문가에게 상담하세요.', { exact: true })
        .waitFor()
      assert.equal(await page.locator('video, canvas').count(), 0)
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      )
      const labels = await space.locator('.coaching-role-labels > span').allTextContents()
      assert.deepEqual(labels, ['내 움직임', '현재 단계 시범'])
      await page.getByRole('link', { name: '나가기', exact: true }).click()
      await page.getByRole('heading', { name: '원하는 동작을 골라보세요' }).waitFor()
      assert.equal(await page.getByLabel('동작 검색', { exact: true }).inputValue(), '목')
      assert.equal(
        await page.getByRole('button', { name: '목', exact: true }).getAttribute('aria-pressed'),
        'true',
      )
      await page.goto(`${origin}dev/coaching?motion=__proto__`)
      await page.getByRole('heading', { name: '동작을 찾을 수 없습니다' }).waitFor()
      account = 'guest'
      await page.reload()
      await page.getByRole('heading', { name: '다시 만나 반갑습니다' }).waitFor()
      assert.equal(await page.getByRole('region', { name: '두 아바타 공간' }).count(), 0)
      account = 'offline'
      await page.goto(`${origin}dev/coaching`)
      await page.getByRole('heading', { name: '연결을 확인해 주세요' }).waitFor()
      cameraCalls += await page.evaluate(() => window.cameraCalls ?? 0)
      assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0)
      results.push({
        width,
        passed: true,
        flow: 'select/detail→workspace/views→search/empty/reset→Escape/focus→keyboard/change→settings→guidance→exit→unknown→guest/offline',
        avatars: 'not connected',
        media: 'absent; no playback or decoded motion claim',
      })
    } finally {
      await context.close()
    }
  }
  assert.equal(cameraCalls, 0)
  assert.equal(external, 0)
  assert.equal(modelRequests, 0)
  assert.equal(errors.length, 0)
} catch (e) {
  failure = { name: e.name, message: e.message }
} finally {
  await browser?.close()
  await server.close()
  api.closeAllConnections()
  await new Promise((yes) => api.close(yes))
  writeFileSync(
    output,
    JSON.stringify(
      {
        method:
          'actual development React/Vite; controlled account API; reduced motion; no browser route interception',
        results,
        cameraCalls,
        external,
        modelRequests,
        errors,
        failure: failure ?? null,
      },
      null,
      2,
    ),
    { flag: 'wx' },
  )
}
console.log(JSON.stringify({ output, passed: results.length, failure: failure ?? null }))
if (failure) process.exitCode = 1
