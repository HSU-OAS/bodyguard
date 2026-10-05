# S2.5e — 실제 브라우저 카메라·추론 소유 포트

비공개 구현/검증·B-09 외부 SDK 통신 P2 미충족, draft PR 준비 / main 1528e9eb56425cc288f77d0b94721a19635a752c · codex/coaching-browser-ports

## 범위와 선행 상태

PR #35 merge/main 포함·source 브랜치 보존을 실제 확인했다. 순수 engine/controller/session/lifecycle 연결은 있고 ports·관찰/gate는 합성이었다. 현재 camera/openCamera와 pose/hand/face loader·설치된 MediaPipe1.0.1 API를 재사용해 **소유권이 있는 실제 자원 포트**를 만든다. FR-M-01/02/07·FR-S-04·FR-U-04/NFR-07/08이다. Model 선택은 명시 PoseModel만 허용하고 시제품 heavy 기본값을 출시 기본값으로 승격하지 않는다.

`coaching/browserPorts.ts`의 createBrowserPorts(video, {poseModel, onFailure})는 camera/inference factory만 반환한다. avatar factory를 noop/가짜 ready로 만들지 않는다. 공개 UI/route·실제 motion gate/판정·시범/리타게팅·결과 저장은 연결하지 않는다. 같은 아바타 부위 제작/검증은 시작하지 않는다. 선행 gate가 false인 제품 코칭은 여전히 활성화하지 않는다.

## 수용 기준/하네스

| ID | 구현과 검증 |
|---|---|
| B-01 | 생성/잘못된 모델·effect·중복/과거 세대만으로 getUserMedia·모델 초기화0. 명시 camera/inference 순서만 수행 |
| B-02 | openCamera로 받은 generation-owned stream/video lease. abort/dispose/play 실패/늦은 허용/교체에서 현재 스트림과 과거 스트림을 혼동하지 않고 정리 |
| B-03 | camera lease 없이 추론 초기화0. 해당 camera 세대의 Pose·Gesture·Face가 모두 준비되기 전 inference ready0. body/hand/face의 부분 실패를 단순 경고나 성공으로 낮추지 않음 |
| B-04 | 모델을 만들던 중 취소/교체하면 이미 만든 모델과 늦은 모델을 모두 close. 각 소유 task/lease의 dispose는 멱등, 한 close 실패가 다른 close를 막지 않음 |
| B-05 | 부분 준비 해제의 실패도 고정 cleanup-error로 전달하고 새 준비를 차단. 필요한 tagged factory fault/controller 처리를 같은 Story에서 구현. 과거 세대 cleanup 실패도 현재 소유 자원을 남긴 채 성공 재개하지 않음 |
| B-06 | track ended와 observer 실패는 고정 generation/reason만 통지. 필요한 세대 검증 session error reporter를 연결해 과거 종료로 새 세션을 끝내거나 raw 오류/stream/model/좌표를 전달하지 않음 |
| B-07 | constructor·권한 거부·late/play failure·partial/native task close·reuse·abort/ended를 결정적 합성 하네스로 먼저 재현. 실제 stream/model을 합성으로 통과 처리하지 않음 |
| B-08 | 실제 Chrome·실제 MediaStream API의 **가짜 카메라**와 실제 cached MediaPipe task 초기화/close API를 추가 시험. 사람/관절/시범/실제 camera 권한 popup·GPU/worker 완전 해제·실제 fps/전력 확인과 구분 |
| B-09 | raw 영상/좌표/식별자 기록/업로드·영상 screenshot0. 외부 차단 proxy와 local asset만 사용. production module/개발 fixture0·공개 web 카메라0·전체회귀/정적/build/diff/scope 리뷰·조건부 PR 게이트 |

기존 `.env`·CI·deps/lock·public UI·계정/기록 API·판정 임계값·에셋 원본을 유지한다. 실제 모델은 현재 loader의 GPU→CPU fallback을 재사용하되 실측 성능이나 출시 모델 선택의 증거로 세지 않는다. inference lease는 준비/자원 소유권이며 실제 프레임 classifier/신체 추천·3D·운동 결과는 후속이다. 실제 참여자 연결/동의/외부 계정·시크릿/비용·운영/배포·출시는 별도 승인이다.

## 작업

- [x] 최신 main/PR #35 실제 결과·camera/loaders/기존 소유권 경계·명세 확인.
- [x] 첫 B-01 미구현 red·결정적 상세 하네스와 원본 보존.
- [x] camera/inference leases·fixed failure/controller/session 연결·B-01~07 green.
- [ ] 실제 Chrome 가짜 카메라/native tasks·B-08~09·실패/미실행 구분·scope 보완·PR 게이트.

Stage2 D2-A/M/T/R/I/P·실제 인증/판정/아바타/코칭·confirmed 부가 기능·외부/운영/법무/라이선스/참여자·전체1~6단계는 미완료다. 이 Story가 성공해도 실제 사람/관절 정확도·출시 후보판이 완성된 것은 아니다.

## Dev Agent Record

권장안: ports는 같은 session의 세대별 lease를 보장하고 native handle을 fixed notice/snapshot에 넣지 않는다. 부분 초기화 실패의 cleanup fault는 일반 inference-error로 감추지 않는다. 기존 body-only 시제품의 hands/face optional fallback을 제품 준비 성공에 재사용하지 않는다. 실제 motion 필요 자원 최적화/모델 선택은 실측 후 별도 검증이다. Source의 pose/hand/face native handles는 브라우저 메모리에서만 다음 프레임 adapter에 전달할 수 있고 서버/저장소·logs에는 전달하지 않는다.

실제 실행·실패/원본 hash·공개 웹 PNG는 [검증 기록](../review/coaching-browser-ports/README.md)에 있다. 최종 합성446건·정적/build·공개 Chrome7흐름은 통과했으나 실제 native browser의 Google 계측 시도로 B-09/P2는 실패다. 시험 전용 CSP 진단은 실제 모델/해제를 유지하며 네트워크를 차단했지만 제품 정책이 아니다. CEO 중요 개인정보 승인 요청에 응답이 없으며 제품 정책/SDK/deps 변경·통신 허용·Story 완료·병합은 하지 않는다. 독립 작업은 계속한다. observer 문제는 ResourceObserverError/callback-error로 cleanup failure와 구분했다. resourceFailed는 세대/고정 기술 사유만 받는다.

## File List

- frontend/src/coaching/browserPorts.ts, browserPorts.test.ts; resources.ts, session.ts; pose/camera.ts.
- frontend/e2e/browserPorts.spec.ts, browserPortsPolicy.spec.ts, fixtures/browserPortsProbe.ts; playwright.browserPorts.config.ts; scripts/test-browser-ports.mjs, check-selection-production.mjs.
- docs/stories/coaching-browser-ports.md, coaching-session-bridge.md; tasks.md, stage2-carryover.md, open-questions.md; docs/review/coaching-browser-ports/의 collector/실제 증거.

## Change Log

2026-10-05: 최신 main의 카메라/추론 소유 포트 명세 시작. 아바타 보완·실측/출시 gate·별도 승인 경계 유지.
2026-10-05: 실제 native 시험에서 SDK 외부 계측 발견, 실패 보존·시험 전용 CSP 진단·별도 승인 요청. 완료/병합 보류, 독립 개발 계속.
