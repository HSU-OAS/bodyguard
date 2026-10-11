# S4.B2 — 자세 기록의 원래 개인 기준 조회

기준 main `8afa75eebd13b9bdf6736d563b5f68bfaa855575`, `codex/record-baseline-detail`.

## 사용자 가치와 범위

FR-M-03(이전 기준선을 기록 해석에 보존), FR-R-01/03/06, FR-U-04, NFR-07/08. 기존 `/posture-records`의 분별 상세에서 기록에 연결된 개인 기준을 실제 API로 확인한다. 재보정했어도 현재 활성 기준으로 과거 기록을 바꿔 해석하지 않는다. 기존 ‘개인 기준’ 보조 항목 안에 명시 조회와 결과/복구만 연결한다. 새 탭·route·디자인 구조·보정 화면/producer·판정/의학적 해석을 추가하지 않는다.

카메라/SDK/3D·영상/좌표·새 수집/저장/보존 정책·브라우저 영속 저장·자동 저장/재시도·알림/추천/리포트·운영 변경 없음. 아바타/참여자/Docker/공식 문의/Gmail·Google 보류와 전체1~6 미완료를 유지한다.

## 화면 계약

주 행동은 기존 기간 조회와 분 상세 선택이다. 개인 기준은 상세의 보조 정보이며 ‘기준선 보기’로 요청할 때만 읽는다. 기존 백색/블루·한글 system font·48px 컨트롤·8/12px radius·간격/비교형 dl·secondary 버튼을 재사용한다. 새 색/카드/아이콘/폰트/모션은 없다. 초기/읽는 중/실제 저장값/없음/연결 실패/명시 재조회·계정 차단을 구분한다. 저장 날짜·목/어깨/몸통의 저장값·원래 method/unit만 표시하고 null은 ‘—’다. 날짜는 기존 기록의 locale 표현을 사용하며 UUID를 사용자 문구로 표시하지 않는다. 기존 비진단 안내는 유지한다.

frontend-design은 기존 스타일 재사용·보조 정보 계층·키보드/좁은 노트북 검수에만 사용한다. 이번 작업은 디자인 재설계 승인이 아니다.

## 수용 기준과 하네스

- R1: 목록/상세 선택만으로 baseline 요청을 보내지 않는다. baseline_id=null은 기존 ‘보정 전’만 표시하고 조회 버튼/요청0. 명시 행동 뒤 기록의 정확한 ID로 detail만 읽으며 active·POST baseline 요청0.
- R2: inactive 과거 기준·원래 날짜/method/unit/null을 표시한다. 현재 기준 대체·평균 편차 재계산·정자세 인증/정상 점수/가상 기본값/원시 데이터는 없다. 잘못된 ID·응답/owner/extra fields는 기존 strict client로 거부한다. 기존 summary 저장 검사의 버전과 실제 측정 부위 method/unit 관계도 대조하며 불일치한 기준을 표시하지 않는다.
- R3: committed ready 객체와 ID에 묶고 조회 single-flight. 분/기간/페이지/계정 변경·이탈의 layout cleanup에서 취소한다. 늦은 fetch/JSON 및 같은 ready 객체 ID 변경이 이전 값을 되살리지 않는다. auth401/403은 부모 기록/삭제 권한도 닫고 기존 명시 계정 재확인으로 복구한다. 다른 오류/404는 성공값 없이 명시 재조회만 제공한다.
- R4: 실제 React router의 제어 HTTP unit으로 무기준/과거 조회/중복/실패·404/잘못된 응답/명시 재시도/기간·분·계정·이탈 경합을 재현한다. 이는 실제 API·SQL·사람 검증이 아니다.
- R5: 새 소유 PostgreSQL/실제 FastAPI/production Chrome에서 합성 계정으로 기준 A 저장→요약에 A 연결→기준 B 교체→기존 상세에서 A 조회, 조회 전 요청0, 쿠키 계정 교체 차단과 서버 측 원래 소유권을 검증한다. 기존 summary 웹 회귀도 확인한다. 실제 값/메일/기준은 합성이고 사람 보정 정확도는 미실행이다.
- R6: 실제 1440/800px·키보드·초점·오류/빈 상태·long method/unit의 overflow를 확인하고 실제 화면을 보고한다. frontend 전체/타입/Biome, 관련 실제 SQL 회귀, 원래 product notice build/guard와 diff 검사를 통과한다. 초기 실패·기존 source/원본 증거는 보존한다.
- R7: code-review로 보안/소유 수명/성능/정확성·scope를 검토하고 scoped P1/P2 보완 뒤 최신 원격 diff·HEAD/main·CLEAN·체크 확인을 충족할 때만 merge commit. 브랜치 유지·main 직접 푸시 금지·운영/시크릿/비용/배포 별도 승인.

testing-strategy: component 경합/거부 시험 → 실제 저장된 기준/요약 SQL 계약 → 소수의 production 브라우저 사용자 흐름. 이전 API의 통과 시험을 이번 UI 통합 완료로 대신 세지 않는다.

## 상태

명세/수용 기준을 먼저 확정한 뒤 기존 공개 기록 화면의 조회·복구 연결을 구현했다. [실제 화면·초기 실패/보완·검증·작성자 리뷰](../review/record-baseline-detail/README.md)를 보존했다. frontend1844/관련 실제 SQL150/새 production Chrome3·기존 기록 회귀4와 타입·정적·원래 notice build/guard를 통과했다. 이는 합성 계정/기준값 시험이며 실제 사람·보정 정확도·전체 backend 재실행으로 세지 않는다.

로컬 좁은 Story 검증과 발견한 P2 보완 완료. 최신 원격 diff/main/HEAD/CLEAN/체크·조건부 병합 게이트는 대기 중이다. 전체1~6 완료/출시 후보판 선언이 아니며 보류와 별도 승인 경계는 유지한다.
