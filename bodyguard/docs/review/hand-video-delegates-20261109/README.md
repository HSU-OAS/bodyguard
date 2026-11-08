# 공개 손동작 영상의 SDK delegate 비교

2026-11-09 · 개발 검수 · 실제 사용자·의학적 정확도 평가 아님

첫 실행은 모델을 비교하기 전에 Vite가 SDK의 WASM 로더를 일반 모듈로 처리해 로컬 public 파일을 불러오지 못했다([결과](first.json) · [원문](first.log.gz) · [실행 코드](first-source/)). 실제 GPU/CPU 추론 성능이나 정확도 실패로 세지 않는다. 제품 Worker와 같은 별도 classic bundle 로딩 방식으로 시험 환경을 고쳐 재실행한다.

## 입력과 방법

TensorFlow 테스트 저장소의 [공개 손동작 영상](https://github.com/tensorflow/tfjs-models/blob/master/hand-pose-detection/test_data/asl_hand.25fps.mp4)과 [기준 예측값](https://github.com/tensorflow/tfjs-models/blob/master/hand-pose-detection/test_data/asl_hand.full.json)을 임시로 사용했다. 영상 SHA-256 `57c10fb1eb76639edf43e9675213dcc495c51851e32a3592cacaa9437be4f37e`, 기준 예측값 SHA-256 `34f5abb7ff4d35e2ab631760d10d9c12f982596d0a24961445dc020de69d46b4`. 저장소에는 영상·원시 관절 좌표를 복사하지 않는다. 기준 파일은 [TensorFlow의 MediaPipe 테스트](https://github.com/tensorflow/tfjs-models/blob/master/hand-pose-detection/src/mediapipe/mediapipe_test.ts)에서 비교에 쓰이는 **기존 모델 예측**이며 사람의 정답 주석이나 의학적 기준이 아니다.

로컬 Chrome의 별도 classic Worker에서 같은 GestureRecognizer 모델과 620×1080 영상의 같은 325프레임을 CPU·GPU에 순서를 번갈아 적용했다. 각 프레임은 25fps 기준으로 seek해 디코딩했다. 화면 좌표, SDK의 world 좌표 및 이전 모델 예측과의 차이는 브라우저 안에서 계산한 집계만 저장한다. 외부 요청·물리 카메라·쓰기 요청은 0이었다. 두 모델만 따로 시험했으며 제품의 전신·얼굴·손 3개 동시 실행 및 사용자의 자세 평가는 아니다.

## 결과와 한계

[2D 원실행](classic.json)과 SDK world 좌표를 추가한 [3D 재실행](3d.json)은 각각 325프레임 중 324프레임에서 양쪽이 21개 손 관절을 반환했고 1프레임에서는 양쪽 모두 검출하지 못했다. 3D 재실행에서 CPU/GPU 화면 좌표 간 거리는 관절별 평균 약 1.34px, 95백분위 약 2.25px, 최대 약 16.15px였다. SDK world 출력 간 거리는 평균 약 0.00055, 95백분위 약 0.00134, 최대 약 0.01033이었다. 이는 **두 모델 출력 간 차이**이며 실제 손과의 거리나 오차가 아니다. 모델 world 값의 단위를 실제 신체 길이로 해석하지 않는다.

같은 실행에서 개별 추론 시간 중앙값·95백분위는 CPU 약 69.1ms·148.5ms, GPU 약 47.0ms·74.7ms였다. 한 노트북·한 손 영상·두 모델 동시 실행이라는 조건의 기록이며 서비스 전체 FPS나 기기별 속도를 보증하지 않는다. 기존 모델 예측과의 픽셀 차이도 JSON에 보존하지만, 모델 버전·영상 seek 및 예측 기준의 차이가 있으므로 어느 방식이 실제 손에 더 정확하다는 결론을 내릴 수 없다. 두 delegate는 이 격리 시험에서 정상 종료됐다.

[2D 결과](classic.json) · [3D 결과](3d.json) 및 같은 이름의 압축 원문을 보존한다. 2D 당시 실행 소스는 [classic-source](classic-source/), 3D 실행 소스는 frontend의 `e2e/fixtures/handDelegateProbe*`와 `scripts/test-hand-delegates-video.mjs`다. 초기 로딩 실패는 위에 남겨 둔다. 이 결과로 제품의 GPU 설정을 변경하거나, 실제 사용자 손 추적·전신/얼굴/손 동시 동작·간헐 종료 P2가 해결됐다고 표시하지 않는다.

최종 실행 소스에 대해 변경 파일 Biome·`node --check`·TypeScript·Vite production build·production guard가 통과했다([원문](check.log.gz)). `classic-source` 세 파일과 `classic.json`의 실행 전 SHA, 최종 세 파일과 `3d.json`의 실행 전 SHA가 각각 일치한다. 테스트 도구 추가 외에 제품 SDK 설정이나 화면은 변경하지 않았다.
