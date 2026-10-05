# S4.9 — 인증 세션의 기록 소유 컨텍스트 확보

completed (private Story 범위만) · 기준 main54227451e761f909dd950f821de3d54329e4b2f5 · codex/coaching-record-capture · 2026-10-06

## 범위/선행

FR-U-04/FR-R-03/NFR-08. PR38의 실제 merge 부모/main 포함/source 브랜치 보존/clean을 확인했다. S4.8 결과 serializer/HTTP writer에 **코칭 시작 전 실제 인증 컨텍스트**를 확보하는 private adapter를 추가한다. 최초 ready UTC clock pair/session→result 연결은 다음 응집된 Story다. 공개 코칭/실제 classifier·아바타/실측/자동 기록은 연결하지 않는다.

## CTO 계약

- captureRecordOwner({authority,readAuthority,signal}): AuthProvider의 ready 상태 객체가 명시 lease 경계다. userId는 계정 확인 비교에만 쓰며 userId만 lease로 쓰지 않는다. guest/checking/null/잘못된 authority·abort는 요청0/fixed capture 오류. 현재 인증 state 전이/UI/공개 진입은 바꾸지 않는다.
- 실제 existing /me→/auth/csrf→/me same-origin/no-store 읽기로 caller의 최초 ready account ID와 **각 /me 계정**의 일치를 확인한다. 현재 계정을 caller의 과거 계정 권위로 승격하지 않는다. 각 await 전후 동일 authority 객체/ID·signal이어야 한다.
- owner identity 교체/uid mutation/provider getter/late 응답/guest401/다른 계정/모순/잘못된64hex proof/abort는 fixed capture failure. 같은 사용자 재로그인/refresh 권위 교체도 기존 lease 재사용 불가다. 실제 auth caller wiring은 후속 통합 의존성으로 둔다.
- cookie를 읽거나 새 proof/session API·서버/schema/시크릿을 바꾸지 않는다. 기존 CSRF를 캡처해 private 메모리에서만 보관한다. 저장 시 새 CSRF를 받지 않는다. 쿠키 변경 시 S4.8의 captured-proof 서버403 경계를 유지한다.
- 반환 컨텍스트는 하나의 기존 createRecordWriter만 만든다. close/owner sync/외부 signal abort는 bound writer를 닫고 proof를 비운다. 늦은 capture·저장 응답/다른 authority의 재사용은 불가, 명시 retry는 기존 ID/내용/proof만 재사용한다. proof/계정 ID/좌표를 return DTO·URL/storage/log에 넣지 않는다.
- private context 확보이지 공개 자동 저장/운영 변경 승인이 아니다. 영상/좌표/SDK 호출0·개인정보 정책 변경0. 실제 earliest-ready UTC capture 없으면 공개 기록 producer0을 유지한다.

## 하네스/수용 기준

| ID | 실행 검증 |
|---|---|
| O01 | guest/checking/null·abort·잘못된 authority GET/POST0, createWriter POST0 |
| O02 | ready ID와 actual /me 일치→CSRF→다시 /me 확인, 동일 권위에서만 writer 확보 |
| O03 | 각 await 중 authority 교체/uid mutation/provider getter·late 응답·abort·계정 모순 fixed failure/POST0 |
| O04 | close·abort·owner sync가 writer pending/late/retry 폐기, proof/uid/좌표 return payload·영구 queue/log0 |
| O05 | 상세/전체 회귀·타입/정적/build/prod private0·실제 Chrome/API/SQL 계정 capture/소유·기존 공개 회귀. 모의·실제·미실행 구분 |
| O06 | 실패/원본·Story/증거·범위 리뷰·latest diff/CLEAN/체크/exact HEAD 조건부 PR. 중요 정책/운영 변경0 |

## 작업

- [x] 최신 main/PR38 실제 결과·기록/API/인증 lifecycle·독립 범위 확인.
- [x] 최초 red·상세 결정적 하네스/원본 보존.
- [x] owner capture/context·writer 폐기 구현·리뷰 보완.
- [x] 실제 Chrome/API/SQL·회귀/정적/production 증거·로컬 리뷰. 원격 diff/HEAD/CLEAN/체크는 조건부 PR 실행 직전 확인한다.

