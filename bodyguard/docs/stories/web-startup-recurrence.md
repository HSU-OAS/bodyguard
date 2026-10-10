# S6.7 — 재현된 웹 시작 회귀의 원인 분리

상태: 진단 도구 개발 모드 보완·검증 완료 / 제품 시작 지연 원인 미확정 / 조건부 PR 게이트 진행

최초 기준 main `db0b53a5a789960abccb191ce5a6d28ae63c728e` · 최신 통합 main `11ace0279eff57ccf900375afcd242e9cf7af69b` · `codex/web-startup-recurrence`

## 목적·범위

S6.5의 제한된 비교 뒤 같은 main+비공개 알림 소스에서 공개/선택 Chrome 2통과·6실패와 실제 HTTP/SQL 통합 0통과·2실패가 다시 관측됐다. 앞선 통과와 이후 실패를 모두 보존한다. 준비 제목·도움말 초점·서버 실패 복구가 시간 안에 나타나지 않았으며, 첫 RAF 시험은 준비 제목 단계에서 실패해 RAF 자체의 결함 증거가 아니다.

별도 승인 없이 기존 범위의 진단·test-only 보완을 진행한다. 새 화면 구성·판정·계정 권위·SDK 정책·아바타·개인정보·운영·CI·기존 migration을 변경하지 않는다. 최초 원문에는 알림 PR #60 Draft 보류를 기록했으나 실제 원격은 merge11ace02다. 이후 선택/통합 실패가 마지막 완료 보고에 빠진 것을 재개 감사에서 확인했다. 병합 사실·비공개 전달 검증·이후 회귀 실패는 구분하며, 원문과 원래 필수 게이트를 보존하고 이전 통과로 이후 실패를 덮지 않는다.

## 수용 기준·하네스

1. 최신 main에서 별도 작업트리를 만들고 원본 알림/시제품/실패를 보존한다. 실행 HEAD·관련 source·실제 dist·helper SHA를 전후 대조한다.
2. 기존 실패 report/로그와 고정 경로 선택 report를 덮어쓰기 전에 고유 scratch에 보존한다. 앞선 통과와 이후 실패의 시각·실행 문맥·검증된 source 범위를 구분한다. 사람의 화면/이메일/계정·cookie·API 본문·원문 오류를 새로 게시하지 않는다.
3. 동일 synthetic `/me`에 대한 단순 native / 제품 baseline CSS / 비공개 알림을 포함해 빌드된 CSS를 각각 실제 루프백 HTTP와 Playwright fulfill로 비교한다. 최신 main의 실제 build JS와 비교 CSS의 SHA를 기록한다. 추가로 실제 개발 선택/공개 도움말의 고정 제목을 제한된 한 번씩 확인한다. 합계8개 탐색, 새 headless Chrome context, visible5000ms·navigation15000ms, 자동 재시도0이다.
4. init·fetch response/json·준비 제목·타이머/RAF·longtask·외부/카메라/model/저장/pageerror 수치만 관측한다. 각 sample 실패를 별도로 기록하며 중간 실패/표본0을 통과로 환산하지 않는다. 고정 local fixture는 실제 인증·운영 성능·촬영 검증이 아니다.
5. 원인은 대조/반증으로 입증한 경우에만 확정한다. 미재현이면 실패가 해결됐다고 기록하지 않는다. 허용 시간을 늘리거나 같은 정상 시험을 반복하지 않는다. 제품 보완이 필요하면 별도 응집된 PR에서 RED→GREEN과 실제 회귀를 통과해야 한다.
6. 소유 browser/server/proxy만 정상 종료하고 기존 동시 실행 DB/브라우저는 건드리지 않는다. 전체1~6/실사용 성능·알림 공개 연결·아바타/실측·운영·다른 Draft의 완료 게이트는 그대로 남긴다.

## 실행 순서

