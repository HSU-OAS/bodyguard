# S6.17 — 코칭 시작 지연 재현과 전체 단계 관측

2026-10-09 · 최신 main `85885c4d1ed3bc019dea3112fe8beaa62d4fd88b`(PR100).
FR-M-01/02/07·FR-S-03/04·NFR-07/08. **진행 중; 시작 P2 미해결.**

## 시작 증거와 조사 계약

S6.16의 Chrome155 통과만으로 과거 시작 실패를 해결로 선언하지 않는다. 설치된 별도 Chrome for Testing154.0.8037.57에서 현재 원래26개 계약을 실행했다. 남성13건 중 한 건은 nativeCloses≥3의 기존5초 poll에서0으로 실패했고 여성13건은 통과했다. 첫 시도는 출력 경로 소유권 검사 때문에 브라우저 실행 전에 실패했으며 원문을 보존했다. 허용 경로로 고쳤지 소유권 검사나 검증 기준을 낮추지 않았다.

비교 실행은 현재 main의 같은 코드·몸/얼굴/손 SDK·기존 GLB·저작 fixture·동일 목 옵션과 원래 시험 본문/guard/loop를 사용한다. 남녀는 격리 API/SQL에서 순차 실행한다. 타이머5초·시험60초·retry0·가입 제한·기본 main thread·renderer 준비 opt-in은 바꾸지 않는다. 실제 사람/물리 카메라 시험은 아니다.

154는 별도 for Testing 실행본이고155는 설치된 desktop 실행본이다. 버전·패키징·실행 순서·호스트 부하/캐시는 분리하지 못했으므로 차이의 인과 원인을 버전 하나로 단정하지 않는다. 과거 PR90의 정확한 실행 조건·13실패는 그대로 보존한다.

## 다음 구현: 시험 전용 단계 계측

기존 nativeStartupTiming은 일부 시험에서만 켜진다. 실패한 첫 목 시험의 before-close에는 단계 기록이 없었다. `BODYGUARD_TEST_NATIVE_STARTUP_TIMING=1`로 전체 원래26건에도 기존의 유한한 계측을 선택적으로 적용한다. 기본값은 계속 꺼짐이고 이미 명시적 계측을 켠 시험은 유지한다.

- 수집은 camera/SDK 생성/avatar/render/첫 body·face·hands/result의 상대 시간뿐이다. 고정 stage 이름과 기존 최대30개 이벤트/종료 규칙을 재사용한다. 영상·좌표·신체 수치·계정·URL을 수집하지 않는다.
- 기존 시험 본문·guard·loop·실제 순서와 준비→실행→가림/복구→중단/새 세대·권한 회수·본인 기록·해제 조건을 제거하거나 바꾸지 않는다. 계측용 실행과 계측 없는 대조군의 artifact와 소스 hash를 따로 남긴다.
- 계측은 타이밍을 바꿀 수 있다. 계측 후 정상 실행을 비계측 실패의 해결로 세지 않는다. 반복 성공·timeout 확대·재시도·시작 전 성공 관찰 적립·일부 시험 제외로 시작 P2를 닫지 않는다.
- 실패 재현과 각 단계의 관찰로 원인 가설을 좁힌 다음 제품 수정 범위를 결정한다. 원인과 실제 수정·필수 재검증이 없으면 이 Story는 완료/병합하지 않는다.

## 필수 검증과 종료 조건

1. 실제 브라우저 버전·전체 원래26 제목/본문 계약·소스 전후 동일성을 확인한다. actual SDK/API/SQL과 가짜 카메라/메일/합성 동작을 구분한다.
2. 비계측154/155의 남녀 전체 회귀 및 선택적 전체 계측을 실행한다. 실패·실행 전 환경 오류·미실행을 그대로 보존한다.
3. 상대 시간만 수집하고 이벤트 상한·종료, 기존 해제/소유·가림 보류·기록 경계가 유지되는지 확인한다. 공개 bundle·SDK 자산·원본 GLB/저작 fixture를 보존한다.
4. 수정 시 전체 FE·타입·Biome·직렬 public build/guard·diff·보안/성능/정확성/유지보수 검토를 수행한다. scoped P1/P2가 남거나 필수 회귀가 실패하면 Draft를 유지하고 병합하지 않는다.

