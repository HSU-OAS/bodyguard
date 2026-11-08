# 공개 동작 영상으로 실행한 로컬 Worker 검수

2026-11-09 · 시작 main `1893991d` · **동작·정확도 출시 검증 아님**

실제 참여자나 카메라 촬영 없이 Chrome의 가상 카메라에 공개 동작 영상 두 개를 주입해, 로컬 MediaPipe·Worker에서 전신 관절과 아바타용 팔다리 방향까지 데이터가 전달되는지 확인했다. 영상·얼굴·원시 관절 좌표는 저장소에 넣지 않고 입력 동영상 해시와 집계만 남긴다. 출력되는 방향 변화량은 테스트용 수치이며 관절 정확도·올바른 동작 기준·의학적 결과가 아니다.

## 영상 출처와 변환

- TensorFlow의 [pose_squats.mp4](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/test_data/pose_squats.mp4) 원본 SHA-256 `ea9151e447b301985d5d65666551ef863b369a2e0f3a71ddd58abef2e722f96a`. 해당 프로젝트 [테스트 코드](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/blazepose_tfjs/blazepose_test.ts)는 원본을 Pexels 영상에서 가져왔다고 설명한다. 720×1280, 5fps, 13초 영상을 ffmpeg로 360×640 Y4M으로 변환했고 Y4M SHA-256은 `1df697eccf5e050538de3a5720dae25d56ed62a4d118dbf94aa09f675aa6df53`이다.
- TensorFlow의 [pose_1.mp4](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/test_data/pose_1.mp4) 원본 SHA-256 `a581dd3c6495c4257a8f7756c6c59b445e8949eec0bc2637ba5283bfa7d71930`. 576×576, 30fps, 4초 영상을 10fps로 변환하고 비율을 보존해 360×640에 검은 여백을 채웠다. Y4M SHA-256은 `70dab96aef1936a4e764f4e89acc6b743c749de7a70a4336a469e4913f265beb`이다.
- 두 영상은 시험을 위한 임시 파일로만 사용했으며 저장소에 복사하거나 서비스 자산으로 채택하지 않았다. 런타임은 로컬 모델/WASM을 썼고 외부 요청과 쓰기는 모두 0이었다.

## 결과

| 시험 | 실제 결과 | 한계 |
| --- | --- | --- |
| [첫 영상 / 초기 검사](probe-first.json) | 45개 프레임 모두 전신·세계 좌표와 팔다리 방향 반환, 손 관찰 36개, 얼굴 방향 0개. 종료 정상. | 팔다리 방향의 시간 변화는 이 초기 runner에 포함되지 않았다. 당시 runner 사본은 없고 전후 해시만 남았다. |
| [첫 영상 / 방향 변화](probe-motion.json) | 45개 프레임에서 팔다리 방향과 시간 변화 반환, 손 관찰 32개, 얼굴 방향 0개. 종료 정상. | [당시 runner](probe-motion-runner.mjs). 1개 공개 영상이며 손 검출 횟수는 정확도를 뜻하지 않는다. |
| [첫 영상 / 정리된 runner](probe-final.json) | 동일 목적으로 재실행했다. 원문 집계는 JSON에 보존한다. | [당시 runner](probe-second-video-runner.mjs). |
| [첫 영상 / 최신 runner](probe-current.json) | 45프레임에서 전신·세계 좌표와 팔다리 방향을 반환했고 손 관찰 26개, 얼굴 방향 0개였다. 종료 정상. | 검수 후보 아바타는 연결하지 않았다. 최신 runner와 전후 파일 해시가 일치한다. |
| [두 번째 영상 / 초기 실패](probe-second-video.json) | Worker 정리 실패가 반환됐다. 당시 runner는 예외로 중간 집계를 반환하지 않아 초기화·추론·정리 중 최초 실패 위치를 알 수 없다. | CPU 부하가 높은 환경이었고 영상 자체가 원인이라고 결론 낼 수 없다. [당시 runner](probe-second-video-runner.mjs). |
| [두 번째 영상 / 진단 첫 시도](probe-diagnostic.json) | 페이지 진입이 30초 안에 끝나지 않아 Worker 시험 전에 중단됐다. | SDK 성공·실패로 세지 않는다. [당시 runner](probe-diagnostic-runner.mjs). |
| [두 번째 영상 / 진단 재시도](probe-diagnostic-retry.json) | 45프레임 모두 전신·세계 좌표와 팔다리 방향을 반환했고 종료됐다. 얼굴 방향과 손은 0개였다. | SDK에 고정 종료 로그를 삽입한 별도 실행이다. 이전 실패 해결이나 정확도 통과가 아니다. |
| [여성 후보 아바타 연결](probe-avatar.json) | 후보 아바타 준비 후 첫 추론이 실패해 움직임은 확인하지 못했다. 아바타·카메라 및 Worker 정리는 정상 반환됐다. | [당시 runner](probe-avatar-runner.mjs). 현재 원인 확정 불가. |
| [아바타 연결 / 진단 재시도](probe-avatar-diag.json) | 아바타 준비 전 SDK 초기화 응답이 기존 5초를 넘겼고, 이후 SDK 종료 확인도 기존 5초 안에 돌아오지 않았다. 카메라는 종료됐다. | 진단 Worker 로그는 첫 자원 `close` 시작만 기록됐고 어떤 SDK 자원인지 입증하지 못한다. 아바타 움직임 검증이나 SDK P2 해결이 아니다. |

