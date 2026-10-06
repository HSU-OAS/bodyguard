---
baseline_commit: 37354aa4e074d86e862e5851352f917cc001b6fb
---
# S4.16 — 본인 계정에 결속된 private 1분 요약 업로드

Status: in-progress

## Story

로그인한 사용자의 검증된 관찰 구간을 1분 요약으로 만들고, 본인 세션에만 저장하며 불확실한 전송은 같은 내용으로 명시 재시도할 수 있도록 한다. 현재 classifier/실측이 없으므로 이번 연결은 **private/test 전용**이다. 공개 시작/코칭/측정 producer를 완성된 기능으로 노출하지 않는다.

FR-R-01/02/03/06·FR-U-04·NFR-07/08·ADR-0003. 기존 S4.12 실제 시간가중 엔진, PR48 요약 API, PR49 본인 기록 웹을 연결한다. PO 제안인 IndexedDB 보관 기간·자동5분/hidden/close keepalive는 이 Story에서 채택하지 않는다. 브라우저의 메모리 한정·명시 전송/재시도 기반을 구현하며 persistence 정책이 필요한 시점에는 별도 개인정보 승인으로 진행한다.

## Acceptance Criteria

1. 명시 ready authority/원래 CSRF/clock pair/metadata/관찰 구간만 사용한다. 실제 측정 없는 분·미완성 분·누락 공백의 임의 결과0이며 지표별 null/시간/union·baseline/version/method/unit을 그대로 API 입력으로 매핑한다. 기존 집계 엔진을 재구현하지 않는다.
2. 최대60분까지 caller가 지정한 bounded memory queue·batch를 사용한다. 완성 분만 snapshot 보관, 분별 raw 값/좌표/영상/계정 metadata body0. overflow/잘못된 입력은 terminal 고정 실패로 닫는다. empty upload 요청0, single-flight, 전송 중 추가된 완성 분을 먼저 보낸 분과 혼용/누락하지 않는다.
3. 원래 payload 문자열과 CSRF/expected-owner를 요청과 재시도에 유지한다. 실제 API의 기존201(신규 포함)/200(모두 동일) `MinuteList(items,has_more=false)`만 입력과 분별·지표별 동일한 경우 ack로 인정한다. 부분/중복/다른 값/추가 필드/잘못된 status는 성공으로 버퍼를 비우지 않는다. count ack를 새로 발명하지 않는다. 409는 충돌,422는 거부,401/403은 계정 차단,timeout/network/5xx 등 불확실 결과는 자동 재시도0·명시 retry로만 같은 batch 전송이다.
4. committed ready object 변경·logout·이탈/abort·close에서는 집계/queue/proof를 폐기하고 late 결과를 재사용하지 않는다. 전후 /me만으로 놓치는 CSRF 획득 A→B→A도 batch POST의 **요청 시점 기대 소유자** 대조로 타인 쓰기0. 기존 POST의 cookie/Origin/HMAC·레거시 expected-owner 없는 클라이언트·저장/재시도/rollback/migration 정책은 유지한다.
5. 결정적 모의 fetch/clock/authority 하네스와 실제 격리 PostgreSQL/FastAPI HTTP/production Chrome의 private bundle→합성 구간 집계→실제 저장→PR49 기록 화면 확인을 실행한다. 실제 수락 뒤 응답 단절→명시 동일 재시도1분만 저장, owner 변경·서버 거부/다른 계정 보존을 시험한다. 외부 메일·실제 신체/카메라/의료 정확도와 구분한다.
6. 전체 frontend/API·타입 생성/정적/build/public guard·기존 공개 웹/기록 웹 회귀·실패/증거 SHA·scope 리뷰를 실제 통과한 뒤 PR 게이트를 진행한다. public bundle의 private uploader/candidate0, 기존 화이트·블루 웹·아바타 동일 부위 새 제작0·전체1~6 미완료를 유지한다. 최신 main/diff/정확한 tested HEAD/CLEAN/체크·미해결 scoped P1/P2 없음 뒤 merge commit·브랜치 보존이다.

## Tasks / Subtasks

- [x] PR49 실제 merge/새 최신 main·기존 코드/계약/Story checklist 확인 (AC1–6)
- [x] strict API 입력 snapshot·private 소유 업로드의 결정적 red 하네스와 실제 POST 기대 소유자 red (AC1–4)
- [x] 기존 집계·DTO·원래 세션 proof/expected-owner·명시 single-flight/retry/폐기 연결 구현 (AC1–4)
- [x] private 실제 Chrome/API/SQL 저장→기록·단절/동일 재시도/계정/거부 시험 (AC5)
- [x] 전체 회귀·타입/정적/build/guard·화이트블루 기존 화면·원본/SHA 보존·scope 리뷰 (AC6)
- [ ] 커밋/PR·최신 diff/HEAD/main/CLEAN/체크·조건부 merge와 결과 기록 (AC6)

