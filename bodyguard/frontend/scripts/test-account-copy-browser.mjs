// S4.D4 / FR-U-03/04/05/NFR-08: production Chrome UI, synthetic API, no mail/SQL claims.
import { strict as assert } from 'node:assert'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const [phase, destination] = process.argv.slice(2)
assert(['baseline', 'final'].includes(phase))
assert(destination?.startsWith('/private/tmp/bodyguard-account-minimal-copy-proof.'))
const root = fileURLToPath(new URL('..', import.meta.url))
const proof = resolve(destination, phase)
mkdirSync(proof, { recursive: false })
const origin = 'http://127.0.0.1:4197'
const sourceFiles = [
  'src/pages/MemberPage.tsx',
  'src/pages/PasswordPage.tsx',
  'src/App.tsx',
  'src/auth.tsx',
  'src/api/auth.ts',
  'src/index.css',
  'pnpm-lock.yaml',
  'scripts/test-account-copy-browser.mjs',
]
const sha = (file) =>
  createHash('sha256')
    .update(readFileSync(resolve(root, file)))
    .digest('hex')
const source = Object.fromEntries(sourceFiles.map((file) => [file, sha(file)]))
for (const [index, file] of sourceFiles.entries())
  copyFileSync(resolve(root, file), resolve(proof, `source-${index}.txt`))
