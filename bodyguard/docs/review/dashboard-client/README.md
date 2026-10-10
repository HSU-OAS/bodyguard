# S4.19 본인 일·주 조회 웹 클라이언트

2026-10-10 · [사전 명세](../../stories/dashboard-client.md) · 시작 main517cc970(PR116 실제 병합) · codex/dashboard-client.

## 작동하는 기능·아직 연결하지 않은 화면

명시한 날짜·일/주·IANA 시간대로 본인 저장 기록 전체를 받아 exact DTO·기간/가중/기준선/버전/방법/단위·null·client-reported 출처를 검증한다. 없는 알림을0으로 꾸미지 않는다. 조회 시작의 ready 객체와 owner ID를 고정해 로그아웃·객체 교체·같은 객체의 ID 변경·늦은 응답을 폐기한다. 기존 no-store/same-origin/CSRF·전체15초 제한을 유지한다. 날짜/브라우저 timezone을 자동 기본값으로 확정하지 않는다(Q18 미정).

새 대시보드 메뉴/차트/공개 연결은 하지 않았다. 공개 웹에 이 reader를 import하지 않으며 JS/CSS2파일은 main-equivalent 이전 빌드와 실제 byte 동일하다. 실제 브라우저 시험은 변경하지 않은 /start 페이지에 별도 scratch compiled probe를 시험에서만 연결한다. 이는 완성된 공개 대시보드 사용자 흐름, 실제 자세/효과 판정 또는 전문가 검토가 아니다. Draft51/FR-R-03 전체·4단계/1~6은 미완료다.

## 실제 결과와 반례

| 실행 | 결과 | 구분 |
| --- | --- | --- |
| client 없는 main | collection1실패/실행0 | 50개가 실패한 것이 아님. 실행 전 test 입력 보존 |
| Draft51 원본 client·기존44+추가6 unit | 44통과/6실패 | 필수 query4·동일 객체 owner 변경2. mock fetch·합성 DTO |
| 최초 실제 Chrome의 옛 Cookie 경로 | 1통과 | 예상 RED가 아니었다. 원본 보존·경로 도달 추가 확인2통과 |
| 현재 세션 CSRF 전달 제어 반례 | 1실패 | 실제 logout/signup/verify/SQL·같은 ready ID 변경 뒤, 실제 새 세션 CSRF 응답을 하네스가 전달하면 옛 reader가 새 계정의1분을200으로 반환 |
| 수정 후 unit/전체frontend | 50/1555통과, pending0 | 마지막 전체도1555통과. legacy mock 수학/아바타 시험을 새 에셋 검증으로 세지 않음 |
| 실제 Chrome 전체5·import 정리 후 최종5 | 각각5통과/실패0/retry0 | 본인 일2분/주3분·타인 제외·실제 logout/계정 교체 뒤 late 응답401·revocation401·변조 DTO503·같은 객체 변경401 |
| 기존 dashboard SQL/HTTP | 27통과/warning1 | 실제 PostgreSQL18.6/loopback API·합성 계정/요약. 전체backend536 재시험이라고 하지 않음 |
| tsc/Biome306·Ruff/format41/mypy app12·build/guard | 최종 통과 | 기존 Biome info15·Python3.14 deprecation1 유지 |

W04의 server-verified 출처는 실제200의 응답을 시험이 주입한 오류다. W05의 현재 CSRF 전달/ready ID 변경도 명시적 시험 제어이며 자연 발생 경합·서버 취약점·실제 AuthProvider 전체 통합으로 표시하지 않는다. 원래 Cookie snapshot을 route.fetch로 전송한 첫 두 실행은 서버 보호로401이었다. 처음 통과한 결과도 숨기지 않았고, 그 결과를 client 수정의 RED로 주장하지 않는다.

잘못된 frontend cwd의 Python runner는 실행 전 ModuleNotFoundError였고 올바른 backend cwd의 반례를 별도로 실행했다. 첫 Biome는 private fixture import 순서1오류였으며 해당 파일만 정리했다. 첫 guard 명령은 없는 script 경로로 미실행됐으며 기존 실제 check-selection-production.mjs는 최종 통과했다. 원본 로그/실행 입력과 성공 결과를 모두 별도로 보존했다. 잘못된 복사 경로 명령의 기록도 tool history에 남고 필요한 원본 report는 정확한 경로에서 보존했다.

