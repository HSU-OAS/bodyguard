---
baseline_commit: cc9870b2ea5cf0b4fba4203cccebd682cad87dc3
---
# S4.N3 웹 알림 안내·권한 거부 대체

## Status

ready-for-review

## Story

로그인한 사용자가 검증된 측정 흐름에서 알림을 받으면 웹 화면에서 스트레칭을 살펴보거나 닫을 수 있어야 한다. 브라우저 알림 권한을 거부해도 화면 안내는 유지한다. 이 Story는 전달 부품이며 실제 판정·스케줄러·측정 화면 연결이 아니다.

## Acceptance Criteria

- D01 생성만으로 권한·카메라·소리·네트워크·저장소를 실행하지 않는다. 브라우저 권한은 명시 버튼의 사용자 활성화 안에서만 요청하며 중복 요청을 막는다. 거부/미지원/실패는 화면 안내로 복구한다.
- D02 전달은 현재 수명 권위가 유효하고 해당 종류가 켜진 경우에만 한다. 자세/장시간 안내만 허용, 최대 종류별1건·전체2건이다. 판정 기준/시간 계산을 하지 않는다.
- D03 권한 허용일 때 생성하는 OS 안내는 계정·몸 지표·시간 없는 고정 문구/종류별 tag·silent=true이며 생성/비동기 오류가 화면 안내를 지우지 않는다. 생성은 실제 OS 표시 확인이 아니다.
- D04 교체·끄기·닫기·페이지/계정 수명 종료 시 이전 알림을 닫고 listener를 해제한다. 종료 후 늦은 권한 응답/OS click·error는 무효다. 닫기/살펴보기는 운동 완료나 기록 저장이 아니다.
- D05 화이트·블루 기존 토큰,16px 본문·48px 버튼·8px radius·단일 atomic status·그룹 이름/키보드·초점 유지·1440/920px·200% 확대·reduced motion을 확인한다. 안내는 비차단이며 자동 초점 이동/자동 사라짐/진단 문구가 없다.
- D06 실제 production Chrome에서 테스트 전용 번들을 주입해 실제 React 안내/닫기·선택 callback/실제 권한 거부·좁은 노트북/이탈 폐기를 확인한다. 입력 이벤트는 합성이고 OS 허용 표시/실제 자세 판정이 아니라고 구분한다. 공개 production에는 전달 부품/테스트 주입 경로0이다.

## Tasks / Subtasks

- [x] 최신 main·동시 작업·FR-N-04/05·기존 화면 토큰·API 표준과 범위/하네스 계약 확인
- [x] 실제 실패 테스트 → 전달 controller와 브라우저 포트
- [x] 실제 실패 DOM → 비차단 알림 패널/권한 안내
- [x] 실제 Chrome 안내 흐름/거부·키보드·디자인·production 차단과 증거 보존
- [x] 전체 회귀·타입/정적/build·작성자 리뷰·File List/실패/합성 구분
- [ ] 조건부 PR 게이트와 실제 병합 확인

## Dev Notes

