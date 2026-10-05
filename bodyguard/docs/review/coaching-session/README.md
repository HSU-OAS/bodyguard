# 코칭 세션 연결 기초 — 실패·실제 모듈 연결·공개 웹 미노출

main cf841070 · codex/coaching-session-bridge · [명세](../../stories/coaching-session-bridge.md)

실제 progression/controller/coordinator 모듈을 연결했고, 합성 ports/gates/관찰과 실제 Node EventTarget로 세션44건·전체411건을 통과했다. **실제 서버 인증/만료 adapter·MediaStream/MediaPipe/GLB·촬영/관절 정확도·코칭 화면/결과 저장은 미연결**이다. EventTarget 시험을 실제 Chrome tab 숨김·사람/노트북 시험으로 세지 않는다.

| 실행 | 실제 결과 | 증거 |
|---|---|---|
| 최초/계약 red | 모듈 미구현 수집 실패1·시간0; 세션 기능 시험을 실행한 실패가 아님 | first-red.xml, contract-red.xml |
| 최초 unit/type | 합성37건 실패0 / TS2322 두 mock의 constructable/callable 타입 불일치 exit2 | initial-green.xml, initial-typecheck.stdout |
| 타입 수정/전체 | 명시 dispose mock 타입 후 타입·전체404건 통과 | fixed-typecheck.stdout, full-regression.xml |
| 작성자 P2 red | 42건 중3실패: listener 즉시 제거0 / 두 gate 상실 경과 시간0 | review-red.xml |
| 1차 P2 보완 | 종료 시 현재 유효 시각 보존, hidden/pagehide/unbind listener 즉시 제거·멱등.409건(세션42) 실패/오류/skip0 | accepted-regression.xml |
| accessor P2 red/보완 | gate getter 예외44건 중1실패 → guarded strict boolean 복사·fixed gate-error. 최종411건(세션44) 실패/오류/skip0 | [red](accessor-red.xml), [최종](final-regression.xml) |
| 최종 타입/Biome/build | 타입·Biome97파일·production build 성공 | final-typecheck.stdout, final-biome.stdout, verified-build.stdout |
| production guard | 합성 sentinel 의도한 exit1. 제거/rebuild 후 후보/엔진/자원/세션 문자열0·JS1 | production-guard-negative.stdout, final-production-guard.stdout |
| 실제 Chrome 회귀 | 기존7흐름11.3초·카메라/모델/GLB·pageerror/storage0. 실제 browser이나 계정 응답은 mock | selection-browser.stdout, selection-report.json, [현재 화면](production-start.png) |

코드 리뷰 스킬의 정확성·보안/개인정보·성능·유지보수 관점으로 작성자가 검토했다. clock/provider/observer/소유권·해제 오류는 고정 기술 사유로 종료하며 사용자 중단/자세 판정 오류로 꾸미지 않는다. 기술 원인5종은 순수 engine의 제한된 enum만 확장했고, 기록 API는 사유를 저장하지 않으므로 서버/DB 저장 범위는 그대로다. onChange는 비차단이며 예외/Promise rejection은 정리·재시작 차단으로 처리한다. 현재 scope 미해결P1/P2 없음; 외부/전문가/전체 출시 검토 완료는 아니다.

원본 XML/stdout·Chrome JSON/PNG는 소유 private scratch와 작업트리에 보존했다. [manifest](artifacts.json)는 raw/공개 SHA-256을 함께 기록한다. 공개 사본은 정해진 파일만 복사하고 root/file URL·scratch 경로/XML 로컬 hostname만 치환했다. 성패·개수·시간·오류는 변경하지 않았으며 기존 사본이 다르면 덮어쓰기를 거부한다. 새 UI/원본 아바타/3D 변형/실측/서버·CI·deps·secret·운영/배포/출시·Figma/디자인 외부 감사는 실행하지 않았다. 기존 화이트·블루 웹은 유지한다.

추가 red/최종 증거는 [별도 final manifest](artifacts-final.json)에 기록하고 앞선409건/실패/manifest를 덮어쓰지 않았다. Chrome은 공개 build 회귀이며 마지막 비공개 provider 보완 전의 실행이다. 공개 JS/CSS는 그 실행과 최종 build에서 동일 byte hash임을 별도로 확인했고, 비공개 coordinator44건은 마지막 보완 후 실제로 실행했다. 이미 종료한 결과 뒤 cleanup 오류는 원래 종료 사유를 바꾸지 않고 snapshot의 fixed failure에 추가하는 경우도 시험했다. 이 절차를 실제 coaching browser 통합으로 승격하지 않는다.

[공개 bundle SHA 비교](public-bundle-hashes.json)는 보존한 PR #34 build와 최종 build가 동일함을 실제 `shasum -a 256`으로 확인한 값이다. 마지막 비공개 보완 뒤 [최종 guard](verified-production-guard.stdout)도 재실행했다.

로컬 재현: frontend에서 `pnpm exec vitest run src/coaching/session.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm check`, `pnpm build`, `node scripts/check-selection-production.mjs`, `node scripts/test-selection-browser.mjs`. 마지막은 소유 local listener/Chrome과 외부 차단 proxy를 쓰며 실제 계정/웹캠 시험은 아니다.
