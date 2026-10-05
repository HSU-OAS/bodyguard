# S2.5d — 코칭 세션·페이지 수명 연결 기초

독립 기초 main 병합 · PR #35 source0b71c2d3db05635701925693406b2630398b5fb0 / merge1528e9eb56425cc288f77d0b94721a19635a752c · codex/coaching-session-bridge

## 범위·선행 상태

PR #34 merge/main/source 보존을 실제 확인했다. 자원 controller는 합성 소유권 기초이며 실제 MediaStream/MediaPipe/GLB·판정/두 아바타/코칭 화면은 아직 미연결이다. 독립3→4→5→6 구현 준비 이후의 최종 연결 기초이며 전체 해당 게이트 통과가 아니다. 현재 같은 아바타 부위 제작/검증 사이클은 시작하지 않는다.

FR-S-02/03/04·FR-U-04·FR-M-07·FR-A-03/NFR-07/08: 순수 진행 엔진과 자원 controller를 실제 TS coordinator로 연결한다. 명시된 plan/ports·게이트 provider·clock·state observer만 사용한다. public route/실제 인증 adapter·동작 classifier·카메라/추론/3D ports·기록 업로드는 이 Story에서 연결하지 않는다. 공급된 gates/관찰은 테스트에서는 합성이며 임상적/실측 검증이 아니다.

## 수용 기준

1. 생성만으로 자원/카메라·추론 요청0. start/resume은 매번 명시 게이트를 확인하고 인증/검증 동작/두 에셋의 true가 아닌 상태에서는 준비하지 않는다.
2. 실제 engine effect→controller·ready→engine 연결. 준비 대기 중 pause/end가 start 완료를 기다리지 않는다. 새 세대·과거 ready와 frame·종료 뒤 응답은 상태/시간/완료를 부활시키지 않는다.
3. ready/tick/observation 전에 현재 게이트를 다시 확인한다. 만료/동작 철회/에셋 준비 상실은 해당 고정 중단 사유로 종료한다. gate provider 오류·clock 오류·observer 오류는 고정 기술 실패로 fail-closed 처리하며 새 준비0이다. raw 오류/계정/좌표를 전달하지 않는다.
4. 각 자원 stage 오류 및 ownership/cleanup 실패를 정확한 고정 사유로 종료한다. 기존 engine의 제한된 end reason에 resource/clock/gate/callback 기술 사유만 추가하며 판정 수치·서버 저장 필드는 변경하지 않는다. 기술 실패를 사용자 중단/임의 자세 오류로 꾸미지 않는다.
5. 실제 관찰값만 engine에 제출한다. constructor/ready/tick/시간 흐름만으로 성공/유지/반복을 생성하지 않는다. getSnapshot은 engine의 동결 상태·closed·고정 failure만 반환하며 자원/프레임·원본 오류를 노출하지 않는다. observer throw/reject/reentrant pause/close도 정리를 막지 않는다.
6. 독립 DOM lifecycle binder는 hidden/pagehide/해제 시 명시 page-hidden 중단·owned listener 제거를 수행한다. visible로 돌아왔다고 자동 재시작하지 않는다. 실제 브라우저 카메라/track/GPU와 세션 서버 polling을 시험한 것으로 주장하지 않는다.
7. module/합성 plans·fixtures는 production에 포함하지 않는다. 기존 공개 웹·화이트/블루 UI·계정/기록 API·임계값·deps/lock·CI/.env/원본 에셋을 유지한다. 합성 세션·DOM EventTarget 검증과 실제 Chrome/운영/사람은 구분한다.

## 하네스와 작업

T-01: 생성/각 gate false·unknown; T-02: ready/pause/resume/end; T-03: pending permission/세대/이탈; T-04: ready·tick·frame 시 gate 만료/철회/에셋 상실; T-05: stage·ownership·cleanup/clock/provider/observer 오류; T-06: zero observation 성공0/늦은 frame·unobservable; T-07: observer reentrant/예외; T-08: 실제 EventTarget hidden/pagehide/dispose/listener 제거/재시작0; T-09: 전체 프런트/정적/build·production 미노출. 모든 ports/plan/clock/gates는 합성 fixture다.

- [x] 최신 main/PR #34 실제 결과·현재 engine/controller/기록 API 저장 경계 재확인.
- [x] 명세·결정적 하네스와 실제 미구현 red 보존. 수집 실패/시간0을 기능 실행 실패나 성공으로 표시하지 않았다.
- [x] coordinator·고정 기술 사유·lifecycle binder·T-01~08 합성44건 실행/green.
- [x] 전체411건·정적/build·public 미노출·실제 Chrome7흐름, 타입 실패/작성자 리뷰P2 세 항목 보존·보완·회귀. 현재 scope 미해결P1/P2 없음.
- [x] PR #35 exact tested source0b71c2d3·필수 검증·scope P1/P2 없음·latest main/diff/CLEAN/MERGEABLE·체크 없음·외부reviews0 확인 후 merge1528e9eb로 병합했다. 실제 부모/main 포함·원본 로컬/원격 source 브랜치 보존·working tree clean을 확인했다.

