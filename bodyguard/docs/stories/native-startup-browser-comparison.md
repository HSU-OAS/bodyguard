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

### 다음 검증 계약 — 실제 Worker 추론 중 중단

기존 Worker는 이미 몸·얼굴·손을 같은 decoded 입력에서 처리한다. 동일 구현을 다시 만들거나 main 기본값을 바꾸지 않는다. 기존10개 Worker 인증/기록 회귀의 본문·guard와 기존26개 main 시험은 보존한다. 추가 시험2개(남녀)는 TEST ONLY worker entry의 최초 실제 복합 추론 시작/종료 상대시각만 관찰한다. 실제 SDK를 지연/대체하지 않고 시작 메시지 수신 즉시 main에서 현재 세션을 중단한다.

- Worker의 실제 추론 종료 전에 main의 중단 요청·카메라 해제가 수행되는지 확인한다. 완료된 추론을 추론 중 취소로 표시하지 않도록 두 realm의 `performance.timeOrigin + performance.now()` 시각을 비교한다. 이후 SDK/Worker/입력/아바타 해제와 이전 결과 권위·성공/기록 생성 금지를 확인한다.
- 시험 전용2개 고정 marker에는 시작/종료와 기술 시각만 있다. raw 입력/좌표/얼굴·손 배열을 관찰·로그·저장하지 않는다. 실제 engine/runtime과 동일 모델·config를 재사용하고 정상 SDK의 종료 후 결과는 기존 abort 경계가 처리한다. 공개 build에 marker/시험 entry가 들어가면 실패다.
- 실제 Chrome154/155·가짜 카메라·실제 API/격리 SQL의 결과와 실패·미실행을 보존한다. 기존5초 poll/60초 시험/retry0은 유지한다. marker 비용·새 context/캐시/장치 한계를 표시하며 기존 시작P2 원인·전체 지연 개선·실제 사람 검증으로 환산하지 않는다.
- 전체 FE/type/Biome/public build/guard·diff와 작성자 리뷰를 실제 실행한다. 좁은 수명 증거가 통과해도 이 Story는 시작P2 해결 전까지 Draft/미완료다.

실제 첫 추가 시험은 `releaseMs=null`로 실패했다. 이는 중단 직후 동기 snapshot만 봤으므로 정확한 카메라 종료 시각의 증거는 아니다. 원문/소스를 보존하고 다음 시험에는 실제 `MediaStreamTrack.stop` 호출 관측을 추가했다. 현재 코드에서는 capture 권위는 즉시 철회하지만, camera와 SDK에 같은 lifetime을 사용해 진행 중 read가 끝난 뒤에야 camera lifetime을 abort한다. 이미 캡처·복사한 VideoFrame을 처리하는 native 경로는 카메라를 그 전에 끌 수 있다.

수정 계약: 일반 caller의 borrowed-camera 정리 순서는 유지한다. `earlyCameraRelease: true`라는 명시적 private opt-in만 camera 전용 abort lifetime을 사용하며, capture 철회와 같은 중단 turn에 이를 abort한다. native adapter만 이 옵션을 선택한다. SDK/진행 중 입력/Worker/아바타는 기존 quiescence barrier를 그대로 기다린다. 준비 중 취소·늦은 camera 반환·다음 세대·별칭·중복 회수·정리 실패를 검증하고, 실패를 숨기거나 새 카메라를 이전 해제보다 먼저 열지 않는다. 이는 중단 시 수집을 앞서 종료하는 기존 사용자 의도의 구현 보완이며 새 수집/저장/외부 통신 정책은 아니다.

