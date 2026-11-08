# 2026-11-09 최신 main 통합 재검증

PR #163을 기존 최신 main `d9b0fa93` 및 가중치 최적화 병합 `c913a4d3`에 차례로 통합했다. 기존 문서와 공개 산출물 제외 검사의 양쪽 내용을 유지했다. 최종 통합 후 기본 제한 시간과 `--maxWorkers=2`로 전체 131개 파일, 2,185개 테스트가 통과했다. 변경 범위 Biome, TypeScript, Vite production build, production guard도 통과했다. [전체 테스트 원문](full.log.gz) · [빌드 원문](build.log.gz).

`c913a4d3`을 통합하기 **전** `fecb6369` 상태의 실제 Chrome 156, 빈 가짜 카메라, 실제 Worker/MediaPipe/모델 및 후보 GLB로 어깨 후보의 시작·일시정지·재개·중단을 1회 실행했다. 두 Worker가 종료 확인을 보냈고 57개 요청과 결과가 기록됐으며 외부 요청·쓰기·페이지 오류는 0이었다. SDK Worker에 종료 단계 기록을 추가한 시험이다. [결과](native.json) · [실행 로그](native.log.gz). 실제 사람·웹캠·자세나 손 정확도 검증은 아니다.

이 단독 성공은 이전의 간헐적인 Worker 정리 실패를 해결하거나 원인을 밝힌 증거가 아니다. 따라서 기존 P2는 미해결로 유지하고 PR을 Draft로 둔다. MediaPipe의 별도 [손 인식 close 멈춤 제보](https://github.com/google-ai-edge/mediapipe/issues/5718)는 다른 버전의 사례로, 활동 부족으로 닫혔으며 이번 오류의 동일 원인이나 해결 증거가 아니다.

같은 날 `c913a4d3` 통합 뒤 `b0ae809b`에서도 같은 방식으로 한 차례 더 실행해 시작·일시정지·재개·중단이 통과했다. 요청/결과 각 58개, 외부 요청·쓰기·페이지 오류 0이다. [최신 통합 실행 결과](native-latest.json) · [원문 로그](native-latest.log.gz). 이 시험도 빈 가짜 카메라이며, 이전의 종료 실패 해결이나 실제 사람 추적 정확도를 입증하지 않는다.

같은 통합 코드 `f085028c`에서 별도 Blender 후보 작업과 겹친 상태로 세 차례를 순차 재실행했고 시작·일시정지·재개·중단이 모두 통과했다. 각 실행의 입력/결과는 42/42, 54/54, 55/55이며 외부 요청·쓰기·페이지 오류는 0이다. [1차](stress-one.json) · [2차](stress-two.json) · [3차](stress-three.json) 및 같은 이름의 압축 로그를 보존한다. 동일한 노트북과 빈 가짜 카메라의 소수 재실행이므로 이전에 재현된 간헐 실패의 원인이나 수정은 입증하지 못한다.

최신 main `0382b8c8`의 상반신 구도 보완을 어깨 후보에 통합한 뒤 전체 132파일·2,196개 테스트 및 변경 범위 Biome·TypeScript·Vite build·production guard가 통과했다([전체](with-upper-full.log.gz) · [빌드](with-upper-build.log.gz)). 실제 Worker/SDK·빈 가짜 카메라의 시작·일시정지·재개·중단도 다시 한 번 통과했다([결과](native-upper.json) · [로그](native-upper.log.gz)). 가짜 카메라 시험이며 이전에 별도로 재현된 간헐 SDK 종료 실패와 실제 사람 추적 정확도는 해결되지 않았다.

공개 손 영상 검수 도구를 추가한 최신 main `4e93cdf6`을 통합했다. 이 통합은 손 검수 fixture·스크립트와 증거를 추가하며 기존 제품 실행 코드는 바꾸지 않는다. 통합 상태의 Worker·어깨 판정·상반신 구도 관련 3파일/69개 검사는 통과했다([원문](with-hand-target.log.gz)). 전체 조합의 TypeScript 검사는 다른 프로세스의 부하가 높은 상황에서 7분 이상 완료되지 않아 직접 종료했다(exit 143, [출력](with-hand-typecheck-interrupted.log.gz)). 따라서 이 조합의 타입 검사를 통과했다고 표시하지 않는다. 이전 `0382b8c8` 조합의 전체 132파일/2,196개·타입 검사와 손 검수 도구 단독 main의 타입 검사는 각각 통과했으나, 새 조합의 타입 재검증을 대체하지 않는다. SDK 종료 P2·사람 대상 검증과 Draft 상태는 그대로다.