실패 원본 보존 → 최신 main build/source hash → 제한된 대조 → 실제 수치·원인/미확정 기록 → 필요한 다음 수정/입력 선정. engineering:debug의 재현·분리·진단 순서를 적용하며 추정을 관측으로 쓰지 않는다.

## 후속 원인 분리·도구 보완 수용 기준

최초8개 비교는 이미 db0b53a에서6통과/2실패로 실행됐다. 같은 정상 대조를 반복하지 않고 새로운 측정인 CDP thread-time/CPU sample profile을 native·production 시작·개발 선택·공개 도움말4개에 한정한다. 기존 visible5000ms/navigation15000ms와 재시도0을 유지한다. profile 자체가 실행 시간을 바꾸므로 실사용 성능이나 이전 지연과의 직접 성능 비교로 세지 않는다.

- 개발 비교는 actual Vite `isProduction=false`를 확인한다. 환경이 맞지 않으면 fail-closed이고 caller NODE_ENV를 덮어쓰지 않는다. 실제로 발견한 도구 오류는 원본 보존→native 대조→같은 경계 재검증으로 보완한다.
- profile은 고정 수치·허용된 코드 symbol/출처 종류 최대15개만 남긴다. raw CDP trace/URL·인수·DOM·계정 값·영상/좌표는 저장하지 않는다. 새 웹 요청/제품 계정 성공 우회/공개 경로가 아니다.
- 기존 observations 덮어쓰기와 symlink 경로를 거부한다. 실제 거부 후 원본 hash와 정상 소유 server/browser/proxy 정리를 확인한다.
- 현재 main의 source/dist/helper 전후 SHA, 실제730 DOM·타입/Biome/문법/build/production guard·diff/코드 리뷰를 확인한다. 실제 인증/SQL·원래 전체 선택 suite·headed/사람·카메라/코칭·운영 게이트는 실행하지 않았다면 미실행으로 남긴다.

## 결과

최초8개 비교의 native 제목436.7/515ms 대비 production 시작4308.8~4970.9ms와 longtask3857~4217ms를 보존했다. candidate와 baseline 공개 JS는 byte 동일하고 두 CSS 모두 지연이 나타났다. CSS나 알림 코드가 원인이라는 증거는 아니다. 개발 선택/공개 도움말2실패와 별도 전체 선택2통과/6실패·실제 통합0통과/2실패도 보존했다.

새 profile은3통과/개발 선택1실패였다. native Vite 대조에서 preview를 먼저 부른 뒤 createServer를 만들면 개발 mode에도 isProduction=true가 됨을 확인했다. 개발 서버를 먼저 만들고 false를 확인하는 도구 보완 뒤 같은 profile4개는 통과했고 소유 자원 정리/전후 source·dist·HEAD 불변과 실제730 DOM·정적/build/guard를 확인했다. 개발모드 보완은 이 helper의 선택 실패만 설명하며 기존 별도 CLI 선택/통합 실패나4초 지연 원인을 설명하지 않는다.

[수치·원본 SHA·작성자 리뷰·미실행](../review/web-startup-recurrence/README.md). 도구 검증 범위의 미해결 P1/P2는 없으며 제품 시작 원인/실사용 성능 P2·Draft #51/29/36/9와 기존 승인·이월·전체1~6단계 게이트는 그대로 미충족이다. 다음 입력은 지연 발생 당시 native thread-time/JS profile 및 외부 환경 조건이다. 정상4개를 다시 실행하는 것으로 원인 해결을 주장하지 않는다. PR 병합/최종 출시 완료는 실제 결과 확인 전에 기록하지 않는다.

### File List

- frontend/scripts/probe-startup-recurrence.mjs — 최초 비교, 격리 profile, 개발모드 확인·원본 보존.
- docs/review/web-startup-recurrence/README.md, summary.json — 이후 실패·최초/후속 수치·원문 SHA와 실행 한계.
- docs/stories/web-startup-recurrence.md, docs/tasks.md — 최신 원격·보고 누락·진단 및 다음 입력.
