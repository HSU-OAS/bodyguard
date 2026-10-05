# S4.N1 — 계정별 알림 설정 API

done · baseline43b13f37efa5ed58a8d5898af213fb66ea374a0e · codex/notification-preferences-api · 2026-10-06

## 범위와 의존성

FR-N-03/NFR-07/08·FR-U-04/05. 같은 S4.11 작업트리에서 다른 실행 주체의 수정·검증이 확인되어 그 파일/커밋/병합을 변경하지 않는다. 최신 origin/main에서 별도 작업트리와 새 전용 PostgreSQL을 사용한다. 설정 기능은 실제 SDK·classifier·아바타와 독립적이다. 기존 사전 승인으로 구현하며 운영 migration/배포는 실행하지 않는다.

## CTO 계약

- GET/POST /api/v1/settings/notifications. 인증한 본인의 설정만 조회·전체 교체한다. 사용자 ID/이메일을 입력·출력에 넣지 않는다. 기존 잠긴 세션·Origin/CSRF·no-store 경계를 재사용한다.
- 필드는 posture_enabled, posture_minutes, sitting_enabled, sitting_minutes, sound_enabled 5개뿐이다. 기존 기본값 true/5/true/50/false. 소리는 사용자의 명시 선택으로만 저장하며 브라우저 권한이나 재생을 실행하지 않는다.
- 시간은 1~1440분의 정수다. 하루 범위는 입력·자원 관리의 기술 상한이지 의학 권장 간격이 아니다. bool/문자열/소수/누락/추가 필드는 허용하지 않는다. 입력 전체를 검증하고 원자적으로 교체한다.
- 최초 GET은 기본값만 반환하고 설정 행을 만들지 않는다. 실제 POST만 계정별 한 행을 upsert한다. 두 계정·동일 계정 두 세션의 저장/조회, CSRF/만료·credentials version·로그아웃을 확인한다.
- FK ON DELETE CASCADE로 기존 탈퇴 시 설정도 삭제한다. 새 migration만 추가하고 저장한 설정이 있으면 downgrade를 거부한다. 운영 데이터 삭제·보관 정책을 변경하거나 migration을 운영에서 실행하지 않는다.
- 이번 Story는 API/SQL/OpenAPI 계약이다. 웹 설정 화면·알림 scheduler/소리·브라우저 권한·임계값/민감도·Q07/Q08 정책·1분 요약·리포트는 완료로 세지 않는다. 후속 UI는 기존 화이트·블루 web-design-studio 계약을 적용한다.

## 수용 기준과 하네스

| ID | 실제 검증 |
|---|---|
| P01 | 인증 GET 기본값·no-store·설정 쓰기0, 익명 차단 |
| P02 | 명시 POST→GET·두 세션·재시도 한 행·타인 기본값/격리 |
| P03 | 엄격한 5필드·정수/boolean·범위·추가/누락·실패 시 이전 값 보존 |
| P04 | 잘못된 Origin/CSRF·변경 쿠키·만료/로그아웃/credentials-version 차단, 설정·다른 데이터 변경0 |
| P05 | 실제 DB 제약·FK cascade·안전한 downgrade/upgrade·기존 계정/기록 보존 |
| P06 | 전체 API/SQL 회귀·OpenAPI 타입 생성·frontend 회귀/정적/build·실패 보존·diff 리뷰·조건부 PR |

## 작업

- [x] 최신 main·승인/FR 계약·독립 작업트리·DB 준비 범위 확인.
- [x] 먼저 실제 HTTP 실패 하네스 작성·원본 보존.
- [x] API/DB·새 migration·생성 타입 구현.
- [x] 전체 회귀·제약/rollback·scope 리뷰·검증 증거·PR 게이트 준비.

## Dev Agent Record

BMAD dev-story 기본 workflow를 사용한다. 기존 AGENTS 전체 원문과 새 파일 byte 일치를 확인했다. resolver/config/sprint-status/project-context가 없으며 설치/초기화는 하지 않는다. API는 실제 격리 PostgreSQL/HTTP 시험이고 mail/clock은 합성이다. S4.11의 기존 파일·검증·커밋은 다른 실행 주체 소유로 보존한다. 실행 중 중복 시험은 이쪽 소유 handle만 종료했고 실패/중단 원본은 기존 scratch에 남겼다. 전체 단계 통과 또는 출시 선언이 아니다.

### 실제 구현/검증

구현 전 실제 HTTP 27건은 404 등의 계약 불일치로 실패했다. 최초 구현27건·추가30건을 통과하고 다른 계정 보존을 더 확인한 최종 전체 API321건이153.28초에 통과했다(경고1: 기존 asyncio deprecation). 전용 PostgreSQL18 migration0006·범위/NOT NULL/FK 제약·이미 저장한 설정 downgrade 거부·빈 설정 downgrade/upgrade·503 transaction rollback·탈퇴 cascade/타인 보존·동일 계정 두 세션/old proof403·native backup/restore의 실제 설정 행 보존을 확인했다. SMTP/clock은 합성이다.

frontend503건·타입·Biome115파일·production build/기존 차단 guard, Ruff/mypy9모듈, 실제 OpenAPI 생성2회 SHA 일치를 확인했다. 기존 migration/CI/dependency/운영 설정은 변경0이다. 새 migration head에 맞춰 readiness와 기존 rollback/복구 하네스의 기대값만 갱신했다. 수정 중 Ruff 길이 오류는 실제 기록이며 최종 정적 검사는 통과했다. 초기/추가 실패 stdout은 소유 scratch에 보존하고 HTTP red를 저장소 증거에도 수집했다.

