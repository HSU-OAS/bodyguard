---
baseline_commit: 991ed2b33a1abc6158b3a177f8431a104c476ba0
---
# S4.17 — 본인 일·주 기록 대시보드

Status: in-progress

## Story

로그인한 사용자가 선택한 하루 또는 한 주의 저장된 자세·수행 기록을 한 화면에서 확인하고 상세 기록 관리로 이동한다. FR-R-03/06·FR-U-04·NFR-07/08·ADR-0003. 실제 측정 producer/의료 정확도는 이 Story가 인증하지 않는다. 알림 이벤트 저장이 아직 없으므로 알림 횟수는 미연결로 남기며 0건으로 꾸미지 않는다. FR-R-03 전체 완료 선언은 하지 않는다.

## Acceptance Criteria

1. 본인 세션의 기존 1분·수행 테이블만 읽는 GET `/api/v1/records/dashboard?date=YYYY-MM-DD&period=day|week&timezone=IANA`를 구현한다. 새 migration·저장·보관 정책0. 기존 owner/user lock/CSRF/기대 계정 대조를 재사용하며 쿠키 교체·로그아웃·ready 객체 교체·abort·늦은 응답의 타인/오래된 기록 표시0. 조회는 no-store다.
2. 하루는 선택한 지역 달력 날짜의 자정부터 다음 자정, 한 주는 선택한 날짜가 속한 월요일부터 다음 월요일이며 끝은 제외한다. 브라우저 IANA 시간대를 요청·표시하고 URL에 날짜/기간/시간대를 보존한다. DST를 고정24시간으로 계산하지 않는다. 잘못된 날짜/시간대/범위는422, 존재하지 않는 지역 날짜는 거부한다. 수행은 started_at 기준이며 걸친 운동은 시작일에 한 번만 센다.
3. 기간 전체를 SQL 집계하여 목록20행/offset10000 제한을 가져오지 않는다. 한 SQL snapshot에서 요약 분 수·coverage/measured/unmeasurable/background/any_bad 합과 completed/interrupted/skipped 수행 건수를 구한다. 목/어깨/몸통은 baseline/client_version/method/unit별 분리하며 평균=sum(dev_mean×measured_sec)/sum(measured_sec), 이탈 비율=sum(bad_sec)/sum(measured_sec)이다. 측정0은 mean/ratio null, 없는 분/알림/정상 값을 생성하지 않는다. 타인/기간 외 데이터0.
4. `/dashboard`는 화이트·블루 기존 의료 계열 WEB 계약을 재사용한다. 제목→하루/한 주+날짜 조회(주 행동)→관찰/측정/수행 요약→부위별 기록→관리 링크 순서. 그룹별 보정 전/기준/버전/방법/단위를 명확히 구분한다. 점수·진단·효과·자격 배지/그래프 보간0. 로딩·빈 상태·잘못된 입력·오류/명시 재시도·권한 오류를 구현하며 과거 결과를 새 기간 결과처럼 남기지 않는다. 제출/뒤로가기/리로드와 제목·결과 초점/키보드/좁은 웹/확대/reduced-motion을 실제 확인한다.
5. 결정적 집계/날짜/응답 파서·계정 수명 DOM 하네스, 실제 격리 UTF8 PostgreSQL/FastAPI의 weighted/null/단위·기준/버전/기간 경계·DST·전체 주10000행 초과·타인/권위 경계, production Chrome의 실제 저장→일/주 조회→관리/복귀·빈 기간/오류 복구·좁은 웹을 실행한다. 합성 자료/메일 IPC이며 사람·카메라·외부·의료 검증으로 세지 않는다. 실패/이미지/원본/SHA를 보존한다.
6. 전체 frontend/API 회귀·실제 OpenAPI 타입 생성·정적/build/public guard·공개/기존 기록 웹·3역할 scope 리뷰를 실행한다. actual HEAD/main/diff/CLEAN/체크/미해결 scoped P1/P2 없음 뒤 조건부 merge commit·브랜치 보존. 미실행은 그대로 남기고 2단계 이월·SDK/privacy P2·실측/참여자·PDF/LLM/변화/알림·법무/운영·전체1~6 출시 게이트를 닫았다고 하지 않는다.

## Tasks / Subtasks

- [x] 계약/재사용/디자인·이전 PR 실제 병합 metadata/최초 red (AC1–6)
- [x] 본인 일·주 SQL·엄격한 응답·계정 lease 연결 (AC1–3)
- [x] 화이트·블루 대시보드·실제 상태/탐색/초점 (AC4)
- [ ] 실제 API/SQL/Chrome·DOM/경계 회귀·원본 보존 (AC5)
- [ ] 전체 품질/디자인/3역할 리뷰·PR/조건부 병합 (AC6)

## Dev Notes
### Review Findings

