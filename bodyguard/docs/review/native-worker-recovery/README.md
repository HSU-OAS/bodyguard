# S6.12 — 응답 없는 Worker 실패 복구 증거

2026-10-09. 기준 main `f26c7b901d4c31fdbf26c4fbebf360417c6cfab4`. 비공개 Worker 소유 경로만 변경했다. 전체 출시 후보·실측·아바타 외형 승인 완료가 아니다.

## 실제 작동 흐름

실제 Chrome·MediaPipe·FastAPI·새 격리 PostgreSQL18에서 남녀 각각 다음을 확인했다. 카메라·메일·동작 gate는 합성이며 A37은 미완성이다.

- 준비 전에 시험 Worker를 종료하면 한정된 대기 후 세션 종료·카메라 분리·모델0이다. 최초 ready가 없으므로 저장/이전 재개로 기록을 만들지 않는다(POST0·목록0).
- 실제 세 모델 준비와 두 WebGL 아바타 표시 후 Worker를 종료하면 추론 권위가 실패하고 카메라를 닫는다. 명시적 저장은 본인 `interrupted`, observed_ms0·repetitions0·client-reported 한 건만 만들며 이전 재개는 새 카메라를 열지 않는다.
- 정상 실행→중단/본인 기록, 준비 중 로그아웃→이전 재개/저장 차단, 같은 계정 갱신→종료→명시적 새 소유 시작은 기존대로 동작한다.

강제 종료4건은 native close ACK가 없어서 `cleanup-error`를 남긴다. Worker 종료·프레임/카메라/렌더러 회수는 확인했지만 **SDK의 정상 close 완료로 세지 않는다**. 모든 경우 main realm SDK 호출0·외부 요청0·원시 저장0·JS 오류0, 닫힌 frame 수=생성 수·모델0·renderer memory=baseline을 확인했다. 정상6건의 cleanup 오류는0이다. 실제 양성 신체 결과·사람·물리 카메라·동작 정확도는 검증하지 않았다.

## 실패 재현과 수정

1. 기존 소스의 실제 Chrome에서 `self.close()`를 주입했다. 11000ms 뒤 준비/추론이 아직 pending이고 카메라가 살아 있었다. Worker close1·error0였다. 관찰용 helper의 exit0은 결함 관찰 완료이지 제품 통과가 아니다.
2. 구현 전 단위 RED는17통과/3실패. 고정 응답 한도와 별도 정리 한도를 추가한 첫 GREEN은20통과다.
3. 작성자 리뷰에서 main의 타이머 callback이 지연될 때 늦은 ready/result가 먼저 처리될 수 있음을 재현했다(20통과/2실패). `performance.now()` deadline 대조를 추가한 최종 단위는22통과다. 이 시간은 임상 수치·운동 타이머가 아니다.
4. 최초 실제 소유 흐름은6통과/4실패. 강제 종료의 본문 흐름은 진행됐으나 afterEach가 예상된 고정 cleanup 오류를 무조건 실패 처리했다. 최종 하네스는 그 오류를 **반드시** 검증하고, 다른 오류는 다시 throw한다. 정상 사례의 오류 없음·원래 정상 준비5000ms 조건은 바꾸지 않았다.
5. 최종 실제 소유 흐름10통과/skip0/flaky0/errors0. fault 종료 관찰에는 응답5초+기존 정리5초를 구분해12초를 사용한다. 수행 중 카메라 종료는 별도7초 관찰로 확인한다. 시험 시간은 요청부터 자원·기록 검증까지 전체이며 시작 성능 개선 주장에 쓰지 않는다.

초기 low-level GREEN 관찰은 최종 deadline 보완 전 소스다. 준비 실패 시 카메라 종료, 추론 Promise 거부를 확인했지만 이 helper의 read에는 제품 소유 controller가 없어 추론 실패 후 카메라를 자체 종료하지 않는다. 그 결과를 제품 카메라 회수 증거로 쓰지 않으며 최종 controller/계정 연결10건으로 검사한다. 본문 원본·실패·보완 전/후 SHA는 모두 보존했다.

## 최종 검증과 보존

실행 당시 같은 최종 소스에서 frontend1344·Worker client22·실제 소유 Chrome10, type/Biome266파일/build/공개 guard·`git diff --check`를 통과했다. API 로직/DB migration은 변경하지 않았으며 전체 API suite를 이번에 재실행했다고 주장하지 않는다. 전용 DB는 PostgreSQL180006·외부 TCP 비활성이고 검증 후 정상 종료했다.

공개 JS355151bytes SHA `b5d4f81164c8d3c196e853b3404382bc15077986aa626cd0c3c72571b6325ac0`, CSS31199bytes SHA `043cb9bdb5d82a3baa9a8463c7a641cbe92ace213303f20c6c7f91e9a14ac82e`로 이전 출력과 같다. 남녀 원본/GLB·모델·디자인/문구·기본 main 추론은 변경0이다. 설치의 오프라인 tarball 부족 exit1은 frozen-lockfile 정상 설치로 이어졌으며 보안 정책/잠금 버전은 바꾸지 않았다.

`manifest.json`은 실행 receipt/stdout/stderr, RED/GREEN, 실제 브라우저 보고서·실패 context·상태 summary98개 gzip 사본과 시험 소스5개의 SHA를 포함한다. `node bodyguard/docs/review/native-worker-recovery/verify.mjs`로 보존 bytes와 현재 소스를 확인한다. 생성된 증거만 압축했고 이전 파일/증거는 덮어쓰거나 지우지 않았다. 원시 프레임·좌표·신체 값·실제 회원 데이터는 없다.

## 작성자 코드 리뷰

독립 제3자 리뷰가 아닌 작성자의 security/performance/correctness/maintainability 검토다. 응답마다 O(1) 타이머 하나, 취소/유효 응답/실패/폐기에서 해제, 기존 한 프레임/세대/시각 대조와 clone 해제·native 정리 한도·오류 고정화를 확인했다. 재현된 늦은 응답 경쟁을 보완했고 같은 입력의 세 모델·SDK/판정/기본 경로·공개 출력은 유지한다. 테스트 고장 주입은 비공개 e2e에만 있다. 이 목적의 미해결 P1/P2는0이며 최종 PR diff·main/head·충돌/체크 조건은 별도로 읽는다.

## 아직 남은 필수 기준

기존 간헐적 시작 P2와 PR90/91, D2 외형/실측/올바른 시범·최종 두 아바타 통합, 공개 구조 적용·SDK 제품 외부 통신 정책·참여자/노트북·Docker/HTTPS·외부 공급자/운영과 전체1~6 기준은 미완료다. 반응 없는 **idle** Worker의 독립 heartbeat를 새로 구현한 것이 아니며 요청별 유한 실패를 보완한 것이다. main 이벤트 루프 자체가 멈추면 타이머/정리도 즉시 실행될 수 없지만 늦은 응답을 정상으로 승격하지 않는다. 서버·시크릿·운영 DB migration·배포·출시 없음.
