# S6.2 — 현재 웹의 계정·기록 보안 경계 검증

현재 웹 보안 기초 main 병합 · PR #33 source87aa4a2f285d8c4fb760398d9e08fceae6d7f389 / merge d348fb8b04d2d43572a0281f0e0e3e632f2ef90e · codex/stage6-web-security · release-plan6·FR-U-02/04/05·FR-R-03·NFR-07/08

## 범위 / 선행 상태

S6.1 PR #32의 merge commit/main 포함·source 브랜치 보존을 확인한 최신 main에서 시작한다. 현재 공개·계정·기록 웹의 접근 제어를 실제 production Chrome·HTTP·격리 PostgreSQL에서 확인한다. 기존 승인된 보안 경계를 바꾸지 않고 test-only runner/config와 검증 case만 추가한다. 새 제품 기능·안전 기준·개인정보 정책·외부 침투 시험·공급자/계정·secret·운영 migration·배포는 범위 밖이다.

기존 API fixture는 소유권/CSRF를 TestClient로 확인하지만 실제 Chrome의 다른 origin 읽기 차단·독립 cookie jar의 본인 기록·동일 계정 다른 세션의 삭제 proof 거부를 한 실행에서 연결하지 않는다. 이번 하네스는 이 경계를 보완하며 전수 취약점 검사·운영 TLS·외부 보안 감사가 아니다. 브라우저 원본은 현재 화이트·블루 web-design-studio 결과를 유지하고 재설계하지 않는다.

## 수용 기준 / 하네스

1. WEB-S01: 독립 cookie jar의 두 합성 계정/각각의 client-reported 기록을 실제 API로 만든다. 타인 기록 상세는404이고 목록/상세/forged user_id 입력으로 소유권을 바꿀 수 없다. raw body·모의 동작/본인 ID·script 같은 잘못된 입력은 generic422이며 입력을 반사하지 않는다. 실제 웹은 타인 상세에서 일반 복구 안내를 보여주고 본인 목록은 보존한다.
2. WEB-S02: 같은 계정의 독립 로그인 세션에서 다른 세션 CSRF 및 삭제 확인 proof를 재사용하면403이고 기록을 보존한다. 실제 로그아웃 후 이전 cookie를 HTTP로 재전송해도 me401/쓰기403이다. 다른 정상 세션은 그대로 접근할 수 있고, 로그아웃한 웹은 로그인으로 돌아간다. cookie·CSRF·proof의 원문은 첨부/로그/저장소에 기록하지 않는다.
3. WEB-S03: 실제 Chrome의 same-site/different-origin loopback API fetch는 CORS로 읽기/사용자 지정 header POST를 거부한다. 실제 API는 잘못된/누락/null/유사 origin·Referer만·누락 CSRF의 변경 요청을403으로 거부하고 정상 세션을 보존한다. 직접 HTTP와 브라우저 CORS의 결과를 구분한다. HTTP 인증과 CORS는 같은 보호가 아니며 이는 SameSite cross-site/production secure-cookie/TLS 검증이 아니다.
4. 모든 확인 응답은 no-store/nosniff/no-referrer이며 실제 성공 mock·route.abort/fulfill·clock 제어 없이 실행한다. 기존 소유 loopback listener·dedicated test DB guard/lock·private 합성 mailbox·거부 proxy를 재사용하고 별도 context에도 동일 proxy를 적용한다. 다른 서버/DB를 재사용·종료하지 않는다.
5. 매 실행 고유 UTC 출력에 JSON/실제 서비스 화면 PNG·실패를 보존하고 camera/GLB·MediaPipe/외부 요청·페이지 오류·browser storage0을 확인한다. capture는 서비스 화면만이다. 원본 영상·신체 좌표·실제 사용자/공급자·토큰을 저장하지 않는다. 기존 의존성/lock/CI/.env·avatar/model source는 변경하지 않는다.
6. 실제 새3개 flow·기존 통합/DOM/API 회귀·정적/build·최신 exact HEAD/diff/CLEAN/체크·작성자 리뷰에서 scope 내P1/P2 없음 확인 후 PR 게이트를 진행한다. 최초 suite 미등록 exit2를 browser 실행/통과로 세지 않는다. 발견한 실제 결함은 기록 후 범위/승인 경계를 지켜 보완한다.
7. Stage2 이월·실측/아바타/코칭/기록 producer·확정 부가 기능·실제 공급자/운영·Docker/Draft #29·백업 security replay/retention·라이선스/법무·참여자/성능·전체1~6단계 기준은 모두 유지한다. 새 avatar 사이클은 시작하지 않는다.

## 실행 순서 / 검증 구분

명세와 새 security.spec.ts → 기존 runner의 미등록 실패 보존 → 최소 suite 등록/고유 report 연결 → 실제 HTTP/SQL/Chrome → scope 리뷰/필요 보완 → 회귀와 PR 게이트. testing-strategy/code-review를 적용한다. 기존 BMAD resolver/config 부재는 유지하며 전체 BMAD workflow 실행을 주장하지 않는다. 디자인 스킬의 backend 확장 금지를 지켜 제품 UI/API는 바꾸지 않는다.

## Tasks / Dev Agent Record

- [x] 최신 main/PR #32 source 보존 확인·명세/3개 하네스 먼저 작성.
- [x] 최초 미등록 실패/환경·타입/두 browser 실패를 보존하고 기존 runner/config에 최소 security 등록·고유 report를 연결했다.
- [x] 실제 Chrome/HTTP/SQL의 두 계정/다른 세션 CSRF·삭제 proof/로그아웃 cookie 재전송/CORS·origin 경계와 현재 화이트·블루 화면을 확인했다. 성공 mock/실제 공급자·운동으로 대체하지 않았다.
- [x] scope 작성자 리뷰P2의 invalid 입력 독립 검사를 보완하고 최종3흐름·기존2흐름·DOM327/실제 API/SQL291·정적/production DEV 차단/원본·사본 수집 보존·diff 검사를 통과했다. scope 미해결P1/P2 없음.
- [x] PR #33 exact tested source87aa4a2·필수 검증·scope P1/P2 없음·최신 diff/main/CLEAN/MERGEABLE·체크 없음·reviews0 확인 후 merge d348fb8로 병합했다. 실제 부모/main source 포함·로컬/원격 브랜치 보존·working tree clean을 확인했다.

전체6단계/출시 후보판·운영/전문가 통과가 아니다.

### File List / Change Log

- backend/tests/run_browser.py, frontend/playwright.account.config.ts — test-only security suite/고유 output 등록.
- frontend/e2e/security.spec.ts — actual 두 cookie jar·소유권/독립 입력·세션 CSRF/proof·logout 재전송·native CORS/출처·화면/저장/egress 경계.
- docs/review/stage6-web-security/* — 실패/실제 화면·원본 hash/경로만 치환 사본·회귀/XML·수집/리뷰.
- docs/stories/stage6-web-security.md, stage6-web-integration.md, docs/tasks.md — 현재 결과·직전 실제 PR32 병합·다음 독립 상태.

2026-10-05: [실행/작성자 리뷰/한계](../review/stage6-web-security/README.md). actual Vite production build·API test 설정/loopback·Chrome·SQL이며 운영 TLS/SameSite cross-site/공급자·실제 운동/카메라·독립 감사가 아니다. 원본은 보존하고 전체1~6단계 게이트는 그대로다.