### Review Findings

- [x] [Review][Patch] P2 blind+edge: 충돌 browser 하네스가 같은 UTC 분을 재사용하도록 고정 — fixed minute 보완 후 실제 Chrome4 재실행 통과. 분 경계의 임의 다른 분 삽입을 충돌로 세지 않음.
- [x] [Review][Patch] P2 author: 요청 timeout 뒤 fetch/JSON이 취소를 무시하고 늦게 응답해도 성공 ack로 queue를 비우지 않음 — 실제 MU11 red1실패/23통과 후 signal 전후 대조·MU11/15 green, 최종29모의 사례 포함 전체682 통과.

## Dev Notes

- 기존 public `api/minuteSummaries.ts`는 strict Out/기간 list/삭제 context다. Input의 공통 검증을 export해 private mapper가 재사용하되 public Out/삭제/상세 semantics는 보존한다. 새 `summary/ownedMinuteUpload.ts/.test.ts`에 private 집계·전송 수명만 둔다. `summary/minuteAggregation.ts`는 그대로 재사용, 보정 전 neck/trunk 측정 값은 서버 정책에 맞춰 거부하고 지우거나0으로 바꾸지 않는다. baseline UUID는 기존 서버와 같은 canonical lower로 매핑한다.
- batch 응답은 read-list와 달리 ascending/최대60이고20건 page 규칙을 적용하면 안 된다. response `MinuteOut`를 strict 검증하고 요청 UTC 분/모든 입력 필드·method/unit/null/시간을 대조한다. server created_at/provenance는 실제 응답만 읽고 새 데이터로 꾸며 넣지 않는다.
- `prepareSummaries`/`recordOwner`에서 배운 /me bookend·memory proof·ready object identity·abort·fixed error를 따른다. generic `request(path,body)`는 매번 새 CSRF를 가져오므로 mutation에 사용하지 않는다. body에는 owner 선택 필드를 넣지 않는다. queue instance는 고정 metadata/owner이며 바뀌면 닫고 새 생성한다.
- `backend/app/summaries.py` batch만 optional `X-Account-ID`와 기존 CSRF로 request binding을 적용한다. 기존 register callback을 재사용한다. expected ID는 권한 override가 아니며 실제 인증한 owner를 바꾸지 않는다. 기존 POST auth/lock/transaction·새 migration0·다른 도메인0. 타입은 실제 FastAPI 명세에서 재생성한다.
- `backend/tests/run_browser.py`/`frontend/playwright.account.config.ts`에 새 minuteupload suite/probe 조건만 추가한다. 이전 suite·소유 egress sink·메일 IPC/원래 source·timestamp별 결과는 보존한다. `e2e/fixtures/minuteUploadProbe.ts/.vite.ts`는 owned scratch의 private JS이며 public route/리소스/생산자/임계값은 아니다.
- `scripts/check-selection-production.mjs`는 private uploader/probe 고정 signature 누출도 검사한다. App/auth.tsx/실제 classifier·카메라·CSS·아바타·운영/CI/기존 migration·.env·연구 원본은 변경하지 않는다. 폰트/패키지/버전 추가0. 새 신체/LLM/IndexedDB 정책0.
- 보존 교훈: UTF8 시험 DB를 명시해 SQL_ASCII 환경 오류를 기능 red와 구분한다. 원래 report·실패·manifest는 덮어쓰지 않는다. 모든 report/suite/testcase·input을 검사한 뒤 증거를 게시한다. source SHA와 exact HEAD/remote tree/diff를 별도 검증한다.
- 이전 S4.15는 sourcefc49d0c→merge37354aa/PR49 실제 main에 포함됐다. source24/artifact93·frontend653/API464·Chrome4/public8·Node8, 격리 DB 종료/원본 보존. 기존 SDK/privacy P2·단계2 이월·실측/참여자·Q32 나머지·법무/외부/운영/HTTPS·전체1~6는 미충족이다.

### References

[출시 계약](../release-plan.md), [운영 규칙](../operating-rules.md), [PRD FR-R/FR-U/NFR](../prd.md), [설계10/개인정보 경계](../design.md), [ADR-0003](../adr/0003-minute-summary-only.md), [S4.12](minute-aggregation.md), [S4.14](minute-summaries-api.md), [S4.15](minute-summary-web.md), [화이트·블루 웹 계약](../web-design.md).

