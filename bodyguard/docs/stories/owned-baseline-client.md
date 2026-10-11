# S3.B1 — 계정 소유 기준선 웹 연결

기준 main `d2204436fb52792d89834a93012b9bc5fcfed4dc`, `codex/owned-baseline-client`.

## 목적과 범위

FR-M-03/FR-R-01/06/FR-U-04/NFR-08. 기존 계정별 기준선 API에는 웹 클라이언트가 없다. 기존 저장 형식만 엄격하게 연결하여 본인 활성/과거 기준선 조회와 명시 저장·동일 ID 재시도를 제공한다. 실제 카메라 보정·정자세/계산법·추천 정확도·공개 화면의 완성이 아니다.

기존 동의된 서버 저장 항목·보존/삭제 정책은 유지한다. 영상/좌표/샘플, 로컬 영속 저장, 임의 임계값, 자동 저장/재시도, 새 UI/아바타/SDK/공급자/운영 변경은 없다. 현재 아바타·참여자·Docker·공식 문의·Gmail/Google 연결 보류를 유지한다.

## 구현 전 수용 기준과 하네스

- B1: 입력/응답은 기존 OpenAPI 필드만 허용한다. 유한 숫자·기술 한계, 방법/단위/버전·UUID·시간대가 있는 API 날짜·client-reported 출처를 검사하고 복사한 불변 snapshot을 반환한다. null을 추측한 정상값으로 바꾸지 않는다. 악성/누락/추가 필드와 caller mutation을 unit으로 검증한다. 기존 기준선 API의 `created_at`은 UTC 한정이 아니므로 유효한 오프셋과 마이크로초를 원문 그대로 보존한다.
- B2: 준비 시 committed ReadyAccount 객체와 계정 ID, 기존 세션 CSRF를 고정한다. 모든 데이터 요청은 같은 출처·same-origin credentials·no-store·15초 기술적 timeout, 고정 proof/계정 hint로 보낸다. GET에 기존 optional read-binding 검사를 적용해 쿠키가 바뀌었다 돌아오는 사이의 타인 응답을 차단한다. hint가 소유자를 선택하지 않는다. 기존 헤더 없는 API 호출과의 호환성을 유지한다.
- B3: 준비가 데이터를 자동 조회/저장하지 않는다. active의200 null, 과거 detail의 ID, save201/동일 retry200/충돌409·응답 echo를 검사한다. 과거 재시도 응답의 is_active=false를 활성으로 바꾸지 않는다. 새 ID/재전송/충돌·과거 및 타인 조회를 실제 PostgreSQL/HTTP로 확인한다.
- B4: single-flight, 종료/abort/새 ready 객체/동일 객체 ID 변경·늦은 response/json은 값을 반환하거나 저장 권한을 부활시키지 않는다. 불확실한 네트워크/저장 결과는 성공으로 표시하지 않고 lease를 닫는다. 새 명시 준비 후 같은 입력 ID로만 서버 멱등성에 따른 재시도가 가능하며 자동 재시도는 없다.
- B5: unit과 실제 소유 PostgreSQL/API 시험을 구분한다. 생성 타입 재생성, 전체 frontend·관련 backend 회귀·타입/정적/build·diff·작성자 리뷰와 최신 원격 gate를 실제 통과해야 병합한다. 실제 사람/메일/Google/아바타/출시 판정 검증이나 전체1~6 완료로 세지 않는다. 실패와 기존 증거는 보존한다.

## 검증 계획

Unit: strict DTO, snapshot, 정확한 status/echo, account/CSRF acquisition 및 data response 경합, 취소/중복 요청, retry·inactive history. Backend: 실제 SQL의 optional bound GET·타인/cookie/session 교체·헤더 없는 호환·기존 baseline races. 브라우저/HTTP 통합: 새 비공개 시험 consumer로 동일 계정 저장→조회→교체→과거 retry와 계정 전환 차단. 시험 UI는 제품에 연결하지 않는다.

## 상태

로컬 구현·검증 완료, PR의 최신 원격 diff/충돌/체크·조건부 병합 게이트 대기. [실행 결과·실패 원본·작성자 리뷰](../review/owned-baseline-client/README.md).

기준선 클라이언트 54개를 포함한 frontend 100개 파일/1827개, 실제 소유 PostgreSQL API 542개, 실제 Chrome/HTTP/SQL 세 흐름을 통과했다. 초기 Chrome의 두 실패와 만료 뒤 늦은 응답을 받던 작성자 리뷰 P2를 보완했다. API 타입 정상 재생성 후 12개 검증 대상 파일의 SHA256이 실제 최종 시험 대상과 일치하며, 공개 제품 JS/CSS는 PR138의 실제 빌드와 동일하다. 소유 시험 DB는 종료하고 데이터·기존 실패/파일은 보존했다.

이 결과는 기존 기준선 API의 웹 연결만이다. 실제 카메라 보정값 생산·방법/정자세의 검증·추천 및 공개 보정 화면은 선행 동작/실측 기준과 통합이 남아 있다. 아바타/참여자/Docker/공식 문의/Gmail/Google 보류, 출시 동작0, 전체1~6 미완료 및 별도 승인 경계는 그대로다.
