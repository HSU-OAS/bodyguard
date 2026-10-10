## Summary
- S4.18: 본인 저장 기록의 day/week 전체 집계 API를 최신 main에 분리합니다. 기존 session/read binding·한 SQL snapshot·명시적 IANA 달력/DST·가중/partition/null 출처를 유지합니다.
- Draft51의 server26시험/구현만 재사용하고 actual owned HTTP·OpenAPI 타입을 추가합니다. 새 대시보드/UI/parser/메뉴는 적용하지 않습니다.

## Verification
- 최초 SQL26/actual HTTP1은 endpoint404 RED, 구현 후27·전체backend536통과(warning2)·Ruff/format/mypy app 통과.
- 최초 frontend1503/1실패 보존; 독립 PR115 clock 보완 병합 뒤 이 작업트리 전체1505통과. 실제 OpenAPI·tsc/Biome/build/private guard통과(info15).
- actual public JS/CSS2파일 byte 불변·source16/불변215/압축·원본57 SHA·작성자 scoped 리뷰 P1/P2없음·git diff --check.
- 첫 DNS build/dist guard 실패와 cached/통합 성공을 별도 보존합니다. 자체 SQL/native loopback HTTP·합성 계정/메일; browser/사람/SDK/아바타/운영 검증0. 소유 임시 DB 정상 중단·데이터/실패 보존.
- [명세](bodyguard/docs/stories/dashboard-query-api.md), [실행·경계·증거](bodyguard/docs/review/dashboard-query-api/README.md).

## Excluded
- Draft51/FR-R-03/전체4단계/1~6는 미완료를 유지합니다. 실제 coaching→새 대시보드 연속 흐름은 미검증입니다.
- UI/디자인·producer/진단/점수/효과·첫 출시 timezone/보관 정책·avatar/GLB·schema/CI/의존성·비용/계정/시크릿·운영 DB migration·배포·출시 변경0.
