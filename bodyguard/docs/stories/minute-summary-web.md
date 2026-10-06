# S4.15 — 본인 자세 기록 조회·기간 삭제 웹

Status: in-progress
baseline_commit: 654688be08ede24351491b687acae2b630dd674b

## 가치와 범위

FR-R-01/03/06, FR-U-04/05, NFR-07/08. PR48의 실제 1분 요약 API를 웹에서 읽고 상세 지표를 확인·기간 삭제한다. 기존 수행 기록과 구분하는 `/posture-records`, 시작/계정/헤더 진입점을 제공한다. 날짜 조회·20건 페이지·분별 상세·삭제 전 대상 수/취소/명시 확인·오류 복구까지 연결한다.

업로드 producer/IndexedDB/코칭·대시보드 일·주 통계/변화 탐지/PDF/LLM·운영·임계값은 이번 범위 밖이다. 개인 화면에 실제 서버 기록만 표시하고 합성/예시 기록·가짜 정상 점수·0% 기본값을 넣지 않는다. 기존 전체1~6 완료 기준과 단계2 이월·SDK 개인정보 P2·실측/참여자·별도 승인 경계를 유지한다.

## 디자인·기술 계약

- `web-design-studio`의 frontend-design·UI UX Pro Max 및 최종 critique 기준을 적용한다. 기존 `web-design.md`/index.css 백색·진청색·파란 액션·한글 시스템 글꼴·48px 컨트롤·8/12px radius·4px spacing을 재사용한다. 새 폰트/컴포넌트 패키지·원격 요청·효과·다크 모드·모바일 앱은 없다. 검색의 랜딩/판매 패턴·외부 폰트는 이 화면에 부적합해 채택하지 않는다.
- 주 행동은 기간 조회다. 분 목록은 비교 가능한 표, 상세는 선택한 분의 지표 표/설명이며 UUID 대신 `개인 기준선 사용/보정 전`·버전·method/unit을 보조 정보로 둔다. 현재 페이지 통계를 전체 기간 통계처럼 표시하지 않는다. missing 평균/분모0은 `—`와 측정 시간0이며 정상0으로 바꾸지 않는다.
- 기간은 기존 기록의 local-calendar/aware UTC 변환과 고정 cutoff를 재사용한다. 최근7일 기본·시작 포함/종료 제외·새 조회만 cutoff 갱신. URL from/to·뒤로 가기·invalid 기간은 요청0/수정 경로다. 서버 limit20·offset10000 경계를 지키고 더 있으면 기간 좁히기를 안내한다.
- 서버 DTO를 엄격하게 검증한다: 정확한 필드·유한 수·UTC 분·client-reported·지표별 method/unit/평균 null·시간/합집합/기준선 관계, 분 정렬/중복·응답 기간을 확인한다. 값을 자르거나 의료 기준/평균/점수를 만들어내지 않는다. 응답에 원시 필드/소유자 등 예상 밖 데이터가 있으면 고정 오류로 거부한다.
- 실제 AuthProvider의 committed ready object가 lease다. /me 대조·원래 CSRF를 캡처해 memory-only context로 쓰고, authority 변경/이탈/실패 시 abort/close·이전 데이터/삭제 proof 폐기. 날짜/페이지/재조회의 늦은 응답을 현재 데이터로 쓰지 않는다. 웹 GET은 캡처한 CSRF와 ready 계정 ID를 함께 보내 요청 시점의 쿠키 세션·소유자에 서버가 대조한다. ID는 권한 지정이 아니라 현재 인증 소유자 일치 확인이며 원래 소유자 조회를 대체하지 않는다. GET 전후 /me만으로 놓치는 A→B→A와 CSRF 획득 중 계정 전환도 거부한다. 기존 무헤더 인증 GET은 유지하고 GET에 Origin을 강요하지 않는다. 새 읽기 결속만 API에 추가하며 기존 migration·서명·다른 도메인 API는 수정하지 않는다.
- 삭제는 context 원래 CSRF로 실제 summary 전용 preview/delete를 호출한다. generic POST의 새 CSRF 획득으로 다른 계정을 따라가지 않는다. 원래 period·10분 TTL·count/fingerprint/signature를 검증해 보존한다. 서명된 시각은 microsecond ISO 원문 그대로 전송하고 기간은 UTC instant로 대조한다. 삭제 응답은 정확한 `{deleted}`이며 정수0 또는 preview.count만 성공이다. 부분/초과 수는 불확실 처리한다. 0건 확인 비활성화, double click single-flight, 취소/기간 변경 proof 폐기. 401/403은 계정 재확인, 409는 대상 재확인, 불확실 응답은 자동 재삭제/성공 추정 없이 목록 명시 재조회다. 수행 기록 삭제 API와 혼용하지 않는다.
- 빈/로딩/오류/조회 성공/상세/삭제 확인·완료/불확실/overflow/계정 차단 상태, title/heading focus/키보드·aria-current·label·status를 제공한다. 1440px/좁은 노트북 창·확대/reduced-motion/대비를 실제 production Chrome에서 확인한다. 검증되지 않은 모든 예외를 완료로 표시하지 않는다.

