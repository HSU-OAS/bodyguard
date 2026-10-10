# BODYGUARD 계정·기록 API

S2.1 + S2.6a1/b1, FR-U-01~05·NFR-08. 이메일 확인/구글 계정, 서버 쿠키·CSRF, 본인 조회·로그아웃·비밀번호 복구와 아래 본인 수행 기록 API다. [복구 웹 화면](../docs/stories/stage2-password-recovery-web.md)은 PR #11 병합. [구글 API·로컬 보안 시험](../docs/stories/stage2-google-auth-api.md)은 실제 공급자 연결과 구분한다. 본인 탈퇴 API는 PR #25 병합됐고 [계정·탈퇴 웹](../docs/stories/stage4-account-withdrawal-web.md)은 별도로 검증한다. 실제 Google/Gmail·코칭 기록 생산·운영 적용/배포는 미완료다.

## 서버 점검 — S5.1 / S5.6

인증 없는 `GET /api/v1/health/live`는200 `{status: alive}`이며 DB를 사용하지 않는다. `GET /api/v1/health/ready`는 PostgreSQL18 primary·현재0008 revision·필수 테이블/열·API 역할의 SELECT/INSERT/UPDATE/DELETE 권한·metadata의 필수 소유/삭제 FK 9개를 읽기만 하여 확인하고200 `{status: ready}` 또는503 `{status: unavailable}`만 반환한다. FK 이름이 아니라 앱과 같은 search_path의 relation·컬럼 순서·삭제/갱신·MATCH·지연 속성·validated/enforced·활성 trigger를 확인하며 FK를 우회하는 replica 연결은 준비 실패다. 별도 DB 연결이며 인증 pool·쿠키·세션 활동·cleanup·회원/기록 행 조회·쓰기·메일·자동 migration은 없다. 기존 no-store/no-referrer를 적용하고 SQL/DB 주소/오류 원문을 앱 로그에 내보내지 않는다.

process별 점검1개·대기열0, 접속 timeout2초(대상별), 전체 작업 취소 deadline3초, SQL1초·잠금250ms·읽기 전용을 접속 때 적용한다. 기존 URL/PGOPTIONS의 search_path 등은 보존하되 이 한계는 뒤에서 강제한다.3초는 무조건 그 시각까지 HTTP 응답한다는 보장이 아니다. native psycopg 취소/정리가 추가로 걸릴 수 있으며 현재 고정3.3.6 소스의 취소/결과 대기는 각각5초 한계다. 무한 대기로 떨어지는 libpq17 미만은 ready503으로 거부한다. 이번 실제 client는 libpq18.6이다. 동시에 점검하면 busy도503이므로 운영 probe는 단일 worker별로 겹치지 않도록 구성/검증해야 한다.

ready200은 **API의 제한된 DB 준비만** 뜻한다. 모든 제약/인덱스/보안 설정 감사, 실제 SMTP/Google·HTTPS·백업·코칭/아바타/실측·법무·전문가 승인이나 출시 가능을 보증하지 않는다. DB 장애 때 live를 재시작 기준으로 실패시키지 않는다. 실제 운영 점검 연결·프록시·DB migration·시크릿·배포는 별도 승인이다. [Story와 실제 SQL/loopback HTTP·주입 구분](../docs/stories/stage5-runtime-readiness.md).

[S5.6 제약 손상·복원 증거](../docs/review/readiness-owned-constraints/README.md)는 새 소유 PostgreSQL 18의 실제 FK 결함과 loopback HTTP 검증이다. 실제 브라우저·공급자·HTTPS·운영 DB 검증이나 백업 복원 후 삭제 데이터/세션 재등장 방지의 완료 증거가 아니다.

## 본인 탈퇴 — S4.5/6

`POST /api/v1/me/delete/start`는 엄격한 빈 body로 현재 검증된 이메일에 전용 코드를 보낸다(202/43자 challenge). `POST /api/v1/me/delete/confirm`은 challenge·6ASCII 코드·`confirmation: delete-my-account`를 검사하고 본인 계정/현재 구현된 수행 기록·모든 세션 등을 한 transaction에서 삭제한다. 실제 commit 뒤204/쿠키 제거다. 본인 재확인 실패·잠금 충돌/DB 실패는 부분 삭제하지 않는다. 10분·5회 오답·기존 메일 요청 제한을 유지하며 새 요청은 이전 확인을 대체한다. [전체 API 명세·SQL 경쟁/rollback 증거](../docs/stories/stage4-account-withdrawal-api.md).

