# 코칭 자원 연결 기초 — 실제 실패·회귀·공개 웹 경계

main d348fb8 · codex/coaching-resource-lifecycle · [현재 계약](../../stories/coaching-resource-lifecycle.md)

최초 R-02/전체 계약 red는 resources 모듈 수집 실패였다. [최초 XML](first-red.xml)과 [전체 계약 red](contract-red.xml)의 실패1/시간0은 factory case 실행 실패가 아니다. 이후 controller를 구현했고 합성 factory/실제 진행 엔진 effect의40건과 전체 Vitest367건을 통과했다. **실제 MediaStream/MediaPipe/GLB·사람/관절 정확도·제품 코칭 연결은 미실행이다.**

offline/frozen install은 기존 clone/cache를 사용했고 lock/버전·네트워크 다운로드·제품 UI/API를 변경하지 않았다. raw XML/stdout은 소유 private scratch에 보존하며 공개 XML 사본은 현재 worktree 경로만 [workspace]로 치환했다. 원본 SHA는 first-red.raw.sha256에 남겼다. 실패 개수·유형·상태·실행시간0은 바꾸지 않았다. 아바타 동일 부위 제작/검증 사이클은 시작하지 않았고 전체1~6단계는 미완료다.

## 실제 실행과 리뷰

| 실행 | 결과/실행 경계 | 증거 |
|---|---|---|
| 최초 구현 | 합성37건 실패/오류/skip0 | [XML](initial-green.xml) |
| 작성자 리뷰 red | 39건 중2건 실패: 중단 이후 다음 factory1회 / cleanup-error callback→close 교착1000ms | [원본 유지 사본](review-red.xml) |
| P2 수정 | 준비 직전 소유권 재확인, callback 비차단/예외 소비 후39건 실패0 | [XML](review-green.xml) |
| 전체 회귀/최종 | 전체366건, 추가 close·여러 해제 실패/callback case 포함 최종367건(자원40) 모두 실패/오류/skip0 | [전체](full-regression.xml), [최종](accepted-regression.xml) |
| 정적·build | 타입/Biome94파일·production build 성공 | [타입](accepted-typecheck.stdout), [Biome](accepted-biome.stdout), [build](accepted-build.stdout) |
| production 누출 감시 | 합성 sentinel 의도한 exit1 / 제거·재build 후 공개JS1의 후보/진행/자원 문자열0 | [음성 stdout](production-guard-negative.stdout), [최종 guard](final-production-guard.stdout) |
| 실제 Chrome | 7흐름10.9초, 실패/skip/flaky0. 현재 웹 추천/직접 선택 입구·오류/빈 상태·키보드/좁은 노트북·DEV 경로 제외. 계정은 mock | [stdout](selection-browser.stdout), [report](selection-report.json), [실제 production 시작 화면](production-start.png) |

각 Chrome case의 camera 호출·모델/GLB 요청·pageerror·storage0을 확인했다. 화면 PNG는 웹 UI만이며 카메라 영상이 아니다. UI 재설계/Figma/외부 디자인 감사/전문가/실제 운동 검증은 하지 않았다. 기존 화이트·블루 웹 디자인을 유지했다.

코드 리뷰 스킬의 정확성·보안·성능·유지보수 관점으로 controller와 diff를 작성자가 검토했다. P2 두 건은 실패 재현 후 수정/회귀 통과이며 scope 미해결 P1/P2 없음이다. 외부/독립 심사·전체 출시 문제0을 의미하지 않는다. 실제 ports의 dispose 정확성/중단 안 되는 권한 팝업·asset/코칭 통합, 이월/실측/참여자·사업/운영 게이트는 남았다.

## 증거 보존/재현

최초 XML/hash는 그대로 보존했다. 이후 [collector](collect-proof.mjs)는 소유 scratch의 정해진 정규 파일/크기만 읽고 기존 내용이 다르면 덮어쓰기를 거부한다. 새 사본의 workspace/file URL·scratch 경로와 XML 로컬 hostname만 치환하며 개수·시간·성패는 유지한다. [manifest](artifacts.json)는 raw/공개 SHA-256을 함께 보존한다. 원본 stdout/XML·Chrome JSON/PNG는 기존 private scratch/worktree에 그대로 있다. sentinel fixture는 누출 차단 시험 후 제거됐고 복구한 실제 build를 재검증했다.

로컬 재현: `frontend`에서 `pnpm exec vitest run src/coaching/resources.test.ts`, `pnpm test`, `pnpm typecheck`, `pnpm check`, `pnpm build`, `node scripts/check-selection-production.mjs`, `node scripts/test-selection-browser.mjs`. Chrome/소유 local listener가 필요하며 마지막 시험의 계정은 mock이다. 실제 계정 서버/운영 DB/SMTP/Google/TLS·아바타 제작/검증·실제 사용자를 대신하지 않는다.
