# S4.14 — 본인 계정의 1분 요약 저장·조회·기간 삭제

Status: done (S4.14 API 범위만)
baseline_commit: fccd5c4a46ee2f7695b502fb987fed091124e95e

## 사용자 가치와 범위

FR-R-01/02/04, FR-U-03, NFR-07/08, Q-32: 로그인한 사용자의 브라우저 1분 집계 결과를 본인 계정에 보관하고 기간별로 조회·삭제할 수 있게 한다. S4.7의 순수 집계 DTO, S4.13의 불변 기준선과 연결한다. 서버는 클라이언트 집계를 저장할 뿐 자세의 정확성·성공·효과를 판정하지 않는다.

아바타·실측·SDK 개인정보 P2·공개 측정 생산자는 이번 범위 밖이다. 공개 카메라 화면/대시보드 연결은 후속 Story이며 이 API를 출시 가능한 코칭으로 공개하지 않는다. 1~6단계 완료가 아니다. 기존 증거와 이월 기준을 유지한다. 새 의존성·비용·계정·시크릿·운영 migration·배포는 없다.

## 고정 계약

- `POST /api/v1/summaries/batch`: 엄격한 `{items:[...]}` 1~60개. 계정 ID는 세션에서만 결정한다. 키는 `(user_id, minute_start)`이며 UTC 분 정렬이다. 중복 분을 한 batch에 넣으면 422. 새 행이 있으면 201, 전부 동일 재시도면 200. 다른 내용이면 409이며 batch 전체 rollback. 기존 설계의 덮어쓰기 제안 대신 불변 재시도로 자료 손실·기준선 혼합을 막는다.
- 입력은 `minute_start`, `baseline_id`, `client_version`, `coverage_sec`, `measured_sec`, `unmeasurable_sec`, `present_sec`, `background_sec`, `any_bad_sec`, `neck/shoulder/trunk`이다. 각 지표는 `method/unit/dev_mean/measured_sec/bad_sec`. 영상·원시 관절·샘플·임의 추가 필드를 받지 않는다. 출력에 `created_at`, `provenance: client-reported`를 더한다. 집계 TS의 camelCase를 API snake_case로 매핑한다.
- 분 시각은 명시 시간대가 있는 ISO 문자열이며 UTC 변환 후 초/소수초가 0이어야 한다. 숫자 시각·naive 시각은 거부. 서버 시각 +5분에서 분의 끝을 초과하면 422(기존 기록 API와 같은 기술적 시계 오차 허용이며 의료 판정 기준이 아님).
- 시간은 유한한 숫자 0~60초. bool/문자/NaN/Infinity 거부. 편차 평균은 유한한 JS 안전 숫자 범위 내이거나 null. 지표 측정 시간이 0일 때만 평균 null이고 이탈 0. 관계: coverage=measured+unmeasurable+background, measured≤present≤coverage−background, 지표 measured≤전역 measured≤지표 measured 합, max 지표 bad≤any_bad≤min(전역 measured, 지표 bad 합). 부동소수 누적의 비교 오차만 0.000001초 허용하며 값을 자르거나 수정하지 않는다.
- 기준선은 본인 계정의 복합 FK. 없는/다른 계정 기준선은 같은 422. 역사적 비활성 기준선도 허용. 기준선 client_version과 입력 버전 및 **측정된** 지표의 method/unit이 같아야 한다. 기준선 값이 없는 지표를 측정됐다고 받지 않는다. baseline null일 때 목/몸통은 측정 0이며 어깨만 허용한다(ADR-0005). 임의 임계값·임상 방법을 채택하지 않는다.
- `GET /api/v1/summaries`: 본인 요약만 UTC 분 내림차순. limit 기본20/최대100, offset 최대10000, start/end 선택(명시 시간대, start 포함/end 제외, start<end). `{items,has_more}`. 별도 가중 일/시간 집계는 후속 Story.
- `POST /api/v1/summaries/delete-preview`, `/delete`: 기존 기간 삭제 증명의 10분 TTL·세션 바인딩·cutoff·count·fingerprint를 사용하되 `minute-summaries` 서명 도메인과 `delete-minute-summaries` 확인 문구로 스트레칭 삭제와 분리한다. 미리보기와 달라진 비어 있지 않은 대상은 409·삭제 0. cutoff 이후 저장은 보존. 이미 삭제된 기간 재시도는 0. owner/기간/행 잠금과 검증·삭제가 한 transaction이다.
- POST에는 정확한 Origin·CSRF, 유효 세션 필수. owner advisory lock→user KEY SHARE→잠금 대기 뒤 세션 재확인, DB lock timeout 2초. 모든 DB 오류는 기존 고정 503, 민감 payload/log 미출력. 탈퇴 CASCADE·다른 계정 보존. migration 0008은 새 파일만 추가하고 비어 있지 않은 downgrade는 백업 없이 거부한다.

