---
baseline_commit: 991ed2b33a1abc6158b3a177f8431a104c476ba0
---
# S6.3 — 초기 웹 응답 분리·준비 하네스

Status: 구현·필수 검증 완료 / PR 병합 게이트 진행

## Story

사용자가 공개·보호 웹 화면을 제때 이용하도록, CTO는 화면의 실제 준비 시각과 자동화의 확인 지연을 분리해 기록하고 기존 실패를 재현한다. 제품 시작 지연을 근거 없이 환경 탓으로 돌리거나 테스트 시간을 늘려 통과시키지 않는다.

## Acceptance Criteria

1. START-I01: 최신 main991ed2b의 새 codex/web-startup-readiness에서 test-only 하네스를 작성한다. 실제 설치 Chrome·Vite production과 개발 웹을 사용하고 `/me`는 명시 합성 응답이다. 실제 인증·신체·전문가·운영 성능 검증이 아니다.
2. START-I02: 요청 가로채기 없는 자체 loopback HTTP `/me`와 기존 방식의 context.route 응답을 동일 화면에서 비교한다. production `/start`, dev `/dev/select`의 첫 탐색·같은 context 재탐색을 구분한다. 가로채기는 HTTP cache를 끄므로 두 번째 탐색을 두 모드 모두 ‘warm cache’라 부르지 않는다. browser process와 Vite transform cache의 잔존 한계를 명시한다.
3. START-I03: 제품 코드가 실행되기 전에 test-only MutationObserver가 예상한 `main h1`을 찾은 시각과 그 다음 두 requestAnimationFrame까지의 시각을 숫자로만 수집한다. 이를 실제 화면 픽셀 출력 시각이나 코칭 지연으로 부르지 않는다. navigation/DCL/로드·me resource timing·자동화 selector 소요를 분리한다. 원본 DOM·개인 이메일/쿠키·headers·body·카메라/관절·인증값·console 원문은 수집하지 않는다.
4. START-I04: locator 가시성 검사5000ms와 case30000ms를 그대로 사용한다. 지연/실패는 실제 실패로 남기고 준비 시각이 없는 경우 null로 남긴다. 알려진 checking/offline 화면·늦은 시작에서 거짓 준비를 만들지 않는 단위 하네스를 먼저 RED→GREEN으로 검증한다. 진단 성공과 제품 회귀 통과를 별도로 표시한다.
5. START-I05: 자체 서버·refusing proxy·격리 browser context만 사용한다. 신규 서버는 임의의 비어 있는 loopback port를 배정받고 다른 서버/프로그램을 재사용·종료하지 않는다. 예상하지 않은 API는403이고 외부 통신을 차단한다. 카메라 호출/브라우저 저장·model/GLB 요청0을 실제 확인한다. 결과는 실행별 고유 경로에 보존하고 trace/video나 외부 서비스는 사용하지 않는다.
6. START-I06: scoped 단위·전체frontend 회귀/타입/Biome/build/production DEV 차단과 실제 비교를 실행하고 실패 원본을 보존한다. 실제 지연 원인·제품 수정은 인과관계 증거 후 별도 응집된 Story로 진행한다. 필수 회귀가 실패하면 이 Story/PR도 완료·병합 처리하지 않는다. Draft #51 및 단계2 이월·전체1~6 완료 기준은 유지한다.

## Tasks / Subtasks

- [x] 명세·probe 단위 하네스와 observer 제거 mutation의 실제2실패/1통과→정상3통과 기록을 보존했다. 최초 의존성 다운로드 실패는 단위 RED가 아니다. 현재 visibility helper 포함5개 통과. (AC3,4)
- [x] probe·소유 loopback fixture/server·refusing proxy·별도 Playwright config/runner 구현. 제품 런타임 src·인증·API·legacy tests를 바꾸지 않았다. (AC1,2,3,5)
- [x] 실제 Chrome 두 화면×두 transport×첫/재탐색 측정·5개 strict 사례 통과·이전 실패 보존. (AC2–5)
- [x] 전체687 frontend·정적/type/build/DEV guard·실제 선택8/도움말3/기록11/공개·계정 스타일3 통과. 실행 전후 소스 hash·실패 개인정보 경계·소유 프로세스 취소를 검증했다. 단계6·전체1~6 완료는 아니다. (AC6)

