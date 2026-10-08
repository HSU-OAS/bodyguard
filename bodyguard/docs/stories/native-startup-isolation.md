# S6.9 — native 시작 실패의 기준선 분리

2026-10-09 · 대조·분석 하네스 검증 완료 / 원인 입증·제품 보완 미완료 · main5a1a3d8 · NFR-08·FR-M-02/07·FR-S-02/04

## 문제·한 목적

[PR90](https://github.com/HSU-OAS/bodyguard/pull/90)은 최종 native26건13통과/13시작 실패로 Draft다. FE1327/정적/build는 통과했지만 병합 게이트를 충족하지 않았다. 실제 실패의 SDK 준비8663.4ms·첫 반환14915.3ms에서 새 목 snapshot 이전 지연을 확인했다. 근본 원인/변경 인과는 미확정이며 과거 정상 계측이나 이후 높은 host load로 원인을 단정하지 않는다.

최신 main의 기존 첫 시작 계측을 동일 제한과 격리 서비스로 실행해 변경 이전에도 같은 실패가 나타나는지 확인한다. PR90 소스·compiled probe·기존 실패는 보존하며 이 Story에 feature 변경을 섞지 않는다. 현재 제품 공개byte·디자인·판정·임계값·SDK 개인정보 정책은 바꾸지 않는다.

## 하네스·수용 기준 — 실행 전

- ISOLATE-N01: 원래 main source/hash·브라우저/SDK/모델 SHA·실행 순서를 남긴다. API/SQL은 새 직접 소유 테스트 DB만 사용하며 권한/원래 rate limit을 유지한다. 설치 캐시를 재사용하고 dependencies/정책 우회0이다.
- ISOLATE-N02: 기존 첫 시작 계측의 카메라→body/face/hands 생성→GLB→render→첫 결과 시간을 사용한다. 수치 없는 실패 구간은 추정하지 않는다. 원본 영상/관절/얼굴/손/프레임 파생 신체값은 저장하지 않는다. 상대 기술 시각/고정 상태만 증거로 쓴다.
- ISOLATE-N03: poll5000ms/case60000ms·retry0을 유지한다. baseline·current 구분과 해당 시점/사례의 통과·실패·미실행을 각각 보고한다. 한 번 정상인 결과를 간헐적 실패 해결/인과 입증으로 세지 않는다.
- ISOLATE-N04: baseline도 실패하면 새 목 처리를 필수 원인으로 볼 수 없다는 반증만 기록한다. baseline 정상/current 실패라도 순서/환경 통제가 충분하지 않으면 회귀 원인을 확정하지 않는다. 준비/추론 구간의 입증된 원인부터 보완하며 제품 코드는 재현/대조 근거 이후에만 변경한다.
- ISOLATE-N05: 실행형 분석 하네스는 report/source/date·실제 실패를 보존하고 누락/잘못된 범위·실패를 성공으로 집계하지 못하도록 검증한다. Story 범위의 전체 FE/type/Biome/build/guard·공개byte/diff·source/원문 SHA를 검증하고 작성자 리뷰·기존 조건부 병합 게이트를 유지한다. 해결 미달이면 Draft·P2를 유지한다.

## 현재 가설·다음 선택

1. 새 neck frame 복사/관찰이 늦게 반환되는 직접 원인인가: 계측된 실패는 그 첫 전달보다 앞에서 SDK 생성이 지연됐지만 module/준비/환경 전체 인과는 추가 대조가 필요하다.
2. 기존 SDK 준비/초기 추론 경로 자체가 제한을 넘는가: 이번 baseline 첫 시작을 실행해 같은 단계 지연/실패를 확인한다.
3. 환경 부하·실행 순서가 영향을 주는가: 관찰 시점/조건을 분리하고 다른 사용자의 프로세스 종료·시스템 변경으로 시험을 강제로 통과시키지 않는다. 후속 통제 비교가 없으면 미확정이다.

단계별 실제 수치를 먼저 확보한다. 준비 병렬화·모델 변경·기능 축소·대기시간 확대를 원인 없이 적용하지 않는다. 실제 사용 화면·안전·개인정보 변경이 필요하면 별도 승인 경계를 유지한다.

## 제외·진행 상태

제품 지연 해결 선언·실제 사람/물리 카메라·임상 classifier/올바른 시범·새 외형/GLB·승인 공개 구조·SDK 통신 승인·비용/계정/시크릿/운영 DB/배포/출시0. 2단계 이월·출시 적격0·최소 문구·기존 원본/실패 및 전체1~6 미완료를 유지한다.

명세와 첫 실행형 비교 하네스를 작성하고 실제 baseline→current의 남성 첫 시작1건씩을 실행했다. [원본·SHA](../review/native-startup-isolation/first-comparison/manifest.json), [분리 결과](../review/native-startup-isolation/first-comparison/comparison.json.gz). 소스 before/after와 해당 HEAD의 git blob을 대조했다. 브라우저·SDK·모델/GLB byte·제한/재시도는 동일하며 새 소유 DB를 정상 종료/자료 보존하고 직접 만든 의존성 link만 제거했다.

| 2026-10-08 UTC 실행 | HEAD | SDK 준비 | 아바타 준비 | 첫 결과 반환 | 실제 결과 |
|---|---|---:|---:|---:|---|
|14:43:08 main|5a1a3d8|1708.4ms|2000.9ms|3313.4ms|1통과/실패·skip0|
|14:45:34 current|884700e|1709.9ms|2000.7ms|3357.9ms|1통과/실패·skip0|

장치/메일은 시험용·실제 Chrome/SDK/API/격리 SQL이며 실제 사람/물리 카메라0이다. 한 방향 순서의 단일 사례이며 환경 부하·warmup·순서를 통제한 인과 시험이 아니다. 이 첫 비교 시점에는 전체 Story 품질 검증과 원인 입증/보완이 미실행이었다. **PR90의 필수26건13실패를 대체하거나 P2/병합 보류를 해제하지 않는다.** 후속 실제 대조와 분석 하네스 검증은 아래에 따로 기록한다.

## 후속 실행·한계

UTC2026-10-08 14:57:30~14:58:41에 같은 원래 source·모델·Chrome/SDK·제한으로 남성 첫 시작만 main→current→current→main 순서로 실행했다. 네 사례 모두 통과했다. SDK 준비는1660.3~1903.6ms, 첫 결과3222.9~3608.0ms였으며 이전 간헐 실패는 재현되지 않았다. 이는 환경 부하·장시간 누적·warmup을 모두 통제한 인과 시험, 여성 회귀, 전체 native 필수 회귀 또는 실제 사람 검증이 아니다.

분석 하네스는 순서·원본 HEAD/source SHA·같은 범위·실제 report/receipt·최대30개의 기술 시각을 검증한다. 실패·skip을 통과로 합치지 않으며 누락된 완료 시각을 생성하지 않는다. 여러 SDK 시도 중 첫 종료를 준비 완료로 잘못 읽지 않고 첫 아바타 이전의 모든 시도가 종료된 경우에만 준비 시각을 계산한다. 작성자 검토에서 미종료 시도를 정상으로 계산하는 한 건을 실제 단위 실패로 재현해 수정했다.

저장된 원본을 다시 읽는 명령은 `frontend/scripts/verify-native-startup-isolation.mjs`다. 원문/압축 SHA, 실행 당시 git tree의 전체 source, report 제목/수/제한/retry와 입력 연결을 검사한다. 본인 임시 fixture에서 **같은 검증기/분석기 byte**로 정상 원본은exit0, 누락·변조는각exit1/고정 오류를 확인했다. 이 명령은 오프라인 검증이며 Chrome/SDK/API/사람 시험을 다시 실행하는 것이 아니다.

- 최종 FE1336/실패·skip0, 새 분석35, Biome/type/build/guard/diff 통과. 공개 JS/CSS SHA·byte 동일, 제품 source/화면·임계값·GLB/조형·dependencies/API/운영 변경0.
- 구현 전 import 실패는 개별 테스트 실행0이다. 첫 구현32건 중4건은 배열 matcher 작성 오류였고 보완했다. 이후35건 중1건의 미종료 준비 계산 실패는 실제 분석 로직 오류였으며 수정/재검증했다. 원문은 모두 보존했다.
- [실제 흐름·남은 조건](../review/native-startup-isolation/README.md), [대조 원본](../review/native-startup-isolation/controlled-comparison/manifest.json). 첫 비교의 기존34개 파일/manifest는 변경하지 않았다.

**원인 확정·제품 지연 해결은 미완료다.** 정상6건은 이전 필수26건13실패의 대체 증거가 아니다. S6.9도 해결 조건 미달로 Draft/병합 보류를 유지하며 기존 시작P2·PR90 Draft·D2/전체1~6·출시 적격0을 유지한다. 다음은 실패 시 SDK 생성/첫 추론과 환경·누적의 기술 상태를 구분하는 제한된 진단이며, 정상 반복이나 대기시간 확대만으로 해결하지 않는다.

## 후속 진단 계약 — 구현·실행 전

- ISOLATE-N06: 비공개 시험에만 FilesetResolver 준비와 SDK 생성 시도의 시작/종료·GPU/CPU 요청·성공/실패를 추가한다. 원래 인수·반환 객체·예외·호출 순서·제한은 유지하고 예외 내용·모델 URL·계정·신체 데이터는 기록하지 않는다. 기존 timing과 원본 증거 형식은 보존한다.
- ISOLATE-N07: Long Tasks API가 지원되면 카메라 시작 이후 상대 시각/지속 시간만 최대64개 보관한다. attribution·name·URL은 읽지 않는다. 미지원/실패/상한 도달을 구분하며 동시 발생만으로 원인이나 전체 host 부하를 확정하지 않는다. observer는 fixture 종료 시 pending entries를 읽고 반드시 해제한다.
- ISOLATE-N08: 단위 하네스로 실패·미종료·후속 CPU 시도·시간 오류·상한·해제를 검증한다. 실제 실행은 한 번의 기존 남녀 native 회귀 범위로 제한한다. 추가 계측이 있는 baseline 시험이며 PR90의 원래26건 실패를 대체하거나 새 neck 구현의 통과 증거로 세지 않는다. 재현되지 않으면 그 사실과 다음 의존성을 기록하고 정상 재시험만 반복하지 않는다.

기술 참고: 설치된 SDK1.0.1의 `vision.d.ts`와 실제 생성 경로를 확인했다. [Google Web 가이드](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [Long Tasks API 초안](https://w3c.github.io/longtasks/)을 참고한다. 후자는 2026-03-19 Editor’s Draft이며 완료된 표준/전체 GPU·OS profiler로 표현하지 않는다. 제품·개인정보 정책·공개 UI 변경은 없다.

## 후속 진단 실제 결과

카메라 시작에 observer를 열고 종료 시 pending entries를 읽어 해제한다. SDK의 원래 인수/반환/예외를 유지하는 시험 wrapper와 최대30개 시도·64개 long-task 기록을 구현했다. 상대 기술 시각·고정 상태·GPU/CPU 요청만 보관하며 오류 내용/attribution/name/URL·신체 입력은 수집하지 않는다. FilesetResolver 호출 시간은 WASM 모듈 초기화 전체나 factory 내부의 모델/모듈 준비를 분리한 시간이 아니다.

| UTC2026-10-08 실제 실행 | 결과 | 범위·한계 |
|---|---|---|
|15:42:25 남녀 기존24건|20통과/4실패|마지막 여성4건은 가입202 예상/실제429, 카메라 이전. about:blank cleanup의 SecurityError도 원문 보존|
|15:47:17 위4건만 별도 실행|4통과|새 본인 시험 schema·원래 rate limit/제한 유지, 이전 실패를 지우지 않음|
|15:49:49 경계 보완 후 남성 첫 시작|1통과|최종 코드의 대표 연결 검증만. 전체 native/PR90 최종26건 재검증 아님|

최초20건/보완4건은 준비32회·SDK96시도 모두 GPU 요청이 성공했다. 실제 CPU 전환/실패 경로 검증은 아니다. 첫 SDK1353.1~1712.0ms/첫 반환2752.3~3290.7ms, long task 최대949ms를 관찰했고 상한/invalid은 없었다. 시작 실패는 미재현이며 동시 관찰만으로 SDK 지연·host 부하의 인과나 이전 실패 원인을 확정하지 않는다. 마지막 대표 실행은 전체 품질 검증과 일부 겹친 비통제 환경으로 성능 대조가 아니다.

작성자 검토에서 객체가 문자열 stage처럼 강제 변환되어 payload를 보관할 수 있는 경계를 실제 단위16건15통과/1실패로 재현했다. 문자열 여부를 먼저 검사해 coercion/보관을 차단했다. 보완 뒤 전체 FE1352/새 진단16·Biome/type/assets/build/guard/diff 실제 통과, 공개 JS/CSS byte·SHA 동일이다. 첫 import 실패는 개별 테스트0이며 observer mock 인수 수 오류(type exit2)도 보존/보완했다. 기존 오프라인 원본 검증도 실제exit0이다. [후속195개 원문/SHA](../review/native-startup-isolation/diagnostic/manifest.json), [작성자 검토](../review/native-startup-isolation/diagnostic-author-review.json).

격리 PG는 정지했고 데이터/모델/GLB·실패·기존145개 artifact를 보존했다. 원래 시작P2·PR90 Draft/필수13실패·S6.9 원인 입증/제품 보완·전체1~6은 미완료다. 정상 SDK 실행을 반복해 해결 처리하지 않는다. 미분리 factory 내부 준비/첫 추론·실제 노트북 조건은 의존성으로 관리하고, 선행 승인/실측과 독립인 필수 통합 작업을 이어간다.
