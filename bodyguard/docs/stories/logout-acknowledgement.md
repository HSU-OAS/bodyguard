# S4.17 — 로그아웃 서버 확인 계약

2026-10-10 · 명세/하네스 먼저 · 시작 main `ced8c9b56b721fab29806a9367ea424ef4103692` (PR #112 병합) · `codex/logout-acknowledgement`.

## 목적 / 기존 계약

FR-U-04·NFR-08의 기존 서버 로그아웃은 실제 세션 폐기 commit 이후 **204**이다. 웹은 서버 확인 전 개인 화면을 닫고, 불확실하면 기존 `logout-error` 재시도 화면을 유지해야 한다. 현재 client `logout()`은 예상 응답 status를 검사하지 않아 다른2xx JSON도 성공으로 수용할 수 있다. 실제 제품 서버가200을 반환한다는 주장이 아니라, 계약에 맞지 않는 응답을 client가 어떻게 다루는지 먼저 재현한다.

이것은 기존 fail-closed 계약의 보완이다. 인증 권한/보관 기간/개인정보 수집·시크릿/운영 정책·회원 기능을 새로 바꾸지 않는다. 아바타 보류·독립 웹 진행, 미승인 화면 구성 추가 금지를 유지한다. 기존 재시도 화면만 사용하며 화면/CSS/문구/새 탭을 추가하지 않는다.

## 수용 기준

1. client 로그아웃 성공은 기존 계약의204만 인정한다.200/201/202/203/205/206 등 다른 성공 응답은 고정 내부 ApiError503이며 body가 성공처럼 생겼어도 완료로 수용하지 않는다. 기존 비2xx 상태·Retry-After·CSRF/timeout/cancel 경계는 유지한다.
2. 다른2xx 응답 시 `logout-error` 유지·개인 정보 숨김. focus/다른 탭의 account-change 이벤트로 기존 세션의 개인 화면을 자동 복원하거나 로그아웃 완료 방송을 보내지 않는다. 명시적 재시도에 실제204가 돌아온 뒤에만 guest/다른 탭 폐기를 진행한다.
3. 새 소유 시험 DB·실제 계정/세션/Chrome에서 잘못된 logout HTTP 응답을 **하네스가 주입**한다. 잘못된 응답 동안 원래 DB 세션은 여전히 유효하다는 사실과 UI 차단을 함께 확인한다. 주입을 제거한 명시적 재시도는 실제 server204와 기존 쿠키401, 다른 탭 개인 화면 제거로 검증한다.
4. 원본 영상/좌표/GLB·신규 아바타 검증0. 두 새 웹 사례에서 카메라 호출·모델/외부 요청0, 최종 local/session storage 항목0, 주 페이지 pageerror0을 확인한다. 순간적인 storage 쓰기나 다른 탭 pageerror까지 검증했다고 표시하지 않는다. 합성 계정/메일·잘못된 wire 주입을 실제 공급자·native 서버 결함·사람/운동 검증으로 표시하지 않는다.
5. 기존 계정 하네스 결과의 새 실행은 고유 폴더/JSON으로 보존한다. RED/최종 입력과 결과를 구분하고 old case body는 유지한다. 새/기존 DOM·client race·계정/기록 HTTP·관련 SQL·typecheck/Biome/build/public guard/diff 검증을 위험에 비례해 실제 실행한다.

## 작업 / 검증 순서

engineering debug/testing-strategy: client·상태 머신의 결정적 RED → 실제 시험 Chrome/API/SQL의 wire 결함 RED → 기존 request의 expected204 한 곳 보완 → 단위/DOM·실제 retry204/old-cookie401·다른 탭·기존 보호 상태 검증 → 품질/증거/작성자 review → 최신 main/diff/HEAD/CLEAN/체크 및 사전 승인 조건 충족 시 PR/merge commit. native 시험 DB는 conftest 소유·advisory lock을 통과한 신규 PostgreSQL18/socket0700/TCP없음으로 한정한다. 운영 DB/사용자 서버를 초기화하지 않는다.

## 제외 / 미완료

서버 endpoint·API schema/DB migration/정책·운영·비용·시크릿·배포·출시·UI 구조·디자인 방향 적용·새 아바타 author/변형 시험 없음. 기존 시작P2·타입 오류·동작0/실측/아바타·UI/SDK 승인·Q13/27/32·실제 공급자/HTTPS/운영·전체1~6 미완료를 유지한다. 잘못된 응답이 서버에서 실제204 폐기 후 변형되는 경우도 client는 불확실 상태로 남으며 401/새 session 확인 없이 임의 재개하지 않는다.

## 결과

명세 작성 후 client/DOM RED16건(8실패/8통과)과 native 웹 RED 두 실행(각0통과/2실패)을 보존했다. 관측을 추가한 두 번째 RED에서는 잘못된200/202 주입 뒤 native 세션200·웹 `/login` 이동을 실제 확인했다. 기존 expected-status 검사에 로그아웃204 조건만 추가한 뒤 부품42·전체frontend1497·실제 계정 웹11/통합2/비밀번호5/기록11·관련 SQL64·정적/build/public guard/diff 검증을 통과했다. 자세한 source 차이·초기 설치 실패·관측 한계와 작성자 리뷰는 [증거](../review/logout-acknowledgement/README.md)에 기록했다.

최종 입력12개와 변경하지 않은 제품/설정186개, gzip 증거108개를 SHA로 확인했다. scoped Story의 검증 완료이며 전체4단계/1~6단계 완료가 아니다. 기존 S4.9 기록 소유 컨텍스트와의 번호 중복을 피하도록 이번 문서의 ID는 S4.17로 정리했다. 최신 원격 diff·HEAD·충돌·체크를 확인하는 조건부 PR 게이트는 아직 별도다.
