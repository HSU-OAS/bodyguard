# S6.3 시작 준비 하네스 — 현재 검증과 과거 실패

2026-10-07 · test-only · 기준 main `991ed2b` · 제품 시작 성능/인증/카메라 검증 아님

현재는 [실행 소스·숫자 증거](current-20261007/summary.json)의 **하네스 범위만 필수 검증 통과**다. 실제 production/dev × HTTP/route의 첫/재탐색5개, 기존 동작 선택8개, 실제 로컬 API/격리 PostgreSQL의 도움말3개·기록11개·기존 공개/계정 스타일3개를 통과했다. 메일·계정/수행 예시 데이터는 합성이며 실제 사람·촬영·효과·새 디자인 승인이 아니다. 전체687 frontend·type/Biome/build/production DEV guard도 통과했다. 수집 source hash가 아니라 실행 전후 source/dist hash를 보존한 [실행 목록](current-20261007/executions.json)이다.

과거 `startup-20261007T001834237Z`는 소유 포트/API 경계1개 통과·비교4개 실패로 보존한다. [당시 실제 결과](evidence-review-provenance/browser-20261007T001834237Z.json). 이번 구간에서는 그 시작 지연이 재현되지 않았으며 원인이 해결됐다는 뜻이 아니다. 동작 판정·아바타·운영 성능·단계6·전체1~6은 통과하지 않았다.

## 실제로 발견·보완한 실패 수집 문제

의도적 실패 `startup-20261007T061046118Z`는 페이지 닫기 이후에도 matcher 오류에 이미 저장된 ARIA를 error-context에 남겼다. Playwright1.63.0의 로컬 worker가 matcherResult.ariaSnapshot을 errorContext로 복사하는 경로를 직접 읽어 원인을 확인했다. 제품 시작 지연의 원인과는 다른 문제다. 원본은 비공개 test-results/고유 scratch에 보존하며 raw DOM 파일을 저장소에 복사하지 않는다.

동일 heading/attached-visible 조건과5000ms를 유지하는 공개 [Locator.waitFor](https://playwright.dev/docs/api/class-locator#locator-wait-for)로 확인하고 boolean만 assert한다. 숨김·미도착·늦은 준비는 여전히 실패다. [toBeVisible의 가시성 조건](https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-visible)과 같은 비어 있지 않은 영역·visibility 조건이며 전체 case30000ms는 그대로다. 페이지 정리도 유지한다. 내부 Playwright patch·미공개 설정·timeout 연장은 사용하지 않았다.

보완 후 의도적 실패도 exit1/failed1을 유지했다. 검증기는 과거 출력에서 실제 RED, 보완 출력에서 통과했다. [현재 경계 결과](current-20261007/negative-artifacts.json): 런타임 표식/ARIA snapshot 없음. 실패 디렉터리의3개 텍스트 파일 검사는 고정 오류·시험 소스와 실제 화면 원문을 구분한다. 의도적 실패를 일반 제품 테스트 통과로 세지 않는다. proxy-ready/dev-ready 취소는 각각exit1·소유 listener 정리로 확인했다.

원본은 실행별 test-results와 `/private/tmp/bodyguard-startup-proof.eSGnm9`에 유지한다. `evidence`와 `evidence-review`는 수정 전 수집 자료다. 원본 DOM/ARIA snapshot·개인정보·인증값·원시 콘솔을 새로 공개하지 않고 제한된 숫자·상태만 수집한다.

P2 기록 정합성 보완: 기존 수집기의 `finalHarnessSource`는 실제 실행 시점의 소스 hash가 아니므로 실행 소스 검증으로 사용하면 안 된다. [수정된 수집 결과](evidence-review-provenance/manifest.json)는 `sourceHashTiming: collection-time`, `sourceAtRunVerified: false`, `selectedReviewRun`으로 정확히 구분한다. collector의 node 문법 검사와 새 보존 디렉터리 수집은 실제 실행해 12 artifact / 30 original 보존, `mergeAllowed: false`를 확인했다. 이것은 브라우저 재실행이나 회귀 통과가 아니다.

최초 `probe-unit-red.log`는 의존성 다운로드 실패이며 단위 RED가 아니다. 실제 단위 mutation RED는 `probe-observer-negative-red.log`의2실패/1통과, 이후 정상 probe3통과다. 현재 helper 포함5개와 전체687개를 실행했다. 과거 증거의 시점·소스 한계를 현재 실행 검증으로 대체하지 않는다.

현재 원본은 `/private/tmp/bodyguard-startup-causal.5nrCWY`와 frontend/test-results의 고유 경로에 보존한다. 전용 임시 PostgreSQL18.6·bodyguard_test 역할/DB·Unix socket·TCP 비활성·독점 잠금만 사용했고 실행 후 해당 소유 클러스터만 정지했다. 파일/실패 증거는 삭제하지 않았다. 생산 인증·제품 코드·기존 테스트·새 화면·아바타·외부 공급자·운영 변경은 없다.

남은 시작 지연 원인은 [Story](../../stories/web-startup-readiness.md)를 따른다. 실패를 환경 탓으로 확정하지 않는다. 이 Story는 계측/하네스 구현이며 출시 성능 결함 수정 완료가 아니다. Draft #51은 별도 source의 회귀를 재확인하기 전 병합하지 않는다.
