# S6.5 — 웹 시작 지연의 제한된 인과 비교

상태: 제한된 비교 완료 / 이전 지연 미재현·원인 미확정 / 제품 수정 없음

기준 main `1a5fac732d0db78e505b964a7c0ce2cd38d7604c` · `codex/web-startup-causal`

## 목적·범위

기존 시작 실패에서는 /me 네트워크 응답 이후 실제 제목이 늦게 나타났으나 제품·자동화·시스템 스케줄링 중 원인이 입증되지 않았다. latest main의 실제 production 출력을 사용하는 제한된 비교로 다음 조치를 정한다. 제품 코드/인증 권위·UI 구성·개인정보·카메라·아바타·운영·timeout 계약은 변경하지 않는다. 이전 실패와 sourceAtRunVerified=false 한계는 보존한다. Graphify341개 노드에는 해당 경로가 없어 `[]`로 구분하고 실제 source를 읽었다.

## 수용 기준·하네스

1. 최신 main의 체크아웃/실행 HEAD·frontend source와 dist·실행 helper SHA를 전후 대조한다. 기존 설치 runtime을 사용하고 먼저 production build를 실제 실행한다.
2. 소유한 ephemeral loopback fixture와 refusing proxy/새 Chrome context에서 native-control와 제품 /start를 같은 synthetic /me로 번갈아 비교한다. headless/headed 각각 first/repeat 두 번씩, 합계8개 탐색이다. actual 인증/사람/운영 성능 시험이 아니다.
3. 동일 visible heading5000ms·navigation15000ms를 유지한다. init/heading·/me fetch/json·timer/RAF 지연·longtask·제한된 CDP 수치는 준비 제목 관찰·실행 지연이며 실제 픽셀/코칭 지연이 아니다. 원문 DOM·API 응답·이메일/계정·cookie·좌표/영상·console 원문을 게시하지 않는다.
4. 외부/API 이상·카메라/저장/model 요청0, 소유한 browser/server/proxy 종료를 확인한다. 비교 helper는 결과0건·중간 실패를 정상 성공으로 세지 않고 고유 출력·원본을 남긴다.
5. 재현되면 해당 단계의 대조/반증으로 원인을 입증한 뒤에만 최소 제품 보완과 RED→GREEN·전체 회귀를 시작한다. 재현되지 않으면 성공 재실행을 결함 해결로 기록하지 않고 다음 입력/조치를 구체화한다. 같은 진단을 무한 반복하거나 허용 시간을 늘리지 않는다.
6. 이번 비교만으로 Draft #51/제품 성능/단계6·전체1~6을 완료·병합하지 않는다. 디자인/SDK 승인·Docker runtime·실제 참여자·2단계 이월은 각각 남는다.

## 실행 순서

build → 실행 소스 hash 확보 → 제한된 동일 요청/control 비교 → 원본·수치/실패 보존 → 원인 근거 또는 필요한 실제 입력 기록. `engineering:debug`를 적용하며 추정과 관측을 구분한다.

## 실제 실행 결과

2026-10-07 실제 production build/Chrome154의 headless/headed × control/product × 첫/재탐색8건은 같은5000ms 조건을 충족했다. 제품4회 모두 /me JSON 종료 이후 제목 관찰은0.9~2.8ms였고 이전 수 초 지연은 재현되지 않았다. frontend145개/production3개/HEAD/helper 전후 동일, boundary0, 정상 소유 자원 종료. [원본 SHA·수치·작성자 검토·한계](../review/web-startup-causal/README.md).

현재 인과 근거로 제품을 고칠 이유가 부족하다. 같은 정상 비교를 반복하지 않고 실제 실패 조건 또는 통제 가능한 반증 가설을 확보해야 한다. 과거 시작 결함과 Draft #51/실사용 성능 게이트는 미해결이다. 취소 cleanup·실제 계정/사람/신체/운영 검증은 이번 비교에서 실행하지 않았다. 이 Story의 제한된 비교 결과는 제품 결함 해결이나1~6 완료가 아니다.
