# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: datahelp.spec.ts >> DH-B02 도움말→실제 가입→데이터→기록→계정→복구와 돌아가기
- Location: e2e/datahelp.spec.ts:145:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '비밀번호를 잊으셨나요?' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '비밀번호를 잊으셨나요?' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: '비밀번호를 잊으셨나요?' })

```

```yaml
- button "본문으로 이동"
- banner:
  - link "BODYGUARD 서비스 소개":
    - /url: /
    - text: BODYGUARD
  - navigation "계정 메뉴":
    - link "내 시작":
      - /url: /start
    - link "수행 기록":
      - /url: /records
    - link "내 계정":
      - /url: /account
- main:
  - complementary:
    - paragraph: BODYGUARD / ACCOUNT RECOVERY
    - heading "내 계정으로 안전하게 돌아가기." [level=2]
    - paragraph: 이메일의 일회용 링크로 비밀번호를 바꿉니다. 변경 후에는 다시 로그인해 주세요.
    - paragraph: 비밀번호가 바뀌면 기존 로그인은 모두 종료됩니다. 카메라는 켜지지 않습니다.
  - paragraph: 계정 복구
  - heading "비밀번호 재설정 요청" [level=1]
  - paragraph: 가입한 이메일을 입력해 주세요. 가입 여부는 화면에 표시하지 않습니다.
  - text: 이메일
  - textbox "이메일"
  - button "재설정 요청"
  - paragraph:
    - link "로그인":
      - /url: /login
  - link "서비스 소개로 돌아가기":
    - /url: /
- contentinfo:
  - text: BODYGUARD
  - paragraph: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
  - navigation "서비스 안내":
    - link "도움말":
      - /url: /help
    - link "카메라·데이터 안내":
      - /url: /data
