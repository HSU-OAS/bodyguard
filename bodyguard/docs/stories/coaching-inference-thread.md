# S6.25 — 코칭 추론과 화면 응답의 스레드 분리

2026-10-10 · 시작 main `a53ff75addbdccf07678594970f850b2a3c5ad89` · `codex/coaching-inference-thread`. FR-M-02/07·FR-A-03·NFR-01/02/07/08. 실행 전 계약.

## 목적과 결정 조건

현재 코칭 native adapter는 thread 생략 시 main의 동기 body/face/hand SDK를 사용한다. 기존 S6.18은 첫 추론 약800ms의 화면 스레드 공백을 관찰했고 Worker는 이미 별도 opt-in으로 구현·검증됐다. 비용을 준비로 옮기거나 허용 시간을 늘리는 대신 현재 동일 SDK/입력의 실제 대조에서 화면 응답 차이를 확인한다. 근거가 확인되면 **기존 Worker를 기본 추론 경로로 승격**하고 main은 명시 비교/개발 경로로 유지한다. 준비 실패 시 main으로 자동 전환하지 않는다.

이는 아직 비공개인 코칭 core의 기술 선택이다. 모델/정확도/동작 기준·공개 구성·SDK 통신/개인정보 정책 변경이 아니다. Worker도 같은 브라우저 안에서만 처리한다. 공개 코칭, 새로운 준비/성공 표시, 기본 모델 축소, 아바타 제작/GLB/WebGL 검증은 하지 않는다.

## 수용 기준·하네스

1. 기존 실제 지연/실패는 보존한다. 현재 body+face+hand SDK와 동일640×480 blank VideoFrame을 main/Worker로 fresh browser context에서 고정 ABBA 순서 비교한다. 실제 SDK·Chrome·localhost이며 사람/물리 webcam/정확도/FPS 검증은 아니다. 모델·delegate 요청·출력 옵션은 동일하다.
2. 첫/후속 실제 추론과 그동안 main의 RAF 공백·예약된 DOM 버튼 click 이벤트 지연을 숫자로 분리한다. click은 시험의 timer가 전송하며 실제 사용자 조작이 아니다. 오류는 실패로 보존하고 실제 출력 arrays/얼굴 행렬·영상·credentials/console 원문을 저장하지 않는다. CPU/GPU 바쁜 환경을 임의 원인으로 확정하지 않는다.
3. Worker 대조가 정상 동작하고 main-thread blocking 감소의 근거가 있을 때만 기본 경로를 바꾼다. 기본Worker·명시main·Worker 준비 실패의 무자동fallback을 결정적인 unit RED→GREEN으로 검증한다. generation·source/frame/SDK 소유·pending/abort·복구·기존 모델/옵션을 유지한다. 기존 main 회귀는 명시main으로 고정해 의미를 보존한다.
4. related 및 전체frontend·tsc/Biome·production build/guard를 실제 실행한다. private actual SDK/Worker의 첫/후속 결과·dispose/단일 in-flight를 검증하고 모든 owned browser/server/proxy를 종료한다. 외부 전송/API·카메라·storage0, 새 GLB/아바타 WebGL/외형 검증0이다. SDK 자체는 기존 GPU 우선/CPU fallback을 유지하며 GPU용 context와 아바타 렌더링을 혼동하지 않는다. 공개 UI/CSS 및 이번 변경과 무관한 서버/저장 schema·기존 원본은 보존한다.
5. 실행 입력은 미리 별도 보존한다. source/bundle/report/실패·미실행을 구분하고 작성자 scoped 리뷰·최신remote diff/head/main/CLEAN/체크·조건부 merge commit·브랜치 유지로 마친다.

## 별도 미완료

PR90/91/101의 과거 전체 시작 P2·원래26건, 실제 사람/15fps/피드백1초/정확도80%·최종 아바타/시범·공개UI/SDK 승인·Docker/TLS/외부/법무/운영·전체1~6은 이 비교로 닫지 않는다. 아바타 보류에 따라 현재 기존3D/로그인native suite는 재실행하지 않으며 과거 실행은 현재 통과로 표시하지 않는다. 실제 요청자의 목표와 출시 기준을 좁히는 결정이 아니다. 비용·계정·시크릿·운영 DB migration·배포·출시·중요 안전/개인정보 변경은 별도 승인이다.

공식 근거: [Google Pose Web 가이드](https://developers.google.cn/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [Face Web 가이드](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js?authuser=01). 두 가이드는 동기 detect가 UI thread를 막고 Worker에서 실행할 수 있음을 설명한다. 이 문서만으로 로컬 성능/정확도를 통과 처리하지 않는다.
