# 실제 계정과 native 두 아바타 연결

S2.T9 / baseline4adfe823 / runtime5524b1df. 공개 코칭이 아닌 내부 Chrome·API·격리 SQL 통합 시험이다. 1~6단계는 미완료다.

## 작동한 흐름

- 실제 가입/인증 → 준비만으로 카메라0 → 명시 시작 → native 가짜 카메라·SDK·남녀 두 GLB 재생.
- 명시 중단 → 본인 interrupted·관찰0 기록 저장 → 실제 공개 기록 상세 확인.
- 같은 계정 refresh → 즉시 이전 재생/저장 차단 → 보류 결과 정리 대기 → 새 준비 → 사용자 명시 시작으로 새 native bridge.
- logout204·서버 /me401·pagehide·unmount → 이전 RAF/새 입력 차단 → 늦은 결과와 입력 종료 → 모델/SDK/카메라 종료. 자동 재시작0.

미검출에서 정답/완료를 만들지 않았다. native 결과를 SDK 반환 이후 시험 wrapper로 보류했으며 실제 SDK 지연/실제 사람 검증이 아니다. 원본 입력/카메라 영상 스크린샷0, 좌표 저장/전송0. PNG는 미완성 A37 avatar canvas 또는 합성 수행 기록 화면만이다. 외형 승인/새 시안이 아니다.

## 실제 검증과 증거

runtime source와 최종 PR source의 시험 관련 파일 SHA를 대조한다. [summary.json](summary.json)에 명령 exit, 전체 frontend926·native12·기존 계정 회귀6, 공개 JS/CSS/5모델 동일·production GLB0, native 자원 정리·CSP 차단 횟수와 증거 SHA를 기록했다. GitHub 체크가 없으면 **체크 없음**으로 보고하며 로컬 시험을 CI로 바꾸어 부르지 않는다.

읽기용 기록은 절대 경로/행말만 정리했고 raw/*.gz는 원본 byte 그대로다. 압축 해제 SHA를 대조하며 이전 실패를 삭제하지 않았다. 최초 TS2339는 도구 출력에서 복원한 실패 기록이며 원본 subprocess log로 주장하지 않는다. 초기 DB 공유 메모리/localhost bind sandbox 거부 log도 보존했다. 이후 임시 Unix 소켓 DB/localhost 시험에만 실행 권한을 사용했다. DB는 종료하고 데이터/증거를 보존했다. test-only pnpm launcher는 설치된 의존성의 build/playwright만 허용하며 registry/install·.env·운영 DB를 건드리지 않는다.

## 작성자 리뷰

code-review의 정확성·개인정보·실패/수명 경계를 점검했다. 별도 독립 리뷰가 아니다.

- 보류 결과 중 이전 resume/save Promise를 먼저 await하면 정리 장벽을 시험 자체가 막는다. 호출을 시작한 뒤 결과를 해제하고 정착 및 POST0을 확인하도록 고쳤다. 제품 deadlock 수정으로 주장하지 않는다.
- 공개 기록으로 이동하기 전 종료 snapshot을 보존해 최종 브라우저가 바뀌어도 종료 증거를 잃지 않는다. optional-chain으로 핵심 시험을 건너뛰지 않는다.
- 최종 회귀 launcher가 native와 같은 log 이름을 사용해 wx의 덮어쓰기 거부(EEXIST)로 실패했다. 기존 log/회귀 JSON을 보존하고 이름 재사용을 실행 전에 차단했다. 해당 실행은 launcher 실패이며 별도 고유 이름의 재실행을 최종 증거로 쓴다.
- 모든 새 module/가짜 카메라·CSP/route/proxy는 시험 전용이다. 실제 AuthProvider/API/SQL은 대체하지 않는다. 원래 ready 소유권과 fresh bridge, 이전 cleanup 장벽을 실제 native 자원과 함께 검증했다.
- 실제 SDK의 CSP 차단 시도가 관찰되었다. 외부 route0·저장소0은 **제품 SDK 무통신/개인정보 승인 증거가 아니다.** 승인 대기 B09를 그대로 유지한다.
- 이 Story 범위의 미해결 P1/P2 없음. 기존 외형/실측/공개 디자인/SDK 정책/시작 지연 원인 등의 문제를 닫거나 낮추지 않았다.

## 남은 출시 조건

물리 webcam·사람/권한 popup·세밀한 자세 정확도, 목/체간/손/비틀림, 검증된 올바른 시범/적색 교정, 최신 얼굴/목 및 최종 외형/권리, 승인 디자인과 SDK 정책, 전체 GPU/worker/장시간/다양한 노트북, 실제 공급자/HTTPS/운영은 남는다. [이월 기준](../../stage2-carryover.md)을 유지한다. 공개 출시 동작0이며 배포/출시·운영 migration/시크릿/비용 작업을 하지 않았다.
