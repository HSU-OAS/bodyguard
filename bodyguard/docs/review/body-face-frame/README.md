# 몸·얼굴 동일 프레임 전달 — 실제 실행과 남은 조건

baseline `62b837539833f177e66b96d5bfc4fbab57fa148c` · runtime `98097cab36298a06cfe23835dccf114b646ef371` · [S2.T12](../../stories/body-face-frame.md).

몸·얼굴 추론이 한 frozen VideoFrame object와 원래 timestamp를 사용한다. body 배열을 face 호출 전에 복사하고, face 완료까지 입력을 열어둔다. 얼굴 점/행렬이 아닌 복사된 회전 후보만 기존 body frame 경계로 전달한다. **같은 입력은 동일인 증거가 아니며, head rig/판정에 자동 적용하지 않는다.**

## 실제 흐름

Chrome `154.0.8037.98` / MediaPipe `1.0.1`의 가짜 장치와 실제 Pose/Face SDK를 실행했다. 준비 시 추론0 → 연속3프레임 → face 결과 대기 중 종료 → 입력을 열린 상태로 유지하며 정리 대기 → 늦은 결과 전달0·body/input 정리 → 명시 새 세대 → 새 프레임 → source 정리 뒤 두 detector 각1회 종료·track 종료·video 해제. [최종 원본 receipt](browser-ready.json).

native 5회는 body/face 미검출이다. 실제 얼굴 결과는 close 없는 JS 객체이며, 받아들인4프레임의 head는 null이다. 움직이는 실제 사람/머리 긍정·동일인·물리 권한 정확도 시험은 **미실행**이다. 긍정 머리 회전·외국 세대/중복·부분 실패·소유 장벽은 별도 합성 unit이다. 공개 웹 화면을 새로 만들거나 카메라/입력 캡처를 하지 않았다.

## 검증과 원본

최종 전체 frontend976/실패0/pending0, 새 source16case와 기존 공유 경계 회귀, typecheck/Biome/assets/build/guard/diff 실제 실행. 설치된 동일 바이너리를 사용했으며 pnpm install/의존성·잠금 파일 변경0이다. public JS/CSS와5모델 byte는 PR74와 동일, public GLB0. [16소스·67원본 및 마지막 compiled probe SHA](summary.json). 모든 raw 실행 receipt와 실패는 그대로 보존했고 큰 unit JSON과 최종 probe는 정확한 gzip round-trip SHA로 저장했다. 과거 compiled probe 파일 자체는 실행별로 별도 보관하지 않았으며 해당 실행의 SHA/receipt/관련 source commit을 보존했다.

최초 module 부재는 수집 실패/assertion0. 구현 첫 시험은 회전의 exact floating-point 비교1실패이며 기대 비교만12자리로 바꾸었다. Matrix4Tuple fixture 타입과 forEach callback lint를 보완했다. lint 실패는 chat 원본과 [별도 exit receipt가 아닌 기록](formatting-note.json)을 구분한다.

최종 보강 중 [launch-browser-reviewed](launch-browser-reviewed.json)는 proxy CONNECT socket ECONNRESET로 exit1이며 browser receipt가 생성되지 않았다. 이를 성공으로 세지 않는다. 소유 socket error 처리와 localhost의 합성 reset→403 거부를 보완한 뒤 실제 native 흐름을 다시 실행했다. 최초 실패 후 잔존 시험 프로세스가 없는지 읽기 전용으로 확인했다. [실패 경계](browser-failure-note.json).

공개 누출 방지는 시험 sentinel에서 실제 exit1, 해당 Story의 sentinel만 제거한 뒤 exit0으로 재확인했다. SDK의 시험 CSP 차단 시도4는 여전히 관찰되었고 proxy 거부16에는 localhost 합성 reset도 포함한다. 시험 차단은 제품 SDK 정책 승인/무통신 증거가 아니다.

## 작성자 검토·남은 조건

PR 후검에서 새로 보관한 시험 번들의 고지를 보완했다. [인접 원문 고지·실제 bundler 확인](notices/README.md). Three 설치 MIT 원문과 공식 Apache2 원문을 제공하고 SDK의 설치 LICENSE/NOTICE 누락을 정해진 것으로 덮지 않았다. 별도 고지 build의 최초 byte 동일 실패/region 경로 주석 차이는 [원본 기록](notice-build-first-failure.json)이며 canonical native 시험 artifact/core code는 그대로다. 배포/법무 승인으로 세지 않는다.

공유 body copy의 기존 모양·불변 복사, original stamp, 취소 후 face 호출 방지, pending input/body 회수와 고정 cleanup 오류, FaceResult.close 미발명, body0/복수·불완전/invalid face의 head null, 공개 비노출·소스/증거 SHA를 검토했다. input 실제 open/close 및 native face0 관찰을 보강했고 위 proxy P2 원인·회귀를 해결했다. 독립 리뷰어/전문가 시험이 아니며 미해결 **Story 범위** P1/P2 없음이다. 최신 remote diff/HEAD/main/CLEAN/체크는 별도 조건부 PR 게이트에서 확인한다.

body-face 동일 사용자·실측 좌표계, 명시 정렬 기준과 head rig 연결, 목 분절/체간/손·검증된 시범/적색 피드백, 최종 외형/권리·승인 디자인/SDK 정책·실제 노트북·HTTPS/운영 및 전체1~6 필수 기준은 유지한다. 이번에 API/SQL·물리 카메라·참여자·GLB/Blender·배포 시험을 했다고 주장하지 않는다. 공개 코칭/출시 동작 적격0이며 전체1~6/RC 완료가 아니다.
