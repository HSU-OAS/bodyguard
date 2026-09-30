# S2.1 — 이메일 계정·세션 API

2026-10-01 · **명세 main 반영 / 사전 승인 범위의 다음 미완료 Story** · E1, FR-U-02·03·04, NFR-08. [운영 규칙](../operating-rules.md).

사용자는 자기 이메일을 확인한 계정으로 로그인하고 본인 세션을 조회하며 로그아웃으로 서버 접근 권한을 끊는다. 화면은 S2.2에서 연결한다. [단계 명세](stage2-first-flow.md)와 [하네스 계약](stage2-account-harness.md)을 함께 따른다.

## 포함·제외

포함: FastAPI 실제 API, PostgreSQL 최소 계정/가입 요청/세션과 새 로컬 migration, 입력·해시·만료·경쟁·권한·CSRF·요청 제한, 실제 API/DB 테스트·실행 안내.

제외: 화면·구글·재설정(S2.2/2.6), 자세/기록 DB·아바타·카메라 변경, 실제 공급자 계정/메일 발송·시크릿 주입, 운영 migration·서버·배포·CI. 테스트 메일은 pytest 메모리 outbox로만 확인한다. 공개 코드 조회 API·로그인 우회는 없다. 전체 회원 기능 완료가 아니다.

## 수용 기준

- **AC-01** Given 신규 가입, When 유효한 입력 제출, Then 비밀번호/코드 원문 없이 가입 요청을 저장하고 인증 전 로그인/개인 접근을 거부. 이메일·비밀번호 검사도 서버가 수행.
- **AC-02** Given 코드/요청, When 만료·오답 한도·사용됨·다른 challenge의 코드 제출, Then 실패. 최초 올바른 코드에서만 계정 생성. 동시 소비/동일 이메일 경쟁도 DB에서 차단.
- **AC-03** Given 같은 이메일의 여러 가입 요청, When 자기 challenge의 코드 확인, Then 해당 요청의 password_hash만 사용. 기존 계정 덮어쓰기나 공격자 선등록 비밀번호 승계 금지.
- **AC-04** Given 재발송/실패/반복 요청, When 재시도, Then 코드 무효화·간격·시도·메일/IP 제한이 일관. 발송 실패는 가입 완료가 아니며 원문 로그/응답 없음.
- **AC-05** Given 인증 계정, When 로그인, Then 서버의 새 세션/CSRF 사용. 없는 주소/잘못된 비밀번호는 동일 실패. 추정 세션이나 기존 익명 ID의 인증 승격 금지.
- **AC-06** Given 미인증/위조/만료/폐기 세션, When GET /me, Then 401. 정상은 쿠키 세션의 본인만 반환. body/query의 user_id로 다른 사용자 선택 불가.
- **AC-07** Given 상태 변경 요청, When 세션(익명 포함)/Origin/CSRF 누락·위조·만료, Then 403·업무 상태 변경 0. 인증 전 POST도 보호. GET으로 가입/로그아웃하지 않음. AC-08의 잔여 쿠키 정리는 별도 예외.
- **AC-08** Given 로그아웃, When 이전 쿠키 재사용/서버 재시작, Then 개인 접근 401. 서버 폐기·쿠키 삭제 모두 수행. 만료/없는 세션은 정확한 Origin 검사 후 잔여 쿠키만 정리.
- **AC-09** Given production 설정, When 메일/보안 설정 없음, Then 가짜 발송·고정 코드·개발 인증으로 폴백하지 않음. 비밀번호·인증 코드·세션 원문·시크릿·좌표를 소스/JSON 응답/로그에 노출하지 않으며 검증 오류도 입력 원문을 반사하지 않음. 정상 본인 조회의 id/email, 메모리용 CSRF와 Set-Cookie는 정해진 계약대로만 제공.

## API 계약 — CTO 기술 권고안

경로 /api/v1. 이메일 바깥 공백·대소문자는 일관되게 처리하되 Gmail 점·+를 제거해 주소를 합치지 않는다. 아래 경로·수치는 사전 승인된 범위 안의 **CTO 기술 권고안**으로 구현·경계 검증한다. 사업/안전/개인정보의 미정 사항을 임의 확정하지 않는다.