```

# Test source

```ts
  82  |   await page
  83  |     .getByRole('navigation', { name: '서비스 안내' })
  84  |     .getByRole('link', { name: '도움말', exact: true })
  85  |     .click()
  86  |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeFocused()
  87  |   await expect(page).toHaveTitle('도움말 · BODYGUARD')
  88  |   await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).focus()
  89  |   await page.keyboard.press('Tab')
  90  |   const summaries = page.locator('.guide-faq summary')
  91  |   await expect(summaries).toHaveCount(5)
  92  |   await expect(summaries.first()).toBeFocused()
  93  |   await expect(summaries.first()).toHaveCSS('outline-width', '3px')
  94  |   expect(await contrast(summaries.first(), 'outlineColor')).toBeGreaterThanOrEqual(3)
  95  |   await page.screenshot({ path: info.outputPath('help-keyboard-focus.png'), fullPage: true })
  96  |   for (let index = 0; index < 5; index++) {
  97  |     await page.keyboard.press('Enter')
  98  |     await expect(page.locator('.guide-faq details').nth(index)).toHaveAttribute('open', '')
  99  |     await page.keyboard.press('Tab')
  100 |   }
  101 |   for (const width of [1440, 768, 375]) {
  102 |     await page.setViewportSize({ width, height: 1000 })
  103 |     await noOverflow(page)
  104 |     expect(
  105 |       await contrast(page.locator('.guide-intro > p:last-child'), 'color'),
  106 |     ).toBeGreaterThanOrEqual(4.5)
  107 |     expect(
  108 |       await contrast(page.locator('.guide-faq details > p').first(), 'color'),
  109 |     ).toBeGreaterThanOrEqual(4.5)
  110 |     await page.screenshot({ path: info.outputPath(`help-${width}.png`), fullPage: true })
  111 |     for (const action of await page
  112 |       .locator('.guide-actions .button, .guide-link, .footer-link, .guide-faq summary')
  113 |       .all())
  114 |       expect(
  115 |         await action.evaluate((node) => node.getBoundingClientRect().height),
  116 |       ).toBeGreaterThanOrEqual(48)
  117 |   }
  118 |   await page.getByRole('link', { name: '카메라·데이터 안내 보기' }).click()
  119 |   await expect(page.getByRole('heading', { level: 1, name: '카메라와 데이터 안내' })).toBeFocused()
  120 |   await expect(page).toHaveTitle('카메라와 데이터 안내 · BODYGUARD')
  121 |   await expect(page.getByText('현재 카메라 코칭은 연결 전입니다.', { exact: true })).toBeVisible()
  122 |   await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  123 |   await expect(page.locator('.website')).toHaveCSS('color-scheme', 'light')
  124 |   await expect(page.locator('.website')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  125 |   await expect(page.locator('.guide-actions .primary')).toHaveCSS('transition-duration', '0s')
  126 |   for (const width of [1440, 768, 375]) {
  127 |     await page.setViewportSize({ width, height: 1000 })
  128 |     await noOverflow(page)
  129 |     expect(
  130 |       await contrast(page.locator('.guide-data-list dd').first(), 'color'),
  131 |     ).toBeGreaterThanOrEqual(4.5)
  132 |     expect(await contrast(page.locator('.guide-caption'), 'color')).toBeGreaterThanOrEqual(4.5)
  133 |     expect(await contrast(page.locator('.guide-actions .primary'), 'color')).toBeGreaterThanOrEqual(
  134 |       4.5,
  135 |     )
  136 |     await page.screenshot({ path: info.outputPath(`data-${width}.png`), fullPage: true })
  137 |   }
  138 |   await page.locator('.website').evaluate((node) => {
  139 |     ;(node as HTMLElement).style.zoom = '2'
  140 |   })
  141 |   await noOverflow(page)
  142 |   await page.screenshot({ path: info.outputPath('data-css-zoom-200.png'), fullPage: true })
  143 |   expect(apiRequests.every((entry) => entry === 'GET /api/v1/me')).toBe(true)
  144 | })
  145 | test('DH-B02 도움말→실제 가입→데이터→기록→계정→복구와 돌아가기', async ({ page }, info) => {
  146 |   const email = `help-${randomUUID()}@example.com`
  147 |   await page.goto('/help')
  148 |   await page.getByRole('link', { name: '이메일 가입', exact: true }).click()
  149 |   await page.getByLabel('이메일', { exact: true }).fill(email)
  150 |   await page.getByLabel('비밀번호', { exact: true }).fill('격리된 도움말 시험 비밀번호 12345')
  151 |   await page.getByRole('button', { name: '인증 코드 받기', exact: true }).click()
  152 |   await expect(page.getByRole('heading', { name: '이메일을 확인해 주세요' })).toBeVisible()
  153 |   let code = ''
  154 |   await expect
  155 |     .poll(() => {
  156 |       code = JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? ''
  157 |       return code
  158 |     })
  159 |     .toMatch(/^[0-9]{6}$/)
  160 |   await page.getByLabel('인증 코드', { exact: true }).fill(code)
  161 |   await page.getByRole('button', { name: '인증하고 시작하기' }).click()
  162 |   await expect(page.getByRole('heading', { name: '내 몸을 위한 시작' })).toBeVisible()
  163 |   apiRequests = []
  164 |   await page
  165 |     .getByRole('navigation', { name: '서비스 안내' })
  166 |     .getByRole('link', { name: '카메라·데이터 안내' })
  167 |     .click()
  168 |   await expect(page.getByRole('heading', { name: '카메라와 데이터 안내' })).toBeVisible()
  169 |   expect(apiRequests.every((entry) => entry === 'GET /api/v1/me')).toBe(true)
  170 |   await page.screenshot({ path: info.outputPath('data-member.png'), fullPage: true })
  171 |   await page.getByRole('link', { name: '수행 기록 관리', exact: true }).click()
  172 |   await expect(page.getByRole('heading', { name: '내 수행 기록' })).toBeVisible()
  173 |   await expect(page.getByText('이 기간에는 수행 기록이 없습니다', { exact: true })).toBeVisible()
  174 |   await page.getByRole('link', { name: '내 계정', exact: true }).click()
  175 |   await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
  176 |   await page
  177 |     .getByRole('navigation', { name: '서비스 안내' })
  178 |     .getByRole('link', { name: '도움말', exact: true })
  179 |     .click()
  180 |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  181 |   await page.getByRole('link', { name: '계정 복구', exact: true }).click()
> 182 |   await expect(page.getByRole('heading', { name: '비밀번호를 잊으셨나요?' })).toBeVisible()
      |                                                                     ^ Error: expect(locator).toBeVisible() failed
  183 |   await page.goBack()
  184 |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  185 |   await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).click()
  186 |   await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
  187 | })
  188 | test('DH-B03 계정 연결 실패 주입 중에도 공개 안내·FAQ·직접 주소 접근', async ({ page }, info) => {
  189 |   await page.route('**/api/v1/me', (route) => route.abort('failed'))
  190 |   await page.goto('/data')
  191 |   await expect(page.getByRole('heading', { level: 1, name: '카메라와 데이터 안내' })).toBeVisible()
  192 |   await page.setViewportSize({ width: 375, height: 900 })
  193 |   await noOverflow(page)
  194 |   await page.screenshot({ path: info.outputPath('data-account-offline-375.png'), fullPage: true })
  195 |   await page.getByRole('link', { name: '이용 도움말 보기' }).click()
  196 |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  197 |   await page.reload()
  198 |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  199 |   await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).click()
  200 |   await expect(page.getByRole('heading', { name: '연결을 확인해 주세요' })).toBeVisible()
  201 |   await page
  202 |     .getByRole('navigation', { name: '서비스 안내' })
  203 |     .getByRole('link', { name: '카메라·데이터 안내' })
  204 |     .click()
  205 |   await expect(page.getByRole('heading', { name: '카메라와 데이터 안내' })).toBeVisible()
  206 |   expect(apiRequests.every((entry) => entry === 'GET /api/v1/me')).toBe(true)
  207 | })
  208 |
```