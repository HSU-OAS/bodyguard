## Summary
- S4.19: 본인 일·주 조회 웹 reader를 원래 계정/명시 날짜·기간·시간대와 exact DTO 검증에 묶습니다.
- Draft51 원본 client/44 unit을 재사용해 query 기본값·동일 객체 ID 변경 반례를 먼저 검증·보완합니다. 새 대시보드 UI·공개 import는 적용하지 않습니다.

## Verification
- 최초 collection실패/실행0, 원본 unit44통과/6실패, 현재 CSRF 전달을 제어한 actual Chrome 반례1실패를 보존했습니다. 옛 Cookie 서버 보호 최초1/경로2통과와 혼동하지 않습니다.
- unit50·최종전체frontend1555·actual Chrome 최종5·관련 SQL/HTTP27통과. tsc/Biome306(info15)·Ruff/format41/mypy12·build/private guard 통과.
- 원본/압축·입력/불변 SHA·실제public JS/CSS2 byte 동일·작성자 scoped 리뷰 P1/P2없음·git diff --check. 첫 import검사/잘못된 cwd/없는 guard 실패를 별도로 보존합니다.
- 소유 임시 DB 정상 중단·자료 보존. 실제 Chrome/HTTP/SQL+합성 계정/메일/요약·명시 CSRF/DTO 주입이며 실제 몸/SDK/아바타/전문가/운영 검증0입니다.
- [명세](bodyguard/docs/stories/dashboard-client.md), [실행·한계·증거](bodyguard/docs/review/dashboard-client/README.md).

## Excluded
- 대시보드 UI/디자인 적용·Draft51/FR-R-03 전체/4단계/1~6 완료·최종 출시 후보판 선언.
- 아바타/GLB/리깅/외형·실제 판정/효과·schema/CI/의존성/첫 출시 timezone 정책 변경.
- 운영 DB migration·시크릿/비용/계정/외부 공급자·배포·출시.
