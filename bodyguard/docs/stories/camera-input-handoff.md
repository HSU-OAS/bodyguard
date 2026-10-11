# S3.C7 — 준비 추론과 연속 입력의 시각 인계

기준 main `7ed34fb64994f3b6758eb8be5fbc0de7e1d897ff` · `codex/camera-input-handoff` · FR-M-01/02/07·FR-U-04·NFR-07/08

상태: 경계 실패 재현·구현·로컬 검증/작성자 리뷰 완료, 조건부 PR 게이트 진행 중. 아바타 제작·실제 참여자·Docker는 CEO의 보류 답변을 유지한다. PR133의 병합/main 포함을 확인했다.

## 범위와 근거

준비용 Worker 추론은 `performance.now()`를 쓰지만 새 연속 입력 source는 이전 추론 시각을 모르고 decoded callback 시각을 받아들인다. Worker는 같은/이전 시각을 거절한다. 이 경계가 재현되면 이미 소비한 시각의 입력을 추론 전에 건너뛰고 다음 실제 callback을 기다리도록 인계한다. 프레임 시각을 현재 시각으로 바꾸거나 Worker 순서 검사를 완화하지 않는다.

[rVFC 제안 명세](https://wicg.github.io/video-rvfc/#procedures)의 callback 시각은 rendering update의 시각이다. 별도 `performance.now()`와의 인계 검사는 필요하지만 이것만으로 이전 간헐적 timeout의 원인이 입증되지는 않는다. 현재 main의 제어 재현과 실제 SDK 시험을 구분한다. 얼굴·손·heavy 모델, 5초 응답/최대 입력 나이, 수용/안전 기준은 바꾸지 않는다.

## 수용 기준·하네스

1. unit에서 이전 detector 시각과 같은/작은 decoded 시각을 전달한다. 원본 기준 실패를 먼저 보존하고, 보완 후 VideoFrame/추론 생성 없이 null, 다음 더 큰 원래 시각만 전달하는지 확인한다. 잘못된 인계 시각은 획득 전 거절하고 복사한 설정을 나중에 바꾸어도 경계가 바뀌지 않는다.
2. 준비 owner가 실제 warmup detect에 넘긴 바로 그 시각을 새 source에 넘긴다. 새 준비 세대에 새 값, 명시 observe 전 source 생성0, 취소/계정 회수·원래 deadline/정리 격리는 유지한다.
3. 실제 Chrome/React/가짜 카메라/heavy SDK: 준비→명시 연속 입력→동작 변경/새 준비→종료를 확인한다. 별도 제어 시험은 첫 decoded callback의 시각만 warmup과 같은/이전 값으로 대체하여 경계를 재현한다. 이 대체를 자연 발생·실제 사람 시험으로 세지 않는다. 성공 시 이후 실제 callback 원래 시각을 사용하며 추가 카메라/Worker, 외부/GLB/쓰기/저장소0을 확인한다.
4. 전체 frontend 회귀·타입·변경 파일 정적 검사·production build/비공개 제외·CSP/고지·공개 JS/CSS 동일·diff를 실제 실행한다. 작성자 코드 리뷰, 최신 diff/CLEAN/체크와 조건부 PR 병합을 확인한다. 최초 실패·원본/실행 SHA를 보존한다.

## 제외·완료 조건

공개 제품 UI/아바타/동작/임상 기준·추천·기록 활성화, 실제 카메라 사람/성능·SQL/계정 사업자, Docker/HTTPS, 비용/시크릿/운영 DB·배포/출시는 제외한다. 이전 원인 미확정 native timeout과 원래 시작 P2는 이 경계 보완으로 닫지 않는다. 이번 Story가 끝나도 전체1~6·출시 적격 동작0·기존 필수 기준은 그대로다.

## 실제 결과

[실제 흐름·원본 실패/한계·작성자 리뷰](../review/camera-input-handoff/README.md). 준비 시각 이하 첫 callback이 추론에서 거절되는 경계를 unit/제어 native RED로 재현하고, 이전 stamp 인계·추론 전 skip·새 원래 시각 수용을 구현했다. 전체1750/범위77·제어 native8/원래 native6·타입/정적/build/guard/CSP/고지/공개 byte 동일/diff를 실제 확인했다. 원본 실패·source/hash·24gzip 증거를 보존했다. 자연 발생 경쟁·과거 timeout/시작 P2 해결·실제 사람/아바타/출시 적격/전체1~6 완료는 아니다. 제품/UI/API/임상/운영 및 승인 경계는 그대로다.
