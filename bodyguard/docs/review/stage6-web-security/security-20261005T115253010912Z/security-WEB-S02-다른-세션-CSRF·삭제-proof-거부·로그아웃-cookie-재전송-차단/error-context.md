# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: security.spec.ts >> WEB-S02 다른 세션 CSRF·삭제 proof 거부·로그아웃 cookie 재전송 차단
- Location: e2e/security.spec.ts:200:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '내 몸을 이해하는 스트레칭' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: '내 몸을 이해하는 스트레칭' })

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
  - navigation "서비스 안내":
    - link "도움말":
      - /url: /help
    - link "카메라·데이터 안내":
      - /url: /data
```

```
Error: page.evaluate: SecurityError: Failed to read the 'localStorage' property from 'Window': Access is denied for this document.
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```
