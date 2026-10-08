# S6.13 native 시작·화면 경합 조사

비공개 native 자원의 준비→두 원본 GLB 렌더→관찰→종료를 실제 Chrome에서 비교했다. 카메라는 가짜이며 계정/API/실제 사람·자세 판정·출시 검증은 아니다. [Story](../../stories/native-main-thread-contention.md).

## 실제로 확인한 것

같은 lite/얼굴/손 모델과 A37 남녀 원본, 640×480 카메라 설정을 사용했다. normal/4× CDP CPU 조건·main/기존 Worker의 교차8개 순서를 실행 전 고정했다. 각 context는 새로 만들고 retries0이다. CDP가 Worker/OS/실제 저사양 노트북에 동일한 CPU 부하를 준다고 주장하지 않는다.

| 최종 조건 | 준비 뒤 세 번째 delivery | 재생 중 최대 RAF 공백 |
|---|---|---|
| main normal 남/여 | 1249 / 1107ms | 900 / 817ms |
| Worker normal 남/여 | 1205 / 1268ms | 250 / 250ms |
| main 4× 남/여 | 2523 / 2491ms | 1750 / 1733ms |
| Worker 4× 남/여 | 1673 / 1587ms | 917 / 900ms |

첫/세 번째 delivery는 실제 복사된 native 관찰의 count이며 내용은 읽거나 출력하지 않았다. 사람이 검출된 양성·올바른 자세/타이머·효과 판정이 아니다. 모든 세 번째 delivery가 준비 후5초 내였지만 **기존 nativeCloses 및 인증 통합26건 gate는 아니다**. 해당 gate는 이번 미실행이고 과거13건 실패와 시작 P2는 남는다.

Worker도 공백이 있어 매끄러운 코칭 완성이 아니다. RAF는 SDK·첫 화면 렌더·기타 브라우저 작업을 합친 관찰이며 이번에 개별 원인을 분해하지 않았다. Node의5초 대기와 브라우저 응답 시점이 총 계측 구간을 달라지게 할 수 있으므로 렌더 수를 고정5초 FPS·개선율로 환산하지 않는다. 다음은 첫 렌더/SDK 비용을 분리하는 제한된 원인 조사다.

종료 후 모든 카메라 track ended, Worker 생성/종료1:1, storage0·외부 요청0·pageerror0을 확인했다. 원시 영상/몸·얼굴·손 배열·행렬·이미지/스크린샷·계정 자료는 저장/출력하지 않았다. 공개 JS355151/CSS31199 byte·SHA는 PR96과 같다. 기존 소스·GLB·모델·기본 main·최소 문구·SDK/안전/개인정보·운영/배포는 바꾸지 않았다.

## 검증·실패 보존

최종 전체 FE1397·타입·Biome270·public 빌드·공개 guard·diff를 실행했다. 원래 PR90 통합26건·실제 사람/카메라/다장치·Docker/TLS/공급자·배포는 미실행이다.

- 최초 비교8건의 실행·hash/시간은 보존한다. 최초 runningMaxGap은 준비/재생 경계의 공백을 포함할 수 있어 최종 표에 사용하지 않았다. 작성자 검토에서 연속 running RAF만 구간에 포함하도록 보완한 뒤 같은 순서8건을 다시 실행했다.
- 최초 임시 bundle은 최종 빌드 경로에 덮어써져 최초 binary를 보존한 것으로 주장하지 않는다. 최초 실행 report의 source/bundle SHA와 실제 로그는 남긴다. 최종 source/bundle·재현 script는 보존한다.
- final-guard는 public 빌드 완료 전에 실행해 ENOENT로 실패했다. 실행 순서 문제이며 accepted-guard는 빌드 완료 뒤 실제 통과했다. 실패 원문을 삭제하거나 제품 RED로 바꾸지 않는다.
- 실행 receipts·첫/최종 비교와 script·최종 소스는 [manifest](manifest.json)의 gzip 해제 SHA로 확인한다: `node bodyguard/docs/review/native-main-thread-contention/verify.mjs`. `--current`는 현재 소스와 검토 소스의 일치도 확인한다.

## 작성자 검토

engineering:code-review의 보안/정확성/성능/유지보수 기준으로 공개 import 부재, 외부 요청 차단, raw 입력 접근/출력0, 고정 counter/null decision, 실제 소유자 quiescence→종료, 구간 혼합과 관찰 시간 해석을 확인했다. 전문가/독립 리뷰가 아니다. 이 좁은 진단 목적에서 미해결 P1/P2는 발견하지 않았다. 시작 성능·동작/사람 정확도·최종 외형/권리·승인 공개 구조/SDK·운영 및 D2/전체1~6은 미완료다.
