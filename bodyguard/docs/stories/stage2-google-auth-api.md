# S2.6b1 — 구글 인증 API·보안 하네스

2026-10-01 · **PR #12 merge commit 병합** `d5cade78668105e3d9faf96b32f03490f9ce67ea`(부모·트리·브랜치 유지 확인) · 기준 main `5f0c40cc16181574530db302b6ba065e7fb4091a`. S2.6a1/a2 PR #10/#11 병합 확인. [사전 승인 규칙](../operating-rules.md)·FR-U-01~04·ADR-0006을 따른다. 아바타 Draft PR #9 외형 P2 및 S2.3b 실제 수행 시험은 별도 미완료다.

## 범위·기술 결정

기존 FastAPI·PostgreSQL·서버 쿠키·요청 제한을 재사용한다. ADR-0015의 Authlib로 authorization-code/OIDC·S256 PKCE·서명/발급자/대상/만료/nonce를 검사한다. 암호화나 OAuth 프로토콜을 직접 다시 만들지 않는다. Google `sub`로 식별하고 인증된 이메일은 처음 가입할 때만 저장한다. 같은 sub의 이메일이 바뀌어도 다른 계정과 합치거나 주소를 자동 교체하지 않는다. 같은 이메일의 다른 sub/이메일 가입 계정은 실패·원래 로그인 안내로 처리하며 기존 데이터·비밀번호를 바꾸지 않는다.

요청 범위는 기존 요구의 부분집합인 `openid email`만 사용한다. 이름/사진·Drive·Calendar·offline 권한·Google access/refresh/ID token 저장은 없다. Google-only 계정에 이메일 복구로 비밀번호를 새로 만들지 않는다. 기존 이메일 가입의 공통 응답·CSRF·복구 epoch 규칙을 약화하지 않는다.

기존 익명 세션과 한 번만 쓰는 10분 흐름을 PostgreSQL에서 연결한다. state는 CSPRNG 원문을 브라우저 왕복에만 쓰고 DB에는 해시만 둔다. nonce와 PKCE verifier는 목적을 구분한 기존 HMAC로 해당 난수 state에서 도출하므로 DB/별도 쿠키에 원문을 보관할 필요가 없다. 성공 전에 현재 익명 세션·폐기·만료를 다시 검사하고 새 인증 쿠키로 교체한다. 뒤늦은 callback이 다른 탭의 새 로그인이나 로그아웃을 덮어쓰지 않는다.

Google 엔드포인트와 callback은 서버의 고정 HTTPS URL·정확한 서비스 origin으로 결정한다. Host/프록시·callback query·next로 외부 주소를 만들지 않는다. 현재 보호된 목적지는 `/start`뿐이며 임의 복귀 URL은 받지 않는다. 기존 쿠키를 재사용하므로 서명 쿠키 미들웨어·새 인증 서비스·외부 캐시는 추가하지 않는다.

| 경로 | 결과 | 실패·경계 |
|---|---|---|
| GET /api/v1/auth/google/status | configured boolean | 시크릿/ID·네트워크/DB 없음 |
| GET /api/v1/auth/google/login | 고정 Google로 303, 익명 쿠키·흐름 | 미설정 503, IP 제한 429. 기존 로그인은 /start 복귀, 계정 전환 안 함 |
| GET /api/v1/auth/google/callback | 검증 후 /start로 303·새 인증 쿠키 | 취소/잘못된/만료/반복/공급자 실패/충돌은 고정 /login?google=...로 303. 원문 code/state/error/token을 복귀 URL·응답·로그에 복사하지 않음 |

callback은 외부 top-level GET이므로 일반 POST Origin/CSRF 대신 정확한 state·세션 연결·PKCE·nonce·OIDC 검사를 모두 요구한다. callback의 인증 시도는 외부 토큰 교환 전에 한 번만 소비한다. 공급자 실패 후 원래 요청의 재사용은 막고 사용자가 새로 시작한다. callback referrer/no-store와 서버 access-log 금지를 유지한다.

## 수용 기준·실행형 하네스

