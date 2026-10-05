# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authcoaching.spec.ts >> H02 actual provider prepares inert; explicit synthetic performance saves to own public record
- Location: e2e/authcoaching.spec.ts:102:1

# Error details

```
Error: page.evaluate: ReferenceError: process is not defined
    at http://localhost:4173/__private-auth-coaching-probe.js:1173:2
    at http://localhost:4173/__private-auth-coaching-probe.js:2:49
    at http://localhost:4173/__private-auth-coaching-probe.js:28247:20
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
      - paragraph [ref=e13]: MY BODYGUARD
      - heading "내 몸을 위한 시작" [level=1] [ref=e14]
      - paragraph [ref=e15]: auth-coach-1725e6b0-a35d-4053-884e-4e5b5d87767d@example.com
      - link "스트레칭 시작 경로 선택" [ref=e16] [cursor=pointer]:
        - /url: /explore
      - paragraph [ref=e17]:
        - link "내 수행 기록 확인" [ref=e18] [cursor=pointer]:
          - /url: /records
      - paragraph [ref=e19]:
        - link "계정 관리" [ref=e20] [cursor=pointer]:
          - /url: /account
      - generic [ref=e21]:
        - heading "첫 코칭 흐름을 준비하고 있습니다" [level=2] [ref=e22]
        - paragraph [ref=e23]: 동작 검증과 남녀 3D 아바타 제작이 끝나면 스트레칭 선택과 코칭을 이곳에 연결합니다. 지금은 계정 기능을 사용할 수 있습니다.
        - paragraph [ref=e24]: 카메라는 켜지지 않았습니다.
      - button "로그아웃" [ref=e25] [cursor=pointer]
  - contentinfo [ref=e26]:
    - generic [ref=e27]: BODYGUARD
    - paragraph [ref=e28]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
    - navigation "서비스 안내" [ref=e29]:
      - link "도움말" [ref=e30] [cursor=pointer]:
        - /url: /help
      - link "카메라·데이터 안내" [ref=e31] [cursor=pointer]:
        - /url: /data
```