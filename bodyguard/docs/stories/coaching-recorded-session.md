# S4.10 — 최초 준비 완료 시각과 본인 수행 기록 연결

review · 기준 main faa5061daf281ca2061d0efcb750df91633f080b · codex/coaching-recorded-session · 2026-10-06

## 범위/선행

FR-S-02/04·FR-R-03·FR-U-04/NFR-07/08. PR39 실제 merge faa5061의 두 부모(5422745/d0f2df), main 포함·소스 브랜치 보존·clean을 확인했다. S4.9 owner context와 실제 session/result serializer/writer를 연결하는 private adapter다. AuthProvider hook·실제 카메라/SDK·classifier·두 아바타·공개 코칭/자동 저장은 후속 통합이며 이번 범위가 아니다.

## CTO 계약

- createRecordedSession은 caller가 명시한 UUID, 이미 캡처한 owner context, 기존 plan/ports/gates/observer, readClockPair만 받는다. UUID/계정/UTC 기본값·나중의 역산·의학 각도/판정 기본값을 만들지 않는다.
- readClockPair는 한 호출의 monotonicMs와 canonical UTC 밀리초 문자열을 제공한다. 실제 session.now에 사용한 동일 샘플로 최초 ready의 startedAt과 UTC를 연결한다. 준비 대기 중·idle·시작 실패는 기록0이다. 최초 ready 이후 pause/resume는 anchor를 바꾸지 않는다. 종료 UTC는 기존 codec의 실제 단조 elapsed로 계산하며 이후 wall-clock 이동을 기록 기간에 넣지 않는다.
- malformed/getter/비정상 시계는 기존 clock-error 종료 경계다. 최초 anchor 확보 실패는 저장하지 않는다. 이미 확보한 anchor로 안전하게 종료된 interruption만 기존 codec이 허용하는 경우 저장 가능하며 완료로 승격하지 않는다.
- owner.active와 기존 gate를 함께 확인한다. 교체·abort·같은 계정의 새 authority·dispose는 writer/anchor를 폐기하고 자원을 종료한다. owner context를 새 계정으로 바꾸지 않는다. 캡처 proof의 서버403 backstop을 유지한다.
- save는 종료된 실제 session snapshot을 existing resultRecord→같은 context writer로 연결하는 명시 동작이다. 준비/진행 중·미시작·폐기 후는 POST0이다. 종료/자원 cleanup이 네트워크 저장을 기다리지 않는다. 실패 후 retry만 같은 UUID/내용을 재사용한다. 저장 성공 뒤 중복 save/retry는 새 레코드가 아니다.
- memory only; DTO는 기존8필드뿐이며 좌표/영상/원시 오류/계정/기술 종료 사유·UTC anchor를 로그/storage/URL에 넣지 않는다. 메서드/고정 snapshot만 반환한다.
- public production의 adapter/fixture/producer0 유지, 화이트·블루 웹 변경0. SDK P2/2단계 이월·실측·참여자·운영/Q32·전체1~6 완료 기준을 낮추지 않는다.

## 하네스/수용 기준

| ID | 실행 검증 |
|---|---|
| A01 | 생성/idle/준비 대기·gate 실패/미시작 종료 POST0, 실제 ready 동일 clock pair로 anchor |
| A02 | 완료/부분 skip/중단·pause/resume와 wall-clock 이동에도 최초 시작/실제 elapsed/검증 시간 유지 |
| A03 | malformed UTC/clock/getter·역행·owner 교체/abort/폐기·late 결과/저장 재시도 고정 경계 |
| A04 | 실제 session/owner capture→실제 Chrome/API/SQL 본인 기록·중복/계정403·자원 정리. 관찰/ports/clock/authority는 합성임을 구분 |
| A05 | 전체 front/API·타입/정적/build·production 음성/양성·공개 웹 회귀, 원본 실패/SHA/범위 리뷰·조건부 PR |

## 작업

- [x] 최신 main/PR39 실제 결과·경계 읽기, Story/검증 계약 확정.
- [x] 먼저 red/상세 하네스 작성, 원본 보존.
- [x] 시각/session/result/owner adapter 구현 및 리뷰 보완.
- [x] 실제 Chrome/API/SQL와 전체 회귀·정적/production·증거/로컬 리뷰. 원격 latest diff/HEAD/CLEAN/체크는 조건부 PR 실행 직전 다시 확인한다.

## Dev Agent Record

BMAD dev-story 기본 workflow를 사용한다. 기존 resolver/config/custom/project-context/sprint-status 부재를 확인했고 직전 on_complete도 실제 absent exit2다. 기본 후속 명령은 빈 값이며 설정 설치/생성으로 우회하지 않는다. 새 작업트리 AGENTS는 전체 읽은 원문과 byte가 같다. 기존 실패/브랜치/파일은 보존한다.

현재 구현 전이다. 실제 AuthProvider hook/자원/판정/아바타·참여자 정확도/외부 연결·운영·전체 단계 완료는 없다. 최초 collection red는 실행된 기능 시험으로 세지 않는다. 지정 web-design-studio 계약의 화이트/블루 웹을 유지하고 UI 디자인 변경 시 해당 skill의 lead/reference·검증 순서를 적용한다.

### 실제 구현·검증

위 Dev Agent Record의 구현 전 문단은 착수 시점이다. 두 초기 pnpm 실행은 dependency 링크/DNS 거부로 기능0/XML0(첫 exit1/둘째 interrupt130), 일부 도구 출력만 남았으며 완전한 stdout 보존을 주장하지 않는다. 기존 캐시 offline/frozen-lockfile 연결 후 실제 missing module collection1 red를 보존하고 상세 하네스/구현을 진행했다. 패키지/lockfile/정책 변경0.

