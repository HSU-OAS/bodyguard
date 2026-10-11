# S3.C3 — 코칭 웹의 연속 관찰 입력

기준 main `b5791b2b1c3b6639d2d3e028b5b2659bda99acc7` · `codex/coaching-continuous-input` · FR-M-01/02/07·FR-U-04·NFR-07/08

상태: 로컬 구현·실제 검증 완료, 조건부 PR 게이트 진행 중. 전체3단계/1~6 완료 아님.

## 사용자 흐름·목적

승인된 코칭 웹에서 카메라 확인→SDK 첫 입력 폐기→사용자가 직접 입력 확인→같은 카메라/Worker의 새 decoded 입력을 연속 처리→카메라 끄기를 연결한다. 향후 검증된 아바타/코칭 consumer에 줄 generation·sequence·원래 촬영 시각/크기를 보존한 관찰 producer다. 현재 아바타 보류·출시 동작0이므로 판정·시범·운동 진행/결과 기록은 비활성이다. 연속 추론을 자세가 바르다는 성공 표시로 사용하지 않는다.

입력은 같은 브라우저 메모리에서 최신 복사본 최대1개만 유지하고 consumer는 consume-once로 가져간다. 원본 VideoFrame/SDK 결과는 기존 owned source가 즉시 해제한다. 입력 확인 전 자동 연속 처리0, 중복 SDK/카메라 획득0, 한 번에 추론1개다. body0/여러 명/가림에서도 값을 지어내지 않고 원래 source 결과를 유지한다. 임상 기준은 변경하지 않는다.

## UI 계약

web-design-studio/frontend-design의 기존 white/blue 토큰·16px 본문·둥근 secondary 버튼·44px 조작 높이·focus/감소 동작을 재사용한다. 기존 카메라 준비 영역에 `입력 확인`만 연결하고 새 메뉴/화면/카드·숫자/점수·영상 표시를 만들지 않는다. 준비→연결 준비→입력 확인 중의 현재 상태만 짧게 표시하고 연결 중 중복 시작은 차단한다. `카메라 끄기`는 연결 준비 중에도 사용 가능하다. 모바일/앱은 지원 범위가 아니며 좁은 노트북 창800px·키보드를 확인한다.

## 수용 기준·하네스

1. 명시 입력 확인 전 후속 추론0. 준비한 동일 Worker/카메라로 기존 createVideoPoseSource의 같은 입력 body/face/hand 복사·해제를 사용한다. 최초 준비 프레임은 관찰 producer에 섞지 않는다. generation/sequence/시각/영상 크기를 다시 찍거나 올바른 자세로 분류하지 않는다.
2. 한 source read/추론만 진행하며 최신 메모리 슬롯1개·consume-once·취소 즉시 슬롯 폐기. stop/hidden/pagehide/화면·계정 교체/로그아웃 후 늦은 결과가 현재 화면/producer를 부활시키지 않는다. cleanup 오류는 영구 차단한다. 동일 세션의 두 번째 시작 요청은 무시한다.
3. 연속 read의 기술적 응답 한계5000ms와 시계상의 실제 deadline을 검증하고 실패하면 종료한다. 기존 Worker 준비/추론/해제5초와 native 시작 시험 한계는 늘리지 않는다. 이 값은 운동 유지 타이머/임상 acceptance/FPS 보장 기준이 아니다.
4. unit RED→GREEN·DOM 조작/상태·전체frontend/타입/범위 정적·실제 build/고지/production private 제외를 실행한다. 실제 React/Chrome의 native 가짜 카메라·실제 heavy Worker에서 명시 연속 입력 여러 번→종료, 취소/화면·계정 회수·fresh 재시작과 외부/저장/GLB0을 확인한다. 고장 주입은 test-only이고 실제 사람 정확도/성능과 구분한다.
5. source/hash/실패 원본·실제 작동 화면과 한계를 보존하고 scoped 리뷰·최신 main/diff/HEAD/CLEAN/체크·조건부 merge commit/브랜치 보존을 실제 확인한다. PR129 mergeb5791b2/main 포함을 확인했고 이전 브랜치/에셋/증거는 보존한다.

## 제외

아바타 제작/검증·GLB/Blender/시범·판정/임계값·실제 사람/카메라 라벨/15fps·원래 시작P2 해결·공개 코칭/추천/기록 생성·새 API/DB/SDK 정책·Docker/TLS·외부/계정/비용/시크릿/운영/배포/출시는 하지 않는다. 전체1~6/이월/참여자·운영의 필수 게이트는 유지한다.

## 실제 결과·명령

[실제 흐름·실패·원본 hash·작성자 리뷰](../review/coaching-continuous-input/README.md). 최종 frontend94파일1710통과·실패/skip0, 최종 연속 입력 Chrome7통과, 기존 카메라8/준비 취소 단독5통과. 원본 RED와 최초 전체/동시 SDK/환경 setup 실패는 보존했다. PR129 sourceba721d4→mergeb5791b2/main 포함·브랜치 유지도 실제 확인했다.

실행 위치 `bodyguard/frontend`. scratch는 소유 경로만 사용했다:

```bash
pnpm exec vitest run --reporter=json --outputFile=/private/tmp/bodyguard-continuous-input.ErzhaQ/unit-final.json
pnpm exec vitest run src/pages/MeasureDemoPage.test.tsx --reporter=json --outputFile=/private/tmp/bodyguard-continuous-input.ErzhaQ/unit-timeout-recheck.json
pnpm exec vitest run --maxWorkers=2 --reporter=json --outputFile=/private/tmp/bodyguard-continuous-input.ErzhaQ/unit-final-bounded.json
pnpm exec tsc --noEmit
pnpm exec biome check src/pages/CameraPreparation.tsx src/pages/CameraPreparation.observation.test.tsx src/pages/CameraPreparation.retirement.test.tsx src/pose/cameraPreparation.ts src/pose/cameraPreparation.observation.test.ts scripts/test-continuous-input.mjs scripts/check-selection-production.mjs
node scripts/test-continuous-input.mjs /private/tmp/bodyguard-continuous-input.ErzhaQ "$BODYGUARD_TEST_CHROME" browser-expanded
node scripts/test-camera-preparation.mjs /private/tmp/bodyguard-camera-preparation.GxV5J5 "$BODYGUARD_TEST_CHROME" camera-regression
node scripts/test-camera-cancellation.mjs /private/tmp/bodyguard-camera-cancel.WimF9D "$BODYGUARD_TEST_CHROME" continuous-regression-isolated
node scripts/build-camera-preparation.mjs /private/tmp/bodyguard-camera-preparation.GxV5J5
node /private/tmp/bodyguard-camera-preparation.ksZzBv/verify-production.mjs /private/tmp/bodyguard-camera-preparation.GxV5J5
git diff --check
```

`BODYGUARD_TEST_CHROME`은 문서 표기다. 실제 명령에는 설치된 Chrome for Testing154의 절대 executable path를 전달했으며 새 설치/외부 연결0이었다. 실제 browser 실행은 허용된 로컬 서버/프로세스 권한으로 수행했다. 원래5000ms 제한을 바꾸지 않고 단위 시험의 동시 worker 수만2로 제한했다. 과거 실패를 성공으로 덮어쓰거나 모든 장치/동시 부하에서 준비가 성공한다고 주장하지 않는다.
