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
