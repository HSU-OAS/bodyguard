# S5.6 — 런타임 준비 검사: 계정 소유·삭제 연결

상태: 구현·로컬 검증 완료, 조건부 PR 게이트 진행 / 2026-10-10. 기준 main `9f589776de80c8d9f3a41a8f8fe1252e58858bde` (PR #111 병합). 아래 명세는 제품 변경 전 작성했다.

## 목적과 범위

기존 준비 검사는 PostgreSQL 18, migration head, 테이블 권한과 컬럼을 확인한다. 계정·세션·기록을 연결하는 필수 외래 키가 실제 DB에서 사라지거나 삭제 전파가 바뀌어도 정상으로 판정하는지 새 소유 시험 DB에서 먼저 재현한다. 재현되면 **기존 metadata의 소유·삭제 계약**을 읽기 전용으로 검사한다. 데이터 정책·schema migration·화면·계정 동작 자체를 바꾸는 Story가 아니다.

선행 문제: 기존 웹 시작 지연의 원인은 아직 미확정이다. 이 Story는 그 성능 문제의 해결 증거가 아니며 독립 진행한다. 아바타는 CEO의 최신 지시에 따라 보류한다.

## 계약 / 수용 기준

- 현재 metadata의 필수 FK 9개: `minute_summaries → users`, 복합 `minute_summaries → baselines`, `baselines → users`, `notification_preferences → users`, `stretch_records → users`, `google_flows → sessions`, `sessions → users`, `password_resets → users`, `account_withdrawals → users`.
- FK 이름이 아니라 앱과 동일한 search_path의 source/target relation OID, **순서 있는 컬럼 대응**, 삭제·갱신 동작, MATCH와 지연 속성을 확인한다. validated/enforced FK와 실제로 활성화된 FK trigger가 필요하다. 현재 계약은 CASCADE 삭제, NO ACTION 갱신, MATCH SIMPLE, 즉시 검사이다.
- 동일 이름의 다른 schema FK가 결함을 숨겨서는 안 된다. FK 이름만 정상적으로 변경한 DB는 거부하지 않는다.
- FK 없음 / 다른 참조 / 복합 컬럼 뒤바뀜 / CASCADE 소실 / NOT VALID / 지연 검사 변경 / FK trigger 비활성 / replica 모드에 대해 `ready`는 고정 503 `{"status":"unavailable"}`. 복원하면 200. `live`는 200을 유지한다.
- 별도 bounded read-only 연결, 기존 3초 전체 기한·1초 SQL·250ms lock·비대기 잠금을 유지한다. 인증 pool·사용자 행을 읽거나 쓰지 않으며 cookie·세션·메일·계정 상태를 갱신하지 않는다. 외부 schema 이름·DB 오류를 응답으로 노출하지 않는다.
- 기존 API/OpenAPI·개인정보·탈퇴·보관 계약·준비 응답은 유지한다. `ready:200`은 출시/배포 승인도, 백업 복원 후 개인정보 검증 완료도 아니다.

## 하네스와 실행 순서

1. 새 `/private/tmp/bodyguard-auth-test.*` PostgreSQL 18 인스턴스: TCP 없음, 소켓/상위 디렉터리 0700, `bodyguard_test` role/DB. 기존 conftest의 소유·advisory lock을 통과한 뒤 시험 migration만 실행한다. 운영 DB/시크릿은 사용하지 않는다.
2. 테스트 전용 DDL로 FK 결함을 실제 주입하고 모든 경로의 finally에서 원본 이름/정의를 복구한다. 제품 변경 전에 RED 결과를 보존한다.
3. 준비 검사 구현 후 같은 native 결함과 복원, 실제 loopback HTTP production handler, 비관리자 앱 role, 고정 응답과 전 테이블 행 digest 불변을 확인한다.
4. 기존 readiness의 권한·timeout·lock·pool·OpenAPI 검증 및 backend 회귀를 실제 실행한다. synthetic 버전/연결 주입과 실제 SQL/HTTP를 구분한다.
5. Ruff/mypy/format/`git diff --check`, 변경 범위·원격 diff·정확한 HEAD·CLEAN·체크 재검토 후 기존 사전 승인 조건에 따라 PR/merge commit. 체크가 없으면 명시한다.

## 제외 / 남은 게이트

운영 DB migration·자동 schema 복구·배포·비용·법무·백업 삭제 journal·새 retention 정책·외부 인증/메일 실연결·실참여자 측정·새 아바타 제작·UI 확장 없음. 전체 CHECK/PK/index/type 무결성 감사나 적대적 시스템 카탈로그 변조 탐지를 완성했다고 주장하지 않는다. 기존 시작 성능, SDK 외부 통신, 화면 구조 승인, 실제 참여자·HTTPS·아바타·동작 출시 게이트는 그대로 남는다. S5.6 완료를 전체 5단계/1~6단계 완료로 표시하지 않는다.

## 근거

PostgreSQL 18 공식 문서: [pg_constraint](https://www.postgresql.org/docs/18/catalog-pg-constraint.html), [pg_attribute](https://www.postgresql.org/docs/18/catalog-pg-attribute.html), [pg_trigger](https://www.postgresql.org/docs/18/catalog-pg-trigger.html), [session_replication_role](https://www.postgresql.org/docs/18/runtime-config-client.html#GUC-SESSION-REPLICATION-ROLE). SQL 시스템 카탈로그 속성의 기술 근거이며 임상 근거가 아니다.

## 결과

기존 서버가 실제 필수 FK 9개 소실·삭제/참조/복합 순서/MATCH/NOT VALID/지연 속성 손상·부모/자식 trigger 비활성·replica 모드를 정상 준비로 반환하는 RED를 재현했다: 22건 중20실패, 이름 변경/local 모드2통과. 준비 검사에 metadata-derived 카탈로그 확인을 추가한 뒤 손상503/live200→복원200이 작동했다. 실제 FK NOT ENFORCED·즉시이지만 deferrable·갱신 동작 변경도 추가 검증했다.

제품 소스 동일한 전체 backend509통과 후 새 하네스의 불필요한 기존 테스트 import를 해시 비교 helper로 대체했다. 그 **최종** 소스로 신규25/기존19 준비 시험44통과·mypy12소스·Ruff/format38파일을 확인했다. 전체509는 import 정리 **전** 하네스이며 최종 소스 전체509 재실행으로 설명하지 않는다. 기존 readiness 테스트를 명시적으로 추가한 mypy에서12오류가 있었고 기준 main과 같은 원본에서도12개가 재현됐다. 새 하네스까지 이 오류를 끌고 들어오던 import는 보완했고 기존 테스트 파일은 수정하지 않았다.

실제 local production-handler HTTP와 PostgreSQL 18.6, 전 테이블 행 digest 불변·쿠키/메일 부작용 없음·별도 timeout/권한/비대기·복원 검증을 통과했다. 기존 API/OpenAPI SHA는 동일하고 제품/설정186파일이 기준 main과 같다(수정한 readiness 제외). 새 브라우저/아바타/실참여자/외부/HTTPS 시험은0이다. [원본 실패·각 실행 소스·검증·작성자 리뷰](../review/readiness-owned-constraints/README.md)와24gzip/52입력 SHA를 보존했다. 시험 DB는 정확한 소유 UID/PID/경로·TCP 없음 확인 후 정상 종료했고 디렉터리/로그는 보존했다.

미해결 scoped P1/P2 없음. 기존 시작P2·기존 테스트 타입 오류·출시 동작0/실측/아바타 보류·UI/SDK 승인·외부/운영·전체1~6 게이트는 미완료다. 이 결과로 준비 검사만 보완하며 5단계나 출시 후보판 완료를 선언하지 않는다.
