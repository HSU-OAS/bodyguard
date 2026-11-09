# S3.C5 네이티브 정리 분리 진단

2026-10-17 · [Draft PR #163](https://github.com/HSU-OAS/bodyguard/pull/163) · 최초 후보 커밋 `52c97937207be584e99ac4a0713ca3358e88210d` · **P2 미해결/병합 보류**.

## 확인한 것

제품의 SDK·카메라·판정·정리 구현/5초 제한은 바꾸지 않았다. 기존 native runner에 명시 `diagnostics` 옵션만 추가했다. 이 옵션은 시험 Vite에서 소유 자원의 dispose를 원래 메서드에 위임하며 성공/실패를 그대로 전달한다. 실제 Worker도 교체 SDK가 아니라 원래 Worker의 postMessage/terminate에 위임한다. 기본 실행은 이 계측을 사용하지 않는다. 자원 종류·고정 단계·시간·clean 여부·요청/결과 횟수만 최대120항목씩 수집하고, 메시지 payload/좌표/영상/예외 내용은 수집하지 않는다. 계측이 타이밍을 조금 바꿀 수 있으므로 당시 실패와 동일한 실행이었다고 주장하지 않는다.

| 실제 실행 | 결과 | 해석 |
|---|---|---|
| `diagnostic-a` 단독 | 2흐름 통과. 두 SDK 종료 ACK clean=true, 요청→ACK 659/675ms. source/avatars/inference/camera 모두 clean | 실제 Chrome/SDK/Worker/GLB + blank fake device. 실제 사람 정확도 아님. 최초 간헐 실패 해결 증거 아님. |
| `diagnostic-b`와 기존 생성 입력 `concurrent-browser-a` 동시 | native는 첫 흐름 통과 후 재개에서 inference-error로 실패. 생성 입력 UI 4흐름 통과 | native 두 세대의 source/avatars/inference/camera 해제와 SDK ACK는 모두 clean. 재개 추론 오류와 최초 cleanup-error를 같은 원인이라고 단정하지 않음. |
| `default-a` 계측 끔 | 2흐름 통과, cleanupDiagnostics=null | 기본 소유/시작/일시정지/재개/중단 회귀. 단독 통과로 간헐 실패를 종결하지 않음. |
| helper + 기존 Worker owner/runtime/native mock 회귀 | 4파일65검사 통과 | 동기/비동기 해제·원래 this/예외 보존·고정 필드·120항목 상한 포함. SDK mock 단위 검증을 실제 SDK로 세지 않음. |
| 전체 일반 회귀 | 127파일2088검사 통과 | 이전 어깨/목/계정/기록 등의 일반 회귀와 새4검사. |
| 타입·원래 production build/고지·후보 제외 guard | 통과 | 계측 marker도 공개 번들에 포함되지 않음. 공개 적격0 유지. |
| Biome·diff | 전체470파일 오류0/info17, 변경4코드파일 오류/info0, git diff --check 통과 | 기존 스타일 제안17은 해결했다고 표시하지 않음. |

최초 helper 시험은 `e2e/fixtures` 경로가 기존 Vitest include 밖이라 **no test files found**로 실패했다(원문은 터미널만 보존). 테스트를 기존 `src/pose` 아래로 옮겨 원래 include/전체 suite를 바꾸지 않고 실행했다. PR diff 확인도 Git의 한글 quoted path와 API UTF-8 경로를 혼동해 첫 대조가 실패했다. `git diff --name-only -z`로 고쳐 원격 전체183파일이 후보52c97937의 로컬 diff와 같음을 확인했다. 제품 게이트 성공으로 세지 않는 시험/검수 도구 실패다.

## 작성자 리뷰·다음 보완

code-review로 시험 전용 경계, 호출 receiver/예외·비동기 결과, 캡처/SDK 소유권, 제한 시간과 공개 번들 제외를 확인했다. 독립 리뷰/사람 검증 완료라고 주장하지 않는다. production guard에는 진단 marker 세 개도 금지했다. 기존 source44/artifact110의 묶음을 덮어쓰지 않고 이 진단의 소스·전후 SHA·성공/실패·그림을 별도 manifest에 보존한다.

**최초 native-a cleanup-error P2와 새 동시 실행 재개 inference-error는 미해결이다.** 다음 보완은 Worker의 응답 마감/프로토콜 실패 경로를 원시 입력 없는 고정 이벤트로 구분하는 것이다. 단독 통과·정리 성공만으로 추론 실패를 면제하지 않고, CPU/GPU·Vite/실행 부하 원인도 입증 전 확정하지 않는다. 새 임상 기본값/공개 코칭 활성화·Blender/GLB·운영 변경은 없고, 기존1~4/1~6·별도 승인 기준을 유지한다. 이 Draft를 병합하거나 Story/단계 완료로 표시하지 않는다.
