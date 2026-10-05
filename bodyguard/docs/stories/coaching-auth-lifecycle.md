# S4.11 — 실제 로그인 권위·페이지 수명과 코칭 연결

completed (private Story 범위만) · 기준 main43b13f37efa5ed58a8d5898af213fb66ea374a0e · codex/coaching-auth-lifecycle · 2026-10-06

## 범위/선행

FR-U-04·FR-S-04·FR-R-03/NFR-07/08. PR40 실제 merge43b13f3 부모faa5061/553b5b2·main 포함·원격 소스 브랜치 보존·clean을 확인했다. S4.9/S4.10의 caller 의존성을 실제 AuthProvider ready 객체 및 명시 소유한 페이지 수명에 연결하는 private React hook이다. UI/route·실제 SDK/privacy 정책·classifier·두 아바타·공개 코칭/자동 저장은 변경하지 않는다.

## CTO 계약

- useRecordedCoaching은 기존 AuthProvider의 **committed ready 객체 identity**를 권위로 사용한다. 사용자 ID/이메일만으로 세션을 이어 붙이거나 과거 ready를 새 권위로 승격하지 않는다. 인증 state/API/UI는 변경하지 않는다.
- 명시 prepare(options)가 현재 ready일 때만 S4.9 me/csrf/me를 캡처하고 S4.10 constructor를 만든다. prepare 자체는 start/카메라·추론/아바타 factory/POST를 호출하지 않는다. plan/UUID/clock pair/gates/observer/ports는 caller가 명시하며 임의 의학 기준·UTC/ID 기본값은 없다.
- 새 prepare/committed auth 변경·checking/로그아웃 실패·guest/refresh/같은 계정 새 ready/unmount는 pending capture를 abort하고 만들어진 context/session을 dispose한다. 늦은 준비·저장 응답은 과거 권위/현재 UI를 되살리지 않는다. async cleanup과 저장/권한 대기를 직렬화하지 않는다.
- 페이지 hidden/pagehide는 해당 소유 context/session을 폐기하고 listeners를 즉시 해제한다. 다시 visible/bfcache/focus만으로 자동 재시작하지 않는다. 아직 열린 getUserMedia 권한 팝업을 브라우저 API로 강제로 취소했다고 주장하지 않는다.
- React StrictMode mount/cleanup·capture 중 authority 변경·두 prepare 경합·실패를 반복 검증한다. callbacks/고정 hook 상태만 제공하며 proof/원시 오류/영상/좌표를 React 상태·URL/storage/log로 옮기지 않는다.
- 기존8필드 요약·explicit save/retry·captured proof 서버403를 유지한다. dispose는 이미 수락된 서버 기록의 rollback이 아니다. public bundle에 미완성 hook/adapter/fixture0을 유지한다.
- 화이트·블루 웹과 지정 web-design-studio 계약을 유지한다. 새 UI 디자인은 이번 범위가 아니며 도구를 읽은 것과 디자인/외부 audit 완료를 혼동하지 않는다. 기존 모든 미완료 단계·이월·SDK P2/Q32/참여자/외부/운영 게이트를 보존한다.

## 하네스/수용 기준

| ID | 실행 검증 |
|---|---|
| H01 | hook 생성/guest/checking/명시 준비 전 capture/자원/POST0(기존 AuthProvider 자체 /me는 별도) |
| H02 | 실제 provider ready 객체에서만 owner capture→inert recorded session, caller start/결과/save 본인 기록 연결 |
| H03 | committed authority 교체/동일 ID 새 ready/로그아웃 오류·unmount/StrictMode/중복 prepare와 held capture의 late 폐기 |
| H04 | hidden/pagehide·listener 해제/재시작0, 소유 cleanup은 네트워크/권한 대기를 직렬화하지 않음 |
| H05 | 실제 private Chrome+기존 AuthProvider/API/SQL·전체 회귀·타입/정적/build/production guard·원본 실패/범위 리뷰·조건부 PR |

## 작업

- [x] 최신 main/PR40 실제 결과·기존 AuthProvider/lifecycle와 caller 의존성을 확인하고 계약 확정.
- [x] 먼저 실제 red/상세 하네스를 작성하고 실패 원본 보존.
- [x] private hook/인증·페이지 수명 연결 및 리뷰 보완.
- [x] 실제 Chrome/API/SQL·전체 회귀·production·증거·scope 작성자 리뷰.
- [x] 최신 main·실제 PR diff/HEAD/CLEAN·체크/충돌 재확인 후 조건부 merge.

## Dev Agent Record