## Dev Notes

- 근거: release-plan6, PRD FR-U-04·FR-V-03·NFR-07/08. 추론15fps/자세 피드백1초 목표와 웹 시작 selector5000ms는 서로 다른 기준이다.
- 승인: docs/operating-rules.md의 사전 승인. 비용·계정·secret·운영 DB·배포·출시·중요 안전/개인정보는 별도 승인. `.env`·CI·기존 migration·아바타/증거는 수정하지 않는다.
- 현재 source991ed2b: 보호 화면은 AuthProvider의 실제 /me 권한 결과를 기다리며 focus/pageshow/BroadcastChannel 때 재확인한다. 이 하네스는 synthetic /me를 test-only에서만 제공한다. production 인증 우회·최종 판정 공개 없음.
- 기존 scripts/test-selection-browser.mjs·playwright.selection.config.ts·e2e/selection.spec.ts: context.route 전체 요청,5초 expect/30초 case, localhost5182·4182, source-only UI. 이 Story에서 수정하지 않는다. 기존 run_browser는 실제 API/PG용이고 여기서는 변경/DB 실행이 불필요하다.
- NEW: frontend/e2e/fixtures/startupProbe.ts, src/startup-harness.test.ts, e2e/startup.spec.ts, playwright.startup.config.ts, scripts/test-startup-browser.mjs, docs/review/web-startup-readiness/README.md·실제 증거. UPDATE docs/tasks.md는 최신 진행 메타데이터만 추가한다.
- S6.1/S6.2 기존 통합·보안 기초는 실제 API/SQL/Chrome 증거다. S4.17 Draft #51의 대시보드 actual2·738frontend/492API 통과와 기존 기록/공개 실패는 별개다. 대시보드 코드는 이 main에 포함되지 않는다. source8cb8a07 Draft/CLEAN/MERGEABLE·체크 없음 상태와 실패 증거는 별도 작업트리에 보존한다.
- main991ed2b 비교도 기존 공개6실패/2통과였지만 원인은 미확정이다. Intl·memory·headless 추정을 원인으로 확정하지 않는다. CPU profile/blank page 진단은 제품 통과가 아니다.
- 기존 React19.3/TS6/Vite8/Playwright1.63/Chrome·시스템 글꼴·화이트/블루 web-design-studio 계약을 유지한다. 외부 폰트/SDK/새 dependency/버전 변경 없음. startup script는 개발 시험 전용이고 production bundle에 import하지 않는다.
- 공식 API 확인2026-10-06: [Playwright addInitScript/route](https://playwright.dev/docs/api/class-browsercontext)·[Vite JS API](https://vite.dev/guide/api-javascript). route 활성화는 HTTP cache를 끈다. init script는 문서 생성 후 제품 script 전 실행된다. preview는 운영 서버가 아닌 로컬 검증용이다.
- BMAD 기본 customize는 prepend/append/on_complete 비어 있음. resolver/config·sprint/epics/project-context는 저장소에 없다. CEO가 위임한 다음 독립 Story와 release-plan/PRD/design·기존 Story를 명시 context로 사용하며 전체 BMAD 프로젝트 실행을 주장하지 않는다. 서명/권한/수용 기준을 임의로 새 config로 확정하지 않는다.

## Dev Agent Record

### Review Findings

- [x] [Review][Patch] P2: 두 RAF 완료 전 샘플 복사 — 제한된 진단 대기와 미완료 실패를 구분하고 최종8개 탐색의 두 RAF 완료를 확인했다. (AC3,4)
- [x] [Review][Patch] P2: 모든127.0.0.1 포트 bypass — implicit loopback 제외·소유한 두 port만 허용·독립 소유 trap HTTP/WS 연결0을 확인했다. (AC5)
- [x] [Review][Patch] P2: child 생성 전 취소 무시 — proxy-ready/dev-ready 두 구간 모두 exit1·소유 listener 닫힘을 확인했다. (AC5)
- [x] [Review][Patch] P2: inherited Vite /api 범위 — prefix 전체403·정확한 GET /me만200을 확인했다. (AC5)
- [x] [Review][Patch] P2: 기본 실패 ARIA snapshot — 페이지 닫기만으로는 matcher 오류에 이미 담긴 ARIA를 제거하지 못함을 의도적 실패로 확인했다. 동일 visible/5000ms의 Locator.waitFor와 boolean assertion으로 바꾸고 페이지 정리를 유지했다. 재실패 exit1은 보존되며 표식·ARIA snapshot은 남지 않는다. error-context 파일의 고정 오류/시험 소스와 런타임 화면 원문은 구분한다. (AC3)

이 finding은 사전 승인된 기술적 리뷰 보완이다. 현재 필수 하네스/회귀는 통과했지만 이전 실패를 지우거나 실제 시작 지연 원인을 해결했다고 주장하지 않는다. PR 병합은 최종 diff·HEAD·CLEAN·체크 재확인 후에만 진행한다.

### Implementation Plan

명세·실패 단위 테스트 → 제품과 분리한 probe → 임의 loopback transport fixture/runner → 실제 Chrome 비교 → 원본 보존·회귀·리뷰. 실제 지연이 확인되면 허용 시간을 바꾸지 않고 별도 원인/수정 작업으로 넘긴다.

### Debug Log References

2026-10-07 실제 결과 정리: 최초 RED·보완 후 단위/전체 회귀와 Chrome 비교를 실행했다. 최종 비교 `startup-20261007T001834237Z`는 소유 포트/API 경계1개 통과, production/dev × HTTP/route 비교4개 실패다. timeout/회귀 기준을 바꾸지 않았으며 전체 통과나 병합으로 처리하지 않는다. 원본은 test-results의 실행별 디렉터리와 `/private/tmp/bodyguard-startup-proof.eSGnm9`에 보존한다.

증거 수집기의 `finalHarnessSource` 표현은 실행 당시 소스 정합성이 입증되지 않았는데 최종 소스로 오해될 수 있어 제거했다. 수정 전 수집된 `evidence`와 `evidence-review`는 과거 증거로 보존한다. 새 `evidence-review-provenance`에서는 `selectedReviewRun`만 표시하고 `sourceAtRunVerified: false`, 수집 시점 hash임을 명시한다. 이전 증거의 `finalHarnessSource`는 당시 실행 소스 검증을 입증하지 않는다.

### Completion Notes

2026-10-07 현재 [필수 검증과 실행 소스 증거](../review/web-startup-readiness/current-20261007/summary.json)는 하네스 범위 통과다. 현재 실제 시작·선택·도움말·기록·기존 스타일 회귀를 통과했으며 이전4개 비교 실패와 의도적 실패 원본을 유지한다. 시작 지연은 이번 구간에서 재현되지 않았고 원인은 미확정이다. 성능 결함의 제품 수정·실제 사람/신체·전문가·아바타·운영 성능·단계6·전체1~6 통과로 확대하지 않는다. 다음은 이 증거로 기존 Draft #51의 실제 회귀를 별도로 재검증하는 작업이다.

### File List

- bodyguard/docs/stories/web-startup-readiness.md
- bodyguard/docs/tasks.md
- bodyguard/frontend/e2e/fixtures/startupProbe.ts
- bodyguard/frontend/e2e/fixtures/startupVisibility.ts
- bodyguard/frontend/e2e/startup.spec.ts
- bodyguard/frontend/src/startup-harness.test.ts
- bodyguard/frontend/playwright.startup.config.ts
- bodyguard/frontend/scripts/test-startup-browser.mjs
- bodyguard/frontend/scripts/verify-startup-negative.mjs
- bodyguard/docs/review/web-startup-readiness/README.md
- bodyguard/docs/review/web-startup-readiness/collect-proof.mjs
- bodyguard/docs/review/web-startup-readiness/collect-current-proof.mjs
- bodyguard/docs/review/web-startup-readiness/evidence*/ · 과거 실패/수집 정합성 증거 보존
- bodyguard/docs/review/web-startup-readiness/current-20261007/ · 현재 숫자·상태·실행 hash 증거

### Change Log

2026-10-06: 최신 main991ed2b에서 독립 하네스 명세 작성. 기존 지연·아바타·전체 단계 게이트를 낮추지 않는다.
