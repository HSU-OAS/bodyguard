# S4.R7 — 공통 코칭/재생과 실제 기록 API 통합

기준 main `67c18dde067c10fb8188a92839239ce06d14af7b` · `codex/recorded-playback-api` · FR-U-04·FR-R-03·NFR-07/08

상태: 현재 공통 consumer의 실제 계정/API/격리 SQL 통합·로컬 필수 검증과 작성자 리뷰를 마쳤으며 조건부 PR 게이트를 진행한다. 아바타/참여자/Docker 보류 유지. PR134 source1692d4d→merge67c18dde/main 포함·브랜치 보존을 확인했다.

## 목적·범위

PR133의 공통 `useRecordedPlayback` consumer를 현재 production 웹·AuthProvider·실제 HTTP API·새 소유 PostgreSQL18에서 연결한다. 이전 GET/POST fixture 성공을 실제 SQL 저장/권한 증거로 세지 않는다. 판정·시계·자원·gate·메일은 명시 합성으로 유지하며 공개 코칭/출시 동작0은 바꾸지 않는다.

기존 Auth 코칭 browser 시험을 재사용하되 현재 공통 hook의 완료→명시 저장→기록 상세, 실제 서버 수락 후 응답 단절→명시 동일 DTO 재시도→한 기록, 브라우저 cookie 계정이 바뀌었을 때 기존 CSRF로 저장 거절을 연결한다. 제품 UI/API/임상 기준을 확대하거나 모의 기록을 실제 스트레칭 완료로 공개하지 않는다.

## 수용 기준·하네스

1. 현재 기존6흐름(준비/start/save·같은 계정 refresh·실패/성공 logout·대기 pagehide·서버 revoke)을 실제 계정 API/SQL에서 실행한다. 준비/수행만으로 POST0, 수행 자원 종료 뒤에 명시 save1, 최초 UTC+단조 elapsed와10필드 반환/8필드 요청을 확인한다.
2. 실제201 수락 응답을 시험에서만 끊고 DB GET의 동일 결과를 확인한다. 자동 재시도/새 UUID/관찰값 변경0, 명시 retry200, 요청 byte 동일·DB 기록1을 확인한다. 다른 계정 GET 상세404/목록0.
3. 통지 없이 cookie가 실제 다른 계정으로 바뀌어도 옛 CSRF 저장403, 다른 계정 DB 기록0, 실패 상태 유지·자동 proof refresh0. 기존 소유자 기록을 다른 사용자에게 노출하지 않는다.
4. 테스트 전용 새 config/serve script는 새 소유 scratch에 envDir·product/probe build를 격리한다. 기존 account config/원본 증거를 수정하거나 설치·assets·GLB/SDK를 준비하지 않는다. 기존 Python runner의 명시 config 선택만 추가하고 기본 동작/잠금/DB 소유권을 유지한다.
5. 전체 frontend·타입/범위 Biome·Python harness Ruff/format·문법, 실제8흐름/production private guard·CSP/고지/공개 byte 동일·source/증거 hash·diff와 작성자 리뷰/최신 PR 게이트를 확인한다. 실패/미실행을 실제 결과와 구분한다.

## 제외·완료 조건

실제 사람·물리 카메라/SDK·3D/최종 외형·시범/임상 기준/추천/출시 적격, 실제 Gmail/Google·Docker/HTTPS·운영 DB/migration·시크릿/계정·비용·배포/출시는 제외한다. 소유 시험 DB migration만 기존 locked harness로 실행하고 데이터/증거는 보존한다. 원래 시작 P2/과거 native timeout·전체1~6 기준을 닫지 않는다. 완료는 이번 실제 API 통합 계약이며 전체 출시 후보판은 아니다.

## 실제 결과

[실제 흐름·화면·실패·작성자 리뷰와 검증 구분](../review/recorded-playback-api/README.md), [복원/SHA·명령 결과](../review/recorded-playback-api/verification.json).

현재 production Chrome/AuthProvider/공통 consumer에서 실제 준비→합성 수행→명시 저장→기존 기록 상세가 작동한다. 실제 서버201 수락 후 응답 단절→같은8필드/UUID의 명시 retry200·DB 기록1, 타 계정 상세404/목록0, 통지 없는 cookie 계정 변경의 옛 proof403·명시 retry403/자동 proof refresh0를 확인했다. 기존 refresh/logout/pagehide/server revoke도 실제 계정/API/SQL에서 통과했다.

최초6통과/2실패는 outer 종료/record 상태의 하네스 기대 오류로 보존하고 기존 계약대로 수정했다. 두 번째8통과 뒤 시험 주석의 CSS27byte 추가가 공개 byte 게이트에서 실패했다. 주석만 정리하고 새 DB의 마지막8통과·공개 JS/CSS byte 동일을 확인했다. uv cache 권한 실패·잘못된 verifier 인수 호출도 실제 수행 성공으로 세지 않는다.

전체 frontend1750/98파일·타입/범위 Biome·runner Ruff/format·backend mypy·문법/production guard·CSP/고지/noGLB·diff 통과. gzip141복원/SHA와17개 실행 후 소스 snapshot을 대조했다. 실제 API/preview와 세 소유 DB 종료·원본 보존을 확인했다. 전체 backend pytest/기본 browser config·사람/SDK/임상/최종 아바타·Gmail/Google/Docker/HTTPS/운영은 이번 미실행이다. 작성자 리뷰이며 좁은 범위 미해결 P1/P2 없음, 원래 시작P2/과거 native timeout과 전체1~6 미완료를 유지한다.
