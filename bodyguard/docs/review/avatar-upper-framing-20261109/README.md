# 상반신 비교 구도의 팔 잘림 보완

2026-11-09 · 시작 main `1893991d` · 아바타 후보 및 개발 검수 화면 전용

두 상반신 창은 같은 공간이지만 각자의 화면 영역에서 렌더링된다. 기존 고정 구도에서 팔을 뻗으면 화면 밖으로 잘리는 장면을 확인했다. 각 모델의 머리·팔꿈치·손목 위치에 필요한 여유를 두고, 양쪽 화면이 같은 배율을 사용하도록 구도를 넓힌다. 안전하게 보이도록 넓힐 때는 즉시 반영하고, 팔이 돌아오면 일정 시간에 걸쳐 확대한다. 이는 화면 구성만 바꾸며 사용자 자세가 정확하다는 보장은 아니다.

## 가로 방향 초기 시험

공개 [스쿼트 시험 영상](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/test_data/pose_squats.mp4)을 Chrome 가상 카메라로 입력했고, **동일한 아바타 자세**에 기존 구도와 가로 여유를 적용한 구도를 각각 렌더했다. 실제 사람의 라이브 웹캠이나 자세 판정은 아니다. 영상·원시 관절 좌표는 저장소에 넣지 않았다. 왼쪽은 사용자 후보, 오른쪽은 어깨 동작의 별도 준비 시범이어서 두 자세를 정답 비교할 수 없다.

- 여성 후보: [기존](probe-framing-product-female.baseline.avatar.png) · [가로 여유](probe-framing-product-female.dynamic.avatar.png) · [결과](probe-framing-product-female.json)
- 남성 후보: [기존](probe-framing-product-male.baseline.avatar.png) · [가로 여유](probe-framing-product-male.dynamic.avatar.png) · [결과](probe-framing-product-male.json)

두 시험의 기존/변경 이미지는 같은 렌더 직후에 촬영했으며 테스트 중에만 기존 구도 선택과 관절 계측 코드를 주입했다. 사용자 팔 잘림은 줄었으나 화면의 아바타가 작아지고 외형·리깅 문제는 여전히 남는다. 각 원문 로그와 [실행 runner](preliminary-runner.mjs), [당시 코드 diff](preliminary.patch)를 보존한다. 이 단계는 높이 방향까지 다룬 최종 수정이 아니다.

기존 시범 화면 전체 브라우저 검사 [초기 실행](reference-preliminary.json)은 여섯 동작의 렌더·화면 설정 등 다섯 흐름 뒤 마지막 단계에서 30초 시간 초과로 실패했다([원문](reference-preliminary.log.gz)). 전체 통과로 처리하지 않으며 실패 원인은 이 기록만으로 단정하지 않는다.

## 가로·세로 여유와 복귀 보완

가로뿐 아니라 화면 중심에서 위아래로 벗어난 머리·팔꿈치·손목에도 여유를 두고, 팔을 위로 드는 동작의 기본 세로 여유를 유지했다. 확장할 때 즉시 잘림을 방지하고, 축소 방향으로는 250ms 반감기로 돌아간다. 양쪽은 같은 배율을 사용한다. 전체·상세 보기는 이번 구도 조정 대상이 아니다.

변경 후 다시 같은 자세에서 비교한 [여성 기존](probe-framing-final-female.baseline.avatar.png) · [여성 변경](probe-framing-final-female.dynamic.avatar.png) · [남성 기존](probe-framing-final-male.baseline.avatar.png) · [남성 변경](probe-framing-final-male.dynamic.avatar.png)을 보존한다. [여성 집계](probe-framing-final-female.json), [남성 집계](probe-framing-final-male.json)는 각각 45프레임의 공개 녹화 영상과 실제 후보 GLB를 사용한 1회 시험이다. 두 시험 모두 Worker·카메라·아바타 정리가 완료됐다. 모델 구동 검수이며 인체 추적 정확도, 관절의 안전성 또는 최종 외형 합격이 아니다. [실행 runner](final-runner.mjs)는 테스트 중 기존 구도 선택과 관절 계측만 주입했다. 비교 이미지에 카메라 원본은 포함되지 않았다.

변경 후 기본 제한 시간과 `--maxWorkers=2`로 전체 Vitest 130파일·2,180개 통과, 변경 파일 Biome·TypeScript·Vite build·production guard 통과. [전체 로그](full-final.log.gz) · [빌드 로그](build-final.log.gz). 첫 브라우저 재검증 묶음의 셸 명령은 여성 시험 후 zsh의 읽기 전용 `status` 변수에 대입해 중단됐고, 남성 시험은 별도로 다시 실행했다. 그 셸 오류의 원문은 당시 터미널에만 남았다.

SDK 초기화·종료의 간헐 실패, 실제 사람·물리 웹캠의 추적 및 손·얼굴 정확도, 후보 모델의 표면과 변형은 이번 화면 수정으로 해결되지 않는다. 동작별 판정과 출시 자격도 미완료다.

최종 코드의 기존 시범 검사도 같은 마지막 단계에서 30초 시간 초과로 실패했다([결과](reference-final-failed.json) · [원문](reference-final-failed.log.gz)). [상세 진단](reference-detail.json)에서는 테스트가 더 이상 쓰지 않는 로그인 제목 `다시 만나 반갑습니다`를 기다리는 것으로 확인됐다. 현재 계정 화면은 `로그인` 제목을 사용한다. 진단 runner는 오류 화면 캡처 시 블록 밖 `page`를 참조해 추가 `ReferenceError`가 발생했으며, 실패 JSON은 그 이전에 확정되어 남았다([진단 원문](reference-detail.log.gz) · [runner](reference-detail-runner.mjs)). 기존 결과를 지우지 않고 테스트의 현재 제목을 반영해 다시 확인한다.

현재 로그인 제목을 사용하는 검사로 수정한 뒤 [최종 시범 화면 브라우저 검사](reference-fixed.json)는 6개 흐름 모두 통과했다([원문](reference-fixed.log.gz)). 실제 남녀 후보·목/어깨/팔 위로 뻗기 시범과 800px 레이아웃, WebGL 손실 및 손상된 GLB 복구, 화면 숨김과 401 이후 비공개 캔버스 정리를 포함한다. 카메라·실제 사람은 사용하지 않았다. 앞선 두 번의 타임아웃과 상세 진단 오류는 위에 그대로 남긴다.