BMAD dev-story default workflow를 적용한다. 새 AGENTS 원문은 전체 읽은 직전 파일과 같은 byte이며 repo 안에 추가 AGENTS/sprint-status/project-context/resolver가 없음을 확인했다. 직전 on_complete resolver는 실제 absent exit2, 기본 후속 명령은 빈 값이다. 기존 상태/검증 원본·브랜치는 보존한다. node_modules는 소유한 직전 작업트리에서 복사하고 offline/frozen-lockfile로 연결한다.

실제 AuthProvider ready 객체를 committed layout effect로 사용하는 private hook을 구현했다. prepare는 기존 me/csrf/me와 inert session만 만들며 첫 await 이전에 페이지 취소 listener를 소유한다. auth 교체·logout-error·새 prepare·unmount·hidden/pagehide는 abort/dispose·late observer/status 폐기를 수행한다. 중복 cancel은 소유 cleanup Promise를 함께 기다리되 권한/저장 요청을 cleanup 앞에 직렬화하지 않는다.

원본 실패/초기 검증/모의·실제 구분은 [검증 기록](../review/coaching-auth-lifecycle/README.md)에 남겼다. 최초 collection 실패/기능0, 경합17개 중2red·held pagehide19개 중1red, 타입/정적 실패, 첫 Chrome4실패(process 환경/기능0), DB 점유31pass/260setup-error와 후속 browser setup 실패/Chrome0을 보존한다. 추가 별도 실행3fail/1interrupt·full-unit red/기존 DB restart 실패 로그는 주체/원인 단정 없이 보존한다.

최종 전체 frontend523/실패0(이번20개), API/SQL291/실패0(300.70초, 경고1), Chrome4/실패0(29.6초), 공개7+합성 RAF1/실패0(48.5초), 타입/Biome120/Ruff/format/mypy/build·guard 음성exit1/양성exit0을 실제 실행했다. 최종 전 기존 모의 화면 heading2건 대기 실패는 같은 소스/timeout/assertion 변경 없이 전체 재실행 통과했으며 원인 확정/출시 안정성 보증으로 간주하지 않는다. source8/artifact46 SHA를 수집하고 재검증했다. 수집기 재호출 중 wrong cwd module-not-found는 실행0인 보조 명령 실패였고 올바른 절대 경로 재호출로 byte-identical 보존을 확인했다.

engineering:code-review로 상태 경합·자원/소유권·고정 오류·네트워크와 종료 분리·public bundle 누출을 작성자 검토했다. 새 hook과 모의 producer/fixture는 production0, JS/CSS byte SHA는 PR40과 동일하다. SDK 승인/실측·참여자·classifier·두 아바타·Q32/법무/외부/운영/전체1~6 완료가 아니다. 지정 web-design-studio의 기존 토큰/실제 화면 확인을 유지했지만 UI/추가 audit를 새로 완료했다고 주장하지 않는다.

실제 원격 결과: [PR41](https://github.com/HSU-OAS/bodyguard/pull/41)은 source4265aae3bdaa13980ce6936a9e2f6e4d1f63b5f2·변경60개 remote blob/diff 일치·작성자 scope 리뷰·latest main43b13f3/CLEAN·MERGEABLE/CLEAN·체크 없음/외부 리뷰0 확인 후 2026-10-05T17:33:41Z mergef47dea17a7ec92ff62404c5624bc4c18cd0782a2로 병합됐다. 두 부모43b13f3/4265aae·main 포함·브랜치 보존·clean을 실제 확인했다. 기존 source/실패/증거는 변경하지 않으며 전체 단계 완료가 아니다.

## File List

- bodyguard/docs/stories/coaching-auth-lifecycle.md
- bodyguard/docs/stories/coaching-recorded-session.md (실제 PR40 post-merge 상태)
- bodyguard/docs/tasks.md
- bodyguard/frontend/src/coaching/useRecordedCoaching.test.tsx
- bodyguard/frontend/src/coaching/useRecordedCoaching.ts
- bodyguard/frontend/e2e/authcoaching.spec.ts
- bodyguard/frontend/e2e/fixtures/authCoachingProbe.ts
- bodyguard/frontend/e2e/fixtures/authCoaching.vite.ts
- bodyguard/frontend/playwright.account.config.ts
- bodyguard/frontend/scripts/check-selection-production.mjs
- bodyguard/backend/tests/run_browser.py
- bodyguard/docs/review/coaching-auth-lifecycle/README.md
- bodyguard/docs/review/coaching-auth-lifecycle/collect-proof.mjs
- bodyguard/docs/review/coaching-auth-lifecycle/artifacts.json 및46개 원본/실패/실제 화면 증거

## Change Log

2026-10-06: 최신 main43b13f3에서 S4.11 계약/최초 하네스 시작. 실제 SDK/classifier/두 아바타·공개 코칭은 후속 의존성 유지.
2026-10-06: committed auth/page lifecycle·경합3건 보완, 실제 provider/Chrome/API/SQL 및 전체 회귀·실패 원본 검증 후 review.
