## Summary
- S4.20: 실제 AuthProvider의 계정 수명에 본인 day/week 조회를 연결합니다. 명시 조회·상태/취소·실시간 snapshot, refresh/logout/pagehide/unmount 폐기와 최신 요청 보호를 구현합니다.
- 공개 dashboard UI/새 디자인을 적용하지 않고 private React probe로 실제 로그인·조회 연결을 검증합니다.

## Verification
- 최초 module 부재 collection실패/실행0·첫 test week 추론 tsc 실패 로그 보존.
- React/AuthProvider unit13·전체frontend1568·actual Chrome/AuthProvider/API/새 SQL native6통과(retry0). mock reader/합성 계정·메일·요약·제어503/held 응답을 실제 사람 검증과 구분합니다.
- tsc/Biome·runner Ruff/format·actual native production build/private guard·공개 JS/CSS byte 동일·원본/압축/입력/불변 SHA·작성자 scoped 리뷰·git diff --check.
- 임시 DB exact live PID/UID/data_directory 확인 후 정상 중단·데이터/실패 보존. 아바타/SDK/운영 검증0.
- [계약](bodyguard/docs/stories/auth-dashboard-query.md), [실제 흐름·한계·증거](bodyguard/docs/review/auth-dashboard-query/README.md).

## Excluded
- 공개 UI/코칭·새 메뉴/차트/최종 디자인·Draft51/FR-R-03 전체/4단계/1~6 완료 선언.
- 아바타·실측/진단/효과·API/schema/CI/lock/개인정보/기본 시간대 정책 변경.
- 운영 DB migration·시크릿/비용/계정·배포·출시.
