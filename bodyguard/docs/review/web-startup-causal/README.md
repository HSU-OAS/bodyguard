# S6.5 — 최신 웹 시작의 제한된 인과 비교

상태: 제한된 비교 완료 / 이전 지연 미재현 / 원인·제품 성능 결함 미해결

최신 main `1a5fac732d0db78e505b964a7c0ce2cd38d7604c`에서 production build 후 실제 설치 Chrome154.0.8037.98의 headless/headed 새 context로 단순 native-control와 제품 /start를 번갈아 비교했다. 같은 synthetic /me·동일 visible5000ms·navigation15000ms를 사용했고 합계8개 탐색 모두 해당 제목이 나타났다. 제품의 실제 인증·신체/사람·운영 성능 검증은 아니다.

## 실제 결과

[수치·실행 소스·dist·원본 SHA](20261007/summary.json). 전체 frontend145개 파일·실제 production 출력3개와 helper를 실행 전후 대조했다. 제품 코드 변경0, 비교 중 HEAD/source/dist 동일. build에서 dist가 바뀐 것은 실제 최신 빌드 결과이며 “빌드 중 출력 불변”으로 기록하지 않는다. 배포·외부 연결·계정·비용·시크릿·운영 DB 변경0.

| 비교 | 첫 /start 제목 관찰 | 재탐색 제목 관찰 | 마지막 /me JSON 종료→제목 |
| --- | --- | --- | --- |
| headless 제품 | 138.9ms | 30.1ms | 첫2.8ms / 재1.0ms |
| headed 제품 | 96.1ms | 24.7ms | 첫2.4ms / 재0.9ms |

제목 수치는 문서 navigation 시간 기준 MutationObserver 관찰이며 실제 픽셀 출력이나 코칭 피드백 지연이 아니다. 같은 context 재탐색에는 Vite/Chrome 잔존 캐시가 있으므로 완전히 분리된 cold/warm 성능 시험으로 부르지 않는다. CDP 수치는 target의 enable 이후 metrics이며 sample별 독립 CPU 시간으로 비교하지 않는다. 타이머와 RAF가 짧은 탐색에서0회인 경우 부하0 증거로 쓰지 않는다.

제품4회에서 장시간 main-thread task는 관찰되지 않았으며 단순 control 첫 headless에서66ms task1회가 있었다. 외부 요청·API 이상·model/GLB·카메라/저장·pageerror0을 확인했다. 원본은 소유 scratch에 보존했고 공개 자료에는 숫자·고정 surface 이름·source hash만 있다. browser/preview/proxy의 정상 종료를 실행했고 취소/비정상 강제 종료 cleanup 시험은 이 비교에서 실행하지 않았다.

## 원인 판단·다음 조치

`engineering:debug`로 과거 요청/화면 지연과 현재 분리 실험을 대조했다. 기존 [S6.3 실제 실패](../web-startup-readiness/evidence-review-provenance/browser-20261007T001834237Z.json)는 /me 응답 이후 제목이 수 초 늦거나 미관찰인 결과다. 이번 제품/단순 화면 비교에서 그 현상은 재현되지 않았다. 현재 정상 동작을 근거로 과거 원인을 네트워크·React·자동화·환경으로 확정하지 않는다. 성능 개선 코드를 쓰거나 테스트 시간을 늘리지 않았다.

동일 정상 비교를 다시 반복하는 대신, 다음 인과 수정은 실제 지연이 나타나는 노트북/브라우저·동시 작업·실행 순서와 제한된 숫자 계측을 연결하거나 반증 가능한 통제 부하 가설을 확보한 뒤 진행한다. 사람의 개인정보 화면·영상·좌표 원본을 요청하지 않는다. 현재 제품 수정의 인과 근거는 부족하며 시작 P2·Draft #51을 닫지 않는다.

사용 가능한 기존 흐름/검증과 이월된 실패는 그대로다. 디자인 적용은 클릭 가능한 코칭 구조/범위 합의, SDK 통신은 별도 승인, 운영 패키지는 실제 Docker engine 연결이 선행 조건이다. 실제 참여자·아바타 외형/변형·통합·외부/운영과 전체1~6 완료가 아니다.

## 작성자 증거 검토

`engineering:code-review`의 정확성·보안·성능·유지보수 관점에서 원본/파생 수치·helper·문서 diff를 읽었다. 실행 HEAD/145 source/3 dist와 현재 파일이 같고8개 탐색·0 경계·실패 미재현 값이 원본과 같다. 원문 DOM·credentials·API payload·카메라/관절은 새로 게시하지 않았다. 기존 원본/실패와 sourceAtRunVerified=false 한계를 덮지 않았다. 새 제품 코드·루프·dependency·성능 주장을 추가하지 않았다. 별도 에이전트·전문가 리뷰는 실행하지 않았다. 이 기록 범위의 미해결 P1/P2는 발견하지 않았지만 기존 시작 결함은 미해결이다.
