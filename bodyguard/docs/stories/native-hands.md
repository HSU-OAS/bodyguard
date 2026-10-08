# S2.T16 — native 몸·얼굴·손 동일 입력과 소유권

2026-10-08 · 기준 main3841f3b(PR78). 비공개 연결이며 출시 완료가 아니다.

## 목적·제외

기존 Pose/Face/Gesture SDK를 같은 디코더 프레임·원래 시각에 순서대로 호출하고, 손 후보를 S2.T15의 선택적32관절 드라이버에 연결한다. SDK handedness는 후보 라벨일 뿐 같은 사람·깊이·가림·임상 정답의 증거가 아니다. 실제 제품 화면, 판정, SQL/API, 의상/외형, SDK 배포 정책을 변경하지 않는다. A37 원본/GLB와 기존 실패 증거는 보존한다.

화면은 최소 텍스트·아바타 중심이라는 CEO 방향을 유지한다. 테스트 전용 도구를 확정 디자인이나 최종 외형으로 공개하지 않는다.

## 선행 명세·실행 하네스

1. body→선택적 face→hands가 같은 VideoFrame과 at를 빌린다. body/face는 다음 SDK 호출 이전에 복사한다. 출력은 원래 generation/sequence/at와 bounded plain copies만 가진다. 중복/역순 디코더, 누락/복수 body는 이전 손/머리를 재사용하지 않는다.
2. 현재 SDK의 handedness(비권장 handednesses 아님)를 읽는다. 최대2손·각21점·image/world/라벨 개수 정합성·단일 Left/Right 후보·유한[0,1] 점수를 확인한다. 점수는 정확도나 승인 기준으로 사용하지 않고 출력하지 않는다. 중복 side/알 수 없는 라벨/개수 불일치는 해제한다. mirror는 표시 드라이버에서만 처리한다.
3. 선택적 손 기준을 camera/SDK await 이전에 복사·검증한다. 몸 전용/머리 전용 caller의 기존 인자·동작은 유지한다. 손 설정 없으면 Gesture SDK를 열지 않는다. 기본 모델·delegate·임상 임계값을 추가하지 않는다.
4. 초기화 실패/late init/abort/소유자 교체/로그아웃/401/pagehide/unmount 시 camera·3 SDK·입력·owned pair를 정확히 정리한다. pending 입력 반환 전 SDK/camera를 닫지 않는다. 앞선 close 실패에도 모든 release를 시도하고 fixed cleanup poison을 유지한다. JS 손/얼굴 결과에 close를 만들지 않는다.
5. 구현 전에 단위 하네스를 실행하고 RED를 보존한다. 실제 Chrome/SDK/fake camera + 실제 AuthProvider/API/격리 SQL의 남녀 start→stop→기록 및 held-result 권한 회수 흐름을 실행한다. held-result는 실제 동기 SDK 결과 이후 테스트 wrapper이며 실제 SDK 지연이 아니다. 가짜 카메라 blank 결과를 양성 인식·실제 참가자 검증으로 표시하지 않는다.
6. 전체 FE/타입/Biome/assets/build/public guard/로컬 Ruff/diff, 공개JS/CSS/5모델 byte 불변과 비공개 에셋을 확인한다. 실제 결과·실패·source SHA·라이선스·작성자 리뷰를 기록한 후 최신main/exactHEAD/diff/CLEAN/checks 게이트로 merge commit한다.

## 미완료 조건

실제 손 양성 인식·동일인 연결·신체/얼굴/손 가림/좌표계·물리 카메라·참가자/노트북·최종 외형/권리·승인 디자인·제품 SDK egress·HTTPS/운영은 별도 필수 게이트다. 단계2 및 전체1~6 완료로 표시하지 않는다.
