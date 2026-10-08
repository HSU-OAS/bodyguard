# S2.T14 — 로그인 소유 몸·머리 재생

## 실제 작동한 흐름

비공개 Chrome에서 실제 AuthProvider/API/격리 PostgreSQL과 재사용 native adapter를 연결했다. 준비→명시 카메라 시작→두 GLB→중단→본인 기록 상세가 작동한다. 얼굴 결과 대기 중 세션 갱신·logout204·서버 `/me`401·pagehide·unmount는 이전 전달/저장/재개를 차단하고, 입력 반환 뒤 Pose/Face SDK·카메라·모델을 정리한다. 새 기록 소유자는 새 자원으로 명시적으로 시작한다.

이는 가짜 장치의 **native 미검출** 시험이다. 양성 사람/자세 판정, 동일인 결합, 물리 카메라·권한 팝업, 최종 외형/경추 분절 검증이 아니다. Face 결과 대기는 실제 검출 직후 시험 wrapper가 주입한 Promise이며 native SDK의 비동기 지연 특성으로 주장하지 않는다. 시범/출시 gate와 시간은 합성이고 확인 시간은 0으로 기록한다.

## 변경 / 검증 경계

최종 runtime `c39a853664581e7b7b4ae00657488c4f8df9fc30`에서 머리 포함 로그인 흐름12·body-only 복구8과 frontend1011 통과, 실패/skip0. 초기 native12/복구8 및 초기 mock RED/DB 실패도 보존한다. source24/evidence127의 SHA·gzip 원문을 검증한다. 원격 CI 통과를 주장하지 않는다.

실제 canvas: [남성 미완성 A37](evidence/nativehead-20261008T015548776247Z-nativehead-male-native-start→stop→own-interrupted-record-avatar-male.png) · [여성 미완성 A37](evidence/nativehead-20261008T015548776247Z-nativehead-female-native-start→stop→own-interrupted-record-avatar-female.png). 원본 그대로이며 최종 외형/시범이나 실제 사람 추적 결과가 아니다.

- `createNativePlaybackResources`: 선택적인 명시 head 정렬/행렬 순서, 카메라 전 복사/검증, 같은 입력 body→face source, 두 SDK의 부분 실패/취소/정리 장벽. 설정 없는 기존 body-only API는 유지한다.
- 실제 로그인 native 머리 흐름과 기존 body-only 카메라 거부·지연 취소·track/GLB 실패→명시 재시도를 따로 실행한다. 자동 검증의 정확한 명령·exit·source SHA·원본 gzip SHA는 [summary.json](summary.json) 및 evidence에 있다.
- body/face 단위 mock, native 가짜 장치, 실제 HTTP/SQL을 구분한다. 고정 native 오류 notice만 유지하며 영상/관절/얼굴 원문 캡처·저장·업로드는 없다. canvas 미리보기는 보존한 미완성 A37 아바타만이다.
- 공개 JS/CSS·5모델 byte 동일, 공개 GLB0. 새 화면/문구·아바타 조형/원본·GLB/판정·운영 SDK 정책/DB·시크릿·배포 변경0.

## 실패 / 작성자 재검토

신규 mock RED는 구현 전 13통과/7실패였다. 초기 타입 검사 TS2554와 non-null assertion 경고를 보완했다. 로컬 DB 초기화는 샌드박스 공유 메모리 제한으로 exit1; 원본 db-init.log를 보존하고 전용 로컬 시험 권한에서 재실행했다. 실행 메모는 evidence/execution-notes.json이며 초기 타입/정리 스크립트 오류에는 별도 exit receipt가 없다는 사실도 기록했다.

작성자 diff 재검토에서 기록 상세 이동이 private probe를 파괴하여 afterEach의 Face 정리 검사가 빠지는 부분을 보완했다. 이동 직전 closed-stage에서 공유 입력/두 검출기 정리를 직접 검증한다. row/column 순서, body 초기화 실패/부분 cleanup 실패도 추가 검증했다. 배열 길이는 복사 전에 확인하고 기존 수치 roundoff1e-5와 안전/개인정보 기준은 낮추지 않았다. 독립 에이전트 리뷰나 실제 사람 검증으로 부르지 않는다.

시험 CSP/닫힌 로컬 proxy의 차단은 운영 SDK 정책 적용이나 무통신 증거가 아니다. 실제 관찰된 차단 시도만 기록한다. 로컬 DB는 종료하고 데이터/기존 원본·실패 증거를 보존한다. Story 범위 미해결 P1/P2와 GitHub 최신 main/diff/CLEAN/체크는 PR에서 별도로 재확인한다. 원격 체크 부재는 **체크 없음**이다.

## 남은 출시 조건

실제 사람·동일인·native 양성 머리/몸·가림/보상/정확도, 목/체간/손·시범/피드백, 외형·권리·승인 디자인, 장시간/다장치·전체 GPU/worker, 승인 SDK 정책/실제 공급자·HTTPS/운영 게이트는 남는다. 출시 적격 동작0이며 D2 및 전체1~6 완료가 아니다. [이월 조건](../../stage2-carryover.md)은 유지한다.

검증 번들 고지는 [notices](notices/README.md). 최종 SDK/WASM/model 권리·NOTICE/법무 승인으로 대체하지 않는다.
