# S2.M2 — native 촬영 입력과 목 관찰 연결

2026-10-08 · 기준 main 5a1a3d8 · FR-M-01/02/07·FR-A-01/03·ADR-0012

## 범위와 결정

S2.M1의 이미지 평면 관찰값을 실제 decoded VideoFrame → SDK 반환 → 현재 소유 native 재생에 연결한다. 해당 입력의 displayWidth/displayHeight를 캡처 시점에 복사하고, 이후 video/CSS 크기로 덮어쓰지 않는다. 현재 구현에는 이 정보의 전달이 없고 SDK 점 복사 과정에서 선택적 presence도 누락된다. 둘을 보존해야 비율과 신뢰도 조건을 계산에 적용할 수 있다.

입력 좌우 반전 여부와 최소 confidence는 개발 소비자가 명시한다. 아바타 표시 mirror와 입력 mirror는 서로 다른 설정이다. 이 Story에는 임계값/동작 판정/올바른 수행/교정/신체 추천 기본값이 없다. 실제 관찰은 현재 입력과 렌더 시각으로만 계산하고 이전 자료를 정상으로 채우지 않는다.

[WebCodecs 초안의 VideoFrame 속성](https://www.w3.org/TR/webcodecs/#dom-videoframe-displaywidth)과 [Google Web 결과 설명](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)을 확인한다. 원래 추론 입력의 영상 비율을 쓰며 해부학적 길이·경추 각도 복원이 아니다. SDK의 회전/좌표계·장치 반전 및 실제 사람 대응은 별도 실제 검증이다.

## 수용 기준과 하네스 — 구현 전

- 촬영 크기는 같은 input/원래 generation·sequence·at에 결합한다. 한 호출만 대기하고 크기를 추론 전에 복사한다. 입력 크기0/비정상은 실패하며 실패 후 input/result를 해제한다.
- 선택적 presence를 복사한다. 낮은 presence를 제거하여 목 관찰값을 정상으로 만드는 일이 없어야 한다. body/face/hand 경로의 동일 입력·정리 경계는 유지한다.
- 명시적 opt-in에서만 getNeckObservation(now)로 현재 같은 출처 RAF/performance 시각의 관찰을 제공한다. 시각 없는 getSnapshot에 available 캐시를 넣지 않는다. 현재 소유·현재 accepted 프레임을 검사한다. 가림/미검출/복수·새 관찰·만료·pause/퇴역·새 세대는 이전 관찰을 사용할 수 없다. 파생 프레임값 역시 브라우저 임시 메모리만 사용하며 기록/API/로그/파일로 전달하지 않는다.
- 원래 계정/소유 자원 장벽을 우회하지 않는다. 시범/오류 evaluator/아바타와 관찰값 계산은 독립이다. 관찰값 available은 자세 성공·정상·동일인 확인이 아니다.
- 단위/통합: 캡처 비율의 불변성·비동기 대기 중 크기 변경·복사/신뢰도·반전·현재 소유/만료/새 세대·기존 native 회귀. 신규 실패를 먼저 재현한 뒤 전체 FE·Biome·tsc·production build/guard·diff/public byte 검증.
- 실제 Chrome의 VideoFrame/SDK 경로를 로컬 차단된 시험 환경에서 검증한다. 가짜 카메라 native 미검출과 생성 점 양성은 구분한다. 원본 영상/좌표/프레임 파생값은 증거에 넣지 않고 고정 검사 결과만 남긴다. 물리 카메라·실제 참여자 정확도로 세지 않는다.

## 제외 및 미완료

공개 UI/문구/구조·GLB/Blender/조형·임상 classifier/자동 진행·출시 동작 승격·SDK 제품 개인정보 정책·외부 계정/비용/시크릿/운영 DB/배포/출시 변경0. 출시 동작0·기존 시작 P2·D2와 전체1~6 미완료를 유지한다. 실제 참여자/관찰자·장치 반전·시범/오류 분류·최종 외형/승인 UI·운영 연결은 남는다. 기존 원본/실패/검증은 보존한다.

## 실행 상태

구현과 단위·정적·타입·production build/guard는 통과했으나 필수 native 회귀는 통과하지 않았다. **Story 미완료·Draft 보존·병합 불가**다. [실제 실행·실패·원인 미확정](../review/native-neck/README.md)에 실행 시점/소스·원본 실패와 한계를 남긴다. 정상 재실행을 시작 지연의 근본 원인 해결로 세지 않는다.

현재 처리에는 촬영 비율·낮은 presence 보존·명시 입력 반전·현재 소유/시각 기반 관찰과 재진입 token 보완이 들어갔다. RED에서 누락15건과 재진입1건을 각각 재현했다. 전체 FE1327·정적/type/build/guard·공개 JS/CSS 불변은 실제 확인했다. 남녀 최초 새 흐름과 최종 남성 새 흐름은 가짜 장치/생성 양성으로 통과했으며, 최종 여성 새 흐름은 기존5000ms 시작 조건에서 실패했다. 같은 최종 소스의 기존 남녀 회귀·구체적 수치는 위 증거에 기록한다. 실제 사람·물리 웹캠·임상 판정 검증0이다.

다음 해결 조건: 최신 main의 동일 native 시작 조건과 현 변경을 분리하여 준비/추론 구간·환경·실행 순서를 대조한다. 제한5000ms·retry0을 늘리거나 낮추지 않는다. 필요한 보완 후 남녀 새 목 흐름과 기존 회귀 모두 통과하고 최신 diff/CLEAN/체크를 확인해야 병합할 수 있다. 단순 성공 반복·모의 관찰·공개 byte 불변만으로 이 게이트를 닫지 않는다.
