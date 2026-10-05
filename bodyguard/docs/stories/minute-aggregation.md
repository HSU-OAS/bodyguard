# S4.12 — 개인정보 경계를 지키는 1분 집계

review · 기준 mainf47dea17a7ec92ff62404c5624bc4c18cd0782a2 · codex/private-minute-aggregation · 2026-10-06

## 범위

FR-R-01/06·NFR-07·ADR-0003. 알림·대시보드·PDF에 필요한 승인 범위의 1분 요약 기반이다. 실제 classifier/기준선·측정 producer가 없는 상태에서도 독립적으로 검증할 수 있는 private 순수 TypeScript 집계 엔진을 만든다. 공개 측정/대시보드·HTTP 업로드·IndexedDB 큐·DB schema·임계값/의학 효과·LLM·운영 변경은 이번 범위가 아니다.

## CTO 계약

- caller가 명시한 단조/UTC clock pair를 고정하고 UTC 시계 분 경계로 나눈다. Date.now/UUID/기준선/의학 임계값 기본값을 만들지 않는다.
- 입력은 검증된 producer가 제공할 **관찰된 구간**의 시작/끝, presence/background와 지표별 편차/이탈 상태뿐이다. 단일 sample이 빈 시간 전체를 대표한다고 가정하거나 가려진 지표 값을 만들어내지 않는다. raw 좌표/영상/계정/추가 metadata를 받는 schema가 아니다.
- maxIntervalMs·buffer limit·clientVersion·baselineId(null은 보정 전)·지표별 method/unit/수치 유효 범위는 caller가 명시한다. 기술적 구간 한도는 임계값 채택/카메라 정확도 검증이 아니다. 정의는 이번 instance 동안 고정되며 보정/방법/owner 변경은 instance close 후 별도 생성한다.
- 각 지표 평균은 해당 지표가 실제 측정된 구간 길이로 가중하고, 관찰 불가 지표는 null/측정0이다. 전역 measured는 하나 이상 실제 측정된 foreground 구간, unmeasurable은 관찰됐지만 측정되지 않은 foreground 구간이다. background는 별도다. 사람이 실제 보였다고 입력된 foreground만 present에 센다.
- covered 시간과 빈 구간을 구분한다. 누락/권한 대기/owner 변경/시간 공백은 정상·이탈·측정 시간으로 채우지 않는다. UTC 분별 coverage를 함께 남겨 분모를 왜곡하지 않도록 한다. 기존 design §10의 제안 API schema를 이 private 결과 DTO로 확정/대체하지 않는다.
- 세 지표의 동시 이탈은 any_bad 시간에서 중복 합산하지 않는다. UTC 분 경계의 구간은 정확히 분할한다. finish된 분만 flush하고 전송/저장/공개 consumer는 없다.
- 개별 구간/지표 값을 array/history에 보관하지 않고 합계·가중 합만 유지한다. flush와 close는 해당 누적 값을 버린다. buffer 한도·역행/겹침/잘못된 값/추가 필드/원시 getter 실패는 고정 오류로 닫고 데이터·오류 payload를 로그/서버에 보내지 않는다.
- UI는 지정 web-design-studio·화이트/블루 웹을 유지하며 이 Story에서 새 화면을 만들지 않는다. 같은 아바타 부위 새 제작0·Draft36 SDK P2·단계2 이월·참여자·Q32 나머지·외부/운영·전체1~6 게이트를 유지한다.

## 하네스/수용 기준

| ID | 실행 기준 |
|---|---|
| M01 | 명시 clock/metadata만 생성; empty/no sample/unfinished 분에서 임의 결과0 |
| M02 | 불규칙 구간 시간가중·지표별 null/분모·동시 이탈 중복0 |
| M03 | UTC 분 경계/누락/foreground·background·partial flush 정확한 분할 |
| M04 | baseline/method 정의 불변·소유 close·flush 후 재사용/immutable 결과 |
| M05 | 역행/overlap/한도/NaN/추가 좌표·account 필드/원시 getter 고정 오류·terminal 폐기 |
| M06 | 전체 회귀/타입·정적/build/production0·실패 원본·source 증거·범위 리뷰·조건부 PR |

