# S4.20 — 실제 로그인 수명에 기록 조회 연결

2026-10-10 · main d2501686b913fb9fb459be6c85e1b6ba143a39a6(PR117 병합) · codex/auth-dashboard-query · 구현 전 계약.

FR-R-03/06·FR-U-04·NFR-08. 기존 readDashboard를 실제 AuthProvider의 ready 수명에 연결한다. 새 메뉴/차트/공개 디자인은 적용하지 않고 독립 React adapter와 실제 AuthProvider/SQL/Chrome 시험으로 연결 흐름을 완성한다. 깨끗한 이전 checkout/동일 lock 설치만 재사용하며 새 브랜치는 최신 main에서 시작했다.

## 수용 기준·하네스

1. mount/checking/guest/새 ready는 자동 조회하지 않는다. 날짜/period/IANA를 모두 명시한 read만 허용하고 실패/빈 결과를 가짜 성공으로 대체하지 않는다. 상태 idle/loading/ready/error·명시 read/cancel·실시간 getSnapshot을 제공한다.
2. 원래 ready 객체/owner ID·현재 요청 세대·mount를 고정한다. 동일인 refresh·다른 계정·logout 실패 포함 모든 non-ready·취소·pagehide·unmount 시 이전 요청을 abort하고 저장/표시 데이터를 폐기한다. 재등장/새 계정은 명시적 새 read가 필요하다.
3. 늦은 성공/실패·취소 무시 transport·동시 교체 요청이 최신 결과를 덮어쓰지 못한다.401은 아직 현재 요청일 때만 기존 AuthProvider.refresh로 서버 권한을 재확인한다.503/422는 명시 재조회 가능하며 자동 retry/기본 timezone/새 저장 정책이 없다.
4. 구현 전 absence RED를 보존하고 React+실제 AuthProvider 단위 시험으로 수명/경합을 검증한다(mock reader/인증). actual Chrome·소유 loopback API·새 격리 SQL private compiled React probe로 명시 day/week→refresh 폐기→새 조회·실제 logout 중 폐기·오류→retry·다른 계정·unmount를 검증한다. 합성 계정/메일/요약 및 명시 응답 제어이며 실제 몸/SDK/아바타/전문가 검증은 아니다.
5. 전체frontend·tsc/Biome/build/private guard·공개 JS/CSS byte 불변·backend runner 정적 검사·원본 실패/최종 입력/SHA·작성자 scoped 리뷰·최신 원격 diff/HEAD/main/CLEAN/체크 후 한 목적 PR/조건부 merge commit·브랜치 유지. 중복 설치/전체backend 재시험은 없고 관련 실제 API 경계는 native로 확인한다.

## 미완료·승인 경계

제품 route/CSS/문구/새 디자인/공개 대시보드 적용·Draft51/FR-R-03 전체/4단계/1~6·출시 후보판은 미완료다. 아바타 보류·기존 원본/실패·출시 동작0/실측/참여자·시작P2·승인 UI/SDK·외부/Docker/HTTPS·권리/법무·Q13/27/32·운영 조건은 유지한다. 중요 범위/안전/개인정보·비용/계정/시크릿·운영 migration/배포/출시는 별도 승인이다. 원본 영상/좌표·메일/cookie/token IPC를 증거에 저장하지 않는다.
