# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.ts >> WEB-S02 다른 세션 CSRF·삭제 proof 거부·로그아웃 cookie 재전송 차단
- Location: e2e/security.spec.ts:201:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Cannot set properties of undefined (setting 'getUserMedia')",
+ ]
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - button "본문으로 이동" [ref=f1e4]
  - banner [ref=f1e5]:
    - link "BODYGUARD 서비스 소개" [ref=f1e6] [cursor=pointer]:
      - /url: /
      - text: BODYGUARD.
    - navigation "계정 메뉴" [ref=f1e7]:
      - link "내 시작" [ref=f1e8] [cursor=pointer]:
        - /url: /start
      - link "수행 기록" [ref=f1e9] [cursor=pointer]:
        - /url: /records
      - link "내 계정" [ref=f1e10] [cursor=pointer]:
        - /url: /account
  - main [ref=f1e11]:
    - generic [ref=f1e12]:
      - paragraph [ref=f1e13]: MY BODYGUARD / RECORDS
      - heading "내 수행 기록" [active] [level=1] [ref=f1e14]
      - paragraph [ref=f1e15]: 스트레칭을 진행한 시간과 수행 과정을 확인하세요.
      - paragraph [ref=f1e16]: 완료는 수행 흐름의 종료를 뜻하며, 자세 정확성이나 효과를 보장하는 점수가 아닙니다.
      - generic [ref=f1e17]:
        - generic [ref=f1e18]:
          - text: 시작일
          - textbox "시작일" [ref=f1e19]: 2026-09-29
        - generic [ref=f1e20]:
          - text: 종료일
          - textbox "종료일" [ref=f1e21]: 2026-10-05
        - button "기간 조회" [ref=f1e22] [cursor=pointer]
      - region "기록 삭제" [ref=f1e23]:
        - button "이 기간 기록 삭제" [ref=f1e24] [cursor=pointer]
      - generic [ref=f1e25]:
        - heading "2026-09-29 — 2026-10-05" [level=2] [ref=f1e26]
        - paragraph [ref=f1e27]: 종료 시각 기준 · 조회 시점까지 · 최신순
        - table [ref=f1e29]:
          - caption [ref=f1e30]: 기간별 스트레칭 수행 기록
          - rowgroup [ref=f1e31]:
            - row [ref=f1e32]:
              - columnheader "종료 시각" [ref=f1e33]
              - columnheader "동작 식별자" [ref=f1e34]
              - columnheader "수행 상태" [ref=f1e35]
              - columnheader "관찰 시간" [ref=f1e36]
              - columnheader "반복" [ref=f1e37]
          - rowgroup [ref=f1e38]:
            - row [ref=f1e39]:
              - cell [ref=f1e40]:
                - time [ref=f1e41]: 2026. 10. 05. 오후 08:52
              - rowheader [ref=f1e42]:
                - link "fixture-security-session · 2026. 10. 05. 오후 08:52 기록 상세" [ref=f1e43] [cursor=pointer]:
                  - /url: /records/b6449917-5338-4ffd-bdea-894be939634c?from=2026-09-29&to=2026-10-05
                  - text: fixture-security-session
              - cell "중단" [ref=f1e44]
              - cell "1분 5초" [ref=f1e46]
              - cell "0회" [ref=f1e47]
      - link "내 시작으로 돌아가기" [ref=f1e49] [cursor=pointer]:
        - /url: /start
  - contentinfo [ref=f1e50]:
    - generic [ref=f1e51]: BODYGUARD
    - paragraph [ref=f1e52]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
    - navigation "서비스 안내" [ref=f1e53]:
      - link "도움말" [ref=f1e54] [cursor=pointer]:
        - /url: /help
      - link "카메라·데이터 안내" [ref=f1e55] [cursor=pointer]:
        - /url: /data