| ID | 검증 | 통과 기준 |
|---|---|---|
| G-01 | 미설정/부분 설정·운영 경계 | 설정 pair 검증, 미설정 네트워크0·사용자 생성0. test transport 운영 주입 금지 |
| G-02 | 시작·계정/목적·PKCE | state마다 nonce/verifier 다름. openid/email·고정 callback·S256·난수 쿠키/해시 저장·기존 로그인 보존·제한 지속 |
| G-03 | state/세션·만료/중복 query | 누락/위조/다른 브라우저/중복/TTL 경계/동시 소비·재생 거부. 공급자 호출0, 사용자/세션 생성0 |
| G-04 | 실제 서명 검증·모의 HTTPS | 자체 테스트 RSA 키와 가짜 JWKS/토큰 응답을 Authlib HTTP transport로 전달. 잘못된 서명/alg/kid/iss/aud/exp/iat/nonce/검증 안 된 이메일/누락 ID token은 fail closed |
| G-05 | 가입·반복 로그인·충돌 경쟁 | sub 유일성·이메일 충돌/미인증 선가입 보호, 동시 두 흐름은 계정 하나. 묵시적 합치기0·비밀번호 덮어쓰기0 |
| G-06 | 인증 세션·늦은 callback | 쿠키 교체·CSRF/본인 조회·로그아웃, 다른 계정/만료/폐기/실패/DB 오류에서 원래 로그인 보존 |
| G-07 | 이메일/복구·migration 회귀 | Google-only 비밀번호 로그인 실패·복구 메일0, 이메일 회귀·실제 격리 PG18 migration/제약/복구 검사 |
| G-08 | 민감 정보·API 계약 | 입력·provider 원문/토큰 로그0·DB0, no-store/no-referrer, API 타입 생성·Ruff/mypy·diff·기존 프런트 회귀 |

테스트는 실제 FastAPI·PostgreSQL·RSA/라이브러리 검증이다. Google HTTP와 계정은 **모의 공급자**이며 실제 Google 승인/로그인 증거가 아니다. 검증을 완화한 production 우회/fixture endpoint를 만들지 않는다. 새로운 migration만 추가하고 기존 migration·CI·.env·원본 사용자 작업은 변경하지 않는다.

## 순서·완료 경계

이 PR은 S2.6b1 API·로컬 보안 하네스 한 목적이다. 이어 S2.6b2 웹 버튼·취소/실패/충돌 안내·원래 목적 복귀·실제 로컬 HTTP/Chrome 시험을 별도 Story로 진행한다. 실제 Google Cloud 계정 생성/연결·시크릿 주입·테스트 사용자/동의 화면 설정·외부 로그인은 범위/비용/위험/복구 계획으로 CEO 별도 승인 후 실행한다. 운영 DB migration·배포·출시도 별도다. 코드가 병합돼도 S2.6/S2.7/2단계나 출시 후보 완료로 표시하지 않는다.