- [x] [Review][Patch][P3] 과도하게 긴 시간대 경로의 ZoneInfo OSError도422로 처리한다. 재검토 blind. `dashboard.py`
- [x] [Review][Patch][P3] 저장된 subnormal 측정 시간의 표현 불가능한 비율은 null·정밀도 안내로 보존하며 조회 전체를 실패시키지 않는다. 재검토 edge. `dashboard.py`
- [x] [Review][Patch][P3] 최대 허용 평균도 numeric 시간가중 계산으로 반올림 초과·곱셈 underflow를 방지한다. 재검토 edge. `dashboard.py`
- [x] [Review][Patch][P3]0분 duration 허용 오차는0으로 유지한다. 재검토 edge. `dashboard.ts`
- [x] [Review][Patch][P3]각 baseline/version partition의 세 부위가 모두 있어야 한다. 재검토 edge. `dashboard.ts`
- [x] [Review][Patch][P3]1867 Alaska처럼 지역 날짜가 뒤로 되돌아가는 경우에도 해당 날짜만 집계한다. 재검토 edge. `dashboard.py`
- [x] [Review][Patch][P3] 유한 subnormal 비율도 JSON으로 보낸 float 시간과 동일하게 계산해 decimal/binary 불일치를 제거한다. 최종 blind. `dashboard.py`
- [x] [Review][Patch][P3] 양수 비율의 underflow도 null·정밀도 안내로 보존하며0%로 바꾸지 않는다. 최종 auditor. API/파서/DOM.
- [ ] [Verification][P2] 기존 기록/공개 Chrome의 화면 준비 시간 초과 해결 및 필수 회귀 통과. main 격리 비교에서도 공개6실패/2통과지만 원인은 미확정이며 병합 게이트를 열지 않는다. AC6.

재검토 첫 실행의 auditor는 사용량 제한으로 실패했다. 제한 해제 후 새3역할로 다시 실행해 auditor는 새 위반0, blind1/edge5개의 경계 보완을 보고했다. 위 numeric 두 항목·빈 기간/partition 두 항목·역사 날짜·ZoneInfo를6개로 추적하며 실제 새 회귀를 먼저 실패시킨 뒤 보완한다. 초기 브라우저 지연 및 기존 기록/공개 회귀의5초 실패는 해결/성능 통과로 세지 않는다.

- [x] [Review][Patch][P2] 기존 저장 계약의 additive 시간 오차를 집계 파서에서도 보존하고 부정확한 비율을 정상 값으로 꾸미지 않는다. blind/edge/auditor 중복 통합. `api/dashboard.ts`
- [x] [Review][Patch][P2] ready 교체·abort를 분리하고 로그아웃·cookie/final me 변경의 늦은 응답을 DOM에서 각각 검증한다. blind/auditor. `RecordDashboardPage.test.tsx`
- [x] [Review][Patch][P3] Intl numeric offset·IANA case와 ZoneInfo의 공통 계약 및 잘못된 URL 복구를 검증한다. blind/edge. `api/dashboard.ts`
- [x] [Review][Patch][P3] 자정 전부터 시작한 DST 공백에서도 첫 유효 순간을 backend/frontend 동일하게 찾는다. edge/auditor. `dashboard.py`
- [x] [Review][Patch][P3] 부위 누락·global any_bad와 부위 bad 정합성을 검사하며 개별 파서 negative 시험의 앞선 guard masking을 제거한다. blind. `dashboard.test.ts`
- [x] [Review][Patch][P3] 보정/방법/단위/버전 독립 집계와 minute start/end 경계를 실제 API에서 검증한다. blind. `test_dashboard.py`

3역할 전체 결과 수신·중복 통합6 patch, decision0/defer0/dismiss0. 메뉴 재승인은 CEO 사전 승인으로 생략하며 전부 보완·재검토한다. 최종 증거/실제 Chrome/PR는 아직 미충족이므로 Story done으로 표시하지 않는다. config/team/sprint/project-context 없음, on_complete 빈 값, sprint status sync 불가를 기록한다.


NEW backend/app/dashboard.py: existing authenticate/bind_read callback을 받아 등록한다. SQL 합계와 부위별 그룹·수행 counts를 하나의 statement로 읽어 concurrent 저장/삭제 때문에 서로 다른 snapshot을 합치지 않는다. summaries.py UPDATE는 authenticate 정의 직후 등록 호출/새 import만; 기존 batch/read/delete/transaction·lock·레거시 클라이언트는 보존한다. db.py/main.py/마이그레이션 수정0. duration/timeweighted 계산 임계값은 floating tolerance만이며 임상 기준이 아니다.