```

# Test source

```ts
  1   | // release-plan6/FR-U-02/04/05/FR-R-03/NFR-07/08: actual web/HTTP/SQL, synthetic mail/summary.
  2   | import { randomUUID } from 'node:crypto'
  3   | import { readFileSync } from 'node:fs'
  4   | import { type APIResponse, type Browser, type BrowserContext, expect, test } from '@playwright/test'
  5   |
  6   | const origin = 'http://localhost:4173'
  7   | const apiOrigin = 'http://localhost:8000'
  8   | const password = '합성 보안 검증 비밀번호 12345'
  9   | const mailbox = process.env.BODYGUARD_TEST_MAILBOX
  10  | const proxy = process.env.BODYGUARD_TEST_BLOCKED_PROXY
  11  | if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  12  |   throw new Error('Owned synthetic mailbox required')
  13  | if (!proxy || !/^http:\/\/127\.0\.0\.1:\d+$/.test(proxy))
  14  |   throw new Error('Owned closed-port proxy required')
  15  |
  16  | let cameraCalls = 0
  17  | let unexpectedRequests: string[] = []
  18  | let pageErrors: string[] = []
  19  | let statuses: number[] = []
  20  | let corsReadRejected = false
  21  | let corsWriteRejected = false
  22  | let corsConsoleErrors = 0
  23  | async function guard(context: BrowserContext) {
  24  |   await context.exposeBinding('__securityCamera', () => {
  25  |     cameraCalls++
  26  |   })
  27  |   await context.addInitScript(() => {
  28  |     navigator.mediaDevices.getUserMedia = () => {
  29  |       void (window as unknown as { __securityCamera: () => Promise<void> }).__securityCamera()
  30  |       return Promise.reject(new Error('Unexpected camera request'))
  31  |     }
  32  |   })
  33  |   context.on('page', (page) => page.on('pageerror', (error) => pageErrors.push(error.message)))
  34  |   context.on('request', (request) => {
  35  |     const url = new URL(request.url())
  36  |     if (
  37  |       ![origin, apiOrigin].includes(url.origin) ||
  38  |       /\.glb|\.task|\.wasm|mediapipe/i.test(url.pathname)
  39  |     )
  40  |       unexpectedRequests.push(url.origin + url.pathname)
  41  |   })
  42  | }
  43  | test.beforeEach(async ({ page, context }) => {
  44  |   cameraCalls = 0
  45  |   unexpectedRequests = []
  46  |   pageErrors = []
  47  |   statuses = []
  48  |   corsReadRejected = false
  49  |   corsWriteRejected = false
  50  |   corsConsoleErrors = 0
  51  |   await guard(context)
  52  |   page.on('pageerror', (error) => pageErrors.push(error.message))
  53  |   await page.goto('/')
  54  | })
  55  | test.afterEach(async ({ page }, info) => {
  56  |   const storageLengths = await page.evaluate(() => [localStorage.length, sessionStorage.length])
  57  |   await info.attach('security-boundaries.json', {
  58  |     body: Buffer.from(
  59  |       JSON.stringify({
  60  |         actualWebHttpSql: true,
  61  |         actualProvider: false,
  62  |         actualHumanCamera: false,
  63  |         actualExercise: false,
  64  |         actualProductionTls: false,
  65  |         externalSecurityAudit: false,
  66  |         statuses,
  67  |         corsReadRejected,
  68  |         corsWriteRejected,
  69  |         corsConsoleErrors,
  70  |         cameraCalls,
  71  |         unexpectedRequests,
  72  |         pageErrors,
  73  |         storageLengths,
  74  |         browserVersion: page.context().browser()?.version(),
  75  |       }),
  76  |     ),
  77  |     contentType: 'application/json',
  78  |   })
  79  |   expect(cameraCalls).toBe(0)
  80  |   expect(unexpectedRequests).toEqual([])
> 81  |   expect(pageErrors).toEqual([])
      |                      ^ Error: expect(received).toEqual(expected) // deep equality
  82  |   expect(storageLengths).toEqual([0, 0])
  83  | })
  84  | async function check(response: APIResponse, status: number) {
  85  |   statuses.push(response.status())
  86  |   expect(response.status()).toBe(status)
  87  |   expect(response.headers()['cache-control']).toBe('no-store')
  88  |   expect(response.headers()['x-content-type-options']).toBe('nosniff')
  89  |   expect(response.headers()['referrer-policy']).toBe('no-referrer')
  90  | }
  91  | async function csrf(context: BrowserContext): Promise<string> {
  92  |   const response = await context.request.get('/api/v1/auth/csrf')
  93  |   await check(response, 200)
  94  |   return (await response.json()).csrf_token
  95  | }
  96  | async function post(context: BrowserContext, path: string, data?: unknown) {
  97  |   return context.request.post(`/api/v1${path}`, {
  98  |     headers: { Origin: origin, 'X-CSRF-Token': await csrf(context) },
  99  |     data,
  100 |   })
  101 | }
  102 | async function join(context: BrowserContext) {
  103 |   const email = `security-${randomUUID()}@example.com`
  104 |   const sent = await post(context, '/auth/signup', { email, password })
  105 |   await check(sent, 202)
  106 |   let code = ''
  107 |   await expect
  108 |     .poll(() => {
  109 |       code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
  110 |       return /^[0-9]{6}$/.test(code)
  111 |     })
  112 |     .toBe(true)
  113 |   const verified = await post(context, '/auth/verify', {
  114 |     challenge_id: (await sent.json()).challenge_id,
  115 |     code,
  116 |   })
  117 |   await check(verified, 201)
  118 |   return { email, id: (await verified.json()).id as string }
  119 | }
  120 | async function otherContext(browser: Browser) {
  121 |   const context = await browser.newContext({
  122 |     baseURL: origin,
  123 |     proxy: { server: proxy as string, bypass: 'localhost,127.0.0.1,[::1]' },
  124 |   })
  125 |   await guard(context)
  126 |   return context
  127 | }
  128 | async function seed(context: BrowserContext, motion: string) {
  129 |   const ended = new Date(Date.now() - 120_000)
  130 |   const record = {
  131 |     id: randomUUID(),
  132 |     motion_id: motion,
  133 |     protocol_version: 'fixture-not-release',
  134 |     started_at: new Date(ended.getTime() - 90_000).toISOString(),
  135 |     ended_at: ended.toISOString(),
  136 |     outcome: 'interrupted',
  137 |     observed_ms: 65_000,
  138 |     repetitions: 0,
  139 |   }
  140 |   const saved = await post(context, '/records/stretch', record)
  141 |   await check(saved, 201)
  142 |   expect((await saved.json()).provenance).toBe('client-reported')
  143 |   return record
  144 | }
  145 | async function listIds(context: BrowserContext) {
  146 |   const response = await context.request.get('/api/v1/records/stretch')
  147 |   await check(response, 200)
  148 |   return (await response.json()).items.map((item: { id: string }) => item.id)
  149 | }
  150 |
  151 | test('WEB-S01 타인 기록 차단·소유권 입력 거부·본인 웹 보존', async ({
  152 |   browser,
  153 |   context,
  154 |   page,
  155 | }, info) => {
  156 |   await join(context)
  157 |   const own = await seed(context, 'fixture-security-own')
  158 |   const other = await otherContext(browser)
  159 |   try {
  160 |     const user = await join(other)
  161 |     const foreign = await seed(other, 'fixture-security-foreign')
  162 |     await check(await context.request.get(`/api/v1/records/stretch/${foreign.id}`), 404)
  163 |     await check(await other.request.get(`/api/v1/records/stretch/${own.id}`), 404)
  164 |     const forged = await context.request.get(`/api/v1/records/stretch?user_id=${user.id}`, {
  165 |       headers: { 'X-User-ID': user.id },
  166 |     })
  167 |     await check(forged, 200)
  168 |     expect((await forged.json()).items.map((item: { id: string }) => item.id)).toEqual([own.id])
  169 |     const invalid = await post(context, '/records/stretch', {
  170 |       ...own,
  171 |       id: randomUUID(),
  172 |       user_id: user.id,
  173 |       motion_id: '<script>window.__securityInjected=true</script>',
  174 |       password: 'SYNTHETIC-INPUT-MUST-NOT-REFLECT',
  175 |     })
  176 |     await check(invalid, 422)
  177 |     expect(await invalid.json()).toEqual({ detail: '입력 형식을 확인해 주세요.' })
  178 |     expect(await listIds(context)).toEqual([own.id])
  179 |     expect(await listIds(other)).toEqual([foreign.id])
  180 |     await page.goto(`/records/${foreign.id}`)
  181 |     await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
```
