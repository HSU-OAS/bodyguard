# 실제 카메라·추론 소유 포트 — 비공개 구현, 개인정보 gate 미충족

main1528e9eb · codex/coaching-browser-ports · [명세](../../stories/coaching-browser-ports.md)

실제 웹 브라우저의 카메라 스트림과 Pose/Gesture/Face 모델을 준비·중단·교체·종료하는 소유 포트를 구현했다. 실제 Chrome의 **가짜 카메라**에서 모델3개의 초기화·추론 API 호출·native close3회 오류0·track ended·video 분리를 확인했다. 사람/관절 정확도·실제 카메라 권한 popup·GPU/worker 메모리 완전 해제·노트북 성능은 확인하지 않았다. 제품에는 연결하지 않았다.

**B-09 미충족/P2:** SDK1.0.1이 계측 서버로 외부 요청을 시도했다. 외부 차단 proxy/route가 막아 시험에서 전송 성공을 허용하지 않았지만, 제품에 차단 경계가 없는데 개인정보 게이트를 통과한 것으로 세지 않는다. 첫 브라우저 시험은 외부 시도3건으로 실패, 최소 protocol/origin을 기록한 재시험은2건으로 실패다. raw 영상/좌표·요청 본문·외부 수신/개인정보 payload는 수집/검사/저장하지 않았다. 실패2회를 성공으로 바꾸지 않았다.

| 실행 | 실제 결과 | 증거 |
|---|---|---|
| 최초/계약 red | 미구현 import 수집 실패1·시간0, 기능 실행 아님 | first-red.xml, contract-red.xml |
| 최초 unit |118건 중2실패: permission 요청 전에 abort한 시험, 동시 준비에서 과거 actor가 새 actor를 덮어씀 | initial-unit.xml |
| 소유권 P2 red |34건 중3실패: 동시 카메라 요청2회 / 다른 signal의 추론 허용 / 외부 options의 모델 변경 허용 | ownership-review-red.xml |
| 보완 | 마지막 세대만 취득, 원래 signal 일치, 모델 선택을 생성 시 보존. 상세122건 실패0 | ownership-review-green.xml |
| observer P2 red |34건 중2실패, observer 오류를 cleanup 오류로 잘못 분류 | observer-review-red.xml |
| 전체 회귀 |최종446건(새 browser ports35건) 실패/오류/skip0 | final-regression.xml |
| 타입/Biome/build |타입·Biome104파일·production build 성공 | accepted-typecheck.stdout, accepted-biome.stdout, verified-build.stdout |
| production 경계 |sentinel 의도한 exit1 → 제거·재build 후 비공개 port/후보/엔진/fixture0 | production-guard-negative.stdout, verified-production-guard.stdout |
| 실제 Chrome native |초기화3·close3·track ended 성공, 외부 시도로 **실패** | native-browser-initial.json, native-browser-diagnostic.json |
| **시험 전용 CSP 진단** |connect-src self 헤더를 시험 HTML에만 주입. native 동작 유지·SDK 시도는 CSP 차단·네트워크 요청0.1건 성공3.8초 | test-only-policy-initial.json |
| 공개 웹 Chrome |기존7흐름10.6초·카메라/모델 요청0·계정응답 mock·화이트/블루 유지 | selection-report.json, [실제 화면](production-start.png) |

설치된 @mediapipe/tasks-vision/README.md의 Privacy Notice는 on-device 처리와 별개로 성능/이용 계측 전송을 설명한다. 고정1.0.1 타입에는 공개 opt-out 옵션이 없으며, minified/private 속성 monkey patch·deps 변경으로 우회하지 않았다. 제품 통신 정책은 중요 개인정보 결정이라 CEO에게 **로컬 코드/테스트/PR만, 비용0, 모델/외부 서비스 회귀 위험, 문제 시 정책 revert+코칭 비공개 유지, 배포 제외**의 권장안으로 별도 승인 요청했다. 응답/승인을 가정하지 않는다. CSP 진단 성공은 제품 정책 승인·적용·배포 검증이 아니다.

