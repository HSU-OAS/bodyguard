# S6.1 — 현재 웹의 교차 화면 통합 검증

현재 웹 교차 흐름 기초 구현·실제 검증 / PR 게이트 진행 · main26d5e09541b92b33368ed2638eb307565909178a · codex/stage6-web-integration · release-plan6·FR-U-02/04/05·FR-R-03·FR-V-03·NFR-08

## 범위와 선행 상태

S5.4 PR #31의 exact tested source/main merge와 브랜치 보존을 확인하고 최신 main에서 시작한다. 실제 설치 라이선스 증거 기초는 구현됐지만 고지/법무·최종 artifact가 완료된 것은 아니다. Draft #29의 실제 Docker/NGINX/TLS·main 정합화, 운영 backup 안전/Q-17/26·실제 공급자는 미완료다. 외부 연결을 기다리며 독립6단계 웹 통합을 진행한다.

현재 production 공개/가입·로그인/탐색·기록/계정 관리 화면을 단일 사용자 여정에서 연결해 검증한다. 기존 run_browser의 실제 HTTP/FastAPI/격리 PostgreSQL·production Chrome과 비공개 합성 mailbox/egress 차단을 재사용한다. 별도 계정·시크릿·비용·운영 migration·배포·공개 주소는 사용하지 않는다. 기존 원본과 결과는 덮거나 지우지 않는다.

기록 producer와 실제 코칭은 아직 미연결이며 출시 동작0이다. 직접 선택/추천 준비 화면을 성공한 신체 분석으로 표시하지 않고, 기록 화면 검증용 client-reported fixture를 실제 운동으로 세지 않는다. 이 Story는 이미 구현된 화면의 교차 흐름 기초다. 전체6단계·실제 노트북/조명/체형/참여자·실용성·최종 아바타/코칭 통과가 아니다.

## 수용 기준과 먼저 작성할 하네스

1. WEB-I01: production 공개 소개→도움말/데이터→실제 이메일 가입·코드 확인→내 시작→탐색의 직접 선택/추천 준비 상태→기록 빈 상태→명시 합성 요약의 실제 API 저장·목록/상세→삭제 미리보기·취소 보존→명시 삭제/실제 목록 갱신→내 계정·로그아웃→보호 경로 재확인으로 이어진다. /me나 records를 성공 mock으로 대체하지 않는다. 메일 IPC·fixture 요약은 실제 공급자/운동과 구분한다.
2. WEB-I02: 계정 확인 실패를 명시 route.abort로 주입하면 개인 화면은 닫힌 채 공개 도움말/데이터·새로고침은 이용 가능하다. production /dev/measure·/dev/select는404이고 측정/미검증 후보/가짜 코칭 성공·카메라/모델 요청이 없다. 주입 장애를 실제 운영 장애 시험으로 세지 않는다.
3. 자체 loopback API/preview와 Chrome만 실행하고 다른 서버는 재사용/종료하지 않는다. 기존 DB/role/host/version·동시 reset lock을 통과한 test DB만 사용한다. mailbox는 private·합성이고 인증값/외부 연락/원시 몸 자료를 제품·레포/log에 추가하지 않는다. 실제 브라우저 egress는 기존 refusing proxy로 차단한다.
4. 매 integration 실행의 고유 UTC 출력 경로에 JSON/PNG·실패 원본을 보존한다. 화면은 화이트·블루 기존 web-design-studio 결과를 유지하며 keyboard/제목 focus·좁은 데스크톱 창·overflow·웹의 빈/실패/성공 상태를 실제 확인한다. screenshot은 서비스 화면만, 카메라는 호출하지 않는다. iframe/canvas/body 영상 capture·새 디자인/외부 SDK/폰트/모델 다운로드는 없다.
5. runner/config의 suite 등록·출력 보존과 실제 새2흐름을 연결하고 관련 정적/DOM/API 회귀·production DEV 차단·최신 diff/HEAD/CLEAN/체크·작성자 리뷰/P1/P2 보완 후 PR 게이트를 통과한다. 최초 suite 미등록 실패는 실제 browser 케이스 실행 실패나 통과로 세지 않는다.
6. stage2 carryover의 appearance/측정/통합 문제·실제 코칭/기록 producer·확정 부가 기능, actual 공급자/운영 HTTPS·라이선스/법무·참여자/성능/보안/전체6단계 게이트를 유지한다. 동일 부위 아바타 수정/검증은 시작하지 않는다. 중요한 안전/개인정보·계정/비용/secret·운영/배포/출시는 별도 승인이다.

