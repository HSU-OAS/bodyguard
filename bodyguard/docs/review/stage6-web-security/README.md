# 현재 웹 계정·기록 보안 — 실제 작동과 검증 한계

[S6.2 명세](../../stories/stage6-web-security.md) · 최신 main2db3cee 기준 · 실제 Vite production build/설치된 Chrome154.0.8037.93·자체 loopback API(test 설정)·격리 PostgreSQL18.6. 공개 서버/운영 TLS/실제 공급자·사람/운동·독립 보안 감사가 아니다. 기존 화이트·블루 웹/UI/API·privacy/임계값은 변경하지 않았다.

## 확인한 화면·접근 제어

- 두 독립 cookie jar의 계정/기록에서 타인 상세는404이고 웹은 일반 복구 안내를 제공한다. 목록의 user_id query/X-User-ID로 소유권을 바꿀 수 없다. user_id 추가, 잘못된 motion_id, password 추가를 각각 요청하면 generic422이며 입력을 반사하지 않는다. 양쪽 본인 기록은 보존된다.
- 동일 계정의 별도 정상 로그인 세션에서 다른 세션 CSRF/삭제 확인값을 재사용하면403이다. 기록은 보존되고 실제 웹 로그아웃 뒤 이전 cookie 재전송은 me401/쓰기403이다. 또 다른 정상 세션은 계속 본인 기록을 볼 수 있다.
- raw HTTP는 본인 계정을200으로 읽지만 실제 Chrome의 다른 origin(localhost:8000) fetch는 읽기/사용자 지정 header POST 모두 CORS로 거부한다. OPTIONS405/no ACAO·native console CORS error2를 함께 확인했다. 잘못된/null/유사 origin, Referer만, 누락 CSRF 변경 요청은403이며 정상 계정은 보존한다. CORS를 HTTP 인증으로 표현하거나 same-site 시험을 cross-site SameSite/production Secure-cookie 검증으로 세지 않는다.
- 확인한 HTTP 응답의 no-store/nosniff/no-referrer, 실제 웹 camera/GLB·MediaPipe/외부 요청·pageerror·storage0을 확인했다. 기존 refusing proxy와 새 context의 같은 proxy를 재사용했다. 메일은 비공개 합성 IPC·기록은 client-reported 시험 요약이고 성공한 운동/올바른 자세가 아니다. 성공 mock·시간 제어·인증 우회·새 outbox endpoint가 없다.

실제 [본인 기록 보존 화면](security-20261005T115629037173Z/security-WEB-S01-타인-기록-차단·소유권-입력-거부·본인-웹-보존/security-own-record-preserved.png) · [타인 상세 복구 안내](security-20261005T115629037173Z/security-WEB-S01-타인-기록-차단·소유권-입력-거부·본인-웹-보존/security-foreign-record-blocked.png) · [다른 정상 세션 보존](security-20261005T115629037173Z/security-WEB-S02-다른-세션-CSRF·삭제-proof-거부·로그아웃-cookie-재전송-차단/security-other-session-preserved.png). 화면은 서비스 UI/합성 데이터만이며 카메라/사용자 신체 캡처가 아니다.

## 실패·회귀·증거 보존

1. [최초 suite 미등록](first-red.txt): argparse exit2, DB/HTTP/Chrome 미실행. [환경·타입·하네스 실패](setup-failures.md)는 기능 검증과 별도다. offline/frozen install은194개 cache 재사용/다운로드0이며 lock/버전은 그대로다.
2. 첫 실제 [security-115253](security-20261005T115253010912Z/report.json)은2통과/1실패·16.4초다. S02 로그아웃 화면 기대값과 방문 전 storage 하네스 오류를 원본으로 보존했다. 수정 뒤 [security-115432](security-20261005T115432073536Z/report.json)도2통과/1실패·10.4초로, 초기 about:blank의 mediaDevices instrument 오류를 보존했다. 이를 제품 결함/통과나 사용자가 실제 운동한 결과로 재분류하지 않았다.
3. 최종 [security-115629](security-20261005T115629037173Z/report.json)은3통과/실패·skip·flaky0·8.7초다. 실제 서비스 document의 secure context/mediaDevices와 새 context 초기 문서 경계를 확인하고 세 invalid 입력을 독립 검사했다. [최종 stdout](browser-accepted.stdout).
4. 실제 backend 전체291개·79.67초·failure/error/skip0·기존 asyncio DeprecationWarning1. [XML](backend-regression.xml). DOM327개·failure/error/skip0. [XML](frontend-regression.xml). 이들은 기존 회귀이며 새로291개 제품 기능을 만든 뜻이 아니다.
5. backend 회귀가 DB lock을 놓은 뒤 기존 [integration-120039](integration-20261005T120039494476Z/report.json)2통과·9.8초/실패·skip·flaky0을 실행했다. 실제 가입→탐색 준비→합성 기록→상세/삭제 취소·확정→계정/로그아웃과 계정 장애 route.abort/공개 안내 보존이다. 실제 코칭·운영 장애 시험으로 세지 않는다.
6. TypeScript/Biome92·backend Ruff/format32·mypy app8, 실제 production JS1의 DEV catalog/미연결 engine 문자열0·git diff check를 확인했다. mypy의 최초 잘못된 cwd exit2도 [실패 기록](setup-failures.md)에 남았다. .env/CI/기존 migration/의존성·app/src·아바타 source 변경0이다. 새3case/기존2case 이외 모든 과거 Chrome suite를 이번에 재실행한 것은 아니다.

각 실행의 raw 출력은 frontend/test-results/와 소유 private scratch에 보존한다. [수집기](collect-proof.mjs)는 현재 Story worktree의 bounded regular 출력만 복사하고 정확한 worktree 절대 경로를 <workspace>로 치환한 공개용 JSON/markdown/stdout을 만든다. Markdown의 행 끝 공백과 마지막 개행만 정규화한다. **수정 없는 원본과 구분한 사본**이며 원본 file SHA는 각 raw-files.sha256/stdout.raw.sha256에 보존한다. PNG·attachment 값/통계·실패 상태는 바꾸지 않는다. 기존 사본은 byte 비교만 하고 다르면 덮지 않는다. syntax/재실행의 보존을 실제 확인했다. [사본·source checksum](checksums.sha256).

## 작성자 리뷰

code-review 기준으로 test-only diff·실제 HTTP/SQL와 두 cookie jar·CSRF/proof/로그아웃·native CORS·합성/actual·egress/서버 소유권·인증값 비첨부·실패 보존·제품/API/임계값 변경0을 검토했다. 세 invalid field를 묶어 한 guard의 회귀를 가리는 P2를 독립 입력으로 보완하고 최종3흐름·회귀를 실제 재실행했다. scope 내 미해결P1/P2 없음. 작성자 리뷰이며 독립 외부/전문가 감사는 아니다.

Docker 엔진 read-only 재확인은 socket 부재로 실패했다. 기존 요청을 새 승인 대기로 중복하지 않고 Draft #29/컨테이너/NGINX/TLS·main 정합은 미완료로 유지한다. 운영 backup security replay/Q-17·실제 SMTP/Google/HTTPS·라이선스 최종artifact/고지·Q-26 법무·Stage2 외형/실측/통합·실제 코칭/기록 producer·확정 부가 기능·10명 사용자/체형/조명/노트북·성능/최종 통합·전체1~6단계는 그대로 미완료다. 최종 출시 후보판이나 전문가만 남은 상태를 선언하지 않는다.
