# Bodyguard — Tasks

2026-10-11 최신 CEO 결정: 공식 저장소의 라이선스·NOTICE 외부 문의는 **나중에** 진행한다. 문의·외부 메시지0, 미확보 고지·버전 동등성·배포 승인 미완료를 유지한다. S5.7의 원문 보존/검증 보완은 독립적으로 마무리하며 아래 미승인 표현은 답변 전 시점 기록이다. 아바타·참여자·Docker 보류도 유지하고 독립 웹 기능을 계속한다.

2026-10-11 [S5.7 고정 source 동봉 고지·누락 경계](stories/pinned-companion-notices.md): Rolldown의 참조 동봉 고지를 원문으로 보존했다. maath tag/source identity와 stats-gl의 npm2.4.2/source2.3.1 불일치를 실제 확인해 누락/버전 문제를 성공으로 대체하지 않았다. [결과·실패/작성자 리뷰·증거](review/pinned-companion-notices/README.md). source collector 원문 검사의 P2를 재현/보완했으며 제품/SDK/아바타·운영 변경0, 조건부 PR 게이트를 진행한다. PR135 sourcee56c40a→mergeababacfe/main·브랜치 보존 확인. 공식 source 문의3건은 CEO 미승인/외부 메시지0이며 아바타/참여자/Docker 보류·실제 판정/추천·시작P2/native timeout·외부/HTTPS/운영·전체1~6 미완료는 유지한다. 아래는 과거 시점 기록이다.

2026-10-11 [S4.R7 공통 코칭→실제 기록 API 통합](stories/recorded-playback-api.md): 실제 계정/API/새 소유 SQL에서 현재 공통 consumer의 명시 저장→기존 기록 상세, 서버 수락 후 응답 단절→동일 재시도/한 기록, 다른 계정 조회·옛 proof 저장 거절을 확인했다. [작동 화면·실패/합성 구분·검증/작성자 리뷰](review/recorded-playback-api/README.md). 제품 UI/API/공개 JS·CSS·출시 동작0은 유지하며 합성 수행을 임상/사람 검증으로 세지 않는다. 세 소유 DB/API/preview 종료와 데이터·실패 원본 보존을 확인했고 조건부 PR 게이트를 진행한다. PR134 source1692d4d→merge67c18dde/main·브랜치 보존은 확인했다. 아바타/참여자/Docker 보류·실제 판정/추천·원래 시작P2/과거 native timeout·외부/운영·전체1~6 미완료는 그대로다. 아래는 과거 시점 기록이다.

2026-10-11 [S3.C7 준비→연속 입력 시각 인계](stories/camera-input-handoff.md): 같은/이전 준비 시각의 첫 callback이 입력을 끝내는 경계를 unit·제어 native RED로 재현하고, 새 source가 추론 전에 건너뛰어 다음 실제 입력을 받도록 보완했다. [작동 흐름·실패/한계·검증/리뷰](review/camera-input-handoff/README.md). 동작 변경/기존 자원 종료/새 명시 준비와 원래 native 흐름을 실제 확인했다. 시각 대체 시험을 자연 발생·과거 timeout 원인 해결로 세지 않으며 기존5초/heavy/얼굴/손 기준을 유지했다. PR133 source1df077a→merge7ed34fb/main을 확인했고 이 좁은 PR 게이트 진행 중이다. UI/공개 byte/임상/출시 동작0·아바타/참여자/Docker 보류·시작P2/과거 timeout/전체1~6 미완료는 유지한다. 아래는 과거 시점 기록이다.

2026-10-11 [S3.C6 입력·재생·소유 세션/기록 통합](stories/recorded-playback-assembly.md): 기존 계정/엔진/기록과 native-compatible 재생 owner의 공통 연결을 만들고 비공개 Auth consumer를 전환했다. [실제 Chrome 명시 준비→합성 수행→결과 저장→기존 기록 상세·계정 회수/취소·실패/리뷰](review/recorded-playback-assembly/README.md). 현재 state만 전달하고 세대마다 한 번 시작·원래 stamp·정리 실패 격리를 유지한다. 작성자 리뷰의 상태 덮어쓰기 P2를 실제 재현/보완했다. 공개 byte/출시 동작0·아바타/SDK/임상 기준/운영 변경0이며 이 시험의 계정/자원/시계/판정/HTTP는 fixture, native/SQL/사람 검증이 아니다. PR132 source724f282→mergef4bddae/main은 확인했다. 조건부 PR 게이트 진행 중, 디자인 추후·아바타/참여자/Docker 보류·시작P2/과거 native timeout·최종1~6 미완료를 유지한다. 다음은 실제 입력의 시작/지연과 독립 통합 누락을 해결하며 보류된 필수 조건을 건너뛰지 않는다. 아래는 과거 시점 기록이다.

2026-10-11 우선순위·[S3.C5 동작별 촬영 준비](stories/motion-camera-framing.md): CEO 지시대로 추가 디자인/UI/UX 다듬기는 뒤로 미루고 독립 기능 연결을 우선한다. 아바타 보류 유지·실제 참여자 연결은 나중·Docker 보류라는 답을 기록한다. 실제 개발 웹의 선택 동작 안내→카메라 준비→연속 입력 촬영 안내→동작 변경 시 종료/새 명시 준비·unknown ID 차단을 연결했다. [작동 영역·실패 원본·검증/작성자 리뷰](review/motion-camera-framing/README.md). 구도 버튼은 실제 요구 관절을 바꾸지 않으며 촬영 상태를 자세 성공/추천/코칭/기록으로 쓰지 않는다. PR131 source71afcb2→mergedde3d3c/main은 실제 확인했다. 조건부 PR 게이트는 진행 중이며 아바타/실측·간헐적 시작 대기·출시 적격0·운영/HTTPS·전체1~6은 미완료다. 아래는 과거 시점 기록이다.

2026-10-11 [S3.C4 연속 입력 실패·재시도](stories/coaching-input-recovery.md): 실제 개발 웹/가짜 카메라·SDK에서 capture/Worker 오류·입력 정지→자원 종료→명시 재시도, 새 카메라 뒤 옛 callback 격리·정리 실패의 router 재진입 차단을 검증했다. [실제 오류 영역·강화 시험 실패·원본/리뷰](review/coaching-input-recovery/README.md). 제품/UI/SDK 변경0이며 새 회귀 시험을 추가했다. 강화 시험 timeout은 미확정으로 보존하고 정상 재시험으로 해결 처리하지 않는다. 전체frontend/정적/build/guard를 실행했으며 조건부 PR 게이트 진행 중이다. PR130 source904ab9b→mergebbc2b15/main 포함은 실제 확인했다. 아바타/Docker 보류·시작P2·실측/출시 적격0·전체1~6 미완료는 유지한다.

2026-10-11 [S3.C3 연속 관찰 입력](stories/coaching-continuous-input.md): 카메라 확인→명시 입력 확인→같은 카메라/Worker의 순차 입력→끄기·재시작을 실제 개발 웹에 연결했다. [작동 영역·실패 원본·검증/작성자 리뷰](review/coaching-continuous-input/README.md). 연속 입력 중 화면 이탈·숨김/pagehide·401 회수를 확인했으며, 최신 복사 슬롯1개/consume-once·원래 시각·정리 실패 차단을 유지한다. 전체frontend/타입/build/private guard와 실제 가짜 카메라·SDK를 실행했고 조건부 PR 게이트 진행 중이다. PR129 sourceba721d4→mergeb5791b2/main 포함은 확인했다. 공개 코칭·판정·저장0, 아바타/Docker 보류·실측/출시 동작0·기존 시작P2·전체1~6 미완료는 유지한다. 아래는 이전 시점 기록이다.

2026-10-11 [S3.C2 카메라 준비 취소](stories/camera-playback-cancellation.md): 미완료 재생의 취소·화면 이탈과 정리 실패를 보완했다. [실제 흐름·원본 RED·검증/리뷰](review/camera-playback-cancellation/README.md). 준비 취소 후 옛 재생을 기다리지 않고 명시 재시도할 수 있으며, 정리 불확실 시 차단한다. 실제 React/가짜 카메라·SDK와 전체frontend/타입/build/guard를 확인했고 조건부 PR 게이트 진행 중이다. PR128 source68f0bc2→mergebe1ec62/main은 실제 확인했다. 아바타/Docker 보류·실측/동작0·원래 시작P2·운영/전체1~6 미완료는 유지한다. 아래는 이전 시점 기록이다.

2026-10-11 [S3.C1 카메라·첫 추론 준비](stories/coaching-camera-preparation.md): 승인된 코칭 화면에서 명시 준비→실제 SDK 첫 입력/폐기→끄기와 거부/취소·화면 이탈·계정 회수를 연결했다. [실제 화면·흐름·실패·작성자 리뷰](review/coaching-camera-preparation/README.md). 개발 classic Worker의 ESM 오류, 새 계정/새 화면의 이전 정리 우회, decoded 입력 대기/정리 실패를 보완했다. 전체 frontend1692·타입/범위 정적·production 고지/private guard·실제 Chrome/가짜 장치/SDK를 확인하고 조건부 PR 게이트를 진행한다. 아바타/동작 미디어·코칭/판정/추천/저장 활성화는 하지 않았다. PR127 sourcecb667d4→mergefd331d2/main·브랜치 보존을 확인했다. Docker는 CEO의 나중 연결 선택으로 실제 검증 보류다. 아바타 보류·출시 동작0·실측/참여자·기존 시작P2·외부/운영과 전체1~6 미완료는 유지한다. 아래는 이전 시점 기록이다.

2026-10-11 [S4.D6 코칭 공간·동작 선택 구조](stories/coaching-workspace-structure.md): 실제 React에서 선택/상세→코칭 구조→구도·설정·동작 변경→안내/나가기와 검색·필터 복귀를 연결했다. [실제 화면·모의/실제 경계·실패·작성자 리뷰](review/coaching-workspace-structure/README.md). 넓은 한 공간의 좌우 배치·화이트/블루·짧은 문구를 적용했지만 아바타/동작 영상은 미연결이고 시작/시범/판정/카메라/저장은 비활성이다. 비공개 production 경계를 유지하며 이 구조 목적의 필수 검증과 조건부 PR 게이트를 진행한다. SDK PR126 sourcec426f6d→merge5d12491/main·브랜치 보존을 실제 확인했다. 아바타 보류·출시 동작0·실측/참여자·시작P2·외부/운영/권리와 전체1~6 미완료는 유지한다. 아래는 이전 시점 기록이다.

2026-10-11 [S6.SDK 동일 출처 통신 경계](stories/sdk-same-origin-policy.md): CEO의 직접 승인에 따라 SDK 실행 전 제품 CSP와 상속 Worker를 적용했다. [실제 SDK/외부 차단·로그인/가입 복귀·개발 HMR·실패/리뷰](review/sdk-network-policy/README.md). 전체frontend1648·타입/범위 정적·production 고지/비공개 경계 통과, 조건부 PR 게이트 진행. 코칭 구조/SDK의 승인 대기는 해소됐고 다음은 코칭 화면·선택 구조의 React 적용이다. 아바타 보류·동작 적격0·실측/참여자·시작P2·외부/운영/권리·전체1~6 미완료는 유지한다. 아래는 이전 시점 기록이다.

2026-10-11 [S4.23 로그인 후 원래 개인 흐름 복귀](stories/web-login-return-flow.md): 기록/계정 직접 주소→로그인·가입 전환→이메일 인증/로그인→원래 기간/계정 화면을 연결했다. [실제 Chrome·API/소유 SQL 흐름·실패·작성자 리뷰](review/web-login-return-flow/README.md). CSS/본문/새 화면·API/권한/SDK/아바타/운영 변경0이며 실제 메일/Google·코칭을 완성한 것이 아니다. 현재 frontend1639/TS/범위 정적/production build·고지/private guard 통과, 정확히 소유한 DB/API/preview 종료와 원본 보존 확인, 조건부 PR 게이트를 진행한다. 동작 적격0·아바타 보류·미승인 코칭 구조/SDK·실측/참여자·시작P2·외부/운영 및 전체1~6 미완료는 그대로다. 아래는 기존 시점별 기록이다.

2026-10-10 [S4.22 웹 진입·페이지 식별](stories/web-page-navigation-titles.md): 기존 없는 주소→소개 복귀→로그인 흐름에서 잘못된 탭 제목을 수정하고 Router case/slash·현재 메뉴를 맞췄다. 개인 화면 자체 title/focus·복구 보안·본문/CSS/화면 구성은 유지했다. [실제 화면 흐름·원래 실패/하네스 정정·검증/리뷰](review/web-page-navigation-titles/README.md). 최종 production Chrome10·frontend1600/타입/범위 정적/build/개발 제외 통과, backend/SQL/3D/물리 카메라/운영은 미실행이다. PR122의 실제 mergedd6bde6/최신 main을 확인한 새 codex/web-page-navigation-titles에서 진행했다. avatar 보류·미승인 코칭 구조/SDK·실측/출시 동작0·시작P2/외부·운영·1~6 미완료를 그대로 유지하고 이번 작은 식별 보완을 서비스 완료로 세지 않는다.

2026-10-10 [S5.6 버전 고정 출처 보완](stories/upstream-license-evidence.md): 선택→코칭→기록의 기존 연결부는 있지만 출시 적격 동작0/미승인 공개 구조·SDK 결정·실측·아바타 보류로 공개 완성 흐름을 열 수 없음을 확인했다. 독립 필수 누락으로 npm8개 버전을 source lock/공식 metadata와 실제 대조하고4개 버전의 라이선스 원문5개를 별도 확보했다. [원문·미확보4개·실패·검증/리뷰](review/upstream-license-evidence/README.md). 설치물/NOTICE/최종 artifact/법무·5단계 완료가 아니며 제품 UI/API/판정·SDK/3D/운영 변경0이다. PR121 sourcebab08be→merge0aed84e/최신 main을 확인하고 새 codex/upstream-license-evidence에서 진행했다. 합성/보존 증거 검증6개·offline hash 대조·문법/diff의 좁은 게이트를 적용하고 전체FE/SQL/브라우저 검증은 미실행으로 남긴다. 기존 원본·보류·출시 조건을 유지하며 테스트 숫자를 사용자 기능 완성으로 계산하지 않는다.

2026-10-10 [S6.25 코칭 추론 스레드 분리](stories/coaching-inference-thread.md): 실제 SDK 대조에서 Worker가 첫 추론 중에도 화면 갱신/예약 버튼 이벤트를 유지함을 확인해 비공개 adapter의 기본 경로로 연결했다. main은 명시 비교로 유지하고 준비 실패의 자동 fallback은 없다. [작동 차이·실패·미완료](review/coaching-inference-thread/README.md). 공개 화면/모델·판정/개인정보·아바타·운영 변경0이며 추론 자체/전체 시작 시간을 개선했다고 주장하지 않는다. PR120의 실제 merge a53ff75/main을 확인한 새 codex/coaching-inference-thread에서 진행했다. 관련136·최종 전체frontend1580/정적/build/guard 통과, 첫 전체 회귀1실패와 두 비교 하네스 실패는 별도 보존했다. 아바타 보류·공개 코칭 구조/SDK 결정·실측/출시 동작0·기존 시작P2·외부/운영 및 전체1~6은 여전히 미완료다. 속도 요청에 따라 다음 작업은 테스트 건수 확대가 아니라 핵심 코칭의 실제 연결에 집중하되 별도 결정/참여자 의존성을 임의 통과 처리하지 않는다.

2026-10-10 [S4.21 기록·설정의 원래 계정 유지](stories/owned-context-identity.md): 기존 설정 조회/저장·기록 상세/삭제·오류 복구 UI를 유지하면서 준비한 계정 ID와 요청 순간의 소유 경계를 보완했다. 타인 쿠키가 섞인 설정 GET200 및 같은 ready 객체 ID 변경을 먼저 재현했고 수정 후 실제 브라우저에서403·정상 재확인/기록 흐름을 확인했다. [실제 화면·실패/합성 경계·리뷰·증거](review/owned-context-identity/README.md). 전체frontend1577/backend537·native설정5/기록4·API 생성/정적/build/guard 통과, scoped conditional PR gate를 진행한다. 공개 UI/저장 schema/정책·카메라/3D/아바타/운영 변경0, 원본/브랜치/실패 보존. 아바타 보류·미승인 화면/SDK·실측/동작0·시작P2/외부/운영 및 전체1~6 미완료는 유지한다. PR119 source132652fa→merge0b440af/main을 확인한 최신 main의 새 codex/owned-context-identity에서 시작했다.

