# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: records.spec.ts >> RW-01 protected entry and genuine empty record period
- Location: e2e/records.spec.ts:296:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
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
      - link "로그인" [ref=e8] [cursor=pointer]:
        - /url: /login
  - main [ref=e9]:
    - generic [ref=e10]:
      - complementary [ref=e11]:
        - paragraph [ref=e12]: BODYGUARD / MY ACCOUNT
        - heading "일상에 맞춘 몸 돌보기." [level=2] [ref=e13]: 일상에 맞춘몸 돌보기.
        - paragraph [ref=e14]: 노트북 웹캠 한 대로 시작하는스트레칭과 자세 코칭.
        - generic [ref=e15]:
          - generic [ref=e16]: "01"
          - paragraph [ref=e17]: 카메라는 직접 시작할 때만 켜집니다.원본 영상은 저장하거나 전송하지 않습니다.
        - paragraph [ref=e18]: 현재 개발 중인 웹입니다.출시 전 기능·안전·개인정보 검증을 진행하고 있습니다.
      - generic [ref=e19]:
        - paragraph [ref=e20]: 로그인
        - heading "다시 만나 반갑습니다" [active] [level=1] [ref=e21]
        - paragraph [ref=e22]: 이메일로 내 계정에 로그인하세요.
        - generic [ref=e23]:
          - button "Google로 계속하기" [disabled] [ref=e24]
          - status [ref=e26]: 구글 연결을 준비하고 있습니다. 이메일로 계속해 주세요.
          - paragraph [ref=e27]: 또는 이메일로
        - generic [ref=e28]:
          - generic [ref=e29]:
            - text: 이메일
            - textbox "이메일" [ref=e30]
          - generic [ref=e31]: 비밀번호
          - generic [ref=e32]:
            - textbox "비밀번호" [ref=e33]
            - button "비밀번호 표시" [ref=e34] [cursor=pointer]: 표시
          - button "로그인" [ref=e35] [cursor=pointer]
        - paragraph [ref=e36]:
          - text: 처음 오셨나요?
          - link "이메일로 가입" [ref=e37] [cursor=pointer]:
            - /url: /signup?next=%2Fstart
        - paragraph [ref=e38]:
          - link "비밀번호를 잊으셨나요?" [ref=e39] [cursor=pointer]:
            - /url: /password/forgot
        - link "서비스 소개로 돌아가기" [ref=e40] [cursor=pointer]:
          - /url: /
  - contentinfo [ref=e41]:
    - generic [ref=e42]: BODYGUARD
    - paragraph [ref=e43]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