## Dev Agent Record

BMAD resolver/config/custom/project-context/sprint-status가 없어서 이미 전체 읽은 skill 기본값·전용 Story·운영 규칙을 적용한다. 직전 Story의 on_complete resolver도 실제 absent exit2였고 기본 후속 명령은 빈 값이다. 새 main의 AGENTS가 읽은 원문과 동일 byte임을 cmp로 확인했다. Story 상세 patch의 tasks 제목 추정 오류는 apply_patch atomic 검증 실패/해당 호출 변경0이었다. 실제 제목을 읽어 정정한다. 기존 source/실패/증거는 보존했다.

현재 아직 미구현이다. first missing module red는 실제 기능 시험 완료로 세지 않는다. Draft36 SDK 개인정보 P2 승인 응답·아바타/실측·참여자/외부/운영/Q32·전체1~6단계 미완료를 유지한다. 화이트/블루 웹 디자인 유지·같은 아바타 부위 새 제작0.

### 실제 구현·검증

위 문단은 착수 시점이다. first red 및 상세13건을 먼저 작성해 missing module collection red를 보존한 뒤 captureRecordOwner를 구현했다. AuthProvider에서 ready 타입만 export하고 runtime/state/UI/공개 네트워크 변경0. 초기13건 green, nullable current의 type2오류를 명시 null 경계로 정정했다. 추가 getter 시험의 반환 타입 void가 type1오류를 내 첫 browser는 서버 시작 실패/실제 case0이다. 반환 타입을 명시해 최종16/전체475건·타입/Biome 통과. raw 오류/body/proof를 노출하는 assertion으로 기준을 낮추지 않았다.

실제 Chrome/API/SQL4건(21.6초) 통과: me/csrf/me 대조→본인 기록201/조회, 캡처 중 계정 변경에서 양 계정 저장0, 변경 통지를 놓친 old proof403/새 계정 기록0, 실제 CSRF 응답을 대기시키고 abort 시 늦은 캡처 실패/POST0. authority/요약/메일은 합성이고 실제 API·SQL·Chrome만 실제다. AuthProvider hook wiring·최초 ready UTC/실제 session/result·코칭/참여자 정확도는 아직 없다.

기존 실제 API/SQL 전체291건(332.18초)·Ruff/format 통과, backend cwd의 실제 mypy app 설정으로 통과. frontend cwd의 mypy Settings3오류는 잘못된 실행 위치로 별도 보존했으며 코드 수정으로 해결한 것처럼 쓰지 않는다. 기존 asyncio deprecated 경고1 그대로다.

공개 회귀 첫7pass/RAF1fail(evaluate 중 navigation)은 stdout·전체 원본·error context를 보존했다. engineering:debug로 기존 RAF 하네스의 ready 화면 대기 누락 경계를 확인하고 heading readiness만 추가했다. CPU 부하 원인 확정0·timeout/skip/제품 인증 변경0. 최종 공개7+합성 RAF1/8건(50.1초) 통과. guard에 실제 누출 파일을 넣어 exit1, 그 생성 파일만 제거해 exit0. 공개 JS deae9447/CSS c0123052 SHA는 기존과 동일하며 capture/producer0. 샌드박스 ps 거부는 실제 부하 점검 완료로 세지 않는다.

engineering:code-review의 보안/경합/성능/정확성 재검토: 첫 ready ID/객체를 캡처·각 await 재확인, HTTP200만 수락, owner 변경/uid mutation/getter/외부 abort·one writer·close listener 제거/late 폐기·CSRF 서버 backstop을 확인했다. 원시 오류나 단순 userId를 lease로 쓰지 않으며 3GET은 시작 전 한 번만 수행하는 private 경계다. 범위 내 미해결 P1/P2 없음.

