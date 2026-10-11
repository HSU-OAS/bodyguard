# 준비 → 연속 입력 시각 인계

기준 main `7ed34fb64994f3b6758eb8be5fbc0de7e1d897ff` · S3.C7 · `codex/camera-input-handoff`

## 작동한 흐름

개발 웹에서 선택 동작 → 카메라 준비/첫 추론 폐기 → 별도 입력 확인 → 연속 촬영 안내 → 동작 변경/기존 카메라·Worker 종료 → 새 명시 준비/입력 → 없는 동작 주소 차단을 실제 Chrome/React와 가짜 카메라/heavy body·face·hands SDK로 확인했다. 기존 표시/본문/화면 구성은 바꾸지 않았다.

첫 연속 입력의 시각이 준비 추론과 같거나 더 작으면 이제 **VideoFrame 생성/Worker 추론 전에 건너뛰고 다음 입력을 받는다**. 준비 owner는 Worker에 실제 넘긴 시각을 새 source에 인계한다. 다음 입력을 현재 시각으로 다시 찍지 않고 decoded callback 원래 시각을 유지한다. 같은 카메라/Worker로 이어지고 새 동작은 새 준비 시각을 쓴다.

## 재현과 원인 범위

원본 runtime의 unit은 21통과/1실패했다. 준비 시각10 뒤 decoded 시각10을 순서 엄격 detector에 보내자 `Video capture unavailable`로 끝났다. 실제 브라우저의 제어 시험도 준비까지1통과 뒤 `native-input/observe/first-three-frames` TimeoutError였다. 고정 진단은 frame-error, 카메라1/Worker frame1(준비만), equal 주입1, track ended였으며 외부/GLB/쓰기/페이지 오류0이었다.

이전 main은 준비 추론의 시각을 새 source에 전달하지 않았다. 새 source는 그 시각 이하 callback을 추론으로 넘겼지만 Worker의 기존 `at > lastAt` 계약은 이를 거절한다. source의 시작 하한으로 같은 계약을 인계해 사전 건너뛰도록 보완했다. Worker의 순서 검사·5초 응답/입력 나이·heavy/얼굴/손 설정은 그대로다.

**제어 시험은 callback 시각만 같은/이전 값으로 대체했다.** 영상·decoder metadata·이후 callback·SDK는 실제 가짜 장치 경로지만 자연 발생 경쟁이나 실제 사람 시험은 아니다. [rVFC 제안 명세](https://wicg.github.io/video-rvfc/#procedures)는 rendering update의 timestamp를 callback에 전달한다고 정한다. 이를 별도 `performance.now()` warmup과 함께 사용할 때의 경계 방어라는 기술적 추론과, 과거 원인 미확정 timeout의 설명은 다르다. 이번 정상 시험으로 과거 timeout/시작 P2를 닫지 않는다.

## 실제 검증

[실행·SHA·보존 목록](verification.json), [검증 실행기](verify.mjs).

- 최종 전체 frontend98파일1750통과, 실패/skip0. 범위6파일77통과, 실패/skip0. 합성 VideoFrame/decoder/detector, happy-dom/Worker fixture이며 실제 사람 검증이 아니다.
- 실제 Chrome/React/로컬 HTTP fixture/가짜 카메라/heavy SDK: 시각 제어8흐름, 원래 callback 시각6흐름 통과. 기존 16초 준비/8초 관찰 하네스와 제품5초 제한을 확대하지 않았다. account GET은 fixture이며 실제 계정 사업자/SQL 시험이 아니다.
- 타입·변경5파일 Biome·production build(117 modules)·비공개 제외 guard·diff check를 실제 실행해 exit0. CSP 동일 출처/unsafe-eval 없음, 고지 JSON/Tailwind, 공개 GLB0을 확인했다. 공개 JS/CSS는 PR133 빌드와 byte 동일하다.
- 현재 source5개와 browser source7개 SHA 일치, 실행 전후 SHA 동일, 24개 gzip 원문 hash·해제 byte 일치를 검증했다. 원본 runtime2개는 기준 main Git blob과 대조했다. 처음 unit/브라우저 실패, RED helper, 기존 증거와 임시 폴더를 보존했다. 소유 browser/Vite/HTTP 서버는 종료했다.
- [동작 변경 후 카메라 종료 영역](motion-change.png)은 실제 DOM이다. 모든 track/Worker 종료·video/canvas0 뒤 제어 영역만 찍었고 아바타/영상/좌표는 없다. 기존 UI이며 새 외형 미리보기가 아니다.

## 작성자 리뷰

`debug` 절차의 제어 RED→경계 원인 분리→최소 보완→회귀를 적용하고 `code-review` 기준으로 최신 diff를 작성자가 직접 재검토했다. 별도 독립 리뷰가 아니다.

`videoPoseSource.ts`: optional 하한은 finite/비음수만 받아 기본 caller 동작을 유지하고 값 복사로 나중 설정 변이를 차단한다. 같음/과거/0/잘못된 값/새 원래 시각을 확인했다. 기존 sequence/mediaTime 검사를 완화하거나 raw 값을 로그/저장하지 않는다. 취소·track 교체/종료·정리 실패 격리/소유권은 기존 회귀로 확인했다.

`cameraPreparation.ts`: 실제 detect에 넘긴 warmup 시각만 저장하고 같은 준비 세대의 명시 observe에 넘긴다. 준비만으로 source 생성0, 새 준비 시각/세대, 종료 후 슬롯 폐기/Worker 정리를 확인했다. null 입력이 기존 deadline을 연장하지 않으며 계정·페이지 회수/cleanup 격리를 유지한다.

하네스: 원본 source/hash·진단·시간 제한을 보존하고 시각 fault 여부를 별도 기록한다. 원본 실패는 실패로 남겨 다음 정상 결과로 덮어쓰지 않는다. 제품 개인정보/SDK 정책·의학 기준·아바타·공개 UI/API·운영 변경은 없다. 이 좁은 목적의 미해결 P1/P2는 발견되지 않았으나 아래 기존 전체 필수 조건은 남아 있다. PR의 최신 diff/CLEAN/체크는 병합 직전에 별도 실제 재확인한다.

## 남은 조건

아바타 보류·실제 참여자 연결 나중·Docker 보류를 유지한다. 최종 외형/원본/GLB/변형/브라우저 아바타, 실제 사람 촬영/정확도·노트북 시작/반응·기존 시작 P2/원인 미확정 timeout, 검증된 올바른 시범/분류·추천/출시 적격 동작0, 실제 계정 연결·Docker/HTTPS/권리·운영·전체1~6은 완료되지 않았다. 미검증 기능을 공개하지 않았고 비용·계정·시크릿·운영 DB·배포/출시는 실행하지 않았다.
