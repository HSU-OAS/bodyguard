# 현재 웹 교차 흐름 — 최초 실행과 검증 범위

현재 실제 두 교차 흐름의 구현·검증/작성자 리뷰를 마치고 PR 게이트를 진행한다. 전체6단계 통과가 아니라 현재 작동하는 공개·계정/기록 **웹**의 통합 기초다.

## 실제 작동한 화면·사용자 여정

1. 소개→도움말/데이터 안내→실제 이메일 가입/코드 검증→내 시작→직접 선택·추천의 준비 상태→기록 빈 화면이 이어졌다. /me·회원 API를 성공 mock으로 바꾸지 않았다. 실제 공급자 대신 비공개 합성 mailbox만 사용했다.
2. 실제 API에 명시된 client-reported 요약 fixture를 저장하고 목록/상세·중단/정확성 점수 아님 안내를 확인했다. 미리보기→취소로 보존한 뒤 재확인/명시 삭제와 실제 빈 목록을 확인했다. 이 삽입은 코칭 producer나 실제 운동이 아니다.
3. 계정 화면·700px 웹 창·제목 focus·keyboard logout→기록 보호 경로/로그인·실제 me401을 확인했다. 현재 화이트·블루 웹 그대로이며 레이아웃/새 기능을 바꾸지 않았다.
4. me 요청 실패를 명시 route.abort로 주입해도 공개 도움말/데이터/새로고침은 작동하고 개인 계정은 닫혔다. production /dev/measure·/dev/select404, 카메라/모델·GLB·외부 요청/브라우저 저장/페이지 오류0·overflow0이다. 주입 장애/요청 미발생은 실제 카메라/공급자·운영 장애 검증이 아니다.

실제 [계정 화면](integration-20261005T112912626751Z/integration-WEB-I01-공개→가입→탐색-준비→기록-상세·취소·삭제→계정·로그아웃/integration-account-700.png), [수행 요약 상세](integration-20261005T112912626751Z/integration-WEB-I01-공개→가입→탐색-준비→기록-상세·취소·삭제→계정·로그아웃/integration-record-detail.png), [계정 장애 주입 중 공개 안내](integration-20261005T112912626751Z/integration-WEB-I02-계정-장애-주입·공개-안내-보존·production-개발-경로-차단/integration-public-offline-700.png). 화면의 주소/요약은 합성이며 실제 계정·신체 자료가 아니다.

## 실제 결과와 실패 보존

- [최초 runner red](first-red.txt): argparse suite 미등록 exit2. DB/HTTP/Chrome2case는 미실행이었다.
- [dependency 연결 실패](dependency-link-failure.md): 첫 format/registered runner가 pnpm12의 symlink hoist 거부로 exit1. 등록 runner는 자체 HTTP/시험 DB 준비 뒤 subprocess 실패/자체 서버 정리까지 실행했고 Chrome case는 미실행이었다.
- clone 복사 후 sandbox의 format 재시도는 pnpm의 자동 재연결 과정에서 기존 store 접근/DNS 거부로 tarball fetch에 실패했다. version/lock 변경이나 성공한 다운로드로 세지 않는다. 허용된 runner의 실제 재연결은 resolved194/reused194/downloaded0이었다. 원래 설치/브랜치는 clean이며 소유 symlink는 `/private/tmp/bodyguard-stage6-proof.OzneqF/node_modules-shared-link`에 보존했다. 기존 모델/WASM 캐시도 복사했으며 새 다운로드/아바타 cycle은 없다.
- [첫 실제2case](integration-20261005T112432448314Z/report.json): expected2/unexpected·skip·flaky0,11.7초. formatter 적용 전이다. [최종2case](integration-20261005T112912626751Z/report.json):2/0/0/0,9.8초. 각 원본 PNG/attachment·[최종 stdout](browser-final.stdout)을 보존한다. NO_COLOR/FORCE_COLOR 도구 경고는 기능 통과와 구분한다.
- [최종 DOM327](frontend-accepted.xml): failure/error/skip0. 첫 `pnpm test -- --reporter=...`도327을 통과했지만 이중 -- 때문에 XML이 생성되지 않았다. 이를 원본 XML로 세지 않고 실제 `pnpm exec vitest run --reporter=junit --outputFile=...`으로 다시 생성했다.
- [최종 API/SQL291](backend-regression.xml):83.67초·failure/error/skip0·기존 asyncio warning1. browser 실행 종료 뒤 소유 test DB/harness lock으로 순차 실행했고 그 종료 후 최종 browser를 다시 실행했다. native backup 회귀도 포함하지만 운영 restore 안전 게이트를 완료한 것은 아니다.
- TypeScript/Biome91파일·Ruff/format32·mypy app8, production 실제JS1파일의 DEV catalog/미연결 coaching 문자열0, [source/report 체크섬](checksums.sha256)·git diff check 통과. 현재 모든 기존 Chrome suite를 새로 실행한 결과가 아니다.

작성자 code-review는 실제 runner/e2e/diff를 보안·정확성·유지보수로 확인했다. 모의환경의 성과를 actual 사람·공급자·출시로 승격하지 않고 test-only 등록/고유 결과·현재 강제 origin/CSRF·기존 서버/DB guard·egress 차단을 재사용했다. API/UI·권한·데이터 model·임계값/원본/CI/법무·운영 변경이 없다. scope 내 미해결P1/P2 없음이며 독립 외부/전문가 리뷰가 아니다. ps 조회는 sandbox에서 거부돼 프로세스 검증으로 세지 않았고 다른 서버를 종료하지 않았다.

2단계 외형/실측/통합 이월·실제 동작/추천/아바타/기록 producer·부가 기능, Docker/NGINX/TLS/Draft #29 최신 main 정합, Q-17/26·backup security replay·고지/법무·실제 참여자/노트북·6단계 성능/보안·최종 통합은 그대로 미완료다. 기존 원본/실패를 보존하며 다음 독립 내부 검증을 이어간다.

## 착수 시점 기록 — 보존

S6.1 · main26d5e09541b92b33368ed2638eb307565909178a · [명세](../../stories/stage6-web-integration.md)

첫 실제 `python -m tests.run_browser integration`은 suite 미등록으로 argparse exit2였다. [원본](first-red.txt)을 보존한다. DB/HTTP/Chrome2흐름은 이때 실행하지 않았고 browser failure2/통과로 세지 않는다. runner/config를 최소 등록한 뒤 현재 production 웹의 교차 흐름을 실제 실행한다.

합성 mailbox·client-reported 기록과 주입된 계정 장애는 실제 운동/메일·공급자/운영 장애 검증이 아니다. 카메라/모델/외부 요청을 하지 않으며 기존 설치/캐시를 새 작업트리에서 재사용한다. production UI·새 디자인/모델 다운로드·아바타 동일 부위 사이클·운영 계정/비용/DB·배포는 변경하지 않는다. 기존 원본·증거와 Stage2/전체1~6단계 완료 게이트는 유지한다.