source10개/실행 증거25개 raw·공개 SHA를 보존/수집하고 불변 재실행으로 확인한다. README의 실제/모의/미실행과 source/실패를 보존하며 운영 변경0·단계 완료0. 다음 응집된 Story는 최초 ready clock pair와 session/result/인증 caller 연결이다. 남은 SDK P2/이월/실측·Q32/참여자/외부/운영/전체1~6 게이트를 낮추지 않는다.

O01의 비-ready6개 상태(checking/guest/offline/logging-out/logout-error/withdrawing)는 실제 private bundle을 Node에서 각 상태로 호출·assert해 전부 capture 실패·context0/GET/POST0을 추가 확인했다. 합성 authority runtime 경계이지 실제 계정 상태6건/브라우저6건으로 합산하지 않는다. parent manifest25개를 보존하고 별도 boundary-runtime.json/artifacts-extra.json SHA로 수집했다(전체 증거26).

### 실제 원격 결과

PR39 https://github.com/HSU-OAS/bodyguard/pull/39 는 scoped 검증/리뷰·최신 diff·MERGEABLE/CLEAN·exact d0f2dfc7a7ae702d293d29785c4bc9a876e07906·체크 없음 후 2026-10-05T15:53:13Z merge faa5061daf281ca2061d0efcb750df91633f080b로 병합됐다. 실제 부모5422745/d0f2df·main 포함·원격 소스 브랜치 보존·clean을 읽기 전용으로 확인했다. 외부 리뷰0이며 작성자 범위 리뷰다. owner capture private Story 완료이지 AuthProvider caller/UTC/코칭/단계4·1~6 완료가 아니다. 검증 원본/manifest는 변경하지 않는다. 다음 main의 S4.10에서 최초 ready clock pair/result 연결을 진행한다.

## File List

- bodyguard/frontend/src/auth.tsx (ready 타입 export만)
- bodyguard/frontend/src/coaching/recordOwner.ts
- bodyguard/frontend/src/coaching/recordOwner.test.ts
- bodyguard/frontend/e2e/ownercapture.spec.ts
- bodyguard/frontend/e2e/fixtures/recordOwnerProbe.ts
- bodyguard/frontend/e2e/fixtures/recordOwner.vite.ts
- bodyguard/frontend/e2e/selection.spec.ts (인증 화면 readiness 하네스)
- bodyguard/frontend/playwright.account.config.ts
- bodyguard/frontend/scripts/check-selection-production.mjs
- bodyguard/backend/tests/run_browser.py
- bodyguard/docs/stories/coaching-record-capture.md
- bodyguard/docs/stories/coaching-result-record.md (PR38 실제 post-merge만)
- bodyguard/docs/tasks.md
- bodyguard/docs/review/coaching-record-capture/README.md
- bodyguard/docs/review/coaching-record-capture/collect-proof.mjs
- bodyguard/docs/review/coaching-record-capture/{boundary-runtime.json,artifacts-extra.json}
- bodyguard/docs/review/coaching-record-capture/{artifacts.json,first-red.xml,contract-red.xml,initial-unit.xml,initial-types.stdout,review-types.stdout,accepted-frontend.xml,final-types.stdout,final-check.stdout,accepted-check.stdout,accepted-types.stdout,initial-browser.stdout,final-browser.stdout,final-public-browser.stdout,accepted-public-browser.stdout,final-backend.xml,final-ruff.stdout,final-backend-format.stdout,final-mypy-accepted.stdout,production-negative.stdout,production-positive.stdout,initial-browser-report.json,final-browser-report.json,failed-raf-context.md,owner-record-list.png,production-start.png}

## Change Log

2026-10-06: 최신 main5422745에서 S4.9 시작. earliest-ready UTC/session 연결은 다음 Story로 분리.

2026-10-06: 실제 인증 계정 대조/captured-proof context·16하네스/실제 Chrome4·기존 회귀, nullable/accessor 타입·RAF readiness 하네스 보완과 실패 원본 수집. 공개 runtime/auth 변경0.