웹 하네스 `uv run python -m tests.run_browser withdrawal`은 소유한 합성 PostgreSQL/계정·기록과 실제 production Chrome을 쓰고, 메일/10분 경과만 비공개 시험 IPC로 재현한다. 실제 SMTP나 실제 기다린10분으로 표시하지 않는다. 운영 DB의0005 migration·실제 사용자 탈퇴·백업 보관/복구·법무 정책은 별도 승인/최종 게이트이며 이 로컬 구현만으로 전체 데이터 관리가 완성된 것은 아니다.

## 스트레칭 수행 요약 — S4.1

로그인한 본인의 `/api/v1/records/stretch` POST 저장·GET 기간 목록과 `/{record_id}` GET 상세를 제공한다. 소유자는 쿠키 세션으로만 결정하고 쓰기는 Origin/CSRF를 검사한다. 원본 영상·관절 좌표·효과 점수는 받지 않는다. 반환의 `provenance: client-reported`는 수행 흐름 요약이며 올바른 자세·의학 효과 인증이 아니다.

같은 본인 ID/내용 재전송은 200, 최초 저장은 201, 내용 충돌은 409다. 타인 상세와 없는 상세는 같은 404다. 목록은 기본 20/최대 100, offset 최대 10000이며 종료 시각/ID 최신 순서다. start 포함/end 제외의 aware timestamp 기간을 지원한다. 페이지 snapshot은 보장하지 않으므로 화면은 조회 기간을 고정해야 한다.

새 `0004_stretch_records`는 계정 삭제에 연계 삭제되며 기록이 남은 downgrade를 거부한다. 운영 적용·rollback은 별도 승인이다. 실제 기록 화면·코칭 연동·기간 삭제·계정 삭제는 후속 Story이고 이번 API 구현만으로 전체 기록 서비스 완료를 뜻하지 않는다. 실제 검증과 실패/보완 이력은 [S4.1](../docs/stories/stage4-records-api.md)을 따른다.

## 로컬 실행

### 본인 기준선 — S4.13

`POST /api/v1/baselines`는 ID·client_version·neck/shoulder/trunk의 method/unit/value만 받는다. 어깨는 필수이며 관찰하지 못한 목/상체는 null이다. UUID를 소문자로 통일하고 엄격한 ASCII64 태그·유한 숫자 기술 범위를 검사한다. 태그와 값은 client-reported이며 계산법 채택/정자세·효과 검증이 아니다. 영상·좌표·샘플 목록·계정ID는 받지 않는다.

신규201/동일 재전송200/내용 충돌409. 새 ID로 교체하면 이전 행은 비활성 이력으로 남고, 옛 ID 재전송은 현재 기준선을 바꾸지 않는다. `GET /baselines/active`는 본인 활성 또는 null, `GET /baselines/{id}`는 본인 이력만 조회한다. 타인/없는 ID는 같은404이고 응답에 user_id/email이 없다. 인증/Origin/CSRF·no-store·민감값 없는 고정 오류를 유지한다.

동시 교체는 owner transaction advisory 잠금과 부분 unique로 직렬화한다. reset/FK 대기는 users KEY SHARE 뒤 인증을 다시 확인하고 세션 활동을 갱신한다. 잠금 충돌은2초 timeout 뒤503·전체 rollback이다. 새0007 migration은 계정 탈퇴에 연계 삭제되고, 저장된 기준선이 있는 downgrade는 잠금/검사 후 거부한다. **운영 적용/rollback은 별도 승인**이며 이번 실행은 소유한 격리 테스트 DB뿐이다. 실제 카메라 보정·웹 화면·1분 요약 연결은 후속 구현이다. [명세](../docs/stories/account-baselines-api.md)·[실행 증거/한계](../docs/review/account-baselines/README.md).

### 본인 1분 집계 — S4.14

