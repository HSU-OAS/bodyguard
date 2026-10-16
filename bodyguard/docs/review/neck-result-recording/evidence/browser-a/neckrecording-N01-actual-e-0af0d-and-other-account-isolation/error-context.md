# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: neckrecording.spec.ts >> N01 actual ended UI saves completed and interrupted summaries; current record detail and other-account isolation
- Location: e2e/neckrecording.spec.ts:101:1

# Error details

```
Error: page.evaluate: TypeError: Cannot convert undefined or null to object
    at Object.assign (<anonymous>)
    at eval (eval at evaluate (:311:30), <anonymous>:1:17)
    at UtilityScript.evaluate (<anonymous>:313:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
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
      - link "자세 기록" [ref=e9] [cursor=pointer]:
        - /url: /posture-records
      - link "수행 기록" [ref=e10] [cursor=pointer]:
        - /url: /records
      - link "내 계정" [ref=e11] [cursor=pointer]:
        - /url: /account
  - main [ref=e12]:
    - status [ref=e13]: 코칭 화면을 여는 중입니다
  - contentinfo [ref=e14]:
    - generic [ref=e15]: BODYGUARD
    - paragraph [ref=e16]: 일상을 위한 스트레칭과 자세 코칭 · 출시 준비 중
    - navigation "서비스 안내" [ref=e17]:
      - link "도움말" [ref=e18] [cursor=pointer]:
        - /url: /help
      - link "카메라·데이터 안내" [ref=e19] [cursor=pointer]:
        - /url: /data
```