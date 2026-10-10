# 코칭 동시 준비 후보 — 성능 게이트 미통과

2026-10-11 · [S6.26](../../stories/parallel-native-preparation.md) · base `32e18a01c15e89ae4e321d372165abed29b0f506`.

**미완료·미채택이다.** 기존 main/공개 화면은 바꾸지 않는다. 준비·취소의 실제 작동 근거는 얻었지만 성능 채택 기준을 통과하지 못했다. 후보와 실패를 Draft 대상으로 보존하며 전체 코칭 시작 지연을 해결했다고 보고하지 않는다.

## 후보에서 구현한 것

같은 몸·얼굴·손 모델/옵션의 GPU 준비를 함께 시작한다. GPU 소유자들이 전부 settle한 뒤 실패 항목의 CPU 복구를 순차 수행한다. 부분 실패·늦은 성공·abort에서도 기존 reverse-acquisition 정리와 cleanup 실패를 유지한다. false인 기능은 생성하지 않으며, 추론·한 프레임/한 in-flight·body/head/hands 복사·판정 조건은 변경0이다.

설치 SDK의 loader가 Worker 전역 ModuleFactory/Module을 사용하는 것을 직접 읽었다. 혼합 GPU/CPU factory 겹침을 피하는 barrier를 추가했다. 이는 실제 SDK 내부 corruption을 관찰했다는 뜻이 아니며 SDK private 필드 변경·패키지 교체·개인정보 정책 승인이 아니다. 기능/모델 축소·warmup·timeout 확대0이다.

## 실제 최종 대조와 실패

Chrome155.0.8059.40·현재 설치 SDK·lite body+face+hands·빈 합성640×480 VideoFrame·고정 ABBA다. 각 조건마다 새로운 Chrome 프로세스/임시 프로필을 사용했다. GPU 우선 요청은 같지만 최종 실제 delegate를 관측하지 않아 GPU 동일성을 주장하지 않는다. 단일 노트북·빈 입력이고 사람/물리 웹캠/양성 검출·임상 정확도 시험이 아니다.

| 순서 | 경로 | 준비 ms | 첫 추론 ms | 준비+첫 추론 ms |
| --- | --- | ---: | ---: | ---: |
| 1 | 기존 | 643.2 | 1245.0 | 1888.2 |
| 2 | 최종 후보 | 434.5 | 1029.4 | 1463.9 |
| 3 | 최종 후보 | 688.5 | 1427.5 | 2116.0 |
| 4 | 기존 | 527.2 | 2148.5 | 2675.7 |

[최종 원문](comparison-final.json): 기술4건은 통과했으나 두 번째 쌍의 준비688.5ms가527.2ms보다 느려 **성능 게이트 실패·exit1**이다. 합계 감소만으로 준비 regression을 없던 것으로 하지 않는다. 합계는 두 기술 구간의 덧셈이며 카메라/아바타/화면/권한/첫 유효 동작까지의 전체 시작 시간은 아니다. 정상 실행이나 이전 PR90의 필수26건/13실패를 이것으로 대체하지 않는다.

첫 [같은 프로세스·fresh context 대조](comparison-first.json)도 성능 조건이 실패했다. 이후 프로세스 공유 영향을 분리한 [중간 콜드 대조](comparison-cold-fixed.json)는 통과했지만 **CPU barrier 이전 bundle**이다. 좋은 중간 결과를 현재 source 통과로 세지 않는다. 최종 raw 결과의 RAF/예약 click과 생성·close3/Worker1·terminate1은 기술 관측이며 실제 사용자 클릭·15fps/피드백1초 기준의 증거가 아니다.

## 실제 준비 취소

[최종 취소 원문](comparison-cancel-final.json): SDK gesture 모델 응답을 시험 서버에서 보류했다. preparing 상태에서 명시 close한 뒤 응답을 해제했으며 준비 Promise는 reject되고 ready/추론/기록0, clean 종료 및 Worker1/terminate1을 확인했다. 입력 프레임0이다. 합성 네트워크 장벽이지 native hang/물리 카메라 실패를 재현한 것이 아니다. 보고서의 `preparePlusFirstMs: 0`은 null+null의 표시 산술이며 **측정된0ms가 아니다**. 준비/첫 추론 시각은 둘 다 null이고 이 필드를 성능 판단에 쓰지 않는다.