## 작업

- [x] 실제 PR41 merge/부모/main 포함·브랜치 보존 및 새 main worktree·관련 PRD/ADR/제안 schema 경계 확인.
- [x] 결정적인 red 하네스 작성.
- [x] private 집계 엔진 및 경계 리뷰 보완.
- [x] 전체 frontend/공개 웹 회귀·production·원본·작성자 scope 리뷰.
- [ ] 최신 diff/HEAD/main/CLEAN·체크·충돌 후 조건부 PR/merge.

## Dev Agent Record

BMAD dev-story 기본 workflow를 유지한다. 직전 on_complete resolver는 실제 absent exit2이고 default 후속 값은 빈 값이다. 새 AGENTS는 전체 읽은 직전 원문과 byte 동일하며 추가 AGENTS/project-context/sprint-status/resolver가 없다. 착수 때는 계약만 작성했으며 이후의 구현/검증은 아래에 기록한다. 실제 측정/임계값·baseline·알림·업로드·PDF/LLM·단계4 완료가 아니다.

명시 clock·baseline/method·관찰 구간만 받는 private 엔진을 구현했다. 지표별 시간가중 평균, 겹치는 이탈의 union, UTC 분 경계 분할·공백/측정 불가/보정 전 분모, immutable DTO·buffer 제한/역행/추가 필드/원시 getter 고정 실패·terminal 폐기를 연결했다. raw 구간/좌표 history·자동 저장·HTTP/계정/임계값·새 DB/운영/공개 consumer는0이다.

실패 원본은 [검증 기록](../review/minute-aggregation/README.md)에 보존한다. 최초 collection 실패는 기능0, 상세33개 green 중 raw getter annotation은 타입 실패였고 보완했다. clock/definitions 반복 accessor에 의한 pair 혼합을34개 중1red, UTC epoch 큰 수 연산에 의한 고해상도 시간 소실을35개 중2red로 재현했다. source를 한 번 캡처하고 상대 시간 분할 후 UTC timestamp를 붙여35개 green을 확인했다.

최종 전체 frontend558/실패0(이번35)·타입/Biome122·build·공개7+합성 RAF1/실패0(15.8초), guard 음성exit1/양성exit0, source3/artifact18 SHA·수집기 byte-identical 재실행을 실제 확인했다. public JS/CSS byte는 PR41과 동일하다. backend/API source 변경0·이 Story에서 API 회귀 새 실행0이며 이전 API 결과를 다시 세지 않는다. private 합성 구간 검증이지 실제 classifier/신체 정확도/참여자·웹 전체 완료가 아니다.

engineering:code-review의 입력/시간/수치/버퍼·폐기/metadata 불변/public 누출을 작성자 검토했다. web-design-studio의 기존 토큰·실제 화면 기준을 유지하되 새 UI 디자인/추가 audit 수행 주장은 없다. 같은 아바타 부위 새 제작0·Draft36 SDK P2·단계2 이월·실측/참여자·Q32 알림/PDF/LLM/변화 탐지·외부/운영·전체1~6 미완료는 유지한다.

## File List

- bodyguard/docs/stories/minute-aggregation.md
- bodyguard/docs/stories/coaching-auth-lifecycle.md (실제 PR41 post-merge 상태)
- bodyguard/docs/tasks.md
- bodyguard/frontend/src/summary/minuteAggregation.ts
- bodyguard/frontend/src/summary/minuteAggregation.test.ts
- bodyguard/frontend/scripts/check-selection-production.mjs
- bodyguard/docs/review/minute-aggregation/README.md
- bodyguard/docs/review/minute-aggregation/collect-proof.mjs
- bodyguard/docs/review/minute-aggregation/artifacts.json 및18개 실행/실패/실제 공개 화면 증거

## Change Log

2026-10-06: 최신 mainf47dea1에서 계약·하네스 시작. 빈 구간/미검증 지표를 성공 데이터로 만드는 consumer는 추가하지 않는다.
2026-10-06: 시간가중/분 경계/보정 전·공백·폐기 집계 및 경합·정밀도 리뷰 보완 후 review.
