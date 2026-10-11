# 기존 기록 화면의 일·주 집계 — S4.R10

2026-10-12 실행 · 시작 main e7f513af(PR146 merge) · codex/record-period-summary

## 실제 작동하는 화면과 사용자 흐름

기존 `/posture-records`에서 **날짜·일/주 선택 → 요약 조회**로 본인 전체 기간의 기록 분 수/측정 시간, 완료·중단·건너뜀과 부위별 지표를 확인한다. 현재 목록20개를 전체 집계로 대신하지 않는다. 주는 월~일, 시간대는 브라우저 IANA이다. 날짜/단위 편집은 옛 결과를 버리고 자동 조회하지 않는다. 값이 없으면 ‘—’이며 정상 판정/알림0을 만들지 않는다. 다른 기준선/버전/방법/단위의 지표는 합치지 않는다.

조회 실패 → 같은 버튼에서 **요약 다시 조회**, 실제 삭제 → 오래된 집계 제거/조회 차단 → **기간 다시 조회** 후 새 요약, 현재401/403 → 기존 **계정 다시 확인** 경로와 삭제 권한 회수다. 입력/목록/계정/이탈 수명이 끝난 늦은 응답을 표시하지 않는다. 조회 중 같은 버튼은 초점을 유지하면서 중복 요청을 막는다.

[실제 일 집계](record-period-day.png) · [800px 노트북의 주 집계](record-period-notebook.png) · [오류/재조회](record-period-error.png) · [빈 기록](record-period-empty.png). 생성 시안/편집 이미지가 아닌 Chrome155.0.8059.40의 실제 스크린샷이다. 모든 기록은 합성 시험값이며 실제 사람의 자세/효과 검증이 아니다.

frontend-design을 사용해 기존 백색/블루 토큰·48px 제어·8px 둥근 모서리·글꼴/표/초점을 유지했다. 새 메뉴/route·시안/차트/색 점수/아이콘/모션·대규모 디자인 변경은 없다. 키보드 Enter 조회와 입력 초점 유지, 44px 이상 클릭 영역, 3px focus-visible, 800px 페이지 overflow 없음은 실제 Chrome에서 확인했다. 모바일 지원·스크린리더·확대/다중 기기 사용성은 이번 시험에서 미실행이다.

## 실패와 보완 — 성공으로 대체하지 않음

- 구현 전 실제 App/router/AuthProvider의 결정적 DOM7개는 모두 실패했다. 첫 후보는3통과/4실패: 집계 분 수의 독립 텍스트 경계가 없었고 빈 fixture에 수행 횟수가 남아 있었다. 표시 span을 분리하고 진짜 빈 fixture를 만들었다. 이후7개가 통과했고 경합/기준 분리/초점 시험을 추가했다.
- 최초 Biome의 implicit-any/suppression 위치 오류는 명시 DashboardQuery 타입과 표 스크롤 attribute 옆의 기존 접근성 예외로 수정했다. 최초 출력은 대화 도구 출력이며 별도 원본 로그로 보존했다고 주장하지 않는다. 검사 규칙을 끄거나 unsafe fix하지 않았다.
- 실제 브라우저 첫 실행은 DB 연결 초기 단계에서 exit1이다. 새 시험 DB가 SQL_ASCII라 psycopg가 bytes를 반환했고 SQLAlchemy 버전 확인이 실패했다. 사람/브라우저 시험0이다. 첫 DB는 정상 종료·보존하고 별도 UTF-8 클러스터를 만들었다. 새 initdb의 샌드박스 공유 메모리 실패도 보존했다. 해당 빈 경로의 재초기화만 승인된 escalation으로 성공했으며 제품/운영 DB를 수정하지 않았다.
- 두 번째 실제 실행은2통과/1실패: 자정(KST) 전후의21분을 오늘 하루21개로 기대한 하네스 오류였다. 화면은 오늘10개를 정확히 표시했다. 새 시험은 브라우저의 어제 정오21분을 만들고 해당 날짜를 명시 선택한다. 다른 계정도 같은 날짜에 별도 값을 저장하여 소유권 격리를 계속 검증한다. 기대치를20/10으로 낮추지 않았다.
- 세 번째 실제 실행은2통과/1실패: 조회 중 native disabled 버튼이 Chrome 키보드 초점을 잃었다. 부모 권한 회수 시에는 실제 disabled를 유지하되 조회 대기는 aria-disabled와 동기 single-flight로 처리하고 같은 버튼을 재조회에도 유지한다. 임의의 autofocus/초점 복원은 추가하지 않았다.
- 네 번째 실제 실행은 새3개 모두 통과했고 동일 최종 코드의 원래 기록4개도 통과했다. 위 실패/원본/DB를 삭제하지 않았다. 이것으로 과거 시작P2/간헐 오류 원인을 종결하지 않는다.