engineering:code-review로 허용5필드·본인 PK/잠긴 세션·cookie-bound CSRF·전체 교체/원자성·FK cascade·rollback/역 migration·단일 행 접근을 점검했다. 현재 Story 범위 미해결 P1/P2는 없다. 작성자 리뷰이며 외부 독립 리뷰/체크 통과를 주장하지 않는다. [검증 기록](../review/notification-preferences-api/README.md)의 실제 artifact14/source16 SHA·수집기 동일 재실행2회를 확인했다.

설정 화면/실제 알림·출시 동작·실측·SDK/privacy·아바타 이월·참여자·운영 migration/HTTPS·법무·전체1~6단계는 미완료다. 최신 main/diff/CLEAN/체크/exact HEAD 게이트 전에는 병합을 완료로 표시하지 않는다. 웹 디자인 스킬은 기존 화이트·블루 계약을 유지하는 데 적용했으며 이번 API Story에서 새 화면·Figma·axe·전체 디자인 audit을 실행했다고 주장하지 않는다.

### 최신 main 통합 검증

진행 중 PR41이 mergef47dea17a7ec92ff62404c5624bc4c18cd0782a2로 main에 포함된 것을 읽고 알림 설정 브랜치를 fast-forward했다. 해당 Story 파일·증거를 수정하지 않았다. API/SQL 관련 source16 SHA는 앞선321건 검증 소스와 동일하다. 새 hook20건을 포함한 최신 전체 frontend523건/실패0(19.81초)·타입·Biome120파일·build/production guard를 실제 재실행했다. 이전503건 결과와 artifacts.json을 보존하고 통합 결과는 artifacts-v2.json에 별도로 기록한다. artifact19/source16을 확인하고 같은 수집을 재실행해 기존 byte가 바뀌지 않았음을 검증했다.

## File List

실제 post-merge: PR42 source85258323d0a220be21856eb65b881d0faf7f1f48는 필수 검증·작성자 scope 리뷰·remote41 blob/diff·latest main/CLEAN·체크 없음 뒤 merge6ee4dce33047fae2f33430ee88baf9e09bf76ff3로 main에 포함됐다. 부모f47dea1/8525832와 source ancestor·원격 브랜치 보존·clean을 실제 확인했다. API Story만 done이며 실제 알림/웹 UI/전체 단계 통과를 뜻하지 않는다.

- bodyguard/docs/stories/stage4-notification-preferences-api.md
- bodyguard/backend/app/notification_preferences.py
- bodyguard/backend/app/db.py
- bodyguard/backend/app/main.py
- bodyguard/backend/app/readiness.py
- bodyguard/backend/migrations/versions/0006_notification_preferences.py
- bodyguard/backend/tests/test_notification_preferences.py
- bodyguard/backend/tests/backup_restore_proof.py
- bodyguard/backend/tests/test_backup_restore_proof.py
- bodyguard/backend/tests/test_account_withdrawal.py
- bodyguard/backend/tests/test_auth.py
- bodyguard/backend/tests/test_google_auth.py
- bodyguard/backend/tests/test_password_reset.py
- bodyguard/backend/tests/test_readiness.py
- bodyguard/backend/tests/test_records_integrity.py
- bodyguard/frontend/src/api/generated/index.ts
- bodyguard/frontend/src/api/generated/types.gen.ts
- bodyguard/docs/review/notification-preferences-api/README.md
- bodyguard/docs/review/notification-preferences-api/collect-proof.mjs
- bodyguard/docs/review/notification-preferences-api/artifacts.json
- bodyguard/docs/review/notification-preferences-api/contract-red.xml
- bodyguard/docs/review/notification-preferences-api/initial-green.xml
- bodyguard/docs/review/notification-preferences-api/review-green.xml
- bodyguard/docs/review/notification-preferences-api/full-backend.xml
- bodyguard/docs/review/notification-preferences-api/full-backend.stdout
- bodyguard/docs/review/notification-preferences-api/full-frontend.xml
- bodyguard/docs/review/notification-preferences-api/accepted-ruff.stdout
- bodyguard/docs/review/notification-preferences-api/accepted-mypy.stdout
- bodyguard/docs/review/notification-preferences-api/frontend-types.stdout
- bodyguard/docs/review/notification-preferences-api/frontend-check.stdout
- bodyguard/docs/review/notification-preferences-api/frontend-build.stdout
- bodyguard/docs/review/notification-preferences-api/production-guard.stdout
- bodyguard/docs/review/notification-preferences-api/offline-install.stdout
- bodyguard/docs/review/notification-preferences-api/generated-repeat-check.stdout
- bodyguard/docs/review/notification-preferences-api/artifacts-v2.json
- bodyguard/docs/review/notification-preferences-api/integrated-frontend.xml
- bodyguard/docs/review/notification-preferences-api/integrated-types.stdout
- bodyguard/docs/review/notification-preferences-api/integrated-check.stdout
- bodyguard/docs/review/notification-preferences-api/integrated-build.stdout
- bodyguard/docs/review/notification-preferences-api/integrated-production-guard.stdout
- bodyguard/docs/tasks.md

## Change Log

2026-10-06: 별도 작업트리에서 알림 설정 API 계약 시작. 실제 알림/의학 판정·SDK/아바타·운영 경계는 변경하지 않는다.

2026-10-06: 실제 API/SQL·세션·제약·역 migration·복구·기존 전체 회귀 통과, source/실패 증거 보존. scoped 작성자 리뷰 후 PR 게이트 준비.

2026-10-06: 실제 최신 mainf47dea1 통합 및 전체523 frontend 재검증. 이전 증거 보존/통합 manifest 별도 기록.
