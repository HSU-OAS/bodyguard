# 코칭 추론 스레드 분리 — 실제 결과

2026-10-10 · [S6.25](../../stories/coaching-inference-thread.md) · 기준 main `a53ff75addbdccf07678594970f850b2a3c5ad89`.

## 바뀐 동작

비공개 코칭 adapter에서 thread를 생략하면 기존 Worker를 사용한다. 동기 main은 명시한 개발·비교 경로로 남는다. Worker 준비 실패를 main으로 숨겨 전환하지 않으며 기존 오류/정리 경계를 유지한다. 모델·동작 판정·준비 timeout·warmup 기본값·SDK 옵션은 그대로다. 공개 코칭 화면을 연결하거나 승인되지 않은 화면을 추가하지 않았다.

실제 Chrome155와 현재 설치된 SDK로 body+face+hands를 처리했다. 입력은 생성한 빈 640×480 VideoFrame이며 사람·물리 카메라·자세 정확도 시험이 아니다. fresh context, 고정 main→Worker→Worker→main, 같은 bundle/model, GPU 우선 요청을 비교했다. main의 실제 delegate는 GPU 세 개였고 Worker의 최종 delegate는 관측하지 않았다. GPU 요청이 같다는 것을 실제 delegate 동일성으로 주장하지 않는다.

## 화면 응답과 추론 시간은 별개

아래는 5초 기술 대기를 적용한 마지막 실제 실행이다. click은 25ms timer가 발생시킨 DOM 이벤트이며 실제 사람의 클릭이 아니다.

| 순서 | 경로 | 준비 ms | 첫 추론 ms | 최대 RAF 공백 ms | 예약 click 지연 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | main | 406.5 | 908.6 | 900.0 | 889.8 |
| 2 | Worker | 805.4 | 2092.8 | 16.8 | 1.9 |
| 3 | Worker | 636.4 | 1846.9 | 16.8 | 0.7 |
| 4 | main | 1204.5 | 2224.3 | 2216.6 | 2206.0 |

Worker의 첫 추론도 약1.8~2.1초 걸렸지만 그동안 화면 갱신/버튼 이벤트를 막지 않았다. **추론 자체·전체 시작 시간이 빨라졌다고 주장하지 않는다.** 앞선 정상 비교에서도 main RAF1033.4~1200ms/Worker16.8ms였다. 단일 장치·빈 입력의 대조이며 성능 SLA·실제 코칭 15fps/1초 피드백 검증은 아니다. [원문](evidence/final-bounded-abba.json), [앞선 정상 대조](evidence/verified-abba.json).

각 조건에서 외부 입력 frame3개를 생성·close3회, Worker 조건에서 생성1/terminate1을 확인했다. 같은 in-flight 동안 추가 detect는 거절됐고 기존 native dispose acknowledgment로 종료됐다. Worker 내부 clone의 close 횟수는 이 브라우저 instrument로 계수하지 않았으며 관련 unit의 소유/정리 검증과 구분한다. 카메라 요청/저장소 key/API·GLB·아바타 렌더링0, pageerror0. 전용 테스트 CSP·차단 proxy를 사용했다. proxy가 거절한 연결26개를 외부 시도0으로 표현하지 않으며 제품 SDK 정책 승인으로 세지 않는다.

## 실패와 최종 검사

- 최초 probe typecheck의 close 반환 타입 오류는 도구 출력에 보존됐다. 별도 원본 로그 파일은 없다. 첫 비교는 proxy 우회 규칙 순서로 로컬 서버조차 못 읽어 SDK 실행0이었다. [실패](evidence/baseline-abba.json).
- 연결을 수정한 대조는 실제 SDK4건을 실행했지만 검사식 `/api/`가 `mediapipe`를 API로 오인해 전체 실패했다. [원본](evidence/corrected-abba.json). 해당 검사식만 바로잡은 정상4건과 작성자 리뷰의 5초 liveness 보완 후4건은 각각 통과했다. 실패 결과를 지우거나 자동 retry로 합산하지 않았다.
- 기본Worker 계약을 먼저 추가해 기존 adapter에서3건 RED/93건 통과를 확인했다. defaultWorker·명시main·준비 실패의 무자동fallback을 구현한 뒤 관련4파일136건을 통과했다.
- 첫 전체 회귀는 기존 `MeasureDemoPage` 한 건이 기존5000ms를 넘겨1579통과/1실패했다. 동시 정적 검사 중 실행됐으나 그것만으로 원인을 확정하지 않는다. 실패를 보존했고 정적 검사 종료 후 worker4개·동일 assertion/timeout으로 **전체78파일1580건**을 통과했다. timeout 확대·시험 삭제·제품 코드로 실패를 숨기는 변경은 없다.
- typecheck, Biome317파일(기존 info16), production build/비공개 노출 guard, `git diff --check`를 실행했다. 마지막 driver 수정은 별도 Biome으로 확인했다. backend/API/schema 변경이 없어 서버/SQL 시험은 이번에 재실행하지 않았다. 기존3D/native 계정 하네스는 main 경로를 명시해 기존 계약을 보존했지만 아바타 보류 지시에 따라 실행하지 않았다.
- 현재 공개 JS SHA `02d884c79530bccad9041e08946ea6a82576da436c241fcca5e2d92aa416c092`, CSS SHA `043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e`를 PR120의 보존된 압축 원본과 byte 비교했다. 둘 다 같다. 아바타 원본·GLB·얼굴/목 외형·공개 UI·개인정보 정책·운영 변경0이다.

최초 실행 전 probe bundle/소스·driver를 `/private/tmp/bodyguard-inference-thread.V9TsDk`에 복사했다. 마지막 driver도 실행 전에 별도로 보존했다. 중간 driver별 별도 원본은 없으며 수정 과정은 Git/도구 출력과 위 실패를 구분한다. 저장된 보고서의 bundle/worker/SDK/model SHA와 현재 lock으로 입력을 확인할 수 있다. 새 원본 영상·좌표·credentials·console 원문은 보존하지 않는다.

## 작성자 scoped 리뷰

시험 로그의 원래 공백·끝줄을 수정하지 않고 lossless gzip으로 저장했다. 압축 해제로 원본 byte를 복원할 수 있으며 임시 폴더의 원본도 보존했다.

`debug`로 동기 추론→UI 공백을 실제 대조했고 `code-review`의 보안·성능·정확성·유지보수 관점으로 변경 파일을 확인했다. 새 권한/외부 데이터/SDK 내부 hack 없음, generation·abort·한 in-flight·정리 오류/명시 복구 유지, main 회귀의 모드 고정과 생략 모드의 독립 RED/GREEN을 확인했다. 새 시험 driver의 무기한 evaluate 대기는 기존5초 경계로 보완하고 실제 재실행했다. 이 Story 범위의 미해결 P1/P2 없음이며 독립 리뷰어의 승인이라고 주장하지 않는다. 최종 원격 diff/head/main/충돌/체크는 병합 직전 별도로 다시 확인한다.

PR90/91/101의 원래 필수26건·시작 P2, 실제 사람 정확도/대표 동작·출시 적격 동작0·최종 아바타·미승인 화면/SDK·Docker/TLS/외부/법무/운영 및 **전체1~6 미완료**는 유지한다. 이 개선을 완료된 공개 코칭이나 출시 후보판으로 발표하지 않는다.