`POST /api/v1/summaries/batch`는 엄격한 `{items:[...]}` 1~60개, UTC 분·기준선/버전·관찰 시간과 지표별 방법/단위/평균/측정/이탈 시간만 받는다. 계정은 세션에서만 결정한다. 지표별 분모와 null을 보존하고 시간 합/union의 논리 정합성을 검사한다. 영상·관절·샘플·기본 정자세·임상 점수를 받거나 생성하지 않는다. 값은 `client-reported`이며 올바른 자세 인증이 아니다.

새 분이 있으면201, 모두 같은 내용의 재전송은200, 같은 본인/UTC 분의 다른 내용은409·batch 전체 rollback이다. 본인의 역사적 기준선과 측정된 방법/단위/버전이 일치해야 하며 타인/없는 기준선은 같은422다. `GET /summaries`는 본인 UTC 분 내림차순·start 포함/end 제외, limit20/최대100·offset최대10000의 `{items,has_more}`를 반환한다. 평균을 다른 기준선/방법과 임의 합치지 않는다.

`POST /summaries/delete-preview`와 `/delete`는 해당 분 기간만 별도 서명 도메인·`confirmation: delete-minute-summaries`·10분 TTL로 삭제한다. 기존 스트레칭 삭제 증명과 교환할 수 없다. 변경된 대상은409·삭제0, cutoff 후 행은 보존, 이미 삭제된 재시도는0이다. Origin/CSRF·owner 잠금·대기 후 세션 재확인·고정 오류·탈퇴 CASCADE를 유지한다. 새0008 migration은 데이터가 있으면 downgrade를 거부한다. **운영 migration/복구는 별도 승인**이다.

같은 분의 재보정·재시작·다중 탭은 충돌할 수 있다. 후속 공개 producer는 분 경계 handoff와409 종결/재확인 정책을 구현해야 하며 덮어쓰기·임의 합산·무한 재시도는 하지 않는다. 현재 API는 아직 공개 측정/대시보드에 연결하지 않는다. [명세와 실행 구분](../docs/stories/minute-summaries-api.md).

### 스트레칭 기간 삭제 API — S4.3

본인 `POST /api/v1/records/stretch/delete-preview`에 aware start/end 기간을 보내면 삭제 수·cutoff·지문·10분 만료·세션에 묶인 서명을 반환한다. `POST /api/v1/records/stretch/delete`는 이 확인값 전체와 `confirmation: delete-stretch-records`를 요구한다. 둘 다 기존 Origin/CSRF와 인증을 검사한다. 미리보기는 삭제하지 않으며, 대상이 바뀌면409로 재확인을 요구한다. 이미 삭제된 대상의 재전송은 삭제0이다. cutoff 뒤 저장된 기록은 보존한다. 별도 키·DB migration·원시 정보 저장은 없다. [명세·실제 검증](../docs/stories/stage4-record-deletion-api.md). 삭제 화면·계정 탈퇴·운영 적용은 아직 완료되지 않았다.

Python 3.14, uv, PostgreSQL 18이 필요하다. bodyguard/에서 docker compose up -d db를 실행하면 loopback 55439의 **로컬 전용** DB가 생긴다. trust 인증·테스트 역할을 운영에 사용하지 않는다. 기존 DB를 쓰지 말고 새 로컬 DB에만 아래 migration을 적용한다.

backend/에서 uv sync --locked를 실행한다. .env.example의 변수 이름을 참고해 프로세스 환경을 설정한다. 앱은 .env를 자동으로 읽지 않는다. BODYGUARD_SECURITY_KEY는 32바이트 이상의 난수(hex 64자 등), 실제 메일 자격증명은 별도 승인 후 공급한다. 샘플 키·메일 성공 폴백은 없다.

```bash
uv run alembic upgrade head
uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-proxy-headers --no-access-log
```

BODYGUARD_ENVIRONMENT=development는 localhost/loopback Origin에만 허용한다. 기본 production은 HTTPS Origin·보안 키·메일 설정이 없으면 기동을 거부한다. production에는 HttpOnly/Secure/SameSite=Lax, __Host- 접두사·Path=/·Domain 없는 쿠키를 쓴다. development의 HTTP 예외를 운영으로 승격하지 않는다.

