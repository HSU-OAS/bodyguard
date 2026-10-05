# S5.3 — 네이티브 백업·복구 기초 검증

test-only 기초 Story PR #30 main 병합 · 시작 maincbfd07ff944c94de12674bd982bfe98f075616f0 · codex/stage5-backup-restore · NFR-08·FR-U-05/FR-R-03·release-plan5단계

## 목적·현재 상태

S5.1 서버 생존/DB 준비 상태는 PR #28로 main에 병합됐다. S5.2 [Draft PR #29](https://github.com/HSU-OAS/bodyguard/pull/29)는 현재 공개/계정/기록 웹의 동일한 화이트·블루 파일 선별과 웹/API 로컬 TLS 구성을 작성했지만 실제 Docker engine·이미지/NGINX/TLS/패키지 브라우저 검증이 미완료라 병합하지 않는다. source1336d3d830ebab64cf6c1ce75acf94a71f53cda9·CLEAN/MERGEABLE·체크 없음·Draft/OPEN을 확인했고 브랜치를 보존했다. CLEAN을 필수 runtime 통과로 보지 않는다.

CEO의 외부 연결 대기 중 독립 작업 지속 지시를 따라 최신 main의 별도 브랜치에서 기존 계정/기록 스키마를 실제 dump/restore해 보는 **테스트 전용** 작업을 시작한다. native PostgreSQL18.6의 initdb/pg_ctl/pg_dump/pg_restore가 이미 로컬에 있고 Docker engine 없이 실행할 수 있다. 기존 DB/서버·.env·운영 계정/키·외부 스토리지/secret·운영 migration·스케줄/배포는 사용하거나 변경하지 않는다.

## 수용 기준

1. 기존 서버/URL을 입력으로 받지 않고 새 소유 /private/tmp 경로 안에 두 PostgreSQL18 시험 cluster를 생성한다. TCP를 열지 않고 각각 별도 Unix socket·bodyguard_test DB/역할만 사용한다. 기존 소유권/fixture와 충돌하지 않으며 모든 진행/실패/정리에서 대상 경로/PID의 소유권을 확인한다. 정체된 다른 작업을 종료하지 않는다.
2. source 시험 DB에 기존 Alembic0005_account_withdrawal 스키마를 적용하고 합성 계정2개·기록3개·보안 상태를 준비한다. 기존 migration은 수정하지 않는다. 실제 pg_dump custom archive/검증 hash를 생성하고 빈 두 번째 시험 DB에 native pg_restore --exit-on-error·단일 transaction으로 복구한다. 외부/기존 dump를 실행하지 않는다.
3. snapshot 직후 schema/PK·unique/FK/본인 경계·계정/기록 내용과 native API의 로그인→본인 기록·타인404·제한된ready200을 실제 확인한다. ASGI/TestClient·합성 데이터는 실제 SQL/archive 복구지만 Chrome/컨테이너/SMTP·Google/카메라/참여자·공개 HTTPS 검증이 아니다.
4. 손상 archive를 native 도구에서 거부하고 미완료 복구가 성공 처리되지 않는지 검사한다. restore와 검증이 source DB를 변경하지 않아야 한다. 프로세스/DB의 실패에도 새 소유 cluster만 정상 중단하고 원본/실패·archive/증거는 보존한다. 시험 archive/DB dump·키/암호/토큰·원문 행은 레포/출력에 포함하지 않는다. 증거는 aggregate counts·검사 항목·고정 상태만 기록한다.
5. **기술 roundtrip과 안전한 운영 복구는 별개**다. snapshot 이후 기록/회원 삭제·세션 폐기를 실제 재현하고 오래된 snapshot만 restore했을 때 삭제/폐기를 되살릴 수 있는지 확인한다. source와 restored DB를 구분하고 해당 결과를 원본/남은 게이트에 남긴다. DB ready200이나 계정 login200을 삭제 이력 정합성/운영 복구 완료로 표현하지 않는다.
6. [Q-17 보관/탈퇴](../open-questions.md)·Q-04 hosting의 사업/개인정보 결정을 그대로 유지한다. 기간/RPO/RTO·암호화/보관 위치·retention·삭제/자격증명 변경 재적용/운영 공개 기준을 확정하거나 운영 기능에 적용하지 않는다. 시험 하네스와 위험 증거가 이번 Story의 범위이며 전체5단계/1~6단계 완료·실제 백업 운영은 아니다.

