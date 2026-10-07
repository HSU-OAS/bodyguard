# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: nativerecovery.spec.ts >> female native track lost→stop→explicit retry
- Location: e2e/nativerecovery.spec.ts:319:3

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
    "models": 0,
-   "reason": "inference-error",
+   "reason": null,
    "session": "ended",
  }

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
        - paragraph [ref=e16]: native-recovery-5c42cbdf-81d0-4796-ab6d-eb85ce9c7d32@example.com
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
  239 |   expect((await state(page)).hook).toBe('prepared')
  240 |   await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
  241 |   await expect.poll(async () => (await state(page)).frames).toBeGreaterThan(3)
  242 |   expect(await state(page)).toMatchObject({
  243 |     session: 'running',
  244 |     models: 2,
  245 |     framing: [true, true],
  246 |     verifiedMs: 0,
  247 |     resources: { cameraError: null },
  248 |   })
  249 |   expect((await camera(page)).calls).toBe(before.calls + 1)
  250 |   await mark(page, 'explicit-native-restart')
  251 | }
  252 | for (const gender of ['male', 'female'] as const) {
  253 |   test(`${gender} browser permission denied→explicit retry`, async ({ page, context }) => {
  254 |     await join(context)
  255 |     await mount(page, gender)
  256 |     await context.grantPermissions([])
  257 |     expect(
  258 |       await page.evaluate(
  259 |         async () => (await navigator.permissions.query({ name: 'camera' as PermissionName })).state,
  260 |       ),
  261 |     ).toBe('denied')
  262 |     await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
  263 |     await expect
  264 |       .poll(() => state(page))
  265 |       .toMatchObject({
  266 |         session: 'ended',
  267 |         reason: 'camera-error',
  268 |         resources: { cameraError: 'denied' },
  269 |         models: 0,
  270 |         frames: 0,
  271 |       })
  272 |     expect((await camera(page)).streams).toBe(0)
  273 |     await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.save())
  274 |     expect(posts).toBe(0)
  275 |     await mark(page, 'browser-denied-no-ready-or-record')
  276 |     await context.grantPermissions(['camera'])
  277 |     await restart(page)
  278 |   })
  279 |   test(`${gender} delayed native camera→cancel→late reclaim→explicit retry`, async ({
  280 |     page,
  281 |     context,
  282 |   }) => {
  283 |     await join(context)
  284 |     await mount(page, gender)
  285 |     await page.evaluate(() => {
  286 |       const w = window as unknown as PrivateWindow
  287 |       w.nativeRecoveryControls.holdCamera()
  288 |       void w.nativeRecoveryProbe.start()
  289 |     })
  290 |     await expect.poll(() => camera(page)).toMatchObject({ held: true, streams: 1, calls: 1 })
  291 |     await page.evaluate(() => {
  292 |       const p = (window as unknown as PrivateWindow).nativeRecoveryProbe
  293 |       p.beginCancel()
  294 |       p.beginPrepare()
  295 |     })
  296 |     await expect
  297 |       .poll(() => state(page))
  298 |       .toMatchObject({
  299 |         owned: false,
  300 |         hook: 'preparing',
  301 |         prepareFinished: false,
  302 |         frames: 0,
  303 |         models: 0,
  304 |       })
  305 |     expect((await camera(page)).calls).toBe(1)
  306 |     await mark(page, 'cancel-and-replacement-wait-native-camera')
  307 |     await page.evaluate(() =>
  308 |       (window as unknown as PrivateWindow).nativeRecoveryControls.releaseCamera(),
  309 |     )
  310 |     await page.evaluate(async () => {
  311 |       const p = (window as unknown as PrivateWindow).nativeRecoveryProbe
  312 |       await p.finishCancel()
  313 |       await p.finishPrepare()
  314 |     })
  315 |     expect(await camera(page)).toMatchObject({ tracksEnded: true, calls: 1, detached: true })
  316 |     await mark(page, 'late-native-stream-reclaimed-no-auto-start')
  317 |     await restart(page)
  318 |   })
  319 |   test(`${gender} native track lost→stop→explicit retry`, async ({ page, context }) => {
  320 |     await join(context)
  321 |     await mount(page, gender)
  322 |     await restart(page)
  323 |     await page.evaluate(() =>
  324 |       (window as unknown as PrivateWindow).nativeRecoveryControls.disconnect(),
  325 |     )
  326 |     await expect
  327 |       .poll(() => state(page))
> 328 |       .toMatchObject({ session: 'ended', reason: 'inference-error', models: 0 })
      |        ^ Error: expect(received).toMatchObject(expected)
  329 |     await expect.poll(() => camera(page)).toMatchObject({ tracksEnded: true, detached: true })
  330 |     await mark(page, 'native-track-stop-synthetic-ended-event')
  331 |     const frames = (await state(page)).frames
  332 |     await restart(page)
  333 |     await expect.poll(async () => (await state(page)).frames).toBeGreaterThan(frames + 3)
  334 |   })
  335 |   test(`${gender} GLB HTTP404→native cleanup→explicit retry`, async ({ page, context }) => {
  336 |     await join(context)
  337 |     await mount(page, gender)
  338 |     const pattern = `**/__private-recovery-${gender}.glb`,
  339 |       handler = (r: import('@playwright/test').Route) =>
  340 |         r.fulfill({ status: 404, body: 'Fixture asset unavailable' })
  341 |     await page.route(pattern, handler)
  342 |     await page.evaluate(() => (window as unknown as PrivateWindow).nativeRecoveryProbe.start())
  343 |     await expect
  344 |       .poll(() => state(page))
  345 |       .toMatchObject({ session: 'ended', reason: 'asset-error', models: 0, frames: 0 })
  346 |     await expect.poll(() => camera(page)).toMatchObject({ tracksEnded: true, detached: true })
  347 |     await mark(page, 'asset-http404-no-ready-or-record')
  348 |     await page.unroute(pattern, handler)
  349 |     await restart(page)
  350 |   })
  351 | }
  352 |
```
