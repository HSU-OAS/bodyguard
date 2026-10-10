# 현재 기록 웹 — 실제 HTTP·SQL 회귀

[S6.20 명세](../../stories/web-http-records-regression.md) · [실제 결과·원본 SHA](manifest.json)

기록의 최소 문구를 반영한 현재 웹에서 **가입→탐색 준비→기록 상세→삭제 취소/확인→계정→로그아웃**을 실제로 마쳤다. 날짜 오류 뒤 올바른 기간으로 돌아가기, 페이지 이동/상세 복귀, 읽기 실패 복구, 타인 격리, 삭제 대상 변경/만료·추가 기록 보존, 로그아웃 뒤 늦은 응답 차단도 확인했다. 기존 화면·제품 기능/정책은 바꾸지 않았다.

## 발견과 보완

PR109의 짧은 문구가 실제 화면에 있었지만 WEB-I01은 제거된 긴 안전 안내를, RW03은 옛 날짜 오류 문구를 찾았다. 수정 전 통합은1통과/1실패, 기록은10통과/1실패였다. 각각 삭제 이후 흐름과 잘못된 기간 뒤 복구가 실패 지점 뒤여서 최초 실행의 완료로 세지 않는다.

두 시험의 기대 문구만 현재 계약으로 교체했고 안전 안내는 `exact: true`, 날짜 오류는 `toHaveText`로 정확히 검사한다. 제목·버튼/메뉴·동작·API/인증·SQL·CSS·timeout·재시도는 변경0이다.5000ms expect/30000ms case·재시도0을 유지했다. **옛 시작 지연의 해결이 아니라 시험 계약의 실제 회귀 수정**이다.

## 현재 실제 흐름과 경계

- 최종 통합2개와 기록11개를 production 웹/FastAPI/새 전용 PostgreSQL18에서 통과했다. 가입 코드 전달과 저장한 수행 요약은 합성이다. 일부 기록 장애·시각·늦은 응답도 시험 주입이며 실제 Gmail/Google·사람/물리 카메라·동작 정확도 검증이 아니다.
- 통합의 실제 설치 Chrome은155.0.8059.40이다. 카메라0·외부/GLB/WASM/SDK 요청0·pageerror0·local/session storage0을 수치로 보존했다. 기록11개는 같은 경계의 기존 afterEach assertions를 실제 통과했으며 별도 경계 attachment/버전 수집을 새로 추가하지 않았다.
- WEB-I01은 실제 logout204 이후 게스트 화면을 확인하고 보호 주소로 이동해 `/me`401을 확인했다. 첫 green과 최종 모두 `logoutConfirmed:1, logoutFailed:1, csrfFailed:0, movedBeforeConfirmation:false`다. requestfailed1을0으로 바꾸거나 모든 요청이 정상 종료했다고 하지 않는다. 그 실패 이벤트의 상세 원인은 이번 문구 Story에서 확정하지 않았다.
- 1440px 기록 상세와700px 삭제 확인 화면을 실제 PNG로 확인했다. 삭제 기간/대상 건수·복구 불가·취소/삭제 버튼을 유지했다. 화면 구조 승인이나 새로운 디자인 적용 검수가 아니다.

frontend1481/실패·skip0, 타입·Biome298파일(기존 info15·오류0), production build·비공개 producer 누출 guard를 실제 통과했다. 새 증거 helper의 Node 문법과 명시 frontend Biome 설정도 통과했다. DB 소유권 경쟁1개는 migration/reset 전에 다른 하네스를 거부하고 원래 기록을 보존했다. 이번 새 DB는 host reject·TCP 미개방/전용 Unix socket이며 UID/PID/data 경로 확인 후 정상 종료했다. 디렉터리는 보존했다. Docker/운영 DB 시험은 아니다.

## 원본과 검토

실패2회·포맷 전 첫 green·현재 최종2회 각각의 보고서·PNG/error context와 stdout, 원래 test/config/runner/lock, 현재 실행 소스, 전체 unit JSON 및 품질 로그를82개 gzip 원본/SHA로 보존했다. 첫 green은 포맷 전 source로 구분하고, 최종 통합은 포맷 후 실제 재실행했다. 오프라인 설치와 첫 포맷 검사는 실패였고 frozen normal install/포맷 보완 후 검사는 통과했다. 포맷 실패의 별도 raw 파일은 없으며 도구 출력 관찰로 구분한다.

`before-source.json`은 첫 통합 실패 후·수정 전 기록 시험 진행 중에 수집했고 초기 test/config/runner/lock 스냅샷은 첫 실행 전에 보존했다. 증거 수집 때 제품 source/dist/config170개와 대조해 불변을 확인했다. 실행 전후 모든 backend 파일을 계측한 것으로 표시하지 않는다. 공개 번들은 이번 수정 전후 byte 동일하다. `collect.mjs --check`는 압축/원문82개 SHA와 현재 소스11개를 확인하며 browser를 다시 실행하지 않는다. `--record`는 이미 있는 증거를 덮어쓰지 않는다.

engineering:debug·testing-strategy로 실제 실패/제품 계약/미완료 흐름을 분리하고 engineering:code-review로 두 기대값 diff·기존 보안/삭제/타이밍 assertions 보존·원본/현재 SHA·개인정보 경계·미해결 성능 주장을 검토했다. **이 문구 시험 계약과 증거 범위의 미해결 P1/P2는 없으며 작성자 검토**다. 별도 에이전트/전문가 리뷰는 실행하지 않았다. 최신 원격 diff·HEAD·CLEAN·체크를 다시 확인하고 조건부 PR 게이트를 진행한다.

## 유지하는 미완료

최신 CEO 선택은 아바타 보류·독립 웹 진행이다. 원본/실패 보존, 새 아바타 제작/검증0, 미승인 화면 확장0·중요한 개인정보/안전 정책 변경0·운영/배포/비용0을 유지한다. 출시 적격 동작0·실측/참여자·최종 아바타/시범·승인 코칭 구조/SDK·기존 시작 P2/Draft51·외부 공급자/Docker/HTTPS/법무·D2/전체1~6 게이트는 그대로 미완료다. 이 정상 회귀만으로 옛 간헐적 지연을 해결 처리하거나 출시 후보판을 선언하지 않는다.
