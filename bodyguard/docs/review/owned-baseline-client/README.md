# 계정 소유 기준선 웹 연결 — 실행 결과와 남은 조건

S3.B1, 기준 main `d2204436fb52792d89834a93012b9bc5fcfed4dc`(PR138 병합). 본인 활성/과거 기준선 조회와 명시 저장·교체·동일 ID 재시도를 기존 API에 연결하는 범위다. 실제 카메라 보정·정자세 판정·추천·공개 보정 화면의 완성이 아니다. 원래 아바타/참여자/Docker/공식 문의/메일·Google 연결 보류 및 전체1~6 미완료를 유지한다.

## 재현한 실패와 보완

- 작성자 리뷰의 제어 시험: 15초 요청 신호가 만료돼도 늦은 fetch/JSON이 반환한 값을 성공으로 받았다. 불변 원본 snapshot의 시험은 1통과/2실패, 저장소의 추가 회귀는 44통과/2실패였다. 같은 요청 신호를 fetch와 await 뒤 검사에 사용하도록 보완한 뒤 46통과했다. 제어된 네트워크/신호이며 실제 사람·실제 15초 지연의 관찰이 아니다.
- 실제 초기 Chrome/HTTP/SQL은 1통과/2실패였다. 저장 자체가 수락됐지만 클라이언트의 날짜 파서가 기존 API의 `+09:00` 응답을 거부했다. 시험 DB의 `TimeZone=Asia/Seoul`, 기준선 날짜 오프셋 `+09`를 읽기 전용으로 확인했다. 서버의 기존 날짜 계약을 변경하거나 운영 설정을 UTC로 바꾸지 않고, 클라이언트가 유효한 명시 시간대를 원문 그대로 보존하도록 보완했다. 날짜 누락·비정상 시각·비정상 오프셋 거부는 유지한다.
- 두 apply_patch 시도는 최신 문맥/긴 명세 문장의 불일치로 적용 전 실패했다. 읽은 문맥을 다시 확인하여 적용했다. 이것을 제품 검증 실패나 실행 성공으로 바꾸지 않는다.
- OpenAPI 생성의 첫 실행은 sandbox의 uv cache 접근으로 실패했고, 직접 Node 재실행은 후처리 도구 Biome을 PATH에서 찾지 못해 실패했다. 두 로그와 생성기 crash 원본을 보존했다. 기존 설치된 도구 경로를 쓰는 `pnpm exec node scripts/generate-api.mjs`는 실제 성공했으며, 정상 생성된 파일은 이미 시험한 SHA256과 일치한다. 생성 방식·의존성/설치·CI 설정을 변경하지 않았다.
- 공개 산출물 비교의 첫 assertion은 초기 작업트리의 오래된 dist cache를 기준으로 삼아 실패했다. 그 snapshot을 보존하며 이를 제품 회귀 해결로 세지 않는다. 최신 main PR138에 기록된 실제 성공 빌드 증거가 그 commit의 Git blob과 동일함을 확인하고, 해당 JS/CSS의 이름·byte·SHA256 전부가 현재 실제 제품 빌드와 일치함을 별도로 검증했다.

초기 원본: `/private/tmp/bodyguard-baseline-review.G1abZB`, `/private/tmp/bodyguard-baseline-client.PxgHqfMw`, `frontend/test-results/baselineclient-20261011T114100705489Z/report.json`. 기존 파일·실패 결과는 덮어쓰거나 삭제하지 않는다. 최종 소유 시험은 별도 `/private/tmp/bodyguard-auth-test.yjqwZW`와 `/private/tmp/bodyguard-baseline-client.VApmkgqP`에서 실행한다. 다른 기존 시험 DB를 종료하거나 초기화하지 않는다.

## 실제 범위와 진행 상태

- 웹 클라이언트: strict immutable DTO, null 보존, 원래 ready 객체/ID/CSRF lease, optional owner-bound GET/POST, single-flight, 늦은 응답/계정 회수 차단, 자동 저장·재시도 없음.
- API: 기존 저장 형식·쿠키가 결정하는 소유자·멱등/과거 불변/교체 transaction을 유지한다. optional 원래 세션/계정 hint를 기존 검사로 대조하며 hint로 소유자를 선택하지 않는다. 기존 헤더 없는 호출도 유지한다. 새 migration·운영 데이터 변경은 없다.
- Chrome 시험: 비공개 bundle을 시험에서만 주입한다. 새 제품 UI/route·카메라·SDK·아바타·공급자·영속 브라우저 저장은 연결하지 않는다. 계정/메일·기준선 값은 합성이고, Chrome/HTTP/PostgreSQL은 실제다.
- `testing-strategy`에 따라 DTO/소유권 unit → 실제 SQL 계약/경합 회귀 → 세 가지 실제 브라우저 흐름으로 구분한다. `code-review`는 작성자 보안·수명·정확성·scope 점검에 사용했다. 독립 전문가/외부 리뷰를 수행했다는 뜻은 아니다.

