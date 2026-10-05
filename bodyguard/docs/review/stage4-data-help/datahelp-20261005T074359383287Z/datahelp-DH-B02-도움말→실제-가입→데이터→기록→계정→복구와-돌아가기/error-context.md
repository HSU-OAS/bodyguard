# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: datahelp.spec.ts >> DH-B02 도움말→실제 가입→데이터→기록→계정→복구와 돌아가기
- Location: e2e/datahelp.spec.ts:145:1

# Error details

```
Error: expect(received).toMatch(expected)

Expected pattern: /^[A-Za-z0-9_-]{43}$/
Received string:  "http://localhost:4173/password/reset#token=L9TGOypJj3dqw5xWywzpkeC6Y8I1btnSDjZRxUApcXs"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
      - complementary [ref=e13]:
        - paragraph [ref=e14]: BODYGUARD / ACCOUNT RECOVERY
        - heading "내 계정으로 안전하게 돌아가기." [level=2] [ref=e15]: 내 계정으로안전하게 돌아가기.
        - paragraph [ref=e16]: 이메일의 일회용 링크로 비밀번호를 바꿉니다. 변경 후에는 다시 로그인해 주세요.
        - paragraph [ref=e17]: 비밀번호가 바뀌면 기존 로그인은 모두 종료됩니다.카메라는 켜지지 않습니다.
      - generic [ref=e18]:
        - paragraph [ref=e19]: 계정 복구
        - heading "비밀번호 재설정 요청" [level=1] [ref=e20]
        - paragraph [ref=e21]: 가입한 이메일을 입력해 주세요. 가입 여부는 화면에 표시하지 않습니다.
        - generic [ref=e22]:
          - generic [ref=e23]:
            - text: 이메일
            - textbox "이메일" [ref=e24]: help-014bed30-5593-4b01-9a3e-221ac604eeda@example.com
          - status [ref=e25]: 요청을 접수했습니다. 등록된 이메일이면 재설정 안내를 받을 수 있습니다. 받지 못했다면 스팸함을 확인하거나 다시 요청해 주세요.
          - button "다시 요청하기" [ref=e26] [cursor=pointer]
        - paragraph [ref=e27]:
          - link "로그인" [ref=e28] [cursor=pointer]:
            - /url: /login
        - link "서비스 소개로 돌아가기" [ref=e29] [cursor=pointer]:
          - /url: /
  - contentinfo [ref=e30]:
    - generic [ref=e31]: BODYGUARD
    - paragraph [ref=e32]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
    - navigation "서비스 안내" [ref=e33]:
      - link "도움말" [ref=e34] [cursor=pointer]:
        - /url: /help
      - link "카메라·데이터 안내" [ref=e35] [cursor=pointer]:
        - /url: /data
```

# Test source

```ts
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
  182 |   await expect(page.getByRole('heading', { name: '비밀번호 재설정 요청' })).toBeVisible()
  183 |   await page.getByLabel('이메일', { exact: true }).fill(email)
  184 |   await page.getByRole('button', { name: '재설정 요청', exact: true }).click()
  185 |   await expect(page.getByRole('status')).toContainText('요청을 접수했습니다')
  186 |   await expect
  187 |     .poll(() => JSON.parse(readFileSync(mailbox as string, 'utf8'))[email] ?? '')
> 188 |     .toMatch(/^[A-Za-z0-9_-]{43}$/)
      |      ^ Error: expect(received).toMatch(expected)
  189 |   await page.goBack()
  190 |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  191 |   await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).click()
  192 |   await expect(page.getByRole('heading', { level: 1, name: '내 계정' })).toBeVisible()
  193 | })
  194 | test('DH-B03 계정 연결 실패 주입 중에도 공개 안내·FAQ·직접 주소 접근', async ({ page }, info) => {
  195 |   await page.route('**/api/v1/me', (route) => route.abort('failed'))
  196 |   await page.goto('/data')
  197 |   await expect(page.getByRole('heading', { level: 1, name: '카메라와 데이터 안내' })).toBeVisible()
  198 |   await page.setViewportSize({ width: 375, height: 900 })
  199 |   await noOverflow(page)
  200 |   await page.screenshot({ path: info.outputPath('data-account-offline-375.png'), fullPage: true })
  201 |   await page.getByRole('link', { name: '이용 도움말 보기' }).click()
  202 |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  203 |   await page.reload()
  204 |   await expect(page.getByRole('heading', { level: 1, name: '도움말' })).toBeVisible()
  205 |   await page.getByRole('link', { name: '계정 관리·탈퇴', exact: true }).click()
  206 |   await expect(page.getByRole('heading', { name: '연결을 확인해 주세요' })).toBeVisible()
  207 |   await page
  208 |     .getByRole('navigation', { name: '서비스 안내' })
  209 |     .getByRole('link', { name: '카메라·데이터 안내' })
  210 |     .click()
  211 |   await expect(page.getByRole('heading', { name: '카메라와 데이터 안내' })).toBeVisible()
  212 |   expect(apiRequests.every((entry) => entry === 'GET /api/v1/me')).toBe(true)
  213 | })
  214 |
```