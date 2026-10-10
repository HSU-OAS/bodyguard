# S4.18 본인 일·주 기록 조회 API

2026-10-10 · [사전 명세](../../stories/dashboard-query-api.md) · 시작 main `2f191b87fb54778beddacf2fd17f3c1ae44b15a2` · 독립 하네스 PR115 병합 후 통합 main `c6760c1cba1540638016b7ed1b2fee8edd58bc5d`.

## 준비된 기능과 아직 없는 흐름

본인 쿠키 세션으로 `/api/v1/records/dashboard?date=YYYY-MM-DD&period=day|week&timezone=IANA`를 조회하면 하루/월요일 기준 한 주 전체의 저장된1분 요약과 수행 건수를 받는다. 첫20행이나 offset10000까지만 요약하지 않으며 모든 집계는 같은 단일 SQL snapshot이다. 날짜·시간대는 요청자가 명시한다. 기준선/버전/방법/단위별 시간 가중 평균·이탈 비율을 분리하고 없는 알림은null이다. 이는 client-reported 기록이지 의료적 정답/효과/점수 인증이 아니다.

현재 공개 웹의 화면·계정/기록 메뉴/대시보드 parser 연결은 바꾸지 않았다. 이 API를 사용하는 최종 대시보드 UI는 디자인 범위 승인과 실제 사용/성능 검증이 남아 있다. Draft PR51의 UI/Story/역사적 시작P2를 병합·완료 처리하거나 FR-R-03/전체4단계를 닫지 않는다. 실제 코칭→저장→새 대시보드까지의 연속 사용자 흐름은 아직 미완료다.

## 실제 검증과 실패 보존

| 실행 | 실제 결과 | 구분·한계 |
| --- | --- | --- |
| 시작 main의26 SQL/API RED | 26실패/통과0 | endpoint404. 최초 source/log/XML 보존 |
| 시작 main의 실제 HTTP RED | 1실패 | 첫GET404; 이후403/logout/revocation은 미실행 |
| 구현 후 SQL+HTTP | 27통과 | 자체 소유 PostgreSQL18.6, 합성 계정/요약·메일. 실제 loopback Uvicorn/httpx2 요청 |
| 전체backend | 536통과, warning2 | auth·복구·withdrawal·summary·baseline·record·ops 포함. 실제 DB/native HTTP와 synthetic provider 구분 |
| 최초 전체frontend | 1503통과/1실패 | 기존 DEV 프레임 test의 실제 시계 가정. 실패를 덮어쓰지 않음 |
| 별도 PR115 병합 뒤 API 작업트리 전체frontend | 1505통과, pending0 | 첫 실패의 원인·stale 반례·보완은 [독립 하네스 증거](../framing-harness-clock/README.md). 단순 재시작으로 닫지 않음 |
| backend Ruff/format/mypy app | 통과 | 51파일/12source. dependency/compiler 경고 숨김0 |
| 실제 OpenAPI/tsc/Biome/build/private guard | 통과 | type export9/type77추가만. 최종 Biome301파일, 기존 info15. 공개 JS의 private 후보 문자열0 |
| 실제 public JS/CSS | 2파일 byte 불변 | API 전 main-equivalent PR114와 API 빌드/PR115 통합 빌드 각각 대조 |

SQL 시험은 주10080행·타인/범위 밖 제외·반열림 시작 기준 수행 count·23/25시간 DST·자정 gap/skip·반복 지역 날짜를 대조한다. 기준선/단위/버전 분리·subnormal·weighted overflow·ratio precision-null도 확인했다. 실제 HTTP는 owner/read-CSRF 바인딩403·no-store/no-referrer·logout204 뒤 원래 쿠키의401을 확인했고 소유 thread/server를 종료했다. 실제 브라우저·공급자 메일·사람/노트북·SDK/아바타·운영/배포 검증으로 세지 않는다.

최초 sandbox offline 설치는 캐시 경로 권한으로 시작하지 못했고 승인된 offline 캐시 설치는194reused/download0·lock 변경0이었다. 최초 build는 새 작업트리에 model이 없어 기존 준비 스크립트의 Google DNS 제한으로 실패했고 guard도 dist/assets 부재로 실패했다. 두 원본 로그를 보존했다. 이전 검증 작업트리의 기존 public/models를 복사한 cached build와 이후 통합 build/guard는 각각 실제 통과했다. build의 WASM/model 파일 복사는 SDK 추론·촬영 시험이 아니다.