## 실제 완료한 흐름

1. 활성 기준선 없음 → 명시 저장 → 새 기준선으로 교체 → 이전 기준선 조회/동일 ID 재시도에서 비활성 원본과 원래 날짜 유지 → 다른 payload의 같은 ID는409 → 새 계정은 없음/타인 상세404.
2. 서버 저장201 뒤 응답을 의도적으로 단절 → 성공 표시 없이503 → 새 명시 준비/같은 ID 재시도 → 동일 기준선 반환. 자동 재시도는 없다.
3. ready 객체를 그대로 두고 실제 쿠키 계정을 교체 → 원래 읽기·저장 lease는403으로 차단 → 상대 계정에는 새 기준선이 없다.

세 흐름은 기존 웹의 `/start`에 비공개 시험 consumer를 주입해 실행했다. 새 공개 화면·사용자 신체 보정 UI를 만든 것이 아니다. 최종 SQL은 기준선3행/활성2행/소유자2명으로 흐름1의 두 저장, 흐름2의 한 저장, 흐름3의 저장 거부와 일치한다.

## 최종 로컬 검증

- frontend: 실제 100개 파일/1827개 모두 통과, 그중 기준선 클라이언트54개. timeout 회귀는 제어 신호 시험이다.
- backend: 새 소유 PostgreSQL18.6의 실제 전체 API542개, 오류/실패/skip0. 기존 deprecation/alias 경고3개는 남아 있다.
- Chrome154: 실제 브라우저/HTTP/SQL3흐름, 실패/skip/flaky/retry0. 각 관찰 context의 외부/GLB/SDK 요청0, local/session storage0이며 프로세스 전체 외부 통신0을 증명한다는 뜻은 아니다.
- TypeScript, Biome(기존 info16개), Ruff, format, mypy, 원래 product notice build 및 production guard 통과. 생성 타입 정상 재생성 성공.
- 실행 전/후/정상 타입 재생성 후 12개 runtime/harness/contract 파일 SHA256 동일. 공개 JS355833byte/CSS31199byte는 PR138의 실제 빌드와 동일하다.
- 이번에만 만든 DB PID93203은 소유 경로/PID를 대조해 종료했고 postmaster.pid 없음까지 확인했다. 데이터·로그·기존 다른 DB/원본은 보존했다.

[요약](final-verification.json)과 [원본·gzip SHA256/크기 목록](manifest.json)에 실제 결과를 기록한다. gzip은 로그/JSON/XML/시험 source 원본의 압축본이며 원본 byte와 압축 byte를 별도로 대조했다. 초기 실패·최종 결과를 섞지 않는다.

## 작성자 리뷰와 PR 게이트

소유자 선택을 cookie의 잠긴 session에 한정하는 기존 DB 경계, optional hint 검사의 transaction rollback, lease 소유권/폐기·single-flight·status/echo·null/과거 불변·취소/timeout/늦은 응답, 시험 bundle과 제품 산출물 분리를 검토했다. 발견한 늦은 응답 P2와 기존 API 날짜 계약 불일치는 재현 후 보완했고, 최종 diff의 이 좁은 범위에 미해결 P1/P2는 없다. 독립 외부 리뷰/임상 검토가 아니다. 기존 시작P2·최종 아바타·실측/출시·외부/운영 이월 문제는 이 PR로 해결하지 않는다.

기준 main/source 및 최신 원격 diff/충돌/체크/리뷰를 읽기 전용으로 재확인한 뒤, 기존 사전 승인 조건을 모두 충족할 때만 merge commit으로 병합한다. 이 문서 작성 시 원격 PR 게이트는 대기 중이며 병합 완료나 전체1~6 통과를 주장하지 않는다. 병합 결과는 해당 PR의 실제 merge SHA와 후속 기록으로 확인한다.
