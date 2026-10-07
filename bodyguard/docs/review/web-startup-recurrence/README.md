# 웹 시작 회귀 원인 분리

[Story S6.7](../../stories/web-startup-recurrence.md) · [실제 수치·원본 SHA](summary.json)

시작/도움말이 늦어지는 기존 실패는 **미해결**이다. 이번 변경은 진단 helper의 잘못된 개발 모드를 보완하고 thread-time/CPU 표본을 수집하는 test-only 작업이다. 제품 화면·인증/판정·SDK/아바타·API/DB/운영 변경은 없다.

## 실제 흐름과 실패

- db0b53a의 별도 선택 Chrome2통과/6실패·실제 HTTP/SQL 통합0통과/2실패가 마지막 완료 보고에 빠진 것을 다시 확인했다. 그 이후 PR #60은 실제로 main11ace02에 병합됐다. 전달 부품 검증과 전체 웹 회귀를 분리하고 이후 실패를 최신 보고에서 누락하지 않는다.
- 당시 native/제품·HTTP/fulfill·baseline/candidate CSS8개 대조는6통과/2실패였다. 공개 JS는 byte 동일하고 제품 CSS 양쪽 모두 제목4.3~5.0초/longtask3.9~4.2초를 기록했다. CSS 또는 알림을 원인으로 단정할 수 없다.
- 이번 main11ace02 profile 첫4개는3통과/개발 선택1실패였다. 합성 /me JSON은320.9ms에 완료됐고 해당 sample은 CPU 표본 대부분 idle이었다. 이것을 제품의 느린 선택 로딩이라고 확정하지 않았다.
- native Vite 대조는 preview production=true·그 뒤 development mode의 server production=true를 실제 확인했다. Vite의 [NODE_ENV와 mode 구분](https://vite.dev/guide/env-and-mode.html#node-env-and-modes)에 따라 개발 server를 먼저 만들고 production=false를 검사한다. caller 환경/.env·실제 제품/선택 CLI 설정은 변경하지 않는다.
- 같은 경계의 최종4개는 통과했다. native30.7ms·production 시작159.2ms·개발 선택1395.4ms·공개 도움말288.3ms에 제목을 관측했다. CPU profile 활성화·합성 입력·cold 개발 변환이 있는 실행이다. 실제 인증/노트북 성능이나 과거4초 지연 해결로 세지 않는다.

기존8개·후속 첫 실패·최종 통과의 source/helper/hash·고유 scratch·원본 결과를 모두 보존한다. 과거 오류의 준비 제목 실패는 RAF 자체의 결함 증거가 아니다. 최종4개에서 pageerror/외부·model·camera·unexpected API·브라우저 저장0을 확인하고 server/browser/proxy 정상 종료와 source/dist/HEAD 불변을 확인했다.

## 검증과 작성자 리뷰

visible5000ms/navigation15000ms·자동 재시도0은 그대로다. production build·문법/타입·Biome·production guard와730 DOM(실패/오류0)을 실제 통과했다. 실제 원래 선택 suite와 HTTP/SQL 통합을 이번 Story에서 재실행하지 않았으며 옛 통과를 현재 통과로 표시하지 않는다.

기존 observations 재사용은 Chrome 실행 전에 거부됐고 원본 JSON SHA는 동일했다. 출력 경로/실제 경로·candidate symlink를 검사하며 생성 결과는 wx로 저장한다. 최대4/8 sample·fetch10·timer50/RAF120·profile symbol15로 제한한다. 원문 trace/URL/인수·DOM/account·영상/좌표를 저장하지 않고 수치만 남긴다. helper failure에서도 수치 일부와 정리 결과를 보존한다. 새 deps/lock·CI·model/.env·외부 SDK·비용/계정·운영 migration/배포는 없다.

engineering:debug·testing-strategy·code-review를 적용해 보안(합성 입력/보존/경로),성능(제한된 sample·계측 영향),정확성(mode 대조·원인 미확정/이후 실패),유지보수(기존 helper 보완/제품 변경0)를 작성자가 재검토했다. 이 도구 보완 범위의 미해결 P1/P2는 없으며 독립 에이전트/전문가 리뷰가 아니다.

## 미완료·다음 입력

기존 별도 CLI 선택/실제 통합 실패와 간헐적 제품 시작 지연의 원인은 미확정이다. 현행4개 정상 profile을 반복하는 대신 실패 발생 당시 thread-time/JS profile과 환경 조건이 필요하다. 사용자 화면/영상/토큰 수집으로 대체하지 않는다.

최종 아바타·실측/검증 동작0·두 아바타 공개 코칭, 승인 대기 디자인 구조/SDK 통신·Docker/HTTPS/공급자·실제 참여자·법무/운영 및 전체1~6 완료 기준은 남는다. 이번 진단 통과를 출시 후보판 선언으로 사용하지 않는다.
