# S6.P2a Worker boot 전 실패 복구·SDK 단계 분리

2026-10-16 · 초기 진단 main8675f72 / 보완 시작 main203a6ab · codex/sdk-coaching-startup · FR-M-02/07·NFR-07/08

PR152의 실제 카메라 준비/정리 실패 두 건은 재실행 통과 뒤에도 미해결 P2다. 이 Story는 SDK의 실제 body/face/hands 준비·GPU/CPU 재시도·해제와 parent init/frame/close를 단계별로 분리한다. 원인 증거 없이 순차 호출을 병렬로 바꾸거나 제한 시간을 늘려 통과시키지 않는다.

## 구현 전 하네스·수용 기준

- 같은 native engine/runtime/parent의 heavy+face+hands·GPU→CPU 정책과 원래5초 준비/추론/정리 경계를 유지한다. localhost·기존 모델 SHA/byte 검증·CSP도 유지한다.
- 테스트 전용 Worker entry가 SDK create/close와 실제 protocol을 고정 단계/타입/시각·오류 종류만 기록한다. 영상/관절/계정/모델 바이트를 진단으로 보내지 않는다. 생성한 blank VideoFrame은 사람/카메라 관찰이 아니다.
- 첫 준비→blank 추론→정리와 준비 중 body/face/hands 취소의 실제 경로를 관찰한다. 취소 요청 시각과 Worker가 이를 처리한 시각을 구분하고, clean ack·생성/해제 대응을 확인한다. 관측 자체의 부하/원래 미재현을 구분한다.
- 재현된 결함만 공통 소스에서 보완하고 같은 기능·경계/negative unit·실제 Chrome을 재검증한다. 좁은 보완은 원래 전체 시작 P2 또는 사람 정확도 해결로 확대하지 않는다.
- 관련/전체 frontend·타입/Biome·원래 build/production guard·diff와 PR152의 기존 사용자 흐름을 필요 범위로 재검증한다. 미해결 P1/P2가 있으면 Draft/미완료를 유지한다.

## Worker 실행 전 실패의 구체 보완 계약

공통 parent는 모델 읽기 뒤 실행 여부를 모르는 Worker에 바로 init을 보내고, 이후 실패/취소에 무조건 native closed ACK를 요구했다. Worker 코드 로딩/구문 실패·무응답처럼 SDK가 아직 시작할 수 없는 조건도 cleanup 실패로 오염될 수 있다. 이 경로를 unit의 원래 main 대조와 실제 Chrome의 명시적 로딩 실패 주입으로 재현한다. 과거 두 실제 간헐 실패의 동일 원인으로 추정 확정하지 않는다.

- Worker가 protocol handler를 설치한 뒤 고정 boot1건만 보낸다. boot는 SDK/카메라/신체 준비 완료가 아니다. parent는 해당 boot 전 init/모델 전송을 하지 않는다.
- 모델 읽기 후의 기존5초를 boot+init이 공유한다. 새 대기 구간/타임아웃 확장/SDK 기능 축소0. init 후에는 원래 clean ACK와 실패를 그대로 요구한다.
- boot 전 실패/취소는 native task가 생성될 수 없으므로 owned Worker 종료를 확인하고 기존 inference 오류/명시 재시도를 허용한다. terminate 실패는 cleanup 오류로 남긴다. 자동 카메라 재시작은 하지 않는다.
- 누락/늦은/반복/잘못된 boot, 모델 읽기/계정 취소, 같은 원래 deadline, native entry 순서를 unit으로 검사한다. 실제 Chrome은 로딩 무응답/구문 오류→카메라 종료/비활성 Worker→명시 재시도→실제 heavy/face/hands SDK 준비/정리, 출처/CSP·저장/외부 전송 경계를 확인한다.

## 제외

기능/SDK·관절·기준 축소·새 공개 UI/판정·모델 조형/채택·원시 데이터 저장/전송·실제 참여자/공급자/Docker·비용/계정/시크릿/운영 DB/배포/출시0. PR150/152·원본/실패는 보존한다. 전체1~6 완료를 이 진단 통과로 대신하지 않는다.

## 실제 보완 결과

Worker boot 확인 전 모델/초기화를 전송하지 않도록 공통 parent와 native entry를 연결했다. 원래5초 응답 기한을 boot+init이 공유하며, boot가 없으면 native SDK ACK를 요구하지 않고 Worker 종료를 확인한다. SDK가 시작된 뒤에는 원래 clean ACK와 정리 실패를 그대로 유지한다.

불변 main203a6ab parent 대조의 unit과 Chrome 로딩 무응답에서 cleanup 오류/재시도 차단을 재현했다. 현재 소스는 로딩 무응답/구문 오류 뒤 카메라·Worker를 종료하고 같은 페이지의 명시 재시도로 실제 heavy/face/hands SDK 준비·종료를 마쳤다. 자동 재시작·원시 입력 저장/전송0이다. 기존 native 카메라8흐름·build CSP5흐름·SDK 생성 단계 취소4흐름, 전체frontend1956/110파일·타입/build/Biome·production guard를 통과했다. [실패·실제 화면·명령·해시](../review/sdk-coaching-startup/README.md).

이 보완은 pre-SDK 로딩 실패의 원인/복구를 입증한다. 과거 PR152의 두 간헐 실패에는 당시 Worker 단계 기록이 없어 같은 원인인지 확정하지 못했다. PR152의 전체 시작/정리 P2·최종 코칭/아바타/정확도 및1~4/전체1~6 게이트는 그대로 미완료이며 해당 Draft를 병합하지 않는다.
