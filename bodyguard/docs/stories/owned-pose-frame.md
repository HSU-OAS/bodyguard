# S2.T4 — 한 추론 결과의 소유 프레임 전달

상태: 비공개 구현·검증 통과 / runtime `682ea56cff27d6238702beea9467c925f7c65f1f` / baseline `d4d298780ab3ecb2356cb82ca6c2f76833342b48` / `codex/owned-pose-frame`

FR-M-02/07·FR-A-01/03·NFR-07/08. 준비된 입력의 원본 세대·순서·시각과 한 번의 pose 결과를 사용자 아바타에 전달한다. 공개 코칭/판정 출시 적격성이나 카메라 정확도를 확립하는 Story가 아니다.

## 수용 기준

1. 생성만으로 capture/SDK/카메라를 실행하지 않는다. 명시 capture와 detect 포트만 사용하며 borrowed 입력·detector는 호출자가 소유한다.
2. 한 read만 진행한다. 입력의 generation/sequence/at을 추론 전에 한 번 읽는다. 다른 세대·중복 순서·같거나 과거 시각은 추론하지 않는다. 새로운 시각으로 재포장하지 않는다.
3. 같은 SDK 결과의 image/world를 복사해 하나의 frame으로 반환한다. 인물 선택·배열 혼합·정답 보정0. 빈/복수 결과는 유지하고 기존 rig가 관찰을 보류한다. native 결과의 close는 정상/실패/늦은 반환에서 수행한다.
4. abort/dispose 뒤 결과 전달0. dispose는 진행 중 반환의 정리까지 기다린다. 예외는 고정 메시지로 제한하고 정리 실패는 ResourceCleanupError로 처리한다. 실패한 source는 자동 재개하지 않는다.
5. 합성 시험과 실제 SDK 시험을 구분한다. 실제 Chrome에서는 생성한 비개인 blank 입력만 실제 pose SDK에 넣는다. 기대 결과는 미검출·아바타 추적0이다. 긍정적인 아바타 움직임은 별도 합성 결과 시험이며 실제 사람 정확도를 뜻하지 않는다.
6. 실제 SDK 시험은 localhost·시험 전용 CSP/거부 proxy로 외부 통신을 차단한다. 기존 승인 대기 SDK 통신 정책은 제품에 적용하지 않는다. 카메라 실행·입력 화면 저장·좌표 로그/저장/전송0. 남녀 기존 GLB/원본은 변경하지 않는다.
7. 단위 경계·native SDK→GLB 전달·전체 frontend/정적/타입/assets/build/공개 guard·소스/증거·작성자 리뷰와 최신 PR 게이트를 통과한 경우만 조건부 병합한다. 실패/미실행을 보존한다.

testing-strategy로 합성/실제 native 범위를 분리하고 code-review로 순서·자원·재진입·늦은 반환을 확인한다. 공개 디자인·API/SQL·SDK/모델 버전·CI·운영 변경은 제외한다. 기존 D2-A/M/T/R/I/P·디자인/SDK 승인·Docker/참여자/운영 및 1~6단계 완료 기준을 유지한다.

## 실행 결과

[실제 흐름·미리보기·원본 실패·한계](../review/owned-pose-frame/README.md). 정확한 runtime에서18 단위/전체844 frontend·Chrome SDK/남녀 GLB·정적/타입/assets/build/guard를 통과했다. 실제 SDK 입력은 생성한 blank이며 긍정 동작은 합성이다. 기존 SDK 정책·모델·조형·공개 화면 변경0, 공개 JS/CSS byte 동일. 작성자 검토 후 조건부 PR 게이트를 진행한다. 실제 사람의 세밀한 자세 코칭/최종 외형·시범·출시 적격 동작·D2 이월/전체1~6 완료가 아니다.
