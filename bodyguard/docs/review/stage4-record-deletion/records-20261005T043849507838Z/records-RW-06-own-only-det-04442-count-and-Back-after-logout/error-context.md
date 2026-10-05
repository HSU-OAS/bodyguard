# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: records.spec.ts >> RW-06 own-only detail, second account and Back after logout
- Location: e2e/records.spec.ts:437:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('fixture-not-release', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('fixture-not-release', { exact: true }) with timeout 5000ms
  - waiting for getByText('fixture-not-release', { exact: true })

```

```yaml
- button "본문으로 이동"
- banner:
  - link "BODYGUARD 서비스 소개":
    - /url: /
    - text: BODYGUARD
  - navigation "계정 메뉴":
    - link "로그인":
      - /url: /login
- main:
  - complementary:
    - paragraph: BODYGUARD / MY ACCOUNT
    - heading "일상에 맞춘 몸 돌보기." [level=2]
    - paragraph: 노트북 웹캠 한 대로 시작하는 스트레칭과 자세 코칭.
    - text: "01"
    - paragraph: 카메라는 직접 시작할 때만 켜집니다. 원본 영상은 저장하거나 전송하지 않습니다.
    - paragraph: 현재 개발 중인 웹입니다. 출시 전 기능·안전·개인정보 검증을 진행하고 있습니다.
  - paragraph: 로그인
  - heading "다시 만나 반갑습니다" [level=1]
  - paragraph: 이메일로 내 계정에 로그인하세요.
  - button "Google로 계속하기" [disabled]
  - status: 구글 연결을 준비하고 있습니다. 이메일로 계속해 주세요.
  - paragraph: 또는 이메일로
  - text: 이메일
  - textbox "이메일"
  - text: 비밀번호
  - textbox "비밀번호"
  - button "비밀번호 표시": 표시
  - button "로그인"
  - paragraph:
    - text: 처음 오셨나요?
    - link "이메일로 가입":
      - /url: /signup?next=%2Fstart
  - paragraph:
    - link "비밀번호를 잊으셨나요?":
      - /url: /password/forgot
  - link "서비스 소개로 돌아가기":
    - /url: /
- contentinfo:
  - text: BODYGUARD
  - paragraph: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
```

# Test source

```ts
  344 |   await page.goBack()
  345 |   await expect(page.getByRole('heading', { name: '수행 기록 상세' })).toBeVisible()
  346 | })
  347 | test('RW-03 actual period filter and invalid input recovery', async ({ page, context }, info) => {
  348 |   await join(context)
  349 |   const historical = await seed(context, 7, 'interrupted', 14)
  350 |   await seed(context)
  351 |   await page.goto('/records')
  352 |   await expect(page.getByRole('link', { name: /^fixture-1 .*기록 상세/ })).toBeVisible()
  353 |   await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toHaveCount(0)
  354 |   const old = day(new Date(historical.ended_at))
  355 |   await filter(page, old, old)
  356 |   await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toBeVisible()
  357 |   await expect(page.getByRole('link', { name: /^fixture-1 .*기록 상세/ })).toHaveCount(0)
  358 |   await page.screenshot({ path: info.outputPath('records-period.png'), fullPage: true })
  359 |   const tomorrowFromOld = new Date(historical.ended_at)
  360 |   tomorrowFromOld.setDate(tomorrowFromOld.getDate() + 1)
  361 |   await filter(page, day(tomorrowFromOld), old)
  362 |   await expect(page.getByRole('alert')).toContainText('올바른 날짜')
  363 |   await filter(page, old, old)
  364 |   await expect(page.getByRole('alert')).toHaveCount(0)
  365 |   await expect(page.getByRole('link', { name: /^fixture-7 .*기록 상세/ })).toBeVisible()
  366 | })
  367 | test('RW-04 actual bounded pagination uses one cutoff and keyboard', async ({
  368 |   page,
  369 |   context,
  370 | }, info) => {
  371 |   await join(context)
  372 |   for (let i = 1; i <= 21; i++) await seed(context, i)
  373 |   await page.goto('/records')
  374 |   await expect(page.getByRole('row')).toHaveCount(21)
  375 |   const first = await page
  376 |     .locator('tbody a')
  377 |     .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  378 |   const firstRequest = requests.find((url) => url.includes('/api/v1/records/stretch?'))
  379 |   await page.getByRole('button', { name: '다음 페이지' }).focus()
  380 |   await page.keyboard.press('Enter')
  381 |   await expect(page.getByRole('row')).toHaveCount(2)
  382 |   await expect(page.locator('.records-results h2')).toBeFocused()
  383 |   await expect(page.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  384 |   const next = await page.locator('tbody a').getAttribute('href')
  385 |   expect(first).not.toContain(next)
  386 |   const secondRequest = requests.find((url) => url.includes('offset=20'))
  387 |   expect(new URL(firstRequest as string).searchParams.get('end')).toBe(
  388 |     new URL(secondRequest as string).searchParams.get('end'),
  389 |   )
  390 |   await page.screenshot({ path: info.outputPath('records-page-two.png'), fullPage: true })
  391 |   await page.getByRole('button', { name: '이전 페이지' }).click()
  392 |   await expect(page.getByRole('row')).toHaveCount(21)
  393 | })
  394 | test('RW-05 read failure recovery and cancelled late response after real logout', async ({
  395 |   page,
  396 |   context,
  397 | }, info) => {
  398 |   await join(context)
  399 |   await seed(context)
  400 |   await page.route('**/api/v1/records/stretch?**', (route) => route.abort('failed'))
  401 |   await page.goto('/records')
  402 |   await expect(page.getByRole('heading', { name: '기록을 불러오지 못했습니다' })).toBeVisible()
  403 |   await expect(page.getByRole('table')).toHaveCount(0)
  404 |   await page.screenshot({ path: info.outputPath('records-read-error.png'), fullPage: true })
  405 |   await page.unroute('**/api/v1/records/stretch?**')
  406 |   await page.getByRole('button', { name: '다시 조회' }).click()
  407 |   await expect(page.getByRole('table')).toBeVisible()
  408 |   let release: () => void = () => {}
  409 |   let actualRead = false
  410 |   const held = new Promise<void>((resolve) => {
  411 |     release = resolve
  412 |   })
  413 |   await page.route('**/api/v1/records/stretch?**', async (route) => {
  414 |     const response = await route.fetch()
  415 |     actualRead = true
  416 |     await held
  417 |     try {
  418 |       await route.fulfill({ response })
  419 |     } catch {
  420 |       /* aborted by account recheck */
  421 |     }
  422 |   })
  423 |   try {
  424 |     await page.reload()
  425 |     await expect.poll(() => actualRead).toBe(true)
  426 |     await expect(page.getByText('기록을 불러오고 있습니다.')).toBeVisible()
  427 |     await page.screenshot({ path: info.outputPath('records-loading.png'), fullPage: true })
  428 |     expect((await post(context, '/auth/logout')).status()).toBe(204)
  429 |     await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  430 |     await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  431 |     release()
  432 |     await expect(page.getByRole('table')).toHaveCount(0)
  433 |   } finally {
  434 |     release()
  435 |   }
  436 | })
  437 | test('RW-06 own-only detail, second account and Back after logout', async ({
  438 |   page,
  439 |   context,
  440 | }, info) => {
  441 |   await join(context)
  442 |   const record = await seed(context)
  443 |   await page.goto(`/records/${record.id}`)
> 444 |   await expect(page.getByText('fixture-not-release', { exact: true })).toBeVisible()
      |                                                                        ^ Error: expect(locator).toBeVisible() failed
  445 |   expect((await post(context, '/auth/logout')).status()).toBe(204)
  446 |   await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  447 |   await expect(page.getByRole('heading', { name: '다시 만나 반갑습니다' })).toBeVisible()
  448 |   await page.goBack()
  449 |   await expect(page.getByText('fixture-not-release', { exact: true })).toHaveCount(0)
  450 |   await join(context)
  451 |   await page.goto('/records')
  452 |   await expect(
  453 |     page.getByRole('heading', { name: '이 기간에는 수행 기록이 없습니다' }),
  454 |   ).toBeVisible()
  455 |   const foreign = await context.request.get(`/api/v1/records/stretch/${record.id}`)
  456 |   expect(foreign.status()).toBe(404)
  457 |   await page.goto(`/records/${record.id}`)
  458 |   await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
  459 |   await expect(page.getByText('fixture-not-release', { exact: true })).toHaveCount(0)
  460 |   await page.screenshot({ path: info.outputPath('record-unavailable.png'), fullPage: true })
  461 |   await page.goto('/records/not-an-id')
  462 |   await expect(page.getByRole('heading', { name: '기록을 찾을 수 없습니다' })).toBeVisible()
  463 | })
  464 |
```