2026-10-10 [S6.24 연속 기록 흐름](stories/record-data-journey.md): 합성 관찰의 실제 업로드→본인 조회→기존 기록 상세→삭제 취소/확인→빈 목록, 응답 단절/동일 재시도·신규 분/타 계정 보존을 실제 Chrome/HTTP/새 SQL로 확인했다. [작동한 화면·경계·증거](review/record-data-journey/README.md). native5/전체frontend1568·정적/build/guard·공개 JS/CSS byte 불변을 검증해 scoped 조건부 PR gate를 진행한다. 신규 제품/UI/schema/정책/아바타/운영 변경0이다. 기존 아바타 보류·미승인 화면/SDK·실측/동작0·시작P2/외부/운영과 전체1~6 미완료를 유지한다. PR118 source172d6d26→merge665c914e/최신 main을 실제 확인하고 새 codex/record-data-journey에서 시작했다. 기존 파일·브랜치·증거를 보존한다.

2026-10-10 [S4.20 실제 로그인·기록 조회 연결](stories/auth-dashboard-query.md): AuthProvider ready→명시 일/주 조회→refresh/logout/pagehide/unmount 폐기·최신 요청 보호를 구현했다. [실제 흐름·mock/제어/공개 미연결 경계·증거](review/auth-dashboard-query/README.md). unit13/전체frontend1568·actual Chrome/AuthProvider/HTTP/새 SQL6·정적/build/guard·공개 JS/CSS 불변을 확인해 scoped 조건부 PR gate를 진행한다. 새 공개 화면·메뉴/차트·API/schema/정책·아바타/운영 변경0이며 Draft51/FR-R-03 전체/4단계/1~6는 미완료다. 아바타 보류·미승인 UI/SDK·실측/동작0·시작P2/외부/운영을 유지한다. PR117 source5558d535→merged2501686의 실제 main 포함·동일 tree/브랜치 보존을 확인하고 최신 main의 새 codex/auth-dashboard-query에서 시작했다. 깨끗한 checkout/동일 lock 설치만 재사용했고 이전 기록/증거는 보존한다.

2026-10-10 [S4.19 본인 일·주 조회 웹 클라이언트](stories/dashboard-client.md): 명시한 날짜/기간/IANA·본인 저장 기록 DTO 검증과 조회 시작의 원래 계정 ID 보호를 구현했다. 실제 Chrome에서 일/주·타인 제외·logout/전환 후 응답 폐기·변조/같은 객체 ID 변경을 확인했고 [원본 실패/제어 주입·실제 경계·증거](review/dashboard-client/README.md)를 보존했다. 최종 unit50/전체frontend1555·native5·관련 SQL/HTTP27·정적/build/guard·공개 JS/CSS 불변을 확인해 scoped 조건부 PR gate를 진행한다. 새 메뉴/차트/공개 dashboard 연결·화면/CSS/서버 schema/정책/아바타/운영 변경0이며 Draft51/FR-R-03 전체/4단계/1~6은 미완료다. 아바타 보류·독립 웹 진행·미승인 UI/SDK·실측/동작0·시작P2/외부/운영은 유지한다. PR115 source4df38d→mergec6760c·PR116 sourcecd9e604→merge517cc970/main·브랜치 보존을 실제 확인하고 그 최신 main에서 시작했다. 과거 진행 기록은 아래에 보존한다.

2026-10-10 [S6.22 계정 작업 중 실제 캐시 복원](stories/auth-page-restore.md): 로그아웃 실패 화면을 떠났다가 실제 Back으로 돌아오면 개인 화면이 재등장하는 결함을 재현·보완했다. 같은 문서/native persisted 복원에서 오류 차단→명시 retry204→login/옛 쿠키401과 정상 권한 재확인을 유지한다. [실제 화면·원본 실패/입력·경계·작성자 리뷰](review/auth-page-restore/README.md). 기존 가입·복구·기록/삭제 흐름과 상태 전이·전체frontend1504/관련 SQL64·정적/build/guard·source19/불변187/증거120 SHA를 확인했다. scoped 조건부 PR 게이트를 진행한다. 화면 구조/CSS/문구·서버 schema/정책·아바타/운영 변경0, 아바타 보류·독립 웹 진행·D2/전체1~6/기존 시작P2·UI/SDK·실측/외부/운영 미완료를 유지한다. PR113의 source80fc1ee2→mergee51ab4b3/main 포함을 실제 확인하고 최신 main에서 시작했다. 이전 시점 기록은 아래에 보존한다.

2026-10-10 [S4.17 로그아웃 서버 확인](stories/logout-acknowledgement.md): 잘못된 성공 응답을 완료로 처리하던 웹 adapter를 기존204 계약에 맞게 보완했다. 실제 Chrome/API/새 SQL에서 확인 실패 시 개인 화면 차단→명시 retry204→기존 쿠키401·다른 탭 종료와 기존 가입/복구/기록 사용자 흐름을 확인했다. [실제 화면·RED 원본·실제/합성·작성자 리뷰](review/logout-acknowledgement/README.md). frontend1497·native 계정11/통합2/비밀번호5/기록11·관련 SQL64·정적/build/guard와12입력/186불변/108증거 SHA 통과, scoped 조건부 PR 게이트를 진행한다. 화면 구성·CSS/문구·서버 schema/정책·아바타/운영 변경0. 아바타 보류·독립 웹 작업을 유지하며 전체1~6/기존 시작P2·UI/SDK·실측/외부/운영 게이트는 미완료다. PR112 source da6aaac4→merge ced8c9b5/main 포함을 실제 확인하고 그 최신 main에서 시작했다. 이전 시점 기록은 아래에 보존한다.

2026-10-10 [S5.6 소유·삭제 제약 준비 검사](stories/readiness-owned-constraints.md): 실제 DB의 계정/기록 FK 손상을 정상 준비로 반환하는 결함을 재현해 수정했다. 손상503/live200→복원200, 이름 변경 정상·다른 schema/replica 우회 차단이 실제 PostgreSQL·loopback HTTP에서 작동한다. [실패/실제·합성/소스·리뷰](review/readiness-owned-constraints/README.md). 화면/공개 코칭/아바타·schema/정책·운영 변경0, 최신 아바타 보류·독립 웹 진행을 유지한다. 전체 서버 회귀와 최종 준비 하네스/정적 검증을 통과해 scoped 조건부 PR 게이트를 진행한다. 기존 타입/시작P2·실측/동작0·UI/SDK·외부/운영·D2/전체1~6은 미완료다. PR111의 실제 source904bb8f·merge9f589776/main 포함·브랜치 보존을 확인하고 그 최신 main에서 시작했다. 이전 시점 기록은 아래에 보존한다.

2026-10-10 [S6.21 계정 데이터 탈퇴·재가입](stories/account-data-web-lifecycle.md): 네 종류 데이터/과거·활성 기준선의 취소 보존→본인만 삭제/타인 보존→동일 이메일 실제 웹 재가입→두 빈 기록 화면을 확인했다. [작동 흐름·실패·실제/합성·증거](review/account-data-web-lifecycle/README.md). 제품/UI/문구/API/DB 정책·새 아바타/운영 변경0이며 최신 아바타 보류·독립 웹 진행 지시를 따른다. 첫 전체의 private reader 시간 초과는 보존했고 최종 탈퇴/복구·읽기 전용 SQL·로컬 품질 검증을 통과했다. 좁은 Story의 조건부 PR gate를 진행한다. 실측/출시 동작0·최종 아바타·승인 코칭/SDK·시작P2·외부/운영·D2/전체1~6은 미완료다. PR110은 실제 merge8ab7f15/main 포함·브랜치 보존을 확인했다. 이전 시점 기록은 아래에 보존한다.

2026-10-10 [S6.20 현재 기록 웹 HTTP·SQL 회귀](stories/web-http-records-regression.md): 가입→탐색 준비→기록 상세/삭제→계정/로그아웃과 기간 오류 복구를 실제 웹·API·새 격리 DB로 확인했다. [실제 흐름·옛 문구 실패/보완·증거](review/web-http-records-regression/README.md). 제품 UI/API/DB/정책 변경0·새 아바타 제작/검증0이다. 최신 CEO 선택 아바타 보류·독립 웹 진행, 기존 시작P2·출시 동작0/실측/참여자·승인 코칭/SDK·외부/운영·D2/전체1~6 미완료를 유지한다. 좁은 계약/검증 Story의 조건부 PR 게이트를 진행하며 이전 원본과 시점 기록을 보존한다.

2026-10-10 [S4.D6 기존 수행 기록 문구](stories/records-minimal-copy.md): 조회→상세→같은 기간 복귀, 삭제 확인→취소, 오류/재조회·페이지·로그아웃을 유지하며 중복 설명을 줄였다. [실제 전후 화면·흐름·실패](review/records-minimal-copy/README.md). 공개 기록 화면만 보완하며 코칭 구조/아바타·판정/SDK/API/DB·운영 변경0이다. 최신 CEO 선택은 아바타 보류·독립 웹 진행이며 Draft #108에 원본/실패/미실행을 보존했다. 합성 API 시험을 실제 SQL/수행/참여자 검증으로 세지 않는다. scoped PR gate를 진행하며 D2/전체1~6의 필수 조건은 유지한다. 이전 시점 기록은 보존한다.

2026-10-09 [S4.D5 최소 문구·움직이는 선택 시안](stories/visual-motion-selection-prototype.md): 기존 정적 코칭→남녀 같은 제작 시험 동작 미리보기→재생/정지→배치 복귀를 별도 HTML로 연결했다. [실제 화면·실패·한계](review/visual-motion-selection/README.md). 제품 구조/공개 번들·카메라/API/판정·원본/GLB/조형 변경0. 구조 승인·출시 동작0/실측·최종 외형·기존 시작P2·SDK/외부/운영·전체1~6/D2 미완료. 좁은 시안 범위의 조건부 PR 게이트를 진행한다. PR106은 source9e1ea57·mergea44e713의 실제 main 포함/브랜치 보존을 확인했다. 이전 시점 기록은 보존한다.

2026-10-09 [S6.19 로그인 소유 첫 추론 준비](stories/owned-native-warmup.md): 준비 입력을 판정/기록에서 분리하고 준비 중 권한 취소·늦은 결과·명시적 새 소유자 재시작과 본인 중단 기록 흐름을 실제 Chrome/API/격리 SQL로 검증했다. [작동 흐름·실패/리뷰 보완·실제/합성 경계](review/owned-native-warmup/README.md). 단일5초의 최종 기본26/opt-in42·로컬 품질 검사가 통과했고 증거·조건부 PR 게이트를 진행한다. 공개 구조/문구 최소화·기본 경로/모델/화질·신체 판정·원본/GLB/조형·운영 변경0. SDK CSP 차단 시도·기존 시작P2·실측/최종 외형/시범·승인 UI/SDK·D2/전체1~6 미완료 유지. PR105는 source5f6884c1·mergece137244로 main에 포함됐고 원본 브랜치를 보존했다.

2026-10-09 [S6.18 준비용 첫 추론](stories/native-inference-warmup.md): 재생 전에 실제 첫 입력을 처리/폐기하고 동일 source의 새 입력으로 재생한다. 준비 결과 적립0·취소/늦은 완료·source retirement/SDK close·새 소유자 경계를 구현했다. [실제 흐름·비용 이동/실패/한계](review/native-inference-warmup/README.md). 최종 Chrome154/155 normal16/취소4와 로컬 검증을 통과했으나 준비 시간이 늘고 전체 시작은 일관된 개선이 아니다. 원래26/Auth/SQL/실제 사람·시작P2·최종 외형/시범·승인 공개 UI/SDK·D2/전체1~6은 미완료다. 공개 byte/최소 문구·기본 경로/화질/판정·원본/GLB/조형·운영 유지, 조건부 PR 게이트를 진행한다.

2026-10-09 [S2.M4 관찰자 촬영 범위 대조](stories/observer-framing-comparison.md): 기존 개발 도구에서 관찰자/인식 결과를 분리하고 튜닝 동결·새 프레임 검증·설정 변경/복원 차단·초점 복귀를 구현했다. [작동 패널·실패·실제/합성 구분](review/observer-framing/README.md). 공개 JS/CSS byte 동일·최소 문구/구조·SDK/판정/아바타/운영 유지. 실제 참여자/독립 조건·classifier/정확도·최종 외형/시범·원래 시작P2/승인 UI/SDK·D2/전체1~6은 미완료, 출시 동작0이다. 제한된 Story의 로컬 검증/작성자 리뷰를 마치고 조건부 PR 게이트를 진행한다. 아래의 시점별 기록은 보존한다.

2026-10-09 [S4.D4 기존 계정·복구 최소 문구](stories/account-minimal-copy.md): 내 계정의 중복 설명을 줄이고 복구의 세션 종료·카메라 미사용 안내를 좁은 창에서도 유지했다. [실제 전후 화면·흐름·실패·한계](review/account-minimal-copy/README.md). 기존 메뉴/구조·인증/API/CSS·임상/아바타·운영 정책은 유지하며 코칭 확장0이다. 실제 Chrome의 API는 합성이고 실제 메일/SQL 검증이 아니다. 조건부 PR 게이트를 진행한다. 구조 승인·D2/실측/최종 외형·기존 시작P2·외부/운영과 전체1~6은 여전히 미완료다. 이전 기록은 보존한다.

2026-10-09 [S3.P1 선택용 동작 미리보기 재생기](stories/owned-motion-preview.md): 보존 남녀 GLB·Blender 시험 클립으로 마우스/키보드 재생→이탈/숨김 정지→명시 재생/오류 복구→교체·제거를 실제 Chrome154/155에서 확인했다. [실제 화면·실패/보완·검증 경계](review/owned-motion-preview/README.md). 재생기만 완료하며 공개 선택 화면/미승인 구조 확장0·원본/GLB/새 조형0·카메라/판정/SDK/운영 변경0이다. 기존 최소 문구 원칙은 유지하고 이미지/움직임이 동작 설명을 대신하도록 준비했다. 구조 승인·출시 동작/최종 외형·실측/참여자·기존 시작P2/Draft101·D2/전체1~6 완료 기준은 미충족이다. 조건부 PR 게이트를 진행하며 이전 기록은 보존한다.

2026-10-09 [S6.16 촬영 목 전체 회귀 복원](stories/native-neck-full-regression.md): 현재 비공개 accepted frame에 원래26개 test body/guard/loop 구성을 복원했다. [실제 촬영 비율/presence·가림·pause/새 세대·권한 회수·기록 흐름과 한계](review/native-neck-full-regression/README.md). actual Chrome155/SDK/API/격리 SQL의 목26·기본24와 FE/타입/정적/build/guard·공개/원본 불변은 통과했다. 과거 Chrome154/PR90의13실패 원인·기존 시작P2 해결이 아니다. 공개 구조/최소 문구·원본/GLB/새 조형·SDK/판정·운영 변경0, 실제 사람·최종 외형/시범·승인 공개 UI/SDK·D2/전체1~6은 미완료다. 좁은 회귀 복원 Story의 조건부 PR 게이트를 진행하며 이전 기록은 보존한다.

2026-10-09 [S6.15 로그인 소유 렌더 준비](stories/owned-render-preparation.md): GPU 준비 helper를 실제 로그인 소유 코칭에 연결해 준비 중 logout/이탈·늦은 완료의 재생/기록 차단과 남녀 정상·pause/새 세대/본인 기록을 확인했다. [실제 흐름·실패2건·보완·한계](review/owned-render-preparation/README.md). actual Chrome prepared28/default24·FE1411·타입/정적/build/guard·공개 byte 불변을 확인하고 증거/조건부 PR 게이트를 진행한다. PR98 실제 mergec15608a의 최신 main에서 시작했다. 기본 경로·SDK 정책/모델/화질·원본/GLB/새 조형·최소 문구·운영 유지, 원래26/기존 시작P2·실측/최종 외형·승인 공개 구조/SDK·D2/전체1~6은 미완료다. 이전 시점 기록은 아래에 보존한다.

