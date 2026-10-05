# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recordedsession.spec.ts >> A04 delayed ready pause/resume saves actual session summary to own record/detail
- Location: e2e/recordedsession.spec.ts:109:1

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 2
+ Received  + 2

  Object {
-   "ended_at": "2026-10-05T16:17:39.684Z",
+   "ended_at": "2026-10-05T16:17:39.684000Z",
    "id": "6a46e22d-506d-4917-9be6-61b65f099e3c",
    "observed_ms": 40,
    "outcome": "interrupted",
    "provenance": "client-reported",
    "repetitions": 0,
-   "started_at": "2026-10-05T16:17:39.384Z",
+   "started_at": "2026-10-05T16:17:39.384000Z",
  }
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - button "본문으로 이동" [ref=e4]
  - banner [ref=e5]:
    - link "BODYGUARD 서비스 소개" [ref=e6] [cursor=pointer]:
      - /url: /
      - text: BODYGUARD.
    - navigation "계정 메뉴" [ref=e7]:
      - link "내 시작" [ref=e8] [cursor=pointer]:
        - /url: /start
      - link "수행 기록" [ref=e9] [cursor=pointer]:
        - /url: /records
      - link "내 계정" [ref=e10] [cursor=pointer]:
        - /url: /account
  - main [ref=e11]:
    - generic [ref=e12]:
      - paragraph [ref=e13]: MY BODYGUARD
      - heading "내 몸을 위한 시작" [level=1] [ref=e14]
      - paragraph [ref=e15]: recorded-6ce1732c-ebe0-4f2a-a4e4-feeb18359e76@example.com
      - link "스트레칭 시작 경로 선택" [ref=e16] [cursor=pointer]:
        - /url: /explore
      - paragraph [ref=e17]:
        - link "내 수행 기록 확인" [ref=e18] [cursor=pointer]:
          - /url: /records
      - paragraph [ref=e19]:
        - link "계정 관리" [ref=e20] [cursor=pointer]:
          - /url: /account
      - generic [ref=e21]:
        - heading "첫 코칭 흐름을 준비하고 있습니다" [level=2] [ref=e22]
        - paragraph [ref=e23]: 동작 검증과 남녀 3D 아바타 제작이 끝나면 스트레칭 선택과 코칭을 이곳에 연결합니다. 지금은 계정 기능을 사용할 수 있습니다.
        - paragraph [ref=e24]: 카메라는 켜지지 않았습니다.
      - button "로그아웃" [ref=e25] [cursor=pointer]
  - contentinfo [ref=e26]:
    - generic [ref=e27]: BODYGUARD
    - paragraph [ref=e28]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
    - navigation "서비스 안내" [ref=e29]:
      - link "도움말" [ref=e30] [cursor=pointer]:
        - /url: /help
      - link "카메라·데이터 안내" [ref=e31] [cursor=pointer]:
        - /url: /data
```

# Test source

```ts
  41  |     )
  42  |       statuses.push(response.status())
  43  |   })
  44  |   await page.route('**/__private-recorded-probe.js', (route) =>
  45  |     route.fulfill({
  46  |       status: 200,
  47  |       contentType: 'application/javascript',
  48  |       body: readFileSync(`${bundle}/probe.js`, 'utf8'),
  49  |     }),
  50  |   )
  51  |   await context.exposeBinding('__unexpectedCamera', () => {
  52  |     cameras++
  53  |   })
  54  |   await context.addInitScript(() => {
  55  |     navigator.mediaDevices.getUserMedia = () => {
  56  |       void (window as unknown as { __unexpectedCamera(): Promise<void> }).__unexpectedCamera()
  57  |       return Promise.reject(new Error('Unexpected camera'))
  58  |     }
  59  |   })
  60  | })
  61  | test.afterEach(async ({ page }) => {
  62  |   expect(external).toBe(0)
  63  |   expect(cameras).toBe(0)
  64  |   expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  65  | })
  66  | async function post(context: BrowserContext, path: string, data?: unknown) {
  67  |   const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  68  |   return context.request.post(`/api/v1${path}`, {
  69  |     headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
  70  |     data,
  71  |   })
  72  | }
  73  | async function join(context: BrowserContext) {
  74  |   const email = `recorded-${randomUUID()}@example.com`
  75  |   const response = await post(context, '/auth/signup', { email, password })
  76  |   expect(response.status()).toBe(202)
  77  |   let code = ''
  78  |   await expect
  79  |     .poll(() => {
  80  |       code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
  81  |       return code
  82  |     })
  83  |     .toMatch(/^[0-9]{6}$/)
  84  |   expect(
  85  |     (
  86  |       await post(context, '/auth/verify', {
  87  |         challenge_id: (await response.json()).challenge_id,
  88  |         code,
  89  |       })
  90  |     ).status(),
  91  |   ).toBe(201)
  92  |   return email
  93  | }
  94  | async function prepare(page: Page, context: BrowserContext, delayed: boolean) {
  95  |   const user = await (await context.request.get('/api/v1/me')).json()
  96  |   const recordId = randomUUID()
  97  |   const utc = new Date(Date.now() - 2000).toISOString()
  98  |   await page.evaluate(
  99  |     async (options) => {
  100 |       const path = '/__private-recorded-probe.js'
  101 |       const module = (await import(path)) as { prepareRecordedProbe: typeof prepareRecordedProbe }
  102 |       ;(window as unknown as PrivateWindow).recordedProbe =
  103 |         await module.prepareRecordedProbe(options)
  104 |     },
  105 |     { authority: { status: 'ready' as const, user }, recordId, utc, delayed },
  106 |   )
  107 |   return { recordId, utc }
  108 | }
  109 | test('A04 delayed ready pause/resume saves actual session summary to own record/detail', async ({
  110 |   page,
  111 |   context,
  112 | }, info) => {
  113 |   await join(context)
  114 |   await page.goto('/start')
  115 |   const data = await prepare(page, context, true)
  116 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  117 |   await expect
  118 |     .poll(() => page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.waiting()))
  119 |     .toBe(true)
  120 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  121 |   expect(posts).toBe(0)
  122 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.releaseReady())
  123 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.perform())
  124 |   expect(
  125 |     await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  126 |   ).toMatchObject({
  127 |     session: 'ended',
  128 |     started: 500,
  129 |     elapsed: 300,
  130 |     disposed: 6,
  131 |     record: { status: 'idle', failure: null },
  132 |   })
  133 |   expect(posts).toBe(0)
  134 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  135 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  136 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.retry())
  137 |   expect(posts).toBe(1)
  138 |   expect(statuses).toEqual([201])
  139 |   const records = await (await context.request.get('/api/v1/records/stretch')).json()
  140 |   expect(records.items).toHaveLength(1)
