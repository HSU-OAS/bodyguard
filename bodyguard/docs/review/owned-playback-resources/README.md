# 세션·재생 자원 연결

runtime `8ff7481d9edbce9338f2cb298a95b4d5c881367b` · baseline PR #69 merge `4a9c8f54eabd969c53bebc01d7d979cee457f1d7`. 비공개 구현이며 공개 코칭/최종 아바타가 아니다.

실제 Chrome/가짜 카메라·MediaPipe·남녀 A37 GLB에서 준비→연속 재생→지연 결과 중 일시정지→정리→새 세대 재개→세션 만료→종료를 연결했다. 일시정지는 상태/RAF를 즉시 멈추고, 붙잡은 native 결과와 VideoFrame이 정리되기 전 SDK/카메라를 닫지 않는다. 이후 모델/SDK/track을 정리하며 재개는 새 소유 자원을 사용한다.

[실제 흐름](browser-final.json) · [남성](final-male.png) · [여성](final-female.png) · [원본/SHA/범위](summary.json). PNG는 미완성 A37 아바타 canvas만 촬영했다. 카메라 입력·실제 사람·정답 시범이 아니다. 로그인/동작 적격성/아바타 gate와 세션 만료는 **시험 주입**, 실제 계정 만료나 출시 가능한 동작을 검증한 것이 아니다. SDK 결과를 async fixture로 지연한 시험이며 동기 추론을 별도 스레드로 실행하거나 실제 노트북 fps를 보장한 것이 아니다.

## 검증·실패 보존

- 최초 stub11실패를 보존했다. 작성자 리뷰의 종료 직후 저장 RAF 실행, pending inference factory 중복 호출, 늦은 부분 cleanup 태그가 공유 종료 Promise에 반영되지 않는 경계를 각각 RED로 재현·보완했다(11/2,19/1). 나중 GREEN 경계를 처음부터 RED였다고 소급하지 않는다.
- 생성/미검증 gate의 획득0, 세대 교체·late factory 회수, 원본 stamp 유지, 여러 wrapper의 같은 종료 장벽, source/SDK/camera 실패 뒤 나머지 정리와 observer throw/rejection/재진입을 확인했다. callback 실패는 기존 자원 계약의 asset-error로 전달하며 raw 오류/좌표를 전달하지 않는다.
- 초기 fixture Mock 타입 정합 검사는 TS2345로 실패했고 타입을 보완했다. 최초 전체 검사에서는 browser runner 포맷1건으로 중단했다. 실패 로그/JSON을 유지하고 실제 포맷 보완 후 전체 검증했다.
- 코드 주석의 `sticky` 토큰이 Tailwind 자동 검색에 잡혀 공개 CSS에24byte 규칙이 추가되었다. collector 실제 실패를 보존했다. 주석만 수정한 최종 runtime에서 기존 공개 JS/CSS 파일명·bytes·SHA가 동일함을 확인했다. 제품 CSS·화면 구조·빌드 검색 정책은 바꾸지 않았다.
- 최종 runtime unit45/전체 frontend906(실패/skip0), TypeScript/Biome/assets/build/공개 guard를 통과했다. actual Chrome154.0.8037.98/SDK1.0.1/RAF/WebGL의 남녀 각 흐름과 기존 재생/영상/단일 전달 회귀6을 **정확한 runtime**에서 확인했다. `runtime`/`verified` 이름의 이전 파일은 미커밋 또는2a00bbf 입력이며 최종8ff7481의 `final` 증거와 구분한다.
- 공개 빌드에 비공개 자원이 유입되면 guard가 실제 exit1로 차단하고, 이번 시험 파일만 제거한 뒤 exit0으로 복구했다. 모델5개·deps/lock·Blender/GLB 변경0·공개 GLB0이다.
- native 카메라 API4(가짜), CSP 차단4·외부 routed0/pageerror0·거부 proxy11. 시도 주소/내용을 수집하지 않아 원인을 분류하지 않는다. 시험 전용 CSP/거부 proxy이며 승인 대기 제품 SDK 통신 정책을 구현한 것이 아니다. 영상/원시 좌표 저장·로그·전송0이다.
- raw test JSON과 보기용 공백 정리가 필요한 로그를 lossless gzip으로 보존했다. 최초 Git diff 검사는 Biome 실패 로그의 줄 끝 공백으로 exit2였고, 읽기용 로그만 정리한 뒤 재검사한다. gzip 해제 bytes와 scratch 원본 SHA를 확인하며 Git 공백 정책은 바꾸지 않았다. 기존 파일/실패·조형 원본을 덮지 않았다.

## Code Review: owned playback resources

Summary: 병렬 controller release를 한 세대의 공유 장벽에 연결하고 source/quiescence 전에 native lifetime abort가 일어나지 않도록 분리했다. 생성 중에는 native factory 취소 signal을 즉시 전달한다. 취소할 수 없는 권한 popup의 늦은 반환은 회수하며 새 camera 획득은 이전 정리 뒤로 제한한다.

Critical Issues: 세 RED 경계와 공개 CSS 유입을 수정·재검증했다. 현재 이 PR 범위의 미해결 P1/P2=0. 작성자 리뷰이며 독립 리뷰가 아니다. 실제 native는 정상/지연/중단/재개/종료 경계이고 native throw/부분 실패는 unit 시험이다. factory는 부분 실패를 회수하고 정리 실패를 고정 태그/후속 dispose로 보존해야 한다.

Suggestions: 실제 권한 popup·계정 expiry/이탈, 전체 body/hand/face/native worker·renderer/GPU의 장시간 정리와 물리 웹캠 정확도는 후속 필수다. renderer memory의 geometry0/PBR baseline texture1 복귀를 전체 GPU/worker 해제로 확대하지 않는다. 종료를 기다리는 Promise와 UI 상태 전이는 구분한다.

What Looks Good: 원본 metadata 유지·입력/결과 종료 장벽, 미검증 session 획득0·늦은 소유 반환 회수, 관찰/추론 실패 격리와 기존 공개 출력 보존.

Verdict: 범위 내 조건부 PR 게이트 진행. testing-strategy는 합성 소유권 시험/native 통합/실제 사람 시험을 분리했고 code-review는 즉시 취소·중복 acquisition·실패 전달·공개 출력 경계를 확인하도록 했다. 새 제품 디자인은 적용하지 않았다.

## 남은 출시 조건

물리 webcam/실제 사람·가림/촬영 범위 정확도, 최신 사진의 Blender/GLB·외형/변형, 목/체간/손/축 비틀림과 검증된 시범·적색 피드백, 승인된 공개 코칭→본인 기록, SDK 정책·전체 자원, Docker/TLS·외부 계정/법무/운영·실제 참여자 노트북 시험은 남는다. 출시 적격 동작0·D2-A/M/T/R/I/P·전체1~6 미완료. 같은 부위 조형·미승인 화면·API/SQL·CI/시크릿·운영/배포 변경0. 짧은 문구와 필요한 안전 안내를 유지한다.
