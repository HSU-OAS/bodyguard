# S4.19 — 본인 일·주 조회 웹 클라이언트 계약

2026-10-10 · 시작 main `517cc970c1c01f99cd3b91a5111d2c732dab28f5` (PR116 병합) · `codex/dashboard-client` · 구현 전 명세.

## 사용자 가치와 기존 미완료의 경계

FR-R-03/06·FR-U-04·NFR-08: 저장된 본인 일·주 전체 기록을 웹에서 받기 위한 DTO 검증/취소·계정 수명 adapter를 만든다. 새 화면·메뉴/대시보드 구조는 승인받지 않았으므로 공개 UI를 적용하지 않는다. Draft51의 client/시험을 검토·재사용하되 첫 출시 날짜/timezone 기본값을 확정하지 않고 모든 조회 필드를 명시적으로 요구한다. aggregate는 client-reported이며 실제 자세/효과 인증이 아니다.

## 구현 전 수용 기준과 하네스

1. query date/period/timezone은 전부 필수다. unknown/duplicate/missing·존재하지 않는 날짜·numeric offset/잘못된 IANA를422로 거부한다. 주 월요일·DST 자정 gap/skip/repeat UTC envelope는 server 계약에 맞춘다. 브라우저 timezone/오늘을 자동 기본값으로 삼지 않는다(Q18 미정 유지).
2. exact DTO의 request 날짜/기간/zone·local/UTC 경계·duration/group/가중·bad ratio·기준선/version/method/unit·null/출처를 검증한다. 없는 알림0·다른 owner/기간·누락/중복 part·nonfinite/precision-null 훼손·정합성 오류는503이다. posture threshold를 새로 정하지 않고 accepted additive tolerance만 유지한다. 반환은 읽기 전용이며 저장/cache/원시 관절 값이 없다.
3. 원래 ready 객체와 **원래 owner ID**를 조회 시작에 고정한다. caller/abort/동일 객체의 owner 변경도 원래 계정으로 다시 묶지 않는다. me→csrf→me→bound GET→final me와 전체15초 deadline을 유지하고 late JSON/계정 변경·폐기 뒤 값을 반환하지 않는다. 새로운 session/보관 정책이 아니다.
4. 최초 unit import-absence RED와 port 원본을 보존한 뒤 기존 shape/numeric/calendar/세션 시험 및 필수 query/in-place owner 변경 시험을 실행한다. 실제 Chrome·production 공개 웹/소유 FastAPI·새 격리 PostgreSQL의 private compiled probe로 day/week·본인/타인 분리·late 응답 후 실제 logout/계정 전환·revocation·실제200의 변조 DTO 거부를 검증한다. synthetic 계정/메일/저장 요약이며 카메라/SDK/3D/실사용자 검증은 아니다. 시험 중 원래 Cookie snapshot은 서버가 이미 거부함을 확인했다. 별도 반례는 같은 ready 객체 변경 뒤 실제 현재 세션 CSRF 응답을 하네스가 전달하는 명시적 제어이며 자연 발생 경합 재현/서버 취약점으로 표시하지 않는다.
5. 전체frontend·tsc/Biome/build/private guard·실제 public JS/CSS byte 불변·관련 SQL/API와 변경된 backend test runner 정적 검증을 실행한다. 화면이나 판단 경계를 우회하지 않는다. 입력/최초 실패·압축/원본SHA·작성자 scoped 리뷰·최신 diff/HEAD/main/CLEAN/체크 후 한 목적 PR/조건부 merge commit, 브랜치 유지.

## 제외·독립 진행

공개 route/화면·새 디자인/문구·대시보드 적용/차트·최종 추천/판정/동작 목록·실제 몸/노트북 성능·아바타 보류/기존 원본·실패를 유지한다. 새 GLB/변형/외형/WebGL 검증0. Draft51/UI/역사적 시작P2/전체FR-R-03/4단계/1~6·출시 후보판을 완료로 바꾸지 않는다. SDK 통신/개인정보 승인·실측/참여자·Docker/실제 외부 공급자/HTTPS/권리/법무·Q13/27/32는 여전히 남아 있다. 비용·계정·시크릿·운영migration·배포/출시·중요한 안전/개인정보 변경은 별도 승인이다. 메일/쿠키/token/운영·원본영상/실제좌표를 증거에 저장하지 않는다.
