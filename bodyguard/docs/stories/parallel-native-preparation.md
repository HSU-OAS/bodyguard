# S6.26 — 몸·얼굴·손 추론 엔진의 동시 준비

기준 main `32e18a01c15e89ae4e321d372165abed29b0f506` · `codex/parallel-native-preparation` · FR-M-02/07·FR-A-03·NFR-01/02/07/08.

## 구현 전 계약

비공개 Worker의 SDK 생성이 몸→얼굴→손 순차다. 기존 첫 실행 지연과 PR90/91/101 실패는 보존한다. 동시 생성으로 **준비부터 첫 결과까지**의 대기가 줄어드는지 실제 동일 SDK/모델의 대조로 확인한다. 비용을 warmup으로 옮기거나 timeout을 늘리는 작업이 아니다. 효과가 입증되지 않거나 SDK 정합/취소·회수 문제가 있으면 후보를 채택하지 않는다.

1. 모델·GPU 우선/CPU fallback·VIDEO/옵션·동일 입력·출력·하나의 in-flight·generation·관절 대응을 유지한다. 몸·얼굴·손 기능을 줄이거나 판정 임계값/성공 조건을 바꾸지 않는다. 공개 UI/통신·SDK 내부 속성·의존성·아바타/GLB/운영 변경0.
2. 먼저 순차 대기의 결정적인 실패를 보존한다. 모든 준비 Promise가 settle한 뒤에만 성공/실패를 반환한다. 일부 실패·늦은 성공·abort에서 생성된 자원을 모두 회수하고 cleanup 실패를 숨기지 않는다. 명시적 옵션 false인 SDK는 생성하지 않는다.
3. baseline과 후보를 별도 production probe 출력으로 보존한다. 실제 Chrome·기존 SDK·합성 blank640×480 frame·fresh context에서 고정 baseline→candidate→candidate→baseline 비교한다. 준비/첫 결과/합계·후속 처리·RAF/예약 클릭·생성/종료를 구분한다. 사람·물리 카메라·3D·임상 정확도·전체 코칭 성능 시험이 아니다.
4. 모델/wasm/bundle/source SHA·실패·미실행을 구분하고 카메라·API·storage·GLB 없이 loopback에서 시험한다. 전용 차단 proxy/CSP는 시험 정책일 뿐 제품 SDK 개인정보 정책 승인으로 세지 않는다. owned browser/server/proxy를 종료한다.
5. related·전체frontend·타입/범위 정적·production build/개발 제외·diff·작성자 범위 리뷰·최신 PR/head/base/CLEAN/체크를 확인한다. 채택 조건 미충족은 실패/보류로 남기고 사전 merge 승인 게이트를 우회하지 않는다.

구현 중 설치 SDK가 Worker 전역 ModuleFactory/Module을 사용하는 것을 확인했다. GPU 준비는 함께 시작하되 전부 settle한 뒤 실패한 항목의 CPU 복구를 순차로 수행한다. 혼합 재시도 겹침을 결정적인 RED로 확인하고 barrier를 보완한다. 이는 실제 SDK corruption을 재현했다는 뜻이 아니며 내부 비공개 속성을 수정하지 않는다.

`engineering:debug`의 재현/범위 분리와 `engineering:code-review`의 보안·성능·race/cleanup 검토를 적용한다. [공식 Pose 웹 가이드](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)는 task 생성 API와 동기 추론/Worker 경계를 설명하지만 동시 생성의 로컬 성능/안전성을 보증하지 않는다. 이는 실제 시험으로 결정한다.

## 별도 미완료

아바타 보류·미승인 코칭 화면/SDK 제품 통신 정책·출시 적격 동작0·실측/참여자·PR90 원래 필수26건과 전체 시작P2·15fps/피드백1초/정확도80%·외부 계정/메일·Docker/TLS/법무/운영·전체1~6 완료 기준을 그대로 유지한다. 기존 실패·원본을 보존하고 새로운 아바타 제작/검증 사이클은 시작하지 않는다.

## 현재 결과 — 미완료·미채택

최종 후보는 GPU 병렬 준비/CPU 복구 barrier·부분 실패와 abort의 settle/회수·옵션별 기능을 구현했다. 실제 최종 SDK4건과 모델 응답을 보류한 준비 취소1건, 관련142·전체frontend1606·타입/정적/build/개발 제외는 통과했다. 그러나 최종 성능 게이트는 **실패**했다. 첫 추론까지의 합계는 두 쌍 모두 줄었지만, 두 번째 준비 시간은 후보688.5ms/기존527.2ms로 느렸다. 먼저 정한 ‘각 쌍에서 준비와 준비+첫 추론 모두 개선’ 조건을 낮추거나 좋은 중간 결과로 대체하지 않는다.

후보는 Draft PR124에 보존하며 main 병합·제품 채택을 하지 않는다. [원문·실패·검증 경계·작성자 리뷰](../review/parallel-native-preparation/README.md). S6.26 및 전체 시작P2/1~6은 미완료다.

2026-10-11 공용 factory 계측을 추가한 별도 bundle의 ABBA4건에서는 GPU 요청12건 모두 fulfilled/각 close1회, CPU 재시도0이었다. 후보의 각 factory duration은 길어졌고 마지막 쌍의 준비 차이는0.4ms였다. 기존 실패 원인 확정이나 실제 GPU kernel 입증이 아니며 계측 bundle의 좋은 결과로 원래 성능 실패를 대체하지 않는다. **현재 후보는 보류하고 동일 반복 시험/같은 후보 수정 사이클을 추가 시작하지 않는다.** 다른 원인 근거나 접근이 있을 때만 재검토한다. 독립 웹의 필수 사용자 흐름과 통합을 우선하며 아바타 보류·미승인 UI/SDK·실측/운영 및 기존 전체 게이트는 유지한다.
