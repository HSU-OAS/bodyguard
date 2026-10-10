# 연속 아바타 재생

runtime `7e8a396ec7ace466382a05cd8d5ad3f775f33b6c` · baseline PR #68 merge `141328fa6f46f244c311b97cc524b6e782349fac`. 비공개 연결이며 최종 외형/올바른 시범/공개 코칭이 아니다.

실제 Chrome154.0.8037.98/RAF·MediaPipe1.0.1·남녀 A37 GLB를 사용했다. 가짜 카메라의 연속 native VideoFrame→동일 SDK 결과를 전달하면서 renderer는 별도로 계속 실행한다. SDK 결과를 시험용으로 붙잡아도 렌더링이 진행되고, 만료 결과를 해제한 뒤 새 프레임으로 계속 진행한다. 종료는 pending 입력/결과 정리→pair 정리→caller SDK/camera 종료 순서를 기다린다.

[실제 흐름](browser-runtime.json) · [남성](runtime-male.png) · [여성](runtime-female.png) · [SHA/원본/범위](summary.json). 움직이는 긍정 입력은 별도 합성이고, 가짜 영상의 실제 SDK 결과는 미검출/관찰0이다. PNG는 아바타 canvas만 촬영했다. 실제 사람·카메라 입력·최종 에셋/정답 시범이 아니다.

## 실제 검증·실패

- 생성/중복 start의 획득0, 예약1·pending read1, 원본 RAF 시각/delta·capture stamp 유지, abort/늦은 callback/다른 세대·재진입·소유 alias·렌더/정리 실패를 unit으로 확인했다. 기본 fps/각도·시간/분류·모델 선택을 추가하지 않았다.
- 최초 stub9실패를 보존했다. 작성자 리뷰에서 늦게 반환된 scheduler handle의 cleanup 실패, 만료 관찰을 ownership 실패로 오인해 종료, 공급자 부분 cleanup 태그의 후속 dispose 손실을 각각 실제 RED(9/1,20/1,21/1)로 재현·보완했다. 추가 경계는 GREEN 추가 시험이며 최초 RED라고 소급하지 않는다. 원본 test JSON은 lossless gzip으로 보존했다.
- 최종 runtime unit22·전체 frontend883(실패/skip0), TypeScript/Biome/assets/Vite build/공개 guard 통과. 실제 남녀 각각 native RAF 흐름과 별도 합성 긍정 흐름을 확인했다. 추론 pending 중 render 수 증가, 입력/SDK 결과 아직 열린 상태, dispose 대기 중 render 중단·SDK/카메라 유지, 늦은 결과 해제 뒤 닫힘을 고정 상태/카운터로 확인했다.
- 합성 관찰에서는 실제 GLB quaternion 변화가 여러 render에 걸쳐 이어지고, 새 결과 없이 maxAge가 지나면 추적0이 된다. 이는 실제 사람 재현 정확도나 노트북의 무중단 fps/전력/장시간 품질 증거가 아니다. 왼쪽 비교 모델은 불변이며 올바른 동작 애니메이션은 아직 아니다.
- 기존 [VideoFrame 회귀2](browser-video-regression.json)와 [blank/합성 전달 회귀2](browser-blank-regression.json)를 **정확한 runtime**에서 실제 Chrome/SDK/GLB로 통과했다. 최초/중간 재생 시험은 baseline HEAD에서 미커밋 소스로 실행한 증거이며 최종 runtime 실행과 구분한다.
- 공개 JS355151/CSS31199 bytes/SHA가 PR #68과 동일, 공개 GLB0·모델5개 bytes/SHA 동일, deps/lock/SDK·Blender/GLB 변경0이다.
- guard 첫 음성 fixture를 scan 밖인 dist root에 넣어 예상과 달리 guard0/오케스트레이션1이었다. 원본 로그를 보존하고 실제 dist/assets에 넣은 fixture로 guard1→시험 파일만 제거→guard0을 확인했다. 제품 guard 범위를 바꾸거나 최초 실패를 통과로 표시하지 않는다.
- collector의 모델 receipt 배열/객체 정합 실패1도 원본으로 보존·재현했다. 같은 bytes/SHA를 baseline 구조로 비교하도록 수집기만 수정했다. source21·보존69개·원본 gzip14개를 검증했다. 로그는 읽기용 EOF만 정리하고 gzip을 해제해 scratch 원본과 byte 일치함을 확인했다. Git 공백 정책은 유지한다.
- runtime native 카메라 API2(가짜), CSP 차단4·외부 routed0/pageerror0·거부 proxy11. 거부 주소/내용을 수집하지 않아 원인을 분류하지 않는다. 시험용 CSP/거부 proxy이며 **제품 SDK 통신 정책은 승인 대기**다. 영상/실제 관절 raw 저장·로그·전송0이다.

## Code Review: owned pose playback

Summary: source/pair 소유권과 renderer/inference 분리를 확인했다. camera/SDK/renderer는 caller가 playback dispose 이후 해제해야 하며 이는 전체 session adapter 완료가 아니다.

Critical Issues: 위 세 경계를 RED로 재현하고 보완·재검증했다. 현재 이 PR 범위 내 미해결 P1/P2=0. 독립 리뷰는 아니다.

종료 순서는 playback의 명시 dispose 호출과 시험 caller의 SDK/camera 정리 경계다. pair 자체의 AbortSignal listener는 표시/추적을 먼저 폐기할 수 있으며, 모든 외부 listener의 정리 순서까지 보장했다는 뜻이 아니다. 실제 native 종료는 지연 결과 중 명시 dispose를 시험했고 abort 경계는 unit이다. 전체 session/resource adapter의 SDK/camera 조기 해제 방지는 후속 필수다.

Suggestions: 실제 사람·전체 자원/세션 수명·노트북 fps/장시간 검증은 필수 후속이다. renderer memory의 geometry0/PBR cache texture1 baseline 복귀를 전체 GPU/worker 해제로 확장하지 않는다.

What Looks Good: 원본 metadata 유지·늦은 관찰 미사용·관찰 만료 계속 진행, 정리 실패 뒤 나머지 정리, 공개 byte/원본 증거 보존.

Verdict: 조건부 PR 게이트 진행. 전체 출시/외형/판정 승인 아님. testing-strategy가 합성 경계·native 통합·실제 참여자 검증을 분리하도록 했으며 graphify의 오래된 지도는 최신 연결의 증거로 쓰지 않았다.

## 남은 출시 조건

물리 웹캠/권한 popup/사람·가림·촬영 범위 정확도, 최신 사진의 Blender/GLB·외형/변형, 손/얼굴/목/체간/축 비틀림·검증된 시범/적색 피드백, 승인된 공개 코칭→본인 기록, SDK 정책·전체 자원 수명, Docker/TLS·외부 계정/법무/운영·실제 참여자 노트북 시험은 남는다. 출시 적격 동작0, D2-A/M/T/R/I/P 및 전체1~6 미완료. 같은 부위 조형·미승인 화면·API/SQL·CI/시크릿·운영/배포 변경0. 기존 승인 경계를 유지한다.