## 증거와 소유 자원

`node bodyguard/docs/review/dashboard-client/collect.mjs --check`는 manifest의 원본/압축 SHA·최종 입력11+collector1·main 불변 파일·public JS/CSS를 확인한다. 재시험이 아니다. 처음 client는 bc7b29a793079cfb7feb5ca1998fc484876859e3의 byte 그대로다. 처음 test는 기존44에 실행 전6을 추가한 파일이다. absence/ported/native 입력·각 단계 compiled probe·최종 import 정리 전후 입력을 구분해 보존한다. collector는 최초 실행 뒤 작성했고 runtime 검사에 쓰였다고 하지 않는다. archive에는 copied model/WASM 전체가 아니라 실제 private probe.js만 넣는다.

브라우저는 실제 설치 Chrome155.0.8059.40·운영 빌드·소유 loopback FastAPI/새 격리 SQL이며 synthetic 계정/메일·저장 요약이다. 최종5 각각 webpage camera/pageerror/external 요청0·local/sessionStorage0이다. closed-port proxy·localhost bypass·strictPort/reuseExistingServer:false를 유지한다. 카메라/SDK/GLB/WebGL/조형 검증0이며 모델 준비 파일 복사를 추론 실행으로 세지 않는다. 실제 사용자/메일 공급자·HTTPS/운영/배포도 시험하지 않았다.

임시 DB /private/tmp/bodyguard-auth-test.PMReFg는 이번 Story가 생성했고 UID501/data·socket0700·bodyguard_test 역할/DB·TCP비활성을 실제 확인했다. postmaster.pid의83173과 실제 SQL data_directory를 확인한 뒤 해당 DB만 정상 중단했고 status는 no server running(exit3)이었다. 추가 ps 조회는 sandbox 거부로 미실행됐으며 OS PID/UID 실측 성공이라고 하지 않는다. 데이터/실패는 보존했다. 운영 DB·메일/cookie/token IPC·영상/실제 좌표는 archive에 넣지 않았다.

## 작성자 scoped 리뷰

engineering:testing-strategy로 request/DTO/owner 경계를 먼저 시험하고 engineering:code-review로 변경 source/diff·입력/최초 실패·실제 wire/제어 주입·공개 불변 증거를 검토했다. 작성자 리뷰이며 외부/다중 에이전트/전문가 리뷰0이다.

- query를 동기적으로 복사/검증/동결하고 최초 owner string을 고정한다. 매 await 뒤 ready 객체/원래 ID/취소를 확인하며 me→csrf→me→bound GET→final me로 늦은 결과를 반환하지 않는다. user 선택 query·credential storage/새 session 정책이 없다.
- 달력은 월요일 기준 주·IANA/DST skip/gap/repeat를 유지한다. unknown/duplicate/missing·invalidday/offset을 거부하고 DTO는 exact field·기간/유한값/합계·partition/null 검증 뒤 동결한다. 진단/점수/기준 각도/알림 보관 정책을 추가하지 않았다.
- 기존 frontend 화면/CSS/generated DTO·backend app/schema/migrations/lock/CI는 불변이다. frontend private fixture/config와 backend runner의 dashboardclient3등록만 시험 경로를 추가한다. runtime/public route·CSP/SDK 통신을 완화하지 않는다.
- scoped 미해결 P1/P2는 없다. 최신 원격 diff/정확한 HEAD/main/CLEAN/체크를 병합 직전에 다시 확인한다. checks가 없으면 없음으로 기록한다.

아바타 보류·기존 원본/실패·출시 동작0/실측/참여자·시작P2·승인 UI/SDK·권리/법무·외부 공급자/Docker/HTTPS·안전한 backup/restore·Q13/27/32·전체1~6 기준은 유지한다. 중요 범위/안전/개인정보·비용/계정/시크릿·운영 migration/배포/출시는 별도 승인이다.
