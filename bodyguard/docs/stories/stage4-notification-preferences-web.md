# S4.N2 — 내 계정의 알림 설정 웹

review · baseline6ee4dce33047fae2f33430ee88baf9e09bf76ff3 · codex/notification-preferences-web · 2026-10-06

## 범위 / CTO 계약

FR-N-03/FR-U-04/NFR-08. PR42의 실제 본인 설정 API에 웹 화면을 연결한다. 최신 main의 별도 작업트리에서 진행하며 기존 SDK·classifier·아바타·실측·운영 문제와 독립적이다. 실제 알림 판정·브라우저 권한·소리 재생은 아직 미연결이며 완료로 표시하지 않는다. 민감도·의학 기준·데이터 정책을 새로 만들지 않는다.

- 내 계정 → 알림 설정(/account/notifications). 기존 상단 메뉴3개를 유지한다. 자세 알림·장시간 앉음 알림의 켜기/끄기·시간과 소리 선택5필드만 편집한다. 저장된 값이 확인되기 전 기본값 폼을 보여주지 않는다.
- 명시 저장만 POST한다. 엄격한 정수1~1440분을 검증하고 중복 제출을 막는다. 꺼진 항목은 기존 시간을 보존한다. 상한은 기술 범위이며 의학 권장 시간이 아니다.
- 실제 committed AuthProvider ready 객체를 요청 수명으로 사용한다. 준비 시 me/CSRF/설정/me를 대조하고 캡처한 cookie-bound proof는 private closure에만 보관한다. 저장 때 새 CSRF를 발급하여 과거 계정의 초안을 새 계정에 쓰지 않는다. authority 교체·새 조회·unmount는 abort/close, 늦은 응답을 폐기한다. 서버는 실제 세션 소유권과 old-proof403을 검증한다.
- 저장 성공은 정확한 응답을 확인한 뒤에만 표시한다. 단절/오류/응답 불일치는 결과 불확실로 처리하고 저장된 설정을 명시 재조회한 뒤 다시 편집한다. 자동 POST 재시도·배경 저장·storage/URL/로그에 설정·proof 보관0이다.
- 공개/익명은 기존 계정 gate로 보호한다. loading/읽기 실패·다시 조회/편집·입력 오류/저장 중/저장 확인/결과 불확실·재조회/세션 변경을 구분한다. 원시 서버 오류를 출력하지 않는다.

## 디자인 계약 — 지정 web-design-studio

사용자 목적은 본인 알림 설정의 확인·변경, 주 행동은 ‘설정 저장’ 하나다. 기존 white/blue 토큰·한국어 시스템 글꼴·본문16px/제목31.25px·4px 간격·48px 컨트롤·8px 버튼/12px 안내를 재사용한다. 백색 단일 폼, 청색 설정 그룹 번호와 저장 버튼, 옅은 블루 상태 안내만 사용한다. 실제 의료 자격·치료 효과·가짜 시범/아바타는 넣지 않는다. 내 계정 링크는 보조 위계다.

frontend-design이 화면/상태 계약, UI UX Pro Max의 focused form/React 검색이 오류 요약 초점·inline aria-describedby·controlled input·비동기 cleanup 점검에 사용된다. 실제 production Chrome의1440px/920px 노트북 창·키보드·계산 스타일/대비·reduced-motion·상태 스크린샷을 확인한 뒤8개 critique skill로 검토한다. 모바일/네이티브 코드·다크 모드·Figma·axe·외부 audit은 범위 밖이며 읽기만으로 검증을 주장하지 않는다.

## 수용 기준 / 하네스

| ID | 검증 |
|---|---|
| W01 | 실제 보호 route·내 계정 진입·조회 전 폼0·저장된5필드·문구/초점 |
| W02 | 명시 저장/중복 차단·전 항목 변경·꺼진 시간 보존·refresh 조회·엄격 입력/오류 요약 |
| W03 | 읽기 오류/재조회·save 단절/불확실/잘못된 응답·자동 POST0·raw 오류/storage0 |
| W04 | ready identity·동일 ID 새 권위/다른 계정·abort/unmount/StrictMode·old captured proof 및 늦은 응답 폐기 |
| W05 | 실제 production Chrome/API/SQL의 저장→새로고침·타인 격리·old proof403·actual styles/focus/920px/reduced motion |
| W06 | 전체 frontend·API 회귀·타입/정적/build/production guard·실패 보존·scope 리뷰·최신 diff/CLEAN/조건부 PR |

## 작업

- [x] PR42 실제 병합·main/브랜치 보존 확인, 최신 main 새 작업트리·FR/디자인 계약.
- [x] 먼저 실제 DOM red와 클라이언트 경계 하네스 작성·원본 보존.
- [x] auth-owned API client·폼·route·내 계정 링크 구현.
- [x] 실제 Chrome/API/SQL·시각/비동기 경계·전체 회귀·증거·작성자 리뷰.
- [ ] 최신 diff/HEAD/main·체크/CLEAN·조건부 merge.

## Dev Agent Record