초기22 green 후 작성자 engineering:code-review P2를25개 중3red로 재현·보완(원시 plan accessor 오류, context 이중 소유, repeated dispose cleanup 대기). 기존 bound writer 재사용26개 중1red, API-invalid year0/UUID coercion28개 중2red도 준비 전 차단으로 보완했다. 기존 source/실패/green 보고서는 그대로다. 최종 새28개 포함 전체503/실패0·타입/Biome115파일·수집기1파일 통과. 실제 API/SQL291개(360.44초)·Ruff/format/backend cwd mypy 통과, 기존 asyncio deprecation과 Pydantic alias 경고2를 숨기지 않는다.

첫 실제 Chrome3pass/1fail(49.5초)은 정확한 API 시각의 microsecond 문자열을 하네스가 millisecond로 예상한 오류다. 원본 report/context/stdout을 보존하고 기존 직렬화 형식으로 정확히 비교하는 하네스만 정정했다. 다음4pass(28.9초), 최종 소스 재실행4pass(28.6초): earliest ready/paused-interruption 본인 상세, 준비 중 같은 계정 authority 교체/late 폐기, 이미 수락된 응답 단절의 명시 retry200/SQL 한 건, 다른 쿠키 old proof403/양 계정 기록0. 합성 clock/ports/authority/관찰/메일과 실제 Chrome/API/SQL을 구분한다. 서버 수락을 로컬 abort가 rollback한다고 주장하지 않는다.

공개7+합성 RAF1/8개(1.4분)·build 통과. 실제 생성 fault JS로 production guard exit1, 그 소유 fault 파일만 제거해 exit0. 옛 dist filename의 shasum은 file missing exit1였으며 실제 새 filename으로 다시 읽었다. 공개 JS byte SHA deae9447은 동일, CSS에는 .block display:block 한 규칙21byte만 추가됐고 해당 규칙을 제거한 byte의 기존 c0123052 SHA를 실제 assert했다. 현재 공개 UI에서 className block 선언은 rg 결과0이며 새 UI 디자인을 주장하지 않는다. 미완성 코칭 adapter/producer는 production0이다.

실제 source8/증거33개 SHA와 수집기 불변 재실행을 확인했다. README/Story는 실제/모의/미실행·실패를 구분한다. 반환 DTO 기존8필드의 started_at/ended_at은 허용된 요약이고 별도 UTC pair/계정/좌표/원시 오류는 저장하지 않는다. owner 변경은 caller sync/dispose 또는 다음 action/ready gate에서 관찰되며 실제 AuthProvider hook/즉시 페이지 수명 통합은 후속 Story다. 공개 source/route·API/schema·CI/의존성/CSP/SDK/운영 변경0, scope 미해결 P1/P2 없음. 단계2/4·전체1~6 완료가 아니다.

다음 독립 Story는 실제 AuthProvider 상태 객체·페이지 수명에 준비/capture/recorded session을 연결한다. Draft36 SDK 개인정보 P2·실제 camera/classifier/두 아바타·외형/실측·참여자/외부/운영/법무/Q32/전체 완료 기준은 미완료로 유지한다. 화이트·블루 웹·아바타 같은 부위 새 제작0이다.

## File List

- bodyguard/docs/stories/coaching-recorded-session.md
- bodyguard/docs/stories/coaching-record-capture.md (실제 PR39 post-merge 기록)
- bodyguard/docs/tasks.md
- bodyguard/frontend/src/coaching/recordedSession.test.ts
- bodyguard/frontend/src/coaching/recordedSession.ts
- bodyguard/frontend/e2e/recordedsession.spec.ts
- bodyguard/frontend/e2e/fixtures/recordedSessionProbe.ts
- bodyguard/frontend/e2e/fixtures/recordedSession.vite.ts
- bodyguard/frontend/playwright.account.config.ts
- bodyguard/frontend/scripts/check-selection-production.mjs
- bodyguard/backend/tests/run_browser.py
- bodyguard/docs/review/coaching-recorded-session/{README.md,collect-proof.mjs,artifacts.json}
- bodyguard/docs/review/coaching-recorded-session/{offline-install.stdout,contract-red.xml,initial-unit.xml,initial-types.stdout,review-red.xml,review-green.xml,bound-review-red.xml,clock-id-review-red.xml,final-frontend.xml,accepted-frontend.xml,final-accepted-frontend.xml,browser-types.stdout,accepted-types.stdout,final-check.stdout,accepted-check.stdout,final-accepted-check.stdout,initial-browser.stdout,accepted-browser.stdout,final-browser.stdout,final-backend.xml,final-backend.stdout,final-ruff.stdout,final-backend-format.stdout,final-mypy.stdout,final-public-browser.stdout,production-negative.stdout,production-positive.stdout,initial-browser-report.json,initial-error-context.md,accepted-browser-report.json,final-browser-report.json,recorded-session-detail.png,production-start.png}

## Change Log

2026-10-06: 최신 main faa5061에서 S4.10 계약/최초 하네스 시작. 실제 auth hook/공개 코칭은 후속 의존성이다.

2026-10-06: 최초 ready pair/owner/session 결과 연결·28 상세 하네스·실제 Chrome4/본인 기록 상세, 리뷰 red 보완·전체 회귀·원본/SHA 보존. 공개 자동 저장/운영 변경0.