최종 목표는 기존 시작 P2의 실제 원인·수정과 전체 회귀 검증이다. 조사·계측 결과만으로 제품/단계 완료를 선언하지 않는다.

## 2026-10-09 추가 구현 계약: 독립 자원 준비 중첩

앞의 조사 계약과 원문 증거를 보존한다. SDK1350ms 안팎→avatar 약270ms→첫 render 약150~170ms→첫 body/face/hands 약790~923ms의 직렬 경로를 actual SDK 단계에서 관찰했다. shader disk cache를 끈 제한된 대조는 큰 차이가 없고 과거 실패는 재현되지 않았다. 첫 사례 grep이 `female`에도 매치되어 실제 남녀2건씩 실행됐으며, 전체26 검증이나 계획한 남성1건으로 표시하지 않는다. report 연결 오류의 중간 분석 소스도 private 증거에 보존한다.

CTO 권장안은 **native의 독립 SDK·avatar 준비를 camera 소유권 확보 후 중첩**하는 것이다. source형과 구현에서 avatar factory는 완료된 SDK 결과를 입력으로 받지 않는다. 일반 resource caller의 직렬 계약은 유지하고, 독립 준비를 명시하는 port만 병렬로 준비한다. native adapter는 이 경로를 사용한다. main/Worker 선택·모델·GPU 준비 opt-in·수집/판정·공개 구조는 그대로이며 camera 요청을 앞당기거나 시작 전 성공 관찰을 적립하지 않는다. 이는 추론 스레드 정지나 과거 첫 시작 실패 전체의 해결 선언이 아니라 측정된 불필요한 직렬 의존의 제품 보완이다.

필수 하네스/기준:

- SDK와 avatar의 완료 순서가 어느 쪽이 먼저든, 둘 다 소유권을 넘기기 전에는 ready/start/관찰/기록이 불가하다.
- 일반 caller는 기존 camera→inference→avatar 순서를 지킨다. 잘못된 병렬 opt-in은 자원 접근 전에 거부한다.
- 양쪽 준비 중 취소·한쪽 실패·늦은 반환·정리 실패·다음 세대·중복/별칭 자원에서 각 자원의 회수와 이전 세대 ready 금지를 검증한다. 자원 준비를 위한 임의 타임아웃/재시도는 추가하지 않는다.
- unit의 합성 순서/수명 시험과 actual Chrome154/155·SDK/API/격리 SQL의 원래26건을 구분한다. 원래 본문/guard/loop·5초/60초/retry0은 유지하고 기본/계측 대조 및 renderer 준비 회귀를 실제 재실행한다.
- 전체 FE·타입·Biome·직렬 public build/guard·소스/GLB 불변 범위·diff·보안/성능/정확성/유지보수 검토를 마치기 전 완료/병합하지 않는다. 실제 준비 중첩·수명과 구간 비용이 개선돼도 시작 P2 전체를 근거 없이 닫지 않는다.

이번 변경은 기존 Story의 시작 경로 보완으로 기록한다. 새 제품 화면·중요한 안전/개인정보 정책·계정/운영 범위를 확대하지 않는다. 합의된 전체1~6의 완료 기준은 그대로다.

## 제외·남은 출시 조건

공개 화면/최소 문구·SDK 통신 정책·판정 수치·새 조형/GLB·운영 변경은 없다. 독립 시안과 기존 증거를 보존한다. 실제 사람·동작별 검증/시범·최종 외형/권리·승인된 웹 구조/SDK 정책·참여자/다장치·공급자·Docker/HTTPS/운영 및 D2/전체1~6은 미완료다. 비용·계정·시크릿·운영 DB migration·배포·출시·중요한 안전/개인정보 변경은 별도 승인이다.

### 병렬 준비에 따른 순서 계약 개정 — 기존 실패 보존

