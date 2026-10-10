# S5.1 — 배포 전 서버 생존·준비 상태

로컬 구현·검증 완료/PR #28 main 병합(mergecbfd07f) · 시작 main34e433024bf8ceab059bb2071d440c4465aee37a · codex/stage5-runtime-readiness · 출시 계약5단계/NFR-08/FR-U-04·FR-R-03

## 범위·의존성

S4.7 공개 안내 웹 PR #27의 merge commit/main 포함과 브랜치 보존을 실제 확인했다. 독립적으로 가능한5단계 구현을 시작한다. 현재 서버에는 생존/DB 준비 점검 경로가 없고, 기존 로컬 compose는 trust 인증의 시험 DB뿐이다. 운영 전용 구성으로 승격하지 않는다.

CTO 권장안: 읽기 전용 GET /api/v1/health/live와 /api/v1/health/ready를 별도로 둔다. live는 프로세스 응답만, ready는 현재 API의 DB 접속·지원 버전·예상 스키마 준비만 판단한다. ready200이 코칭·아바타·실측·메일/Google·HTTPS·법무·백업·전문가 승인·출시 가능을 뜻하지 않도록 계약/운영 안내에 적는다. DB 장애에 live까지 실패시켜 무한 재시작하는 정책을 만들지 않는다.

새 화면/분석 서비스/운영 계정/키/자동 migration/실제 공급자 요청/사용자 데이터 수집/로그는 없다. 기존 인증·CSRF·삭제·메일 계약은 유지한다. 운영 DB migration·배포·시크릿·비용·계정·실제 probe 운영 연결은 별도 승인이다. 이2개 점검 경로와 검증은 전체5단계 완료가 아니다.

## 명세·수용 기준

1. live는 인증 없이200 {status: alive}, DB/사용자/메일 조회·새 쿠키·쓰기0, no-store/no-referrer 기존 경계 유지다. DB 연결 불가여도 live는 응답한다.
2. ready는 기대한 PostgreSQL 버전·현재 migration/schema가 준비됐을 때만200 {status: ready}. DB 접속 실패·버전/스키마 불일치·권한 실패는503 {status: unavailable}. 사유·SQL·경로·버전·계정·키·이메일·토큰을 응답/로그에 담지 않는다.
3. GET만 운영 점검으로 쓴다. 새 쿠키·인증 상태/시도 카운터 변경·cleanup·사용자 행 조회·자동 migration·메일/외부 호출0. 인증된 클라이언트의 호출도 해당 계정 활동 시각을 갱신하지 않는다.
4. 접속/SQL/잠금/동시 probe 자원을 한정하고 무제한 DB 대기나 인증용 자원 소진을 피한다. 구현 선택·제한값·격리 실험은 Story에 기록한다. 정상 한 번의 SELECT1만으로 스키마 준비를 통과시키지 않는다.
5. typed OpenAPI는 실제 코드에서 생성하고 기존 프런트 API 계약의 회귀를 확인한다. 준비 상태의 세부 실패 이유를 공개 schema에 추가하지 않는다.

## 하네스 순서

engineering testing-strategy에 따라 핵심 실패 경계를 먼저 정하고 통합/계약·소수 실제 HTTP 시험을 구분한다.

- 최초 red: 소유한 격리 실제 PostgreSQL과 기존 FastAPI에서 live/ready 경로를 호출해 필요한 응답이 없는404를 보존한다. 문서나 대체 handler만으로 성공시키지 않는다.
- 이후 구현과 같이 확장: 실제 DB 정상/읽기 전용·계정/세션 불변, DB 미접속/실제 스키마 불일치/잠금·타임아웃/동시 probe, live의 DB 독립·고정 응답/쿠키·로그 비노출, 자동 migration0.
- 현재 schemas와 맞지 않는 DB 상태는 시험 소유 DB에만 만들고 반드시 복구한다. 외부/운영 DB·다른 과정의 서버를 종료하거나 초기화하지 않는다. fault injection과 실제 SQL·네트워크 검증을 구분하고 장애 결과를 보존한다.
- 최종 전체 API/SQL·DOM·타입 생성/production·정적 검사/관련 HTTP 회귀·diff/HEAD/main/CLEAN/체크·범위 내 미해결P1/P2 조건으로 PR을 진행한다. 실제 운영/배포 검증·전문가 승인으로 세지 않는다.

## 남은 전체 단계 게이트

5단계에는 배포 패키지·역방향 프록시/HTTPS·실제 SMTP/Google·라이선스·백업/복구·운영 관측과 승인된 실제 환경 검증이 여전히 필요하다.6단계 실제 참여자/노트북/촬영 검증,2단계 이월, 실제 코칭/기록 생산, 미정 부가 기능·법무/사업 결정도 남는다. 외부 승인 대기 중 가능한 독립 구현을 계속하고 최종 통합에서 필수 게이트를 닫는다.

