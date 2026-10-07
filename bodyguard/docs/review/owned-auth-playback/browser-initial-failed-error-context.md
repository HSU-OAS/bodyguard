# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authcoaching.spec.ts >> H05 actual logout succeeds but never permits old session resume or save
- Location: e2e/authcoaching.spec.ts:212:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 401
Received: 404
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
    - navigation "서비스 안내" [ref=e44]:
      - link "도움말" [ref=e45] [cursor=pointer]:
        - /url: /help
      - link "카메라·데이터 안내" [ref=e46] [cursor=pointer]:
        - /url: /data
```

# Test source

```ts
  130 |   await page.screenshot({ path: info.outputPath('auth-coaching-record.png'), fullPage: true })
  131 | })
  132 | test('H03 actual same-account refresh revokes old running session; no automatic recreation', async ({
  133 |   page,
  134 |   context,
  135 | }) => {
  136 |   await join(context)
  137 |   await mount(page)
  138 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  139 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  140 |   await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  141 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.refresh())
  142 |   await expect
  143 |     .poll(() => state(page))
  144 |     .toMatchObject({
  145 |       auth: 'ready',
  146 |       hook: 'idle',
  147 |       owned: false,
  148 |       session: 'ended',
  149 |       disposed: 3,
  150 |       lifecycleClosed: 1,
  151 |     })
  152 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.resume())
  153 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  154 |   expect(posts).toBe(0)
  155 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  156 |     0,
  157 |   )
  158 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  159 | })
  160 | test('H03 failed logout is not permission to keep coaching or save', async ({ page, context }) => {
  161 |   await join(context)
  162 |   await mount(page)
  163 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  164 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  165 |   await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  166 |   await page.route('**/api/v1/auth/logout', (route) =>
  167 |     route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  168 |   )
  169 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.signOut())
  170 |   await expect
  171 |     .poll(() => state(page))
  172 |     .toMatchObject({
  173 |       auth: 'logout-error',
  174 |       hook: 'idle',
  175 |       owned: false,
  176 |       disposed: 3,
  177 |       lifecycleClosed: 1,
  178 |     })
  179 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  180 |   expect(posts).toBe(0)
  181 |   expect((await (await context.request.get('/api/v1/records/stretch')).json()).items).toHaveLength(
  182 |     0,
  183 |   )
  184 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  185 | })
  186 | test('H04 pagehide during synthetic pending permission reclaims late resource; pageshow never starts', async ({
  187 |   page,
  188 |   context,
  189 | }) => {
  190 |   await join(context)
  191 |   await mount(page, true)
  192 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  193 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  194 |   await expect.poll(() => state(page)).toMatchObject({ waiting: true, session: 'preparing' })
  195 |   await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  196 |   await expect
  197 |     .poll(() => state(page))
  198 |     .toMatchObject({ hook: 'idle', owned: false, lifecycleClosed: 1 })
  199 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.release())
  200 |   expect(await state(page)).toMatchObject({ acquired: 1, disposed: 1, session: 'ended' })
  201 |   await page.evaluate(() =>
  202 |     window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  203 |   )
  204 |   await expect
  205 |     .poll(() => state(page))
  206 |     .toMatchObject({ auth: 'ready', hook: 'idle', acquired: 1, disposed: 1, owned: false })
  207 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  208 |   expect(posts).toBe(0)
  209 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  210 | })
  211 |
  212 | test('H05 actual logout succeeds but never permits old session resume or save', async ({
  213 |   page,
  214 |   context,
  215 | }) => {
  216 |   await join(context)
  217 |   await mount(page)
  218 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  219 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  220 |   await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  221 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.signOut())
  222 |   await expect
  223 |     .poll(() => state(page))
  224 |     .toMatchObject({
  225 |       auth: 'guest',
  226 |       owned: false,
  227 |       disposed: 3,
  228 |       lifecycleClosed: 1,
  229 |     })
> 230 |   expect((await context.request.get('/api/v1/auth/me')).status()).toBe(401)
      |                                                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  231 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.resume())
  232 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  233 |   expect(posts).toBe(0)
  234 |   expect(await state(page)).toMatchObject({ acquired: 3, lifecycleClosed: 1 })
  235 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  236 | })
  237 |
  238 | test('H05 actual server revoked account returns 401 and refresh retires the owned lifecycle', async ({
  239 |   page,
  240 |   context,
  241 | }) => {
  242 |   await join(context)
  243 |   await mount(page)
  244 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.prepare())
  245 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.start())
  246 |   await expect.poll(() => state(page)).toMatchObject({ session: 'running', acquired: 3 })
  247 |   const csrf = (await (await context.request.get('/api/v1/auth/csrf')).json()).csrf_token
  248 |   expect(
  249 |     (
  250 |       await context.request.post('/api/v1/auth/logout', {
  251 |         headers: { Origin: origin, 'X-CSRF-Token': csrf },
  252 |       })
  253 |     ).status(),
  254 |   ).toBe(204)
  255 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.refresh())
  256 |   await expect
  257 |     .poll(() => state(page))
  258 |     .toMatchObject({
  259 |       auth: 'guest',
  260 |       owned: false,
  261 |       disposed: 3,
  262 |       lifecycleClosed: 1,
  263 |     })
  264 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.save())
  265 |   expect(posts).toBe(0)
  266 |   await page.evaluate(() => (window as unknown as PrivateWindow).authCoachingProbe.unmount())
  267 | })
  268 |
```