새 camera lease는 동일 session generation/signal을 요구하고, 부분 초기화 실패/늦은 task도 close한다. 하나의 close/track stop이 실패해도 나머지 해제를 시도하며 고정 cleanup-error로 격리한다. observer 실패는 callback-error로 구분하고 재호출/원시 오류 노출 없이 준비를 차단한다. 과거 track ended는 새 세션을 끝내지 않지만 과거 cleanup 실패는 현재 자원까지 정리한다. 알려진 자원만 즉시 해제하고 권한 popup/진행 중 SDK 생성 자체를 취소했다고 주장하지 않는다.

작성자가 코드 리뷰 스킬의 정확성·개인정보·성능·유지보수 관점으로 검토했다. 위 재현 P2는 보완했으나 **외부 SDK 통신 P2는 미해결**이고 조건부 병합 게이트도 미충족이다. draft PR로 보존하며 독립 작업을 계속한다. 기존 아바타 제작/검증·실측·임계값·공개 코칭·결과 producer·서버/DB·CI·deps·secret·운영·배포·출시·Figma/새 디자인 외부 감사는 실행하지 않았다.

최초 전체 명령 pnpm test -- --reporter=…는446 이전445건을 실행했으나 이중 -- 때문에 XML reporter 인자가 적용되지 않았다. test exit0 뒤 없는 XML의 rg 확인 exit2였다. initial-regression.stdout를 보존했고 pnpm exec vitest run --reporter=junit로 재실행한 실제 XML을 별도 수집했다. 초반 경로 추정 sed/rg 실패·Biome non-null/optional-chain 경고도 로컬 작업 이슈였으며 제품 검증 성공으로 세지 않았다. 최신 타입/Biome는 경고 없이 통과했다.

원본 report/stdout/XML·실제 웹 PNG를 소유 scratch/작업트리에 보존했다. [manifest](artifacts.json)는 원본/공개 SHA-256이다. collector는 고정 파일/경로·크기·일반파일만 허용하고 root/file URL·scratch/hostname만 치환하며 기존 byte가 다르면 덮어쓰기를 거부한다. 계수·시간·성패·SDK 시도는 치환하지 않는다. 영상 screenshot은0이며 PNG는 카메라가 켜지지 않은 공개 웹이다.

Draft PR #36 생성 직전 diff check는 원본 도구 stdout의 줄끝 공백·EOF 빈줄로 exit2였으나 이어진 shell 명령이 멈추지 않아1ea0eb2 commit/푸시가 진행됐다. **그때 diff check 성공이라는 표현은 잘못이므로 정정한다.** 새 보완 commit에서 공개 stdout만 기계적으로 줄끝 공백을 정리하고, 변경 전 공개 byte는 각각 .original.gz에 그대로 보존했다. private 원본·이전 commit·manifest는 바꾸지 않았다. [별도 formatted manifest](artifacts-formatted.json)는 raw/변경 전 공개/현재 공개 SHA 및 원본 gzip 이름을 기록한다. gzip 복원 byte는 기존 manifest SHA와 실제 대조한다. whitespace 검사를 끄거나 범위 제외하지 않고 git diff --check를 다시 실행한다. SDK 개인정보 P2는 이 형식 보완과 무관하게 여전히 미해결이다.

재현: frontend에서 pnpm exec vitest run, pnpm typecheck, pnpm check, pnpm build, node scripts/check-selection-production.mjs. node scripts/test-browser-ports.mjs의 일반 B-08/B-09 시험은 현재 외부 시도 때문에 실패해야 한다. --grep 'diagnostic local CSP'는 제품 아닌 시험 정책 진단이다. node scripts/test-selection-browser.mjs는 공개 웹/개발 선택 회귀다.
