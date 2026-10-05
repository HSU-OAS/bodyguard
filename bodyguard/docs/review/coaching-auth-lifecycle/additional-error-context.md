# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authcoaching.spec.ts >> H02 actual provider prepares inert; explicit synthetic performance saves to own public record
- Location: e2e/authcoaching.spec.ts:100:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator:  getByRole('heading', { name: '내 몸을 위한 시작', exact: true })
Expected: visible
Received: undefined

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '내 몸을 위한 시작', exact: true }) with timeout 5000ms
  - waiting for getByRole('heading', { name: '내 몸을 위한 시작', exact: true })

```

# Test source

```ts
  1   | // FR-U-04/FR-R-03/NFR-08: actual AuthProvider/Chrome/API/SQL; clocks/ports/frames/mail synthetic.
  2   | import { randomUUID } from 'node:crypto'
  3   | import { readFileSync } from 'node:fs'
  4   | import { type BrowserContext, expect, type Page, test } from '@playwright/test'
  5   | import type { mountAuthCoachingProbe } from './fixtures/authCoachingProbe'
  6   |
  7   | const origin = 'http://localhost:4173'
  8   | const mailbox = process.env.BODYGUARD_TEST_MAILBOX
  9   | const bundle = process.env.BODYGUARD_TEST_COACHING_AUTH_PROBE
  10  | if (
  11  |   !mailbox?.startsWith('/private/tmp/bodyguard-browser-') ||
  12  |   !bundle?.startsWith('/private/tmp/bodyguard-coaching-auth-proof.') ||
  13  |   !bundle.endsWith('/browser-probe')
  14  | )
  15  |   throw new Error('Owned auth probe required')
  16  | type Probe = ReturnType<typeof mountAuthCoachingProbe>
  17  | type PrivateWindow = Window & { authCoachingProbe: Probe }
  18  | let posts = 0
  19  | let unexpected = 0
  20  | test.beforeEach(async ({ context, page }) => {
  21  |   posts = 0
  22  |   unexpected = 0
  23  |   context.on('request', (request) => {
  24  |     const url = new URL(request.url())
  25  |     if (url.pathname === '/api/v1/records/stretch' && request.method() === 'POST') posts++
  26  |     if (
  27  |       !['localhost', '127.0.0.1'].includes(url.hostname) ||
  28  |       /\.glb|\.wasm|mediapipe/.test(url.pathname)
  29  |     )
  30  |       unexpected++
  31  |   })
  32  |   await page.route('**/__private-auth-coaching-probe.js', (route) =>
  33  |     route.fulfill({
  34  |       status: 200,
  35  |       contentType: 'application/javascript',
  36  |       body: readFileSync(`${bundle}/probe.js`, 'utf8'),
  37  |     }),
  38  |   )
  39  |   await context.exposeBinding('__unexpectedCamera', () => {
  40  |     unexpected++
  41  |   })
  42  |   await context.addInitScript(() => {
  43  |     navigator.mediaDevices.getUserMedia = () => {
  44  |       void (window as unknown as { __unexpectedCamera(): Promise<void> }).__unexpectedCamera()
  45  |       return Promise.reject(new Error('Unexpected camera'))
  46  |     }
  47  |   })
  48  | })
  49  | test.afterEach(async ({ page }) => {
  50  |   expect(unexpected).toBe(0)
  51  |   expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  52  | })
  53  | async function join(context: BrowserContext) {
  54  |   const csrf = async () =>
  55  |     (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  56  |   const email = `auth-coach-${randomUUID()}@example.com`
  57  |   const response = await context.request.post('/api/v1/auth/signup', {
  58  |     headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
  59  |     data: { email, password: '로그인 코칭 연결 시험 비밀번호 12345' },
  60  |   })
  61  |   expect(response.status()).toBe(202)
  62  |   let code = ''
  63  |   await expect
  64  |     .poll(() => {
  65  |       code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
  66  |       return code
  67  |     })
  68  |     .toMatch(/^[0-9]{6}$/)
  69  |   expect(
  70  |     (
  71  |       await context.request.post('/api/v1/auth/verify', {
  72  |         headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
  73  |         data: { challenge_id: (await response.json()).challenge_id, code },
  74  |       })
  75  |     ).status(),
  76  |   ).toBe(201)
  77  | }
  78  | async function mount(page: Page, delayed = false) {
  79  |   await page.goto('/start')
> 80  |   await expect(page.getByRole('heading', { name: '내 몸을 위한 시작', exact: true })).toBeVisible()
      |                                                                                ^ Error: expect(locator).toBeVisible() failed
  81  |   const options = {
  82  |     recordId: randomUUID(),
  83  |     utc: new Date(Date.now() - 2000).toISOString(),
  84  |     delayed,
  85  |   }
  86  |   await page.evaluate(async (options) => {
  87  |     const path = '/__private-auth-coaching-probe.js'
  88  |     const module = (await import(path)) as { mountAuthCoachingProbe: typeof mountAuthCoachingProbe }
  89  |     ;(window as unknown as PrivateWindow).authCoachingProbe = module.mountAuthCoachingProbe(options)
  90  |   }, options)
  91  |   await expect
  92  |     .poll(() =>
  93  |       page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.state().auth),
  94  |     )
  95  |     .toBe('ready')
  96  |   return options
  97  | }
  98  | const state = (page: Page) =>
  99  |   page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.state())
  100 | test('H02 actual provider prepares inert; explicit synthetic performance saves to own public record', async ({
  101 |   page,
  102 |   context,
  103 | }, info) => {
  104 |   await join(context)
  105 |   const data = await mount(page)
  106 |   expect(await state(page)).toMatchObject({ hook: 'idle', acquired: 0, owned: false })
  107 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  108 |   expect(await state(page)).toMatchObject({ hook: 'prepared', acquired: 0, owned: true })
  109 |   expect(posts).toBe(0)
  110 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  111 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.perform())
  112 |   expect(await state(page)).toMatchObject({ session: 'ended', acquired: 3, disposed: 3 })
  113 |   expect(posts).toBe(0)
  114 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  115 |   expect(await state(page)).toMatchObject({ record: 'saved' })
  116 |   expect(posts).toBe(1)
  117 |   const rows = await (await context.request.get('/api/v1/records/stretch')).json()
  118 |   expect(rows.items).toHaveLength(1)
  119 |   expect(rows.items[0]).toMatchObject({
  120 |     id: data.recordId,
  121 |     outcome: 'completed',
  122 |     observed_ms: 100,
  123 |     repetitions: 0,
  124 |     provenance: 'client-reported',
  125 |   })
  126 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  127 |   await page.goto(`/records/${data.recordId}`)
  128 |   await expect(page.getByRole('heading', { name: '수행 기록 상세', exact: true })).toBeVisible()
  129 |   await page.screenshot({ path: info.outputPath('auth-coaching-record.png'), fullPage: true })
  130 | })
  131 | test('H03 actual same-account refresh revokes old running session; no automatic recreation', async ({
  132 |   page,
  133 |   context,
  134 | }) => {
  135 |   await join(context)
  136 |   await mount(page)
  137 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  138 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  139 |   await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  140 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.refresh())
  141 |   await expect
  142 |     .poll(() => state(page))
  143 |     .toMatchObject({ auth: 'ready', hook: 'idle', owned: false, session: 'ended', disposed: 3 })
  144 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.resume())
  145 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  146 |   expect(posts).toBe(0)
  147 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  148 |     0,
  149 |   )
  150 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  151 | })
  152 | test('H03 failed logout is not permission to keep coaching or save', async ({ page, context }) => {
  153 |   await join(context)
  154 |   await mount(page)
  155 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  156 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  157 |   await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  158 |   await page.route('**/api/v1/auth/logout', (route) =>
  159 |     route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  160 |   )
  161 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.signOut())
  162 |   await expect
  163 |     .poll(() => state(page))
  164 |     .toMatchObject({ auth: 'logout-error', hook: 'idle', owned: false, disposed: 3 })
  165 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  166 |   expect(posts).toBe(0)
  167 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  168 |     0,
  169 |   )
  170 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  171 | })
  172 | test('H04 pagehide during synthetic pending permission reclaims late resource; pageshow never starts', async ({
  173 |   page,
  174 |   context,
  175 | }) => {
  176 |   await join(context)
  177 |   await mount(page, true)
  178 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  179 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  180 |   await expect.poll(() => state(page)).toMatchObject({ waiting: true, session: 'preparing' })
```