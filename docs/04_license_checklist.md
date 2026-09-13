# OSS 라이선스 체크리스트

상태: **작성 중**

## 사용 OSS

| OSS | 활용 기능 | License | 수정·확장 | 출처 |
|---|---|---|---|---|
| MediaPipe | 웹캠 관절 33점 추출 | Apache-2.0 | O | 공식 Repository |
| Three.js | 3D 인체 아바타 렌더링 | MIT | O | 공식 Repository |
| PyOD | 자세 지표 시계열 변화 탐지 | BSD-2-Clause | O | 공식 Repository |
| React | 프론트엔드 UI | MIT | X | 공식 Repository |
| FastAPI | REST API | MIT | X | 공식 Repository |

## 라이선스 문제로 미채택

| OSS | License | 사유 |
|---|---|---|
| YOLO-Pose (Ultralytics) | AGPL-3.0 | 전염성 — 우리 소스 코드까지 공개 의무 발생 |
| OpenPose | 비상업 전용 | 비상업적 사용으로 제한 |

## 확인 시 주의사항

**저장소의 라이선스와 모델 가중치의 라이선스는 다를 수 있습니다.** 저장소 배지가 Apache-2.0이어도 가중치 파일은 별도 조건이 붙는 경우가 있으므로 각각 확인합니다.

## Contribution 계획

| OSS | 계획 |
|---|---|
| MediaPipe | 사용 중 발견한 문제를 재현 코드와 함께 Issue 등록, 한국어 예제 문서 개선 제안 |
| Three.js | 구현 예제 공개 및 문서 개선 Issue 등록 |
| PyOD | 활용 사례 문서 기여 |
