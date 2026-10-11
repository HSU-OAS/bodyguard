# S3.C4 — 연속 입력 실패·명시 재시도

기준 main `bbc2b152d3bd236338b29b1829fafe230179c34a` · `codex/coaching-input-recovery` · FR-M-01/02/07·FR-U-04·NFR-07/08

상태: 로컬 검증 완료·조건부 PR 게이트 진행 중. 제품 변경0인 오류/복구 회귀 시험이며 시작P2·전체1~6 완료 아님.

## 목적·범위

실행 중 연속 입력의 capture/Worker 실패·decoded 입력 정지·정리 오류를 재현한다. 화면은 정상 입력에서 실패/종료로 바뀌어야 하며 오래된 관찰값을 유지하거나 코칭 성공으로 바꾸면 안 된다. 정리가 성공한 경우에만 **명시** 카메라 재시도→첫 준비 입력 폐기→별도 입력 확인으로 회복한다. 원인이 드러나면 같은 범위에서 보완하며 정상 동작에 필요 없는 제품 변경을 만들지 않는다.

오류 주입은 별도 개발 시험의 browser/native 경계와 unit port에만 둔다. 실제 React/SDK를 사용하지만 가짜 카메라·제어 오류이며 실제 장치 고장/참여자/정확도 검증은 아니다. 원본 영상/좌표/예외 원문을 저장·로그·업로드하지 않는다. 계정·SDK 네트워크 정책·임계값·출시 동작 수·전체1~6 완료 게이트는 불변이다.

## UI·하네스 계약

frontend-design의 상태/복구 검토로 기존 white/blue·짧은 고정 오류·다시 확인/입력 확인·44px secondary·focus/감소 동작을 재사용한다. 새 화면/메뉴/설정/색/숫자/타이머/아바타는 추가하지 않는다. 기존 화면의 오류와 비활성 버튼을 실제 브라우저에서 확인하며 DOM 조작 영역만 촬영한다. 의학적 판정·진단 표현0. 모바일/앱은 만들지 않는다.

engineering:testing-strategy/debug에 따라 unit은 source/소유권/늦은 응답/재시도 generation을 검증하고, browser는 실제 React/SDK와 Web API fault의 전달·종료·재시도를 검증한다. 먼저 기준선 결과를 보존하고 실패가 있는 경우에만 RED→원인 분리→보완→GREEN을 기록한다. 정상 기준선 시험을 RED라고 표시하지 않는다.

## 수용 기준

1. 실행 중 capture 예외·Worker error는 고정 입력 오류로 끝난다. 모든 트랙·소유 Worker/source 종료, 최신 슬롯 폐기, 자동 새 카메라 획득0, 원문 예외/계정/좌표의 DOM·저장·write0이다.
2. 입력이 멈추면 기존5000ms 기술 deadline/실제 시각의 경계로 종료한다. 제한을 늘리거나 null/오래된 입력으로 갱신하지 않는다. 종료 후 held callback을 풀어도 이전 세션 결과가 부활하지 않는다.
3. 정리 성공 후 동일 화면에서 사용자의 명시 재시도만 fresh generation/새 카메라/Worker를 획득한다. 먼저 준비 입력1개 폐기, 별도 입력 확인 전 자동 연속 입력0, 이후 실제 후속 SDK 입력을 확인한다. 이전 callback이 새 camera/Worker를 끄지 않는다.
4. source/Worker/트랙 정리 실패는 고정 cleanup 오류·재시도 차단이며 다른 자원 해제도 시도한다. 이전 최신값·오류 원문을 반환하지 않는다. 종료된 Worker/camera를 재사용하지 않는다.
5. 실제 오류·재시도 브라우저, 범위 unit/전체frontend/타입/Biome, 실제 build·production private 제외/CSP/고지·원본 hash/링크/diff를 검증하고 실패를 보존한다. 실제 명령/원본과 작성자 보안·정확성·성능·유지보수 리뷰, 최신 diff/main/HEAD/CLEAN/체크와 조건부 merge commit·브랜치 보존을 기록한다.

## 제외·의존성

Blender/GLB/아바타 수정·변형 시험·실제 시범·판정/추천/코칭 결과 기록 활성화·실제 사람·15fps·원래 시작P2 해결·API/DB·Docker/TLS·외부 계정/비용/시크릿·운영 DB migration·배포/출시는 제외한다. 아바타/Docker 보류를 유지하고 선행 근거·실측·최종 에셋과 전체1~6 필수 게이트는 닫지 않는다.

## 실제 결과·명령

[실제 오류/복구 영역·원본 실패·작성자 리뷰](../review/coaching-input-recovery/README.md). 기준선 browser4통과/RED0·신규unit4통과다. 강화 시험의 held 구간2통과 뒤TimeoutError를 보존했다. 실패 분리 후diagnosis4·동일source/제한stability-check4, 전체95파일1714·실패/skip0, 타입/범위정적/build/privateguard/CSP/고지를 실제 확인했다. 원인 미확정 실패나 원래 시작P2를 닫거나 정상 통과로 대체하지 않는다. PR130 source904ab9b→mergebbc2b15/main 포함·브랜치 보존은 시작 전에 실제 확인했다.

실행 위치 `bodyguard/frontend`:

```bash
pnpm exec vitest run src/pose/cameraPreparation.recovery.test.ts --reporter=json --outputFile=/private/tmp/bodyguard-input-recovery.079X7v/unit-baseline.json
pnpm exec vitest run --maxWorkers=2 --reporter=json --outputFile=/private/tmp/bodyguard-input-recovery.079X7v/unit-full.json
pnpm exec tsc --noEmit
pnpm exec biome check scripts/test-input-recovery.mjs src/pose/cameraPreparation.recovery.test.ts
node scripts/test-input-recovery.mjs /private/tmp/bodyguard-input-recovery.079X7v "$BODYGUARD_TEST_CHROME" stability-check
node scripts/build-camera-preparation.mjs /private/tmp/bodyguard-camera-preparation.G0tCwO
node /private/tmp/bodyguard-camera-preparation.ksZzBv/verify-production.mjs /private/tmp/bodyguard-camera-preparation.G0tCwO
git diff --check
```

browser의 baseline/final/diagnosis/stability-check 독립 실행을 각각 기록했다. `BODYGUARD_TEST_CHROME`은 문서 표기로 실제 명령에는 기존 설치 Chrome for Testing154 executable의 절대 경로를 전달했다. 새 설치/외부 서비스 연결0, loopback/가짜 장치 시험에 필요한 권한으로 실행했으며 .env는 읽지 않았다.
