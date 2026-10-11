# S3.C8 — 소유 모델 파일 준비와 Worker 초기화 분리

기준 main `8a658be0f720c61069d35cacf384568cc2fe001e` · `codex/owned-model-preparation` · FR-M-02/07·FR-U-04·NFR-07/08. CEO의 기존 Story 사전 승인 범위이며 3D 아바타 제작·공급자 연결을 재개하는 작업이 아니다.

## 실제 선행 진단

현재 main의 실제 Chrome154/SDK/heavy·얼굴·손 준비를 사용했다. 원본 모델의 첫 로컬 응답만6000ms 제어 지연하면 준비가 실패한다. 지연 없는 비교는 ready491.2ms, 지연 조건은 실패/정리6699ms였다. 시험용 사전 fetch는 준비가 이어졌으나 전체6498ms로 다운로드를 없애거나 빠르게 만든 것이 아니며 큰 모델/WASM이 재요청됐다. 캐시 헤더는 시험용이고 운영/실사용/과거 시작P2 원인 해결로 일반화하지 않는다. 세 조건 모두 Worker1/종료1·저장/영상/추론/카메라/아바타0, 기존 소스5개 before/after 동일이며 소유 서버·브라우저를 종료했다. 원문·실패/시안 bundle은 `/private/tmp/bodyguard-sdk-policy.dtrGHy/cold-download.json` 및 같은 폴더에 보존했다.

`graphify`의 제한된 pose AST 지도는 경로 확인용이다. 범위 밖 import 등 dangling121·self-loop3·directed collapse 위험33이 있어 완료/성능 증거로 쓰지 않는다. SDK 병렬 GPU 준비 후보 PR124는 성능 게이트 실패/Draft/미채택을 유지한다.

## 범위·설계 경계

- 명시된 기존 준비 작업에서만 같은 출처의 고정 모델 파일을 읽고 브라우저 메모리의 소유 byte로 준비한다. 원본 asset/version·heavy 기본값·얼굴/손·판정·SDK의 GPU/CPU 복구·공개 UI/통신 정책을 바꾸지 않는다. 새 캐시/Service Worker·DB/스토리지·API/계정/시크릿/외부 연결은 없다.
- 모델 byte와 Worker 초기화를 분리하고 모델 buffer를 소유 전송해 큰 파일의 캐시 재사용 여부에 의존하지 않는다. 경로·응답/용량/무결성·취소·늦은 반환을 검사한다. 5초 Worker init/inference/cleanup 한계는 유지한다. 새 모델 읽기 한계는 비임상 기술 경계로 명시하고 전체 클릭→준비 시간과 다운로드 이동을 별도로 보고한다. 시간 이동만으로 기존 시작P2를 닫지 않는다.
- init 전 취소/오류와 init 후 native 회수를 구분한다. native task가 시작되지 않은 Worker만 직접 종료할 수 있고, init 이후는 원래 acknowledgement/정리 실패 차단을 유지한다. 새 준비는 이전 소유자 회수 이후만 가능하다. 늦은 다운로드나 응답은 ready/카메라/기록 권한을 부활시키지 않는다.
- 원시 영상/관절·개인정보는 받거나 저장/전송하지 않는다. 공개 모델 byte뿐이며 출시 동작0·코칭 공개 비활성·아바타 및 참여자/Docker/공식 문의/Gmail/Google 보류는 불변이다. 제품 코드의 대규모 UI/UX 변경이나 별도 안전/개인정보 정책 변경이 필요하면 그 실행은 별도 승인한다.

## 하네스·수용 기준 — 구현 전에 적용

1. 고정 모델 byte의 실제 원본/무결성 대조와 합성 404·redirect/다른 출처·변조/축약/초과·누락·abort/늦은 반환을 구분한다. 기존 파일/실패를 덮어쓰지 않는다.
2. Worker factory/receive/native engine에서 transfer 소유권·옵션 snapshot·init 전/후 취소·정리 실패·중복/늦은 응답과 기존5초 응답 경계를 검증한다. 준비 모델을 임의 변경하거나 기존 회귀를 완화하지 않는다.
3. 실제 Chrome/기존 SDK/heavy·얼굴·손으로 정상/느린 모델/모델 읽기 취소와 첫 추론·정리·동일 출처 경계를 검증한다. 제어 응답·빈 frame/가짜 카메라는 실제 사람·정확도·외형 검증이 아니다. 실제 Auth 소유 화면의 기존 명시 준비/끄기·계정 회수·retry도 재검증한다.
4. 전체 frontend·타입·범위 정적·원래 production build/고지/private guard·diff·작성자 리뷰와 최신 원격 diff/HEAD/충돌/체크를 통과해야 조건부 병합한다. 별도 실측/아바타/외부/운영·전체1~6 기준은 그대로 유지한다.

## 상태

고정 원본5개의 byte/SHA256·동일 출처 검증, 메모리 buffer 소유 전송과 init 전/후 취소 경계를 구현했다. 모델 읽기/해시 전체30초는 최대42,796,278byte의 준비 중 무제한 대기를 막는 기술적 오류 경계이며 권장 대기 시간·성능 합격선·임상 수치가 아니다. Worker init/inference/cleanup5초와 기존 실제 시작 시험 한계는 그대로다. 새 cache/Service Worker·DB/스토리지는 없다.

[실제 흐름·실패·작성자 리뷰·검증 증거](../review/owned-model-preparation/README.md). actual Chrome의 정상 준비638.1ms/첫 빈 추론·소유 종료, 첫 모델6초 지연 후 준비6452.3ms/첫 빈 추론·종료, 다운로드 중 취소252.1ms와 변조51.6ms의 실패/종료를 확인했다. 시간 이동을 기존 시작P2 해결/성능 개선으로 세지 않는다. 실제 AuthProvider 화면8개 흐름은 제어 계정 API와 native 가짜 카메라를 사용했으며 실제 SQL/메일/Google·사람 검증이 아니다.

전체 frontend1773/99파일·타입·Biome(기존 info16, 오류0)·고지18·원래 제품 고지 게이트가 있는 build/원래 guard body와 diff를 통과했다. 작성자 리뷰에서 테스트의 ignored 모델 파일 의존을 발견해 합성 unit와 별도 실제 원본 CLI로 분리·재검증했다. 현재 Story 범위 미해결P1/P2 없음, 커밋/PR/조건부 병합 게이트는 별도 확인한다. 아바타/참여자/Docker/공식 문의/Gmail/Google 보류·전체1~6 기준과 기존 시작P2는 그대로 미완료다.