## 하네스·구현 순서

testing-strategy의 실제 도구/경계 검증을 적용한다. 먼저 미구현 proof 모듈을 요구하는 실제 실행 시험을 작성한다. 이후 내부에서만 생성한 archive/소유 cluster에 대해 native 명령과 SQL/API 검사를 연결한다. pytest의 기존 BODYGUARD_TEST_DATABASE_URL/engine fixture를 호출하지 않고 현재 서버를 재사용하지 않는다. dependency/lockfile·app runtime·개인정보 model/기존 해시·삭제 기능은 변경하지 않는다.

구현은 source/target을 정확히 식별하는 최소 ownership guard·새 cluster 생성/정리·기존 migration/합성 데이터·dump/hash/restore·SQL/API 비교와 삭제/세션 replay 위험 관찰 순서다. 실패 결과/미실행을 숨기거나 샘플 proof dict를 실제 증거 대신 반환하지 않는다. 삭제·폐기 재적용을 임의로 production에 구현하는 작업은 이번 Story에 섞지 않는다.

[PostgreSQL 공식 dump 설명](https://www.postgresql.org/docs/18/app-pgdump.html)과 [restore 설명](https://www.postgresql.org/docs/18/app-pgrestore.html)을 확인했다. 이 단일 DB의 논리 archive 시험은 전체 cluster 역할/설정·지속적인 production 백업 전략 검증을 대신하지 않는다. restore는 dump의 SQL을 실행하므로 출처가 불명인 파일은 받지 않는다. 기존 Homebrew 도구 실제 버전은18.6이다.

## 남은 승인·게이트

운영 backup/retention·삭제/탈퇴 이력과 보안 폐기의 복구 후 재적용 정책은 CEO의 별도 중요한 개인정보/사업 승인·정확한 실행 범위/위험/복구 계획이 필요하다. 비용/계정·운영 저장소·secrets·운영 DB migration/복구/배포도 별도다. 구현 완료 때 실제 시험 결과와 권장안·미충족 조건을 구분해 보고하고 다음 독립 작업을 진행한다.

Docker 연결/필수 S5.2 runtime·2단계 아바타/실측/통합 이월·실제 코칭/기록 생산·신체 검증·법무·부가 기능·Stage6/최종 통합은 그대로 남는다. 새 아바타 수정·검증 사이클을 시작하지 않는다.

## 최초 실제 red

미구현 tests.backup_restore_proof 모듈 때문에 collection error1개·exit2·0.17초였다. [원본/실행 구분](../review/stage5-backup-restore/README.md)을 보존했다. 실제 새 cluster/DB·dump/restore·API roundtrip는 아직 실행하지 않았고 성공으로 세지 않는다. 다음은 명세의 native proof 구현이다.

## Tasks / Dev Agent Record

- [x] 최초 실제 red 원본을 보존했다. 그 시점에는 native DB 시험을 실행하지 않았다.
- [x] 새0700 경로·Unix-only cluster 두 개·실제18.6 서버/경로/역할·PID·디렉터리 inode guard를 구현했다. 외부 PG/DB 주소 환경이나 기존 fixture를 받지 않는다.
- [x] 기존0005 migration·합성2계정/3기록/실제 로그인 보안 상태·custom archive/hash·빈 target의 native 단일 transaction restore를 구현했다.
- [x] 전체 application 행의 private fingerprint·schema/열 길이/PK/unique/FK/CHECK/index·실제 제약 거부·API 로그인/본인 기록/타인404/ready200을 확인했다.
- [x] native 손상 archive 거부·target/source 내용 보존, 의도적 실행 중단 뒤 새 두 서버 종료와 경로 교체 거부를 확인했다.
- [x] 실제 source의 기록/회원 삭제·로그아웃·비밀번호/credentials_version 변경 후 snapshot restore가 정보/세션/이전 비밀번호를 재생함을 확인했다. 이는 미해결 운영 공개 게이트이며 정상으로 처리하지 않는다.
- [x] [시험/운영 공개 게이트](../stage5-backup-restore-runbook.md)를 작성했다. 별도 중요한 개인정보/사업 승인 없이 보관/운영 재적용 모델·기능을 변경하지 않았다.
- [x] source8d077eb20bdd089e688a8ca972f4312cb039cf8c의 필수 검증·작성자 리뷰/P2 보완·최신 main/diff/CLEAN/MERGEABLE·체크 없음을 확인하고 [PR #30](https://github.com/HSU-OAS/bodyguard/pull/30)을 merge4599c7c830cdfee786d21df460976fc5efe1c46a로 main 병합했다. main 포함·로컬/원격 source 브랜치 보존을 확인했다. 다음 독립 Story는 S5.4이며 운영/전체5단계 완료가 아니다.

testing-strategy로 native/단위/주입 경계를 나누고 documentation·code-review로 보안/정확성/운영 승인 경계를 검토했다. bmad-dev-story의 로컬 workflow resolver/config가 없으므로 전체 BMAD 실행을 했다고 주장하지 않고 기존 승인 Story의 실패→구현→검증 순서로 진행했다.

첫 native 구현은 스키마 문자열 비교와 잘못된 `/health/ready` 경로 때문에 실패했다. 이후 올바른 `/api/v1/health/ready`를 확인했다. PostgreSQL18.6에서 기존 record_outcome의 array 전체 cast가 restore 후 각 element cast로 바뀌었다. 원본 두 deparse는 private에 보존하고 **해당 제약의 정확한 두 문자열 외 다른 schema 차이는 허용하지 않는다**. 실제 허용값3개·금지값/NULL·PK/unique/FK/CHECK와 rollback 보존을 확인했다. migration/허용값을 변경하거나 검증을 제거하지 않았다.

현재 정상 native proof와 고의 중단/경로 교체/스키마 변경/다른 실제 프로그램 PID 거부의5개 시험이 통과했다. PID/소유 빈 인증 파일 리뷰 보완 뒤 최종 source의 전체266개 회귀가75.29초·failure/error/skip0으로 통과했다. warning1은 기존 asyncio deprecation이며 SMTP/Google 공급자는 기존 합성 fixture다. 이전 실패와 source 차이는 review README에 구분한다. 웹 UI/애니메이션·앱 runtime·dependencies/lockfile·API·기존 migration·CI는 변경하지 않았다. 현재 화이트·블루 디자인 그대로다.

### File List

- backend/tests/backup_restore_proof.py — native 소유 cluster·archive/SQL/API proof와 private 자원 정리.
- backend/tests/test_backup_restore_proof.py — 실제 정상/중단, 디렉터리 교체 경계, 좁은 schema 동등성 시험.
- docs/stage5-backup-restore-runbook.md — 실행/위험 증거/별도 운영 승인 묶음.
- docs/review/stage5-backup-restore/* — 최초/추가 실패·native/회귀 원본·집계와 작성자 리뷰. archive/DB/키/행 원문은 제외.
- docs/stories/stage5-backup-restore-proof.md, docs/tasks.md — 실제 Story 상태·남은 의존성.

### Change Log

2026-10-05: 최초 red와 두 native 실패 보존, 실제 native proof 구현/검증·안전한 운영 복구 미완료를 구분했다. Story는 test-only 기초 범위이며 전체5단계·1~6단계 완료가 아니다.