native task별 close 호출 수는 이 브라우저 하네스에서 따로 계수하지 않았다. Worker의 clean acknowledgment/종료와 단위 시험의 각 task close1회는 서로 다른 증거다. 모든 시험의 카메라·로컬 계정 API/GLB·아바타 실행0, 남은 storage key0, pageerror0을 확인했다. 일시적인 모든 저장소 쓰기를 계수한 것은 아니다. 차단 proxy가 받은 외부 연결 시도는0이 아니며 각 raw의 proxyAttempts를 유지한다. 차단 시험 정책을 제품 SDK 정책 승인으로 세지 않는다.

## 로컬 검사·실패 보존

- 순차 구현의 새 병렬 계약1실패/기존8통과, 첫 후보의 혼합 fallback 계약1실패/13통과를 보존했다. barrier 이후 새 하네스가 CPU 재시도를 barrier 이전에 기대해1실패/141통과였다. body가 늦게 끝난 뒤 CPU retry2회가 완료되는 assertion을 추가해 기존 실패/회수 조건을 그대로 확인했다.
- 첫 TypeScript는 테스트의 Promise.withResolvers가 기존 target lib에 없어 실패했다. lib/dependency를 바꾸지 않고 Promise 기반 deferred 하네스로 수정했다.
- 첫 fresh-browser 하네스는 proxy CONNECT 소켓의 ECONNRESET을 처리하지 못해 **exit1/보고서 없음**이었다. 원문은 대화 도구 출력에 있고 별도 original stderr 파일은 없다. 이후 시험 소켓 종료 이벤트를 처리한 별도 source와 새 결과를 사용했다. SDK/성능 assertion을 바꿔 성공으로 만든 것이 아니다. 당시 Node/Chrome이 남지 않았음을 ps로 확인했다.
- 최종 실제 명령: 관련4파일142, 전체78파일1606, `pnpm typecheck`, 범위 Biome2파일, 새 scratch outDir 직접 Vite production build, production 개발 제외, 하네스 문법/문서 링크/diff. `pnpm assets`·전체 `pnpm build`·backend/SQL·아바타/GLB·Docker/TLS는 실행하지 않았다.
- 공개 JS/CSS는 PR123 결과와 SHA/byte가 같다. 기존 화면/본문/구조·public route·auth/API·SDK 공개 정책·lock/CI·운영 변경0이다. 브라우저/loopback 서버/proxy는 종료했으며 실제 남은 owned 프로세스0을 확인했다.

원본 로그·baseline/intermediate/final probe bundle·소스·실패는 `/private/tmp/bodyguard-parallel-preparation.iTBTUe`와 `/private/tmp/bodyguard-inference-thread.gwGYH6`, `.Mg9tCU`, `.7m3XLI`에 보존했다. [source/log/public SHA와 미실행](evidence.json). baseline TS는 실행 전 복사했고 최종 candidate bundle도 실행 전에 별도 output으로 보존했다. 현재 최종 TS의 hash는 실행 후 기록이며 실행 전 hash라고 부르지 않는다.

## 재현과 작성자 검토

[비교 source](comparison.mjs)·[취소 source](cancellation.mjs)는 기존 frontend 설치와 별도 baseline/candidate probe output을 사용한다. 원래 `e2e/fixtures/inferenceThread.vite.ts`로 새 `/private/tmp/bodyguard-inference-thread.새ID/probe`를 빌드한다. 결과도 새 `/private/tmp/bodyguard-parallel-preparation.새ID/comparison-새이름.json`이어야 하며 기존 결과 덮어쓰기는 거절한다. 이 경로 예시는 실행한 명령이나 존재하는 파일이라고 주장하지 않는다.

`engineering:debug`로 실제 순차/혼합 fallback·scope·콜드 조건을 분리했고 `engineering:code-review`로 source/diff와 소유권·옵션·abort·성능·정적 공개 경계를 검토했다. 코드 기능/회수 시험은 통과했지만 **성능 P2/채택 기준이 미해결**이므로 Draft이며 병합 승인을 사용하지 않는다. 작성자 리뷰이지 독립 리뷰어 승인이나 단계 완료가 아니다. 최신 원격 diff/head/main/CLEAN/체크는 PR 생성 후 다시 확인하고 체크가 없으면 없다고 명시한다.

아바타 보류·출시 적격 동작0·미승인 공개 코칭/SDK 통신 정책·실측/참여자·기존 시작P2·SMTP/Google/Docker/HTTPS/법무/운영·전체1~6의 조건은 그대로 남는다. 후속은 실패 원인을 바꾸는 구현/분리 근거를 확보하는 것이지 동일 정상 시험을 반복해 성공만 고르는 방식이 아니다.
