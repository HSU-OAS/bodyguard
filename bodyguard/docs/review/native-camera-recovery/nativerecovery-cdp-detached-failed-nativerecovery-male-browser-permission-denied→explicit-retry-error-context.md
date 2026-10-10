# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: nativerecovery.spec.ts >> male browser permission denied→explicit retry
- Location: e2e/nativerecovery.spec.ts:280:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "denied"
Received: "prompt"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - button "본문으로 이동" [ref=e4]
    - banner [ref=e5]:
      - link "BODYGUARD 서비스 소개" [ref=e6] [cursor=pointer]:
        - /url: /
        - text: BODYGUARD.
      - navigation "계정 메뉴" [ref=e7]:
        - link "내 시작" [ref=e8] [cursor=pointer]:
          - /url: /start
        - link "자세 기록" [ref=e9] [cursor=pointer]:
          - /url: /posture-records
        - link "수행 기록" [ref=e10] [cursor=pointer]:
          - /url: /records
        - link "내 계정" [ref=e11] [cursor=pointer]:
          - /url: /account
    - main [ref=e12]:
      - generic [ref=e13]:
        - paragraph [ref=e14]: MY BODYGUARD
        - heading "내 몸을 위한 시작" [active] [level=1] [ref=e15]
        - paragraph [ref=e16]: native-recovery-7fb8346e-5d07-4878-96b0-3c8a41a5fce4@example.com
        - link "스트레칭 시작 경로 선택" [ref=e17] [cursor=pointer]:
          - /url: /explore
        - paragraph [ref=e18]:
          - link "내 수행 기록 확인" [ref=e19] [cursor=pointer]:
            - /url: /records
        - paragraph [ref=e20]:
          - link "내 자세 기록 확인" [ref=e21] [cursor=pointer]:
            - /url: /posture-records
        - paragraph [ref=e22]:
          - link "계정 관리" [ref=e23] [cursor=pointer]:
            - /url: /account
        - generic [ref=e24]:
          - heading "첫 코칭 흐름을 준비하고 있습니다" [level=2] [ref=e25]
          - paragraph [ref=e26]: 동작 검증과 남녀 3D 아바타 제작이 끝나면 스트레칭 선택과 코칭을 이곳에 연결합니다. 지금은 계정 기능을 사용할 수 있습니다.
          - paragraph [ref=e27]: 카메라는 켜지지 않았습니다.
        - button "로그아웃" [ref=e28] [cursor=pointer]
    - contentinfo [ref=e29]:
      - generic [ref=e30]: BODYGUARD
      - paragraph [ref=e31]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
      - navigation "서비스 안내" [ref=e32]:
        - link "도움말" [ref=e33] [cursor=pointer]:
          - /url: /help
        - link "카메라·데이터 안내" [ref=e34] [cursor=pointer]:
          - /url: /data
  - paragraph [ref=e35]: 내부 복구 시험 · 미완성 A37 · 가짜 카메라 · 코칭 아님