근거: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Authlib FastAPI](https://docs.authlib.org/en/stable/oauth2/client/web/fastapi.html), [PKCE HTTP client](https://docs.authlib.org/en/stable/oauth2/client/http/index.html), [Authlib BSD 라이선스](https://docs.authlib.org/en/stable/community/licenses.html). 설치된 SDK의 실제 API/검증 경로를 읽고 실행형 검사로 확인한다.

## 실제 개발·검증 결과

기존 계정과 데이터 경계를 재사용하고 ADR-0015에 예정된 Authlib 1.8.0·native httpx2 2.13.1을 lock했다. SDK의 실제 Starlette/HTTP/OIDC 검증 경로를 읽었다. native SDK 사용으로 JWT·JWKS·PKCE 프로토콜을 직접 구현하지 않았고 별도 서명 쿠키·인증 캐시·새 서비스는 추가하지 않았다. FastAPI의 OpenAPI에서 `GoogleStatusOut`과 redirect 계약을 생성했다.

RED → GREEN은 실제 실패를 재현한 뒤 공통 경계를 수정했다.

- 미구현 status의 404 → 미설정 false/503·게스트 세션 유지.
- Starlette 1.7의 native TestClient가 httpx2 Response를 선택해 기존 fixture의 runtime 타입 검사가 실패 → 실제 SDK Response 타입으로 교체. 기존 계정 수용 기준을 삭제하지 않았다.
- DEBUG 로그에서 모의 state/code가 HTTP 의존성에 노출 → SDK PKCE logger 차단·HTTP logger WARNING, 민감값 저장/로그 검사 통과.
- **다른 audience + 이 앱의 azp**를 넣은 자체 RSA 토큰이 최초에는 잘못 로그인 → native claims 옵션에 이 client audience를 명시. 해당 공격·서명/nonce/issuer/alg/만료 검사가 모두 실패 처리됨.
- 기존 DB 최종 revision 검사만 0002를 예상해 실패 → 신규 schema의 정확한 0003으로 갱신. 실제 기존 사용자·세션/epoch 보존 검사는 그대로 통과.

| 검증 | 실제 실행 결과 | 모의/미실행 경계 |
|---|---|---|
| `.venv/bin/pytest -q` | **154 passed / skip 0 / 33.58s**: 기존 90 + Google 64. 실제 FastAPI·PostgreSQL 18.6·migration·RSA/Authlib 검증·독립 연결 경쟁 | Google HTTPS는 MockTransport, 시간/메일은 통제. 실제 Google/Gmail 연결 아님 |
| G-01~08 | wrong aud/azp·서명/alg/kid/nonce·필수 claims·만료 경계·JWKS 교체·중복/다른 브라우저·소비 경쟁·늦은 응답·선등록/이메일 충돌·Google-only 복구 차단·로그/저장 검사가 통과 | 일반 Google 계정·외부 TLS·실제 동의 화면은 미실행 |
| migration | 격리 DB에서 0003 upgrade/검사·이메일 사용자 보존 왕복 통과. Google-only downgrade는 변경 전 거부·계정 보존 | 운영 DB·백업/운영 rollback 실행 안 함 |
| 기존 production Chrome | 실제 계정 API/SQL **9개(1.7m) → 복구 5개(12.1s)** 순차 회귀 통과 | SMTP 모의, Google 웹은 다음 Story |
| 개발 Chrome 카메라 | 기존 시작·중지·재시작·이탈 **1 passed / 27.5s**, account/password 산출물과 출력 폴더 분리 | 사람이 없는 가짜 카메라. 실제 자세/다중 인물/촬영 정확도 아님 |
| `pnpm gen:api`, typecheck/check/test/build | native 계약 생성·TypeScript·Biome 통과, **Vitest 105/12 files**, production build 280.06KB(96 modules) | Google UI/실제 카메라/두 출시 아바타/전체 흐름 미구현 |
| Ruff check/format, mypy app, diff·문서 링크 | 16 files format·5 source modules typecheck·diff·수정 문서 로컬 링크 **31개** 검사 통과 | CI 체크 존재 여부는 병합 직전 별도 확인 |

계정 Chrome 직후 복구 하네스가 `Address already in use`로 시작하지 못한 실제 실행도 있었다. 사용자 프로세스를 종료하거나 시험을 성공으로 표시하지 않았다. 기존 공통 하네스가 포트를 **DB 초기화 전에 소유**하는 경계는 유지하고, native `SO_REUSEADDR`로 닫힌 시험 listener 재사용만 허용해 복구 5개를 재실행했다. 살아 있는 다른 listener를 재사용하는 `SO_REUSEPORT`/서버 재사용은 없다.

오프라인 pnpm cache가 없던 초기 설치와 자산 다운로드의 sandbox DNS 실패는 실제 빌드 성공이 아니다. 잠긴 194개 의존성을 재사용하고 소유한 이전 Story의 같은 버전 MediaPipe 자산 5개를 복사한 뒤 위 build를 실제 재실행했다. API에는 기존 asyncio deprecation 1개, 브라우저에는 NO_COLOR와 시제품 Three/MediaPipe 경고가 있다. 경고가 없다고 보고하지 않는다.

수동 PR 전 리뷰에서 대상 앱 설정 누락을 위 재현으로 해결했다. b1 범위의 미해결 P1/P2는 없었고 exact HEAD `5ab4c6c31cff3da3bdf322ae60ebd8c8a4040f4c`·최신 diff·CLEAN/MERGEABLE·브랜치 자동 삭제 false를 확인해 PR #12를 merge commit으로 병합했다. GitHub checks/reviews는 0(**체크 없음**). 로컬 검증을 GitHub 체크 통과로 표시하지 않았다. **실제 공급자 연결·b2 웹·S2.3b·최종 아바타·S2.7·1~6 전체 완료를 의미하지 않는다.**