NEW frontend/api/dashboard.ts + tests / pages/RecordDashboardPage.tsx + tests/CSS. 기존 auth request/ReadyAccount·validDay/localDay를 재사용하며 raw 목록으로 재집계하지 않는다. /me→original CSRF→/me→요청 기대 owner→/me를 가진 memory proof만 사용한다. 결과는 exact 기간/시간대/방법/단위/null·시간 정합성을 검사한다. 요청 timeout signal은 headers/JSON 후에도 확인한다. generic mutation·로그·IndexedDB·보정/producer 변경0.

App.tsx UPDATE: 공통 Shell header·SessionGate/start/routes/focus를 읽었으며 새 보호된 dashboard route/시작 링크/메뉴만 추가한다. 기존 로그인/시제품 분리/이탈 카메라 해제·알림 페이지 요청 수명 보존. MemberPage UPDATE: 계정/로그아웃/수행·자세 삭제·알림 설정은 유지하고 대시보드 링크만 추가. 스타일은 새 scoped CSS에서 기존 .website tokens/한글 시스템 폰트/48px controls/8px radius/focus/reduced-motion을 상속한다. 기존 CSS/패키지/폰트/스택 교체0.

run_browser.py/playwright.account.config.ts UPDATE: 기존 timestamp/report/private probe/suite를 보존하고 dashboard suite만 추가한다. 신규 Chrome fixture는 실제 cookie/API synthetic 기록을 저장하고 외부 egress sink·mail IPC를 그대로 사용한다. 새 public 테스트 endpoint/카메라/임계값0. 코드와 문서는 개발 bodyguard 내부만 수정한다.

이전 S4.16의 60분 batch ascending ack는20행 list와 다르다. 전체 하루/주 dashboard도 페이지 목록과 다르며 임의 첫20행을 전체로 표시하지 않는다. 같은 UTC 분 conflict 시계를 고정하고 timeout late ack를 버린 교훈을 적용한다. 원본 PG/실패/report를 덮어쓰지 않고 source/tree/evidence SHA는 실제 실행 시각별로 구분한다.

디자인 계약: 주 행동은 기간 조회 하나; 하얀 배경·청색 버튼/표 머리·남색 본문·얇은 경계, 부위별 다른 기준은 compact list로 비교한다. 색만으로 상태를 전달하지 않는다. 자동 UIUX 최초 추천의 hero/testimonial/neumorphism과 재검색의 enterprise판매/외부폰트/amber/복수차트는 이 제품에 맞지 않아 사용하지 않는다. 재검색의 data-dense table/필터/초점/대비와 React controlled input만 검증된 입력으로 활용한다. Figma/axe/Impeccable 실행 주장0. 최종8스킬 critique는 실제 desktop/narrow PNG에 기반한다.

### References

수치·날짜 보완: SQL의 시간가중 평균은 저장된 float의 round-trip text를 numeric으로 변환해 곱셈 underflow·최대 평균의 반올림 초과를 방지한다. 비율은 같은 SQL snapshot이 반환한 bad/measured float 합으로 계산해 프런트와 일치시킨다. overflow 또는 양수 underflow는 null이며, nonzero 측정의 null은 화면에 정밀도 확인으로 표시한다. 저장 입력·임상 임계값 변경0. 날짜가 되돌아가는 역사적 전환은 UTC enclosing range와 SQL 지역 날짜 조건을 함께 사용해 정확한 지역 날짜만 집계한다. end는 반복되는 다음 자정의 마지막 순간을 포함하는 조회 경계이며, 다음 지역 날짜의 데이터는 SQL에서 제외한다. 지원 날짜를 임의로 줄이지 않았다.

브라우저 상태: production Chrome2는 실제 일/주→리로드→관리/복귀 및 빈 기간/503복구/실제403을 통과했다. 이는15초 request deadline에 맞춘 기능 상태 검증이며 성능 통과가 아니다. 기존5초 기대 시간은 변경하지 않았고 기존 기록 회귀는 headless3실패/1통과·headed4실패, 공개 회귀는6실패/2통과로 실제 남았다. 최신 main991ed2b의 격리 복사본도 같은 공개6실패/2통과를 재현했다. CPU 프로파일에는 React render 및 테스트 접근성 탐색 시간이 함께 포함되므로 원인으로 단정하지 않는다. 빈 문서3회 진단의 JS/브리지 시간도 최초289.5/879.6ms에서2.4/14.1ms로 달랐다(앱 회귀 통과가 아님). 메모리 원인은 미확정(단순 free121MB와 reclaimable 포함 free42%를 구분). 새 기본 재시도·인증 우회·user 프로그램 종료0. 미통과 회귀가 있으므로 Story/조건부 병합/전체 출시 완료는 선언하지 않는다.

