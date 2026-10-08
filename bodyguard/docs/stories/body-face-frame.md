# S2.T12 — 같은 고정 영상 프레임의 몸·얼굴 결과 전달

상태: 명세·첫 하네스 / baseline `62b837539833f177e66b96d5bfc4fbab57fa148c` / `codex/body-face-frame`

FR-M-01/02/07·FR-A-01/03·NFR-07/08. 열린 caller video/stream의 한 decoded VideoFrame을 몸·얼굴 추론에 차례로 전달한다. original generation/sequence/at를 유지하고 SDK result와 입력을 모두 정리한 뒤 복사된 몸 좌표와 머리 회전만 반환한다. 같은 시각은 같은 사람이라는 증거가 아니므로 이 묶음을 사용자 head bone이나 판정에 자동 적용하지 않는다.

## 수용 기준

1. 생성 시 촬영·추론0. 같은 VideoFrame object/at로 body→face를 실행하며 최대 한 건만 대기한다. input은 face 완료까지 열려 있고 caller detector/camera를 소유하거나 닫지 않는다.
2. body 값은 face 호출 전에 snapshot한다. body/world와 original stamp를 보존한다. face의 점/행렬/translation은 반환·저장·로그하지 않고 선언된 matrix 순서의 회전만 복사한다. pose-only 경로의 기존 결과 모양과 동작은 유지한다.
3. 얼굴 누락/복수/행렬 오류는 새 head null이며 이전 얼굴을 재사용하지 않는다. body/world0·복수/불일치는 head null이다. 이 제한은 검출되지 않은 사람이나 몸-얼굴 동일인 연결을 증명하지 않는다. 실시간 코칭 성공·동작 적격성/임계값은 변경0.
4. 중복/역행 decoded stamp는 추론0. abort/track 종료·video 교체·late 응답은 전달0. body pending 중 취소되면 face 호출0. face pending 중 취소되면 body/input을 기다려 정리한다. 부분 실패도 body.close/input.close 각1회, 정리 실패는 고정 cleanup 오류로 격리한다. native FaceLandmarkerResult에는 존재하지 않는 close를 요구하지 않는다.
5. unit의 긍정 머리 회전/오류·소유 장벽은 합성이다. 실제 Chrome의 가짜 장치·native Pose/Face SDK로 같은 frozen frame의 연속 전달/미검출·pending 중 종료·재준비를 실행한다. 실제 사람/동일인·머리 방향 정확도·물리 권한/카메라 시험으로 세지 않는다. 카메라 영상/입력 화면 캡처0.
6. 전체 frontend/type/Biome/assets/build/public guard 및 공개 JS/CSS/model bytes 불변을 확인하고 원본 실패·소스 SHA·review·exact HEAD/PR 게이트를 보존한다. API/SQL/원본·GLB/조형·공개 화면·SDK 제품 정책/운영 변경0.

## 후속 필수 조건

몸-얼굴 동일 사용자 연결과 실측 좌표계, head rig 전달·camera 정렬의 명시 기준, 목 분절·체간/손·시범/적색 피드백, D2-A/M/R/I/P·승인 디자인/SDK 정책·실제 노트북/운영 및 전체1~6 완료 기준을 유지한다. 최소 문구·기존 원본 보존·동일 부위 새 조형 금지·별도 승인 경계도 유지한다.
