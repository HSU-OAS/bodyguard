# 네이티브 백업·복구 — 실행 증거와 한계

**새 시험 DB에서 로그인→본인 기록 조회·타인404가 실제 복구됐다.** source/target 각각 PostgreSQL18.6, 기존0005 schema, 합성 계정2개·기록3개와 API로 만든 보안 상태다. 기존/운영 DB의 archive는 실행하지 않았다. [시험/운영 승인 경계](../../stage5-backup-restore-runbook.md)·[Story](../../stories/stage5-backup-restore-proof.md).

다음은 보존된 실제 결과다. 정상 native proof는 기술 roundtrip·위험 관찰이며 운영 안전 승인이나 전체5단계 완료가 아니다.

| 증거 | 실제 범위/결과 |
|---|---|
| first-red.xml / gzip | 미구현 모듈 collection error1·exit2·0.17초. DB/dump 시험이 아님 |
| implementation-1-failed.xml / 집계 JSON | native 두 DB·archive/복구/로그인·위험을 실행했지만 schema 비교 false와 잘못된 ready 경로404로 실패. 두 서버 중단 |
| implementation-2-failed.xml / 집계 JSON | ready200 수정 뒤 schema 문자열 차이로 실패. 두 서버 중단 |
| proof-green-1.xml / 집계 JSON |4개 전용 시험 통과6.11초. native 정상 복구·고의 실행 중단 뒤 종료·디렉터리 교체/스키마 변경 거부. 비밀번호 변경 관찰 추가 전 |
| backend-regression.xml | 기존261개 + 새4개,265개 통과75.74초·기존 asyncio deprecation warning1 |
| proof-final.xml / 집계 JSON |4개 통과5.90초. 실제 비밀번호 변경 source401/restore200 관찰과 proof_completed/운영 승인 분리 추가. 인증 파일 override 추가 전 |
| backend-final-regression.xml | 인증 파일 `/dev/null` 지정 당시265개 통과76.71초·기존 asyncio warning1. 이후 리뷰 보완 전 소스 |
| proof-passfile-devnull.xml / 집계 JSON |4개 통과5.75초. `/dev/null`이 일반 파일이 아니라는 libpq 경고를 실제 기록. 이후 소유0600 빈 파일로 대체 |
| pid-guard-regression-failed.xml |265개 통과·다른 프로그램 PID 거부의 오류 형식1개 실패75.34초·warning2. shell 형식이 아닌 ps args를 shlex로 읽어 발생. 종료 신호0, 원본 보존 |
| proof-accepted.xml / 집계 JSON |5개 통과5.70초. 실제 UID/실행 파일을 먼저 확인하고 PostgreSQL의 생성된 data 경로만 확인. 소유 빈 인증 파일·다른 실제 프로그램 PID 거부까지 확인 |
| backend-accepted-regression.xml | 최종 위 source의 기존261 + 새5, **266개 통과75.29초·failure/error/skip0**, 기존 asyncio warning1 |

native 기본 시험은 실제 SQL/API·pg_dump/pg_restore이고, 손상 header는 내부 생성 archive의 변형을 실제 native에서 거부했다. 고의 실행 중단은 시험 주입으로 정상 roundtrip의 성공을 모의한 것이 아니며 DB 두 개는 실제 시작/종료했다. 디렉터리 교체와 schema mutant는 단위 경계다. 전체 회귀의 외부 메일/Google/시계는 기존 합성 fixture며 실제 SMTP/OAuth/Chrome/컨테이너/카메라/배포 검증은 아니다.

원본 archive/실패 schema/DB/SQL 로그는 각 소유 private 경로에만 보존한다. 저장소 JSON은 계정/기록 row·cookie·token·password·security key가 없는 counts/status/hash다. 최초 예외와 추가 실패를 삭제하지 않았다.

스키마 실패는 record_outcome의 PostgreSQL deparse가 array cast에서 element cast로 재구성된 정확한 한 쌍 때문이었다. 모든 나머지 열 속성·PK/unique/FK/CHECK/index는 동일해야 한다. 해당 허용값3개·금지값/NULL·다른 제약을 실제 SQL에서 검사하고 rollback 뒤 fingerprint 불변을 확인했다. broad cast/문자열 무시나 기존 migration 변경은 없다.