```

# Test source

```ts
  177 |       },
  178 |       null,
  179 |       2,
  180 |     )}\n`,
  181 |   )
  182 |   await info.attach('native-recovery-summary', { path: file, contentType: 'application/json' })
  183 | })
  184 | async function join(context: BrowserContext) {
  185 |   const csrf = async () =>
  186 |     (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  187 |   const email = `native-recovery-${randomUUID()}@example.com`
  188 |   const response = await context.request.post('/api/v1/auth/signup', {
  189 |     headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
  190 |     data: { email, password: '합성 계정 복구 시험 비밀번호 12345' },
  191 |   })
  192 |   expect(response.status()).toBe(202)
  193 |   let code = ''
  194 |   await expect
  195 |     .poll(() => {
  196 |       code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
  197 |       return code
  198 |     })
  199 |     .toMatch(/^[0-9]{6}$/)
  200 |   expect(
  201 |     (
  202 |       await context.request.post('/api/v1/auth/verify', {
  203 |         headers: { Origin: origin, 'X-CSRF-Token': await csrf() },
  204 |         data: { challenge_id: (await response.json()).challenge_id, code },
  205 |       })
  206 |     ).status(),
  207 |   ).toBe(201)
  208 | }
  209 | async function mark(page: Page, name: string) {
  210 |   stages.push({ name, state: await state(page), native: await camera(page) })
  211 | }
  212 | async function mount(page: Page, gender: 'male' | 'female') {
  213 |   await page.goto('/start')
  214 |   await expect(page.getByRole('heading', { name: '내 몸을 위한 시작', exact: true })).toBeVisible()
  215 |   await page.evaluate(async (gender) => {
  216 |     const path = '/__private-native-recovery-probe.js',
  217 |       module = (await import(path)) as { mountNativeRecoveryProbe: typeof mountNativeRecoveryProbe }
  218 |     const label = document.createElement('p')
  219 |     label.textContent = '내부 복구 시험 · 미완성 A37 · 가짜 카메라 · 코칭 아님'
  220 |     document.body.append(label)
  221 |     const canvas = document.createElement('canvas')
  222 |     canvas.id = 'native-recovery-avatar'
  223 |     document.body.append(canvas)
  224 |     ;(window as unknown as PrivateWindow).nativeRecoveryProbe = module.mountNativeRecoveryProbe(
  225 |       canvas,
  226 |       gender,
  227 |     )
  228 |   }, gender)
  229 |   await expect
  230 |     .poll(() => state(page))
  231 |     .toMatchObject({ auth: 'ready', hook: 'idle', frames: 0, renderFrames: 0 })
  232 |   await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.prepare())
  233 |   expect((await camera(page)).calls).toBe(0)
  234 |   expect((await state(page)).hook).toBe('prepared')
  235 | }
  236 | async function restart(page: Page) {
  237 |   await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.prepare())
  238 |   const before = await camera(page)
  239 |   const beforeFrames = (await state(page)).frames
  240 |   expect((await state(page)).hook).toBe('prepared')
  241 |   await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
  242 |   await expect.poll(async () => (await state(page)).frames).toBeGreaterThan(beforeFrames + 3)
  243 |   expect(await state(page)).toMatchObject({
  244 |     session: 'running',
  245 |     models: 2,
  246 |     framing: [true, true],
  247 |     verifiedMs: 0,
  248 |     resources: { cameraError: null },
  249 |   })
  250 |   expect((await camera(page)).calls).toBe(before.calls + 1)
  251 |   await mark(page, 'explicit-native-restart')
  252 | }
  253 | async function setCameraPermission(
  254 |   context: BrowserContext,
  255 |   page: Page,
  256 |   setting: 'denied' | 'granted',
  257 | ) {
  258 |   const protocol = await context.newCDPSession(page)
  259 |   try {
  260 |     const { targetInfo } = await protocol.send('Target.getTargetInfo')
  261 |     if (!targetInfo.browserContextId) throw new Error('Owned browser context required')
  262 |     await protocol.send('Browser.setPermission', {
  263 |       permission: { name: 'camera' },
  264 |       setting,
  265 |       origin,
  266 |       browserContextId: targetInfo.browserContextId,
  267 |     })
  268 |   } finally {
  269 |     await protocol.detach()
  270 |   }
  271 |   await expect
  272 |     .poll(() =>
  273 |       page.evaluate(
  274 |         async () => (await navigator.permissions.query({ name: 'camera' as PermissionName })).state,
  275 |       ),
  276 |     )
> 277 |     .toBe(setting)
      |      ^ Error: expect(received).toBe(expected) // Object.is equality
  278 | }
  279 | for (const gender of ['male', 'female'] as const) {
  280 |   test(`${gender} browser permission denied→explicit retry`, async ({ page, context }, info) => {
  281 |     await join(context)
  282 |     await mount(page, gender)
  283 |     await setCameraPermission(context, page, 'denied')
  284 |     await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
  285 |     await expect
  286 |       .poll(() => state(page))
  287 |       .toMatchObject({
  288 |         session: 'ended',
  289 |         reason: 'camera-error',
  290 |         resources: { cameraError: 'denied' },
  291 |         models: 0,
  292 |         frames: 0,
  293 |       })
  294 |     expect((await camera(page)).streams).toBe(0)
  295 |     await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.save())
  296 |     expect(posts).toBe(0)
  297 |     await mark(page, 'browser-denied-no-ready-or-record')
  298 |     await setCameraPermission(context, page, 'granted')
  299 |     await restart(page)
  300 |     const preview = info.outputPath(`${gender}-restarted-avatar-only.png`)
  301 |     await page.locator('#native-recovery-avatar').screenshot({ path: preview })
  302 |     await info.attach('WIP-avatar-only-no-camera', { path: preview, contentType: 'image/png' })
  303 |   })
  304 |   test(`${gender} delayed native camera→cancel→late reclaim→explicit retry`, async ({
  305 |     page,
  306 |     context,
  307 |   }) => {
  308 |     await join(context)
  309 |     await mount(page, gender)
  310 |     await page.evaluate(() => {
  311 |       const w = window as unknown as PrivateWindow
  312 |       w.nativeRecoveryControls.holdCamera()
  313 |       void w.nativeRecoveryProbe.start()
  314 |     })
  315 |     await expect.poll(() => camera(page)).toMatchObject({ held: true, streams: 1, calls: 1 })
  316 |     await page.evaluate(() => {
  317 |       const p = (window as unknown as PrivateWindow).nativeRecoveryProbe
  318 |       p.beginCancel()
  319 |       p.beginPrepare()
  320 |     })
  321 |     await expect
  322 |       .poll(() => state(page))
  323 |       .toMatchObject({
  324 |         owned: false,
  325 |         hook: 'preparing',
  326 |         prepareFinished: false,
  327 |         frames: 0,
  328 |         models: 0,
  329 |       })
  330 |     expect((await camera(page)).calls).toBe(1)
  331 |     await mark(page, 'cancel-and-replacement-wait-native-camera')
  332 |     await page.evaluate(() =>
  333 |       (window as unknown as PrivateWindow).nativeRecoveryControls.releaseCamera(),
  334 |     )
  335 |     await page.evaluate(async () => {
  336 |       const p = (window as unknown as PrivateWindow).nativeRecoveryProbe
  337 |       await p.finishCancel()
  338 |       await p.finishPrepare()
  339 |     })
  340 |     expect(await camera(page)).toMatchObject({ tracksEnded: true, calls: 1, detached: true })
  341 |     await mark(page, 'late-native-stream-reclaimed-no-auto-start')
  342 |     await restart(page)
  343 |   })
  344 |   test(`${gender} native track lost→stop→explicit retry`, async ({ page, context }) => {
  345 |     await join(context)
  346 |     await mount(page, gender)
  347 |     await restart(page)
  348 |     await page.evaluate(() =>
  349 |       (window as unknown as PrivateWindow).nativeRecoveryControls.disconnect(),
  350 |     )
  351 |     await expect
  352 |       .poll(() => state(page))
  353 |       .toMatchObject({ session: 'ended', reason: 'inference-error', models: 0 })
  354 |     await expect.poll(() => camera(page)).toMatchObject({ tracksEnded: true, detached: true })
  355 |     await mark(page, 'native-track-stop-synthetic-ended-event')
  356 |     const frames = (await state(page)).frames
  357 |     await restart(page)
  358 |     await expect.poll(async () => (await state(page)).frames).toBeGreaterThan(frames + 3)
  359 |   })
  360 |   test(`${gender} GLB HTTP404→native cleanup→explicit retry`, async ({ page, context }) => {
  361 |     await join(context)
  362 |     await mount(page, gender)
  363 |     const pattern = `**/__private-recovery-${gender}.glb`,
  364 |       handler = (r: import('@playwright/test').Route) =>
  365 |         r.fulfill({ status: 404, body: 'Fixture asset unavailable' })
  366 |     await page.route(pattern, handler)
  367 |     await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
  368 |     await expect
  369 |       .poll(() => state(page))
  370 |       .toMatchObject({ session: 'ended', reason: 'asset-error', models: 0, frames: 0 })
  371 |     await expect.poll(() => camera(page)).toMatchObject({ tracksEnded: true, detached: true })
  372 |     await mark(page, 'asset-http404-no-ready-or-record')
  373 |     await page.unroute(pattern, handler)
  374 |     await restart(page)
  375 |   })
  376 | }
  377 |
```