프록시 헤더는 앱에서 신뢰하지 않고 위 명령은 Uvicorn의 자동 프록시 해석도 끈다. 역방향 프록시 운영 시 신뢰할 프록시·실제 IP 경계는 배포 Story에서 별도 검증한다. 접근 로그를 꺼 인증 입력이 URL에 붙더라도 로그에 반사하지 않는다. 암호·코드·세션·시크릿을 URL로 보내면 안 된다.

## 계약

GET /api/v1/auth/csrf → 메모리용 CSRF, 쿠키. 모든 POST는 정확한 BODYGUARD_ORIGIN의 Origin과 X-CSRF-Token을 요구한다. 토큰을 localStorage에 보관하지 않는다. 로그인/인증에서 쿠키·CSRF 모두 교체한다. 인증 세션 idle은 본인 조회 활동 기준 30분, absolute 8시간이며 익명은 10분이다.

POST auth/signup(email,password)은 202·challenge_id, auth/verify(challenge_id,code)는 201·id/email/새 CSRF, auth/resend는 202(본문 없음), auth/login은 200·id/email/새 CSRF다. GET me는 쿠키의 본인만 200·id/email을 반환한다. POST auth/logout은 서버 폐기와 쿠키 삭제로 204. 만료/없는 세션 로그아웃은 정확한 Origin만으로 잔여 쿠키를 지운다.

이메일은 바깥 공백·대소문자만 정규화한다. Gmail 점·+를 제거하지 않는다. 비밀번호는 15~128자·Unicode/공백 허용, Argon2id. 가입 요청의 비밀번호 해시를 해당 challenge에 묶어 선등록 탈취·덮어쓰기를 막는다. 코드 6자리·10분·오답 5회·재발송 60초; 만료되면 가입을 다시 시작한다.

코드는 challenge별 HMAC, 세션은 SHA-256 해시만 DB에 저장한다. CSRF는 보안 키·쿠키 난수의 HMAC이며 DB의 유효 세션과 함께 검사한다. 이메일/IP 제한은 HMAC 키를 쓰는 DB 공유 카운터라 재기동·동시 요청으로 초기화되지 않는다. 가입+재발송 5/email·20/IP/시간, 로그인 실패 10/email·30/IP/15분. 429의 Retry-After는 초 단위다.

메일 실패는 503이며 이전 코드를 복구하지 않는다. 실패한 발송도 요청 제한을 소비한다. 요청 안에서 SMTP TLS(465, timeout 10초)의 성공/실패를 확인한다. 기존 design §13.2의 백그라운드 발송 대신 성공을 허위 반환하지 않는 최소 동기 전달을 선택했다. 처리량이 필요해지면 별도 전달 상태·내구성 outbox를 검증하고 교체한다. 네트워크 timeout의 실제 수신 여부까지 보장하지는 않는다.

GET csrf 때 만료된 challenge·absolute 세션·카운터를 정리한다. 사용자·기록 보관 정책은 이 코드가 결정하지 않는다. 서버 시작 때 migration을 자동 실행하지 않는다.

### 비밀번호 복구

POST `auth/password/forgot`의 email은 기존 이메일 정규화를 따른다. 등록/미등록 주소의 상태·본문은 같은 202이며 **요청 접수이지 메일 도착 확인이 아니다**. 등록된 이메일에만 응답 이후 native background 전달을 한다. SMTP가 설정되지 않으면 모든 주소에 동일 503이다. 전달 실패는 민감값 없는 고정 로그와 해당 토큰 폐기로 처리한다. 프로세스 종료 시 작업 유실 가능성이 있어 사용자는 다시 요청할 수 있다. 새 큐/유료 서비스는 추가하지 않았다.

링크는 검증된 설정 Origin의 `/password/reset#token=...`이며 Host·외부 next·query를 쓰지 않는다. 마지막 DB 발급 링크만 유효하고 배경 작업/메일의 동시 전달 순서는 보장하지 않는다. 토큰은 32바이트 난수·30분·일회용이고 DB는 SHA-256만 보관한다. POST `auth/password/reset`의 token/password가 유효하면 같은 transaction에서 Argon2id 변경·소비·자격증명 버전 증가, 204·현재 쿠키 삭제로 끝난다. 자동 로그인하지 않는다. GET·형식 오류·위조/소비/만료 링크로 비밀번호를 바꾸지 않는다.

