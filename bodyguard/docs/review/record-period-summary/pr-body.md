## Summary
- 기존 자세 기록 화면에 날짜·일/주 선택과 본인 전체 기간 집계, 빈/오류/명시 재조회 연결
- 삭제·기간/계정/이탈 시 옛 집계를 버리고 조회 대기의 키보드 초점과 중복 요청 차단 유지
- 실제 화면·실패/보완·원본 SHA와 Story/진행 문서 보존, 새 메뉴나 디자인 개편 없음

## Verification
- 실제 production Chrome155 → loopback FastAPI → 새 PostgreSQL18.6 UTF8: 새3흐름/기존4흐름 통과(합성 계정·기록/메일 및 제어 장애, 사람/SDK 판정 아님)
- frontend 전체105파일/1896개·관련130개, pnpm build(타입/notice), pnpm check(기존 info16), production guard, git diff --check 통과
- 초기 DOM 실패·DB 인코딩/샌드박스 실패·자정 fixture 실패·버튼 초점 실패와 이후 보완을 기록, 두 소유 시험 DB/리스너 종료·데이터 보존
- 작성자 scoped 리뷰 미해결 P1/P2 없음. 독립 전문가 리뷰/전체 backend/실측/외부 공급자/운영 검증 아님

## Excluded
- 아바타·카메라/SDK·판정/추천·새 메뉴/대규모 UI·API/DB schema/CI 변경
- 운영 DB migration·시크릿·비용/계정·공급자 연결·Docker/HTTPS·배포/출시
- 출시 후 이월된 자세 알림/PDF/LLM/변화 탐지; 기존 Draft51·보류·시작P2/실패 및 전체1~6 실제 기준 유지

사전 승인 범위의 조건부 merge commit이며 정확한 최종 HEAD/diff/main/CLEAN/체크를 병합 전에 다시 확인합니다. 브랜치 자동 삭제는 하지 않습니다.