2026-10-09 [S6.14 렌더 준비 장벽](stories/native-first-render-isolation.md): 두 아바타의 shader/GPU 업로드를 ready 이전에 마치고 취소·실패 때 늦은 재생을 막는다. [실제 흐름·실패·한계](review/native-first-render-isolation/README.md). 최종 준비 후 첫 render1.0~5.8ms지만 비용은 준비로 이동했으며 추론/화면 공백·중간 대조군6047ms와 기존 시작P2는 남는다. 공개 byte/문구·원본/GLB·모델/화질·기본 main/SDK/운영 유지, 실제 사람/승인 공개 구조·최종 외형·D2/전체1~6은 미완료다. 현재 Story 결과 정리·조건부 PR 게이트를 진행한다. 다음 신규 Story/외부/디자인 적용을 이 기록으로 승인된 것으로 만들지 않는다. 텍스트는 짧은 제목·버튼·현재 코칭, 펼쳐 보는 설명·간결한 필수 안전 안내로 제한한다.

2026-10-09 [S6.13 시작·화면 경합 조사](stories/native-main-thread-contention.md): 실제 비공개 native 자원·두 원본 GLB의 main/Worker 흐름을 제한된 Chrome/CDP 조건에서 비교했다. [작동 흐름·실패·한계](review/native-main-thread-contention/README.md). Worker도 첫 화면 공백이 남으며 과거 시작 실패13건은 재현되지 않았다. 기존 통합26건은 미실행/시작P2 유지다. 공개 byte/최소 문구·원본/기본 경로/모델·판정/SDK/운영은 변경0이며 실제 사람·승인 공개 구조·최종 외형·D2/전체1~6은 미완료다. 다음은 첫 렌더/SDK 비용의 제한된 분리 조사다.

2026-10-09 [S2.M3 관절 존재 신뢰도 소비](stories/pose-presence-guard.md): 낮은/비정상 presence의 팔·몸통 관찰을 거부하고 남녀 기존 3D의 해당 강조 해제→다른 부위 유지→새 관찰 복구를 확인했다. [실패·작동 흐름·한계](review/pose-presence-guard/README.md). 합성 시험이며 실제 사람 정확도·최종 외형·승인 UI/SDK·시작P2·D2/전체1~6/출시 동작0은 미완료다. 최소 문구·공개 byte/GLB·기존 승인 경계는 유지한다. PR95 실제 merge42cfa7d의 최신 main에서 새 Story를 시작했다. 아래는 시점별 기록이다.

2026-10-09 [S2.M2 촬영 기하·목 관찰 입력](stories/captured-neck-input.md): 실제 촬영 크기와 original stamp/presence를 보존해 비공개 코칭 evaluator로 연결했다. [작동 흐름·실패·실제/합성 구분](review/captured-neck-input/README.md). 남녀 native 계정/두 모델/기록 회귀와 main/worker 기하 연결을 확인했으며, 공개 byte/최소 문구·GLB·판정/SDK 정책·운영은 유지한다. 실제 사람/올바른 시범/classifier·최종 외형/권리·승인 UI/외부/운영·기존 시작 P2·D2/전체1~6 및 출시 동작0은 여전히 미완료다. PR #94는 실제 merge d3be7ad에서 확인한 기준선이며 그 최신 main에서 별도 Story를 시작했다.

2026-10-09 [S6.12 응답 없는 Worker 복구](stories/native-worker-recovery.md): 실제 준비 고장→기록0, 수행 고장→카메라 종료/본인 interrupted만 저장과 기존 남녀 정상 소유 흐름을 확인했다. [실패·증거·한계](review/native-worker-recovery/README.md). 공개 byte/문구·GLB/모델·기본 main 추론 유지, 실제 사람/물리 카메라0·기존 시작 P2/D2/전체1~6 미완료. PR #93은 main f26c7b9에 실제 병합됐고 그 최신 main에서 새 Story를 시작했다. 아래는 시점별 기록이다.

2026-10-09 [S6.11 비공개 Worker 추론](stories/native-worker-inference.md): 실제 Chrome/SDK/API/격리 SQL의 로그인→두 아바타→중단/본인 기록·준비 중 로그아웃·세션 갱신/새 시작을 확인했다. [실패·최종 증거·한계](review/native-worker-inference/README.md). 가짜 카메라/메일/동작 gate·미완성 A37이며 기본 main/공개 byte·모델/GLB·최소 문구·판정/SDK 정책/운영은 유지한다. PR 게이트 진행, 기존 시작 P2·실측/외형·D2/전체1~6 미완료. 아래는 시점별 기록이다.

2026-10-09 [S6.10 출시 통합 경계 기록](stories/release-readiness-gates.md): [현재 흐름·필수 미완료·요청한 결정/연결](release-readiness-gates.md)을 최신 main/열린 Draft와 대조한다. 기존 정적 시안의 구도·선택·설정·설명 접기·종료만 독립 Chrome으로 재확인했으며 제품/최종 아바타·임상/실측 검증은 아니다. 코칭 구조 적용·SDK 제품 차단 정책·실제 수행자/관찰자 연결의 답변은 미수신, Docker 미연결·Q13/27/32·기존 P2/D2/전체1~6 미완료다. 이번 목적은 문서/증거이며 구현 범위·품질 기준·승인을 바꾸지 않는다. 아래는 시점별 기록이다.

2026-10-08 [S2.M1 목 옆 기울이기 관찰값](stories/neck-side-observation.md): 실제 영상 비율·명시적 반전의 이미지 평면 귀/어깨 상대 기하를 구현했다. [실행·실패·한계](review/neck-observation/README.md). 새87/FE1301·정적/type/build/guard·공개 byte 동일을 확인하고 조건부 PR gate를 진행한다. 실제 source/개발 관찰·사람 라벨/임계값·올바른 동작/교정·최종 외형/승인 UI·SDK/외부/운영·기존 시작 P2·출시0과 전체1~6은 미완료다. PR88의 실제 mergeda32cf5/main·브랜치 보존을 확인하고 그 최신 main에서 시작했으며 최소 문구·원본/실패·별도 승인 경계는 유지한다. 아래는 시점별 기록이다.

2026-10-08 [S2.T23](stories/native-trunk-feedback.md): 로그인 소유 native 흐름의 몸통 축·supplied 오류 강조·가림/복구·pause/새 세대·본인 중단 기록을 연결했다. [실제 화면·실패/보완·증거](review/native-trunk/README.md). 최종 Chrome 남녀24·FE1214·정적/type/build/guard·공개 byte/GLB 불변을 확인하고 조건부 PR gate를 진행한다. 실제 사람/올바른 동작·최종 외형/권리·승인 공개 UI·SDK/외부/운영·기존 시작 P2·출시 동작0과 D2/전체1~6 미완료를 유지한다. 최소 텍스트·원본/실패·새 조형0·별도 승인 경계는 그대로다. 아래는 시점별 기록이다.

2026-10-08 [S2.T22 몸통 방향 연결](stories/observed-trunk-swing.md): 같은 어깨·골반 관찰로 사용자 모델의 집계 축 기울기를 연결하고 원본/시범·중간 구조를 보존했다. [실제 남녀 화면·가림/복구·실패·증거](review/observed-trunk/README.md). 개별 척추/골반/비틀림·실제 사람 정확도나 최종 외형이 아니다. 전체 FE1205·Chrome 남녀·정적/build/guard·공개 byte 동일을 확인했고 조건부 PR gate를 진행한다. 출시 동작0·D2/전체1~6·시작P2/승인 UI/실측/SDK/외부·운영 게이트는 미완료다. 최소 텍스트·원본/실패·같은 부위 새 조형0·기존 승인 기준을 유지한다. 아래는 시점별 기록이다.