각 같은 이름의 `.log.gz`는 실행 원문이다. 수정된 최신 runner는 `bodyguard/frontend/scripts/test-public-video-worker.mjs`와 `e2e/fixtures/`에 있다. `BODYGUARD_DIAGNOSTICS=1`은 시험 중에만 Worker에 고정 단계 로그를 삽입하고, `BODYGUARD_AVATAR=1`은 미승인 여성 아바타 후보를 연결한다. 어느 쪽도 제품 빌드나 판정값을 변경하지 않는다. 아바타 결합 실패 시험에선 미리보기가 생성되지 않았다.

SDK 간헐 종료 실패·아바타 외형과 성능·얼굴/손 및 실제 사용자 자세 정확도·전문가 검토는 미완료다. 이 시험으로 출시 동작을 활성화하지 않는다.

아바타 결합을 다시 시도한 [추가 진단](probe-avatar-retry.json)은 SDK 초기화 이후 첫 프레임 처리 중 `TypeError`로 중단됐다. 이때 카메라·아바타·Worker 정리는 정상 반환됐다. SDK 초기화 제한 시간 초과를 재현한 직전 실행과 구분하며, 첫 프레임 오류가 검수 도구와 제품 코드 중 어디에서 발생했는지 추가로 확인한다.

[후속 상세 진단](probe-avatar-stage.json)에서 첫 프레임 `TypeError`는 검수 도구가 main의 `ReferenceStage`가 제공하지 않는 `getObservationCoverage` 메서드를 호출했기 때문으로 확인됐다. **검수 도구 오류이며 제품 아바타 오류로 세지 않는다.** 당시 [runner](probe-avatar-stage-runner.mjs)와 원문을 보존한다. 그 전에 같은 도구의 아바타 없는 [프로토콜 시험](probe-protocol-check.json)도 별도로 보존한다. 앞선 SDK 초기화·종료 제한 시간 실패와는 다른 사건이다.

검수 도구의 잘못된 메서드 호출을 바로잡은 [여성 후보 연결 시험](probe-avatar-fixed.json)은 45프레임 중 44프레임에서 아바타 관절 커버리지를 확인했고 카메라·Worker·아바타 정리가 정상 반환됐다. 얼굴 방향은 0프레임, 손 관찰은 29프레임이다. [실제 후보 아바타 화면](probe-avatar-fixed.avatar.png)은 공개 스쿼트 영상을 왼쪽 아바타에 입력하고 오른쪽에는 별도 어깨 동작의 준비 화면을 둔 **개발 검수 장면**이며, 두 동작의 정확도 비교나 최종 외형이 아니다. 팔과 몸의 변형이 부자연스러워 보인다. 당시 시험 도구는 프레임 간격과 관계없이 렌더 delta에 16ms를 전달했으므로 실제 시간 간격을 쓰는 제품 루프와 차이가 있다. [당시 runner](probe-avatar-fixed-runner.mjs)와 원문을 보존하고 동일한 보간 조건의 재검증이 필요하다.

[실제 렌더 간격을 사용한 재시험](probe-avatar-delta.json)에서도 여성 후보 사용자 아바타의 관절 커버리지가 확인됐다. 그러나 [해당 실제 렌더](probe-avatar-delta.avatar.png)에서 사용자 아바타가 지나치게 기울어지고 일부 팔이 화면 밖으로 벗어나 보인다. 스쿼트 공개 영상을 입력한 장면이므로 오른쪽 준비 자세와 일치할 이유는 없으며, 이미지 하나만으로 추정 모델·카메라 관점·리깅 중 원인을 단정하지 않는다. 후보 외형·추적 품질은 미승인으로 유지한다. [당시 runner](probe-avatar-delta-runner.mjs).