const report = {
  phase,
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  source,
  provenance:
    'Production Vite output / actual Chrome / synthetic API and credentials. No real provider, mail, SQL, webcam or participant.',
  screens: [],
  flows: [],
  failures: [],
}
const sink = createServer((socket) => socket.destroy())
await new Promise((resolve, reject) => {
  sink.once('error', reject)
  sink.listen(0, '127.0.0.1', resolve)
})
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4197',
    '--strictPort',
  ],
  { cwd: root, stdio: 'ignore' },
)
let browser
let cameraCalls = 0
const external = []
const errors = []
const securityText = '변경하면 기존 로그인은 모두 종료됩니다. 카메라는 켜지지 않습니다.'
async function makeContext(options = {}) {
  const state = { signedIn: false, forgot: 202, reset: 204, held: false, posts: 0, release: null }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...options })
  await context.exposeBinding('__copyTestCamera', () => cameraCalls++)
  await context.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => {
      void window.__copyTestCamera()
      return Promise.reject(new Error('Camera prohibited in account UI test'))
    }
  })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== origin) {
      external.push(url.origin)
      return route.abort('blockedbyclient')
    }
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const json = (status, body = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: status === 429 ? { 'Retry-After': '60' } : {},
        body: status === 204 ? undefined : JSON.stringify(body),
      })
    if (url.pathname === '/api/v1/me')
      return json(
        state.signedIn ? 200 : 401,
        state.signedIn ? { id: 'copy-fixture', email: 'copy-fixture@example.com' } : {},
      )
    if (url.pathname === '/api/v1/auth/csrf') return json(200, { csrf_token: 'copy-fixture-csrf' })
    if (url.pathname === '/api/v1/auth/google/status') return json(200, { configured: false })
    if (url.pathname === '/api/v1/auth/logout') {
      state.signedIn = false
      return json(204)
    }
    if (url.pathname === '/api/v1/auth/password/forgot') {
      state.posts++
      if (state.held)
        await new Promise((resolve) => {
          state.release = resolve
        })
      try {
        return await json(state.forgot)
      } catch {
        return
      }
    }
    if (url.pathname === '/api/v1/auth/password/reset') {
      state.posts++
      state.signedIn = false
      return json(state.reset)
    }
    errors.push(`Unexpected API path: ${url.pathname}`)
    return json(503)
  })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, page, state }
}
async function screen(page, name, width) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  const text = await page.locator('main').innerText()
  const notice =
    phase === 'baseline'
      ? page.getByText(/비밀번호가 바뀌면 기존 로그인은 모두 종료됩니다/)
      : page.getByText(securityText, { exact: true })
  const securityVisible = await notice.isVisible()
  if (phase === 'final' && name !== 'member') assert(securityVisible)
  const entry = {
    name,
    width,
    charsWithoutSpace: text.replace(/\s/g, '').length,
    securityVisible,
    labels: await page.locator('main label').allTextContents(),
    links: await page
      .locator('main a')
      .evaluateAll((links) => links.map((link) => [link.textContent, link.getAttribute('href')])),
  }
  report.screens.push(entry)
  await page.screenshot({
    path: resolve(proof, `${report.screens.length}-${name}-${width}.png`),
    fullPage: true,
  })
}
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error('Preview server exited')
    try {
      if ((await fetch(origin)).ok) break
    } catch {}
    if (attempt === 79) throw new Error('Preview server unavailable')
    await delay(100)
  }
  const address = sink.address()
  assert(address && typeof address !== 'string')
  browser = await chromium.launch({
    executablePath:
      process.env.BODYGUARD_TEST_CHROME ||
      '/Users/gongman/.browser-driver-manager/chrome/mac_arm-154.0.8037.57/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    headless: true,
    proxy: { server: `http://127.0.0.1:${address.port}`, bypass: '127.0.0.1,localhost' },
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync'],
  })
  report.chrome = browser.version()
  for (const width of [1440, 1024, 800]) {
    const { context, page, state } = await makeContext({ viewport: { width, height: 1000 } })
    state.signedIn = true
    await page.goto(`${origin}/account`)
    await page.getByRole('heading', { name: '내 계정', exact: true }).waitFor()
    await screen(page, 'member', width)
    assert(await page.getByText(/실제 알림/).isVisible())
    assert(
      (await page.getByRole('link', { name: '회원 탈퇴 안내' }).getAttribute('href')) ===
        '/account/delete',
    )
    state.signedIn = false
    await page.goto(`${origin}/password/forgot`)
    await page.getByRole('heading', { name: '비밀번호 재설정 요청' }).waitFor()
    await screen(page, 'forgot', width)
    await page.goto(`${origin}/password/reset#token=${'a'.repeat(43)}`)
    await page.getByRole('heading', { name: '새 비밀번호 설정' }).waitFor()
    assert(new URL(page.url()).hash === '')
    await screen(page, 'reset', width)
    await context.close()
  }
  for (const options of [{ colorScheme: 'dark' }, { reducedMotion: 'reduce' }]) {
    const { context, page } = await makeContext({
      ...options,
      viewport: { width: 1024, height: 1000 },
    })
    await page.goto(`${origin}/password/forgot`)
    await page.getByLabel('이메일', { exact: true }).waitFor()
    await screen(page, options.colorScheme ? 'forgot-dark' : 'forgot-reduced', 1024)
    await page.getByLabel('이메일', { exact: true }).focus()
    await page.keyboard.press('Tab')
    assert(
      await page
        .getByRole('button', { name: '재설정 요청', exact: true })
        .evaluate(
          (button) =>
            button === document.activeElement && getComputedStyle(button).outlineStyle !== 'none',
        ),
    )
    report.flows.push(options.colorScheme ? 'dark-preference-keyboard' : 'reduced-motion-keyboard')
    await context.close()
  }
  const { context, page, state } = await makeContext()
  await page.goto(`${origin}/password/forgot`)
  await page.getByLabel('이메일', { exact: true }).fill('copy-fixture@example.com')
  state.forgot = 503
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert((await page.getByRole('status').count()) === 0)
  state.forgot = 202
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '등록된 이메일이면' }).waitFor()
  report.flows.push('service-error-retry-conditional-ack')
  await screen(page, 'ack', 1440)
  state.forgot = 429
  await page.getByRole('button', { name: '다시 요청하기' }).click()
  await page.getByRole('status').filter({ hasText: '다시 요청까지' }).waitFor()
  assert(await page.getByRole('button', { name: '재설정 요청', exact: true }).isDisabled())
  report.flows.push('quota-disabled-countdown')
  await page.reload()
  await page.getByLabel('이메일', { exact: true }).fill('copy-fixture@example.com')
  state.forgot = 202
  state.held = true
  const prior = state.posts
  await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  await page.getByRole('button', { name: '처리 중…' }).waitFor()
  assert(await page.getByRole('button', { name: '처리 중…' }).isDisabled())
  for (let attempt = 0; attempt < 50 && state.posts === prior; attempt++) await delay(20)
  assert(state.posts === prior + 1)
  await page.getByRole('link', { name: '서비스 소개로 돌아가기' }).click()
  state.release?.()
  await page.getByRole('heading', { name: '내 몸을 이해하는 스트레칭' }).waitFor()
  assert((await page.getByText(/요청을 접수했습니다/).count()) === 0)
  report.flows.push('pending-leave-no-late-ack')
  await page.goto(`${origin}/password/reset`)
  await page.getByRole('heading', { name: '새 링크가 필요합니다' }).waitFor()
  assert(await page.getByRole('link', { name: '재설정 다시 요청' }).isVisible())
  await screen(page, 'invalid', 1440)
  await page.goto(`${origin}/password/reset#token=${'a'.repeat(43)}`)
  await page.getByLabel('새 비밀번호', { exact: true }).fill('테스트 전용 새로운 비밀번호 12345')
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill('다른 테스트 비밀번호 12345')
  const beforeMismatch = state.posts
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await page.getByRole('alert').filter({ hasText: '일치하지' }).waitFor()
  assert(
    await page.getByLabel('새 비밀번호 확인').evaluate((input) => input === document.activeElement),
  )
  assert(state.posts === beforeMismatch)
  await page
    .getByLabel('새 비밀번호 확인', { exact: true })
    .fill('테스트 전용 새로운 비밀번호 12345')
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  const heading = page.getByRole('heading', { name: '비밀번호를 변경했습니다' })
  await heading.waitFor()
  assert(await heading.evaluate((element) => element === document.activeElement))
  assert((await page.getByLabel('새 비밀번호', { exact: true }).count()) === 0)
  await screen(page, 'complete', 1440)
  report.flows.push('mismatch-no-post-complete-cleared-focused')
  state.signedIn = true
  await page.goto(`${origin}/account`)
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.getByRole('heading', { name: '다시 만나 반갑습니다', exact: true }).waitFor()
  assert((await page.getByText('copy-fixture@example.com').count()) === 0)
  report.flows.push('logout-hides-account')
  await context.close()
  assert(cameraCalls === 0)
  assert.deepEqual(external, [])
  assert.deepEqual(errors, [])
  for (const file of sourceFiles) assert(source[file] === sha(file), `Source changed: ${file}`)
  if (phase === 'final') {
    const baseline = JSON.parse(readFileSync(resolve(destination, 'baseline/report.json'), 'utf8'))
    for (let index = 0; index < 9; index++) {
      assert.deepEqual(report.screens[index].links, baseline.screens[index].links)
      assert.deepEqual(report.screens[index].labels, baseline.screens[index].labels)
      if (report.screens[index].width > 850 || report.screens[index].name === 'member')
        assert(report.screens[index].charsWithoutSpace < baseline.screens[index].charsWithoutSpace)
    }
    for (const file of [
      'src/App.tsx',
      'src/auth.tsx',
      'src/api/auth.ts',
      'src/index.css',
      'pnpm-lock.yaml',
    ])
      assert(source[file] === baseline.source[file], `Out-of-scope mutation: ${file}`)
  }
  report.passed = true
} catch (error) {
  report.passed = false
  report.failures.push(String(error))
  process.exitCode = 1
} finally {
  report.cameraCalls = cameraCalls
  report.externalOrigins = external
  report.pageErrors = errors
  if (browser) await browser.close()
  server.kill('SIGTERM')
  await new Promise((resolve) => sink.close(resolve))
  writeFileSync(resolve(proof, 'report.json'), JSON.stringify(report, null, 2))
  process.stdout.write(
    `${JSON.stringify({
      phase,
      passed: report.passed,
      screens: report.screens.length,
      flows: report.flows,
      failures: report.failures,
      report: resolve(proof, 'report.json'),
    })}\n`,
  )
}