2026-10-08 [S3.4 보류 동작 자료·검수 목록 연결](stories/motion-source-recovery.md): 어깨 으쓱·이완과 팔 위로 뻗기의 원문을 실제 확인하고 기존 검수 목록 검색→상세/자료→복귀에 연결했다. [실제 화면·실패·증거](review/motion-source-recovery/README.md). 출시 적격0·공개byte/구조·조형/GLB·판정/SDK/운영 변경0이다. PR85는 실제 merge7516c641/[원격 결과](https://github.com/HSU-OAS/bodyguard/pull/85#issuecomment-6058364965)를 확인한 기준선이며 S3.4 조건부 PR gate를 진행한다. 실제 동작별 실측/시범·최종 아바타·승인 공개 UI·참여자/다장치·외부/운영·시작P2 및 전체1~6은 미완료다. 최소 텍스트·기존 원본/실패·같은 부위 새 조형 보류·별도 승인 경계를 유지한다. 아래는 시점별 기록이다.

2026-10-08 [S6.8 시작 단계 계측](stories/native-startup-timing.md): 실제 로그인/SDK/두 아바타 흐름의 카메라·모델 생성·GLB·렌더·추론/반환을 시험에서 구분한다. [작동 흐름·실패·미확정 원인](review/native-startup-timing/README.md). runtime245508c의 실제 Chrome20/FE1177·정적/build/guard·public byte 동일을 확인했지만 과거 지연은 재현되지 않아 시작 P2를 유지한다. PR84 실제 merge258f741과 [원격 기록](https://github.com/HSU-OAS/bodyguard/pull/84#issuecomment-6057781090)을 확인한 최신 기준선이다. 조건부 PR 게이트 다음이며 실제 사람/판정·최종 외형/승인 UI·외부/운영 및 전체1~6은 미완료다. 최소 텍스트·아바타 중심·출시 동작0·원본/실패/추가 조형 보류·별도 승인 경계를 유지한다. 아래는 시점별 기록이다.

2026-10-08 [S2.T21](stories/adaptive-reference.md): 같은 현재 오류 코드/부위/단계에 맞는 저작 시범으로 전환하고 가림/만료의 이전 안내를 중단한다. [실제 남녀 흐름·미완성 외형·실패/합성 구분](review/adaptive-reference/README.md). runtime3c8ce1a의 Chrome18/FE1169·정적/build/guard·공개 byte 동일을 확인했다. PR83은 실제 merge36ed814와 [원격 결과 기록](https://github.com/HSU-OAS/bodyguard/pull/83#issuecomment-6055527680)을 확인한 기준선이다. 이번 Story 조건부 PR gate는 다음이며 실제 classifier/교정 콘텐츠·실측·최종 외형/승인 UI·SDK/외부/운영·시작 P2와 전체1~6은 미완료/출시 동작0이다. 최소 텍스트·아바타/미리보기 중심·원본/실패·같은 부위 조형 보류·기존 승인 기준 유지. 아래는 시점별 기록이다.

2026-10-08 [S2.T20](stories/native-feedback.md): 같은 native delivery→현재 로그인 소유 코칭 상태→사용자 오류 강조·시범 phase를 연결했다. 남녀 강조/가림·복수·미검출 해제/복구·pause/새 세대·권한 회수·본인 중단 기록의 [실제 화면·실패·합성 구분](review/native-feedback/README.md)을 보존했다. runtime d4f475c의 통합16/비교14·FE1145·정적/build/guard는 통과했고 조건부 PR gate를 진행한다. 초기 시작·재준비 실패와 간헐적 시작 원인/출시 P2는 유지한다. 최종 외형·실제 오류 판정/적응형 교정 시범·실측·승인 공개 구조/UI·전체1~6은 미완료/출시 동작0이다. 다음은 실제 동작 기준/오류 분류·오류별 교정 시범 연결과 실측 조건을 분리한 독립 작업이다. 공개 byte/디자인·조형/GLB·안전/SDK/운영 변경0, 최소 텍스트·원본/실패·기존 승인 기준 유지. 아래는 시점별 기록이다.

2026-10-08 [S2.T19](stories/avatar-surface-feedback.md): 사용자 모델의 관찰에 결합한 표면 강조→가림/미검출/만료 해제→복구/종료를 실제 남녀 WebGL로 검증했다. [실제 화면·실패·남은 조건](review/surface-feedback/README.md). 합성 오류 표시 기반이며 native classifier/적응형 시범·실제 자세 정확도·최종 외형·승인 공개 UI·전체1~6은 미완료/출시 동작0이다. 다음은 같은 native 관측·현재 코칭 판정과 표시/시범 안내의 비공개 통합이다. 공개 byte/디자인·조형/GLB·임상 기준·운영 변경0, 최소 텍스트·원본/실패·기존 승인 기준 유지. PR81 실제 merge b9eb40b 이후 최신 main에서 시작했고 아래는 시점별 기록이다.

2026-10-08 [S2.T18](stories/native-reference.md): 실제 로그인 소유 pair의 단계 시범·pause/새 세대 resume·권한 회수 연결을 검증했다. 강화 비교에서 발견된 정지·retained 핸들 문제를 보완하고 [작동 흐름/실제 미리보기·실패·이월](review/native-reference/README.md)을 보존했다. 공개 디자인/byte·판정·조형/GLB·운영 변경0, 최종 외형·실측·승인 UI·전체1~6은 미완료/출시 동작0이다. 다음은 검증된 오류 안내/시범 비교의 독립 연결이며 선행 실측·외부/디자인 승인을 건너뛰지 않는다. 최소 텍스트·기존 사전/별도 승인 기준 유지. 아래는 시점별 기록이다.

2026-10-08 단계 시범 재생: [S2.T17](stories/reference-playback.md)은 owned pair의 시범 모델을 준비→수행→유지→복귀에 반응하도록 연결했다. 현재 자세의 부드러운 전환·정지/만료/재개·해제, 관찰/source와 독립성이 실제 남녀 WebGL에서 작동한다. [화면·실패·남은 조건](review/reference-playback/README.md). Blender 메모리 제작 fixture이며 올바른 스트레칭/실제 사람 검증은 아니다. 다음은 로그인 native session과 단계 전달의 비공개 통합이다. 공개 byte/문구·같은 부위 새 조형/GLB·임상/SDK 정책/운영 변경0. 최소 텍스트·0 qualified motions·D2/전체1~6 및 별도 승인 기준은 유지한다. 아래는 시점별 기록이다.

2026-10-08 몸·얼굴·손 native 연결: [S2.T16](stories/native-hands.md)에서 같은 frozen 입력/시각과 손의 선택적32관절·로그인 소유권을 연결했다. 비공개 시작→두 아바타→중단/본인 기록, 대기 중 logout/401/교체/이탈의 이전 재생·저장 차단 및 입력 반환 후 세 SDK·카메라 정리가 작동했다. [실제 흐름·실패·미완성 미리보기](review/native-hands/README.md). 가짜 장치 native 미검출과 별도 생성 손 양성을 구분한다. 다음은 코칭 단계에 맞는 시범/사용자 비교 연결의 선행 조건과 독립 구현이다. 실제 사람/동일인·판정·최종 외형/권리·승인 UI·SDK/노트북/외부·운영 및 전체1~6 미완료, 공개 byte/화면·같은 부위 새 조형0·최소 텍스트·기존 승인 기준을 유지한다. 아래는 시점별 기록이다.

2026-10-08 손목·손가락 표시: [S2.T15](stories/observed-hands.md)에서 owned 사용자 모델32관절을 연결했다. 실제 남녀 GLB의 굽힘/회전→클리핑/누락→복구→만료/종료와 비교/source·전신/8가중치 보존이 작동한다. [흐름·실패·미완성 미리보기](review/observed-hands/README.md). 생성21점/실제WebGL이며 실제 카메라/SDK/사람 검증은 아니다. 다음은 native 손 결과의 같은 입력·소유권 연결이다. 공개 UI/문구/byte·조형·판정/SDK 정책·운영 변경0, 최소 문구·이월/전체1~6 기준·별도 승인 유지.

2026-10-08 로그인 소유 몸·머리: [S2.T14](stories/native-body-head.md)에서 재사용 native adapter에 선택적인 Face/head와 같은 입력 source를 연결했다. 비공개 웹의 준비→두 GLB→중단→본인 기록, 얼굴 결과 대기 중 logout/401/세션 교체의 이전 저장·재개 차단과 새 소유자 명시 시작이 작동한다. [실제 흐름·미완성 canvas·실패/남은 조건](review/native-body-head/README.md). 공개 화면/문구·byte·조형·판정·SDK 제품 정책/운영 변경0. 실제 사람/native 양성·목/체간/손·시범/외형/승인 디자인·이월/전체1~6은 미완료이며 최소 문구·기존 원본/실패·별도 승인 기준을 유지한다. 다음 독립 연결은 사용자 손 관찰/리그와 시범 단계의 선행 조건을 검토하고 미승인 공개 UI는 확장하지 않는다.

2026-10-08 머리·사지 통합: [S2.T13](stories/observed-body-head.md)은 같은 입력/원래 stamp의 머리 후보와 사지를 사용자 모델에 연결했다. [실제 흐름·미완성 canvas·실패/남은 조건](review/observed-body-head/README.md). 남녀 준비→합성 움직임→얼굴 누락/사지 지속→native 미검출→pending 종료가 실제 Chrome에서 작동하며 비교/source·8가중치·전신과 공개 byte를 보존했다. 실제 사람/동일인·세밀한 판정/시범·외형·승인 디자인/SDK 정책·전체1~6은 미완료다. 다음은 계정 소유 재생의 native 준비 adapter에 body/face와 명시 head 정렬을 연결하는 비공개 통합이며 외부/실측 승인은 별도로 남긴다. PR75 실제 merge2bc3cd9/main·브랜치 보존을 확인하고 최신 main에서 시작했다. 조형/공개 문구/운영 변경0·최소 문구/원본/실패·기존 승인 경계를 유지한다. 아래는 시점별 기록이다.

2026-10-08 동일 프레임 연결: [S2.T12](stories/body-face-frame.md)은 frozen VideoFrame/원래 stamp의 body→face·사전 body 복사·회전 후보 전달과 종료 장벽을 연결했다. [실제 흐름·실패·한계](review/body-face-frame/README.md). native Chrome 가짜 장치의 대기 종료/새 세대·정리와 전체976/정적/build/guard를 실제 확인했고 공개 JS/CSS·5모델 byte는 동일하다. 같은 입력은 동일인 검증이 아니며 실제 사람/머리 긍정·head rig/경추 분절·시범/판정·외형/디자인/SDK 정책·전체1~6은 미완료다. PR74 실제 merge62b8375·main/source/브랜치 보존을 확인한 최신 main에서 시작했으며 최소 문구·조형0·원본/실패·별도 승인 경계를 유지한다. 아래는 시점별 기록이다.

2026-10-08 머리 방향 연결: [S2.T11](stories/head-orientation.md)은 명시 camera 기준/행렬 순서·거울·수명으로 기존 남녀 GLB의 독립 head bone을 연결했다. [실제 검수 화면·실패·남은 조건](review/head-orientation/README.md). runtime2dd5d9e의 실제 Chrome 합성2흐름/전체960·정적/build/guard·공개 byte 동일을 확인했다. 자동2초 정면/조형/공개 UI·SDK 정책·판정·운영 변경0. 다음은 native pose/face 동일 frozen 프레임·소유 수명 통합이며 실제 사람/경추 분절·시범/피드백·외형/디자인 및 전체1~6은 미완료다. 최소 문구와 기존 원본/실패·별도 승인을 유지한다. PR73의 실제 merge01b97db/main·source1281bbe 포함·브랜치 보존을 확인하고 최신 main에서 시작했다. 아래는 시점별 기록이다.

2026-10-08 native 카메라 복구: [S2.T10](stories/native-camera-recovery.md)은 실제 재사용 adapter로 명시 카메라/SDK/두 GLB 연결과 권한 거부·늦은 반환 취소·track/GLB 실패 뒤 새 준비/재시작을 연결했다. [작동 흐름·아바타 canvas·실패/한계](review/native-camera-recovery/README.md). runtime9918072의 실제 Chrome/API/격리 SQL 복구와 기존 계정 흐름을 재검증했으며 가짜 장치/시험 이벤트를 물리 webcam 검증으로 세지 않는다. 공개 JS/CSS byte 동일·GLB0·미승인 디자인/조형/SDK 제품 정책/운영 변경0이며 Story PR 게이트를 진행한다. 원본 실패·이월/전체1~6 기준·최소 문구 원칙은 유지한다. 공개 코칭·최종 외형/세밀한 판정·실제 사람/노트북·HTTPS 및 SDK 정책은 미완료다. PR72 실제 merge708c6a0/main·브랜치 보존을 확인하고 그 최신 main에서 시작했다. 아래는 시점별 기록이다.

2026-10-08 native 계정 통합: [S2.T9](stories/native-auth-playback.md)는 실제 AuthProvider/API/격리 SQL과 가짜 카메라의 native SDK·남녀 두 GLB를 같은 Chrome 흐름에 연결했다. 시작→중단→본인 기록, 같은 계정 갱신·logout204·/me401·pagehide·unmount의 재생 차단/정리 대기/명시 새 시작을 확인했다. [실제 흐름·실패·한계](review/native-auth-playback/README.md). runtime5524b1d의 증거·최신 PR 게이트를 확인하며 공개 byte/GLB0·조형/미승인 디자인·SDK 제품 정책/운영 변경0을 유지한다. 실제 사람/물리 webcam·최종 외형/세밀한 판정·승인 디자인·B09·다장치/HTTPS 및 전체1~6은 미완료다. 최소 문구/원본 보존/별도 승인 기준을 유지한다. 아래는 시점별 기록이다.

2026-10-08 로그인 소유 재생: [S2.T8](stories/owned-auth-playback.md)은 준비 중 취소·이전 자원 정리 대기·새 기록 세션 교체·로그아웃/refresh/이탈의 lifecycle 종료를 연결했다. [실제 흐름·실패·남은 조건](review/owned-auth-playback/README.md). runtime f6c47d7의 실제 Chrome/API/격리 SQL에서 본인 기록 상세와 실제 logout204·/me401을 확인했으며 자원/동작/메일은 합성이다. 공개 byte/화면·아바타 조형·SDK 정책/운영 변경0. 다음은 native SDK/남녀 GLB와 실제 계정의 Chrome 통합이다. 실제 사람·최종 외형/판정·승인 디자인·이월 D2/전체1~6 완료가 아니다. PR70의 실제 merge907dbdf/main·브랜치 보존을 확인하고 최신 main에서 시작했으며 원본/최소 문구/별도 승인 기준을 유지한다. 아래는 시점별 기록이다.

2026-10-08 세션·재생 자원: [S2.T7](stories/owned-playback-resources.md)는 기존 세션의 준비→일시정지→새 세대 재개→만료/종료를 실제 Chrome 가짜 카메라·SDK·남녀 GLB에 연결했다. pending 입력/결과를 정리한 뒤 native 자원을 닫고, 실패/원본과 [작동 흐름](review/owned-playback-resources/README.md)을 보존했다. runtime8ff7481·native/회귀·정적/build/guard·공개 byte 동일 후 조건부 PR 게이트를 진행한다. 계정/gate는 시험 주입이고 실제 사람·최종 외형/판정·공개 코칭·D2/전체1~6 완료가 아니다. 텍스트 최소화·미승인 UI/SDK·운영·이월 기준을 유지한다. PR69 실제 merge4a9c8f5와 main/브랜치 보존을 확인하고 시작했다. 아래는 시점별 기록이다.

2026-10-08 연속 아바타 재생: [S2.T6](stories/owned-pose-playback.md)는 추론 pending 중에도 renderer/관찰 만료를 계속하고, 만료 결과는 버린 뒤 다음 프레임으로 진행한다. 실제 Chrome/RAF·가짜 카메라/SDK/남녀 GLB의 재생→지연→만료→종료와 별도 합성 긍정 보간이 작동한다. [실제 화면·실패·미완료](review/owned-pose-playback/README.md). runtime7e8a396·unit22/전체883·native 재생/기존 전달 회귀·정적/build/guard·공개 byte 동일 통과 후 PR 게이트를 진행한다. PR68 실제 merge141328f·main 동일 tree·브랜치 보존을 확인해 시작했다. 최종 외형·실제 사람·시범/판정/공개 코칭·SDK/디자인/외부/운영·전체1~6은 미완료이며 최소 문구 원칙과 기존 원본/이월 기준을 유지한다. 아래는 시점별 기록이다.

2026-10-08 새 영상 프레임 연결: [S2.T5](stories/owned-video-pose.md)는 브라우저 decoded VideoFrame→동일 SDK 결과→사용자 rig를 연결했다. 실제 가짜 카메라에서 연속 전달→대기 취소→명시 재준비→track/SDK/model 종료가 작동하며 [화면·실패·미완료](review/owned-video-pose/README.md)를 보존했다. runtime73a3e99·전체861·native남녀·정적/build/guard·공개 byte 동일 통과 후 PR 게이트를 진행한다. 실제 사람 정확도/최종 아바타·시범/공개 코칭은 미완료다. D2/디자인/SDK·운영·전체1~6 기준과 최소 문구 원칙은 유지한다. PR67의 실제 merge d1743c4/main 동일 tree·브랜치 보존을 확인하고 시작했다. 아래는 시점별 기록이다.

2026-10-08 한 추론 결과 전달: [S2.T4](stories/owned-pose-frame.md)는 실제 SDK의 생성 blank 미검출과 별도 합성 움직임을 같은 프레임 전달 경로로 남녀 GLB에 연결했다. 준비→관찰→미검출 추적 해제→중복 차단→종료가 작동하며 [실제 화면·실패·미완료](review/owned-pose-frame/README.md)를 보존했다. runtime682ea56·전체844/Chrome SDK·정적/build/guard·공개 byte 동일 통과 후 PR 게이트를 진행한다. 실제 웹캠/최종 외형·올바른 시범·피드백/공개 코칭은 미완료다. 텍스트 최소화·D2/디자인/SDK·운영·전체1~6 기준을 유지한다. 최신 PR66 merge d4d2987/main 동일 tree·브랜치 보존을 확인하고 시작했다. 아래는 시점별 기록이다.

2026-10-08 두 아바타 준비·실패·종료: [S2.T3](stories/owned-avatar-pair.md)에서 실제 남녀 GLB 준비→합성 움직임→종료→실패→명시 재시도·취소된 늦은 반환과 정리 실패 차단을 연결했다. [실제 화면·원본 실패·범위/미완료](review/owned-avatar-pair/README.md). 비공개 자원 구현이고 최종 외형/올바른 시범·SDK/웹캠/공개 코칭은 아니다. frontend826·native남녀·정적/build/guard·공개 JS/CSS byte 동일·63증거/source SHA 통과 후 조건부 PR 게이트를 진행한다. source4369677이며 기존 조형/GLB·미승인 화면 변경0, 텍스트 최소화·D2/디자인/SDK/Docker/실측·전체1~6 기준은 유지한다. PR65의 실제 merge2c4ec7f/main 포함·같은 tree·브랜치 보존을 확인하고 그 최신 main에서 시작했다. 아래는 시점별 기록이다.

2026-10-08 같은 관찰 결과→사용자 리그: [S2.T2](stories/observed-avatar-pose.md)에서 한 번의 image/world 결과와 원본 세대·시각을 기존 GLB에 연결했다. runtimefea93b9의 실제 Chrome 남녀 각각 움직임→가림/복수 보류→복구→만료/종료, 비교 모델·원본 불변과 전신 구도를 확인했다. [실제 화면·원본 실패·남은 조건](review/observed-avatar-pose/README.md). 합성 관찰이며 실제 SDK/카메라·올바른 시범/피드백·최종 외형은 아니다. frontend810·정적/build/guard·공개 byte 동일·82증거/source SHA를 실제 확인하고 PR 게이트를 진행한다. D2-A/M/T/R/I/P·디자인/SDK/외부/운영 및 전체1~6 기준은 유지한다. PR #64의 실제 merge48d3154·main 포함·브랜치 보존을 확인하고 그 최신 main에서 시작했다. 아래는 시점별 기록이다.

2026-10-08 두 아바타 움직임 연결: [S2.T1](stories/avatar-directional-rig.md)에서 기존 남녀 GLB의 두 독립 리그에 서로 다른 사지 방향을 전달하고 발끝까지의 실제 WebGL 구도를 확인했다. [검증 화면·남은 문제](review/avatar-directional-rig/README.md). 비공개 합성 입력이며 공개 코칭/외형 수정·카메라·목/손 추적·올바른 시범/피드백은 아직 아니다. D2-T와 전체1~6은 미완료이고 PR 게이트를 진행한다. 기존 모델/실패·원본·승인·디자인/SDK/운영 경계는 유지한다.

2026-10-08 계정·설정·알림 수명 연결: [S4.N4](stories/owned-alert-lifecycle.md)에서 실제 계정 권위/본인 설정 조회를 비공개 전달 부품에 연결했다. 실제 웹 설정 저장→enabled 종류 안내→선택/닫기→재조회·명시 재준비→로그아웃204/guest/API401을 production Chrome·API·격리 SQL로 확인했다(안내/메일 합성). 재진입/이탈 경계를 보완했고 [실패·현재 소스·작성자 리뷰](review/owned-alert-lifecycle/README.md)를 보존했다. 최종765 DOM/실제 계정 Chrome3·정적/build/guard 통과, 기존 선택8은 최종 private handoff 직전 동일 공개 JS/CSS에서 확인했다. 공개 화면/정책/SDK/아바타/운영 변경0이며 조건부 PR 게이트를 진행한다. 공개 코칭/스케줄러/소리/반응 기록·동시 설정 동기화·디자인 승인/실측/외부/2단계 이월/전체1~6 완료는 아니다. PR62의 실제 merged ddc35cf·브랜치 보존을 확인하고 그 최신 main에서 시작했다. 아래는 시점별 기록이다.

2026-10-08 보호 화면 초점 복구: [S6.8](stories/web-focus-recovery.md)에서 계정 확인 뒤 시작·탐색·계정 제목의 초점 상실을 실제 DOM/production Chrome으로 재현·보완했다. 명시 재시도·주소 변형·살아 있는 헤더/본문·공개 입력/FAQ·기록 담당 경계를 확인하고 전체744 DOM/실제 Chrome11·기존 선택8/실제 API·SQL 통합2·정적/build/guard를 통과했다. [실패·원본·범위·작성자 리뷰](review/web-focus-recovery/README.md). 화면 구성·CSS/인증 정책/판정/SDK/아바타/운영 변경0이며 조건부 PR 게이트를 진행한다. 제품 시작 지연 P2의 원인 해결이나 전체1~6 통과가 아니며 디자인 구조/적용·외부 승인·2단계 이월 기준을 유지한다. 아래는 시점별 기록이다.

2026-10-07 시작 회귀 후속 감사: [S6.7](stories/web-startup-recurrence.md)에서 PR #60의 실제 merge11ace02와 이후 선택2통과/6실패·실제 통합0통과/2실패의 보고 누락을 대조했다. 원본8개 비교6통과/2실패·후속 profile3통과/1실패를 보존하고, native Vite 대조로 확인한 helper 개발모드 오류만 보완해 같은 경계4개/730 DOM·정적/build/guard를 통과했다. [수치·원본·미실행/작성자 리뷰](review/web-startup-recurrence/README.md). 이는 별도 CLI 회귀나 제품4초 지연 원인 해결이 아니다. 제품 코드/미승인 UI/인증·판정/SDK·아바타/운영 변경0이며 조건부 PR 게이트를 진행한다. 제품 시작 P2·기존 Draft와 디자인/SDK/Docker·실측/참여자·1~6단계 미완료 기준은 유지한다. 아래는 시점별 기록이다.

2026-10-07 알림 최종 초점 리뷰: S4.N3의 선택 callback이 지정한 목적지 초점을 보존하는 경계를 실제 RED로 확인·보완했다. [추가 증거](review/alert-delivery/focus-handoff-20261007.json)의 부품37/frontend730·실제 Chrome5·타입/정적/build/guard를 통과했으며 이전 실패·36/729 증거는 유지한다. 공개 제품/디자인/인증/판정 변경0·기존 미완료 단계 기준은 그대로이고 PR #60 최신 조건부 게이트를 진행한다.

2026-10-07 웹 알림 전달: [S4.N3](stories/stage4-alert-delivery.md)의 비공개 부품에서 권한 거부 후 화면 안내 유지·스트레칭 살펴보기/닫기·교체/끄기·실제 문서 이탈 폐기와 키보드 초점 복구를 구현했다. 짧은 문구와 기본 접힌 설명을 유지하며 [실제 화면·실패·SHA·미실행 구분](review/alert-delivery/README.md)을 보존했다. 별도 [PR #59](https://github.com/HSU-OAS/bodyguard/pull/59) source72755f6→mergedb0b53a/main 포함·같은 tree·브랜치 보존을 실제 확인하고 그 main에서 전달5/실제 통합2/frontend729·정적/build/guard를 통과했다. 이전 원본11개와 실패를 보존하며 조건부 PR 게이트를 진행한다. 공개 알림 producer·classifier/동작/시범·실제 OS 표시/소리·사진의 최종 아바타·SDK privacy·실측/참여자·디자인 구조/적용·Docker/TLS/외부/운영·전체1~6 완료는 아니다. 기존 승인/이월·같은 아바타 부위 새 제작0을 유지하며 미완료 연결은 후속 필수다. 아래는 시점별 기록이다.

2026-10-07 로그아웃 시험 완료 경계: [S6.6](stories/logout-integration-completion.md)에서 Enter 입력을 서버 폐기 완료로 간주하지 않고 실제204·게스트 화면 확인 뒤 보호 주소를 이동하도록 기존 통합 시험만 보완했다. 초기1통과/1실패와 원본 순서 재실행2통과·이동 직전204 미확인을 모두 보존하고, [최종 실제 흐름·SHA·관측 한계](review/logout-integration-completion/README.md)를 남겼다. 제품 인증/화면/정책 변경0,임의 이탈 서버 폐기 보장/시작 원인 해결/전체1~6 완료가 아니다. 알림 전달 작업은 별도 목적·기존 원본을 보존하며 이 보완의 실제 통합 게이트와 최신 main 통합 후 PR을 진행한다. 기존 디자인 구조 승인·SDK privacy·Docker/외부·아바타/실측·운영 승인 경계는 그대로다. 아래는 시점별 기록이다.

2026-10-07 웹 빌드 고지: [S5.5](stories/web-notice-evidence.md)에서 실제 bundled JS·별도 Tailwind CSS 고지와 누락 차단을 구현·native 검증했다. 기존 JS/CSS/index/brand 출력5개는 byte 동일하고 고지3개만 추가됐다. [실행·실패·한계](review/web-notice-evidence/README.md). PR 게이트를 진행하며 Draft #29 exporter/실제 브라우저 전달·Docker/HTTPS·전체 권리/법무·아바타/실측·최종 코칭·디자인 구조/적용·전체1~6단계는 미완료다. 기존 실패·이월·원본과 승인 규칙은 유지한다. 아래는 시점별 기록이다.

2026-10-07 시작 원인 비교: 최신 main1a5fac7(PR #56 실제 merge commit)의 production 출력으로 headless/headed의 단순 화면/제품 /start를 동일 요청에서 비교했다. [S6.5 실제 수치·원본 SHA](review/web-startup-causal/README.md)의8개 탐색은 정상이고 과거 수 초 지연은 미재현이다. 성공 재실행을 원인 해결로 표시하지 않으며 제품 코드/기존5000ms 변경0·Draft #51/시작 P2 유지다. 같은 정상 진단의 반복 대신 실패 조건/반증 가설이 다음 입력이다. PR #56 source869e07f→merge1a5fac7의 main 포함·같은 tree·브랜치 보존을 확인했다. 코칭 구조/적용 범위·SDK 통신 승인·Docker 연결과 실제 신체/아바타·외부/운영·전체1~6 필수 기준은 남고 독립 작업을 계속한다. 아래는 시점별 기록이다.

2026-10-07 텍스트 최소화 최신: [S4.D3 독립 코칭 시안](stories/coaching-prototype-minimal-copy.md)의 보조 설명을 기본 접힌 “설명 보기”로 옮기고 중복 문구를 줄였다. 구도 전환·동작 후보·설정·단계 안내·종료 흐름과 안전/정적 시안 구분은 유지하며 [실제 최종 Chrome·화면·실패 원본](review/coaching-prototype-minimal-copy/README.md)을 보존했다. 제품 코드/화면 확장·카메라/판정·최종 아바타·전체1~6 완료가 아니다. 다음 디자인 작업은 CEO의 클릭 가능한 구조 검토와 제품 적용 범위 합의이며 독립 개발은 계속한다. Draft #51은 main317cbd1 입력 guard 통합·현재 회귀 통과 뒤에도 과거 시작 원인/실사용 성능과 미승인 디자인 구조 게이트로 유지한다. 아래는 시점별 기록이다.

2026-10-07 기록 복구 최신: [S6.4 기록 기간 입력 복구](stories/record-period-recovery.md)에서 잘못된 날짜 주소의 초기 동기화가 수정 입력을 덮는 경계를 재현해 중복 초기화만 보완했다. 실제 Chrome/API/격리 SQL에서 기록 조회/상세/페이지/뒤로가기/삭제 취소·확인·응답 단절/403/409·날짜 복구 흐름을 통과했다. [실패·원본 SHA·작성자 리뷰·한계](review/record-period-recovery/README.md). source33f690c의 scoped 검증 통과·최종 조건부 PR 게이트 진행이며 새 디자인/화면 구성/판정·privacy/운영 변경은 없다. Draft #51은 이 보완 반영·재검증과 미승인 구조/시작 원인 게이트가 남아 있고, #36 SDK 통신 정책은 별도 승인 대기다. 텍스트 최소화 원칙·2단계 이월·전체1~6 미완료 기준을 유지하고 독립 작업을 계속한다. 아래는 시점별 기존 기록이다.

2026-10-07 독립 검증 최신: [S6.3 시작 준비 하네스](stories/web-startup-readiness.md)의 strict 시작·동작 선택·도움말·실제 본인 기록/삭제·기존 공개/계정 스타일 흐름을 검증했다. 실패 matcher에 보관된 ARIA 때문에 페이지 닫기만으로 원문 수집을 막지 못하는 문제를 실제 RED로 확인해 같은 visible/5000ms 조건의 boolean 검증으로 보완했다. [현재 실제 증거](review/web-startup-readiness/current-20261007/summary.json). 이전 실패 원본은 보존하고 시작 지연 원인은 미확정이다. 제품 판정/아바타·외부/운영·전체1~6은 미완료이며 S6.3 PR 병합 게이트를 진행한다. 다음 독립 작업은 Draft #51의 회귀 재검증이다. 디자인 구조 승인·텍스트 최소화 적용은 별도 검토 구간이며 미승인 화면을 확장하지 않는다.

2026-10-07 디자인 최신: 기존 goal은 active이며 v4 의료·신체 케어 도구 분위기의 방향을 승인받았다. [S4.D2 클릭 가능한 코칭 시안](stories/coaching-design-prototype.md)을 **제품 밖의 독립 HTML**로 만들었다. 넓은 좌우 아바타·구도 변경·아바타 썸네일 후보·설정·단계 안내·종료 확인/취소/초기화가 작동하고, 중간 실패를 보존한 뒤 실제 Chrome에서 UI/오류 복구/키보드/경계 검사를 통과했다. [화면·실패·실제/미실행 구분](review/coaching-design-prototype/README.md). 정적 이미지이며 실제 카메라/시범/판정/기록은 아니다. 다음은 CEO의 클릭 가능한 구조 검토와 적용 범위 합의, 그동안 독립적인 시작 검증 등의 기존 개발을 계속한다. 기존 Draft PR·2단계 이월·전체 1~6단계 미완료 기준은 그대로다. 아래는 시점별 기존 기록이다.

최신: [S4.16 private 본인 분 업로드](stories/owned-minute-upload.md)를 실제 시간가중 집계→원래 로그인/CSRF/기대 소유자→실제 저장→본인 화이트·블루 기록 상세로 연결했다. 응답 단절 후 동일 재시도 한 분·계정 변경403/폐기·충돌409/기존 기록 보존을 실제 Chrome/API/SQL로 확인했다. [화면·예외·실패·실제/합성 구분](review/owned-minute-upload/README.md). source28/artifact54·전체682frontend/466API·privateChrome4/기록4/공개8·정적/build/guard·Node12 검증 후 조건부 PR 게이트 진행이다. 공개 producer/실제 신체/아바타·SDK P2/단계2 이월·참여자·Q32 나머지·외부/운영·전체1~6 완료는 아니다. 기존 디자인 스킬의 화이트·블루 웹을 유지하고 다음 독립 기능은 일/주 기록 집계·대시보드 연결이다. 아래는 시점별 기록이다.

최신: [PR49](https://github.com/HSU-OAS/bodyguard/pull/49)의 sourcefc49d0c→merge37354aa/main 포함·부모·동일 tree·브랜치 보존·clean을 실제 확인했다. [S4.15](stories/minute-summary-web.md)는 **저장된 본인 기록 조회/상세/삭제 웹 범위만 완료**다. 기존 증거·화이트/블루를 보존하고 최신 main37354aa의 codex/owned-minute-upload에서 [S4.16 private 본인 1분 업로드](stories/owned-minute-upload.md) 명세·최초 하네스를 시작한다. bounded memory/원래 payload·세션·기대 소유자/명시 재시도와 기존 기록 화면 연결부터 검증하며 공개 producer/실측·IndexedDB·자동 전송/개인정보 정책·운영은 미실행이다. 같은 아바타 부위 새 제작0·SDK P2/단계2 이월·참여자/Q32 나머지/전체1~6 게이트는 그대로 미충족이다. 아래는 시점별 기록이다.

최신: [PR48](https://github.com/HSU-OAS/bodyguard/pull/48)의 source36bbab5→merge654688b/main 포함·부모·브랜치 유지·clean을 실제 확인했다. 최신 main의 [S4.15 본인 자세 기록 웹](stories/minute-summary-web.md)을 구현해 시작/계정→기간 조회→분별 상세/페이지→삭제 대상·기간 확인/취소/명시 삭제·응답 단절 복구를 실제 Chrome·HTTP·SQL로 연결했다. [작동 화면·실패·실제/합성 구분·디자인 critique](review/minute-summary-web/README.md). 지정 web-design-studio의 화이트·블루·초점/좁은 창/확대를 유지하고 전체653 frontend/464 API·actual Chrome4/public8·정적/build/guard·source24/artifact93를 통과했으며 조건부 PR 게이트 진행이다. 다음은 private 분 집계의 계정/업로드·동일 재시도 연결이다. 합성 요약을 실제 신체 측정으로 세지 않으며 공개 producer0·출시 동작0·단계2 이월·SDK 개인정보 P2·실측/참여자·Q32 나머지·외부/운영·전체1~6 미완료, 같은 아바타 부위 새 제작0을 유지한다. 아래는 시점별 기록이다.

최신: PR46 기준선 API와 PR47 결과 기록이 main fccd5c4에 포함된 것을 확인하고 [S4.14 본인 1분 요약 API](stories/minute-summaries-api.md)를 구현했다. 저장·동일 재시도·충돌 batch rollback·기간 조회/명시 삭제·탈퇴 cascade, 실제 TS fractional 집계 입력과 native 복구를 검증했다. 전체458 API/590 frontend·공개Chrome8/설정4·타입/정적/build/guard 통과와 [실제 실패·화면](review/minute-summaries/README.md)을 보존하고 원격 PR 게이트를 진행한다. 요약 화면/공개 측정 연결은 아직 없으며 다음은 업로드 재시도·계정 전환 연결이다. 화이트·블루 웹·지정 web-design-studio·아바타 같은 부위 새 제작0, SDK 개인정보 P2/실측/참여자·단계2 이월·Q32·외부/운영·전체1~6 미완료를 유지한다. 아래는 시점별 기록이다.

최신: PR42의 실제 source8525832→merge6ee4dce/main·부모·브랜치 보존·clean을 확인하고 [S4.N2 내 계정 알림 설정 웹](stories/stage4-notification-preferences-web.md)을 구현했다. 실제 가입→계정→설정 저장→새로고침, 수락 후 응답 단절/명시 재조회, 과거 A 폼의 B 쿠키403/타인 보존과920px·확대·키보드/대비를 확인했다. [실제 화면·실패 원본·합성 구분](review/notification-preferences-web/README.md). 최신 main e4265f5 통합 뒤 전체590 frontend/321 API·최종Chrome4·정적/build/guard 통과·조건부 PR 게이트 준비다. 알림 작동/SDK privacy·classifier/추천·아바타 이월·Q32/참여자/법무·외부/운영·전체1~6 미완료, 화이트·블루 웹·같은 아바타 부위 새 제작0을 유지한다. 아래는 시점별 기록이다.

최신: [PR43](https://github.com/HSU-OAS/bodyguard/pull/43)의 source692c7e4는 scoped 검증·작성자 리뷰·35개 원격 blob/diff·latest main 통합/CLEAN·체크 없음 후 mergecf65132로 main에 포함됐다. 브랜치를 보존했으며 [S4.12](stories/minute-aggregation.md)는 **private 집계 범위만 완료**다. 최초/통합 검증 원본은 유지한다. 화이트·블루 웹 디자인은 지정 web-design-studio의 기존 토큰/실제 화면 기준으로 유지하며 새 UI/Figma/추가 audit으로 주장하지 않는다. 다음은 1분 요약의 owner/계정·서버 계약 연결과 확정 부가 기능의 독립 구현이며, 별도 실행 중인 알림 설정 웹을 중복 변경하지 않는다. 실제 classifier/기준선·공개 producer/두 아바타·SDK 개인정보 P2·단계2 이월·실측/참여자·Q32 나머지·법무/외부/운영·전체1~6 완료 기준은 그대로 미충족이다. 아래는 시점별 기록이다.

최신: [S4.12 1분 시간가중 집계](stories/minute-aggregation.md)를 구현했다. 실제 관찰 구간만 분별/지표별로 집계하고 가림·공백을 정상 시간으로 채우지 않으며 동시 이탈을 중복 합산하지 않는다. [실패/모의 경계·실제 웹 화면 증거](review/minute-aggregation/README.md). 전체558 frontend·타입/정적/build·공개8·guard/private producer0·source3/artifact18 검증 후 조건부 PR 게이트 진행이다. 실제 classifier/기준선·측정/계정/HTTP 연결·Q32 알림/PDF/LLM/변화 탐지·단계2 이월/SDK P2/실측·참여자/외부·운영·전체1~6 미완료, 화이트·블루 웹·같은 아바타 부위 새 제작0을 유지한다. 아래는 시점별 기록이다.

최신: [PR41](https://github.com/HSU-OAS/bodyguard/pull/41) source4265aae는 scoped 검증·리뷰·60개 원격 blob/diff·latest main/CLEAN·체크 없음 후 mergef47dea1로 main에 포함됐고 브랜치를 보존했다. 최신 main의 codex/private-minute-aggregation에서 [S4.12 1분 요약 집계](stories/minute-aggregation.md)를 시작한다. 측정/classifier에 의존하지 않는 private 시간가중/가림·공백 분모 경계부터 구현하며 공개 producer/임계값/업로드·실측/참여자·Q32 나머지/외부/운영/전체1~6 완료로 표시하지 않는다. 화이트/블루 웹·같은 아바타 부위 새 제작0을 유지한다. 아래는 시점별 기록이다.
최신: [S4.N1 계정별 알림 설정 API](stories/stage4-notification-preferences-api.md)를 별도 작업트리/전용 PostgreSQL에서 구현했다. 기본5분/50분·켜기/끄기·소리 설정의 본인 저장/조회, 타인/다른 세션 격리, 실패 시 이전 값 보존, 탈퇴 cascade/타인 보존과 실제 migration/복구를 확인했다. [실패·실제/합성·검증 증거](review/notification-preferences-api/README.md). 최신 mainf47dea1 통합 후 전체321 API/523 frontend·타입/정적/build/guard를 통과했고 조건부 PR 게이트 진행이다. 설정 화면/실제 알림은 아직 미연결이며 다음 독립 Story에서 화이트·블루 웹에 연결한다. SDK/privacy·실측/classifier·아바타 이월·Q32 나머지/참여자/법무/외부/운영·전체1~6 미완료를 유지한다. 아래는 시점별 기록이다.

최신: [S4.11 실제 로그인 권위/페이지 수명 연결](stories/coaching-auth-lifecycle.md)을 구현했다. 실제 AuthProvider committed ready·명시 준비/수행/본인 기록과 계정 변경·로그아웃 실패·이탈 폐기를 연결했고 [작동 화면·실패 원본·미완료 증거](review/coaching-auth-lifecycle/README.md)를 보존했다. 최종 전체523 frontend/291 API·Chrome4/공개8·타입/정적/build/guard·source8/artifact46 검증 후 조건부 PR 게이트 진행이다. 공개 코칭 producer0·classifier/두 아바타/실측·Draft36 SDK 개인정보 P2·Q32/참여자/법무/외부/운영·전체1~6 미완료, 화이트·블루 웹·같은 아바타 부위 새 제작0을 유지한다. 아래는 시점별 기록이다.

최신: [PR40](https://github.com/HSU-OAS/bodyguard/pull/40) source553b5b2는 scoped 검증·리뷰 보완·remote47 blob/diff·latest main/CLEAN·체크 없음 후 merge43b13f3로 main에 포함됐고 브랜치를 보존했다. 최신 main의 codex/coaching-auth-lifecycle에서 [S4.11 실제 로그인 권위/페이지 수명 연결](stories/coaching-auth-lifecycle.md)을 시작했다. 구현 전 계약/최초 하네스 단계이며 공개 코칭/실제 SDK/두 아바타/실측·참여자/외부/운영/Q32·전체1~6 미완료를 유지한다. 화이트·블루 웹·같은 아바타 부위 새 제작0이다. 아래는 시점별 기록이다.

최신: [S4.10 최초 ready 시각·본인 수행 기록 연결](stories/coaching-recorded-session.md)을 구현했다. 실제 session/캡처 context로 준비 대기 제외·pause/resume 최초 anchor 유지·명시 save/동일 retry와 late/authority 폐기를 연결하고 실제 Chrome/API/SQL 본인 기록 상세·응답 단절 한 건·다른 계정403을 확인했다. [화면·실패/모의·미완료 증거](review/coaching-recorded-session/README.md). 최종 전체503 frontend/291 API·정적/build·Chrome4/공개8·production 연결부0·원본/SHA·작성자 리뷰 통과/PR 게이트 진행이다. 실제 AuthProvider hook/SDK/privacy P2·classifier/두 아바타/실측·Q32/참여자/외부/운영/전체1~6단계는 미완료이며 다음은 인증/페이지 수명 연결이다. 화이트·블루 웹·같은 아바타 부위 새 제작0을 유지한다. 아래는 시점별 기록이다.

최신: [PR39](https://github.com/HSU-OAS/bodyguard/pull/39) source d0f2dfc7는 scoped 검증·작성자 리뷰·최신 diff/HEAD/CLEAN·체크 없음 후 merge faa5061로 main에 포함됐고 브랜치를 보존했다. 최신 main의 codex/coaching-recorded-session에서 [S4.10 최초 ready 시각/수행 기록 연결](stories/coaching-recorded-session.md)을 시작한다. 준비 대기를 운동 시작으로 쓰거나 pause/resume 때 시작 시각·계정을 바꾸지 않는다. 실제 auth hook/classifier/아바타/실측·Draft36 SDK P2·참여자/외부/운영/Q32/전체1~6단계는 미완료, 화이트·블루 웹 유지·같은 아바타 부위 새 제작0이다. 아래는 시점별 기록이다.

최신: [S4.9 인증 세션 기록 컨텍스트](stories/coaching-record-capture.md)를 구현했다. 실제 Chrome/API/SQL에서 원래 계정 me/CSRF/me 대조·본인 기록 저장과 캡처 중 계정 변경/old proof403/abort 경계를 확인했다. [화면·실패 원본·실제/모의 구분](review/coaching-record-capture/README.md). 기존 RAF 인증 준비 대기를 보완해 공개 회귀8건도 통과, frontend475/API291·정적/production capture0·로컬 리뷰 통과/PR 게이트 진행이다. 실제 AuthProvider hook/최초 ready UTC/session·classifier/아바타/실측·Draft36 SDK P2·참여자/외부/운영/Q32/전체1~6단계는 미완료다. 다음은 earliest-ready clock pair/result 연결이며 화이트/블루 웹·같은 아바타 부위 새 제작0을 유지한다. 아래는 시점별 기록이다.

최신: [PR38](https://github.com/HSU-OAS/bodyguard/pull/38) source92a98ec6는 scoped 검증·review 보완·latest diff/HEAD/CLEAN·체크 없음 후 merge54227451로 main에 포함됐고 원본 브랜치를 보존했다. 최신 main의 새 codex/coaching-record-capture에서 [S4.9 인증 세션 기록 컨텍스트 확보](stories/coaching-record-capture.md)를 시작한다. guest/다른 계정·늦은 응답을 시작 권위로 쓰지 않고 원래 ready authority와 서버 /me/CSRF를 대조한다. 최초 ready UTC/session 연결은 후속 Story다. 화이트/블루 웹·단계2 이월·Draft36 SDK P2·Q32/참여자/외부/운영/전체1~6단계 미완료는 유지한다. 아래는 시점별 기록이다.

최신: [실제 결과→본인 기록 계약·adapter](stories/coaching-result-record.md)를 구현하고 main의 session+합성 관찰→기존8필드→실제 API/격리 SQL→production Chrome 본인 기록 상세를 연결했다. 부분 수행 skip/일시정지의 수행 시간을 보존하고, 다른 쿠키의 과거 proof403·응답 단절 재시도 한 건·late owner 폐기 경계를 확인했다. [실제 화면·실패/리뷰·미완료 경계](review/coaching-result-record/README.md). 전체459 frontend/291 API·Chrome5+공개7/합성RAF1·정적/build/production private producer0 통과/조건부 PR 게이트 진행이다. 실제 owner/UTC capture·classifier/아바타/실측·Draft36 SDK 개인정보 P2·참여자/외부/운영·부가 기능/전체1~6단계는 미완료다. 웹 화이트/블루 유지·같은 아바타 부위 새 제작0·독립 개발 계속이다. 아래는 시점별 기록이다.

직전 [PR #37](https://github.com/HSU-OAS/bodyguard/pull/37) source4ca8017e는 실제 scoped 검증·latest main/diff/CLEAN·체크 없음·미해결scope P1/P2 없음 후 merge6d7e78fd로 main에 포함되고 source 브랜치를 보존했다.

최신: [관찰 전달·중단 루프](stories/coaching-observation-loop.md)는 provider를1개씩 처리하고 tick·pause/resume·old 결과/오류·예약 중복을 안전하게 연결했다. 실제 main 모듈+합성 관찰19건/전체430건·정적/build·실제 Chrome RAF(합성 자원)1개+공개 웹7개 통과, scope P2 두 건 재현/보완. [실패·실제 웹·증거](review/coaching-observation-loop/README.md). PR 게이트 진행이며 Draft36 SDK 계측/개인정보 P2·실제 camera/classifier/아바타·record producer·실측·외부/운영/전체1~6단계 미완료는 유지한다. 같은 아바타 부위 새 제작0·화이트/블루 웹 유지·승인 대기 독립 개발 계속이다. 아래는 시점별 기록이다.

최신: [Draft PR #36](https://github.com/HSU-OAS/bodyguard/pull/36) sourcee4df4a9는 SDK 계측 외부 시도 P2/B-09 미해결·Story 미완료로 병합하지 않았다. 원본 실패·공개 stdout 형식 보완/원본 gzip/hash·실제 웹 PNG를 보존했다. 체크 없음/리뷰0·main1528e9eb를 확인했고 최신 main의 codex/coaching-observation-loop에서 [관찰 전달·중단 루프](stories/coaching-observation-loop.md)를 독립적으로 시작한다. 개인정보 정책 승인/참여자 연결 응답이 없으며 승인·실측 완료를 가정하지 않는다. 화이트/블루 웹 유지, 아바타 같은 부위 새 제작0·전체1~6단계 미완료다. 아래는 시점별 기록이다.

최신: [세션·페이지 수명 연결](stories/coaching-session-bridge.md)은 실제 진행 엔진/자원 controller에 만료·중단·이탈과 관찰 입력을 연결했다. 합성 세션44건/전체411건·정적/build·공개 웹 Chrome7흐름을 검증했고 타입 실패·작성자P2의 종료 시각/즉시 listener 해제/gate getter 예외를 보존/보완했다. [실패·현재 화면](review/coaching-session/README.md). PR 게이트 진행이다. 다음 독립 연결은 실제 카메라/추론 자원의 소유 포트이며 실제 에셋/실측/공개 코칭·결과 저장·외부/운영·부가 기능·참여자/전체1~6단계는 미완료 유지한다. 실제 시험 참여 가능 여부만 요청했고 동의/실측 완료를 가정하지 않는다. 아래는 시점별 기록이다.

최신: [PR #34](https://github.com/HSU-OAS/bodyguard/pull/34)는 실제 검증/작성자 P2 보완·latest main/diff/CLEAN·체크 없음 후 exact source daf09667의 merge cf841070으로 main에 반영됐다. 부모·main 포함/source 브랜치 보존을 확인했다. 최신 main의 codex/coaching-session-bridge에서 [세션·페이지 수명 연결 기초](stories/coaching-session-bridge.md) 명세·하네스를 진행한다. 실제 카메라/모델/에셋·코칭 공개/실측·이월·전체1~6단계는 미완료 유지한다. 화이트·블루 웹 디자인을 유지하고 UI 수정 시 지정된 web-design-studio를 적용한다. 아래는 시점별 기록이다.

최신: [코칭 자원 연결 기초](stories/coaching-resource-lifecycle.md)는 준비/중단/교체/늦은 응답·1회 해제/소유권 재사용 방지를 구현했다. 합성40건 포함 전체367건·정적/build·실제 공개 웹 Chrome7흐름이 통과했고 작성자 리뷰P2 두 건은 red 재현 후 수정했다. [실패/원본 hash·현재 화면](review/coaching-resources/README.md). PR 게이트 진행이며 실제 카메라·모델/두 아바타/소유 track·worker·GPU·코칭/기록 producer·Stage2 이월·전체3~6단계 게이트는 미완료다. 다음 독립 작업은 세션/중단/페이지 수명과 진행 엔진의 실제 연결이며 공개 코칭은 선행 게이트 통과 전 활성화하지 않는다. 아래는 시점별 기록이다.

최초 자원 Vitest는 모듈 수집 실패였고 당시 factory/자원 case는 미실행이었다. 그 원본/실패 기록은 삭제하거나 green으로 바꾸지 않고 보존했다.

최신: S6.2 [PR #33](https://github.com/HSU-OAS/bodyguard/pull/33)은 exact source87aa4a2·필수 검증·scope P1/P2 없음·최신 main/diff/CLEAN·체크 없음 후 merge d348fb8로 병합됐고 실제 부모/main 포함·source 브랜치 보존을 확인했다. 독립3→4→5→6 구현/현재 웹 검증 기초 뒤 최신 main의 codex/coaching-resource-lifecycle에서 [코칭 자원 연결 기초](stories/coaching-resource-lifecycle.md)의 계약/첫 하네스를 착수한다. 미완성 에셋/실측에 독립적인 정리 계약이며 실제 카메라/모델/두 아바타/화면 통합·Stage2/전체3~6 게이트 통과가 아니다. 같은 아바타 부위 수정/검증 사이클은 시작하지 않고 모든 이월·외부/법무·부가 기능/참여자·전체1~6단계 필수 기준은 유지한다. 아래는 시점별 기록이다.

최신: [S6.2 현재 웹 계정·기록 보안 경계](stories/stage6-web-security.md)의 실제 두 계정 소유권/독립 invalid 입력·다른 세션 CSRF/삭제 proof·로그아웃 cookie 재전송·Chrome CORS/origin 거부와 정상 기록 보존을 확인했다. [작동 화면·실패/작성자 리뷰](review/stage6-web-security/README.md). 제품/API·화이트·블루 디자인/안전·privacy 정책 변경 없이 검증했고 PR 게이트 진행이다. Docker는 socket 부재로 여전히 미연결이며 아바타·실측·실제 코칭/기록 producer·확정 부가 기능·실제 공급자/운영·백업 security replay/retention·라이선스/법무·실제 참여자·전체1~6단계/최종 통합은 미완료다. source/실패 원본을 유지하고 다음 독립 작업을 이어간다. 아래는 시점별 기록이다.

최신: S6.1 [PR #32](https://github.com/HSU-OAS/bodyguard/pull/32)을 exact source515f323·필수 검증·scope 미해결P1/P2 없음·최신 diff/CLEAN/MERGEABLE·체크 없음 확인 후 merge2db3ceef41123db6689ec28b536c5b8dc5f840bf로 병합했다. 실제 main 포함·source 브랜치를 보존하고 최신 main의 codex/stage6-web-security에서 [S6.2 현재 웹의 계정·기록 보안 경계](stories/stage6-web-security.md) 명세·하네스를 시작한다. 실제 웹/HTTP/SQL·Chrome CORS 기초이며 운영 TLS/외부 감사·아바타/실측/코칭/기록 producer·Stage2 이월·전체1~6단계/최종 통합·라이선스/법무/참여자·확정 부가 기능은 미완료다. 화이트·블루 웹 디자인/원본 증거를 유지한다. 아래는 시점별 기록이다.

최신: [S6.1 현재 웹 교차 흐름](stories/stage6-web-integration.md)에서 실제 production Chrome/API/SQL의 소개·안내→가입→탐색 준비→합성 기록 상세·취소/삭제→계정/로그아웃 흐름과 계정 장애 주입/공개 안내 보존을 확인했다. [실제 화면/실패·작성자 리뷰](review/stage6-web-integration/README.md). 기존 화이트·블루 UI/production API는 바꾸지 않았으며 PR 게이트 진행이다. 실제 코칭/아바타/실측/기록 producer·Docker/Draft #29·운영/공급자·라이선스/법무·부가 기능/참여자·전체6단계/최종 통합은 미완료로 유지하고 다음 독립 내부 검증을 진행한다. 아래는 시점별 기록이다.

최신: S5.4 [PR #31](https://github.com/HSU-OAS/bodyguard/pull/31)을 exact source6236468·필수 검증·scope 미해결P1/P2 없음·최신 diff/CLEAN/MERGEABLE·체크 없음 확인 후 merge26d5e09541b92b33368ed2638eb307565909178a로 병합했다. source 브랜치를 보존하고 최신 main의 codex/stage6-web-integration에서 [S6.1 현재 웹의 교차 화면 통합 검증](stories/stage6-web-integration.md)의 명세·하네스를 시작한다. 실제 공개→가입→탐색 준비→기록/삭제→계정 흐름의 기초이며 미완성 코칭/실측·아바타를 통과시키지 않는다. Docker/Draft #29·운영/법무/라이선스 최종 고지·부가 기능/참여자·최종 통합은 그대로 미완료다. 아래는 시점별 기록이다.

최신: [S5.4 라이선스·출처 증거 기초](stories/stage5-license-inventory.md)의 실제 설치 수집기를 구현했다. npm194개 version/Python57 lock 항목을 metadata·원문 hash와 연결하고 missing/선언만/텍스트만·runtime/dev 후보를 구분했다. actual 목록의 byte 결정성과 경로/버전/지시문 경계25건·기존 전체291건 회귀를 확인했으며 전부 distribution_approved=false다. [원본/작성자 리뷰](review/stage5-license-inventory/README.md)와 [후속 필수 보완](stage5-license-inventory-runbook.md)을 남겼다. PR 게이트 진행이며 실제 최종 artifact 고지/법무·Docker/NGINX/TLS/Draft #29 최신 main 정합·운영 restore replay 대응·아바타/실측/코칭/부가 기능·전체1~6단계는 미완료다. 다음은6단계의 독립 내부 검증이며 화이트·블루 **웹** 디자인과 기존 원본/이월을 유지한다. 아래는 시점별 기록이다.

최신: S5.3 [PR #30](https://github.com/HSU-OAS/bodyguard/pull/30)을 필수 검증·scope 내 미해결P1/P2 없음·최신 diff/CLEAN/체크 없음 확인 후 merge4599c7c830cdfee786d21df460976fc5efe1c46a로 main 병합했고 브랜치를 보존했다. 최신 main의 새 codex/stage5-license-inventory에서 [S5.4 라이선스·출처 목록 기초](stories/stage5-license-inventory.md)의 명세·하네스를 시작한다. 기존 MIT/법무 정책은 바꾸지 않고 실제 metadata/고지/최종 배포를 구분한다. Draft #29는 실제 runtime 미완료에 더해 최신 main과DIRTY/CONFLICTING·체크 없음이며 source/증거를 보존한다. Docker 연결·운영 복구 안전/보관 정책·아바타/실측/코칭·부가 기능·6단계/최종 통합은 그대로 미완료다. 화이트·블루 **웹** 디자인을 유지하고 새 아바타 사이클을 시작하지 않는다. 아래는 시점별 기록이다.

최신: [S5.3 네이티브 백업·복구 기초](stories/stage5-backup-restore-proof.md)에서 새 시험 DB의 계정/기록·제약조건·로그인/본인 기록/타인404를 실제 복구하고, snapshot 이후 삭제·로그아웃·비밀번호 변경이 restore로 재생되는 위험을 확인했다. 원본/실패와 private archive를 보존하고 소유 자원·프로세스 정리까지 재검증했다. [실행과 한계](review/stage5-backup-restore/README.md)·[운영 공개 승인 게이트](stage5-backup-restore-runbook.md). PR 게이트 진행이며 운영 복구/retention 모델을 활성화하거나 전체5단계 완료로 표시하지 않는다. 웹 패키지 **Draft PR #29**는 실제 Docker/NGINX/TLS 필수 검증이 없어 여전히 병합하지 않는다. 다음 독립 준비는 라이선스/내부 검증이다. 기존 화이트·블루 웹과 아바타 원본/이월·전체1~6단계 게이트를 유지한다. 아래는 시점별 기록이다.

최신: [S5.1 서버 생존·DB 준비 상태](stories/stage5-runtime-readiness.md)를 실제 구현했다. DB 준비/장애/복구를 구분하고 계정·세션·기록/메일 부작용 없이 응답한다. 최종 실제 API/SQL261건(새19)·DOM327건·production/정적/생성 타입과 소유 loopback HTTP를 통과했다. [실패 원본·주입/실제 구분·작성자 리뷰](review/stage5-readiness/README.md). PR 게이트 진행이며 **실제 운영/배포·5단계/1~6단계 완료는 아니다.** 다음은 배포 패키지/프록시·독립 운영 준비다. 현재 Docker daemon은 미연결이며 실제 컨테이너 검증으로 세지 않는다. 비용/계정/시크릿/운영 DB/배포 별도 승인과 아바타·실측·코칭·법무·부가 기능·참여자 게이트를 유지한다. 아래는 시점별 기록이다.

최신: S4.7 PR #27을 merge34e433024bf8ceab059bb2071d440c4465aee37a로 main 병합하고 소스 브랜치를 보존했다. 공개 도움말/데이터 안내와 기존 계정·기록 웹은 화이트·블루 계약에서 실제 작동한다. 최신 main의 새 codex/stage5-runtime-readiness에서 [S5.1 서버 생존·준비 상태](stories/stage5-runtime-readiness.md) 명세/최초 실제 하네스를 작성했다. health2건은 실제404로 실패했고 [원본](review/stage5-readiness/README.md)을 보존했다. 아직 미구현이며 정상/준비 완료로 세지 않는다. 운영·시크릿·비용·배포 승인과2단계 이월·실측·코칭·법무·전체1~6단계 게이트는 그대로다. 아래는 시점별 기록이다.

최신 구현: [S4.7 카메라·데이터 안내/도움말](stories/stage4-data-help-web.md)의 공개 웹/FAQ/실제 관리 링크를 완료하고 production Chrome에서 도움말→가입→데이터→기록/계정→복구 요청 흐름과 좁은 창·키보드를 확인했다. [실제 화면·실패 보존·회귀](review/stage4-data-help/README.md). 로컬 검증·작성자 리뷰 완료/PR 게이트 진행이며 코칭/아바타/실측·운영·법무·전체1~6단계는 미완료다. 이후 승인된5→6단계의 독립 준비/구현을 진행하고 전체 통합에서 필수 이월 게이트를 닫는다. 아래는 시점별 기록이다.

최신: **S4.6 PR #26**이 merge110e4fdb9f107958eb3f5a1f08a80ec7a1e204e0으로 main에 포함되고 소스 브랜치를 보존했다. 최신 main의 `codex/stage4-data-help-web`에서 [S4.7 카메라·데이터 안내/도움말](stories/stage4-data-help-web.md)의 명세·최초 실제 DOM 하네스를 작성했다. 현재2건은 미구현404로 실패했으며 화면 구현/기능 통과가 아니다. 기술 사실 안내만 구현하고 Q-26 법무 정책·사업 결정은 별도 승인 게이트로 남긴다. PR #26의 실제 계정 화면은 작동하지만2단계 이월·실제 코칭·전체4단계/1~6단계/운영·출시는 미완료다. 아래부터 각 시점의 기록이다.

현재 S4.6 [계정 관리·탈퇴 웹](stories/stage4-account-withdrawal-web.md)의 로컬 구현·검증을 마쳤고 PR 게이트를 진행한다. 화이트·블루 내 계정→수행 기록 관리/로그아웃→별도 본인 확인 탈퇴를 실제 production Chrome/API/SQL로 연결했다. 취소·오답·만료의 보존,204 뒤 기존 세션/열린 다른 탭 이탈과 타인 보존, 응답 단절의 완료 추정/자동 재삭제0을 확인했다. [실제 화면·실패와 제한](review/stage4-account-web/README.md). 직전 API PR #25는 merge20dcefc로 main 병합되고 브랜치가 보존됐다. 다음 독립 Story는 카메라·데이터 안내/도움말 웹이며 사업·법무 정책·실제 공급자/운영·2단계 이월·코칭 기록 생산·부가 기능·전체4단계/1~6단계/출시는 미완료다. 아래는 각 시점의 기록이다.

현재 S4.5 [본인 계정 탈퇴 API](stories/stage4-account-withdrawal-api.md): 전용 재확인·명시 동의·본인만 transaction 삭제/실패 복구를 구현했다. 격리 실제 SQL의 전체242건·DOM279건·타입 생성 결정성·production 빌드와 정적 검사가 통과했고 실패 원본은 [증거](review/stage4-account-withdrawal/README.md)에 보존했다. 본인 모든 세션·가입 확인 NOWAIT와2초 한정 대기로 다른 탭/기록/복구/cleanup 충돌은 삭제0·명시 재시도로 처리한다. 범위 내 미해결P1/P2 없이 PR 게이트를 진행한다. 다음은 최신 main의 새 브랜치에서 **S4.6 계정·탈퇴 웹**이며 PR #24의 화이트·블루 디자인을 유지한다. 실제 탈퇴 Chrome/운영 적용·전체4단계·1~6단계 완료로 공개하지 않는다.

2026-10-05 CEO 디자인 결정: BODYGUARD는 **웹**이며 화이트·블루의 전문적인 의학 계열 인상으로 통일한다. [공통 디자인 계약](web-design.md), [독립 Story](stories/stage4-medical-web-design.md), [실제 화면](review/medical-web-design/README.md). 공개·계정·시작·탐색·기록에 적용했고 실제 가입→시작→탐색→빈 기록과 기록 조회/상세/삭제를 production Chrome에서 확인했다. 좁은 창·키보드·대비·동작 감소를 점검하고 준비 전 클릭 경합 하네스를 수정해 전체 DOM도 통과했다. PR 게이트를 진행한다. 아바타 이월·실측·진짜 코칭 연결은 완료로 세지 않는다. 기록 삭제 웹 PR #23은 main143090b에 merge commit 병합되고 소스 브랜치는 보존했다. 다음 독립 제품 Story는 본인 계정 탈퇴 API(S4.5)이며 계정 삭제의 초기 하네스는 실제404 실패 상태다. 디자인 PR 이후 이어간다.

S4.4 최신 독립 결과: 기간의 전체 페이지 미리보기·취소·명시 삭제·실제 삭제 수/목록 갱신, 새 기록·다른 계정 보존과 로그아웃 경계를 실제 production Chrome에서 확인했다. [현재 Story와 화면 증거](stories/stage4-record-deletion-web.md). 새 격리 SQL 회귀205건/최종 DOM265건·빌드·정적 검사 통과이며 실패는 보존했다. PR 게이트를 진행한다. 다음 독립 Story는 본인 계정 탈퇴 API이고 전체4단계·1~6단계는 아직 미완료다. 원본 동시 쓰기와 시험 DB 충돌을 피해 최신 main2944e52의 `codex/stage4-record-deletion-review`에서 검증했다.

S4.4 추가 진행: 대상 변경·시계 제어 fixture의 확인 만료에서 삭제를 거부하고 남은 기록을 보존하는 실제 production Chrome9흐름과 전체 DOM264건을 통과했다. 취소/기간 재조회/화면 이탈의 늦은 미리보기 폐기와 응답 계약도 보강했다. 빌드 중첩 때 기존 탐색1건 실패를 보존하고 단독 재실행으로9건 통과했다. 다른 계정 삭제·중복/늦은 응답 추가 검증·최종 리뷰/PR가 남아 있으며 전체4단계/출시 완료는 아니다.

S4.4 구현 갱신: 미리보기·취소·명시 삭제·0건 차단·409 재확인·불확실 결과 복구를 구현했다. 전체 DOM248건(1worker)과 빌드/정적 검사, 실제 격리 API/SQL/production Chrome7건 통과다. 실제 취소 후2건 보존·선택 기간1건 삭제·다른 기간1건 보존·목록 갱신을 확인했다. 실패한 병렬 회귀는 Story에 남겼다. 추가 계약/늦은 응답/변경·만료 브라우저 검증과 최종 리뷰가 남아 있으며 아직 커밋/PR/병합 전이다.

S4.4 [본인 수행 기록 삭제 웹](stories/stage4-record-deletion-web.md): S4.3 PR #22의 실제 merge commit2944e52·main 포함·브랜치 보존을 확인한 뒤 최신 main의 codex/stage4-record-deletion-web에서 시작했다. 기간/대상 수 확인·취소·명시 삭제·409 재확인·결과 불확실 복구 명세를 작성했고 최초 DOM1건은 삭제 진입점 미구현으로 실패했다. 다음은 UI/API 클라이언트와 실제 격리 Chrome 삭제 검증이며 완료로 세지 않는다.

S4.3 [본인 수행 기록 기간 삭제 API](stories/stage4-record-deletion-api.md): 최신 main ddcf800에서 미리보기·세션 서명·대상 지문·명시 확인 삭제를 구현했다. 실제 격리 DB의 전체197건 통과 뒤 추가 입력/기간 경계까지 삭제25건 재실행 통과, 전체 DOM242건·production 빌드·정적 검사 통과다. PR 게이트 진행 중이며 다음은 삭제 취소·확인·만료/대상 변경 재확인 화면이다. 실제 Chrome 삭제·계정 탈퇴·전체4단계·아바타/실측 최종 통합은 미완료다.

S4.2 [기록 목록·상세 웹](stories/stage4-records-web.md): 본인 API와 연결한 최근7일/기간 목록·페이지·상세·복귀·실패 복구를 구현했고 실제 격리 API/SQL/production Chrome으로 확인했다. [실제 화면 증거](review/stage4-records/README.md). S4.1 API는 PR #20(main afc044b) 병합. S4.2는 PR 게이트 진행이며 다음 독립 작업은 본인 기록 삭제·계정 데이터 관리다. 실제 코칭 기록 생산·출시 동작명 연결·1분 요약/부가 기능·Stage2/3 이월·전체4단계는 미완료다.

S4.1 [본인 수행 기록 API](stories/stage4-records-api.md): 저장·기간 목록·상세, 소유권/CSRF, 중복·동시 요청, 데이터 보존 rollback을 구현하고 격리 DB로 검증 중이다. 기록 화면과 실제 코칭 결과 연결은 아직 없다. 다음 독립 Story는 S4.2 기록 목록·상세 웹 화면이며 Stage2 이월 게이트와 Stage3 실제 코칭 연결은 최종 통합에 남긴다. 4단계·전체 1~6단계 완료 아님.

S3.3 [동작 검수 목록 확장](stories/stage3-motion-library.md): 개발 전용5개 동작의 검색·부위·상세·출처·복귀를 구현·로컬 검증했다. PR 게이트는 별도다. 실제 신체 추천/동작별 판정/애니메이션은 D2 실측·에셋에 의존해 최종 통합으로 남기며 3단계 통과 아님. 다음 독립 구현은 **4단계 본인 기록·데이터 관리**다.

3단계 갱신: 실행 순서 PR #16 및 추천 준비 계약 PR #17 병합. [S3.2 시작 경로 화면](stories/stage3-explore-web.md)은 보호된 시작→직접 선택/추천 목적→복귀를 로컬 production Chrome에서 확인했다. 출시 동작 목록은 아직 비어 있으며 실제 신체 추천·코칭을 완료로 세지 않는다.

2026-10-05 우선 적용: main 9733e4c에 PR #15까지 병합. 아바타 제작·검증 기록 종료, Draft PR #9 외형 P2와 2단계 실측·통합은 미완료다. [이월 목록과 의존성](stage2-carryover.md)을 따른다. 다음 작업은 **3단계 코칭 확장**이며 3→4→5→6 구현 뒤 최종 통합·수정으로 모든 필수 게이트를 닫는다. 아래 이전 순서·대기 표현은 당시 기록이다.

> 아래 P0~P7은 기존 시제품의 기술 작업표다. 첫 출시 실행 순서와 단계별 통과 기준은 [`release-plan.md`](release-plan.md)를 따른다. 이전 상태는 시제품 당시 기록이며 현재 상태는 아래 첫 출시 Story·게이트를 따른다.

버전 0.3 · 2026-09-26 · 대응: `prd.md` v0.3, `design.md` v0.3

> 작업을 **의존 관계 기준**으로 늘어놓은 문서다. 일정은 팀이 정하므로 담당과 기간은 비워 둔다(원문 29).
> 각 작업에 근거(FR·design 절)를 적었다. 근거 없는 작업은 하지 않는다.
> "필요한 결정" 열의 항목이 안 정해졌으면 그 작업은 시작하지 않는다. `open-questions.md` 참고.
> 번호는 추가한 순서다. 작업 순서는 표 안의 위치를 따른다 (#44~#47은 나중에 추가했다).

현재 첫 출시의 실행 순서는 P0~P7 번호가 아니라 `release-plan.md`의 1~6단계다. 아래 기존 번호는 추적용으로 보존한다. 아바타는 1단계에서 착수하며, 첫 실제 사용 흐름에는 로그인·직접 선택·두 아바타·코칭·결과를 함께 넣는다.

2026-10-04 최신 상태: main 4bbb784에는 S2.6b2 PR #13까지 병합되어 있다.
독립 [S2.5a 동작 탐색·선택 준비](stories/stage2-motion-selection.md)는 개발 전용으로 로컬 구현·검증을 마치고 PR 게이트를 진행한다.
Vitest138개·실제 Chrome5개(계정 응답 mock), production 후보/개발 진입0. [실제 PNG·기록](review/motion-selection/README.md).
아바타 Draft PR #9 외형 P2·S2.3b 실제 수행·S2.4·전체 S2.5·2단계·1~6단계는 여전히 미완료다. 아래 오래된 PR 상태는 당시 기록으로 보존한다.

2026-10-05 최신 상태: main 4a00bb2에 S2.5a PR #14까지 병합됐다.
독립 [S2.5b 코칭 진행·중단 엔진](stories/stage2-coaching-engine.md)은 최신 main의 codex/stage2-coaching-engine에서 명세·하네스·구현·로컬 검증을 마쳤으며 PR 게이트 대기다.
합성 엔진60개/전체 Vitest198개, 실제 Chrome 선택 회귀5개(계정 mock), production 엔진/후보/코칭 진입 차단을 확인했다.
실제 코칭 분류·카메라/계정/두 아바타 adapter·운동 화면은 미연결이며 기존 단계 게이트를 낮추지 않는다. [실행·리뷰 증거](review/coaching-engine/README.md).

| 1단계 Story | 산출물 | 완료 기준 | 상태 |
|---|---|---|---|
| 출시 계약 정합화 | 최신 PRD·설계·작업표·미정 목록, 단계별 게이트 | 게스트·아바타·동작 판정 충돌 해소, 기존 확정 요구 보존, 문서 링크·diff 검사 | PR #1 main 병합 |
| 동작 근거와 촬영 가능성 | 후보별 출처·주의점·필수 관절·촬영 계획과 관찰 하네스 | 후보 분류·근거·계획. 실제 동작/임계값 검증은 S2.3 | PR #2 main 병합, 출시 동작 0개 |
| 새 아바타 제작 기준·초기 제작 | 남녀 Blender 모델·리그 기준과 시각 비교 | 새 편집 원본·기초 검수·권리·차이 기록. 최종 외형/웹 성능은 S2.4 | PR #3 main 병합, 최종 에셋 아님 |

[1단계 준비 게이트](stage1-gate.md)는 증거 기준을 충족했다. [S2.1](stories/stage2-account-api.md)은 PR #6, [S2.2](stories/stage2-account-web.md)는 PR #7, [S2.3a](stories/stage2-motion-validation.md)는 PR #8, [S2.6a1 복구 API](stories/stage2-password-recovery-api.md)는 PR #10, [S2.6a2 복구 웹](stories/stage2-password-recovery-web.md)은 PR #11, [S2.6b1 구글 API](stories/stage2-google-auth-api.md)는 PR #12 병합. S2.4 [Draft PR #9](https://github.com/HSU-OAS/bodyguard/pull/9)는 A27 Blender 원본 118개·8가중치 GLB 왕복 118개·개발 웹 기술 시험 2개를 통과했지만 **외형 P2로 보류**다. 독립 [S2.6b2 구글 웹](stories/stage2-google-auth-web.md)은 로컬 구현·검증/PR 게이트 진행 중이다. 실제 Gmail·Google·S2.3b 사람 수행 검증·최종 아바타·2단계 전체는 미완료이며 [사전 승인 운영 규칙](operating-rules.md)을 적용한다.

---

## 진행 상황

2026-09-26 **스켈레톤 데모** (`frontend/`, 실행 방법은 `frontend/README.md`)

| # | 작업 | 상태 |
|---|---|---|
| 1 | 초기화 | 프런트엔드 완료 (ADR-0015 버전, Biome, Vitest, Playwright). 백엔드·Compose는 아직 |
| 3 | MediaPipe 프로토타입 | 동작함. 화면에 fps·추론 시간이 나온다. 이 맥의 실측 기록(M-2)은 아직 |
| 8 | 카메라·측정 루프 | 완료. 시작 버튼, 30fps 제한, 중지 시 카메라 끔 |
| 11 | 디버그 패널 | 일부. fps, 몸·손·얼굴 추론 시간, 인식 여부, 인식 확실도, GPU/CPU, 모델 크기·손가락·얼굴 켬/끔 |
| 12 | 스켈레톤 | 내 몸을 따라 움직이는 2D·3D 스켈레톤까지. 화면 밖 관절은 그리지 않음. 머리는 둥근 얼굴(원문 55), 방향·눈·입은 얼굴 모델(원문 57). 부위별 판정 색과 정자세 뼈대는 아직 |
| 13 | 측정 예외 | 일부. 사람이 없거나 필요한 관절이 화면 밖이면 부드럽게 안내 (FR-M-07). 두 명 처리는 아직 |

자동 테스트: Vitest 21개, 크롬 + 가짜 카메라 E2E 1개(안내 문구 포함) 통과.
30fps로 올린 뒤(2026-09-26): 30fps, 추론 11.4ms, 버벅임 없음. 앞뒤(깊이) 움직임은 부정확하다 — 목 전방 측정(M-4)과 같은 문제라 tasks #5 옆모습 정답지 실험이 중요하다.
숨긴 관절이 3D에 떠 있던 문제는 Three.js가 크기 0을 1로 되돌리는 탓이었다. 화면 밖으로 옮기는 방식으로 고쳤다.
포즈 모델: 데모에서 lite·full·heavy를 바꿔 볼 수 있다(기본 heavy, 원문 52). 앞뒤 움직임과 fps를 모델별로 비교한 뒤 제품 기본값을 정한다.
손가락(원문 54): Gesture Recognizer로 손가락 21점과 제스처를 붙였다(#46). 자동 테스트 29개 통과. 엄지척과 손가락이 손목에 붙는 것을 사람이 확인했다(원문 55).
얼굴(원문 55): 얼굴 선 대신 둥근 머리에 점 눈·볼터치·웃는 입을 그린다. 고개 기울기·돌림을 따라간다. 사람 없는 가짜 카메라로는 얼굴을 볼 수 없어서, 가짜 관절 좌표로 정면·기울임·돌림을 화면에 띄워 확인했다. 자동 테스트 39개 통과.
얼굴 방향(원문 56·57): 녹화를 재 보니 늘 아래를 보고(2D 41°, 3D 32°) 2D가 좌우로 떨렸다. 몸 모델의 깊이값 탓이라 Face Landmarker로 바꿨다(ADR-0017). 처음 2초를 정면으로 삼고, 눈 깜빡임·입 벌림도 따라 한다. 가짜 얼굴 상태로 2D·3D가 같은 쪽으로 돌고 깜빡이는 것까지 확인했다. 자동 테스트 55개 통과. 사람 얼굴로는 아직 확인하지 않았다.
사람이 직접 확인(2026-09-26): 상반신과 몸 기울이기를 따라온다. 손가락 모양(엄지척 등)은 Pose 모델에 없다. 일어서면 다리가 화면에 안 들어와 그리지 않는다(정상).
데모의 카메라 화면은 확인용이다. 제품 화면에는 영상을 보여주지 않는다(FR-V-02).
첫 실측(2026-09-26): 추론 18.2ms(GPU), 15fps 제한에서 14fps, 엉덩이·팔꿈치는 화면 밖 (open-questions §7 첫 관찰).

데모에서 드러난 것과 반영 (2026-09-26, 원문 50):
- 화면 밖 관절이 3D에 떠 있는 점으로 나왔다 → 화면 밖 관절은 그리지 않고, 필요한 관절이 화면 밖이면 부드럽게 안내한다 (FR-M-07, `src/posture/framing.ts`) — 완료
- 15fps 제한에서 14fps가 나왔다 → 제한을 30fps로 올리고 프레임 고르는 방식을 고쳤다 — 완료. 추론이 메인 스레드를 많이 써서 화면이 버벅이면 워커로 옮긴다
- "상반신 가시성"이 무슨 뜻인지 알기 어려웠고 화면 밖 관절 때문에 낮게 나왔다 → "인식 확실도 (머리·어깨)"로 이름과 기준을 바꾸고 설명을 붙였다 — 완료

---

## 순서를 이렇게 잡은 이유

1. **재 보는 게 먼저** — 지표 정의가 흔들리면 판정·알림·아바타·기록이 다 흔들린다. M-1, M-3, M-4는 결과에 따라 기능이 빠질 수도 있어서 코드를 쌓기 전에 확인한다
2. **기존 시제품은 서버 없이 실험** — 측정·스켈레톤 실험은 브라우저만으로 검증한다. 첫 출시의 개인 신체 확인·코칭은 로그인 후 제공하므로 실제 사용자 흐름에는 계정이 필요하다
3. **측정 장치를 초기에** — 디버그 패널이 없으면 fps도 일치율도 못 잰다
4. **기록 업로드는 너무 늦으면 안 된다** — 변화 탐지는 7일치 기록이 있어야 시험할 수 있다. 31번이 끝난 뒤 최소 일주일은 데이터를 쌓아야 35번을 검증할 수 있다

---

## P0 — 검증과 기반

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 1 | `frontend/`·`backend/` 초기화 — ADR-0015 버전, pnpm 보안 설정, Docker Compose(PostgreSQL 18) | design §2, §3 | | 빌드·테스트 되는 빈 프로젝트 | | |
| 2 | CI — GitHub Actions로 PR마다 테스트·코드 검사 | AGENTS.md, ADR-0015 | 합의 검증 범위의 별도 Story로 도입 | PR에서 테스트 통과 | | |
| 3 | MediaPipe 측정 프로토타입, fps 측정 (WASM·모델 파일 복사 포함) | design §4.1 | | 모델·환경별 fps 기록 (M-2) | | |
| 4 | 뒤 탭 측정 실험 (방식 a → b → c) | design §4.3 | | 측정 간격 기록 (M-1), ADR-0004 갱신 | | |
| 5 | 지표 실험 — 정면 웹캠과 옆모습 폰으로 동시에 기록하고 자세별 라벨. 목 후보 4개(깊이값·2D 지수·얼굴/어깨 비율·깊이 모델) 비교 | design §5.4, §5.7 | | 랜드마크 픽스처, 후보별 비교표 (M-3, M-4) | | |
| 6 | 지표 정의·임계값 확정, 문서 갱신 | design §5, §6 | Q-05, Q-06 | prd·design·ADR 갱신 | | |

> 5번의 픽스처는 **관절 좌표만** 저장한다. 영상은 녹화하지 않는다. 옆모습 폰도 같다. 팀원 본인 것만 쓴다.

## P1 — 측정 코어

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 7 | 판정 엔진 `posture/` — 지표 계산·평활·상태 머신 | FR-M-04, FR-M-05 | Q-05, Q-06 | 픽스처 테스트 통과 | | |
| 8 | 카메라·측정 루프 (보일 때 15fps) | FR-M-01, FR-M-02 | | 측정 동작 | | |
| 9 | 기준선 보정 화면 | FR-M-03 | | 3초 캡처, 브라우저에 저장 | | |
| 10 | 측정 화면 — 지표 상태(초록·주황·빨강), 측정 중 표시, 좋음 표시 | FR-M-05, FR-V-01 | Q-19, Q-20 | 실시간 표시 | | |
| 11 | 디버그 패널 | FR-V-03 | | fps·가시성·원시 지표 확인 | | |
| 12 | 개발용 3D 스켈레톤 + 부위별 판정 색, 옆에 정자세 뼈대 | FR-A-01, FR-A-02 | Q-30 (시제품 머리 색) | 시제품 실험. 출시 아바타 완료가 아님 | | |
| 13 | 측정 예외 — 미검출·두 명·카메라 권한·다른 앱 사용 중 | FR-M-07, prd §4 | | 측정 불가 표시 | | |

> 13번까지는 **로그인 없는 개발용 측정 시제품**이다. 실제 출시에서 개인 신체 확인·코칭을 게스트에게 열지 않는다.

## P2 — 알림

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 14 | 자세 이탈 알림 | FR-N-01 | Q-07 | 5분 이탈 시 알림 | | |
| 15 | 오래 앉음 알림 | FR-N-02 | Q-08 | 50분 착석 시 알림 | | |
| 16 | 알림 권한, 브라우저 알림·화면 알림·소리 | FR-N-04, FR-N-05 | Q-21 | 다른 창에서도 알림 확인 | | |
| 17 | 뒤 탭 측정 (4번에서 된 방식) | FR-M-06 | M-1 결과 | 가려진 탭에서 측정 유지 또는 폴백 | | |
| 18 | 알림 설정 — 브라우저에 저장, 로그인 후 서버와 동기화 | FR-N-03 | | 기준 시간 변경·끄기 | | |

## P3 — 아바타

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 19 | 남녀 Blender 모델·리그·동작 제작 기준과 라이선스 확인 | FR-A-02, design §9.3 | Q-11 | 참조 이미지 비교와 에셋·라이선스 기록 | | |
| 20 | 기준 동작 아바타 렌더링·애니메이션 | FR-A-02 | 동작 근거 | 시작·진행·목표·복귀 표시 | | |
| 21 | 아바타 로드 실패 복구 | FR-A-02 | | 코칭·완료 판정 차단과 재시도 안내 | | |
| 22 | 두 아바타 배치·부위 강조·프레임 안정성 | FR-A-01 | | 실제 노트북에서 시각·성능 검증 | | |
| 46 | 손가락 21점과 손 제스처 — 데모에서 동작 확인 | FR-A-04, ADR-0016 | Q-29 (제품 쓰임) | 손가락이 손목에 이어짐, 엄지척 표시 | | |
| 47 | 남녀 선택형 내 움직임 아바타 — 관찰 가능한 관절 리타게팅 (첫 출시) | FR-A-03 | Q-28 | 스켈레톤 대신 아바타가 따라 움직임. 가림 구간 거짓 통과 없음 | | |

## P4 — 스트레칭

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 23 | 근거·웹캠 촬영 시험을 통과한 스트레칭 정의·판정 `stretch/` | FR-S-01, FR-S-02 | Q-09 | 동작별 정상·오류·가림 픽스처 테스트 통과 | | |
| 24 | 기준 아바타 수행 과정 애니메이션 | FR-S-03 | Q-11 | 동작별 시작·진행·목표·복귀 | | |
| 25 | 직접 선택·추천 입구와 두 아바타 코칭·타이머·결과 | FR-S-02, FR-S-03, FR-S-06 | 검증된 출시 목록 | 안전하게 검증된 동작만 수행 가능 | | |
| 26 | 알림 → 스트레칭 연결, 건너뛰기 | FR-S-04, FR-S-05 | | 알림에서 바로 시작 | | |

## P5 — 계정과 서버

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 27 | ~~DB 확정~~ — 완료: PostgreSQL 18 (ADR-0015) | | | | | |
| 28 | DB 스키마·마이그레이션 | design §11 | | 테이블 생성 | | |
| 29 | 구글 로그인 + 이메일 가입·로그인 (FastAPI 직접) | FR-U-01, FR-U-02, design §13 | | 로그인 동작 | | |
| 30 | 메일 인증·비밀번호 재설정 — 팀 Gmail, 요청 횟수 제한 | FR-U-03, design §13.2~13.4 | | 인증 코드·재설정 메일 수신, 학교 메일 스팸함 확인 | | |
| 31 | 1분 요약, 업로드 큐, 적재 API | FR-R-01, FR-R-02 | Q-15, Q-18 | 기록이 서버에 쌓임 | | |
| 32 | 기준선·설정·스트레칭·알림 기록 API | design §12 | | 다른 PC에서도 설정 유지 | | |
| 33 | HTTPS 배포 (스테이징) | NFR-08, design §17 | Q-04 | https 주소에서 카메라 동작 | | |

## P6 — 기록

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 34 | 대시보드 (일·주) | FR-R-03 | | 추이 표시 | | |
| 35 | 변화 탐지 — 단순 통계 먼저, PyOD 비교 | FR-R-04, design §14 | Q-12 | 평소 범위 이탈일 표시 | | |
| 36 | 리포트 PDF — WeasyPrint | FR-R-05, design §15 | Q-13 (내용) | 한글 PDF 내려받기 | | |
| 44 | 리포트 LLM 요약 — 후보 모델 비교(같은 테스트 20개), 검사·재사용·하루 한도·실패 시 대체 | FR-R-07, design §15.1 | Q-27 | 모델 선정 기록, 검사 통과율 | | |
| 37 | 보정 전 구간 표시 | FR-R-06 | | 대시보드·리포트에 표시 | | |

## P7 — 마무리

| # | 작업 | 근거 | 필요한 결정 | 산출물 | 담당 | 기간 |
|---|---|---|---|---|---|---|
| 38 | 기록 삭제·탈퇴 | FR-U-05 | Q-17 | 삭제 확인 | | |
| 39 | 오류·예외 처리 전반 | prd §4 | | 예외 시나리오 통과 | | |
| 40 | 판정 일치율 실험 | NFR-04 | Q-24 | 일치율 기록 | | |
| 45 | 개인정보 동의·처리방침 작성 — 개발 막바지에 상황을 보고 | 원문 45 | Q-26 | 가입 동의, 처리방침 페이지 | | |
| 41 | 사용자 테스트 — 10명 이상, 촬영 동의서 | NFR-05, 원문 8 | Q-26 | 만족도·오류 기록 | | |
| 42 | 사용 OSS·라이선스 목록 정리, 업스트림 이슈 | 원문 8, 18 | | 라이선스 목록, 이슈 1건 이상 | | |
| 43 | README, 데모 GIF | | | 실행 방법 정리 | | |

---

## 병렬 가능 구간

- **P0 동안**: 3·4·5번은 서로 독립이다. 19번(에셋 찾기)도 이때 시작할 수 있다
- **P1 이후**: P2(알림), P3(아바타), P5(서버)는 서로 독립이다
- **첫 출시 코칭**: 동작 근거·촬영 실험, 판정 엔진(23), 두 아바타(19·20·47), 계정 경계가 함께 검증돼야 열린다. 스켈레톤(12)은 시제품 실험에만 필요하다
- **P6**: 31번이 끝나야 열린다. 변화 탐지 검증은 그 뒤 일주일 이상 기록이 필요하다

## 되돌리기 어려운 지점

| 시점 | 확인되는 것 |
|---|---|
| **6번 완료** | 무엇을 재는지 확정된다. 이후 계산식을 바꾸면 쌓인 기록과 비교가 어려워진다 (`client_version`으로 구분은 가능) |
| **13번 완료** | 브라우저 하나로 측정이 된다 → 둘이 매일 쓰기 시작 |
| **17번 완료** | 작업 중 알림이 성립하는지 확정된다 (또는 폴백으로 확정) |
| **31번 완료** | 기록이 서버에 쌓인다 → 일주일 뒤부터 변화 탐지 시험 가능 |
| **36번 완료** | 측정부터 리포트까지 전체 흐름이 이어진다 |

---

## 채워야 할 것

- [ ] 담당자 배정
- [ ] 각 작업 기간
- [ ] P0 결과로 prd·design의 `[미정]` 갱신