첫 실제 Chrome154 남성 실행은12pass/1fail이다. 실패는 `native first-start stage timing without raw input`의 `avatar.start >= hands-sdk.end` 직렬 순서 assertion이고, actual avatar.start63.8ms/hands-sdk.end1744.9ms였다. 기존 소스와 실패 report/로그를 보존한다. 원래 시작 P2 실패와 구분하며 성공으로 재표시하지 않는다. 그 전 시도는 sandbox SysV shared-memory 차단으로 DB 시작 전에 실패했고0browser로 기록한다.

이 Story의 CTO 기술 결정으로 타이밍2건(남녀 한 template)만 순서 계약을 개정한다: `avatar.start >= camera.end`, `render.start >= hands-sdk.end`, 기존 `render.start >= avatar.end`와 `body.start >= render.end`를 모두 요구한다. 준비 중첩을 허용하되 양쪽 준비 이전 렌더 금지는 강화한다. 원래 poll/60초 timeout/재시도0, raw-input 금지, 이벤트 제한,3 result, 저장 금지 및 나머지24건 body/guard/loop는 그대로다. **26건 body 모두 불변이라고 주장하지 않는다.** 이전 strict 비교기와 baseline 증거는 변경하지 않고 정확히 이 두 순서 assertion의 교체만 허용하는 별도 비교기로 검증한다. 임의 다른 변경/제외/skip은 허용하지 않는다.

추가 renderer 준비 중 logout/pagehide2건(남성)의 첫 actual run도0pass/2fail로 보존한다. 손 SDK 생성 이전에 종료됐지만 기존 계약이 camera마다 손 SDK가 반드시 생성됐다고 가정해 `handDetectorCloses=1`을 요구한 것이 원인이다. 이미 생성한 자원 누락으로 해석하거나 통과로 표시하지 않는다. 생성 성공 횟수를 TEST ONLY prototype factory wrapper에서 집계하고, renderer 추가4건의 공통 정리 guard는 `closeCount === actualInitializationCount`를 요구한다. 일반26건의 camera별 전체 SDK 정리 guard는 그대로 유지한다. 추가 renderer template의 고정3 SDK close 값 대신 공통 hook의 실제 생성/회수 일치·camera 종료·models0·frames 전부close·memory baseline·오류/외부통신0을 요구한다. 종료 때문에 생성하지 않은 SDK를 새로 만들지 않는다. 이전 strict comparator/공통 hook/추가 template 원본을 보존하고 비교기는 baseline의 이 변경만 추가로 허용한다. 타임아웃/재시도 확대나 생성된 자원 정리 기준 완화는 없다.

### 실제 후속 결과 · 완료 아님

[독립 준비 중첩 결과](../review/native-startup-browser-comparison/parallel-preparation/README.md): final 일반154/155 각각26·전체 계측15426·renderer 추가4의 실제 SDK/API/격리 SQL 흐름/정리를 확인했다. FE1432·타입·Biome·build/guard·정확한 계약·증거·diff를 확인했고 공개 JS/CSS와 GLB/fixture hash는 동일하다. 정상/허위 상태의 복사본으로 계약5·증거8 거부도 실제 실행했지만 제품/임상 시험으로 세지 않는다. 기존 실패와9실행/457개 baseline은 그대로다.

준비 구간이 실제 중첩됐지만 camera-ready→첫 render와third-result 중앙값은 거의 변하지 않았다. SDK chain은 길어졌고 첫 native result 약806ms도 남았다. 환경/캐시/순서가 통제되지 않아 원인/효과를 단정하지 않는다. **시작 P2 해결·전체 성능 개선·Story 완료·병합/출시를 선언하지 않는다.** 다음은 같은 미완료 Story의 main-thread 복합 추론 병목이며 타이머 확대/재시도/사례 삭제/더 약한 판정을 대안으로 쓰지 않는다. 실제 사람·장치·최종 외형/권리·승인 공개 구조/SDK·외부/운영 및 D2/전체1~6 완료 기준은 유지한다.
