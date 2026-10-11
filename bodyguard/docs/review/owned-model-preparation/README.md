# 소유 모델 준비 — 실제 흐름과 남은 기준

2026-10-11 · S3.C8 · main `8a658be0f720c61069d35cacf384568cc2fe001e`에서 시작.

## 작동한 사용자 흐름

비공개 코칭 화면의 명시 **카메라 확인 → 모델 준비 → 첫 입력 처리·즉시 폐기 → 카메라 끄기**를 유지했다. 모델 파일 다운로드를 Worker의 초기화 응답과 분리했으므로 느린 첫 다운로드가 준비된 native 엔진의 5초 응답 실패로 처리되지 않는다. 원본 public 모델 byte만 메모리에서 검증·전송하며 다른 모델/옵션으로 품질을 낮추지 않는다. heavy 기본값·얼굴/손·GPU→CPU 복구·원래 입력/결과 회수는 유지한다.

Chrome154·설치된 실제 SDK·heavy/얼굴/손으로 [정상·지연·취소·변조 원문](accepted.json)을 확인했다. 정상638.1ms와 첫 heavy 응답만6초 늦춘6452.3ms는 ready→합성 빈 프레임1개 추론→종료였다. 각 모델은 페이지에서 정확히 한 번 읽고 Worker에는 buffer로 전송했다. WASM 요청은 여전히 SDK가 수행하며 재요청도 존재한다. 모델 읽기 취소는252.1ms, 원본과 같은 길이의 변조는51.6ms에 실패했고 둘 다 init/추론을 시작하지 않았다. 조건마다 Worker1/종료1·스토리지0·페이지 오류0·관찰 외부 요청0, 소유 서버/브라우저 종료를 확인했다. Chrome 프로세스 프록시 거부27은 별도 기록이며 이를 외부 시도0으로 바꾸거나 SDK/백그라운드 출처를 추정하지 않는다.

[실제 React/AuthProvider 화면8개 흐름](camera-flow.json)은 native **가짜 카메라**와 제어 `/me` 응답을 사용했다. 처음 자동 획득0, 명시 첫 준비/끄기, 문서/Worker의 native CSP 거부, 권한 거부 안내, 늦은 권한 반환 회수, retry·라우트 이탈/재진입과 정리 barrier, 로그인 만료401→개인 화면 제거·자원 종료를 확인했다. 실제 SQL/provider 인증·권한 팝업·사람 촬영을 검증한 것은 아니다. [종료 화면](camera-stopped-1440.png), [권한 거부](camera-denied-1440.png), [좁은 노트북 창](camera-stopped-800.png)은 실제 현재 UI이며 최종 아바타/디자인 시안이 아니다.

## 기준 유지·한계

모델 경로·고정v1의 원본5개 byte/SHA256은 [실제 read-only CLI](final-actual-models.log)로 확인했다. 읽기/해시 전체30초는 최대42,796,278byte의 네트워크 작업이 무한 대기하지 않도록 하는 기술 경계이며 권장 대기 시간·성능 통과 기준·임상 값이 아니다. 5초 Worker 초기화/각 추론/정리, 기존 시작 시험 한계는 늘리지 않았다. native task가 시작될 수 없는 init 이전만 직접 종료하며 이후에는 원래 clean acknowledgement/실패 차단을 요구한다.

[이전 같은 로컬6초 제어 지연](before-controlled-download.json)은 실패했고 새 방식은 준비를 이어갔다. 새 정상638.1ms와 이전491.2ms는 단일 시험으로 속도 개선/회귀 허용 근거가 아니다. 전체 클릭→준비 시간이6초대인 조건을5초 성능 통과로 표시하지 않는다. 기존 간헐적 시작P2·다장치/실제 사람 정확도는 미해결이다. PR124의 실패한 병렬 GPU 후보는 채택하지 않았다. 임상 판정·SDK 모델·공개 화면·아바타/GLB·외부 계측 정책·운영 변경은 없다.

## 실패·리뷰·필수 검증

- 하네스를 먼저 작성했으나 구현 전 module 부재로 suite1실패/실행 테스트0이었다. assertion RED로 세지 않는다. 이 원문은 도구 출력에 보존했으며 별도 디스크 로그를 주장하지 않는다.
- 첫 구현에서 assets 선언을 native `own()` 내부에 잘못 넣어 타입/SDK mock9개가 실패했다(46통과). 선언 위치를 고쳤다. 역시 도구 출력의 실패이며 현재 source로 당시 source를 대체하지 않는다.
- 첫 실제 브라우저는 그리지 않은 OffscreenCanvas로 VideoFrame 생성에 실패했다. [실패 원문](first.json)을 보존했고 **시험 fixture**에 빈 화면을 그린 뒤 재실행했다. 모델 준비나 임상 기능이 실패하지 않았다고 첫 결과를 성공으로 재분류하지 않는다. 실패/통과 bundle의 hash는 [manifest](manifest.json)에, byte는 원래 private scratch에 보존하며 SDK bundle을 저장소에 새 배포하지 않는다.
- code-review 스킬의 작성자 리뷰에서 unit가 ignored 모델 파일을 요구해 깨끗한 checkout에서 실패할 P2를 발견했다. unit는 명시 합성 byte/hash port, 실제 원본은 별도 CLI·브라우저 검증으로 분리했다. 경로 drift·404/redirect/외부/축약/초과/변조/헤더·늦은 timeout/abort·reader 회수·transfer·init 전/후 소유권·원래5초/누락 ack·SDK 옵션/부분 task 회수를 재검증했다. 독립 리뷰/전문가 승인으로 표시하지 않는다.
- 최종 [명령·시간·exit·산출물 hash](final-verification.json): frontend99파일/1773통과, 타입0, Biome오류0/기존 info16, 고지18, 실제 원본5개, 원래 제품 고지 게이트가 있는 Vite production build, 원래 비공개 guard body(입력 폴더만 private output으로 치환) 통과. 새 fixture는 비배포이며 그 build에만 SDK 정책 plugin을 사용한다. 제품 고지 게이트를 끄지 않았다. [소스/증거 hash](manifest.json). `git diff --check` 통과, 해당 목적 미해결P1/P2 없음. 커밋/PR/조건부 병합의 최신 원격 게이트는 별도 확인한다.

아바타 제작 보류·출시 동작0·실제 참여자/추천·판정/시범·다장치 성능/오판정·Gmail/Google/공식 고지 문의·Docker/HTTPS/운영/배포·전체1~6은 미완료다. 원본 모델·실패 증거와 기존 파일을 삭제하지 않았다. 공급자 보류를 독립 웹 작업 중단으로 해석하지 않는다.
