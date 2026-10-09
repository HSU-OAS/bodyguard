# S6.15 — 로그인 소유 두 아바타 렌더 준비 통합

2026-10-09 · 최신 main c15608a(PR98) · FR-A-01/02/03·FR-U-04·FR-S-04·NFR-07/08.

## 목적과 경계

GPU 준비를 진단 fixture 안에만 두지 않고 재사용 가능한 renderer 준비 함수로 구현한다. 실제 AuthProvider/useRecordedCoaching/API/격리 SQL의 비공개 코칭에서 두 원본 모델 준비→재생, 준비 중 권한 회수→늦은 완료 차단, 새 소유자의 명시 재시작을 검증한다. 준비 draw를 관찰/올바른 자세/타이머로 적립하지 않는다.

준비 함수는 이미 설정된 scene·camera·renderer를 빌려 compileAsync와 첫 GPU upload draw를 수행한다. 배치·조명·재질·화질·모델·renderer 생성/최종 폐기는 caller가 소유한다. native 자원 owner가 주는 lifetime signal을 호출 전/compile 후/draw 후 확인한다. compile/draw 실패를 삼키지 않으며 빌린 자원을 임의 폐기하지 않는다.

기존 main·Worker opt-in/SDK 제품 정책·공개 UI/문구·GLB·임상 판정·운영은 변경하지 않는다. 같은 부위 조형은 재개하지 않는다. 최소 텍스트·필수 안전 안내와 실패/원본 보존을 유지한다.

## 명세 → 하네스 → 구현 → 검증

- [x] 구현 전 import RED(실행 assertion0)·구현 후7건 GREEN: shader await 전 draw 차단, 사전/대기/draw 직후 취소, sync/async compile 실패·draw 실패·차용 자원 보존. 최초 assertion7 RED로 세지 않는다.
- [x] production-private 준비 helper와 실제 로그인 소유 native fixture 연결. 기본 호출은 opt-in 없음.
- [x] actual Chrome/SDK/Auth/API/새 격리 DB의 남녀 prepared14+14·기본12+12 실행. 준비/재생/중단/본인 기록·가림/로그아웃/서버401/새 소유 회귀. 준비 중 hold는 시험 전용이고 실제 GPU hang으로 세지 않는다.
- [x] 준비 중 logout/이탈/늦은 compile 완료4건에서 ready/재생/관찰/record0·카메라/SDK/모델 회수·자동 재시작 없음.
- [x] 전체 FE1411·타입·Biome272·backend Ruff·직렬 public build/guard·원본/SDK/public byte·증거360/source12/current hash·diff·작성자 scoped 리뷰 통과. 원격 PR diff/CLEAN/체크/main 포함은 다음 별도 Git 게이트이며 미리 완료로 표시하지 않는다.

PR90의 원래26건은 당시 Draft의 추가 목2건과 parameter 구성이 다르다. 현재24건을 원래26건 통과로 표시하지 않는다. 시작 P2의 근본 원인/해결과 실제 사람/노트북·최종 외형·승인 공개 구조/SDK·D2/전체1~6은 별도 미충족 게이트다. 실제 GPU/native 성능이 매끄럽다는 주장이나 출시 적격 승격은 하지 않는다.

실패2건·보완된 실제 흐름·검증/작성자 리뷰의 [증거와 한계](../review/owned-render-preparation/README.md)를 보존한다. 테스트 분할 `--grep`는 원래 제한을 바꾸거나 실패 사례를 제외한 것이 아니다. prepared28/default24와 과거26은 별도로 보고한다.
