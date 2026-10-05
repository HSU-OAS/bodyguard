# 관찰 전달·중단 루프 — 독립 세대/예약 연결, 실제 코칭 아님

main1528e9eb · codex/coaching-observation-loop · [명세](../../stories/coaching-observation-loop.md)

실제 main session/engine에 generation/signal을 유지하는 관찰 loop를 연결했다. pending provider는1개뿐이며 null/오랜 응답에서 시간을 성공으로 채우지 않고 tick으로 관찰 만료를 처리한다. pause/close/세대 교체 후 과거 성공·오류/중복 예약 callback을 버린다. 관찰의 sampledAt/sequence/세대/분류를 재작성하지 않는다. **provider·gate·카메라/모델/아바타 자원은 시험에서 합성**이다. 실제 카메라/관절/임상·추천/시범/리타게팅·결과 producer·공개 코칭은 아니다.

| 실행 | 실제 결과 | 증거 |
|---|---|---|
| 최초/계약 red |미구현 import 수집 실패1·시간0; 기능 실행 아님 | first-red.xml, contract-red.xml |
| 초기 |합성15건 실패0, 타입 성공 | initial-unit.xml, initial-typecheck.stdout |
| 작성자 P2 red |19건 중2실패: 이전 예약 callback 중복으로 tick2회 / 동기 scheduler를 차단하지 못함 | review-red.xml |
| 보완/전체 |예약별1회 token과 deferred 검증·취소. 최종430건(새 loop19건) 실패/오류/skip0 | final-regression.xml |
| 정적/build |타입·Biome100파일·build 성공 | accepted-typecheck.stdout, accepted-biome.stdout, accepted-build.stdout |
| production 경계 |own sentinel 음성 시험 exit1, 제거 후 private loop/fixture0·JS1 | guard-negative.stdout, verified-guard.stdout |
| 공개 Chrome 초기 |기존7흐름10.5초·계정응답 mock·카메라/모델0 | selection-report.json |
| 공개+loop Chrome |8흐름10.9초. 실제 RAF1흐름658ms + 기존7. 실제 브라우저이지만 자원/관찰은 합성·카메라0 | accepted-selection-report.json, [현재 웹](production-start.png) |

actual RAF 시험은 시작/일시정지/재개/종료에서 멈춤·old signal abort·세대2·합성 자원6개 각1회 해제·interrupted/page-hidden·verified_ms0를 확인했다. 영상 screenshot/업로드0이며 PNG는 카메라가 꺼진 기존 화이트/블루 웹이다. 실제 RAF 동작을 실제 사람·SDK·성능/정확도·출시 coaching 검증으로 승격하지 않는다.

작성자가 코드 리뷰 스킬의 정확성·개인정보·취소/성능·유지보수 관점으로 검토했다. scoped P2 두 건은 위 실제 red 후 수정했고 현재 이 독립 Story의 미해결 P1/P2는 없다. 기존 SDK 계측 외부 시도 P2는 **Draft [PR #36](https://github.com/HSU-OAS/bodyguard/pull/36) e4df4a9에 미해결**이며 이 Story에서 SDK를 호출하거나 정책을 변경하지 않았다. 별도 중요 개인정보 승인 응답·참여자/외부/운영 연결이 있다고 가정하지 않는다. 전체1~6단계 미완료·아바타 동일 부위 새 제작0·판정 임계값/서버/DB/.env/CI/deps/lock/운영/배포/출시 변경0.

원본 XML/stdout/JSON·초기/현재 공개 PNG를 소유 scratch/작업트리에 보존했다. [manifest](artifacts.json)는 raw/공개 SHA-256이며 collector는 고정 경로/파일·일반파일·크기 제한/기존 byte 보호를 둔다. root/fileURL·scratch/XML hostname만 치환하고 stdout의 표시 공백만 기계적으로 정리한다. 차이가 생기는 공백 전 공개 byte는 original.gz로 보존하고 별도 hash를 기록한다. 실패·개수·계수·시간·원시 결과는 변경하지 않는다. native byte·요청 body·인체 영상/좌표 수집0.

재현: frontend에서 pnpm exec vitest run, pnpm typecheck, pnpm check, pnpm build, node scripts/check-selection-production.mjs, node scripts/test-selection-browser.mjs. 마지막은 소유 local 서버와 차단 proxy·설치된 Chrome이 필요하다. Dev fixture는 production import되지 않는다. Figma·새 UI 디자인/외부 audit·backend/API 회귀는 이 Story에서 실행하지 않았다.
