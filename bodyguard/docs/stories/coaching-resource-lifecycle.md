# S2.5c — 코칭 자원 수명주기의 독립 연결 기초

최종 통합 준비의 독립 기초 구현·회귀/작성자 검토 완료 · PR 게이트 진행 / main d348fb8b04d2d43572a0281f0e0e3e632f2ef90e · codex/coaching-resource-lifecycle

## 선행 상태와 범위

독립3→4→5→6 구현/현재 웹 교차 흐름·보안 검증 기초 이후, 실제 에셋/사람과 독립적인 자원 정리 계약을 진행한다. **전체3~6단계 게이트를 통과했다는 뜻이 아니다.** 운영/참여자·코칭/아바타/부가 기능의 미충족 기준은 그대로 유지한다. PR #33의 실제 merge/main 포함·source 보존을 확인했다. 기존6f57aa1의 자원 Story/하네스 초안·원본 브랜치는 수정하거나 지우지 않고 참고한다.

FR-S-02/03/04·FR-M-07·FR-A-03·FR-U-04·NFR-07/08에 따라 순수 진행 엔진의 request-camera/release-resources effect를 소비하는 독립 controller를 구현한다. **새 아바타 제작/같은 부위 변형 검증은 시작하지 않는다.** ports는 camera→inference→avatars 순서의 명시 소유 disposable factory다. 이 Story는 factory 합성 시험이며 실제 MediaStream/MediaPipe/GLB·계정/프레임 adapter/사용자 화면·시범/판정/기록 연결은 후속이다. 제품 코칭을 활성화하지 않는다.

## 계약

- 생성/잘못된 effect·0/NaN/과거/중복 generation으로 자원을 만들지 않는다. 새 유효 generation만 요청하고 이전 준비/소유 자원은 먼저 무효화·정리한다.
- 현재 generation의 세 자원 준비 뒤에만 ready를 낸다. 부분 실패는 camera-error/inference-error/asset-error의 고정 notice와 이미 획득한 자원 해제로 처리한다. 자세 분류·각도·타이머/성공 결과는 생성하지 않는다.
- release/pause/end/이탈/만료는 해당 generation만 정리한다. 지난 release가 새 자원을 지우지 않는다. AbortSignal 취소 후 반응하지 않는 factory의 늦은 반환도 정리한다. 브라우저 권한 팝업 자체를 취소할 수 있다고 가정하지 않는다.
- 각 독립 자원은 정확히1회 dispose한다. throw/reject가 다른 정리를 막지 않는다. cleanup-error는 고정 notice이며 새 준비는 차단한다. controller 재생성/복구 화면은 이번에 구현하지 않는다.
- 동일 객체를 stage/generation에 재사용하면 ownership-error로 거부한다. 늦은 과거 factory가 현재 소유 객체를 반환해도 현재 객체를 해제하지 않는다. 실제 ports는 소유권을 보장해야 한다.
- close는 영구 종료/멱등이다. notice callback 예외도 정리를 막거나 새 준비/상태 부활로 이어지지 않는다. raw 오류 메시지·자원/영상·좌표·계정 식별자를 notice/로그/서버/저장소로 내보내지 않는다.
- 실제 제품 gate를 controller effect 자체로 증명하지 않는다. 미확인 인증/동작/두 에셋 gate에서 engine은 request를 내지 않아야 한다. 생산 경로·카메라 권한·공개 route/화이트·블루 UI·임계값/.env/의존성/CI는 유지한다.

## 명세→하네스→구현·검증

[R-01~12](coaching-resource-lifecycle-harness.md)의 합성 비동기 case를 먼저 작성하고 미구현 red를 보존한다. 구현 뒤 전체 Vitest/타입/Biome·production 공개 module 차단·diff·작성자 리뷰를 검증한다. 실제 browser/camera·소유 track/worker/GPU 해제·현실 운동/출시 통과로 표시하지 않는다. 기존 판정 엔진과 본인 기록 API는 변경하지 않는다.

- [x] 최신 main/직전 PR 결과·기존 초안·실제 pose/progression 경계 읽기.
- [x] 계약/첫 R-02 실행형 하네스 작성.
- [x] 실제 Vitest exit1/ERR_MODULE_NOT_FOUND의 [최초 XML/실행 경계](../review/coaching-resources/README.md)를 보존했다. 최초 수집 실패에서는 factory/자원 case가 미실행이었고 기능 통과가 아니었다.
- [x] 나머지 결정적 하네스·controller/engine effect 연결 합성 구현/green 검증. 자원40건 포함 전체 Vitest367건 실패/오류/skip0이다.
- [x] production 제외·정적/회귀·실패 보존·작성자 리뷰P2 두 건 보완/재검증. 실제 production build·정적 검사·Chrome7흐름 및 누출 감시 음성 시험을 실행했다.
- [ ] exact source/최신 diff·main·CLEAN/체크·조건부 merge commit/main 포함·source 보존 확인.