| 메서드·경로 | 정상 | 실패·보안 |
|---|---|---|
| GET /auth/csrf | 익명/현재 세션에 묶인 토큰 | no-store, 인증 권한 없음 |
| POST /auth/signup | email/password → 202·불투명 challenge_id | 422/429/503, 기존 계정 수정 금지 |
| POST /auth/verify | challenge_id/code → 최초 201 | 무효/만료/소비됨 공통 400, 원자적 소비·이메일 유일성 |
| POST /auth/resend | challenge_id → 202 | 너무 이르면 429·Retry-After, 발송 실패 503, 이전 코드 무효 |
| POST /auth/login | email/password → 200·본인·새 CSRF | 실패 401·제한 429, 인증 토큰을 JSON/URL에 넣지 않음 |
| GET /me | id/email → 200 | 무효 세션 401, user_id는 서버만 결정 |
| POST /auth/logout | 서버 폐기·쿠키 삭제 → 204 | 유효 세션은 CSRF 필수. 만료/없는 세션은 Origin 검사·잔여 쿠키 삭제만 |

challenge_id도 충분한 난수로 만든다. 유효한 가입 요청은 기존 이메일 여부와 무관하게 같은 202 형식이며 기존 계정을 수정하지 않는다. 가입/재발송 응답과 로그인 실패·해시 검사 경로로 주소 목록을 추정하지 못하게 검증한다. 인증 시 세션/CSRF를 교체한다.

## 저장·보안 기준

- 비밀번호는 ADR-0006의 Argon2id. 세션은 표준 난수 32바이트, 쿠키로만 전달하고 DB에는 해시만 저장. 인증 후 ID 교체·서버 만료·폐기를 검사한다. 운영 쿠키는 HttpOnly/Secure/SameSite=Lax·Domain 없음·Path=/; localhost 예외는 운영 설정에서 금지. [OWASP 세션](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- 서버 세션에 연결된 CSRF와 정확한 허용 Origin 검사. 인증 전 세션도 포함. CSRF는 클라이언트 메모리/헤더로만 전달하며 SameSite/CORS만으로 방어하지 않는다. [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- 보안 기본안: 비밀번호 15~128자(공백/Unicode 허용·잘라내기 금지), 코드 6자리·10분·오답 5회·재발송 60초. 인증 세션 idle 30분/absolute 8시간·익명 10분. 가입/재발송 이메일당 시간당 5회·IP당 20회, 로그인 실패 이메일당 15분 10회·IP당 30회. 수치는 경계 테스트 대상인 **기술 권고**다. 길이와 일반화된 인증 실패의 근거: [OWASP 인증](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
- 코드 해시는 challenge와 묶인 키 기반 HMAC, 키는 환경 변수만. 테스트 키는 테스트 프로세스 한정. 표준 시간차 완화 비교를 사용. 6자리 단순 해시 전수조사를 피한다.
- 최소 DB: users, signup_challenges(의도한 password_hash 포함), sessions(익명/인증·CSRF 상태·만료/폐기), 제한 카운터. 코드 소비·시도 증가·재발송·가입 경쟁은 PostgreSQL transaction으로 검증. SQLite/메모리만으로 통과 금지.
- 제한 카운터는 재시작/동시 요청으로 우회되지 않는 DB 공유 상태. IP/메일 제한 키는 HMAC 처리, 원문 IP·인증 입력 로그 금지. 프록시 헤더를 무조건 신뢰해 IP 제한을 우회하게 하지 않는다. 만료 요청/세션/카운터 정리를 포함.

## 개발 경계·완료

현재 main에 backend/compose는 없다. ADR-0011/0015의 Python 3.14/FastAPI/PostgreSQL 18/uv 구조를 재사용하고 auth가 쓰는 코드만 만든다. lock으로 의존성 고정·설치 호환 검사. 무관한 AI/기록 모듈의 빈 껍데기 생성 금지.

예상 신규 위치: backend/pyproject.toml·lock, app/main.py·auth·최소 DB, alembic 새 migration, tests·README와 로컬 compose.yaml. 실제 코드 크기에 맞춰 나눈다. 기존 migration·.env·CI는 수정하지 않으며 운영 DB 작업은 하지 않는다.

frontend/App.tsx는 측정 데모를 즉시 보여준다. 이 Story에서는 변경하지 않는다. S2.2에서 공개/보호 경계를 만들고 모델 조절·촬영 관찰 등 기존 개발 기능은 개발 경로로 보존하되 제품에 노출하지 않는다.

완료 증거: 실제 API/PostgreSQL 테스트·로컬 migration 재현, lint/type 검사, 민감 입력 미노출·경쟁/실패 증거·README. 미실행/skip/가짜 메일을 실제 연결·출시 완료로 표시하지 않는다. Story·Git·조건부 병합은 사전 승인 운영 규칙을 따르고 외부/운영 작업은 별도 승인을 받는다.