> 141 |   expect(records.items[0]).toMatchObject({
      |                            ^ Error: expect(received).toMatchObject(expected)
  142 |     id: data.recordId,
  143 |     started_at: new Date(Date.parse(data.utc) + 500).toISOString(),
  144 |     ended_at: new Date(Date.parse(data.utc) + 800).toISOString(),
  145 |     outcome: 'interrupted',
  146 |     observed_ms: 40,
  147 |     repetitions: 0,
  148 |     provenance: 'client-reported',
  149 |   })
  150 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
  151 |   await page.goto(`/records/${data.recordId}`)
  152 |   await expect(page.getByRole('heading', { name: '수행 기록 상세', exact: true })).toBeVisible()
  153 |   await expect(page.getByText('관찰된 수행 시간', { exact: true })).toBeVisible()
  154 |   await page.screenshot({ path: info.outputPath('recorded-session-detail.png'), fullPage: true })
  155 | })
  156 | test('A04 same-account authority replaced during preparation: late readiness cannot save', async ({
  157 |   page,
  158 |   context,
  159 | }) => {
  160 |   await join(context)
  161 |   await page.goto('/start')
  162 |   await prepare(page, context, true)
  163 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  164 |   await expect
  165 |     .poll(() => page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.waiting()))
  166 |     .toBe(true)
  167 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.replace())
  168 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.releaseReady())
  169 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  170 |   expect(
  171 |     await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  172 |   ).toMatchObject({
  173 |     session: 'ended',
  174 |     started: null,
  175 |     disposed: 3,
  176 |     record: { status: 'closed', failure: 'ownership-error' },
  177 |   })
  178 |   expect(posts).toBe(0)
  179 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  180 |     0,
  181 |   )
  182 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
  183 | })
  184 | test('A04 lost accepted response retries identical result and actual SQL contains one row', async ({
  185 |   page,
  186 |   context,
  187 | }) => {
  188 |   await join(context)
  189 |   await page.goto('/start')
  190 |   const data = await prepare(page, context, false)
  191 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  192 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.perform())
  193 |   const bodies: string[] = []
  194 |   await page.route('**/api/v1/records/stretch', async (route) => {
  195 |     if (route.request().method() !== 'POST') return route.continue()
  196 |     bodies.push(route.request().postData() as string)
  197 |     if (bodies.length === 1) {
  198 |       expect((await route.fetch()).status()).toBe(201)
  199 |       await route.abort()
  200 |     } else await route.continue()
  201 |   })
  202 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  203 |   expect(
  204 |     await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  205 |   ).toMatchObject({ record: { status: 'failed', failure: 'network' } })
  206 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  207 |   expect(bodies).toHaveLength(1)
  208 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.retry())
  209 |   expect(bodies).toHaveLength(2)
  210 |   expect(bodies[0]).toBe(bodies[1])
  211 |   expect(JSON.parse(bodies[0]).id).toBe(data.recordId)
  212 |   expect(statuses).toEqual([200])
  213 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  214 |     1,
  215 |   )
  216 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
  217 | })
  218 | test('A04 missed account notification keeps original proof; new cookie receives 403/no record', async ({
  219 |   page,
  220 |   context,
  221 | }) => {
  222 |   const email = await join(context)
  223 |   await page.goto('/start')
  224 |   await prepare(page, context, false)
  225 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.start())
  226 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.perform())
  227 |   expect((await post(context, '/auth/logout')).status()).toBe(204)
  228 |   await join(context)
  229 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.save())
  230 |   expect(statuses).toEqual([403])
  231 |   expect(
  232 |     await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.state()),
  233 |   ).toMatchObject({ record: { status: 'failed', failure: 'session-expired' } })
  234 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  235 |     0,
  236 |   )
  237 |   await page.evaluate(() => (window as unknown as PrivateWindow).recordedProbe.dispose())
  238 |   expect((await post(context, '/auth/logout')).status()).toBe(204)
  239 |   expect((await post(context, '/auth/login', { email, password })).status()).toBe(200)
  240 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  241 |     0,
```