## 실제 검증과 보존

최종 DOM 관련7파일/130개·전체105파일/1896개, 원래 타입/notice `pnpm build`, `pnpm check`(기존 info16개), production guard와 `git diff --check`는 exit0이다. 11개의 새 DOM 시험은 HTTP fixture이며 실제 API/SQL 시험으로 세지 않는다. Backend/API/스키마/생성 타입은 변경하지 않았고 전체 backend pytest 재실행은 하지 않았다.

실제 production Chrome→loopback FastAPI→PostgreSQL18.6 UTF-8에서 새3흐름과 기존4흐름을 각각 실행했다. 합성 계정 준비는 기존 가입/인증 API와 로컬 시험 mailbox를 사용했으며 실제 가입 폼/메일 공급자 전체 검증은 아니다. 503/403/지연·응답 단절은 제어 장애이며 정상 읽기/저장/삭제/소유권 확인은 실제 API/SQL이다. final skip/flaky/retry0. 관찰한 각 context의 카메라/외부·GLB/SDK 요청/JS 오류/local-session storage는0이다. 프로세스 전체 egress0의 증명은 아니다.

[실행 요약](verification.json) · [원본/SHA256/크기](manifest.json) · [수집 스크립트](collect.mjs). 63개 원본 로그/source/report/PNG를 보존하며 수집기는 이미 실행된 결과를 대조·복사할 뿐 테스트를 대신하지 않는다. 원본 임시 경로는 `/private/tmp/bodyguard-record-period.Z6gWvG`이다. source13개 SHA/본문도 보존했다. 최종 build와 브라우저 실행은 같은 제품 코드이며 공개 JS/CSS가 이전 main과 동일하다고 주장하지 않는다.

이 Story가 만든 시험 DB `/private/tmp/bodyguard-auth-test.AP2JKe`(최초 SQL_ASCII), `/private/tmp/bodyguard-auth-test.KCGfE7`(UTF-8)만 정상 종료했다. 두 data/PG_VERSION은 존재하고 postmaster.pid는 없으며 API8000/preview4173 리스너도 없다. 시험 데이터/로그와 기존 파일/다른 DB는 보존했다. 원본 환경 파일·시크릿·실제 사용자 데이터는 커밋하지 않는다.

## 작성자 리뷰와 완료 경계

보안: 기존 strict dashboard parser와 committed 계정/세션 lease·서버 본인 조회를 재사용하고 현재401/403만 부모 권한을 회수한다. 영속 저장/영상·좌표·새 개인정보/외부 계측/API·DB migration/운영 변경0이다.

정확성/접근성: 페이지20개와 전체21개, 일/주·명시 날짜·null/기준별 분모·수행만 있는 기간·빈/오류·오래된 응답/403·이탈/목록/삭제 폐기, 중복 조회 차단·대기/입력 초점 유지와 기존 삭제 흐름을 확인했다. 성능: 자동 N+1/폴링/재조회가 없고 명시 GET 한 번, 기존15초 요청 한계/취소를 유지한다. 유지보수: 기존 화면·hook/client·스타일만 연결하고 새 집계 계약을 만들지 않는다.

작성자 리뷰의 발견한 scoped P2는 보완했고 미해결 scoped P1/P2는 없다. 독립 외부/다중 에이전트/전문가 리뷰0이다. 이 문서 시점에는 원격 최신 main/diff/exact HEAD/CLEAN/체크 재확인과 사전 승인 조건부 merge commit 게이트가 대기 중이다. 체크가 없으면 ‘체크 없음’, 브랜치 자동 삭제0이다.

네 부가 기능은 [ADR-0019](../../adr/0019-first-release-core-scope.md)의 출시 후 범위다. Draft51·기존 실패/시작P2·아바타/참여자/Docker/문의/Gmail·Google 공급자 보류를 유지한다. 실제 추천/판정/보정·최종 고품질 아바타·실측·권리/법무·HTTPS/운영 및 **전체1~6 완료/출시 후보판은 아직 아니다**.