Uvicorn의 Python3.14 asyncio.iscoroutinefunction deprecation은 scoped1/전체2 warning으로 보존했다. 본 Story의 endpoint/형 검증 실패와 구분하며 경고를 삭제하지 않았다. 기존 byte 동일 uv.lock 환경을 읽기 전용으로 사용했고 `UV_NO_SYNC=1` 실제 OpenAPI export는 서버/DB/메일 없이 실행됐다. `.env`/CI/migration/의존성/개인정보 정책을 바꾸지 않았다.

## 실행 입력과 격리 자원

`node bodyguard/docs/review/dashboard-query-api/collect.mjs --check`는 [manifest.json](manifest.json)의57 압축/원본 SHA·source16·불변 제품/시험/설정215를 확인한다. 재시험이 아니다. Draft51 `bc7b29a793079cfb7feb5ca1998fc484876859e3`의 서버/SQL 시험2파일은 byte 그대로 재사용했고 latest main에3줄 등록과 추가 실제 HTTP 시험을 붙였다. UI/parser/메뉴는 가져오지 않았다.

red-source7개는 최초 SQL RED 전 입력이고 실제 HTTP 추가1개는 그 HTTP RED 전 입력이다. final-source의backend9개는 최종 scoped27 실행 전, frontend6개는 OpenAPI 생성 뒤 최초 전체frontend 실행 전이다. integrated-framing-test는 PR115 병합 뒤 최종 전체frontend 전 입력이다. collector는 최초 검증 **뒤** 작성됐으며 당시 runtime 도구라고 하지 않는다.16개가 전체 검증의 모든 파일이라는 주장도 하지 않는다.

이번 DB는 `/private/tmp/bodyguard-auth-test.j5fiAC`, UID501/data·socket0700/역할·DB bodyguard_test/TCP비활성이다. 전체 검증 종료 후 실제 data_directory·current_user/database·빈 listen_addresses와 PID68304/UID501/명령을 조회한 뒤 해당 DB만 정상 중단했다. 이후 pg_ctl status는 no server running(exit3)이었다. data/실패 원본은 보존했다. owned-stop.log는 중단 출력이며 소유 확인 query stdout의 파일이라고 하지 않는다. PG 데이터·메일/token/cookie IPC·영상/실제 좌표는 증거 archive에 넣지 않았다.

## 작성자 scoped 리뷰와 남은 의존성

engineering:testing-strategy로 owner/date/snapshot·값/출처의 계약을 우선 검증하고 engineering:code-review로 source/diff·실패/실제 입력·증거를 검토했다. 외부/다중 에이전트/전문가 리뷰는 아니다.

- owner는 기존 authenticate/bind_read를 재사용하고 user 선택 query가 없다. 폐기/CSRF/기대 계정 불일치 경계를 실제 HTTP로 대조했다. 인증 이후 bound SQL parameter를 사용하며 IANA lookup은 로컬이고 원격 URL 조회가 아니다.
- day/week는 달력 기준이며 DST를24시간으로 자르지 않는다. 반복 날짜는 enclosing UTC+SQL local-date filter로 해당 날짜만 포함한다. 한 snapshot·하나의 기간 쿼리로 pagination truncation/N+1/앱 raw-row 전송을 피한다. 실제 다양한 계정 크기의 노트북/운영 DB latency는 아직 측정하지 않았다.
- method/version/unit/baseline은 다른 partition이며 없는 metric/alarm을 꾸미지 않는다. accepted numeric domain의 극값 mean을 SQL numeric으로 가중하고 representability 한계 ratio는null을 유지한다. 새로운 점수/효과/측정 기준/retention/schema 저장은 없다.
- production 공개 JS/CSS 불변·기존 frontend/backend/시험215 SHA를 확인했다. 하네스 새clock 보완은 이 PR이 아니라 이미 병합한 PR115다. scoped 미해결 P1/P2는 없고 원격 최신 diff/HEAD/main/CLEAN/체크를 병합 직전에 다시 확인한다.

전체1~6·출시 후보판·미승인 UI/SDK 정책·출시 적격 동작0·실측/참여자·시작P2·권리/법무·외부 공급자/Docker/HTTPS/안전한 백업·복구·Q13/27/32는 미완료다. 아바타 보류와 기존 원본/실패 보존을 유지하며 새 avatar/GLB/변형/브라우저 외형 검증0이다. 중요 범위·안전·개인정보·비용/계정/시크릿·운영 migration/배포/출시는 별도 승인이다.