새 라이브러리/버전 변경 없이 기존 pinned stack을 유지한다. abort 조합과 fetch의 명시 status/응답 판정은 공식 [AbortSignal.any](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static), [Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)를 확인했다. fetch 거부가 서버 rollback을 뜻한다고 가정하지 않는다.

## Dev Agent Record

Story context의 범위/재사용·파일 위치·회귀·수용 기준·보안/개인정보·테스트·PO 제안 구분을 checklist로 확인했다. 기존 사전 승인에 따라 이 기술 기반 연결을 선택한다. BMAD resolver/config/team override/sprint/project-context는 absent이며 create/dev 기본 prepend/append/on_complete는 빈 값이다. 명세 상태이며 실행 후 실제 결과만 기록한다. PRD/design은 이미 전체 읽은 최신 내용에 변경이 없고 Epic/architecture/UX 파일은 없어 release-plan/design/web-design과 기존 Story를 매핑한다.

실행: strict Input 공통 snapshot·private queue·원래 proof/body/expected-owner·실제 POST binding을 구현했다. 최초16stub실패, 실제201vs403 red1실패/1통과, late timeout red1실패/23통과, 수정 후29모의·전체682frontend/466API·타입/정적/build/public guard·실제 private Chrome4·공개8 통과. 실제 사람·카메라·의료 정확도0이며 현재 임시 UTF8 PostgreSQL만 사용했다. sandbox DB init/연결·UV cache·초기 build·collector leaf dialect 실패는 그대로 보존한다. [화면/예외/디자인 영향/증거](../review/owned-minute-upload/README.md).

BMAD3개 역할 최초 blind+edge 한 P2를 합쳐 보완했고 author timeout도 재현/수정했다. blind/edge 최종코드/collector 재검토는 []. acceptance와 source/artifact SHA·최신 main/diff/HEAD/PR 게이트 정리는 진행 중이다. sprint status/key 없음. 사전 승인에 따라 patch 선택 질문을 반복하지 않았으며 실제 병합 확인 전 Story Status는 in-progress다. 전체 단계와 출시 선언으로 확대하지 않는다.

최종 추가 실행: 기존 본인 기록 Chrome4도 통과(좁은 웹·확대·키보드/대비 포함). 전용 PostgreSQL PID62123/정확한 data 경로를 확인한 뒤 종료했고 데이터/원본은 보존했다. source28/artifact54 공개SHA를 실제 대조했고 collector 동일 재실행도 같은 바이트였다. 최종 acceptance 재검토와 PR HEAD/main/diff/CLEAN/체크/병합만 남는다.

최종 acceptance는 읽기 전용으로 source28·원본/public artifact54 SHA/크기/정규화, 전체 JUnit/Chrome 개별 결과·수치·실패 보존·PNG·DB 종료를 대조해 []를 반환했다. blind/edge/acceptance 전부 미해결 scoped P1/P2 없음. 작성자도 동일 SHA/원본과 diff --check를 확인했다. 실행/전문가/외부 검증으로 중복 계산하지 않는다. code-review on_complete resolver 실제 absent exit2/default 빈 값이며 추가 후속 실행0. 이제 최신 main/정확한 HEAD/원격 diff/tree/CLEAN/체크와 조건부 PR 병합을 진행한다.

## File List

- backend/app/summaries.py, backend/tests/test_summary_upload_binding.py, backend/tests/run_browser.py
- frontend/src/api/minuteSummaries.ts, frontend/src/api/generated/types.gen.ts
- frontend/src/summary/ownedMinuteUpload.ts/.test.ts
- frontend/e2e/minuteupload.spec.ts, frontend/e2e/fixtures/minuteUploadProbe.ts/minuteUpload.vite.ts
- frontend/playwright.account.config.ts, frontend/scripts/check-selection-production.mjs
- docs/stories/owned-minute-upload.md, docs/stories/minute-summary-web.md, docs/tasks.md
- docs/review/minute-summary-web/README.md (실제 이전 PR49 병합 metadata만 추가)
- docs/review/owned-minute-upload/README.md, collect-proof.mjs, verify-results.mjs, verify-results.test.mjs와 실제 artifacts.json의 증거 목록

## Change Log

- 2026-10-06: 실제 PR49 포함 최신 main37354aa의 codex/owned-minute-upload에서 본인 private 분 집계 업로드·명시 재시도 계약 확정.
- 2026-10-06: TDD/실제 계정 POST red·private 저장/재시도/보호 흐름 구현, 시계·timeout 리뷰 보완, 전체 회귀와 기존 화이트블루 기록 웹 증거 정리.
