# S2.T6 — 연속 아바타 재생·추론 대기·종료

상태: 비공개 구현·실제 통합 검증 통과 / runtime `7e8a396ec7ace466382a05cd8d5ad3f775f33b6c` / baseline `141328fa6f46f244c311b97cc524b6e782349fac` / `codex/owned-pose-playback`

FR-M-02/07·FR-A-01/03·FR-S-04·NFR-07/08. S2.T5의 새 영상→동일 추론→두 rig를 실제 deferred scheduler의 연속 렌더링에 연결한다. 현재 수동 read의 delta0 화면 검증은 연속 재생/부드러움의 증거가 아니었다.

## 수용 기준·하네스

1. 명시 context·이미 소유된 source/pair·scheduler·render callback만 받는다. 생성/중복 start만으로 카메라/SDK/프레임 획득0. 소유권 이전한 source/pair는 다른 playback에 재사용하지 않는다. camera/SDK/renderer는 caller 소유이고 playback dispose를 기다린 뒤 해제한다.
2. 명시 start 이후 예약1·pending inference1만 유지한다. deferred callback만 허용하고 시계·세대·원본 capture stamp를 바꾸지 않는다. RAF 원본 시각의 실제 delta를 rig에 전달한다.
3. SDK가 pending인 동안에도 렌더링/기존 관찰 만료가 계속된다. inference의 한 image/world 결과만 observe한다. 미검출/가림의 관찰을 정답으로 보정하거나 판정/시범을 생성하지 않는다.
4. 종료/abort/throw/late에서는 먼저 예약을 취소하고 source의 입력/결과 정리를 기다린 뒤 pair를 정리한다. 한 정리 실패 뒤 나머지 정리를 계속하고 고정 cleanup-error를 보존한다. 과거 callback/결과가 새 재생을 시작하지 않는다.
5. 최초 실패 unit·소유권/재진입/취소·늦은 결과·추론 대기/시계·정리 실패를 결정적으로 검증한다. 실제 Chrome/RAF/GLB의 합성 긍정 움직임과 실제 가짜 카메라/SDK 미검출 경로를 구분하고 아바타 canvas만 촬영한다.
6. 전체 frontend·타입/Biome/assets/build/공개 guard·공개 byte 동일·원본 실패/소스/증거 SHA·작성자 리뷰·최신 PR 조건을 실제 통과한다. 실제 노트북 fps/전력/장시간/사용자 정확도와 최종 외형 완료로 세지 않는다.

testing-strategy로 scheduling/소유권 unit, 실제 browser/GLB·SDK 통합, 실제 참여자/노트북 검증을 분리한다. graphify의 오래된 그래프에는 최신 source/pair/playback이 없어 현재 main 소스로 의존성을 확인했다. 제품 화면·SDK 정책·임계값·Blender/GLB·손/목/체간·운영은 변경하지 않는다. 디자인/SDK 승인·Docker/실측·D2-A/M/T/R/I/P 및 전체1~6 기준은 유지한다.

## 실행 결과

[작동 흐름·실제 화면·실패/미완료](../review/owned-pose-playback/README.md). runtime의 실제 Chrome/RAF·가짜 카메라/SDK/남녀 GLB 연속 재생·추론 대기·만료 결과 폐기/다음 프레임·종료, 별도 합성 긍정 보간/만료, 기존 native 전달 회귀4·unit22/전체883·정적/build/guard·공개 byte 동일을 통과했다. 작성자 P2 세 경계는 RED로 보완했다. guard fixture/collector 실패도 보존했다. 원본/외형/실측·SDK/디자인/운영·전체1~6 기준은 그대로이며 조건부 PR 게이트를 진행한다.