실제 ports/신체/동작 검증·두 아바타/3D·코칭 UI/결과 저장·Stage2 D2-A/M/T/R/I/P·확정 부가 기능·외부 계정/시크릿·Docker/TLS/운영·법무/라이선스·참여자/전문가·전체1~6단계는 미완료로 유지한다. 별도 승인 경계를 건너뛰지 않는다.

## Dev Agent Record

기술 권장안: 허용되지 않은 임의 gate를 UI가 전달하는 시작 API를 만들지 않고 명시 provider에서 읽는다. coordinator 생성이 provider의 실측/서버 인증을 증명하지 않는다. 상태 갱신과 effect 호출은 즉시 수행하고 장시간 준비 Promise를 다른 중단 작업 앞에 직렬화하지 않는다. callback 오류 처리도 재귀 전달하지 않는다. 기록 API는 end reason을 저장하지 않으므로 이번 고정 기술 사유 확장은 저장 데이터/DB 변경이 아니다.

실제 progression↔resource controller↔session coordinator와 owned DOM listener를 연결했다. 아직 ports/관찰/gate는 합성이며 실제 클라이언트 인증·모델/에셋·코칭 화면 adapter는 아니다. gate 속성 읽기를 guarded provider 안에서 수행하고 strict boolean만 새 동결 객체로 가져온다. clock이 유효한 gate 상실 시 현재 종료 시각을 보존하고, clock 자체가 실패하면 마지막 유효 시각을 사용한다. 이미 종료된 결과에 나중 cleanup 오류가 있으면 최초 종료 사유를 바꾸지 않고 fixed failure를 별도로 남긴다. 여기에 새 자세 판정·시간 기본값·영상/좌표 저장·전송은 없다.

실패/실행: 첫/계약 red는 모듈 수집 실패였다. unit37건 통과 뒤 TS2322 mock constructable/callable 타입 오류2를 보존/명시 dispose mock 타입으로 수정했다. 전체404건 뒤 작성자P2의 즉시 listener 제거/유효 종료 시각 추가시험42건 중3실패, gate accessor 예외44건 중1실패를 보존했다. 보호된 gate 복사/시각 전달·listener 즉시 제거로 보완 후 최종411건(세션44) 실패/오류/skip0·타입/Biome97·production build/guard0을 통과했다. 합성 sentinel 의도한 차단 exit1 후 제거/rebuild 성공, 실제 Chrome 기존7흐름11.3초 실패/skip/flaky0이다. [raw/public hash·실패·실제 화면](../review/coaching-session/README.md).

관찰자/수행자 참여 가능 여부만 CEO에게 비동기로 요청했고 아직 답/동의/실측 완료를 가정하지 않았다. 외부/법무/개인정보 동의·실제 촬영은 별도 확인이 필요하며 비용/계정/secret·운영/배포 승인은 적용하지 않았다. 문서 patch 문맥 불일치2는 수정 사항을 반영하기 전에 실패했으며 현재 문맥으로 재적용했다. 공개 UI는 변경하지 않았고 지정 디자인 스킬의 새 UI/Figma/외부 감사 실행을 주장하지 않는다.

## File List

- `bodyguard/frontend/src/coaching/session.ts`, `session.test.ts`, `lifecycle.ts`
- `bodyguard/frontend/src/stretch/progression.ts`의 제한된 기술 종료 사유만 확장
- `bodyguard/frontend/scripts/check-selection-production.mjs`
- `bodyguard/docs/stories/coaching-session-bridge.md`, `coaching-resource-lifecycle.md`, `bodyguard/docs/tasks.md`
- `bodyguard/docs/review/coaching-session/`: README/collector, 최초·계약·초기 green·전체·두 리뷰 red·409/최종411 XML, 최초/수정/최종 타입·Biome·build·음성/정상 guard·Chrome stdout/report/PNG와 두 raw/public hash manifest. 생성 사본 전체는 manifest에 나열했다.
- `bodyguard/docs/review/coaching-session/public-bundle-hashes.json`은 실제 보존 build/최종 build의 공개 JS/CSS 비교 결과다.

## Change Log

2026-10-05: PR #34 이후 최신 main의 독립 연결 Story 구현·실행형 하네스/3항목 P2 보완·회귀. 실패/실측/출시 기준을 유지한다.
