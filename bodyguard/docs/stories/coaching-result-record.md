# S4.8 — 실제 코칭 결과→본인 기록 계약·adapter

review · 기준 main6d7e78fdc4c396707044f3e5d6d57268ebf3962d · codex/coaching-result-record

## 범위/선행 상태

FR-R-03/FR-U-04/NFR-07/08. PR #37의 실제 merge 부모/main 포함/source 브랜치 보존을 확인했다. 기존 API는 본인 client-reported 완료/중단/건너뜀 요약을 저장·조회하고 같은 ID/내용 재전송은200, 최초201, 변경409다. 카메라 코칭 결과를 쓰는 producer는 없다. 이 Story에서 순수 **종료 결과→기존8필드 요약**과 same-origin/CSRF 저장 adapter를 만들고 합성 실제 engine 결과/네트워크/소유 테스트를 먼저 작성한다.

Stage2 아바타/실측·실제 classifier/motion gate·공개 코칭은 미완료다. Draft PR #36 SDK 계측/개인정보 P2는 미해결이고 승인 응답이 없다. SDK/native ports를 재사용/호출하거나 개인정보 정책을 적용하지 않는다. 합성 시험 결과를 제품 사용자 기록으로 쓰지 않는다. 공개 자동 저장/UI/운영·DB migration·사업 정책은 범위 밖이다.

## CTO 계약

- resultRecord({snapshot,recordId,startedUtcAt}): 실제 ended+closed result만 기존 StretchInput 정확8필드로 복사한다. idle/preparing/running/paused·실제 ready/startedAt 없음은 null로 보류한다. 기본 ID/동작/시각/임계값·가짜 수행을 만들지 않는다.
- UTC anchor는 **최초 실제 코칭 ready의 시작 시각**을 caller가 제공해야 한다. endedAt은 원래 elapsedMs의 정수 ms와 anchor로 계산한다. pause/resume의 시작 기준을 재설정하거나 나중의 Date.now로 지속 시간을 지어내지 않는다. 실제 adapter가 없으면 제품 저장을 연결하지 않는다.
- 관찰 ms는 단계별 verifiedMs 합계에서 정수 미만만 내림한다. 반복 수는 실제 result 합계다. 기존 API의24시간/10000회/ID·동작·버전·aware datetime 범위를 검증한다. 이는 API 입력 제한이지 수행/의학 기준이 아니다.
- 기술 정합화: 순수 engine의 skip은 일부 수행한 뒤 다음으로 넘어가도 skipped+partial/completed 단계를 보존한다. 기존 API는 skipped에서 수행 ms/횟수를 허용하지 않는다. **모든 단계 pending인 전체 건너뜀만 기록 skipped, partial/completed가 있으면 기록 interrupted**로 요약한다. 원래 engine 결과/단계/skip 이유는 브라우저에 그대로 두며 이미 수행한 시간을0으로 지우거나 완료로 승격하지 않는다. 서버 스키마/필드/의학 판정 변경은 없다.
- snapshot·plan·result 식별자/단계/시간/합계/완료 정합성을 검증해 모순을 fixed invalid-result 오류로 보류한다. 원시 프레임/좌표·계정/추적 세대·tech reason/source·점수·진단을 payload/로그/저장소에 넣지 않는다.
- 저장 adapter는 기존 same-origin cookie/no-store/CSRF 서버 검증을 재사용하되, **해당 코칭 owner/session 시작 시 확보한 CSRF proof를 caller가 명시**한다. auth.request처럼 저장 시 새 proof를 자동으로 받지 않는다. 서버의 keyed(csrf, cookie) 검증이 변경된 쿠키/세션에 대한 과거 proof를 거부한다. proof는 메모리·요청 header에서만 사용하고 DTO/snapshot/저장소/URL/log에 넣지 않는다. 실제 owner capture adapter가 없으면 제품 저장0. 입력 요약만 직렬화하고200/201만 성공, 응답8필드/id/content/기간/created_at/provenance client-reported를 검증한다. payload/응답이 모순되면 성공으로 알리지 않는다.
- AbortSignal/동일 요약 ID 재시도·401/403/409/네트워크/늦은 응답·owner 변경은 producer caller의 명시 소유 경계에서 보류한다. 새 영구 queue·localStorage/IndexedDB·user_id/secret/header 로그를 만들지 않는다. 자동 재시도·다른 계정으로 재전송·운영 쓰기는 하지 않는다.

## 하네스/수용 기준

