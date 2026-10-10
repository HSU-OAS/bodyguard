# S5.6 계정 소유·삭제 연결 준비 검사

2026-10-10 · 시작 main9f589776(PR #111 병합) · [사전 명세](../../stories/readiness-owned-constraints.md).

## 실제로 바뀐 동작

준비 검사가 DB 버전/열만 확인하고 필수 FK 소실을 놓치는 결함을 실제 새 DB에서 재현해 수정했다. 손상된 소유/삭제 연결은 `ready:503/unavailable`, `live:200/alive`; 원본 제약을 복원하면 `ready:200/ready`다. 회원·기록·코칭 화면은 바뀌지 않는다. FK 이름 변경은 정상이며 다른 schema의 같은 이름 FK로 결함을 가릴 수 없다. 현재 필수 FK9개의 관계/컬럼 순서와 기존 metadata의 의미, validated/enforced·활성 trigger·origin/local 실행 모드를 검사한다. 원본·migration을 자동 수정하지 않는다.

## 실행 결과와 실패 보존

| 실행 | 실제 결과 | 범위/한계 |
|---|---|---|
| 제품 변경 전 RED | 20실패 / 2통과 (22건) | FK9개 제거, 삭제/참조/복합/MATCH/검증/지연 속성, 부모/자식 trigger, replica, 다른 schema, 실제 HTTP 모두200 오판정. 이름 변경/local2건은 정상. 실패 후 finally 복원 |
| 중간 GREEN | 41통과 | 신규22+기존19. 로그/XML 보존. 중간 시험 소스의 별도 정확한 snapshot은 없으므로 최종 freeze 증거로 쓰지 않음 |
| 전체 backend | 509통과, 경고2 | 신규25 포함. 실제 격리 SQL·계정/기록/권한/삭제/경쟁/HTTP 회귀. 기존 버전·deadline/메일/Google 주입은 합성. 제품 소스는 최종과 같으나 하네스 import 정리 전 |
| 최종 준비 시험 | 44통과 | 신규25+기존19, 최종 frozen 입력. 실제 NOT ENFORCED/deferrable-immediate/UPDATE 변경 추가. SQL timeout/lock/role·비대기/고정 응답·읽기 전용·HTTP 복원 |
| mypy 확대 시도 | 기존 테스트12오류 | main과 같은 원본에서 동일12개 재현. 새 하네스가 기존 테스트 helper를 import하여 이 오류도 포함되던 문제를 자체 digest helper로 보완. 원본 readiness 테스트는 byte 동일 |
| 최종 정적 | mypy12소스 통과, Ruff/format38파일 통과 | app와 신규 하네스 검사. 기존 readiness 테스트 전체의 타입 오류까지 해결한 것은 아님 |
| 계약 | 실제 OpenAPI SHA 동일 | `02d145b6d91f2cdf71ba1d962f65bd6d29e1cd84ab49140f4e65d66ddc980cbf`; schema/API·생성 타입 변경 없음. 타입 생성/브라우저/프런트 빌드는 이번에 재실행하지 않음 |

경고2는 기존 asyncio 비권장 함수와 Pydantic X-CSRF-Token alias 경고이며 원문 보존. `.github` 경로 탐색은 파일 없음으로 exit2였으며 CI 체크 통과 증거가 아니다. 중간 mypy/검색 실패를 성공으로 덮어쓰지 않는다.

## 실제/합성 구분과 격리

- 새 `/private/tmp/bodyguard-auth-test.BshP3Z10`/socket0700·UID501, PostgreSQL18.6/libpq18.6·bodyguard_test role/DB·TCP 없음. 기존 conftest의 소유 guard/advisory lock을 거친 시험 migration/DDL만 실행했다. 원본 이름/정의를 finally로 복원한다.
- 손상/복원은 실제 PostgreSQL 시스템 카탈로그/제약이며 production 설정 handler는 소유 loopback HTTP로 검증했다. 브라우저·카메라·사람·메일/Google 실연결·TLS·배포는 아니다. 계정/메일/행은 합성이고 전 테이블 digest만 비교한다.
- native 최종 소스와 전체 회귀 소스를 별도로 보존했다. 사용자 행/메일/쿠키를 준비 검사에서 읽거나 갱신하지 않으며 인증 pool을 사용하지 않는다. 기존 3초 **취소 deadline**/SQL1초/lock250ms/동시1·대기0은 유지한다. HTTP3초 SLA로 부풀리지 않는다.
- 제품/설정186파일(변경 readiness 제외) SHA는 시작 main과 동일. frontend·마네킹 원본/GLB·외형/변형 시험·공개 화면·CI·의존성·DB schema/정책 변경0. 아바타 보류·독립 웹 진행 지시를 따른다.
- 시험 서버의 data_directory·role·버전·TCP 없음·UID501/PID41600을 도구 출력으로 확인한 뒤 pg_ctl 정상 중단. 디렉터리와 전체 로그는 보존했다. `owned-stop.log`는 종료 로그이며 앞선 소유 확인 출력까지 들어 있다고 주장하지 않는다.

## 작성자 코드 리뷰

engineering code-review 스킬의 보안·성능·정확성·유지보수 관점으로 main 대비 전체 diff/하네스/증거를 재검토했다. 별도 리뷰 에이전트/전문가 승인으로 표현하지 않는다.

- SQL: 고정 쿼리+metadata parameter, search_path의 relation OID/순서 있는 attnum; 임의 사용자 입력/테이블 이름 SQL 결합 없음. catalog만 추가 조회, 고정 공개 상태/응답과 읽기 전용 연결 유지.
- 자원: 필수9개로 한정, 기존 deadline·비대기·connection 종료; 실제 timeout/lock/권한/상태 복원 검증. 타 DB 서버·사용자 파일 삭제 없음.
- 의미: CASCADE/MATCH/갱신/지연/검증/enforced/trigger와 양쪽 relation을 확인; 이름에 의존하지 않음. 새 개인정보/보관 정책이나 자동 고장 복구를 만들지 않음.
- 하네스: native 결함 뒤 finally 복원·전체 행 digest/메일/쿠키 확인. 기존 untyped 테스트 import를 보완한 최종 하네스로44건/mypy를 다시 실행했으며 전체509의 소스 차이를 숨기지 않음.
- 증거: RED·경고·실패와 실제/합성/미실행 분리. 좁은 수정 범위의 미해결P1/P2 없음. 기존 전체 출시 문제는 아래에 유지.

## 재현/증거

`node bodyguard/docs/review/readiness-owned-constraints/collect.mjs --check`는 [manifest.json](manifest.json)의24gzip 원본/압축 SHA·52입력과186불변 파일을 확인한다. **시험을 재실행하는 명령은 아니다.** 새 시험 DB에서 backend README의 환경/소유 조건을 충족한 뒤 `pytest tests/test_readiness_constraints.py tests/test_readiness.py -q`로 실행한다. 운영 DB를 이 하네스에 넣지 않는다.

## 그대로 남는 출시 조건

현재 결과는 S5.6의 런타임 guard이지 전체5단계/1~6단계·출시 완료가 아니다. 이전 시작P2·기존 테스트 타입 오류, 승인 코칭 구조/SDK 외부 통신, 실측/실참여자·출시 동작0·아바타 보류·권리/최종 외형, Q13/PDF·Q27/LLM·Q32, 실제 공급자/HTTPS/컨테이너·보안/운영/법무·백업 복원 후 삭제/세션 재등장 문제가 남는다. 보관/복원 journal 등 중요한 개인정보 변경·운영 DB·비용·시크릿·배포·출시는 별도 승인이다.