## 수용 기준 / 하네스

1. 실제 격리 PostgreSQL18 + FastAPI TestClient에서 저장/재시도/조회/소유권/기준선/부분 실패 원자성/삭제/탈퇴를 재현한다. mock DB로 대체하지 않는다.
2. 엄격 DTO·유한 값·시간 분모·기준선/method 분리·제외 필드·UTC·미완료 분을 경계값으로 검사한다. 실제 TS 집계에서 나온 fractional duration 입력도 검사한다.
3. 직접 SQL의 NOT NULL/CHECK/복합 FK, downgrade 보존과 새 DB upgrade를 검사한다. 잠금 대기·실제 로그아웃/재설정/탈퇴 경합에서 기존 GET 401·POST 보안 403 또는 rollback된 503만 허용하며 행/활동 갱신 rollback도 검사한다.
4. 기간 삭제 서명 위조·다른 세션/기능 증명·만료·후속 행·변경 행·재시도를 검증한다. 저장/삭제 중 오류는 모두 rollback한다.
5. 실제 OpenAPI에서 TS 타입 재생성, backend 전체 회귀·Ruff/mypy·frontend 회귀/빌드/공개 번들 가드. 네이티브 백업/복구에서 요약·기준선·소유권/제약 보존 확인. 운영 복구는 승인하지 않는다.
6. 독립 리뷰 P1/P2 0, 정확한 tested HEAD/최신 main/diff/충돌/체크 후 PR 조건부 병합. 미실행 실측·웹 UI·운영 실행을 완료로 기록하지 않는다.

## 작업

- [x] 최신 main·기존 계약·승인·Story 범위 확인
- [x] red → API/DB/새 migration 구현
- [x] 경계·삭제·경합·탈퇴·SQL·백업·타입 하네스 검증
- [x] 전체 회귀·소스 리뷰·증거 보존
- [x] 커밋·PR·재검토·조건부 병합 및 결과 기록

## 근거와 기술 결정

