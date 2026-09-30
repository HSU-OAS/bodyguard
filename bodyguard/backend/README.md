# BODYGUARD 계정 API

S2.1, FR-U-02/03/04·NFR-08. 이메일 확인 계정, 서버 쿠키·CSRF, 본인 조회·로그아웃만 구현한다. 구글·재설정·화면·기록·실제 Gmail 연결·운영 배포는 아직 아니다.

## 로컬 실행

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

익명 세션 신규 발급도 IP당 분당 100회로 제한한다. 새 쿠키를 반복 요청해 DB를 무제한 채우는 경로를 막는 CTO 기술 기본값이며 유효 세션의 CSRF 조회는 이 발급 수를 소비하지 않는다.

## 검증 — 실제 DB / 모의 메일 분리

격리 테스트 DB 이름·역할은 bodyguard_test, 연결은 loopback 또는 소유한 /private/tmp/bodyguard-auth-test.* Unix 소켓만 허용한다. 해당 테스트 DB의 계정 테이블은 매 사례에서 TRUNCATE한다. 일반/운영 DB URL은 거부한다. DB 없이 skip하지 않고 실패한다.

```bash
BODYGUARD_TEST_DATABASE_URL='postgresql+psycopg://bodyguard_test@127.0.0.1:55439/bodyguard_test' uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy app
```

pytest는 실제 FastAPI와 PostgreSQL 18 migration·제약·독립 연결 경쟁을 사용한다. 시간·코드 난수·메일만 시험에서 통제한다. test 설정은 환경 변수로 서버를 기동할 수 없고, production/development의 가짜 메일·clock 주입도 거부한다. 공개 outbox/코드 조회/인증 우회 API는 없다.

[하네스 계약](../docs/stories/stage2-account-harness.md) H-01~21에 해당하는 실행 테스트 이름은 tests/test_auth.py의 test_h01_...~test_h21_...다. 초기 실제 DB red는 미구현 csrf의 404, 구현 green·리뷰 보완·잔여 위험은 [Story 결과](../docs/stories/stage2-account-api.md)에 기록한다. 메모리 outbox 성공은 Gmail 도착 증거가 아니다.

frontend/의 pnpm gen:api는 실제 FastAPI OpenAPI를 오프라인으로 읽어 TypeScript 타입만 생성한다. SMTP/DB 접속·HTTP 서버·회원 생성은 하지 않는다. 생성물은 수정하지 않고, API 변경 때 다시 생성한다. 생성된 204:void의 Biome 단일 경고만 해당 폴더에서 제외하며 타입 검사는 그대로 수행한다.
