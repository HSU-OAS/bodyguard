## Summary
- 합성 관찰의 실제 분 집계/본인 업로드 → 조회 → 기존 기록 상세/확인 삭제 → 빈 목록을 연결하는 비공개 Chrome 하네스.
- 저장/삭제 응답 단절, 명시 동일 재시도, preview 후 신규 기록 보존, 계정 변경/늦은 응답을 실제 HTTP/격리 SQL로 검증.
- 실행 전 Story, 원본 report/실행 입력/실제 화면·SHA 증거를 보존. 제품/UI/schema/정책 변경 없음.

## Verification
- 실제 `tests.run_browser recordjourney`: Chrome155/localhost API/새 PostgreSQL native5 통과, retry/skip0. 메일·계정·관찰·응답 단절은 합성/명시 제어이며 실제 사람/아바타/공급자 시험이 아님.
- 전체 frontend1568, tsc, Biome314파일(기존 info16), runner Ruff/format, production/private build, private guard, `git diff --check`.
- 증거27/입력6/제품·migration·lock/config194 불변/공개 JS·CSS2 byte 동일. PG 소유 확인 후 종료·원본 보존.
- 작성자 scoped 리뷰: 미해결 P1/P2 없음. 독립 리뷰는 아니며 최신 diff/HEAD/main/CLEAN/체크는 병합 전에 실제 확인.

## Excluded
- 신규 제품 구현/공개 코칭·대시보드 화면/확정 디자인·실제 몸/임상·SDK/아바타 시험과 제작.
- 비용/계정/시크릿/운영 DB migration/배포/출시·중요 안전/개인정보 정책 변경.
- 전체 backend 재시험/타입 재생성·Draft51 전체·4단계/1~6 완료 선언. 아바타 보류 및 기존 필수 출시 게이트 유지.