복합 FK와 NOT NULL/CHECK를 함께 사용한다: [PostgreSQL18 constraints](https://www.postgresql.org/docs/18/ddl-constraints.html). 대기 후 세션 재확인과 user KEY SHARE는 reset/withdrawal 경합을 다룬다: [PostgreSQL18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html). Python API 유효성 검사만으로 DB 제약을 대신하지 않는다: [Pydantic validators](https://docs.pydantic.dev/latest/concepts/validators/).

## Dev Agent Record

실제 미구현404 red 이후 구현했고 초기 +09:00 반환·기존 FK guard 시험 경합 실패를 보완했다. 읽기 전용 리뷰의 UTC/유한 시각·날짜 overflow 및 불가능한 정상 시간 합집합을 실제 API/SQL red와 제약 보완으로 검증했다. 고정 계약의 합집합 상·하한에 더해 `measured−any_bad ≤ 각 지표 measured−bad 합`을 보존한다. 자세 임계값은 바꾸지 않았다.

실제 전체457 API·590 frontend, production Chrome 공개8/알림 설정4와 native 복구를 통과했다. 마지막 추가 OpenAPI 시험은 전역 ErrorOut으로 최초부터 통과했으며 red 파일명만으로 실패라 부르지 않는다. 추가 전체 회귀의 sandbox DB 소켓/프로세스 차단 실패 원본을 보존하고 필요한 로컬 접근으로 전체458 API를 실제 재실행해 실패/오류/skip0(130.66초)을 확인했다. 기존 asyncio warning1은 별도다. 최종 Ruff/format/mypy도 통과했다. [실제 실패·통과·화면과 한계](../review/minute-summaries/README.md)에 결과를 기록한다.

BMAD create/dev Story와 engineering:code-review를 적용했다. 저장소 `_bmad` resolver는 missing-file이며 설치/설정 성공을 주장하지 않는다. 독립 최종 읽기 전용 리뷰는 미해결 scoped P1/P2 없음이다. API/DB 회귀는 작성자가 실제 실행하고 임상 검증과 구분한다. web-design-studio의 기존 화이트·블루 웹 계약을 유지했으며 신규 UI·Figma/axe는 없다. 공개 측정 생산자0·출시 허용 동작0·전체1~6 미완료와 별도 승인 경계를 유지한다.

[PR48](https://github.com/HSU-OAS/bodyguard/pull/48)의 실제 source36bbab52576e2d600b4750967547cf12706f2dfe를 merge654688be08ede24351491b687acae2b630dd674b로 2026-10-06T05:06:42Z 병합했다. 실제 부모fccd5c4/36bbab5·원격 main 포함·브랜치 보존·clean을 확인했다. 병합 직전80파일 원격/로컬 diff 본문·hunk 좌표, source20/artifact54 SHA·정확한 HEAD/CLEAN/MERGEABLE·체크 없음·외부 리뷰0을 확인했다. [작성자 검토](https://github.com/HSU-OAS/bodyguard/pull/48#issuecomment-6009724542)는 외부 전문가 승인으로 표시하지 않는다. 소유한 시험 DB4개 서버도 PID/data/command를 대조해 종료했고 원본/로그/DB 파일은 삭제하지 않았다. 다음 Story는 같은 API를 읽는 웹 화면이며 서버/임상/전체 출시 게이트 통과가 아니다.

## File List

- backend/app/summaries.py, db.py, main.py, readiness.py; 새 migrations/versions/0008_minute_summaries.py; backend/README.md
- backend/tests/test_summaries.py, test_summary_races.py, minute_fixture.mjs, backup_restore_proof.py, test_backup_restore_proof.py
- 기존 auth/google/reset/withdrawal/records/notifications/baselines 시험의 head 기대값; test_baseline_races.py의 빈 child migration 분리; 기존 migration·제품 인증 동작은 보존
- frontend/src/api/generated/index.ts, types.gen.ts: 실제 OpenAPI 재생성
- docs/stories/minute-summaries-api.md, docs/review/minute-summaries/: 실제 실패/통과·PNG·SHA·수집기
- docs/tasks.md: 현재 Story 결과·다음 독립 연결과 미완료 단계 경계

## Change Log

- 2026-10-06: S4.14 계약 확정. 덮어쓰기 대신 동일 재시도/충돌 거부, 지표별 분모·방법 보존, 별도 기간 삭제 포함.
- 2026-10-06: 실제 요약/경합·SQL 제약·native 복구 구현, UTC/날짜/합집합·기존 guard 시험 보완과 실패 보존. 최종 추가 회귀·원격 PR 게이트 진행 중.
- 2026-10-06: 추가 OpenAPI 시험/전체458 API 재실행 통과·실행 제한 실패 원본 보존. 로컬 검증 완료, 조건부 원격 PR 게이트 진행.
- 2026-10-06: PR48 실제 merge commit·부모/main 포함·브랜치 보존 확인. API 범위만 완료, 후속 웹 화면과 전체 출시 미완료 유지.
