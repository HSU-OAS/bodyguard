# 신체 포즈 CPU/GPU 동일 프레임 비교

2026-11-09 · 테스트 전용 · 실제 사람 정답·실제 웹캠 검증 아님

## 목적과 방법

Worker 지연을 줄이는 CPU 우선 대안이 기존 GPU 우선 방식과 같은 관절 결과를 내는지 탐색한다. 이 시험은 두 모델 출력의 차이를 측정하며 **실제 자세 정답, 오판정률, 진단 또는 운동 안전성을 측정하지 않는다.**

[TensorFlow pose-detection 공개 스쿼트 영상](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/test_data/pose_squats.mp4) SHA-256 `ea9151e447b301985d5d65666551ef863b369a2e0f3a71ddd58abef2e722f96a`을 로컬 브라우저에서 디코딩했다. 720×1280, 5fps의 같은 65개 프레임을 각기 CPU/GPU로 초기화한 동일한 PoseLandmarker lite 모델에 전달했다. 각 프레임의 실행 순서는 번갈아 바꿨다. 모델과 실행 도구의 정확한 SHA는 [최종 결과](final.json)에 있다. 2D 값과 SDK world 값은 브라우저 안에서만 비교하고 집계만 저장했다. 입력 영상·관절 좌표는 저장소에 넣지 않는다.

이 시험은 동일 Worker에서 두 PoseLandmarker를 함께 생성하며 실제 코칭의 `VideoFrame` 대신 동일한 디코딩 프레임을 `ImageBitmap`으로 넣는다. 얼굴·손 SDK 및 실제 웹캠, 사용자 아바타, 권한 흐름은 시험하지 않는다. 두 delegate의 모델 출력은 모두 추정치이므로 차이가 작아도 두 결과가 실제 신체에 정확하다는 뜻은 아니다. 동작별 기준을 변경하지 않았다.

## 최종 실행

실제 Chrome 156의 한 로컬 실행에서 65프레임 중 64프레임에 양쪽이 각각 단일 신체의 33점을 반환했다. 나머지 한 프레임은 양쪽 단일 신체 조건을 만족하지 못했다. 두 모델의 2D 좌표 거리 2,112개에서 평균 약 3.63px, p95 약 7.45px, 최대 약 25.66px 차이가 났다. 어깨 좌우 128개에서는 평균 약 2.77px, p95 약 5.46px 차이가 났다. 원본 영상 픽셀 기준의 두 출력 간 차이이며 인체 오차·정확도·거짓 판정률이 아니다. 누락·가림 검증을 보장하지 않고, 별도 영역 요약의 양쪽 `visibility >= 0.5`는 SDK 점수 필터이지 실제 가시성의 정답이 아니다. world 수치는 모델 출력 단위로만 보관하며 실제 신체 길이로 해석하지 않는다.

각 단일 PoseLandmarker 호출 시간의 중앙값·p95는 CPU 약 38.8·41.1ms, GPU 약 18.4·29.8ms였다. 두 모델을 같은 Worker에서 동시에 생성한 단일 영상·단일 기기의 측정이며, 세 모델 전체 처리 시간·다른 장치 성능·실제 카메라 지연이나 CPU 사용의 우열을 보장하지 않는다. 두 task는 정상 정리됐고 카메라 호출·외부 요청·쓰기·페이지 오류는 0이었다([결과](final.json), [원문](final.log.gz)).

## 검증과 보존

- 실제 SDK/Chrome 비교를 개발 과정 중 여러 번 실행했다. [첫 결과](first.json), [두 번째](second.json), [부위별 결과](regions.json)는 각각 당시 source를 `first-source`, `second-source`, `regions-source`에 보존했고 SHA를 대조했다. [정리 오류 처리 보완 직전 결과](pre-cleanup-refinement.json)의 정확한 중간 source 사본은 보존하지 못해 SHA와 로그만 남긴다. [이전 최종 시도](final2.json)의 source는 `final2-source`에 있다. 마지막 실행에는 SDK JavaScript와 6개 WASM 파일, 모델의 SHA를 추가해 전후 변경 없음을 확인했다. [최종 결과](final.json)는 현재 `frontend/e2e/fixtures/poseDelegateProbe*` 및 `scripts/test-pose-delegates-video.mjs`의 SHA와 일치한다.
- 비교 도구의 부분 초기화 실패, 프레임 자원 해제 실패, task 종료 실패에서 자원 회수 시도와 실패 통지를 검사하는 단위 3개가 통과했다([로그](unit.log.gz)). 변경 파일 Biome, TypeScript, Vite build, production guard가 통과했다([Biome](biome.log.gz), [타입](tsc.log.gz), [빌드](build.log.gz), [guard](guard.log.gz)). 시험 전용 함수와 경로가 공개 번들로 섞이면 guard가 거부하도록 두 표식을 추가하고, 각각의 의도된 누출이 실패하는지 별도 임시 빌드에서 확인했다([함수 표식](guard-reject-function.log.gz), [경로 표식](guard-reject-route.log.gz)). 전체 회귀를 이 Story에서 재실행한 것은 아니다.
- 최초 증거 파일 복사 명령은 잘못된 작업 디렉터리 때문에 실패했다. 실행한 source를 서식 변경 전에 올바른 위치에 복사하고 결과 SHA와 대조했다. 또 첫 Biome 검사에서 서식 오류와 `finally`에서 throw하는 오류가 나와 안전하게 자원 해제를 시도하도록 보완한 뒤 실제 비교를 재실행했다. 최초의 명령 출력은 당시 터미널에만 남았다.

재실행은 로컬에서 모델 자산과 같은 원본 MP4를 준비한 뒤 frontend에서 `node scripts/test-pose-delegates-video.mjs <영상 경로> <새 결과 JSON 경로>`를 실행한다. 물리 카메라는 차단하고 외부 네트워크는 막는다. 이 도구는 제품 경로나 공개 코칭을 활성화하지 않으며, [기존 Worker 간헐 timeout](https://github.com/HSU-OAS/bodyguard/pull/189) 해결·다양한 실사용자 검증을 대체하지 않는다.
