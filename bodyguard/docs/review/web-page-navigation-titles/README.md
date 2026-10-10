# 웹 페이지 식별·복귀 검증

[Story](../../stories/web-page-navigation-titles.md) · base `dd6bde6ba83ccf00e754ceae87ce9ae2fde0ec76` · `codex/web-page-navigation-titles`

## 실제로 달라진 것

서비스 소개의 탭 제목은 `서비스 소개 · BODYGUARD`, 없는 주소는 `페이지를 찾을 수 없습니다 · BODYGUARD`다. 없는 주소에서 기존 소개 복귀→로그인 이동이 정상 작동한다. Router가 허용하는 대소문자/trailing slash에서도 제목·현재 메뉴를 정확히 식별한다. `/records-not-a-page`처럼 비슷한 주소를 개인 메뉴로 잘못 표시하지 않는다. 본문/메뉴/레이아웃/CSS·계정/API 정책을 새로 설계하지 않았다.

초기 기록·설정·탈퇴 제목 추정은 각 화면 자체 title/focus와 Shell return을 읽고 철회했다. 기존 개인 화면의 title/focus 소유권은 유지한다. frontend-design의 짧은 기존 어휘/명확한 상태 식별을 적용했고 새 디자인 방향/코칭 구조는 승인된 것으로 만들지 않았다.

## 재현과 검증 범위

- 최초 DOM: 기존3개 통과·신규 소개/없는 주소2개 실패. 실제 baseline Chrome도1440/1024에서 소개/없는 주소4개가 잘못된 `자세 코칭` 제목이었다. 로그인2개는 정상. [실제 baseline](browser-before.json).
- 수정 후 첫 Chrome6개 통과와 기존 화면 body hash6개 동일. 마지막 source에서는 동일6개와 HELP///·LOGIN/4개가 통과했다. [실제 최종10개](browser-final.json). Chrome155.0.8059.40, 계정 API 응답은 모의다. 실제 서버/계정/DB/HTTPS 시험이 아니다.
- 두 번의 범위 보완을 포함한 최종 frontend78파일/1600개 통과. 관련91개 통과는 case 보완 이전 결과이며 최종 전체 회귀가 이후 source를 검증했다. 실제 사람/동작 정확도·3D/원본/GLB 검증이 아니다.
- 최종 TypeScript·범위 한정 Biome·Vite production build·개발 코칭/카메라 코드 제외·diff/문서 링크를 확인했다. `pnpm assets`나 전체 `pnpm build`를 실행했다고 쓰지 않는다. Vite를 새 scratch outDir에 직접 실행해 기존 dist/에셋을 보존했다.

처음 추가한 하네스는 reset 페이지가 query/fragment를 제거하며 canonical `/password/reset`로 replace하는 기존 보안 계약을 잘못 기대해1개 실패했다. 원래 PasswordPage를 읽고 새 assertion이 기존 정책을 확인하도록 바로잡았으며 제품 복구 코드는 변경0이다. 테스트의 잘못된 `getByRole exact` 옵션으로 첫 tsc도 실패했고 올바른 API 사용으로 수정했다. timeout 완화/실패 무시/개인 화면 제외는 없었다.

원본 로그·baseline/중간/final build·PNG·보고서는 `/private/tmp/bodyguard-page-titles.QDs4a9`에 보존했다. 주요 log/source/build SHA는 [summary.json](summary.json)에 있다. 앞선 중간 Chrome6개/FE1597 통과를 지우거나 최종 case 검증으로 부르지 않는다. PNG는 viewport만 캡처하므로 탭 제목 자체의 증거는 screenshot이 아닌 실제 page.title 보고서다. 기존 공개 홈/없는 페이지의 화면을 확인했으며 최종 승인 디자인이나 새 아바타 시안은 아니다.

## 실제 Chrome 재현

기존 설치 Playwright와 Chrome, 검증할 Vite production output, **새 output 디렉터리**가 필요하다. [시험 source](browser-titles.mjs)는 loopback 정적 서버와 고정 모의 계정 응답을 사용한다. 앱의 없는 주소 fallback을 렌더하는 SPA 하네스이며 실제 NGINX의 unknown-path404 정책/컨테이너 동작을 검증한 것이 아니다.

```bash
node bodyguard/docs/review/web-page-navigation-titles/browser-titles.mjs /absolute/frontend /absolute/new-production-output /absolute/new-proof-output
```

외부/모델/3D 요청은 시험에서 차단한다. 실제 capture 결과 camera 호출·외부/모델 차단 요청·page 오류는0이었다. original 카메라나 사람을 켜지 않았으며 API/SQL fixture를 실제 생산 데이터로 취급하지 않는다. 브라우저·context·시험 서버는 finally에서 닫았고 명령의 정상 종료를 확인했다.

## 작성자 리뷰·미완료

보안: route 표시는 정적 어휘만 쓰고 URL/query/fragment·이메일/record ID를 반사하거나 수정하지 않는다. 실제 Router/API/권한·reset 보안 로직은 그대로다. case/slash metadata만 맞춘다. 성능: pathname 선형 처리와 기존 effect뿐이며 추가 요청·timer·listener0이다. 정확성: 자체 title/focus를 가진 화면을 canonical 판별로 그대로 제외하고 actual private 회귀·동일 Chrome 흐름·불일치 prefix를 확인했다. 유지보수: 기존 Shell에서 한 목적의 보완이며 새 프레임워크/페이지/복구 정책은 없다. 변경 범위 미해결 P1/P2 없음, 독립 리뷰어 승인이 아닌 작성자 리뷰다.

avatar 보류·출시 적격 동작0·미승인 코칭 구조/SDK 정책·실측/노트북·기존 시작P2·SMTP/Google·Docker/HTTPS/권리/운영·미정 부가 기능·전체1~6은 그대로 미완료다. 이번 보완을 전체 접근성/서비스 완성으로 세지 않는다. PR 게이트는 최신 실제 diff/head/base·충돌·체크/조건부 merge commit을 별도로 확인한다.