## 실행 순서

먼저 이 명세와 실제 integration.spec.ts를 작성한 뒤 기존 runner에 suite가 미등록임을 실행으로 확인한다. 이어 최소 suite 등록·고유 결과 보존을 연결하고 실제 production browser/SQL을 실행한다. 기존 function에 test-only 기능을 넣고 production auth bypass나 새로운 제품 기능을 만들지 않는다. 발견 문제는 scope별로 수정/재실행하며 원본은 유지한다.

testing-strategy의 실제/모의 경계와 documentation/code-review를 사용한다. BMAD resolver/config 부재로 전체 BMAD 워크플로 실행을 주장하지 않는다. UI를 재설계하지 않아 디자인 스킬의 backend 확장 금지 경계를 유지한다. CEO의 최신 우선순위와 사전 승인 안에서 다음 독립 작업을 계속하며 재승인 대기하지 않는다.

## Tasks / Dev Agent Record

- [x] 먼저 integration.spec.ts 두 case를 작성하고 미등록 suite의 실제 argparse exit2를 보존했다. 이때 DB/HTTP/Chrome case는 미실행이다.
- [x] 기존 runner/config에 integration만 등록하고 고유 UTC output/report를 연결했다. 다른 suite·production auth/API/UI·dependency/lock·CI·.env는 변경하지 않았다.
- [x] 실제 production Chrome/API/SQL에서 공개→이메일 가입→탐색 준비→합성 기록 상세→삭제 취소/확정→계정·로그아웃·me401의 교차 흐름을 확인했다. route success mock·실제 메일/운동으로 대체하지 않았다.
- [x] me 실패 주입 시 개인 화면 차단·공개 안내/직접 주소/새로고침 보존과 production 두 DEV 경로404를 확인했다. 카메라/GLB·MediaPipe·외부 요청/브라우저 저장/페이지 오류0·700px overflow0·keyboard logout/제목 focus를 확인했다.
- [x] 최초/중간 dependency 환경 실패를 보존하고 최종 formatted source의 실제 두 case를 재실행했다. timestamp별 JSON/PNG·최종 stdout·DOM327/실제 SQL/API291·타입/Biome/Ruff/format/mypy·DEV bundle 차단/checksum/diff 검사를 확인했다.
- [x] 작성자 code-review: test-only 최소 suite·고유 출력·mock/actual 경계/기존 서버 보존·private 메일 IPC·CSRF/실제 세션·미완성 판정 비공개를 점검했다. scope 내 미해결P1/P2 없음이며 독립 외부/전문가 리뷰는 아니다.
- [ ] exact source/main·최신 diff/CLEAN/체크/리뷰·PR·merge commit과 source 브랜치 보존 확인.

최종2개 browser case는9.8초·failure/skip/flaky0이며 source formatter 적용 전11.7초 결과도 별도 보존했다. backend291개는83.67초·failure/error/skip0·기존 asyncio warning1, DOM327개도 실패/skip0이다. [실제 화면·실패/한계](../review/stage6-web-integration/README.md)를 따른다. actual 운영 TLS·공급자/메일 도착·사람·체형/조명/성능·최종 아바타·정확한 코칭·기록 producer·부가 기능·법무/라이선스·전체6단계 완료가 아니다.

### File List

- backend/tests/run_browser.py, frontend/playwright.account.config.ts — test-only suite 등록·고유 report 출력.
- frontend/e2e/integration.spec.ts — 현재 웹 두 교차 흐름·실제/합성/주입 구분·카메라/외부/저장 경계.
- docs/review/stage6-web-integration/* — 최초 등록 실패·dependency 환경 실패·시간별 실제 PNG/JSON·회귀/checksum/작성자 리뷰.
- docs/stories/stage6-web-integration.md, docs/stories/stage5-license-inventory.md, docs/tasks.md — 현재/직전 Story 실제 상태.

### Change Log

2026-10-05: suite 미등록/설치 연결 실패 보존, 현재 웹의 실제 교차 흐름 기초 검증. Stage6 전체/출시 후보판 완료로 표시하지 않는다.
