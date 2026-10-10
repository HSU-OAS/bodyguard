# S4.23 — 로그인 후 요청한 개인 화면 복귀

2026-10-11 · main32e18a01 · codex/web-login-return-flow · FR-U-04/FR-R-03/NFR-08.

## 사용자 흐름·범위

현재 개인 기록·계정 주소를 열어도 게스트는 항상 next=/start로 바뀌고 로그인/가입 후에도 시작 화면으로만 돌아간다. 초기 S2.2 때 구현된 개인 화면이 start뿐이었던 제한을 현재 구현된 경로에 연결한다. PRD FR-U-04의 원래 시작하려던 흐름 복귀를 구현하며 화면/버튼/디자인/인증 방식/권한·API/데이터 정책을 추가하지 않는다.

기존 start, explore, records/UUID 상세, posture-records, account/notifications/delete 경로만 명시적으로 허용한다. 기존 기록 from/to 및 자세 기록 page의 유효한 값만 보존하고 기타 query/hash·토큰·외부/개발/없는 주소는 복귀 URL에 반사하지 않는다. URL은 이동 목적일 뿐 로그인/소유권 증명이 아니며 기존 AuthProvider와 서버 본인 조회/삭제 확인 절차를 반드시 거친다. Google/메일 재설정의 외부 callback 전달 계약은 이번에 바꾸지 않는다.

## 명세·하네스·완료 기준

1. 게스트 직접 진입→현재 개인 목적→로그인·가입 전환→이메일 인증 성공→동일 개인 화면. records의 기간·posture-records의 페이지를 보존한다. 기존 기본 시작과 수동 로그인은 start다.
2. 복귀 검사는 명시 경로/UUID·유효한 날짜·현재 page0~500 규칙으로 제한한다. 중복 next, 외부 URL, protocol-relative, backslash, 인코딩 경로 우회, 제어 문자·fragment·과도한 길이는 안전한 start로 복귀한다. 모르는 query/중복·잘못된 값은 전달하지 않는다.
3. /me 대기·503/로그아웃 실패는 현재 차단/재시도이며 next가 개인 화면을 우회하지 않는다. 로그인/가입이 실패하면 현재 폼·목적은 유지한다. 비밀번호/메일/CSRF/코드는 URL·storage에 추가하지 않는다.
4. 먼저 현재 App의 직접 진입/복귀 누락을 DOM RED로 재현한다. 순수 helper의 정상·공격 입력과 App의 로그인/가입·실패/대기·복귀를 검증한다. 전체 frontend/TS·범위 Biome·원래 production Vite build/private guard·고지 계약을 실행한다. CSS/본문/공개 코칭/아바타/SDK/백엔드는 변경하지 않는다.
5. 실제 Chrome/별도 소유 PostgreSQL·loopback API·시험 mail IPC에서 이메일 가입/로그인 후 기록/기간·계정 목적 복귀와 잘못된 목적의 시작 복귀를 확인한다. API 성공을 stub하지 않는다. 테스트 메일/합성 계정·실제 UI/HTTP/SQL을 구분한다. 실제 SMTP/Google/HTTPS·사용자 신체/아바타 검증은 아니다. 이번 자원만 종료하고 원본/실패를 보존한다.
6. 작성자 범위 리뷰, 최신 diff/HEAD/main·CLEAN·체크(없으면 없음)를 확인해 한 목적 PR을 merge commit으로 병합하고 브랜치를 보존한다. 전체1~6 게이트·아바타 보류·공개 코칭 구조/SDK 승인·실측/참여자·운영 승인은 그대로다.

## 디자인 계약

frontend-design의 사용자 과제/최단 복귀 원칙만 적용한다. 기존 화이트·블루·한 폼·제목/본문/48px 컨트롤·모서리/초점/아이콘/반응형/문구를 그대로 재사용하며 새 화면·메뉴·설명은 없다. 계정 진입이라는 중간 단계가 끝나면 사용자가 요청했던 이미 구현된 개인 화면을 연다. 탈퇴/삭제는 기존 명시 확인을 건너뛰지 않는다.

## 실제 결과

현재 기록/계정 목적의 RED4건을 재현하고 기존 주소만 연결했다. 원래 기간→이메일 가입/인증→기록·새로고침, 실제 잘못된 비밀번호 거절/재시도→계정, 외부/중복 목적→시작을 실제 Chrome·소유 API/SQL에서 확인했다. 메일/계정은 합성이며 SMTP/Google 성공·전체 공개 코칭은 아니다. 최종 frontend1639·TS·범위 정적·원래 production build/private guard/고지를 통과하고 backend/권한/API/CSS·아바타를 보존했다. [실패와 자원 종료·리뷰·남은 경계](../review/web-login-return-flow/README.md). 제한된 Story의 조건부 PR 게이트를 진행하며 전체4단계/1~6 완료로 표시하지 않는다.
