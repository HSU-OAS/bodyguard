# S2.T9 — 실제 계정·SDK·두 아바타 통합

상태: 구현·초기 로컬 검증 / baseline `4adfe82353145fa819cc6d6ea254578be3dedeeb` / `codex/native-auth-playback`

FR-U-04·FR-S-02/04·FR-R-03·FR-M-07·FR-A-03·NFR-07/08. S2.T8의 실제 로그인 소유 hook에 S2.T7의 native 카메라/SDK/source/남녀 GLB 재생을 연결한다. 기존 부품을 실제 Chrome·HTTP·격리 SQL의 같은 흐름에서 실행하며 공개 제품 코칭을 활성화하지 않는다.

## 수용 기준·검증 계획

1. 생성·로그인 확인·명시 준비만으로 카메라/SDK/재생/기록 저장0. fresh bridge는 기록 세션마다 별개다. 실제 계정의 원래 ready 객체로만 소유권을 캡처한다. 미승인 UI/SDK 제품 정책·조형/GLB/판정 기준 변경0.
2. 명시 시작으로 native 가짜 MediaStream·VideoFrame·SDK·남녀 두 GLB·RAF가 작동한다. hidden video/입력은 촬영·저장·업로드하지 않으며 avatar canvas만 미리보기로 남긴다. 전신 두 모델은 독립 복제이며 미완성 A37/올바른 시범 아님을 표시한다.
3. 실제 같은 계정 refresh, logout204, 서버 logout 뒤 /me401, pagehide/unmount는 즉시 재생/새 입력·이전 세션의 재개/저장을 차단한다. SDK가 이미 반환한 native 결과를 시험용으로 보류하고, 정리가 끝날 때까지 카메라/SDK를 보존한다. 늦은 결과/입력을 닫은 후 pair/SDK/camera를 종료한다.
4. 이전 결과 보류 중 새 준비는 준비 완료/새 획득을 내보내지 않는다. 해제 후 새 준비와 명시 시작은 fresh native bridge로 재생한다. 원본 generation/시각을 다시 붙이지 않는다.
5. native 가짜 영상 미검출을 완료 수행으로 만들지 않는다. 명시 중단→명시 저장→실제 본인 기록은 interrupted·관찰0으로 확인한다. 실제 시간 쌍을 사용한다. 긍정 판정/실제 사람·자세 정확도 검증으로 세지 않는다.
6. 남녀별 Chrome/API/격리 PostgreSQL 흐름, 기존 AuthProvider/API 브라우저 회귀, 전체 frontend/타입/Biome·변경 시험 runner Ruff·assets/build/공개 guard·공개 byte/모델 동일·실패 원본/source SHA·작성자 리뷰·최신 PR 게이트를 통과한다.

시험 전용 connect-src self·외부 route 차단·거부 proxy·service worker 차단을 적용한다. SDK 제품 egress 정책 승인을 대신하지 않는다. 메일/촬영 장치/출시 motion gate와 보류 wrapper만 합성, SDK·GLB·RAF·WebGL·인증/API·SQL은 실제다. renderer baseline PBR cache는 전체 GPU/worker 해제나 장시간 품질 증거가 아니다.

testing-strategy로 이전 모의 자원 검증과 실제 native/API 같은 흐름, 실제 참여자 검증을 구분한다. code-review로 소유권 교체·pending/late·프레임/계정 데이터 경계·실패 처리/누수를 점검한다. 최소 문구·안전 안내·기존 원본/이월·별도 승인 규칙과 전체1~6 완료 기준을 유지한다.

## 초기 결과와 미완료

실제 Chrome154의 남녀별 시작→중단→본인 기록, 같은 계정 refresh→정리 대기→새 준비/명시 시작, logout204·서버 /me401·pagehide·unmount에서 이전 재개/저장 차단을 확인했다. 가짜 카메라에서 실제 SDK 미검출은 관찰0·interrupted로 저장되고 공개 본인 기록 상세에서 보였다. 준비만으로 native 획득0, 보류 결과 해제 후 프레임/결과·GLB·SDK·카메라 종료를 확인했다. 기존 공개 JS/CSS·모델 및 조형은 바꾸지 않았다. 원본 실패와 최종 source SHA 검증은 PR 증거로 남긴다.

첫 타입 검사 실패와 sandbox의 임시 DB 공유 메모리/localhost bind 거부를 보존했다. 타입의 기록 ID 접근을 수정하고, 임시 Unix 소켓 DB/localhost 시험에만 승인된 실행 권한을 사용했다. 이전 resume/save Promise는 보류 native 결과가 닫힐 때까지 기다릴 수 있어, 시험은 먼저 호출하고 결과 해제 뒤 정착을 확인한다.

connect-src self가 차단한 SDK 시도는 실제 관찰되었다. 외부 요청 route0·저장소0은 SDK 제품 정책 승인/무통신 보증이 아니다. 실제 사람/물리 webcam·권한 popup·자세 정확도·목/손/체간·올바른 시범/적색 교정·최종 외형·승인 디자인/SDK 정책·전체 GPU/worker/장시간/다장치·공급자/HTTPS 운영과 D2/전체1~6은 미완료다. 공개 코칭/출시 동작0을 유지한다.