## 수용 기준 / 하네스

1. 실제 App route의 최초 red(미구현 화면), 합성 네트워크 DOM에서 본인 진입·빈/목록/상세·기간/페이지/invalid/에러·late/owner 변경·403/409/불확실·single-flight를 실행한다.
2. API parser/lease/삭제 adapters는 결정적인 경계·추가 필드·분모/UTC/합집합·다른 계정·old CSRF·abort/close·malformed response 시험을 실행한다. 실제 API에서 쿠키/CSRF/기대 소유자가 다른 GET403과 기존 무헤더 GET을 검증한다. 모의 응답을 실제 API로 세지 않는다.
3. 소유 격리 PostgreSQL18·실제 FastAPI HTTP·합성 계정/메일·현재 실제 API 저장 요약으로 production Chrome 조회/상세/페이지/취소/삭제·타인 보존과 불확실 응답을 실행한다. raw/실제 신체·외부 공급자·운영 없음.
4. 전체 frontend·API 회귀, typecheck/Biome/Ruff/mypy·build/public guard·기존 공개 웹 회귀, 실패 원본/소스/증거 SHA·scope 리뷰를 통과한다. 원본 파일·검증은 보존한다.
5. 정확한 HEAD/최신 main/diff/CLEAN/체크, 미해결 scoped P1/P2 없음 뒤 사전 승인 조건으로 merge commit·브랜치 보존. 공개 생산자0·출시 동작0·단계2/전체1~6 미완료를 유지한다.

## Tasks

- [x] 최신 main/PR48 실제 병합·의존성/디자인·Story 계약 확인
- [x] 실제 App red와 parser/lease/DOM 하네스
- [x] 본인 조회·상세·삭제·안전한 계정 수명 연결 구현
- [x] 실제 HTTP/SQL/production Chrome·전체 회귀·디자인 critique/증거
- [ ] 리뷰 보완·커밋/PR/조건부 병합·다음 독립 연결

### Review Findings

세 역할의 초기 소스 리뷰(Blind/Edge/Acceptance)는15개 의견을 중복 제거해12개로 정리했다. 모의/실제 실행 결과는 별도이며 의견만으로 검증 완료를 주장하지 않는다. CTO의 추가 datedraft 경합1개를 함께 보완한다. decision-needed/defer0, 기존 API의 live offset을 stable snapshot 계약으로 보는1개는 dismiss다. 목록 변동·명시 재조회 설명은 보강한다. 기존 사전 승인에 따라 patch를 진행하며 중요 정책/운영 변경은 없다.

- [x] [Review][Patch][blind+auditor] 날짜 수정·invalid 제출에서 이전 삭제 proof 폐기와 확인 기간 표시 — 조건부 unmount/layout cleanup, SW09.
- [x] [Review][Patch][blind] 서버와 브라우저 시계 차이가 삭제를 영구 차단하지 않음 — 실제 만료 판정은 기존 서버, adapter의 ahead-clock red/green.
- [x] [Review][Patch][blind] 기존 유효 CSRF-only GET 호환 — 실제403 red 후 현재 세션 proof만 검증, UI는 항상 owner ID도 결속.
- [x] [Review][Patch][blind] 지속401/403의 자동 refresh 루프 금지 — 이전 데이터/proof를 닫고 명시 계정 재확인, SW12.
- [x] [Review][Patch][blind+edge] tiny 분모의200%/Infinity 표시 차단 — 의료 임계값이 아닌 상대 floating 관계 검증, adapter 실제 모의 red/green.
- [x] [Review][Patch][blind] 삭제409 후 stale 목록/상세를 현재 목록으로 두지 않음 — onStale와 명시 확인/재조회.
- [x] [Review][Patch][blind+auditor] query 결과·삭제 취소·완료/복구의 키보드 초점 — 결과 제목/시작 버튼/결과 문단, SW10/11.
- [x] [Review][Patch][blind] committed A→B에서 늦은 list/preview/delete를 화면/proof로 재사용하지 않음 — 실제 AuthProvider의 합성 네트워크 DOM SW15 세 경로.
- [x] [Review][Patch][blind] offset10000·다음 차단·기간 좁히기와 페이지 이동 cutoff 하네스 — SW13/14.
- [x] [Review][Patch][edge] 이탈과 child passive cleanup 사이의 stale callback 차단 — 삭제 child도 layout cleanup을 사용.
- [x] [Review][Patch][auditor] 이후 빈 페이지와 전체 기간 부재를 구분 — SW10.
- [x] [Review][Patch][author] 두 날짜의 연속 변경에서 이전 draft로 서로 덮어쓰지 않음 — functional updater, SW03의 추가 실패/재실행 보존.
- [x] [Review][Patch][blind+edge+auditor] 정상 suite의0으로 실패/skip 집계를 잘못 통과시키는 collector P2 — 모든 root/suite counter·testcase 수·실패 태그와 완전 public summary 검사, Node8·최종 실제 보고서 통과.
- [x] [Review][Patch][blind] 증거 게시 전 모든 report/input/기존 destination을 검증 — preflight 후 immutable publish, 첫 manifest·당시 소스/시험 보존.
- [x] [Review][Patch][blind] 서명 종료 시각의 분 아래 경계를 숨기지 않음 — 초와 원본 소수부 표시, SW16·최종 production Chrome 재실행.
- [x] [Review][Patch][edge] comment/CDATA의 가짜 testcase를 성공 수로 세지 않음 — 제한된 실제 runner dialect 거부, Node 경계 시험·collector 반복 통과.