자격증명 버전은 실제 검증한 비밀번호와 세션을 연결한다. 재설정 전 세션과 동시에 시작한 옛 비밀번호 로그인이 남긴 세션도 전부 거부한다. 기존 Origin/CSRF와 메일 제한을 공유하고 복구 소비는 IP당 30회/분으로 제한한다. 정리 대상에 만료된 복구 행을 추가했다. 원본 영상/몸 좌표나 기록 스키마는 추가하지 않았다.

`0002_password_recovery`는 새 migration이며 기존 v1 사용자의 비밀번호/계정과 세션은 upgrade 때 보존한다. downgrade는 버전 제거 전 인증 세션을 폐기해 옛 세션 부활을 막고 일회용 복구 행을 제거한다. **운영 migration/rollback은 별도 승인·백업/복구 검증 없이는 실행하지 않는다.** 실제 실행은 소유한 격리 시험 DB뿐이다. 복구 API·하네스/리뷰 결과는 [S2.6a1](../docs/stories/stage2-password-recovery-api.md)에 있다.

익명 세션 신규 발급도 IP당 분당 100회로 제한한다. 새 쿠키를 반복 요청해 DB를 무제한 채우는 경로를 막는 CTO 기술 기본값이며 유효 세션의 CSRF 조회는 이 발급 수를 소비하지 않는다.

### 구글 인증

기존 ADR-0015의 Authlib 1.8.0(BSD)·native httpx2를 사용한다. `BODYGUARD_GOOGLE_CLIENT_ID`와 `BODYGUARD_GOOGLE_CLIENT_SECRET`은 함께 설정해야 하며, 실제 계정 연결·시크릿 주입은 별도 승인 전 실행하지 않는다. 설정하지 않으면 status는 `{configured:false}`, login은 503이고 이메일 로그인은 유지한다. 일부만 설정하면 기동을 거부한다. 웹 버튼은 별도 S2.6b2 Story다.

GET `auth/google/login`은 고정 Google authorization endpoint로 303 이동한다. 허용 범위는 `openid email`뿐이며 이름·사진·Drive·offline 권한이나 공급자 토큰을 저장하지 않는다. 서비스 origin의 정확한 `/api/v1/auth/google/callback`을 사용하며 Host·외부 next를 신뢰하지 않는다. S256 PKCE와 nonce·익명 쿠키에 연결된 일회용 state를 검사한다. state는 해시만 DB에 저장하고 nonce/verifier는 기존 목적별 HMAC으로 도출한다. 익명 세션당 최신 시도 하나·10분, 시작은 IP당 10회/분이다. S2.6b2에서 native HTML 탐색의 미설정/제한·시작/callback DB 오류는 고정 로그인 enum으로 303 복귀한다. JSON API의 503/429와 Retry-After·인증 검사는 유지한다.

callback은 외부 토큰 교환 전에 흐름을 소비한다. native SDK로 RS256 서명·JWKS 키 교체·발급자·이 앱을 포함한 대상·발급/만료 시각을 검사하고 nonce·인증된 이메일을 추가 확인한다. 다른 탭의 로그인/로그아웃·만료 이후 늦은 공급자 응답은 세션을 바꾸거나 되살리지 않는다. 성공은 기존 세션 교체 후 `/start`, 실패/취소/계정 충돌은 고정 enum만 담은 `/login?google=...`다. 원문 code/state/error·토큰은 응답/DB/로그에 복사하지 않는다. API의 no-store/no-referrer, SDK 민감 DEBUG 로그 차단과 서버 access-log 금지를 유지한다. 운영 프록시/수집기의 URL 로그도 배포 Story에서 별도 검사해야 한다.

