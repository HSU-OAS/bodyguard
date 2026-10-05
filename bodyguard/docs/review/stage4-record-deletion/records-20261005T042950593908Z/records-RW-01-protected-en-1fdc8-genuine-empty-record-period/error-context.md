# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: records.spec.ts >> RW-01 protected entry and genuine empty record period
- Location: e2e/records.spec.ts:198:1

# Error details

```
Error: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost:4173/start
Call log:
  - navigating to "http://localhost:4173/start", waiting until "load"

```

```
Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic [ref=f1e6]:
    - heading "localhost 페이지를 찾을 수 없음" [level=1] [ref=f1e7]
    - paragraph [ref=f1e9]:
      - text: 다음 웹 주소(
      - strong [ref=f1e10]: http://localhost:4173/start
      - text: )에 대해 발견된 웹페이지가 없습니다.
    - generic [ref=f1e11]: HTTP ERROR 404
  - button "새로고침" [ref=f1e14] [cursor=pointer]
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
> 37  |   expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
      |                     ^ Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
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
  61  |   expect(verified.status()).toBe(201)
  62  | }
  63  | async function seed(
  64  |   context: BrowserContext,
  65  |   index = 1,
  66  |   outcome: 'completed' | 'interrupted' | 'skipped' = 'interrupted',
  67  |   daysAgo = 0,
  68  |   long = false,
  69  | ) {
  70  |   const end = new Date(Date.now() - daysAgo * 86400000 - index * 60000)
  71  |   const record = {
  72  |     id: randomUUID(),
  73  |     motion_id: long ? 'fixture-long-'.padEnd(64, 'a') : `fixture-${index}`,
  74  |     protocol_version: 'fixture-not-release',
  75  |     started_at: new Date(end.getTime() - 90000).toISOString(),
  76  |     ended_at: end.toISOString(),
  77  |     outcome,
  78  |     observed_ms: outcome === 'skipped' ? 0 : 65000,
  79  |     repetitions: outcome === 'skipped' ? 0 : 1,
  80  |   }
  81  |   const result = await post(context, '/records/stretch', record)
  82  |   expect(result.status()).toBe(201)
  83  |   expect((await result.json()).provenance).toBe('client-reported')
  84  |   return record
  85  | }
  86  | function day(date: Date) {
  87  |   return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
  88  | }
  89  | 
  90  | test('RD-03 server confirmation expiry preserves record without an automatic retry', async ({
  91  |   page,
  92  |   context,
  93  | }, info) => {
  94  |   const clockFile = process.env.BODYGUARD_TEST_RECORD_CLOCK
  95  |   if (
  96  |     !clockFile?.startsWith('/private/tmp/bodyguard-browser-') ||
  97  |     !clockFile.endsWith('/record-clock.json')
  98  |   )
  99  |     throw new Error('Owned test clock required')
  100 |   function offset(seconds: number) {
  101 |     writeFileSync(`${clockFile}.next`, JSON.stringify({ offset_seconds: seconds }), { mode: 0o600 })
  102 |     renameSync(`${clockFile}.next`, clockFile as string)
  103 |   }
  104 |   await join(context)
  105 |   await seed(context)
  106 |   await page.goto('/records')
  107 |   await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  108 |   await expect(page.getByText('삭제 대상: 1건', { exact: true })).toBeVisible()
  109 |   try {
  110 |     offset(601)
  111 |     await page.getByRole('button', { name: '기록 삭제', exact: true }).click()
  112 |     await expect(page.getByText(/삭제 확인이 만료되었거나 대상이 바뀌었습니다/)).toBeVisible()
  113 |     expect(
  114 |       (await (await context.request.get('/api/v1/records/stretch')).json()).items,
  115 |     ).toHaveLength(1)
  116 |     await expect(page.getByRole('button', { name: '기록 삭제', exact: true })).toHaveCount(0)
  117 |     await page.screenshot({ path: info.outputPath('deletion-expired.png'), fullPage: true })
  118 |   } finally {
  119 |     offset(0)
  120 |   }
  121 | })
  122 | 
  123 | test('RD-02 changed real SQL target requires another preview and preserves remaining record', async ({
  124 |   page,
  125 |   context,
  126 | }, info) => {
  127 |   await join(context)
  128 |   const first = await seed(context, 1)
  129 |   await seed(context, 2)
  130 |   await page.goto('/records')
  131 |   await expect(page.getByRole('table')).toBeVisible()
  132 |   await page.getByRole('button', { name: '이 기간 기록 삭제', exact: true }).click()
  133 |   await expect(page.getByText('삭제 대상: 2건', { exact: true })).toBeVisible()
  134 |   const partial = await post(context, '/records/stretch/delete-preview', {
  135 |     start: first.ended_at,
  136 |     end: new Date(Date.parse(first.ended_at) + 1).toISOString(),
  137 |   })
```