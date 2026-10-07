# S2.5f — 코칭 관찰 전달·중단 루프

독립 Story PR #37 main 병합 · merge6d7e78fd · source4ca8017e · codex/coaching-observation-loop

## 범위/선행 상태

FR-S-02/04·FR-M-07·FR-U-04/NFR-07/08. main의 실제 session/engine에 명시 scheduler·검증된 관찰 provider를 연결하는 비공개 loop다. **Draft PR #36 e4df4a9는 SDK 계측 P2/B-09 미충족**, 병합하지 않았다. 개인정보 정책 승인 응답이 없고, 이 Story는 그 코드에 의존하지 않는다. native camera/SDK/아바타/임계값/공개 UI/새 개인정보 정책·egress를 만들지 않는다.

createObservationLoop({session,scheduler,readFrame})는 sync/close만 반환한다. scheduler는 request(callback)/cancel(handle)을 명시한다. readFrame은 generation/signal을 받고 이미 검증된 original observation 또는 null을 반환한다. provider 구현/의학적 분류 자체가 아니다. null을 target/success로 바꾸거나 관찰 시각/sequence/세대를 새로 찍지 않는다. session의 onChange에서 sync를 부르고 페이지 수명 종료에서 close하는 연결은 후속 실제 통합 범위다.

## 수용 기준/하네스

| ID | 검증 조건 |
|---|---|
| L01 | 생성·idle/preparing/paused/ended 상태에서는 provider0·예약0. 명시 running sync만 예약 |
| L02 | 세대별 AbortController, 최대1개 예약/추론. pending provider 중에도 tick은 계속하되 관찰 성공을 지어내지 않음 |
| L03 | 관찰 객체의 generation/sampledAt/sequence/step/personCount/classification을 그대로 session.observe에 전달. stale/duplicate/unknown/multiple person은 engine 보류 규칙 유지 |
| L04 | pause/end/세대 교체/close에서 예약 취소·signal abort. 과거 성공/예외가 새 세션을 재개/종료/카운트하지 않음 |
| L05 | current provider throw/reject는 fixed inference-error, scheduler/연결 오류는 fixed callback-error로 종료·재예약 금지·raw data/오류 노출0 |
| L06 | null/오랜 pending에서도 실제 engine tick이 frame age/gap을 처리. ended/expiry 후 호출/자동 재개0 |
| L07 | 실제 main session/engine과 합성 ports/관찰/수동 scheduler의 결정적 하네스, 소유권/취소/재진입·late 검증; 실제 카메라/임상/노트북 검증과 구분 |
| L08 | 전체 frontend 회귀·타입/Biome/build·production private loop/fixture0·실제 공개 웹 Chrome 회귀·diff/scope 리뷰/조건부 PR 게이트 |

처음부터 실제 motion gate가 false인 코칭을 공개하지 않는다. 기본 각도/시간 기준·model·아바타 품질/의상 요구를 바꾸지 않는다. 기존 source/camera/helpers·서버/DB/.env/CI/deps/lock·운영/배포는 유지한다. SDK 통신 정책·실제 참여자·Docker/외부 공급자/운영/비용 승인은 별도다.

## 작업

- [x] 최신 main/PR #36 Draft 미완료·독립성/engine/session 경계 확인.
- [x] 첫 미구현 red·상세 실행 하네스/원본 보존.
- [x] loop 구현·late/취소/고정 failure·상세 green·scope 리뷰.
- [x] 전체/정적/build·공개 browser/production·증거 로컬 검증.
- [x] latest main/diff/exact HEAD/CLEAN/체크 없음·scope 미해결P1/P2 없음 후 PR #37 merge commit 병합. 실제 부모/main 포함·source 브랜치 보존 확인.

## Dev Agent Record

실제 provider 구현·motion validation·아바타·추천/결과 producer·Stage2 이월·Q32 부가 기능·외부/운영/법무/참여자·전체1~6단계는 미완료다. SDK 통신 문제를 우회하거나 이 Story의 성공을 출시로 세지 않는다.

실제19건·전체430건·타입/Biome100파일/build·production guard(음성 exit1/최종0)·Chrome8흐름을 실행했다. 실제RAF1흐름은 합성 자원·관찰이고 공개7흐름은 계정응답 mock이다. 작성자 P2 두 건은19건 중2실패 red로 재현 후 예약별1회/deferred 확인·취소로 해결했다. [원본/실패/현재 웹](../review/coaching-observation-loop/README.md). scoped 미해결P1/P2 없음, Draft36 SDK 정책 P2와 전체 출시 gate는 미충족 유지.

## File List

- frontend/src/coaching/observationLoop.ts, observationLoop.test.ts.
- frontend/e2e/fixtures/observationLoopProbe.ts, e2e/selection.spec.ts; scripts/check-selection-production.mjs.
- docs/tasks.md, docs/stories/coaching-observation-loop.md; docs/review/coaching-observation-loop/의 collector·실제 증거.

## Change Log

2026-10-05: SDK 정책 승인과 독립인 최신-main 관찰 루프 명세/하네스 시작.
2026-10-05: 예약 중복/동기 callback P2를 보완하고 순수 관찰 loop·실제RAF+합성 자원·공개 웹 회귀 검증. PR 게이트 진행.
