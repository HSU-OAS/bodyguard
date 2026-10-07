# 소유 pose 결과 → 두 아바타

runtime `682ea56cff27d6238702beea9467c925f7c65f1f` · baseline PR #66 merge `d4d298780ab3ecb2356cb82ca6c2f76833342b48`. 비공개 부품이며 공개 코칭/최종 아바타가 아니다.

실제 Chrome 154.0.8037.98·MediaPipe 1.0.1·남녀 A37 GLB에서 **준비 → 실제 SDK blank 미검출 → 합성 움직임 → 실제 SDK 미검출로 추적 해제 → 중복 입력 차단 → 종료**를 실행했다. 양쪽 발끝까지 보이고 비교 모델은 변하지 않았다. blank는 브라우저 메모리에서 생성했으며 카메라를 켜거나 입력을 저장하지 않았다. 움직임은 실제 사람 추정이 아닌 합성 fixture다.

[남성 실제 WebGL](runtime-male.png) · [여성 실제 WebGL](runtime-female.png) · [원본 native 결과](browser-runtime.json) · [SHA/범위](summary.json). 사진은 **기존 미완성 A37**의 전달 검수 화면이다. 외형·변형·전문적인 시범 승인이 아니다.

## 검증과 실패

- 원본 capture 세대/순서/시각을 유지하고 한 SDK 결과의 image/world만 복사한다. native 결과 close 후에도 전달값은 보존한다. 종료/late에서는 전달하지 않으며 정리 실패는 고정 오류로 남는다.
- 최초 stub: 2통과/10실패, 소비자가 없는 늦은 mock rejection 1건. [RED 원본](unit-red.log)을 보존했다. 구현 뒤12통과. 동기 capture 재진입은 [추가 RED](unit-reentrant-red.log) 1실패/12통과로 재현·수정했다. 뒤의 추가 경계는 GREEN 시험이며 최초 RED였다고 소급하지 않는다.
- 최종18 단위/전체844 frontend·타입/Biome·기존 캐시 assets·Vite build·공개 guard 통과. guard의 시험 sentinel은 실제 실패1 뒤 그 시험 파일만 제거하고 통과0을 확인했다. 공개 JS355151/CSS31199 bytes와 SHA는 PR #66 출력과 같다. 공개 GLB0.
- native 최종: 실제 SDK 호출/결과 close는 남녀 각2, detector close 각1. 입력 보존/전송·카메라 호출·외부 routed 요청·pageerror0. 시험 전용 CSP에서 connect 시도2를 막았고 거부 proxy에서11건을 거절했다. 요청 주소/내용은 수집하지 않았으므로 proxy 요청의 원인을 분류하지 않는다. **제품 SDK 통신 정책은 여전히 승인 대기**다.
- renderer는 아바타 전 측정한 baseline(geometry0/공용 PBR texture1)로 복귀했다. 전체 GPU/worker 메모리 해제 증거는 아니다. SDK/GLB/lock 변경0. native source 전후13개와 보존36개 원본 증거 SHA를 검증했다.
- 원본 로그의 끝 빈 줄9건 때문에 [문서 diff 검사](diff-raw-evidence-red.log)가 exit2로 실패했다. 최초 원본36개는 commit96171d5에 보존한다. 해당9개는 현재 폴더에도 byte 동일한 `.raw.gz`로 보존하고 읽기용 로그의 EOF만 정리했다. SHA/압축 해제를 재확인하며 코드·Git 공백 검사 정책은 변경하지 않는다.

code-review는 작성자 검토이며 독립 리뷰가 아니다. 순서/재진입·abort/late·close 누락/실패·복사 격리·입력/renderer/서버 정리·개인정보·공개 경계를 확인했다. 범위 내 미해결 P1/P2는0이다. 초기 렌더러 준비/최종 서버 정리 보완은 정적 검토에 따른 방어 코드이며 실제 실패 재현으로 표기하지 않는다.

## 남은 출시 조건

실제 웹캠/참여자 정확도, 검증된 시범·잘못된 부위 피드백, 목/체간/손/축 비틀림, 최신 사진의 Blender 원본·GLB·변형/외형, 공개 코칭→본인 기록, SDK 정책·전체 GPU 수명, Docker/TLS·외부 계정/운영·다양한 노트북 사용자 시험이 남는다. 출시 적격 동작0. D2-A/M/T/R/I/P와 전체1~6단계는 미완료다. 같은 부위 조형·미승인 화면·API/SQL·CI·시크릿·운영/배포 변경0. 비용·계정·안전/개인정보의 중요한 변경·배포/출시는 별도 승인을 유지한다.
