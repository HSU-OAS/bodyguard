# S4.18 — 본인 일·주 기록 조회 API 분리

2026-10-10 · 시작 main `2f191b87fb54778beddacf2fd17f3c1ae44b15a2` (PR114 병합) · `codex/dashboard-query` · PR115 병합 뒤 통합 main `c6760c1cba1540638016b7ed1b2fee8edd58bc5d`.

## 구현 전 계약과 분리 이유

FR-R-03/06·FR-U-04·ADR-0003·출시4/5: 현재 본인 기록 목록은 페이지 단위다. 첫20행으로 하루/주 전체를 요약하지 않는다. Draft PR51 `bc7b29a793079cfb7feb5ca1998fc484876859e3`의 서버 조회 구현과26개 SQL 시험을 재사용·재검토하여 최신 main의 독립 API로 검증한다. 새 대시보드 화면/메뉴는 디자인 범위 미승인이고 기존 시작P2도 남으므로 이 PR을 병합하거나 완료로 바꾸지 않는다. 서버 API를 준비할 수 있는 것과 전체 웹의 승인/출시를 구분한다.

동일하게 저장된 본인 1분 요약/수행 기록의 **조회만** 추가한다. 새 원시값·보관·집계 저장·진단/점수/효과·normative 기준·알림0건 생성 없음. 날짜/기간/시간대는 요청자가 명시하고 임의의 첫 출시 기본값/Q18을 정하지 않는다. aggregate provenance는 client-reported이며 실제 몸 판정의 정답이 아니다.

## 수용 기준과 실행 하네스

1. GET `/api/v1/records/dashboard?date=YYYY-MM-DD&period=day|week&timezone=IANA`는 본인 쿠키 세션을 기존 authenticate/bind_read로 확인한다. 암시적인 타인 선택이 없고 기대 계정/CSRF가 불일치하면403, guest/폐기된 세션은401, no-store/no-referrer 유지. 새 정책·schema/migration 없음.
2. 날짜 자정부터 다음 자정/월요일부터 다음 월요일의 반열림 기간을 사용한다. 고정24시간이 아닌 IANA 달력/DST/건너뛴 날짜/반복 지역 날짜를 실제 저장 행에 대조한다. 날짜·period·timezone 오류는422다. 수행은 시작 시각으로 한 번 센다.
3. 기간 전체를 하나의 SQL snapshot에서 읽는다. pagination의20행/offset10000을 사용하지 않으며 주10080분 대조·타인/범위 밖 제외를 확인한다. 부위의 기준선/버전/방법/단위는 별개다. 시간 가중 평균/이탈 비율·측정0/null·정밀도 한계는 그대로 보존하며 빈 분/없는 알림·효과를 꾸미지 않는다.
4. 재사용26개 actual FastAPI/SQL 시험으로 RED를 먼저 저장하고 실행 source/결과를 덮어쓰지 않는다. 추가 소유 loopback 실제 HTTP 하네스에서 본인 조회·바인딩403·로그아웃204 뒤 이전 쿠키401과 헤더를 확인한다. 메일/계정/기록은 합성이다. 실제 브라우저/촬영/공급자 검증으로 세지 않는다.
5. 기존 전체backend 회귀·Ruff/format/mypy app, actual OpenAPI 재생성과 frontend 타입/전체unit/Biome/build/private guard를 실행한다. 실제 public JS/CSS byte 불변을 대조하고 계정/기록 화면을 수정하지 않는다. 입력/실패·증거/SHA·작성자 scoped 리뷰·최신 diff/HEAD/main/CLEAN/체크 게이트 후 조건부 merge commit, 원본 브랜치 유지.

## 제외·보존

Draft51의 UI/parser/디자인·과거 실패/시작P2·전체Story/FR-R-03·전체1~6 완료를 이 API로 대체하지 않는다. 신규 대시보드 메뉴/화면·미승인 코칭 구조·producer/판정·PDF/LLM/변화/알림 정책 없음. 아바타 보류·기존 파일/검증 증거 보존·원본/GLB/변형/브라우저 아바타 검증0을 유지한다. 비용/계정/시크릿·운영DBmigration·Docker/배포/출시·법무·중요한 안전/개인정보 변경은 별도 승인이다. 원본 영상/좌표·메일/계정 토큰·쿠키·PG 내부 행을 저장소 증거로 내보내지 않는다.

기존 Draft의 미충족 UI/성능 게이트를 낮추거나 한 번 정상 시험으로 원인을 해결했다고 하지 않는다. API를 따로 준비하는 CTO 기술 결정이며 같은 전체 출시 범위 안의 독립 작업이다. 이 Story가 통과해도 실제 사용자 코칭→결과→대시보드 전체 흐름은 아직 미완료다.

## 진행

missing endpoint SQL26/실제 HTTP1 RED 보존 뒤 구현27·전체backend536를 통과했다. 최초 전체frontend1503/1실패를 독립 PR115의 fixture clock 보완/반례로 해결하고, 비충돌 API 변경을 보존해 최신 main으로 fast-forward한 뒤 전체1505·정적/build/guard/public2 byte 불변을 실제 재확인했다. source16/불변215/압축·원본57 SHA와 격리 DB 소유 확인/정상 중단을 마쳤다. [작동 API·실패/입력/실제·합성·작성자 리뷰](../review/dashboard-query-api/README.md)에 기록했고 scoped 조건부 PR 게이트를 진행한다. 원래 Draft51/UI/전체 출시 조건은 미완료다.
