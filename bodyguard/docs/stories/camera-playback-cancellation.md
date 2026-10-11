# S3.C2 — 카메라 재생 준비 취소·정리

기준 main `be1ec620965edae9a4ccd4b0ae02fc96061279f2` · `codex/camera-playback-cancellation`

상태: 구현·필수 로컬 검증 완료 / 조건부 PR 게이트 진행

## 사용자 흐름과 문제

카메라 확인 중 준비 취소를 누르거나 화면을 나가면, 이미 얻은 스트림은 끄고 재생 준비의 종료를 기다리지 않아야 한다. 현재 `openCamera`는 `video.play()`가 끝날 때까지 취소 promise가 정리되지 않는다. 기존 단위 시험은 취소 후 재생 promise를 직접 완료해 이 대기 상태를 확인하지 않았다. 실제 장치에서 동일 결함이 발생했다는 주장은 아니며 제어한 미완료 재생으로 먼저 재현한다.

또한 한 트랙의 종료가 실패해도 다른 트랙 종료와 현재 영상 분리는 시도하고, 정리가 불확실하면 기존 cleanup 실패 경계로 전달해야 한다. 현재 첫 stop 예외가 나머지 정리를 건너뛰는지는 별도 RED 하네스로 확인한다.

## 수용 기준과 하네스

1. FR-M-01/07·NFR-08: 명시 시작 전 카메라0. 권한 요청 자체를 취소할 수 없으므로 미완료 `getUserMedia`는 소유 작업에 남겨 두고 늦게 허용된 스트림을 부착 전에 종료한다. 이미 받은 스트림의 재생 준비는 abort로 즉시 거부하고 늦은 재생 완료/실패가 새 소유자나 SDK를 부활시키지 않는다.
2. 트랙 하나의 stop 실패 뒤에도 나머지 트랙 종료와 본인 영상 분리를 시도한다. cleanup 실패는 고정 ResourceCleanupError로 전달하고 abort 이벤트에서 원문 예외를 던지지 않는다. 다른 스트림을 부착한 영상은 분리하지 않는다. 실패한 정리는 준비/새 계정의 기존 영구 차단을 유지한다.
3. 결정적인 카메라 단위 RED→GREEN, 실제 cameraPreparation와 openCamera 연결의 취소·늦은 재생·실패 정리 시험, 기존 전체 frontend/타입/범위 정적 검사를 실행한다. 타이머/기존 시작 시험의 허용 시간 확대나 실패 삭제는 하지 않는다.
4. 실제 React/AuthProvider/Chrome에서 native 가짜 카메라·제어한 재생 promise로 준비→취소→끄기 확인·명시 재시작, 화면 이탈/재진입의 이전 준비 폐기, 권한 거부/정상 실제 SDK의 기존 흐름을 확인한다. 외부 통신/영상·좌표 저장/아바타 요청0, 소유 자원 종료를 확인한다. 시험용 fault는 제품에 넣지 않는다.
5. 실제 production build/비공개 경계·고지 검증, 최신 diff/작성자 리뷰/미해결 scoped P1/P2 없음/체크 유무와 exact HEAD 조건부 merge commit을 확인한다. 이전 PR128의 병합·브랜치와 기존 파일·실패 증거를 보존한다.

## 제외·완료 경계

새 UI/문구/메뉴·모델/동작/임계값·SDK 정책·아바타/GLB/Blender·저장/업로드·API/DB·외부 공급자·Docker/HTTPS/운영·배포/출시는 변경하거나 실행하지 않는다. web-design-studio의 기존 둥근 화이트/블루 구성은 그대로다. 실제 사람 정확도/성능·원래 시작P2·출시 적격 동작0·2단계 이월·전체1~6은 미완료다. 범위 내 기술 보완은 기존 사전 승인으로 진행한다.

## 실행 기록

처음 두 카메라 시험이 실제로 실패했다. 취소가 미완료 play의 종료를 기다렸으며 첫 stop 예외가 두 번째 트랙과 영상 분리를 건너뛰었다. 권한 요청은 그대로 소유하고 획득한 스트림의 재생 대기만 abort로 거부했다. 모든 종료/분리를 시도하고 정리 실패를 고정 ResourceCleanupError로 전달한다. abort 이벤트는 예외를 던지지 않고 늦은 재생 reject도 소비한다.

[실제 화면·흐름·실패·작성자 리뷰](../review/camera-playback-cancellation/README.md). 단위27·전체1701(92파일)·실제 취소5/기존 준비 회귀8·타입/범위 Biome/build/private guard가 통과했다. 공개 JS/CSS는 PR128의 실제 build와 byte 동일하다. 최종 browser 전후 네 source SHA는 동일하고 raw/unit/browser·원문 hash·첫 helper를 보존했다. UI/CSS·SDK 정책/모델/판정·기존 에셋/증거·운영은 변경0이다. scoped P1/P2는 보완됐고 독립 리뷰가 아닌 작성자 리뷰다.

실제 명령(작업 디렉터리 frontend):

```text
pnpm exec vitest run src/pose/cameraCancellation.test.ts --reporter=json --outputFile=/private/tmp/bodyguard-camera-cancel.WimF9D/unit-red.json
pnpm exec vitest run src/pose/cameraCancellation.test.ts src/pose/cameraPreparation.cancellation.test.ts src/pose/camera.test.ts src/pose/cameraPreparation.test.ts --reporter=json --outputFile=/private/tmp/bodyguard-camera-cancel.WimF9D/unit-ownership.json
pnpm exec vitest run --reporter=json --outputFile=/private/tmp/bodyguard-camera-cancel.WimF9D/unit-full.json
pnpm exec tsc --noEmit
pnpm exec biome check src/pose/camera.ts src/pose/cameraCancellation.test.ts src/pose/cameraPreparation.cancellation.test.ts scripts/test-camera-cancellation.mjs
node scripts/test-camera-cancellation.mjs /private/tmp/bodyguard-camera-cancel.WimF9D '<실행 Chrome 절대 경로>' browser-final
node scripts/test-camera-preparation.mjs /private/tmp/bodyguard-camera-preparation.ShbJ6b '<실행 Chrome 절대 경로>' camera-regression
node scripts/build-camera-preparation.mjs /private/tmp/bodyguard-camera-preparation.ShbJ6b
node /private/tmp/bodyguard-camera-preparation.ksZzBv/verify-production.mjs /private/tmp/bodyguard-camera-preparation.ShbJ6b
git diff --check
```

Chrome은 설치된 `/Users/gongman/.browser-driver-manager/chrome/mac_arm-154.0.8037.57/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`이며 위 표기는 긴 실행 경로를 줄인 자리표시자다. 최초 단위/브라우저와 Biome 형식 실패·보완을 실제 결과와 구분한다. 허용 시간 확대/DB/아바타/물리 카메라·Docker/TLS·배포 실행0. 기존 시작P2 및 전체1~6 완료로 세지 않는다.
