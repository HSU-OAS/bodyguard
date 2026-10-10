# S2.T13 같은 입력의 머리·사지 표시

2026-10-08 · 시작 기준 main 2bc3cd9(PR75) · D2-T/R 비공개 기술 통합

## 목적·경계

S2.T11의 명시 머리 정렬과 S2.T12의 같은 frozen 프레임을 기존 owned 두 GLB에 연결한다. 비교 모델은 그대로 두고 사용자 모델만 현재 사지·머리 후보를 표시한다. 같은 입력은 동일인 검증이 아니므로 공개 코칭·자세 성공·경추 분절 판정에 사용하지 않는다.

원본/GLB/조형·제품 UI/문구·SDK 제품 통신 정책·API/SQL·운영 변경0. 기존 원본과 실패를 보존하고 D2-A/M/T/R/I/P·1~6 게이트와 별도 승인 경계를 유지한다. 여성 무의상·연속 얼굴/목 요구는 최종 조형 보완 목록에 그대로 남긴다.

## 수용 기준·하네스

1. copied head quaternion 전용 입력을 제공하되 기존 raw face API와 명시 기준/좌표계·거울·보간·유효기간을 유지한다. 478점이나 matrix를 새로 합성해 제품 경계로 전달하지 않는다.
2. 머리 설정은 선택적이고 load 이전에 복사한다. 실제 skinned skeleton의 유일 head가 아니면 준비 실패와 자원 정리로 끝난다. 기존 사지만 쓰는 caller의 상태·기본 동작은 유지한다.
3. 사용자 rig의 사지와 머리는 한 원래 generation/sequence/at로 갱신한다. 잘못된 세대·중복/역순·만료, 외부 getter 재진입/abort/예외가 더 최신 관찰을 덮거나 절반만 갱신하지 않는다.
4. 새 얼굴 누락·잘못된 회전·불완전/복수 body는 head 추적을 해제한다. 머리를 정면으로 고치거나 누락 관찰을 성공 처리하지 않는다. 표시 coverage는 임상 성공이 아니다.
5. 합성 unit의 긍정/실패와 실제 Chrome·native SDK의 가짜 장치 미검출을 분리한다. 기존 남녀 A37 두 GLB의 합성 머리+사지 움직임→얼굴 누락→native 미검출→정리 흐름을 실제 WebGL로 시험한다. source/비교 모델·position/scale·8가중치·전신 보존을 확인한다. 입력 영상/좌표 기록·캡처0.
6. 전체 frontend/type/Biome/assets/build/public guard/diff와 공개 JS/CSS/5모델 불변을 실제 확인한다. 결과·실패·source SHA와 PR 재검토를 기록하며 미실행 실제 사람/물리 카메라 시험을 완료로 세지 않는다.

## 후속 필수 조건

몸-얼굴 동일 사용자 연결과 실측 좌표계/오차·실제 긍정 및 가림/복수 사람, 목 분절·체간/손·시범/적색 피드백, 최종 외형/권리·승인 디자인·SDK 정책·노트북/HTTPS/운영은 미완료다. 본 Story 통과는 전체 D2나 출시 선언이 아니다.

## 실행 결과

runtime e29342b에서 실제 Chrome/가짜 장치·SDK·남녀 GLB의 합성 머리+사지→누락/native 미검출→pending 종료2흐름/20상태, 전체1001unit/type/Biome/assets/build/guard/diff를 실행했다. raw face 경로도 실제 Chrome 합성 남녀 회귀를 실행하고 현재 source SHA와 비교했다. Scene 배치 문제와 freeze 측정 시점 실패·원본을 보존하고 수정 후 재실행했다. [실제 흐름/미완성 canvas·실패·남은 조건](../review/observed-body-head/README.md). 공개 byte/5모델 동일, GLB/조형/입력 캡처/운영 변경0이며 전체1~6은 미완료다.
