# S6.22 — 계정 작업 중 캐시 화면 복원

2026-10-10 · 최신 main `e51ab4b39d5ca14f300248323240d4fded68518b` (PR113 병합) · `codex/auth-page-restore`.

## 구현 전 계약

FR-U-04/NFR-08: 서버가 로그아웃을 확인하기 전 개인 화면을 닫고 불확실하면 명시적 재시도를 유지한다. 기존 focus/계정 변경의 refresh는 진행 중 auth/logout을 취소하지 않는다. 그러나 pageshow.persisted는 어떤 작업이든 abort/null 후 refresh한다. 캐시 복원으로 이미 실패한 logout이나 진행 중인 계정 작업을 덮고 기존 개인 화면을 자동 재개하는지 먼저 재현한다. 새로운 보관/인증 정책이 아니라 기존 동시 작업·fail-closed 계약의 경로 정합화다.

Google [bfcache 안내](https://web.dev/articles/bfcache)는 원래 JS heap·미완료 작업이 복원될 수 있고 실제 복원의 pageshow.persisted=true를 설명한다. SPA 내부 주소 전환이나 합성 이벤트를 실제 캐시 복원으로 세지 않는다. [Playwright 공식 launch](https://playwright.dev/docs/api/class-browsertype#browser-type-launch)는 특정 기본 인자 제외를 지원하며 기능 영향에 주의하도록 한다. 시험에만 캐시 비활성 기본 인자를 제외하고 제품/다른 시험의 실행 조건은 유지한다.

[Playwright goBack 공식 경고](https://playwright.dev/docs/api/class-page#page-go-back)는 bfcache의 탐색 상태 지원 제한을 명시한다. 최초 native3건이 load 대기 실패한 뒤, 캐시 복원 이후 탐색·관측은 원시 Chrome CDP로 분리했다. 원래 문서의 임의 ID와 native pageshow 카운터를 실제 확인하며 시험 결과를 합성 이벤트로 대체하지 않는다.

## 수용 기준·하네스

1. happy-dom/fetch 합성 RED: 실패한 logout·대기 중 logout/auth에서 persisted 복원이 개인 화면을 재개하거나 작업 signal을 abort하지 않는다. 실제204/성공·실패 응답은 원래 작업이 처리한다. 정상 refresh의 오래된 응답은 abort되고 새 /me만 권위다. persisted=false는 변경0.
2. actual Chrome/production 웹/API/새 소유 SQL: 합성 wire 실패 뒤 native 세션은 유효하지만 현재 개인 UI는 차단된 상태다. 실제 문서 이탈/Back에서 **같은 document ID와 native persisted=true**를 확인한 경우에만 bfcache 결과로 센다. 복원이 안 되면 실패/미검증으로 남기며 synthetic pageshow로 대체하지 않는다. 명시 retry 실제204·이전 쿠키401 확인.
3. native 캐시 복원에서 정상 화면의 fresh /me 검증은 유지한다. 다른 계정/폐기된 세션을 이전 ready 데이터로 재개하지 않는다. 계정 값/쿠키는 시험 메모리만 사용하고 원문 payload·영상·좌표·메일 토큰을 증거에 넣지 않는다.
4. 기존 계정·focus·복구·기록 DOM/native HTTP 회귀, tsc/Biome/build/private guard·관련 backend 정적 검증·diff·입력/실패·작성자 코드 리뷰를 위험에 비례해 실행한다. source 및 첫/최종 결과를 덮어쓰지 않는다. 미완료 원인이나 실제 공급자/사람/다장치 검증을 통과로 표시하지 않는다.

## 제외·유지

아바타 보류·자산/실패 보존, 새 원본/GLB/조형/변형/WebGL/카메라·SDK 추론 시험0. 공개 화면/CSS/문구/구조·판정·권리/정책·서버 schema/migration·CI·비용/시크릿·운영/배포/출시 변경0. 현재 전체1~6·시작P2·UI/SDK 승인·실측/참여자·Docker/TLS/외부·복원 개인정보·Q13/27/32 미완료를 유지한다. 이 Story가 역사적 시작 실패13건의 원인/해결이나 모든 브라우저의 캐시 동작을 검증한 것은 아니다.

## 진행

최초 DOM7건 중5제품 실패·1matcher 실패·1통과를 보존했다. matcher만 바로잡은 RED는5실패/2통과다. 최초 native3건은 Playwright goBack의 load 대기 실패이며 그 이후 검증은 실행되지 않았다. 원시 CDP의 관측 RED에서 실제 같은 문서/native persisted1을 확인했고 실패 logout200/503에서 개인 화면이 재등장했다(2실패). 정상 화면의 실제 서버 폐기/동일 브라우저 쿠키 재검사는 통과했다(1통과). 제품의 pageshow에 기존 auth/logout 작업 보호 조건을 추가했다.

최종 부품49·전체frontend1504·native 캐시3/계정11/통합2/비밀번호5/기록11·관련 SQL64·정적/build/guard를 통과했다. source19/불변187/압축·원본120 SHA와 실제 격리 DB 소유/중단을 확인했다. [작동 화면·실패/실제·합성/입력·작성자 리뷰](../review/auth-page-restore/README.md)에 기록했고 scoped 조건부 PR 게이트를 진행한다. 전체1~6/기존 시작P2·UI/SDK·실측/외부/운영 조건을 닫지 않는다.