공개 영상과 아바타가 같은 시점을 사용하도록 한 쌍을 캡처해 로컬에서 대조하고 영상 프레임은 저장소에 넣지 않았다. 테스트 중에만 아바타 스테이지에 계측을 삽입한 [몸통 방향 확인](probe-avatar-trunk.json)에서 한 프레임의 이미지 평면 몸통은 약 23.74°, 추정 3D 방향은 약 26.46°, 아바타의 두 척추 기준점 방향은 약 26.47°였다. 이 한 프레임에서는 몸통 방향 차이가 앞선 시각적 인상보다 작았다. 이 수치는 동작 안전 기준이나 전체 추적 정확도가 아니다. [실제 후보 렌더](probe-avatar-trunk.avatar.png)에서 사용자 팔이 화면 밖으로 잘리는 문제는 여전히 보이며 리깅·손·외형은 미승인이다. 계측 주입 [runner](probe-avatar-trunk-runner.mjs)를 보존한다.

[상반신 화면 축소 시험](probe-avatar-framing.json)은 제품 코드를 수정하지 않고 고정된 여유 폭을 늘리는 시험용 스테이지 변환만 적용했다. [렌더](probe-avatar-framing.avatar.png)에서 팔 잘림은 줄었으나 상반신이 지나치게 작아져 채택하지 않았다. [runner](probe-avatar-framing-runner.mjs). 실제 사용 화면의 선택 동작과 가로폭에 따라 팔이 보이면서도 두 아바타를 비교할 수 있는 구도를 따로 검토해야 한다.

[움직임에 따른 가로 여유 시험](probe-avatar-dynamic.json)은 시험용 스테이지에서 머리·팔꿈치·손목 뼈 위치를 기준으로 화면 배율을 조정했다. 제품에는 적용하지 않았다. [렌더](probe-avatar-dynamic.avatar.png)에서 이전보다 팔이 많이 보이지만 손끝이 화면 끝에 걸려 이 설정은 채택하지 않았다. [시험 runner](probe-avatar-dynamic-runner.mjs). 카메라 움직임의 부드러움과 크기 일관성도 아직 검증하지 않았다.

남성 후보에도 첫 영상을 입력한 [실행](probe-avatar-male.json)은 45프레임 중 44프레임에서 관절 커버리지를 확인하고 정리했다. [실제 렌더](probe-avatar-male.avatar.png)에서는 팔이 화면 밖으로 잘리고 어깨·몸통 표면이 부자연스러워 보인다. 한 장의 화면이나 관절 커버리지로 실제 추적 정확도·최종 품질을 보증하지 않는다. 같은 제품 후보 코드와 [일반 runner](../../../frontend/scripts/test-public-video-worker.mjs)를 사용했다.

가로 여유를 늘린 [추가 화면 시험](probe-avatar-margin.json)은 실제 제품을 바꾸지 않은 임시 계측이다. [처음](probe-avatar-margin.first.avatar.png)과 [이후](probe-avatar-margin.avatar.png)는 서로 다른 영상 시점이므로 기존 구도와의 같은 자세 비교가 아니다. [실행 runner](probe-avatar-margin-runner.mjs)를 보존하고 이 조건을 채택하거나 시각적 개선으로 결론내리지 않는다.

같은 렌더 시점에 상반신 고정 구도와 시험용 동적 구도를 비교한 [동일 자세 시험](probe-avatar-comparison.json)에서는 [고정 구도](probe-avatar-comparison.baseline.avatar.png)의 팔 잘림이 [동적 구도](probe-avatar-comparison.dynamic.avatar.png)에서는 해소됐다. 동적 구도는 아바타가 작아지며, 배율 전환이 부드러운지와 다른 자세·화면 크기는 검증하지 않았다. 이는 시험용 변환이며 제품에 채택된 기능이 아니다. [시험 runner](probe-avatar-comparison-runner.mjs).

검증 중 저장소 루트에서 실행한 Biome은 중첩 설정 오류로 시작하지 못해 frontend 디렉터리에서 다시 실행해 통과했다. 이 오류를 제품 테스트 실패나 통과로 세지 않는다.

상반신 구도 보완이 반영된 main `0382b8c8`을 통합한 뒤, 추가 변환 없이 현재 runner로 첫 공개 영상과 여성 후보를 다시 실행했다. [결과](probe-latest-main-avatar.json)는 45프레임 모두 아바타 관절 커버리지가 있었고, Worker·카메라·아바타가 정리됐다. 얼굴 방향은 0프레임, 손 관찰은 30프레임이다. [실제 후보 화면](probe-latest-main-avatar.avatar.png)은 공개 스쿼트 영상 입력과 별도 어깨 준비 시범을 보여 주는 검수 화면이며, 팔·어깨 변형이 여전히 부자연스럽고 정확한 사용자 추적이나 최종 외형을 뜻하지 않는다. 사용자 영상과 원시 좌표는 저장하지 않았다.