```

# Test source

```ts
  1   | // FR-R-03/FR-U-04/NFR-08: real HTTP/SQL/production Chrome, synthetic summaries and mail.
  2   | import { randomUUID } from 'node:crypto'
  3   | import { readFileSync, renameSync, writeFileSync } from 'node:fs'
  4   | import { type BrowserContext, expect, type Page, test } from '@playwright/test'
  5   | 
  6   | const origin = 'http://localhost:4173'
  7   | const password = '기록 브라우저 시험 전용 비밀번호 12345'
  8   | const mailbox = process.env.BODYGUARD_TEST_MAILBOX
  9   | if (!mailbox?.startsWith('/private/tmp/bodyguard-browser-'))
  10  |   throw new Error('Isolated mailbox required')
  11  | let cameraCalls = 0
  12  | const requests: string[] = []
  13  | test.beforeEach(async ({ context }) => {
  14  |   cameraCalls = 0
  15  |   requests.length = 0
  16  |   context.on('request', (request) => requests.push(request.url()))
  17  |   await context.exposeBinding('__bodyguardTestCamera', () => {
  18  |     cameraCalls++
  19  |   })
  20  |   await context.addInitScript(() => {
  21  |     navigator.mediaDevices.getUserMedia = () => {
  22  |       void (
  23  |         window as unknown as { __bodyguardTestCamera: () => Promise<void> }
  24  |       ).__bodyguardTestCamera()
  25  |       return Promise.reject(new Error('Unexpected camera request'))
  26  |     }
  27  |   })
  28  | })
  29  | test.afterEach(async ({ page }) => {
  30  |   expect(cameraCalls).toBe(0)
  31  |   expect(
  32  |     requests.some((url) => /\.glb|\.wasm|pose_landmarker|MeasureDemoPage|mediapipe/.test(url)),
  33  |   ).toBe(false)
  34  |   expect(requests.every((url) => ['localhost', '127.0.0.1'].includes(new URL(url).hostname))).toBe(
  35  |     true,
  36  |   )
  37  |   expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  38  | })
  39  | async function post(context: BrowserContext, path: string, data?: unknown) {
  40  |   const csrf = await (await context.request.get('/api/v1/auth/csrf')).json()
  41  |   return context.request.post(`/api/v1${path}`, {
  42  |     headers: { Origin: origin, 'X-CSRF-Token': csrf.csrf_token },
  43  |     data,
  44  |   })
  45  | }
  46  | async function join(context: BrowserContext) {
  47  |   const email = `records-${randomUUID()}@example.com`
  48  |   const signup = await post(context, '/auth/signup', { email, password })
  49  |   expect(signup.status()).toBe(202)
  50  |   let code = ''
  51  |   await expect
  52  |     .poll(() => {
  53  |       code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
  54  |       return code
  55  |     })
  56  |     .toMatch(/^[0-9]{6}$/)
  57  |   const verified = await post(context, '/auth/verify', {
  58  |     challenge_id: (await signup.json()).challenge_id,
  59  |     code,
  60  |   })
> 61  |   expect(verified.status()).toBe(201)
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  62  |   return email
  63  | }
  64  | async function seed(
  65  |   context: BrowserContext,
  66  |   index = 1,
  67  |   outcome: 'completed' | 'interrupted' | 'skipped' = 'interrupted',
  68  |   daysAgo = 0,
  69  |   long = false,
  70  | ) {
  71  |   const end = new Date(Date.now() - daysAgo * 86400000 - index * 60000)
  72  |   const record = {
  73  |     id: randomUUID(),
  74  |     motion_id: long ? 'fixture-long-'.padEnd(64, 'a') : `fixture-${index}`,
  75  |     protocol_version: 'fixture-not-release',
  76  |     started_at: new Date(end.getTime() - 90000).toISOString(),
  77  |     ended_at: end.toISOString(),
  78  |     outcome,
  79  |     observed_ms: outcome === 'skipped' ? 0 : 65000,
  80  |     repetitions: outcome === 'skipped' ? 0 : 1,
  81  |   }
  82  |   const result = await post(context, '/records/stretch', record)
  83  |   expect(result.status()).toBe(201)
  84  |   expect((await result.json()).provenance).toBe('client-reported')
  85  |   return record
  86  | }
  87  | function day(date: Date) {
  88  |   return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
  89  | }
  90  | 
  91  | test('RD-05 record saved after preview is preserved even with an earlier end time', async ({
  92  |   page,
  93  |   context,
  94  | }, info) => {
  95  |   await join(context)
  96  |   await seed(context)
  97  |   await page.goto('/records')
  98  |   await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  99  |   await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  100 |   const later = await seed(context, 2)
  101 |   await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  102 |   await expect(page.getByText('1건의 수행 기록을 삭제했습니다.', { exact: true })).toBeVisible()
  103 |   await expect(page.getByRole('link', { name: /^fixture-2 .*기록 상세/ })).toBeVisible()
  104 |   expect(
  105 |     (await (await context.request.get('/api/v1/records/stretch')).json()).items.map(
  106 |       (item: { id: string }) => item.id,
  107 |     ),
  108 |   ).toEqual([later.id])
  109 |   await page.screenshot({
  110 |     path: info.outputPath('deletion-new-record-preserved.png'),
  111 |     fullPage: true,
  112 |   })
  113 | })
  114 | 
  115 | test('RD-04 foreign proof cannot delete another account and late deletion cannot reopen private UI', async ({
  116 |   page,
  117 |   context,
  118 | }, info) => {
  119 |   const originalEmail = await join(context)
  120 |   const original = await seed(context)
  121 |   const preview = await post(context, '/records/stretch/delete-preview', {
  122 |     start: new Date(Date.parse(original.ended_at) - 1).toISOString(),
  123 |     end: new Date(Date.parse(original.ended_at) + 1).toISOString(),
  124 |   })
  125 |   expect(preview.status()).toBe(200)
  126 |   const proof = await preview.json()
  127 |   expect((await post(context, '/auth/logout')).status()).toBe(204)
  128 |   await join(context)
  129 |   const own = await seed(context, 2)
  130 |   const foreign = await post(context, '/records/stretch/delete', {
  131 |     ...proof,
  132 |     confirmation: 'delete-stretch-records',
  133 |   })
  134 |   expect(foreign.status()).toBe(403)
  135 |   expect(
  136 |     (await (await context.request.get('/api/v1/records/stretch')).json()).items.map(
  137 |       (item: { id: string }) => item.id,
  138 |     ),
  139 |   ).toEqual([own.id])
  140 |   await page.goto('/records')
  141 |   await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  142 |   await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  143 |   let release: (() => void) | undefined
  144 |   const held = new Promise<void>((done) => {
  145 |     release = done
  146 |   })
  147 |   let processed = false
  148 |   await page.route('**/api/v1/records/stretch/delete', async (route) => {
  149 |     const response = await route.fetch()
  150 |     expect(response.status()).toBe(200)
  151 |     processed = true
  152 |     await held
  153 |     await route.fulfill({ response }).catch(() => {})
  154 |   })
  155 |   await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  156 |   await expect.poll(() => processed).toBe(true)
  157 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  158 |     0,
  159 |   )
  160 |   try {
  161 |     expect((await post(context, '/auth/logout')).status()).toBe(204)
```