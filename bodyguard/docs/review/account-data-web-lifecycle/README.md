# 계정 데이터 — 실제 탈퇴·동일 이메일 재가입

[S6.21 명세](../../stories/account-data-web-lifecycle.md) · [원본 SHA/실제 결과](manifest.json)

현재 웹에서 **탈퇴 취소→본인 데이터만 삭제→동일 이메일 재가입→비어 있는 수행/자세 기록**을 실제로 확인했다. 수행 기록, 과거·활성 자세 기준선, 1분 요약, 서로 다른 알림 설정을 두 계정에 저장한 상태에서 시험했다. 기존 기능의 회귀이며 새 화면·메뉴·디자인·제품 정책을 추가한 작업은 아니다.

## 확인된 사용자 흐름

- 취소하면 본인의 네 종류 데이터가 값까지 동일하다. 타 계정도 동일하다. 삭제 요청은0이다.
- 웹에서 인증 코드와 확인문을 직접 입력한 탈퇴는 실제204로 완료되고 이전 세션은401이다. 읽기 전용 SQL로 본인 사용자·세션·수행/기준선/요약/설정 행0을 확인했다. 타 계정의 과거/활성 기준선과 기록·설정은 값까지 유지된다.
- 같은 이메일을 실제 가입 화면에 입력·인증하면 새로운 사용자 ID다. 예전 기록/요약/기준선은 돌아오지 않고 옛 상세는404, 알림은 기본값이다. 기록 화면 두 종류는 빈 상태다. 재가입 후에도 옛 소유자 행0과 타 계정 보존을 SQL로 확인했다.
- 기존 탈퇴의 오답·만료/새 코드·메일 실패·429·서버 삭제 후 응답 단절·미전송 실패·취소/좁은 창/키보드/대비를 다시 확인했다. 만료는 **시험 서버 시계 이동**, 네트워크 오류는 **시험 주입**이며 실제10분 대기·실제 공급자 장애라고 표시하지 않는다.
- 현재 최소 문구가 적용된 비밀번호 복구에서 재설정·이전 세션/비밀번호 거부, URL 조각 제거·referrer/storage·키보드, 오래된/사용된/위조/누락 링크, 실제 quota·주입 단절/늦은 응답·취소 뒤 서버 완료, Unicode128자 기존 정책을 확인했다.

메일·계정과 저장한 지표/요약은 합성 fixture다. 초기 계정·데이터는 실제 API로 준비했고 **재가입과 탈퇴는 실제 웹**으로 수행했다. 설치 Chrome155.0.8059.40·production bundle·HTTP/FastAPI·PostgreSQL18.6은 실제다. Gmail/Google·실제 사람/물리 카메라·운동 정확도·배포·법적 보존/백업 삭제 검증은 아니다.

## 실패와 실행 경계

새 전체 데이터 단독 시험은 통과했다. 첫 전체 탈퇴 실행은6통과/1실패였다. Vitest/타입 검사와 겹친 시점에 새 private SQL reader의 `spawnSync`가5000ms에서 ETIMEDOUT으로 실패했다. 첫 count 자체가 완료되지 않았고 이후 흐름은 미실행이다. 내부 import/query별 시간을 계측하지 않아 어느 구간이 원인인지는 확정하지 않았다. 독립 재실행은7개가 통과했지만 동시 부하 성능을 입증하거나 실패를 없던 것으로 만들지 않는다. 제품 source·SQL reader·browser test는 두 전체 실행 사이에 변경0이며5초 reader/expect·30초 case·재시도0·quota를 유지했다. 제품의 기존 시작 P2 해결이 아니다.

첫 PostgreSQL 초기화는 sandbox 공유 메모리 차단으로 실패했다. 새 시험 디렉터리에서 권한 검토 후 초기화했고 운영 DB는 쓰지 않았다. 초기 oracle 시험은 URL 구문 오류로 DB 연결 이전 거부(17통과/1setup오류)였다. 전용 Unix socket URL을 바로잡은 뒤18통과했고, 이후 잘못된 대상은 engine 생성 전 거부함을 더 명시적으로 검사했다. 모델 cache 복사의 대상/상대 경로 오류도 성공으로 세지 않는다. 초기화/복사/포맷 전 Ruff 정적 검사 실패 원문은 대화 도구 출력에 있으며 별도 raw 파일을 만들었다고 하지 않는다.

