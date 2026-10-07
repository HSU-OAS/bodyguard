# S2.T7 — 세션·재생 자원의 순차 종료

상태: 명세·최초 하네스 작성 / baseline `4a9c8f54eabd969c53bebc01d7d979cee457f1d7` / `codex/owned-playback-resources`

FR-S-02/04·FR-M-07·FR-A-03·NFR-07/08. 기존 controller는 세 자원을 병렬 정리한다. S2.T6의 입력/결과 대기가 끝나기 전에 SDK나 카메라를 닫지 않도록, 한 세대의 세 포트를 하나의 종료 장벽으로 연결한다.

## 수용 기준·하네스

1. 카메라·추론·아바타·source factory, scheduler/render와 고정 실패 observer를 명시 주입한다. 생성만으로 획득/재생0. native factory는 별도 lifetime signal을 받으며, 부분 실패를 스스로 정리한다. 출시 동작·SDK 통신 정책·의학 판단을 만들지 않는다.
2. 기존 controller/session의 준비→명시 재생→일시정지→새 세대 재준비→종료/세션 만료를 연결한다. 같은 세대의 포트는 서로 다른 owned wrapper이고 같은 종료 Promise를 공유한다.
3. 종료 즉시 새 RAF/입력·늦은 결과 전달을 차단한다. pending 입력/결과가 정리된 다음 pair·SDK·카메라를 닫는다. pending native inference 동안 native lifetime signal을 먼저 abort하지 않는다. 생성 중 취소는 lifetime signal을 즉시 abort하며 늦은 owned 반환도 회수한다.
4. 새 세대는 이전 세대 정리 뒤에만 획득한다. 원본 generation/시각/sequence를 바꾸지 않는다. alias는 남의 자원을 dispose하지 않는다. 정리 실패는 고정 cleanup-error로 보존하고 새 준비를 격리하며 나머지 정리를 계속한다. observer throw/rejection·재진입도 누수나 deadlock을 만들지 않는다.
5. 결정적 unit에서 동시 dispose·pending/late·alias·부분 실패·시계/observer·실제 session gate false/만료를 검증한다. 실제 Chrome·가짜 카메라·SDK·남녀 GLB의 준비/재생/보류/중단/재준비/종료를 별도 검증한다. 카메라 입력 촬영/저장/좌표 로그0이며 아바타 canvas만 미리보기로 보존한다.
6. 전체 frontend·타입/Biome/assets/build/공개 guard·공개 byte/GLB 동일·원본 실패/실행 source SHA·작성자 리뷰·최신 PR 게이트를 실제 확인한다. 물리 webcam/실제 참여자·최종 외형·fine joint/판정·승인 UI·전체 GPU/worker/장시간·D2 및 전체1~6 완료는 아니다.

testing-strategy로 단위 경계·실제 browser/SDK 통합·실제 사람 시험을 구분하고 code-review로 순서/소유권/개인정보를 점검한다. 문구는 최소화하고 안전 안내/정적·합성 구분은 유지한다. 같은 아바타 부위 조형·제품 화면/SDK 정책/운영 변경0. 기존 원본·이월·별도 승인 경계를 보존한다.
