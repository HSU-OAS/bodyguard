# 화이트·블루 웹 디자인 — 실제 검증

로컬 검증 종료2026-10-05 · [Story](../../stories/stage4-medical-web-design.md) · [계약](../../web-design.md)

## 범위와 결과 구분

현재 공개/계정/시작/탐색/기록의 웹 디자인 변경이다. 아바타·판정·생산 기록 연결·배포는 변경하지 않았다. 합성 이메일, 실제 로컬 FastAPI/PostgreSQL/production Chrome을 사용하며 SMTP와 원본 영상은 사용하지 않는다.

- 토큰 CSS 검사: 최초14건 실패, 수정 후14건 통과. 자동 계산일 뿐 전체 접근성·실측 코칭 검증을 뜻하지 않는다.
- 첫 전체 DOM:276통과/3실패. 단독/묶음 진단과 불성공 대기시간 확대도 그대로 보존했다. 취소된 AbortSignal이 검출돼 StrictMode 초기 mount 정리 전 클릭 경합을 확인했다. 목록 준비 후 클릭으로 수정하고 대기시간 확대는 되돌렸다.
- 최종 전체 DOM279건을 두 번 통과했다([첫 통과](frontend-ready-state.json), [재확인](frontend-ready-confirmed.json)). 실제 화면이 아니라 모의 상태 회귀다. API·실측·전문가 검증 완료로 세지 않는다.
- 첫 Chrome2통과/1실패는 정상/hover 기대값 혼동이다. 최종 [디자인3흐름](design-20261005T054243201188Z/report.json), [기록11흐름](records-20261005T054354909317Z/report.json)을 production Chrome과 실제 격리 API/SQL로 통과했다.
- 실제 가입의 지연 화면은 실제 API 응답을 시험에서 잠시 보류한 것이다. 연결 실패는 Playwright의 요청 중단 주입이다. 실제 외부 SMTP·외부 장애를 검증한 것이 아니다.
- 최종 Biome/TypeScript/production 빌드·공개 후보 차단0·Ruff/mypy 통과. 전체 backend pytest·실제 웹캠·외부 메일/Google·배포·전문가 검토는 이번 Story에서 수행하지 않았다.

## 실제 화면 / 최종 비평

현재 실제 화면:

- [소개1440px](design-20261005T054243201188Z/design-D-01-소개·로그인·가입·복구의-실제-블루·좁은-웹·키보드·동작-감소/home-desktop.png)
- [로그인·키보드 초점](design-20261005T054243201188Z/design-D-01-소개·로그인·가입·복구의-실제-블루·좁은-웹·키보드·동작-감소/login-focus.png)
- [가입 오답](design-20261005T054243201188Z/design-D-02-실제-가입-처리중·오답·성공과-시작·경로-선택·기록-빈-화면/verification-error.png)
- [탐색375px](design-20261005T054243201188Z/design-D-02-실제-가입-처리중·오답·성공과-시작·경로-선택·기록-빈-화면/explore-375.png)
- [기록 빈 상태](design-20261005T054243201188Z/design-D-02-실제-가입-처리중·오답·성공과-시작·경로-선택·기록-빈-화면/records-empty-desktop.png)
- [삭제 확인700px](records-20261005T054354909317Z/records-RD-01-actual-previ-fd962-on-preserve-outside-records/deletion-preview-narrow.png)

### 구체적인 최종 비평

- visual-audit: 소개의 가장 큰 네이비 제목이 먼저 보이고, 시작하기만 파란 채움이다. 헤더 로그인은 채움 없이 작게 남는다. 우측 넓은 여백에는 아직 제품 아바타가 없으며 향후 가장 큰 개선은 검증된 실제 미리보기 연결이다. 미완성 모델로 그 공간을 꾸미지 않았다.
- hierarchy-principles: 제목 크기/굵기/상단 위치와 CTA 색·간격으로 두 가지 이상의 위계를 사용했다. 계정의 제출 버튼과 기록의 기간 조회가 주 행동이다. 삭제 확인 내부의 적색은 파란 조회와 별도 위험 행동임을 구분한다.
- spatial-rhythm: 공개 화면은 넓은 문단/섹션 간격, 기록은 일정한 행/열 간격으로 밀도를 다르게 한다. 375px에서 두 메뉴와 두 경로 버튼이 겹치지 않는다. 여백 비율을 수치로 실측했다고 주장하지 않는다. 700px 삭제 문구도 잘림 없이 이어진다.
- craft-signals: 입력·버튼8px, 안내12px로 통일했다. 날짜 입력과 조회 버튼 하단이 정렬된다. 실제 처리 중·오답·성공·연결 오류·빈 기록·삭제 확인/취소/결과·긴 기록 상태를 보존했다. 로딩은 즉시 상태 문구이며 불필요한 스켈레톤이나 지연을 추가하지 않았다.
- color-systems: 백색 바탕/청회색 본문에 한 가지 블루를 사용한다. 삭제/오류만 적색, Google만 공식 브랜드 예외다. CSS 계산 대비는 본문14.27, 보조문구6.06(soft5.58), 파란 버튼6.81(hover9.35), 삭제7.22, 오류7.51, 입력 테두리3.46이다. 대표 실제 계산 CSS도 Chrome에서 확인했다. 전체 접근성 인증을 뜻하지 않는다.
- type-systems: 16px × 1.25 역할 토큰으로 기존 임의 크기를 정리했다. 계정/기록의 라벨과 본문은16px, 보조는12.8px, 제목은31.25~48.828125px를 쓰며 본문1.65·제목1.24~1.3을 구분했다. 공식 Google 규칙은 명시적인 예외다.
- motion-design: 유일한 추가 전환은 버튼 반응용120ms ease-out이다. reduced-motion에서 실제 계산 duration0s를 확인했다. 배경 움직임·화면 등장 연출·스크롤 효과가 없다.
- quality-checklist: 공통 토큰은 후속 설정/대시보드/리포트에도 재사용할 계약이다. 현 화면에서 행동·상태·키보드·대비·좁은 창의 대표 검사를 통과했다. 실제 아바타·코칭 연결, 스크린리더 종합 시험, 실제 브라우저 확대/참여자 검증은 전체 출시 게이트에 남는다. 단일 점수나 출시 승인 배지로 바꾸지 않는다.

Figma·axe·Impeccable·독립 외부 리뷰는 수행하지 않았다. 설치된 Impeccable 스킬은 현재 환경 목록에 없고 새 훅을 추가하지 않았다. 최종 리뷰는 같은 담당자의 범위별 코드/화면 검토이며 외부 독립 리뷰로 표시하지 않는다.

### 실패 증거 보존

첫 실패 [디자인 보고서](design-20261005T053512984034Z/report.json), tokens-first-failed.json 및 frontend-final / sequential / diagnostic / confirmed / bounded-preview / abort-diagnostic.json은 실패 그대로다. 원래 파일 이름의 final/confirmed는 통과를 의미하지 않는다. 변경 전 삭제 단독10건은 deletion-main-baseline.json이다.

첫 Chrome error-context.md만 표시용 줄끝 공백을 정규화했고, 같은 위치의 error-context.md.original.gz에 원본 바이트를 보존했다. 압축 해제 바이트 일치를 실제 확인했다. 기존 실패 파일과 과거 Stage2/4 증거를 삭제하거나 덮어쓰지 않았다.