| ID | 검증 |
|---|---|
| R01 | constructor/비종료/준비만 한 종료는 요약/POST0; 실제 engine 완료/중단/전체 skip만 요약 |
| R02 | 원래 단계 verified ms/rep·elapsed/anchor 유지, 부분 skip interrupted·미수행 단계 pending 유지, integer/UTC/24h 계약 |
| R03 | 정확8필드·원시 좌표/계정/tech reason0·몰래 추가한 source/ID를 직렬화하지 않음, getter/잘못된 식별자·시간·result 모순은 fixed failure |
| R04 | same-origin CSRF/200·201/신호취소, invalid/foreign/different-content 응답은 성공 불가, raw 오류 body 노출0 |
| R05 | 명시 owner 상태·중복/late/재시도/폐기 범위 구현을 first harness로 고정. 실제 코칭/로그인 adapter 없음은 공개 저장0 |
| R06 | 전체 회귀·정적/build·production producer/합성 fixture0·실제 격리 API/브라우저 시험 가능성·diff/scope/조건부PR. mock/실제/미실행 구분 |

## 작업

- [x] 최신 main/PR #37 실제 결과·engine/S4 API/타입·독립성·명세 확인.
- [x] 첫 serializer red·상세 하네스와 원본 보존.
- [x] serializer/HTTP·필요한 소유 producer 계약 구현·상세/회귀·리뷰 보완.
- [x] 실제 실행 증거/한계·production 경계·로컬 리뷰 게이트. 원격 최신 diff/CLEAN/체크/exact HEAD 조건부 병합은 최종 실행 때 확인한다.

## Dev Agent Record

기존 완료/중단/건너뜀·client-reported 기록 범위 안의 기술 정합화다. 동작 정확성 인증·근거 없는 추천/의학적 효과·전체1~6단계 완료가 아니다. 서명/배포/실제 공급자/참여자/중요 개인정보 정책 승인은 별도다.

최초 상세 patch 호출은 JS template literal 문법 오류로 실행 자체가 시작되지 않았다(파일 변경0). 수정해 명세/최초 하네스를 작성했고 최초 missing module collection red exit1/시간0을 별도 원본으로 보존한다. auth.py 경로 추정 읽기 실패는 실제 main.py의 CSRF 검증/응답·records.py owner 호출을 읽어 정정했다. 검증 완료나 제품 실패로 세지 않는다. 구현은 아직 없다.

[최초 실제 실패와 원본 hash](../review/coaching-result-record/README.md)를 기록했다. 첫 collection red 수집만 완료했고 상세 R01~06 기능 하네스/실행·구현 완료로 세지 않는다.

### 구현·실제 검증 (2026-10-06)

위 두 문단은 시작 시점 기록이다. BMAD resolver/config/custom/project-context/sprint-status가 저장소에 없어 실제 resolver 실패를 확인하고 설치 기본값과 이 전용 Story/운영 규칙을 적용했다. 읽기 경로 AGENTS.md 추정 실패는 bodyguard/AGENTS.md를 전체 읽어 정정했다. 상세 patch의 동일 파일 delete+add, 이어 반복 hunk는 apply_patch 검증 실패/해당 호출 변경0이었다. package root에서 collector formatter를 실행한 것은 biome 없음 exit1이며 frontend의 실제 바이너리·설정으로 다시 실행했다. 작업 실패를 제품 검증 완료로 세지 않는다.

R01~05 상세23건을 먼저 작성해 미구현 collection red를 실행한 뒤 resultRecord/saveResultRecord/createRecordWriter를 구현했다. serializer는 earliest ready 원래 monotonic elapsed/단계 progress 일치·aware UTC·정확8필드/24h 계약만 복사한다. 순수 engine 변경0. writer는 하나의 명시적인 **인증 세션 lease 객체**와 시작 시 CSRF proof·불변 요약만 소유한다. userId/email은 lease가 아니며 실제 auth/UTC capture는 후속 통합이다. 중복 요청은 기존 Promise/결과를 재사용, 다른 요약은 대체하지 않으며 실패 후 submit은 재전송하지 않는다. retry만 같은 ID/내용/proof로 명시 실행한다. owner 변경·예외·close는 요청을 취소하고 bound 요약/proof를 비우며 late 성공/실패를 반영하지 않는다. 이미 서버가 수락한 기록까지 abort로 되돌렸다는 주장은 하지 않는다.

