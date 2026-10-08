# S2.T11 — 명시 기준의 머리 방향 리그 연결

상태: 구현·실제 Chrome/GLB 검증·작성자 리뷰 / runtime `2dd5d9e27c7b7309f18849ff15f12ac429b5234c` / baseline `01b97dbecfe2a9a37ee7165e98c8f1e5730f7be4` / `codex/head-orientation` / PR 게이트

FR-A-01/03·FR-M-02/07·NFR-07/08. 사지 연결에 없던 머리 방향을 기존 Blender 유래 A37의 정확한 `head` bone에 비공개로 연결한다. 자동 첫2초 정면·행렬 순서 추측을 재사용하지 않는다. 이는 표시 연결이며 경추 분절 측정·자세 판정·정답 시범·출시 아바타가 아니다. 같은 부위 조형/원본·GLB 수정0, 공개 디자인·SDK 정책·판정·계정/운영 변경0이다.

## 수용 기준

1. 행렬 rows/columns4·length16·유한값·affine 마지막 행·양수 uniform scale·직교/올바른 determinant를 검증한다. 입력 순서는 caller가 명시한다. translation0에서도 행 우선/열 우선 추측0. 얼굴0/복수·점 누락/가림 범위·비유한/잘못된 행렬은 머리 관찰을 만들지 않는다. 단일 검출은 실제 한 사람이나 몸-얼굴 일치 보장이 아니다.
2. caller가 명시하는 camera 기준 회전과 camera→scene 회전·mirror를 복사한다. 첫 프레임/2초/마지막 자세를 자동 정면으로 삼지 않는다. 이 기준은 표시 정렬만이며 의학적 정상 자세나 사용자 보정값으로 채택하지 않는다.
3. 정확한 유일 Bone만 변경한다. rest position/scale·관절 길이·목/체간/다른 bone·여덟 가중치·원본과 다른 avatar를 보존한다. 부모 회전과 authored rest 축을 고려한다. uniform positive 배율을 지원하고 수치 표현 오차만 허용한다. 의미 있는 shear/nonuniform/reflection은 추적 불가이며 배율을 바꾸거나 허용 오차를 늘리지 않는다.
4. 원본 generation/sequence/at를 유지한다. 외부 세대·중복·역행·종료·만료는 적용하지 않는다. 새 미검출은 이전 관찰을 취소하며 표시를 정면으로 바꾸지 않는다. 명시 반감기로 frame-rate 독립 보간하고 close/abort는 멱등이다. 좌표/행렬/영상 로그·저장·외부 전송0.
5. 단위는 합성 행렬/회전/계층·mirror·중립 기준·가림/복수·시간·종료·보간을 검증한다. 실제 Chrome/WebGL/GLTFLoader의 기존 남녀 GLB는 독립 리그·머리 회전·전체 전신·원본/나머지 bone/position/scale/weight 보존·누락/종료를 확인한다. 긍정 입력은 합성이며 native Face Landmarker/실제 사람·정확도 시험으로 세지 않는다.
6. 전체 frontend·typecheck/Biome·원래 assets/build·공개 guard 및 공개 bundle/model byte 불변을 확인한다. actual source/원본 실패와 작성자 리뷰·최신 PR diff/CLEAN/checks를 확인한다. 필수 게이트가 남으면 전체1~6/RC 완료로 선언하지 않는다.

## 테스트 계획

- unit: 행/열 우선과 translation0, NaN/Infinity/perspective/shear/reflection/nonuniform·0/복수/잘린 얼굴, caller 기준/거울, 회전 부모/rest, 독립 모델, 유효기간·서로 다른 세대·중복·역행·abort/close, 보간, authored 변환 보존.
- 실제 browser: 기존 immutable PR9 `25a9bd6c7392890e3b5d5d6ae1046bb7087d56ad` A37 남녀를 localhost 전용 probe로 파싱/clone/8-weight 렌더. yaw/pitch/roll 합성 긍정과 null 관찰·만료·close, source/관절/weight 불변·전신 투영.
- regression: 전체 unit·타입·Biome·assets/빌드·public guard. API/SQL 변경0이며 이번에 backend/native inference/물리 webcam을 실행한 증거로 주장하지 않는다.

## 남은 조건

같은 frozen video frame의 pose/face 결과 묶음·동일 사용자 연결·native SDK 소유 수명, 실제 사람의 좌표계/단일 카메라 오차, 체간/경추 여러 분절·손·축 비틀림, 검증된 시범/적색 피드백·D2-A 외형/권리·승인 디자인/SDK 정책·실제 노트북/다양한 조건 및 전체1~6은 미완료다. 머리 한 bone 연결을 세밀한 목 코칭 완료로 표시하지 않는다. 공개 UI는 핵심 행동만 간결히, 안전 안내는 짧게, 상세는 요청 시 원칙을 유지한다.

runtime의 실제 남녀2흐름·순수21/전체960·타입/Biome·assets/build·공개 guard/diff와 공개 byte 동일을 확인했다. [화면·실패·작성자 리뷰·남은 조건](../review/head-orientation/README.md), [8소스/61원본 증거 SHA](../review/head-orientation/summary.json). 입력은 합성이며 native SDK/실제 사람 정확도 통과로 세지 않는다. 이전2초 정면 시제품은 유지하고 공개 consumer를 추가하지 않는다.