지정 디자인 스킬과 frontend-design/UI UX Pro Max/8개 최종 critique 지침은 전체 읽고 실제 화면 검토에 적용했다. BMAD dev-story 기존 기본 workflow를 유지하되 부재한 resolver/config를 설치하지 않는다. offline 설치는 실제 캐시 메타데이터 부족으로 실패했으며 정책을 끄지 않았다. 복사한 의존성은 pnpm 실행에서 새 설치 준비가 요구됐고 실제 frozen-lockfile 설치를 완료했다. 공개 model cache는 소유 이전 작업트리에서 복사했다. 버전/잠금파일 변경0. 설치 실패 원본 stdout 파일을 확보했다고 주장하지 않는다. 소유 scratch/UTC browser 폴더의 실제 원본은 보존한다. 다른 채팅의 S4.11 작업트리를 수정/커밋하지 않는다.

최신 main PR43/44를 fast-forward해 private 집계/완료 문서를 보존했다. 최종 전체590 frontend/321 API·Chrome4·타입/정적/build/guard를 실제 통과하고 [작동 화면·실패·실제/합성 구분](../review/notification-preferences-web/README.md)을 기록했다. 초기 화면 대기 실패와 진단용 로그4통과를 출시 검증으로 혼동하지 않는다. 고정 진단 태그 제거 실행/최종 그룹·대비 실행 각각4통과, 본인 저장→새로고침·수락 후 응답 단절/재조회·쿠키 B/old proof403·다른 계정 보존·920px/확대/키보드/오류를 확인했다. 현재 Story scope 작성자 리뷰 P1/P2는 없으며 외부 리뷰/참여자·알림/전체 단계/운영 완료는 아니다. 최신 PR 게이트는 별도 실제 확인한다.

## File List

- bodyguard/backend/tests/run_browser.py
- bodyguard/docs/review/notification-preferences-web/README.md
- bodyguard/docs/review/notification-preferences-web/artifacts.json
- bodyguard/docs/review/notification-preferences-web/backend-format.stdout
- bodyguard/docs/review/notification-preferences-web/backend-mypy.stdout
- bodyguard/docs/review/notification-preferences-web/backend-ruff.stdout
- bodyguard/docs/review/notification-preferences-web/browser-final-report.json
- bodyguard/docs/review/notification-preferences-web/browser-final.stdout
- bodyguard/docs/review/notification-preferences-web/browser-first.stdout
- bodyguard/docs/review/notification-preferences-web/browser-focus-guard.stdout
- bodyguard/docs/review/notification-preferences-web/browser-frame.stdout
- bodyguard/docs/review/notification-preferences-web/browser-phase-probe.stdout
- bodyguard/docs/review/notification-preferences-web/browser-review.stdout
- bodyguard/docs/review/notification-preferences-web/browser-timing.stdout
- bodyguard/docs/review/notification-preferences-web/browser-unmarked.stdout
- bodyguard/docs/review/notification-preferences-web/collect-proof.mjs
- bodyguard/docs/review/notification-preferences-web/dom-red.xml
- bodyguard/docs/review/notification-preferences-web/final-build.stdout
- bodyguard/docs/review/notification-preferences-web/final-check.stdout
- bodyguard/docs/review/notification-preferences-web/final-frontend.xml
- bodyguard/docs/review/notification-preferences-web/final-types.stdout
- bodyguard/docs/review/notification-preferences-web/focus-guard-unit.xml
- bodyguard/docs/review/notification-preferences-web/full-backend.stdout
- bodyguard/docs/review/notification-preferences-web/full-backend.xml
- bodyguard/docs/review/notification-preferences-web/full-frontend.xml
- bodyguard/docs/review/notification-preferences-web/initial-green.xml
- bodyguard/docs/review/notification-preferences-web/install.stdout
- bodyguard/docs/review/notification-preferences-web/integrated-frontend.xml
- bodyguard/docs/review/notification-preferences-web/notifications-920.png
- bodyguard/docs/review/notification-preferences-web/notifications-account-rebound.png
- bodyguard/docs/review/notification-preferences-web/notifications-css-zoom-200.png
- bodyguard/docs/review/notification-preferences-web/notifications-desktop.png
- bodyguard/docs/review/notification-preferences-web/notifications-loading.png
- bodyguard/docs/review/notification-preferences-web/notifications-read-error.png
- bodyguard/docs/review/notification-preferences-web/notifications-saved.png
- bodyguard/docs/review/notification-preferences-web/notifications-uncertain.png
- bodyguard/docs/review/notification-preferences-web/notifications-validation.png
- bodyguard/docs/review/notification-preferences-web/production-guard.stdout
- bodyguard/docs/review/notification-preferences-web/review-green.xml
- bodyguard/docs/stories/stage4-notification-preferences-api.md
- bodyguard/docs/stories/stage4-notification-preferences-web.md
- bodyguard/docs/tasks.md
- bodyguard/frontend/e2e/notifications.spec.ts
- bodyguard/frontend/playwright.account.config.ts
- bodyguard/frontend/src/App.tsx
- bodyguard/frontend/src/api/notificationPreferences.test.ts
- bodyguard/frontend/src/api/notificationPreferences.ts
- bodyguard/frontend/src/pages/MemberPage.tsx
- bodyguard/frontend/src/pages/NotificationPreferencesPage.css
- bodyguard/frontend/src/pages/NotificationPreferencesPage.test.tsx
- bodyguard/frontend/src/pages/NotificationPreferencesPage.tsx

## Change Log

2026-10-06: PR42 병합 후 최신 main에서 독립적인 웹 설정 Story 시작. 실제 알림·공개 코칭·전체 단계 완료로 간주하지 않는다.