## 최초 실제 red

기존 create_app과 소유한 실제 PostgreSQL에서 live·ready2건 모두404로 실패했다(0.42초). [원본/진행 증거](../review/stage5-readiness/README.md)를 보존했다. 이어 계정 불변과 실제 revision/열 불일치까지 확장한5건도404로 실패했다(0.815초). 당시 endpoint 미구현 상태의 실제 red이며 아래 최종 결과와 구분한다.

## 구현·기술 결정

FastAPI의 GET2개와 고정 필수 status 타입만 추가했다. live는 DB 독립이다. ready는 인증 engine의 dialect/URL을 사용하되 pool에 접속하지 않고 기존 native psycopg의 별도 async 연결을 생성/종료한다. 사용자 행을 읽지 않는 false 조건으로 현재 metadata의8개 테이블/모든 열을 확인하고,0005 revision·PostgreSQL18 primary·API 역할의 읽기/쓰기 권한을 확인한다. 자동 migration·새 의존성·환경 변수·운영 연결은 없다.

CTO 기술 기본값은 접속2초(대상별), 작업 취소 deadline3초, SQL1초·잠금250ms·idle transaction1초, process별 동시1개/큐0이다. 기존 search_path/PGOPTIONS를 보존하고 읽기 전용/한계 설정은 마지막에 적용한다.3초 deadline 뒤 native 취소/정리 시간이 있을 수 있으므로3초 HTTP SLA로 설명하지 않는다. 고정 psycopg3.3.6의 취소/결과 대기 각각5초를 확인했고 구형 libpq17 미만의 blocking 취소는 ready503으로 막았다. 실제 libpq18.6/SQL 설정·오류/복구·연결/동시 요청을 검증했다. 실패 상세는 앱 로그/응답에서 숨기며 no-store/no-referrer를 유지한다.

## 완료 근거·한계

최종 실제 API/SQL261건(신규19 포함)·DOM327건/27파일·정적 검사·production 빌드와 개발 후보/미연결 코칭 코드 제외를 통과했다. production 설정의 실제 소유 loopback HTTP 서버에서 정상→DB revision 장애503/live200→복구와 공개 docs 비노출을 확인했다. 실제 HTTPS/운영 배포나 SMTP 호출이 아니다. 접속·SQL·잠금·권한은 실제이며 unsupported 버전/client·deadline 경계는 명시한 fault injection이다. 계정/세션/카운터/기록 전체 행 지문과 메일 수를 비교해 GET 부작용 없음을 확인했다.

OpenAPI의 기본 status가 처음 선택 필드로 생성된 리뷰 문제를 필수 literal로 수정했다. 취소 한계 없는 구형 client도 거부했다. 생성 타입2회 동일 hash·TypeScript/Biome, Ruff/format28파일·mypy8소스 확인. 마지막 API에는 기존 asyncio 의존성 경고1건이 있고 중간 실행의 Pydantic 경고도 원본으로 남긴다. [전체 실패/실행·작성자 코드 리뷰](../review/stage5-readiness/README.md). 현재 변경 범위의 미해결P1/P2 없음이며 아직 PR 게이트·전체5단계/1~6단계 완료는 아니다.

파일: backend/app/readiness.py·main.py, backend/tests/test_readiness.py, 실제 생성 frontend/src/api/generated/{index.ts,types.gen.ts}, backend/README.md, 이 Story·tasks·이전 Story 병합 기록·review/stage5-readiness 증거. next는 배포 패키지/프록시·운영 준비의 독립 구현이며 실제 적용/비용/계정/시크릿/운영 DB/배포 승인은 별도다.

## 실제 병합·다음 Story

PR #28은2026-10-05T08:41:25Z에 mergecbfd07ff944c94de12674bd982bfe98f075616f0로 main 병합했다. 최종 소스 ceb4c34bc8916412eaf797dff646ef33fb617411·main34e4330·실제 diff21파일·CLEAN/MERGEABLE·체크 없음·외부 리뷰0·로컬 clean/필수 검증·범위 내 미해결P1/P2 없음과 브랜치 보존 설정을 다시 확인하고 exact HEAD/merge commit을 사용했다. main 포함·원격 소스 브랜치 유지 확인. 다음은 최신 main의 새 codex/stage5-web-runtime-package에서 [S5.2 로컬 배포 패키지](stage5-web-runtime-package.md)다. 전체5단계/운영·배포 완료는 아니다.