source에서 기록/회원 삭제와 세션/자격증명 변경을 실제 적용한 뒤 target은 과거 정보와 폐기 cookie·이전 비밀번호를 다시 허용했다. `operational_restore_approved=false`와 별도 운영 공개 게이트를 유지한다. ready200은 준비 상태에 한정된다.

### 작성자 리뷰·최종 확인

code-review의 보안·성능·정확성·유지보수 렌즈로 새 test-only 모듈/시험/문서를 직접 검토했다. shell=False, 입력 URL/archive 없음, 환경/소유 빈 인증 파일 제한, 새 경로0700·파일0600·inode/PID/실제UID·실행 파일·data guard, source 불변·보안 재생 위험, 두 cleanup 독립 시도와 모의/실제 구분을 확인했다. 종료 PID의 숫자만 믿거나 기본 인증 파일에 의존하는 문제를 범위 내P2 보완으로 처리하고 실제 재검증했다. 이 리뷰는 독립 제3자 리뷰가 아니다. scope는 운영 복구가 아니라 시험/위험 증거이며 전체 출시의 미해결 안전·아바타·실측·공급자·운영 게이트를 숨기지 않는다.

최초 명령2개는 공백 경로 따옴표 누락으로exit127였으며 native/pytest가 실행되지 않았다. 파일 검색의 존재하지 않는 폴더/파일 조회도 상태 변경0이다. sandbox 안의 기존 시험 서버 status가 'no server'였으나 권한 있는 읽기 전용 재확인에서는 동일95355 PID의 소유 시험 서버가 실행 중이었다. 전자를 실제 중단 증거로 사용하지 않았고 기존 서버를 시작/종료하지 않았다. Docker 소켓은 아직 없다.

최종 전용 시험 source SHA256은 helper `b8dc5f14c95001af6e9056806db2c90021a2a300d76947ce597b8ee3b1adb34e`, pytest `b7ece5c6998c6224df2c04fc0843f74aec5daf4b224c8024f44c7048c04213bb`다. 공개 UI/production bundle과 app API·기존 migration/lockfile·CI를 변경하지 않아 이번 Story에서는 frontend 빌드/Chrome/모델/촬영 시험을 새로 실행하지 않았다. 이전 실제 웹 증거와 이번 native 증거를 섞지 않는다.

최종 Ruff 전체30파일·format check, mypy app8파일·문서 상대 링크 대상·증거 key/시크릿 패턴·git diff --check를 확인했다. scope 내 미해결P1/P2는 없다. 운영 restore의 삭제/폐기 재적용과 역할/운영 백업 전략은 **전체5단계 필수 미완료 게이트**이며 이 PR이 활성화하거나 해결했다고 표시하지 않는다. [SHA256 목록](checksums.sha256)은 원본 XML/집계와 실제 source를 묶는다. 최초 gzip 원본도 포함하며 실패를 성공으로 덮지 않았다.

아래 최초 red 시점 기록은 과거 증거로 보존한다.

S5.3은 최신 maincbfd07ff944c94de12674bd982bfe98f075616f0의 codex/stage5-backup-restore에서 시작했다. S5.2 Draft #29의 실제 runtime 미완료를 낮추거나 완료로 표시하지 않고 다음 독립 작업을 분리했다.

실제 `pytest -q tests/test_backup_restore_proof.py`는 미구현 tests.backup_restore_proof 모듈 때문에 **collection error1개/exit2/0.17초**였다. 네이티브 dump/restore를 실행한 실패나 통과가 아니다. 서버/cluster·migration·dump/restore·계정/기록 검사를 아직 실행하지 않았다. [JUnit 가독본](first-red.xml)·줄 끝 공백 정리 전 gzip 원본을 보존한다.

기존 소유 venv/동일 main lockfile의 pytest를 실행기만 재사용했고 기존 BODYGUARD_TEST_DATABASE_URL/engine fixture나 운영 DB는 호출하지 않았다. 실제 확인한 도구는 PostgreSQL18.6 pg_dump/pg_restore·설치된 initdb/pg_ctl이며 아직 프로세스를 시작하지 않았다.

다음 구현은 새 소유 두 cluster·합성 계정/기록·custom archive·빈 대상 restore·native API/SQL·손상 거부·삭제/세션 replay 위험 관찰·소유 자원 정리다. archive/키/행 원문은 레포에 넣지 않는다. 개인정보 retention/안전한 운영 restore·별도 승인·전체1~6단계 게이트는 그대로다.