Stage2 D2-A/M/T/R/I/P는 아직 해소되지 않았다. 외부 연결·참여자·Q-17/26/32·운영/라이선스·확정 부가 기능·전체1~6단계는 미완료다. 중요한 안전/개인정보·계정/secret/비용·운영 DB·배포/출시는 별도 승인이다.

## Dev Agent Record

구현: `createResourceController`는 세대별 AbortController와 객체 소유권/해제 Promise를 관리한다. 준비와 해제 모두 순수 효과 소비이며 실제 카메라·모델/에셋 포트는 아직 연결하지 않았다. 세대 교체는 이미 시작한 해제가 끝난 뒤 준비한다. 반응하지 않는 과거 factory는 기다리지 않고, 늦은 반환을 그 세대에서 해제한다. 과거 factory가 현재 객체를 돌려주면 현재 소유권을 건드리지 않고 과거 응답을 버린다. 새 세대의 객체 재사용은 고정 ownership-error로 거부한다.

notice는 비차단 전달이다. callback의 throw/Promise rejection을 소비하고 모든 현재 자원을 정리/새 요청 차단한다. callback이 release/close를 기다릴 수 있으므로 해제 Promise 안에서 callback을 await하지 않는다. callback의 외부 비동기 업무 완료까지 run/close가 기다린다는 계약은 없다. cleanup 실패 시 자원 해제 완료/재시작 가능을 주장하지 않고 poisoned controller의 새 준비를 차단한다.

실제 실패: 첫/전체 계약 red는 모듈 수집 실패라 factory case를 실행한 실패가 아니다. 최초 구현37건 통과 뒤 작성자 리뷰에서 단계 사이 release 경쟁과 cleanup-error→close 대기 교착P2를 발견했고 추가 시험39건 중2건 실패(다음 factory1회,1000ms timeout)를 보존했다. 준비 직전 소유권 재확인과 비차단 callback으로 수정한 뒤39건/최종40건을 통과했다. [검증 원본 hash·사본·작성자 리뷰](../review/coaching-resources/README.md).

전체 프런트367건·타입/Biome94파일·production 공개JS1의 후보/엔진/자원 문자열0·실제 Chrome7흐름을 통과했다. 누출 sentinel은 의도한 exit1로 차단됐고 제거 후 실제 build/guard를 재실행했다. backend/API/DB·공개 route·UI 토큰·판정 임계값·잠금/버전·.env·CI·아바타 파일은 변경하지 않았다. API/SQL291건은 PR #33의 직전 검증이며 이번에 재실행한 것으로 세지 않는다. Chrome 계정 응답은 mock, factory/engine 계획은 합성이며 실제 촬영·track/worker/GPU·사람/관절 정확도/시범·코칭 결과 저장 검증은 미실행이다. 아바타 보완 사이클도 시작하지 않았다.

## File List

- `bodyguard/frontend/src/coaching/resources.ts`, `resources.test.ts`
- `bodyguard/frontend/scripts/check-selection-production.mjs`
- `bodyguard/docs/stories/coaching-resource-lifecycle.md`, `coaching-resource-lifecycle-harness.md`, `stage6-web-security.md`
- `bodyguard/docs/tasks.md`
- `bodyguard/docs/review/coaching-resources/`: README, 최초 XML/hash, bounded collector, artifacts manifest, 계약 red/초기 green/리뷰 red/green/전체·최종 XML, 타입/Biome/build/guard/Chrome stdout·report·production PNG. 생성한 사본은 manifest에 전부 나열했다.

## Change Log

2026-10-05: 독립 자원 소유권·해제 연결 기초 구현, 비동기 실패·리뷰P2 재현/보완, 실제 공개 웹 미노출 검증. 전체 출시 게이트는 미완료 유지.

환경/문서: BMAD resolver/config가 없는 exit2는 기존 명세 직접 실행으로 대체했다(전체 BMAD 실행을 주장하지 않는다). 잘못된 tests 경로 읽기 exit1/문서 patch 문맥 불일치 실패는 제품 시험이 아니며 올바른 e2e 경로/현재 문맥으로 재확인했다. collector 정리 후 unused import 경고1을 제거하고 검사를 다시 실행했다. 실패한 본문·XML/원본은 삭제하거나 성공으로 바꾸지 않았다.
