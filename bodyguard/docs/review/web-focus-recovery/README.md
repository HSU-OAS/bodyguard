# 보호 화면 초점 복구 — 실제 검증

[S6.8 명세](../../stories/web-focus-recovery.md) · base main9f2e76fea919f37f7aae8164278ebc5b53c64e03 · 2026-10-08

## 작동하는 사용자 흐름

계정 확인 후 시작·탐색·계정 제목에 초점이 이어지고, 실패 화면의 “다시 확인”으로 현재 화면을 다시 사용할 수 있다. 사용자가 이미 선택한 헤더·본문·로그인 입력·도움말 FAQ의 초점은 유지한다. 실제 가입→탐색 준비→기록 조회/취소/삭제→계정→키보드 로그아웃·보호 주소 이탈도 기존 Chrome/API/격리 SQL 시험으로 확인했다. 새 화면·메뉴·디자인·미검증 코칭은 추가하지 않았다.

## 실패와 원본

- 첫 DOM11개는5통과/6실패, TS 하네스 수정 뒤12개는6통과/6실패였다. Promise의 TS lib 불일치와 Testing Library 옵션을 하네스에서 수정했으며 제품 수정 전 실패는 보존했다.
- production Chrome의 같은9조건은4통과/5실패였다. 계정 지연·재시도·비활성 조건에서 기존 동작이 실패하고 살아 있는 초점·공개 입력/FAQ 조건은 통과했다. 첫 보완은 DOM12/Chrome9·기존 선택8/실제 통합2를 통과했다.
- 첫 빌드는 새 작업트리에 모델 캐시가 없어 sandbox DNS 실패(exit1), 다음은 하네스 TS 오류(exit2)였다. 기존 캐시를 그대로 복사했으며 새 모델·아바타 제작을 하지 않았다.
- 빌드 준비 전 Chrome runner 실행은 dist 미존재로 시작 전 exit1이었다. 이 호출에서 Chrome 시험은 미실행이며 이후 실제9조건과 구분한다.
- 첫 정적 검사는 formatter와 phase dependency 경고로 실패했다. 리뷰에서 주소 변형14개 중2실패를 추가 재현했고, phase 전환 조건을 명시해 최종 검사에 반영했다.
- 원본 로그/DOM XML·Chrome JSON과 native 시험 DB는 `/private/tmp/bodyguard-focus-recovery.SCPngq`, 최종은 `/private/tmp/bodyguard-focus-recovery.Q6ZkLZ`, DB는 `/private/tmp/bodyguard-auth-test.sWLFZb`에 보존한다. 원본 실패 DOM에는 합성 데이터만 있어도 공개하지 않고 SHA/개수만 [summary.json](summary.json)에 기록한다. 첫 선택 회귀는 stdout을 보존하며 고정 이름 report는 최종 실행본이다.

## 최종 필수 검증 / 한계

- 전체 DOM744개 failure/error/skip0. 기존 부품은 전체 DOM에 포함하며 새 초점 계약14개도 포함한다.
- 실제 production Chrome11조건, 기존 공개·개발 선택8조건, 실제 HTTP/SQL 통합2조건을 통과했다. Chrome의 지연 계정과 비활성 `document.hasFocus()` 조건은 시험 주입이다. native 백그라운드 창·실제 참여자 검증으로 세지 않는다.
- typecheck/Biome/build·production 개발/미검증 producer 차단·문서 링크·diff 검사. 소유 Chrome/loopback 서버 정리, 새 시험 PG18의 Unix 소켓 전용 실행 후 native `pg_ctl status`의 no server running을 확인했다. 기존 서버/DB를 사용하거나 종료하지 않았다.
- 앱 Shell의 초점 로직만 제품 변경이다. 인증 정책·API/기록/판정·SDK·아바타·CSS/화면 구성·lock·CI·운영 변경0. 모의 메일/계정 응답·합성 기록을 실제 공급자·코칭/신체 결과로 세지 않는다.

작성자 code-review로 보안·성능·정확성·경합·자원 정리와 실제 diff를 점검했다. 주소 변형·dependency 경고를 보완해 재검증했으며 scope 미해결P1/P2 없음이다. 독립 리뷰·전문가 승인이 아니다. 병합은 별도로 최신 main/exact HEAD/diff/CLEAN/체크를 실제 확인한 뒤 수행한다.

제품 시작 지연 P2와 Draft #51·#36·#29·#9, 디자인 구조/적용·SDK 승인·Docker/provider·아바타/실측/참여자·운영/법무·전체1~6단계 게이트는 그대로 미완료다. 이전 정상 회귀와 이후 실패 기록도 지우지 않는다.

## 재현

frontend에서 `pnpm exec vitest run src/AppFocus.test.tsx --maxWorkers=1`과 `pnpm build`를 실행한다. 비어 있는 `mktemp -d /private/tmp/bodyguard-focus-recovery.XXXXXX` 결과를 절대 경로로 전달해 `node scripts/test-focus-browser.mjs <그 경로> green`을 실행한다. 기존 증거가 있으면 시작 전에 거부한다. 실제 통합은 전용 시험 DB guard 아래 `python -m tests.run_browser integration`으로 실행하며 공급자·운영 DB를 연결하지 않는다.