Google `sub`가 계정 식별자다. 동일 sub의 이메일 변경은 기존 등록 주소를 자동 교체하지 않고, 기존 이메일 계정이나 다른 sub와 같은 이메일은 자동 합치지 않는다. Google-only 계정은 비밀번호가 없으며 이메일 로그인 실패·복구 요청의 동일 202 응답 뒤 메일 0회로 처리한다. DB 제약도 이메일/Google 인증을 배타적으로 보장한다.

새 `0003_google_auth`는 기존 계정·세션을 보존하고 흐름 테이블을 추가한다. Google-only 계정이 있으면 downgrade는 데이터 변경 전에 거부한다. 임의 계정 삭제나 가짜 비밀번호 생성으로 rollback하지 않는다. 운영 migration/rollback은 별도 승인·백업·데이터 복구 계획이 필요하다. 이번 실행은 소유한 격리 PostgreSQL뿐이다.

## 검증 — 실제 DB / 모의 메일·Google 분리

격리 테스트 DB 이름·역할은 bodyguard_test, 연결은 loopback 또는 소유한 /private/tmp/bodyguard-auth-test.* Unix 소켓만 허용한다. 해당 테스트 DB의 계정 테이블은 매 사례에서 TRUNCATE한다. 일반/운영 DB URL은 거부한다. DB 없이 skip하지 않고 실패한다.

```bash
BODYGUARD_TEST_DATABASE_URL='postgresql+psycopg://bodyguard_test@127.0.0.1:55439/bodyguard_test' uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy app
```

pytest는 실제 FastAPI와 PostgreSQL 18 migration·제약·독립 연결 경쟁을 사용한다. 시간·코드 난수·메일을 시험에서 통제하고, Google 시험은 자체 RSA 키와 native SDK 검증을 사용하되 공급자 HTTPS는 MockTransport다. 실제 Google TLS·승인·로그인·Gmail 도착 증거가 아니다. test 설정은 환경 변수로 서버를 기동할 수 없고, production/development의 가짜 메일·clock·Google transport 주입도 거부한다. 공개 outbox/코드 조회/인증 우회 API는 없다.

공통 하네스는 PostgreSQL 세션 advisory lock을 migration/reset 전에 확보하고 실행 전체에서 유지한다. 같은 DB의 두 번째 하네스는 초기화 전에 실패하며 skip/통과로 세지 않는다. 이전 버전 하네스와도 분리하려면 실행별 새 `mktemp -d /private/tmp/bodyguard-auth-test.XXXXXX`의 소유 Unix socket DB를 사용한다. 다른 시험 프로세스·DB를 임의로 종료하거나 초기화하지 않는다.

`uv run python -m tests.run_browser`(기본/account), `... password`, `... google`은 실제 계정/복구/구글 API·SQL·production Chrome의 별도 시험이다. 소유한 시험 DB만 초기화하므로 동시에 실행하지 않는다. 메일/Google 응답은 원자적 비공개 IPC 파일이며 실제 공급자가 아니다. Google clock offset은 시험용이며 실제 기다린 시간으로 표시하지 않는다. 로컬 시작 응답을 redirect 0회로 캡처하고, 공통 브라우저의 외부 통신은 소유한 닫힌 포트 proxy로 강제 거부한다. 실제 차단·실패 실행/수정은 [b2 Story](../docs/stories/stage2-google-auth-web.md)에 기록한다. 계정/복구/구글 결과는 frontend/test-results/의 각 suite에 재현된다.

[하네스 계약](../docs/stories/stage2-account-harness.md) H-01~21에 해당하는 실행 테스트 이름은 tests/test_auth.py의 test_h01_...~test_h21_...다. 초기 실제 DB red는 미구현 csrf의 404, 구현 green·리뷰 보완·잔여 위험은 [Story 결과](../docs/stories/stage2-account-api.md)에 기록한다. 메모리 outbox 성공은 Gmail 도착 증거가 아니다.

frontend/의 pnpm gen:api는 실제 FastAPI OpenAPI를 오프라인으로 읽어 TypeScript 타입만 생성한다. SMTP/DB 접속·HTTP 서버·회원 생성은 하지 않는다. 생성물은 수정하지 않고, API 변경 때 다시 생성한다. 생성된 204:void의 Biome 단일 경고만 해당 폴더에서 제외하며 타입 검사는 그대로 수행한다.
