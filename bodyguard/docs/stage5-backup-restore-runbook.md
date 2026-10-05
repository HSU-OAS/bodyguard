# 백업·복구 시험과 운영 공개 게이트

S5.3 · NFR-08·FR-U-05/FR-R-03 · **시험 전용, 운영 실행 승인 아님**

## 현재 가능한 것

새 PostgreSQL18 시험 서버 두 개에서 기존 스키마와 합성 계정·기록·보안 상태를 실제 custom archive로 옮기는 하네스가 있다. 복구한 API의 로그인·본인 기록·타인404·DB 준비 상태와 SQL 제약조건을 확인한다. 실패/중단에서도 이 하네스가 새로 만든 서버만 중단하고 원본은 보존한다. [명세](stories/stage5-backup-restore-proof.md)·[실행/실패 증거](review/stage5-backup-restore/README.md).

이것은 웹의 계정·기록이 복구 가능한지 확인한 개발 증거다. 실제 백업 스케줄·외부 저장소·운영 복구·최종 웹 배포·전체5단계 통과는 아니다. 현재 [웹 패키지 Draft #29](https://github.com/HSU-OAS/bodyguard/pull/29)는 별도의 실제 Docker/NGINX/TLS 검증을 기다린다.

## 개발 시험 실행

Python3.14의 기존 잠금 의존성과 PostgreSQL18 native 도구가 필요하다. backend 폴더에서 다음 시험을 실행한다. 운영/기존 DB 주소나 archive를 인자로 받지 않는다. 기존 pytest의 DB fixture도 이 네 가지 전용 시험에서는 호출하지 않는다.

```bash
uv run --locked pytest -q -s tests/test_backup_restore_proof.py
```

실행마다 `/private/tmp/bodyguard-backup-proof.*`의 새 경로를 내부에서 생성한다. 디렉터리는0700, archive와 보고서는0600, TCP listener는 없다. native 명령의 환경을 제한하고 인증 파일은 새 소유 디렉터리의0600 빈 파일로 지정한다. 종료 전 디렉터리/PID뿐 아니라 실제 프로세스의 UID·PostgreSQL 실행 파일·정확한 data 경로를 확인한다. 실제 일반 회귀 시험은 기존 `backend/README.md`의 별도 소유 DB/잠금 규칙을 따른다.

시험 출력의 `proof_completed`와 `owned_servers_stopped`를 함께 확인해야 한다. 의도적으로 중단하는 시험의 private 보고서에는 `proof_completed=false`가 남는다. 정상 종료/오류 여부와 별개로 `operational_restore_approved=false`다. DB ready200을 안전한 공개 승인으로 해석하면 안 된다.

private 경로의 archive·DB·SQL 로그·스키마 진단 파일은 보존하되 Git/PR/브라우저/외부 서비스에 보내지 않는다. 레포에는 집계 JSON·JUnit만 남긴다. 정리 실패나 경로/PID 소유권 변화는 오류다. 다른 서버를 종료하거나 소유권 guard를 우회하지 않는다. 미지의 archive는 SQL 실행 위험이 있어 하네스에 넣을 수 없다. [PostgreSQL 공식 dump](https://www.postgresql.org/docs/18/app-pgdump.html), [restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

## 실제 재현한 운영 위험

| snapshot 이후 실제 source 변화 | source의 결과 | 오래된 snapshot만 복원한 target |
|---|---|---|
| 수행 기록1개와 다른 합성 회원 삭제 | 계정1개·기록1개만 남음, 해당 회원 기록도 cascade 삭제 | 계정2개·기록3개로 돌아와 삭제한 정보가 다시 존재 |
| 기존 로그인 세션을 API에서 로그아웃 | 같은 이전 cookie의 본인 조회401 | 같은 cookie의 본인 조회200 |
| 비밀번호/credentials_version 변경 | 이전 비밀번호 로그인401 | 이전 비밀번호 로그인200 |

계정/기록 내용의 동일성과 위 재생 위험은 동시에 발생했다. 이는 위험을 해결한 시험이 아니라 **문제가 실제 존재함을 확인한 시험**이다. 키 교체만으로 과거 세션/비밀번호가 무효화된다고 주장하지 않는다. 현재 세션은 저장된 token hash와 자격증명 버전으로 검증한다.

## 운영 적용 전에 필요한 별도 승인

CTO 권장 방향은 **복구한 DB를 비공개로 유지 → 세션/인증 challenge 등 보안 상태 폐기 → snapshot 이후 삭제·탈퇴·자격증명 변경의 검증 가능한 이력 대조/재적용 → 재검증 → 별도 공개 승인**이다. 최신 이력의 존재·완전성·적용 여부를 증명할 수 없으면 공개하지 않는 방향을 권장한다. 현재 코드에 운영 재적용 기능/새 개인정보 보관 모델을 만들거나 활성화한 것은 아니다.

실행 전에 Q-17/Q-04/Q-26과 함께 다음 묶음을 CEO에게 제시해야 한다.

- 정확한 대상: 별도 승인한 시험/운영 DB·archive·외부 저장소, 복구 후 공개 차단/해제 범위.
- 데이터/기간: 삭제를 재적용할 최소 식별 이력의 종류·보관 기간·열람 권한·백업 삭제 절차. 개인정보 보관 기간을 개발 기본값으로 확정하지 않는다.
- 비용/계정: 이 Story의 기존 로컬 도구 시험은 새 결제/외부 계정이 없었다. 운영 저장소/hosting/encryption 계약의 실제 비용은 후보/규모 결정 후 확인해야 하며 무료로 단정하지 않는다.
- 위험: 삭제 정보·폐기 세션·이전 비밀번호 재생, 이력 누락, 복구 중 접근/새 쓰기, archive의 민감 정보·실행 SQL, 권한/역할/설정 누락.
- 복구/철회: 원본과 변경 전 증거/백업 보존, 시험은 격리 대상에만 실행, 검증 실패 시 공개 차단 유지. 실제 복구 DB/이력의 재적용 실패에는 새 복구/정리 승인이 필요하다. 기존 운영 데이터/서버를 덮거나 임의 삭제하지 않는다.
- 통과 조건: 기간/RPO/RTO·암호화/보관·삭제/보안 재적용·역할/권한·전체 웹 흐름을 실제 검증한 증거. 현재 단일 DB 논리 archive 시험만으로 충족하지 않는다.

사업/개인정보 결정·비용/계정/시크릿·운영 migration/복구·배포·출시는 [운영 규칙](operating-rules.md)의 별도 승인이다. 이 문서는 절차 권고이며 운영 명령이나 자동화 작업이 아니다. 독립적인 라이선스/보안/내부 검증 준비는 연결을 기다리는 동안 계속 진행한다.