최종 SQL23개는 native oracle18개와 기존 DB 소유권 경쟁·세 종류 본인 cascade/타인 보존·삭제 후 예외 rollback5개다. 쓰기 시도는 PostgreSQL 자체가SQLSTATE25006으로 거부했고 시험 테이블이 없음을 확인했다. 모델이나 아바타 품질 검증은 실행하지 않았다.

## 증거·검토·보존

private SQL reader는 전용 역할/DB, 소유700모드 Unix socket/data 경로, PG18·TCP 미개방을 확인한다. 고정 whitelist의 count만 repeatable-read/read-only transaction으로 반환하며 이메일·쿠키·코드·지표 값은 출력하지 않는다. 제품 endpoint·브라우저 메모리/번들에 oracle/DB URL을 넣지 않았다.

새 AW-B07은 카메라0·모델/SDK요청0·pageerror0·local/session storage0, 관찰한 브라우저 요청의 동일 출처를 수치/boolean으로 남겼다. API helper도 명시 localhost 주소만 사용한다. 기존 탈퇴6개의 afterEach 동일 경계 assertions를 유지했다. 복구5개는 원래 검사를 그대로 실행했으며 전 요청/저장소의 새 계측이 추가됐다고 하지 않는다. 각 case의 기존 guard 범위만 주장한다.

첫 단독·실패한 전체·최종 전체 보고서/화면/error context, 복구5개의 화면과 **기존 list reporter stdout**(JSON report 없음), source/config/lock 스냅샷·품질 로그를91개 gzip/SHA로 보존했다. 코드는 본인 합성 입력이며 runtime 인증 코드·메일함·복구 토큰·쿠키/API bodies를 공개하지 않았다. snapshot `before-web`은 최초 browser 전에, `final-web`은 마지막 native guard 강화 후 전체 실패/최종/복구 실행 전에 수집했다. 초기 oracle2회는 그 이전 입력이므로 이 snapshot으로 소스가 동일했다고 주장하지 않는다.

frontend1481·typecheck·Biome298(기존 info15/오류0)·Ruff·mypy·production build/producer 누출 guard가 통과했다. 실행 전후 제품/config187개 SHA를 기준 Git blob과 대조했고 공개 bundle도 PR110의 실제 production 결과와 byte 동일하다. `collect.mjs --check`는91개 원문/압축 SHA와 현재 실행 소스12개를 검사하며 native 시험을 다시 실행하지 않는다. 원본·이전 증거는 덮어쓰지 않는다.

증거 helper의 직접 Biome 재검사는 저장소 루트에서 binary를 찾지 못해 실행 전 실패했고, 실제 frontend 작업 디렉터리/설정에서 다시 검사해 통과했다. 이 실패는 도구 출력으로 보존하며 별도 raw 로그가 있다고 하지 않는다. 기존 AW-B01부터6개 test body가 기준 Git blob과 byte 동일함도 비교했다.

시험 DB는 역할/18.6/data 경로/TCP 미개방·UID/권한·소유 PID33864를 확인하고 정상 종료했다. 디렉터리·로그는 보존했다. 초기 실패 로그·보존/종료의 도구 관찰을 실제 운영 복구/backup 시험으로 세지 않는다.

engineering:debug·testing-strategy는 현재 데이터 종류의 검증 공백을 찾고 실제/합성/미실행을 분리하는 데 사용했다. engineering:code-review로 새 oracle 입력/읽기 전용/폐기, 기존6개 test body·시간 제한/guard 보존, 동일 이메일의 소유권·타인 격리, 실행 소스/SHA와 공개 정보 경계를 검토했다. **작성자 검토이며 이 좁은 Story 범위의 미해결 P1/P2 없음**이다. 별도 에이전트·전문가 리뷰는 하지 않았다. 원격 HEAD/diff/충돌·CLEAN·체크를 마지막으로 다시 확인한 뒤에만 조건부 PR 게이트를 적용한다.

## 남은 출시 조건

CEO의 최신 선택 **아바타 보류·독립 웹 진행**을 유지했다. 새 제작/변형 검증0, UI/문구/API/DB정책·CI·운영/배포/비용 변경0이다. 출시 적격 동작0·실측/참여자·최종 아바타/시범·승인 코칭 구조/SDK 정책·기존 시작 P2·외부 공급자/Docker/HTTPS/법무·D2/전체1~6은 미완료다. 이 Story 완료는 전문가 최종 검토만 남은 출시 후보판 선언이 아니다.
