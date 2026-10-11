# S3.C6 — 입력·재생·로그인 소유 코칭/기록 통합

기준 main `f4bddae03ea16795b83fbadfe4ea1f9ce7aed1e1` · `codex/recorded-playback-assembly` · FR-M-02/07·FR-S-02/04·FR-R-03·FR-U-04·NFR-07/08

상태: 로컬 구현·검증 완료, 조건부 PR 게이트 진행 중. CEO의 독립 웹 기능 우선·UI/UX 추후·아바타/실제 참여자/Docker 보류를 유지한다. PR132 병합/main 포함을 실제 확인했다.

## 범위와 기술 결정

기존 `useRecordedCoaching`의 계정 캡처/기록 소유권과 세션 엔진에, 현재 native 재생 adapter가 필요로 하는 입력·시계 tick·실패·시범 동기화·세대별 시작을 한 공통 hook으로 연결한다. 매 준비마다 새 **inert** 재생 owner를 넘기고 카메라/추론/아바타 획득은 세션의 명시 start와 네 개 strict gate 뒤에만 한다. loop를 새로 중복 실행하지 않는다. 입력은 adapter의 원래 generation/sequence/sampledAt를 그대로 전달한다. 준비/촬영 기술 상태를 자세 판정으로 변환하지 않는다.

기존 비공개 Auth 코칭 시험 consumer를 공통 hook으로 전환한다. native 아바타 consumer의 새 외형/GLB/변형/브라우저 사이클은 보류한다. 이 consumer의 동작·자원·판정은 명시 합성으로 유지한다. 입력→실제 엔진→결과→본인 HTTP 저장 경계의 시험이지, 실제 사람/동작 정확도나 SQL 시험을 대신하지 않는다. 실제 제품 start/출시 동작0은 변경하지 않는다.

## 수용 기준과 하네스

1. DOM/unit: mount/guest/준비만으로 자원/start/POST0. 소유 세션이 running인 새 세대에만 재생 시작을 한 번 호출한다. 시범 동기화는 같은 엔진 상태를 사용한다. gate false에서 획득하지 않는다.
2. 합성 frame: 원래 stamp 전달, 복수/미검출/과거/늦은 세대/잘못된 단계는 관찰 적립으로 쓰지 않는다. tick은 입력 없이도 만료를 반영한다. 합성 올바른 순서만 기존 엔진의 hold/return 완료를 만들고 저장은 명시 save만 한다.
3. DOM/unit: pause/resume·같은 계정 refresh/logout·교체 준비·취소/숨김/unmount에서 옛 callback/start/save가 새 소유자를 바꾸지 못한다. 재생 실패/start 거절·cleanup 실패를 고정 오류로 끝내고 재준비 경계를 보존한다.
4. 실제 Chrome/React/HTTP 시험: 전환된 기존 비공개 consumer의 명시 준비→합성 수행→명시 본인 결과 저장→계정 회수/대기 취소를 연결한다. 소유 임시 HTTP fixture만 사용하며 합성 계정·메일/자원·clock·판정을 실제 인증 사업자/SQL/웹캠으로 세지 않는다. GLB/카메라/외부 요청·저장소0을 확인한다.
5. 전체 frontend 회귀·타입·변경 파일 정적 검사·production build/private 제외·공개 JS/CSS byte·diff를 실제 실행한다. 실패/원문을 보존하고 작성자 리뷰 및 최신 PR conditional merge gate를 확인한다. 미실행 검증은 미실행으로 기록한다.

## 제외와 완료 조건

아바타 제작/새 GLB/변형/실제 브라우저 아바타, 임상 classifier/기준값/추천·적격 목록 변경, UI/디자인 확장, 참여자, Docker/HTTPS, 운영 DB·실계정·시크릿·비용·배포/출시는 제외한다. 기존 시작 P2와 원인 미확정 native timeout은 유지한다. 이 Story의 통합 계약 완료는 전체1~6/공개 코칭 완료가 아니다. 실제 결과와 남은 조건은 실행 후 기입한다.

## 실제 결과

[작동 흐름·합성 기록 화면·원문/실패·작성자 리뷰](../review/recorded-playback-assembly/README.md). 공통 hook과 기존 비공개 consumer 연결, 원래 stamp/현재 상태·세대별 한 번 시작·계정/취소/실패/정리 경계를 구현했다. 작성자 리뷰의 동기 실패 reentry P2를 실제 RED로 재현·보완했다. 최종 전체98파일1743·범위185·실패/skip0, 실제 Chrome/React/fixture HTTP5흐름·외부/GLB/카메라/Worker/저장소/페이지 오류0, 타입/정적/build/private/CSP/고지/공개 byte 동일/diff를 실제 확인했다. 이 시험은 native SDK/실제 SQL/참여자/아바타가 아니다. 원래 실패와 중간 하네스·타입/verifier 오류는 보존/구분했다. 최종1~6·출시 적격0·보류/승인 기준은 유지한다.