증거 수집기의 기본 모드는 필수 테스트가 실패하면 공개 증거 쓰기 전에 실패한다. 별도 `--incomplete`는 실패를 그대로 기록한 불변 `runs/<Chrome 실행 시각>-<manifest digest>` 스냅샷을 저장하고 exit2로 끝낸다. allRequiredTestsPassed·storyComplete·mergeAuthorizedByThisBundle은false이며 완료 증거가 아니다. 첫 publication의 실행 중 stdout 캡처는 raw hash 재대조 실패로 보존했고, inode 제외·raw_source·content-addressed revision으로 보완했다. 이전 성공/실패·원본 hash·CPU metadata/실제 PNG는 보존하고 cookie가 들어갈 수 있는 trace·mailbox·PG data는 레포에 넣지 않는다.

[출시 계약](../release-plan.md), [운영](../operating-rules.md), [PRD FR-R-03/06](../prd.md), [설계](../design.md), [공통 의료 웹 계약](../web-design.md), [S4.16](owned-minute-upload.md), [기록 웹](minute-summary-web.md).

기존 pinned React19.3/TS6/Vite8/FastAPI/Pydantic2/SQLAlchemy2.1/PG18을 유지한다. 공식 [Python ZoneInfo](https://docs.python.org/3/library/zoneinfo.html)의 지역 달력/DST와 [PostgreSQL aggregate](https://www.postgresql.org/docs/current/functions-aggregate.html)의 빈 sum=null·count=0 규칙을 확인했다. 새 라이브러리 업그레이드0. 시스템 IANA 자료가 없는 환경은 알려진 준비 의존성으로 남긴다.

## Dev Agent Record

Story를 CTO 사전 승인 범위에서 선택했다. resolver 실제 absent exit2·기본 customize prepend/append/on_complete 빈 값, config/team/sprint/project-context/epic/architecture/UX exact 파일 없음. 기존 전체 읽은 PRD/design은 unchanged이며 release-plan/web-design/이전 Story로 매핑한다. 명세·red·구현과 최초729 frontend/485 API, 중간735/490, 최종738 frontend/492 API·scoped56/26을 실제 실행했다. 마지막 수치 두 건의 API red와 파서 red를 보존하고3역할 재검토의 새로운 범위 내 코드 지적0을 확인했다. 다만 실제 필수 브라우저 회귀 실패·성능과 PR 게이트가 남아 Status in-progress다. scope 내의 메뉴·보완은 CEO 사전 승인으로 계속하며 실패를 통과로 세지 않는다.

2026-10-06 원격: [Draft PR #51](https://github.com/HSU-OAS/bodyguard/pull/51), 구현 source6f26913·remote/local tree9e68994b860eb340cbe08930e642a95be3364e91 일치. 최신 main991ed2b·OPEN/Draft/CLEAN/MERGEABLE·체크 없음. 필수 회귀/성능 실패 때문에 병합하지 않는다. 문서 상태 후속 커밋만 진행하고 독립 초기 웹 응답 하네스는 최신 main의 새 Story로 진행한다.

## File List

- NEW `backend/app/dashboard.py`, `backend/tests/test_dashboard.py`
- UPDATE `backend/app/summaries.py`, `backend/tests/run_browser.py`
- NEW `frontend/src/api/dashboard.ts`, `frontend/src/api/dashboard.test.ts`
- NEW `frontend/src/pages/RecordDashboardPage.tsx`, `RecordDashboardPage.test.tsx`, `RecordDashboardPage.css`
- NEW `frontend/e2e/dashboard.spec.ts`
- UPDATE `frontend/src/App.tsx`, `frontend/src/pages/MemberPage.tsx`, `frontend/src/api/generated/index.ts`, `types.gen.ts`
- UPDATE `frontend/playwright.account.config.ts`, `frontend/playwright.selection.config.ts`, `frontend/scripts/test-selection-browser.mjs`
- NEW `docs/stories/record-dashboard.md`, `docs/review/record-dashboard/collect-proof.mjs`, `README.md`, immutable `runs/` evidence
- NEW `docs/review/record-dashboard/pr-body.md` — 실제 Draft 본문/실패 게이트 기록
- UPDATE `docs/tasks.md`; previous Story PR #50 actual merge metadata only: `docs/stories/owned-minute-upload.md`, `docs/review/owned-minute-upload/README.md`

## Change Log

- 2026-10-06: 최신 main991ed2b의 codex/record-dashboard에서 S4.17 명세·화이트블루 화면 계약 확정. S4.16 실제 병합 metadata만 정리, 기존 증거 보존.
- 2026-10-06: 실제 일/주 조회·오류 복구·계정 경계와 화이트/블루 화면 구현. 초기6보완 완료, 추가6경계 보완 및 실제 red/green. 기존 브라우저 회귀 지연은 미해결로 유지하고 전체 출시 게이트를 닫지 않음.
- 2026-10-06: 최종2수치 보완·738/492 및 Chrome2 통과, 독립 증거 감사·첫 publication 실패 보존. Draft PR #51 생성, 체크 없음·CLEAN 확인. 회귀/성능 미충족으로 병합0.