- 근거 FR-N-03/04/05, FR-S-04, NFR-08. web-design-studio→frontend-design→UI UX Pro Max의 기존 시스템/상태 메시지 지침을 따른다. 기존 웹의 palette/type/spacing만 사용, 새 패키지/의료 자격 표시/외부 폰트/장식은 추가하지 않는다.
- 직접 Notification API의 권한은 secure context/사용자 클릭 후 요청: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static), 고정 tag/silent·close/error: [WHATWG](https://notifications.spec.whatwg.org/). 운영 HTTPS/실제 OS 표시는 별도 실제 검증이다.
- 권위 callback은 후속 로그인·측정 수명 연결의 포트다. 임의 true를 공개 producer로 연결하지 않는다. 전달 API는 순수하게 posture/sitting 종류만 받으며 좌표/지표/계정/이메일/원시 오류를 받거나 로그/저장하지 않는다.
- Q-07/08/21의 스케줄러 정책은 이 Story로 확정하지 않는다. 알림 소리·반응 기록·검증된 스트레칭 세트/실제 classifier·SDK privacy·2단계 이월·외부/운영/전체1~6단계는 후속 필수다. 같은 아바타 부위 새 사이클0.
- 본 Story 작성 이후 AC/범위는 변경하지 않고 허용된 Status/Tasks/Dev Agent Record/File List/Change Log만 갱신한다.

## Dev Agent Record

### Implementation Plan

기존 웹 토큰의 별도 비차단 안내 panel과 소유 수명 controller를 먼저 red/green 검증한다. OS 허용/오류는 합성 포트, 실제 Chrome의 거부/DOM은 실제로 확인한다. 공개 App route/production import는 추가하지 않는다.

### Debug Log

BMAD resolver/config/sprint/project-context가 저장소에 없었다. 기본 skill/customize 지침을 읽고 기존 Story 문서·명세/하네스 fallback을 사용하며 설치/초기화하지 않는다. PR45 source dbe6dd5→merge cc9870b(부모 e4265f5,dbe6dd5)·main 포함/원본 브랜치 보존을 실제 확인했다.

Controller 최초16건은 실제16실패, 첫 구현15통과/1실패는 합성 permission 값이 응답 뒤 갱신되지 않은 fixture였으며 수정했다. 작성자 리뷰의 동기 오류 late handle/선택 callback 안 교체 오류2건을 red로 재현/보완했다. native 테스트 첫5건은 happy-dom의 userActivation 부재로 준비 실패, 명시 합성 activation을 넣은 뒤 OS click이 권위 확인 전에 focus하는 실제1실패를 재현/보완했다. 최종 controller18+native5=23건 통과, 원본 XML은 보존한다. Panel은 controller를 소유하지 않고 subscribe만 하며 caller가 페이지/계정 이탈에 dispose한다. 후속 공개 연결에서 해당 의존성을 건너뛰지 않는다.

### Completion Notes

최신 main885392c에서 새 작업트리로 미완료 Story를 이어받았고 이전 원본11개를 보존했다. 추가 RED4와 선택 초점 RED1을 보완했으며 부품36/frontend729/API466·Chrome 전달5/공개8·타입/정적/build/guard를 확인했다.

보충 통합 실패는 별도 PR #59로 보완해 실제 main db0b53a 포함/부모/같은 tree/브랜치 보존을 확인했다. 그 최신 main에서 전달5/실제 웹 HTTP SQL 통합2/frontend729·정적/build/guard를 재검증했다. 구현 소스13개 SHA는 검증 전후 동일하고 API466의 실행 시점을 구분한다. [실제 흐름·실패·합성/미실행·작성자 리뷰·미리보기](../review/alert-delivery/README.md).

비공개 부품이며 실제 classifier/로그인 producer·OS 표시·최종 디자인/아바타·전체1~6 완료가 아니다. 조건부 원격 PR 게이트는 아직 완료로 표시하지 않는다.

## File List

- bodyguard/docs/stories/stage4-alert-delivery.md
- bodyguard/docs/review/alert-delivery/README.md
- bodyguard/docs/review/alert-delivery/summary.json
- bodyguard/docs/review/alert-delivery/private-preview.png
- bodyguard/docs/tasks.md
- bodyguard/backend/tests/run_browser.py
- bodyguard/frontend/playwright.account.config.ts
- bodyguard/frontend/scripts/check-selection-production.mjs
- bodyguard/frontend/e2e/alertdelivery.spec.ts
- bodyguard/frontend/e2e/fixtures/alertDelivery.vite.ts
- bodyguard/frontend/e2e/fixtures/alertDeliveryProbe.ts
- bodyguard/frontend/src/alerts/delivery.ts
- bodyguard/frontend/src/alerts/delivery.test.ts
- bodyguard/frontend/src/alerts/browserNotifications.ts
- bodyguard/frontend/src/alerts/browserNotifications.test.ts
- bodyguard/frontend/src/alerts/AlertDeliveryPanel.tsx
- bodyguard/frontend/src/alerts/AlertDeliveryPanel.test.tsx
- bodyguard/frontend/src/alerts/AlertDeliveryPanel.css

## Change Log

- 2026-10-06: 최신 main의 독립 전달/비차단 웹 디자인 계약 시작. 실제 판정·OS 표시·공개 producer는 제외하며 필수 후속을 유지.
- 2026-10-07: 이전 원본을 보존한 새 main 작업트리에서 전달/초점/실제 이탈을 보완·검증. 비공개 부품 범위만 원격 PR 검토 준비.