계측 검토에서 초기 marker가 production Worker의 알 수 없는 protocol 메시지로 전달되어 실패/해제를 유발하는 시험 결함을 발견했다. 초기 두 실행은 정상 추론 중단의 증거로 쓰지 않는다. TEST listener에서 marker만 `stopImmediatePropagation`으로 분리하고 SDK/runtime 메시지는 그대로 전달한다. epoch-sized realm 시각 합산의 Float64 반올림(관측−0.000244ms)은 `4 * Number.EPSILON * epoch`의 계산 오차만 허용하며 실제 overlap에는 그 오차보다 큰 간격을 요구한다. 5초/60초/임상 기준은 바꾸지 않는다. 수정된 하네스의 첫 대조는 새 옵션을 `false`로 고정하여 기존 camera/SDK lifetime 경로를 사용한다. 새 코드 전체가 a59와 byte-identical하다는 주장은 하지 않는다. 원래 a59에서의 초기 계측 결함·unit116pass/2fail도 보존한다. unit2실패는 native의 기존 카메라 대기 assertion이며, 일반 caller의 기본 정리 순서는 바꾸지 않는다.

marker 분리 후 opt-in=false 실제 대조는1fail이다. 실제 복합 추론915.0ms, camera stop918.3ms로 `camera stop < worker end` 계약을 위반했다. 실행 중 소스 전후 동일성과 실패 원문/소스를 보존한다. 초기 결함 시험과 달리 실제 대조 근거다. 그 후 native opt-in=true를 적용한다. native unit2건은 camera만 대기하지 않도록 assertion을 교체하며 기존2/3 SDK 대기·회수 조건은 유지한다. 일반 caller의 기존 정리 순서 시험은 그대로다.

추가 main 경로의 첫 실제 남성13건은7pass/6fail이다. 공통 `revokedWhileHeld`의 `cameraLive && held === true`가 실패했으며 camera를 즉시 끈 구현 변경과 이전 camera lifetime 계약의 차이다. 실패/소스를 보존하고 공통 helper의 이 조건만 `cameraLive === false`, `held === true` 두 assertion으로 개정한다. 남녀12건(몸통 권한 철회1·same-account refresh1·logout/401/pagehide/unmount4씩)이 이 helper를 사용한다. 기존 body/loop/타이머와 권위 철회·held 결과/SDK 회수·이전 재개/저장 차단·기록 조건은 유지한다. 카메라를 끄기 위해 늦은 SDK 결과의 정리/반환을 생략하지 않는다. 이전 비교기는 그대로 보존하고 a59 원문 대비 이 helper의 정확한 assertion 분리만 허용하는 새 비교기를 추가한다. 이번의26건 전체 guard가 불변이라고 주장하지 않는다.

같은 helper의 cameraCloses0도 카메라 대기 계약이다. 이를 `cameraCloses === cameras`로 개정하고 tracksEnded/detached 및 즉시 cameraCloses 일치를 추가로 요구한다. held 중 detector/face/hands close0·call/render 증가0·기록0과 release 이후 각 SDK close1은 그대로다. 새 비교기는 정확히 이 camera 관련 교체/추가만 허용한다. 나머지 test 본문·helper·SDK/held/owner/기록·시간·반복/재시도는 변경하지 않는다.

### 중단 보완 실제 결과 — Story 완료 아님

[카메라 종료 결과](../review/native-startup-browser-comparison/early-camera/README.md)에15실행/34bundle과 원문 SHA를 별도 보존했다. final Worker24·main52에서 실제 SDK/API/격리 SQL의 중단·소유/기록 경계와 회수를 확인했다. 첫 올바른 대조는 camera stop918.3ms/worker915.0ms로 실패했고, 수정 후 four final의 camera stop은1.9~6.0ms/worker907.1~1068.4ms였다. programmatic probe.stop·가짜 카메라/합성 동작/미완성 GLB의 제한된 기술 관측이며 실제 UI 버튼·기본 main의 동기 입력 반응·전체 시작 지연 개선·사람/임상/외형 승인 시험이 아니다.

전체 FE1439/type/Biome·정확한 계약·자산/build/공개 guard·포장 및 의미 변조 거부8건을 실제 실행했다. 이전 고정 증거/원본/GLB/public byte는 보존했고 새 TEST marker는 공개 bundle에 없다. DB는 종료했고 추가 renderer4·백엔드 전체·물리 장치/참여자·Docker/HTTPS/운영은 이 구간에서 재실행하지 않았다. 본 Story의 시작 P2는 미해결/Request changes·Draft101 유지·병합 불가이며 D2/전체1~6 필수 기준과 최소 텍스트·별도 승인 경계는 그대로다.
