# 모델별 지연·얼굴 수용·수명주기 확인

2026-11-11, CPU 우선 후보 `f8c4f9da`, 한 노트북의 실제 Chrome/Worker/SDK 시험. 제품 코드를 바꾸지 않고 개발 번들에 고정 단계와 호출 시간·결과 개수만 계측했다. 영상·좌표를 저장하거나 외부로 전송하지 않았다. 이는 실제 웹캠·사람 움직임 정확도·오판정 시험이 아니다.

## 모델별 지연과 얼굴 미검출 구분

[공개 TensorFlow pose_1 영상](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/test_data/pose_1.mp4)을 가상 카메라로 넣은 [45프레임](pose1.json)은 얼굴 SDK 자체의 결과가 0개였다. 같은 영상의 고정 상체 영역을 잘라 확대한 [45프레임](upper.json)도 얼굴 결과 0개였다. 원본·파생 파일 SHA와 변환 명령은 [입력 명세](inputs.json)에 있고 원본·파생 영상은 저장소에 넣지 않았다. 해당 두 입력에서 머리 방향을 전달하지 않는 이유는 방향 판독 이전의 미검출이며, 다른 영상·실제 사람에서도 같은 이유라고 일반화하지 않는다.

[MediaPipe 공식 테스트](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/face_landmarker_test.py)에서 사용하는 공개 `portrait.jpg`를 3초의 반복 정지 영상으로 만들어 [별도 45프레임](portrait.json)을 처리했다. 신체·얼굴·손이 45프레임 모두 검출되고 머리 방향도 45회 받아들여졌다. 모델별 호출 시간 중앙값/최대는 신체 약 45.8/541.6ms, 얼굴 18.3/69.2ms, 손 55.8/98.4ms였다. 이 원본은 움직이는 영상이 아니므로 얼굴·손 동작 추적의 정확도나 실제 반응속도를 보증하지 않는다. SDK가 검출한 신체나 손의 정확성이 정답과 대조된 것도 아니다. CPU 우선으로 설정된 실행이며 초기화의 fallback 여부는 이 계측으로 입증하지 않는다.

## 종료와 재시작

같은 공개 정지 입력으로 실제 SDK owner를 새 세대 1→2→3으로 각각 생성·15프레임 추론·종료했다([결과](restart.json)). 세 실행 모두 신체·머리 방향·손을 반환했고 Worker와 가상 카메라가 정리됐다. 이 시험은 owner의 재시작이며 화면의 일시정지 버튼 시험과 구별한다.

기존 어깨 코칭 화면과 GLB에 후보의 **실제 컴파일된 Worker**를 같은 출처로 주입해 별도 빈 가짜 카메라로 [UI a](ui-a.json)·[UI b](ui-b.json)를 시험했다. 시작→일시정지→새 준비/재개→불편으로 중단을 두 차례 실행했고, 각 실행의 두 Worker 세대가 clean ACK를 받고 종료됐다. 두 실행에서 관측한 메시지 프레임/결과는 각각 48/48과 45/45다. 정리 오류·페이지 오류·쓰기·외부 요청 0, source/bundle 전후 해시가 일치한다. 프런트는 `BODYGUARD-shoulder-cleanup-nov06`의 코칭 후보, Worker는 `BODYGUARD-sdk-lifecycle-isolation`의 현재 SDK 후보로, 단일 병합 제품 빌드의 시험은 아니다. 원본 모델 파일과 선택·판정값은 변경하지 않았다.

실행 source는 [모델 계측](stage-runner.mjs), [정지 영상](static-runner.mjs), [owner 재시작](restart-runner.mjs), [UI](ui-runner.mjs)로 보존했다. UI용 컴파일은 해당 후보의 `nativeInference.worker.ts`를 Vite `build`, `configFile:false`, `envDir:false`, `publicDir:false`, `write:false`, `minify:false`, lib `iife`로 빌드했다. 반환값 배열을 처리하지 못한 최초 빌드 도구는 출력 파일 생성 전에 실패했고, 배열을 처리해 다시 빌드한 SHA를 입력 명세와 UI 전후 snapshot에서 대조했다. 최초 도구 실패는 당시 터미널에만 남았으며 SDK 실패로 세지 않는다. UI runner는 이 별도 임시 번들과 기존 로컬 모델을 준비해야 재실행할 수 있다.

여러 사람·동작·조명·체형·기기와 실제 웹캠에서의 정확도 및 느린 프레임의 완전한 해결은 여전히 미검증이다. 현재 PR의 출시·병합 적격 판정을 바꾸지 않는다.
