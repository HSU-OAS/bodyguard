# S4.N4 — 계정 설정·페이지 수명과 알림 전달 연결

ready-for-review · 기준 main ddc35cf247b4d04cffb8dd435b1a3c99a0378fac · codex/owned-alert-lifecycle · 2026-10-08

## 범위와 계약

FR-N-03/04/05·FR-U-04·FR-S-04·NFR-08. 기존 알림 전달 부품에 실제 AuthProvider의 committed ready 객체, 본인 설정 조회, 페이지 수명을 연결하는 비공개 hook이다. 화면·메뉴·인증 정책·API·판정·SDK·아바타는 변경하지 않는다.

- 명시 prepare(port, onChoose)만 기존 /me→CSRF→설정→/me 조회를 수행한다. 초기 mount·로그인 완료만으로 조회/권한 요청/알림 생성/촬영/소리/POST하지 않는다.
- ready 객체 identity와 단일 operation을 함께 소유한다. 같은 ID의 새 ready도 다른 수명이다. 실패한 조회는 기본 enabled 설정으로 대체하지 않는다.
- 저장된 posture_enabled/sitting_enabled만 전달 허용에 연결한다. 시간·sound 값으로 스케줄러/앉음 추론/소리를 만들지 않는다. 이벤트 producer는 caller 책임이며 합성 시험은 실제 코칭 검증이 아니다.
- 재준비·cancel·committed auth 변경·unmount·hidden/pagehide는 이전 조회와 알림을 폐기한다. 늦은 설정/권한/클릭 응답은 현재 수명을 부활시키지 않는다. 새 수명은 명시 재준비해야 한다.
- 설정은 해당 준비의 조회 snapshot이다. 설정 화면 이동은 기존 수명을 끝낸다. 같은 탭/다른 탭 설정 변경을 자동 동기화했다고 주장하지 않으며 공개 연결 전 이 의존성을 해결한다.
- 고정 상태와 전달 controller만 반환한다. 계정/CSRF/설정/원시 오류를 DOM·storage·URL·로그에 노출하지 않는다. 공개 bundle에 hook/producer/probe가 들어가지 않는다.

## 수용 기준·하네스

| ID | 실제 확인할 경계 |
|---|---|
| O01 | mount/guest/checking/hidden에서 준비/권한/생성/POST0; 명시 ready 준비만 본인 설정 bookend 조회 |
| O02 | 실제 저장된 enabled 두 필드로 전달 제한; 실패/계정 불일치/잘못된 설정은 delivery0 |
| O03 | 같은 사용자 refresh/다른 사용자/로그아웃 오류/StrictMode/unmount/재준비/cancel/held 설정 응답의 이전 수명 폐기 |
| O04 | hidden/pagehide·listener 해제·늦은 권한/OS callback 무효; visible/pageshow로 자동 재시작0 |
| O05 | 실제 production Chrome+기존 HTTP/API/격리 SQL에서 저장 설정→명시 준비→합성 안내 선택/닫기→로그아웃·재준비 확인 |
| O06 | 전체 DOM·타입·정적·build/공개 guard; 실패 원본 보존; 보안/성능/정확성/유지보수 리뷰·조건부 PR 게이트 |

unit은 happy-dom·모의 fetch/NotificationPort, browser는 실제 Chrome/AuthProvider/본인 API·SQL과 거부된 native 권한을 사용한다. browser의 안내 입력은 합성이며 실제 OS granted 표시·촬영·판정·운동 성공 검증이 아니다. 현재 공개 웹 JS/CSS는 변경하지 않는다.

## 작업

- [x] 최신 main·기존 수명/설정/전달 계약 확인, 독립 Story와 하네스 계약 작성.
- [x] RED 하네스·실패 보존.
- [x] private hook 구현·경합/수명 보완.
- [x] 실제 Chrome/API/SQL 및 회귀·공개 guard.
- [ ] 증거·작성자 리뷰·최신 diff/충돌/체크와 exact HEAD 조건부 merge.

## Dev Agent Record

engineering:testing-strategy로 단위 경합과 실제 계정/설정 흐름을 분리한다. graphify 기존 graph의 alert/login/state는 이전 ADR 중심이며 현재 연결을 포함하지 않아 최신 main 파일과 직접 대조했다. 새 그래프 재생성/도구 설치는 하지 않았다. 동일 아바타 부위 재제작·미승인 디자인 확장·운영 변경0, 기존 이월/외부 승인/실측·참여자·Q07/08/21/32·전체1~6 완료 기준을 유지한다.

명세/하네스를 먼저 작성했으나 최초 실행2건은 의존성 캐시/DNS 실패·중단으로 실제 시험0이다. 실행을 확보한 뒤16 단위 통과, 재진입18개 중2실패와 종료 handoff21개 중1실패를 실제 재현·보완했다. 최종 전체765(이번21)·Chrome/AuthProvider/HTTP/API/격리 SQL3·정적/build/guard 통과다. 기존 공개/개발 선택8은 마지막 private handoff 변경 직전 동일 공개 출력에서 실행했다.

실제 저장 설정→명시 준비→enabled 종류 안내→선택/닫기→재확인·새 설정 재준비→로그아웃204/guest/API401을 확인했다. 안내/메일은 합성, OS 권한은 native Chrome에서 거부로 주입했다. 권한 허용/OS 표시/실측/동작/공개 코칭은 시험하지 않았다. 실패0통과/3실패·1통과/2실패·후속3통과·최종3통과와 타입 오류의 원본·현재 소스16 SHA·로그40 SHA는 [실행·리뷰 기록](../review/owned-alert-lifecycle/README.md)에 구분했다.

engineering:code-review로 현재 권위·현재 operation·재진입·늦은 응답·페이지 종료 listener를 작성자가 확인했다. 범위 내 미해결P1/P2 없음이며 독립 에이전트/전문가 검토는 아니다. 공개 JS/CSS는 PR62의 실제 출력과 byte 동일하고 공개 App/화면·인증/판정/SDK·아바타·API/기존 migration·패키지/lock·CI·운영 변경0이다. native PostgreSQL을 실제 중지했으며 생성된 시험 DB/검증 원본은 보존한다. 최신 PR diff/HEAD/CLEAN·체크·충돌 게이트와 실제 merge 확인이 아직 남았다.

## File List

- bodyguard/docs/stories/owned-alert-lifecycle.md
- bodyguard/docs/tasks.md
- bodyguard/docs/review/owned-alert-lifecycle/README.md
- bodyguard/docs/review/owned-alert-lifecycle/summary.json
- bodyguard/docs/review/owned-alert-lifecycle/private-preview.png
- bodyguard/frontend/src/alerts/useOwnedAlertDelivery.ts
- bodyguard/frontend/src/alerts/useOwnedAlertDelivery.test.tsx
- bodyguard/frontend/e2e/fixtures/ownedAlertProbe.ts
- bodyguard/frontend/e2e/fixtures/ownedAlert.vite.ts
- bodyguard/frontend/e2e/ownedalert.spec.ts
- bodyguard/frontend/playwright.account.config.ts
- bodyguard/frontend/scripts/check-selection-production.mjs
- bodyguard/backend/tests/run_browser.py

## Change Log

2026-10-08: 최신 main에서 계정·설정·알림 전달 수명 연결 착수. 공개 producer/자동 판정·스케줄러는 제외.
2026-10-08: 실제 재진입/이탈 실패 보완·설정/로그아웃 흐름 및 최종 검증 후 조건부 PR 게이트 진행.