초기 상세23건은 통과했고 초기 타입 검사는 fetch spy가 무인자 tuple로 추론돼2오류(exit2)였다. 실제 RequestInit 인자를 명시해 해결했다. engineering:code-review의 보안/정확성/경합 검토에서 잘못된 시각24:00 정규화·24h 소수 초과의 내림, context/constructor getter의 원시 오류 노출을 보완했다. 추가 review-red26건 중3실패를 보존하고 fixed error/명시 시각 경계·내림 전 한도를 적용한 뒤26건 통과. 최종29건/전체459건·type/Biome 통과. 검사 우회·시크릿/원시 좌표/영구 queue 추가0.

실제 production Chrome/격리 API/SQL: 초기3건, 추가 최종5건 통과. 별도 private Vite probe bundle을 Playwright route로만 제공하여 **실제 main session+합성 관찰/자원→serializer→HTTP writer→본인 기록 목록/상세**를 확인했다. 전체 skipped만0 수행, partial-skip은 interrupted+100ms/미수행 단계 pending 보존, pause/resume은40ms 보존. 동일 내용 재전송200/변경409; 응답 단절 후 명시 재시도200+DB 한 건; 쿠키 변경 후 과거 proof403+양 계정 기록0; 수락 뒤 owner 폐기/late 응답은 닫힌 상태+새 계정 기록0/원 계정 기록1이다. 합성뿐이며 실제 촬영/classifier/임상·움직임 검증이 아니다.

기존 API/실제 격리 SQL 전체291건(135.49초)·Ruff/format/mypy 통과. 기존 asyncio deprecated 경고1은 보존했다. 공개 Chrome 회귀7건+test RAF 합성1건 통과. 공개 JS/CSS는 이전 source와 SHA 동일하고 새로운 producer/합성 fixture0; guard에 누출 파일을 실제 넣어 exit1을 확인하고 해당 시험 파일만 제거한 뒤 exit0. CI·실제 HTTPS·운영·참여자·Figma/외부 디자인 audit는 실행하지 않았다. 화이트/블루 공개 UI 그대로다.

README·원본/공개 SHA23증거·source SHA9파일을 수집하고 재실행 시 불변을 확인한다. 범위 내 미해결 P1/P2 없음. Draft36 SDK 계측 P2·아바타/실측·실제 owner/time capture·관찰 classifier·공개 coaching/자동 기록·Q32 부가 기능·참여자/운영/1~6단계 미완료는 그대로이며 후속 독립 작업을 이어간다.

## File List

- bodyguard/frontend/src/coaching/resultRecord.ts
- bodyguard/frontend/src/coaching/resultRecord.test.ts
- bodyguard/frontend/src/api/records.ts (기존 strict 응답 parser 재사용 export만)
- bodyguard/frontend/e2e/resultrecord.spec.ts
- bodyguard/frontend/e2e/fixtures/resultRecordProbe.ts
- bodyguard/frontend/e2e/fixtures/resultRecord.vite.ts
- bodyguard/frontend/playwright.account.config.ts
- bodyguard/frontend/scripts/check-selection-production.mjs
- bodyguard/backend/tests/run_browser.py
- bodyguard/docs/stories/coaching-result-record.md
- bodyguard/docs/stories/coaching-observation-loop.md (PR37 실제 post-merge 상태만)
- bodyguard/docs/tasks.md
- bodyguard/docs/review/coaching-result-record/README.md
- bodyguard/docs/review/coaching-result-record/collect-proof.mjs
- bodyguard/docs/review/coaching-result-record/{artifacts-first.json,artifacts.json,first-red.xml,contract-red.xml,initial-unit.xml,initial-types.stdout,review-red.xml,review-unit.xml,final-frontend.xml,final-backend.xml,final-check.stdout,final-types.stdout,final-ruff.stdout,final-backend-format.stdout,final-mypy.stdout,initial-browser.stdout,final-browser.stdout,final-public-browser.stdout,production-negative.stdout,production-positive.stdout,initial-browser-report.json,final-browser-report.json,initial-result-record-detail.png,final-result-record-detail.png,production-start.png}

## Change Log

2026-10-05: SDK 정책과 독립인 결과→본인 기록 계약 Story 시작, 부분 skip의 기존 API 정합성 명시.

2026-10-06: 상세 하네스→serializer/HTTP/세션 lease writer·review red 보완, 실제 Chrome/API/SQL 기록 흐름·전체 회귀/production 경계와 실행 원본 수집. 운영/공개 코칭 연결은 제외.