## Dev Agent Record

BMAD create/dev Story와 기존 사전 승인 운영 규칙에 매핑한다. 저장소 `_bmad` resolver/config/override·sprint status는 없고 설치/성공을 주장하지 않는다. 실제 UI·코드·검증 결과는 실행 뒤 기록한다. PR48 당시 원본·manifest/증거는 보존한다. 구현 전 읽기 전용 리뷰의 P2(조회 A→B→A)를 반영해 UI-only 범위를 본인 웹 조회의 최소 서버 결속까지 정정했다. 기존 개인정보/소유자 정책 강화이며 새 수집·저장 정책이나 운영 작업은 없다.

BMAD code-review 기본 설정은 resolver missing-file로 확인하고 직접 읽었다. prepend/append/on_complete는 없고 project-context·sprint 파일도 없다. CEO가 기존 범위의 모든 리뷰 보완과 다음 Story를 사전 승인했으므로 재승인 메뉴에서 멈추지 않는다. 리뷰 target은 이 Story와 최신 main654688b 대비 현재 변경이며 최초18파일/2177줄 diff를 세 역할이 독립 읽기 전용으로 확인했다. 완료 상태는 전체 필수 재검증과 최종 diff 리뷰·PR 게이트 뒤 갱신한다.

React의 committed layout cleanup과 비동기 응답 폐기, AbortSignal.any 조합은 공식 [useLayoutEffect](https://react.dev/reference/react/useLayoutEffect), [useEffect](https://react.dev/reference/react/useEffect), [AbortSignal.any](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static)를 확인했다. 스택/라이브러리 버전·새 원격 폰트·추가 패키지는 변경하지 않는다.

실제 [작동 화면·실패·디자인 critique·미완료 조건](../review/minute-summary-web/README.md)을 기록했다. 최종 frontend653/backend464·actual summary Chrome4/public8·Node validator8·정적/build/guard 통과, backend 기존 경고2·실패/환경 오류 보존, 최종 source24/artifact93 SHA·collector 동일 재실행 통과다. 원격 PR/최신 main·정확한 HEAD/CLEAN/체크/병합 확인은 다음 게이트이며 이 시점에는 완료로 표시하지 않는다. sprint-status는 파일/Story key가 없어 sync하지 않는다.

최종 세 역할 재검토는 미해결 scoped P1/P2 없음이다. Blind/Acceptance는 현재 source24/artifact93와 역사적 검증 소스 SHA를 직접 읽기 전용으로 대조했다. 테스트/Chrome/collector를 reviewer가 재실행한 것으로 세지 않으며 실제 작성자 실행은 위 증거에 구분한다. on_complete resolver를 실제 실행해 missing-file exit2를 확인했고 이미 읽은 default on_complete는 빈 값이다. 새 BMAD 설치/설정이나 custom 후속 행동은 없다. CEO의 사전 승인에 따라 원격 게이트 뒤 다음 독립 Story로 이어간다.

## File List

- backend: app/main.py, app/summaries.py (기존 인증 GET 호환을 유지한 요청 결속), tests/test_summary_read_binding.py, tests/run_browser.py.
- frontend: src/App.tsx, src/pages/MemberPage.tsx, src/api/generated/types.gen.ts, src/api/minuteSummaries.ts/.test.ts, src/pages/MinuteSummaryPage.tsx/.test.tsx/.css, src/pages/MinuteSummaryDeletion.tsx, e2e/summaries.spec.ts, playwright.account.config.ts.
- 개발 문서: 이 Story, tasks.md, review/minute-summary-web/README.md·collector/validator/tests·실제 로그/XML/report/PNG/SHA, 직전 PR48의 stories/minute-summaries-api.md·review/minute-summaries/README.md 병합 결과 metadata. 기존 API manifest/source·migration·연구 원본은 보존한다.

## Change Log

- 2026-10-06: PR48 최신 main에서 본인 자세 기록 웹 계약과 실제 화면/계정 경계 하네스 기준 확정.
- 2026-10-06: 실제 화이트·블루 조회/상세/확인·취소·삭제/복구 구현, scope 리뷰 보완과 실제 회귀·검증 증거 보존. 원격 조건부 PR 게이트 진행.
