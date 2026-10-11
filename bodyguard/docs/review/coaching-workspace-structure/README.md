# 코칭 공간·동작 선택 구조 — 실제 React 검증

2026-10-11, [S4.D6](../../stories/coaching-workspace-structure.md). 최신 main `5d12491bdef5f09942f9dc1895bb000aebe48030`에서 별도 `codex/coaching-workspace-structure`로 진행했다. 직전 SDK 목적은 [PR126](https://github.com/HSU-OAS/bodyguard/pull/126)의 source `c426f6d` → merge `5d12491`로 이미 main에 포함되며 원격 브랜치를 보존했다.

## 실제 작동하는 화면·흐름

- 로그인 보호 개발 라우트 `/dev/select`에서 시각 미리보기 영역을 갖는 카드 목록·검색·부위 필터·기존 수행 안내/근거를 제공한다. 안내 → `/dev/coaching` → 나가기에서 원래 검색/필터를 유지한다. 복귀 경로는 고정된 내부 주소이고 임의 `next`를 받아 이동하지 않는다.
- 코칭 공간은 왼쪽 내 움직임 / 오른쪽 현재 단계 시범을 위한 하나의 넓은 공간이다. 왼쪽 메뉴, 상단 표시 구도·동작 변경, 하단 안내·나가기를 연결했다. 전신/상반신/자세히와 남녀 선택은 **표시 설정 상태**만 바꾸며 촬영 범위 또는 판정을 바꾸지 않는다.
- 동작 변경 대화상자에서 검색·필터·빈 결과 초기화·선택을 수행한다. 설정 대화상자와 Escape·초점 복귀·키보드 조작을 연결했다. 미확인 계정/게스트/연결 오류는 기존 SessionGate로 개인 화면을 열지 않는다.
- 실제 Chrome 154에서 1440/800/375px의 위 흐름, 없는 동작 ID 복구, 계정 오류를 확인했다. 800px 대화상자의 CSS 2배 확대도 확인했다. 실제 브라우저 메뉴 200% 확대·스크린리더·다장치 시험은 하지 않았다. 작은 폭은 웹의 재배치 시험이지 모바일 앱 구현이 아니다.

**아직 두 아바타는 없다.** 현재 중앙은 연결 대기 상태이며 Canvas/GLB/SDK/카메라를 실행하지 않는다. 검증된 동작 영상/포스터도 연결하지 않았다. 카드의 빈 미리보기 영역은 동작을 실제로 설명하는 이미지나 재생 가능한 영상으로 세지 않는다. 시작·전체 시범 버튼은 비활성이고 타이머·판정·결과 저장도 없다. 이 Story는 승인된 구조 적용이며 완성 코칭/공개 출시 기능이 아니다.

## 검증 방식과 증거

[report.json](report.json)에 실제 브라우저 결과, 실패, 최종 unit 요약, 입력·원본 보고서·미리보기 SHA를 보존한다. 원본은 `/private/tmp/bodyguard-coaching-ui.kvPjTf`에 유지한다. `final-workspace-1440.png`, `final-picker-800.png`, `final-selection-375.png`는 실제 React 화면 캡처다. 정적 시안·AI 생성 이미지·최종 아바타가 아니다.

`scripts/test-coaching-workspace.mjs`는 임시 loopback Vite와 **제어된 계정 API**를 띄우고 실제 React/Chrome을 조작한다. Playwright 요청 가로채기는 없다. 카메라 호출·외부 요청·모델/GLB 요청·JS 오류0과 브라우저 저장소0을 관찰했다. 계정 API fixture를 실제 SQL·메일·Google 인증 검증으로 세지 않는다. 종료 시 소유 브라우저/API/Vite를 닫는다.

`MotionPreview`는 검증된 같은 출처 미디어가 제공될 경우 hover/키보드 focus·명시 재생/정지·오류 복구를 지원하는 연결부다. 이탈/숨김/소스 폐기/unmount에서 정지하며 reduced-motion은 자동 재생하지 않는다. URL 정규화 우회, 실패한 최신 재생 뒤 옛 Promise 완료, 사라진 video의 늦은 완료도 차단한다. **unit의 재생/정지 메서드는 합성 포트다. 실제 동작 영상 디코딩/hover 재생은 이번 브라우저 시험에서 수행하지 않았다.**

실행 명령은 frontend에서 다음과 같다. 직접 Vite 빌드로 에셋 준비 훅을 실행하지 않았다.

```sh
pnpm exec vitest run --reporter=json --outputFile=/private/tmp/bodyguard-coaching-ui.kvPjTf/unit-merge.json
pnpm exec tsc --noEmit
pnpm exec biome check src/catalog/motionNavigation.ts src/pages/CoachingNavigationContext.test.tsx src/pages/CoachingPage.tsx src/pages/CoachingPage.css src/pages/CoachingPage.test.tsx src/pages/MotionPreview.tsx src/pages/MotionPreview.test.tsx src/pages/MotionPreviewOwnershipEdges.test.tsx src/pages/MotionSelectionPage.tsx src/pages/MotionSelectionPage.css src/App.tsx scripts/check-selection-production.mjs scripts/build-coaching-workspace.mjs scripts/test-coaching-workspace.mjs
node scripts/build-coaching-workspace.mjs /private/tmp/bodyguard-coaching-ui.kvPjTf
node scripts/test-coaching-workspace.mjs /private/tmp/bodyguard-coaching-ui.kvPjTf '<로컬 Chrome 실행 파일>' final
git diff --check
```

원래 build notice 검사는 Vite writeBundle에서 실행한다. 원래 `check-selection-production.mjs`는 검증 대상 출력 디렉터리만 소유 임시 product/assets로 치환해 전체 금지 문자열 검사를 실행했다. 검사 조건은 완화하지 않았고 코칭의 네 가지 마커를 추가했다. 개발 코칭/후보 UI는 production JS에서 제외됐다. public JS는 Shell의 조건부 class 연결 때문에 기준 출력과 byte 동일하다고 주장하지 않는다. 전체 최종 artifact 권리 검토가 끝났다는 뜻도 아니다. 전체 backend·SQL·실물 촬영·실제 영상·3D·운영 검증은 이번 Story에서 미실행이다.

## 실패·보완·작성자 리뷰

- 처음 네 라우트 테스트는 구현 전 실패했다. Testing Library의 잘못된 role 옵션·fieldset 의미/정적 검사·scope 경로 오류를 수정했고 기존 수용 조건은 없애지 않았다. 원문은 대화 도구 출력이며 별도 RED 로그 파일이 있다고 하지 않는다.
- `first.json`의 실제 UI 흐름3개는 통과했다. 후속 `reviewed.json`은 마우스 입력 뒤 programmatic focus를 키보드 focus-visible로 취급해 `0px != -4px`에서 실패했다. 실제 Tab으로 카드에 도달하고 focus-visible 및 inset outline을 모두 확인하도록 하네스를 바로잡았다. `keyboard.json`과 최종 `final.json`은3개 폭 모두 통과했다. 실패 원본은 보존한다.
- `unit-reviewed.json`은1665통과/1실패였다. 인스턴스별 spy라고 가정했지만 prototype mock을 공유하여 새 video pause 횟수를 잘못 읽었다. 동일 mock의 실제 `this` 소유자를 구분하도록 시험을 수정했다. 옛 video가 정지되고 새 video가 정지되지 않아야 한다는 조건은 유지했다. 원본과 최종 결과를 별도 보존한다.
- pnpm `tsx` 미설치·sandbox loopback EPERM은 실행 환경 실패다. 새 패키지/외부 서비스 없이 기존 Node24와 승인된 loopback 시험으로 실행했다. 최초 잘못된 작업 폴더의 명령 실패도 제품 통과로 세지 않는다.

`engineering:code-review`의 보안·성능·정확성·유지보수 기준으로 작성자가 실제 diff를 검토했다. 검색/필터 복귀 손실, 카드 overflow에 잘리는 키보드 테두리, 미디어 소유·늦은 Promise 경계를 보완했다. 최종 범위 내 미해결 P1/P2는 없다. 독립 리뷰/전체 출시 승인을 받았다는 뜻이 아니다. 기존 시작 지연P2와 실측·최종 아바타 게이트는 별개로 남는다.

`web-design-studio`의 최종 점검을 적용했다. 첫 시선은 현재 동작 제목/구도, 중앙은 좌우 아바타의 비교 공간, 상세는 접힌 안내로 계층을 분리했다. 기존 화이트·블루 토큰/8px 간격/8·12·16px 모서리를 재사용하고 장식 효과·원격 폰트·새 UI 패키지는 추가하지 않았다. 실제 캡처에서 넓은 중앙 공간·이름/필터 식별·좁은 폭 카드 재배치를 확인했고 키보드 초점 잘림을 수정했다. 다만 실제 아바타가 들어간 뒤의 크기·간격·관절 강조 가독성은 아직 검증할 수 없다.

## 완료 경계·다음 의존성

최종 소스의 추가 확인은 [verification-current.json](verification-current.json)에 별도 보존한다. 1440/1024/800px 데스크톱·좁은 노트북에서 실제 검색/필터를 유지한 선택→코칭→나가기까지 통과했고, 85파일/1666건·타입·범위 Biome14파일·별도 최종 production build/원래 고지·private guard·diff를 통과했다. 기존375px 재배치 증거는 과거 시험으로 보존하며 모바일 지원으로 확대하지 않는다. 검색/필터 복귀 손실2건 및 오래된 재생 요청의 실패는 최초 도구 출력에 남아 있고, 보완 뒤 실제 브라우저/회귀를 실행했다. 새 PNG는 [코칭 공간](desktop-current-workspace-1440.png)과 [동작 선택](desktop-current-picker-1440.png)의 실제 React 캡처이며 아바타가 없는 구조 검수 상태다.

최종 디자인 진단(visual-audit·hierarchy-principles·spatial-rhythm·craft-signals·color-systems·type-systems·motion-design·quality-checklist): 제목/보기→넓은 비교 공간→접힌 안내/나가기 순서가 명확하고, 기존 단일 블루와 중립색·한글 타이포·둥근 모서리로 통일했다. native 대화상자와 카드의 키보드 테두리를 실제 Tab으로 확인했다. 장식 애니메이션/진단 숫자/거대한 타이머는 없다. 빈 비교 공간과 영상 대기는 의존성 상태이지 완성 디자인 증거가 아니다. 실물 아바타의 간격·발끝/관절 가독성·오류 부위 강조, 실제 미디어 재생, 스크린리더/브라우저 메뉴 확대는 후속 실제 검증이 필요하다. 이 한계를 좁은 Story의 P1/P2 없음과 전체 출시 완료로 혼동하지 않는다.

이 좁은 구조 Story의 로컬 게이트만 완료한다. 아바타 보류·출시 적격 동작0·실제 참여자/독립 관찰·시작P2·최종 콘텐츠·Docker/HTTPS·외부 공급자·권리/법무·운영/배포·전체1~6 미완료를 유지한다. 기존 원본·GLB·HTML·실패 증거는 수정/삭제하지 않았다. 검증된 동작/미디어 및 보류 해제 후의 최종 scene 연결 전에는 코칭을 공개하지 않는다.
