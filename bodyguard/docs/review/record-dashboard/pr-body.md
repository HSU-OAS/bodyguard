## Summary
- 로그인한 본인의 하루/한 주 자세·수행 기록을 기간 전체 SQL snapshot으로 집계하고 화이트·블루 의료 느낌 대시보드, 기존 기록 관리/복귀·빈 기간/오류 수동 재조회를 연결했습니다.
- 계정 수명·소유권·DST/반복 날짜·방법/단위/기준·버전 분리와 수치 정밀도 경계를 검증했습니다. 영상·좌표·새 저장 정책·임상 판정 변경은 없습니다.
- **Draft / Story in-progress**입니다. 최신 재검증에서 기록/공개 Chrome은 통과했지만 첫 전체 단위 회귀의 간헐 실패, 이전 시작 실패 원인/실사용 성능, 새 디자인 구조/적용 범위가 남아 있어 병합하거나 완료로 표시하지 않습니다.

## Verification

2026-10-07, 최신 main39a23eb 통합 실행 HEAD52f73b2:

- 실제 합성 저장→일/주 집계→관리/복귀·빈 기간/오류 복구·기대 계정 차단Chrome2, 기존 자세 기록/삭제4, 동작 선택/공개 진입8, strict 시작5와 격리 PostgreSQL18.6/API492 통과. 기존 assertion/5000ms/30초 제한과 제품 구현 변경0.
- 전체 frontend 첫 실행742통과/1실패, 단독3/파일23 통과, 소스 변경 없는 두 번째 전체743통과. **첫 날짜 복구 간헐 실패는 원인 미확정**이며 성공 재실행으로 해결 처리하지 않습니다.
- 실제 OpenAPI 재생성 변경 없음·타입/정적/build/production guard 통과. 최초 sandbox 캐시 접근 실패와 수집기 ENOTDIR 실패는 별도로 남겼습니다.
- `bodyguard/docs/review/record-dashboard/current-20261007/summary.json`: 실제 실행 소스198 SHA·16개 수집 실행·19개 브라우저 case·최초 단위 실패. raw DOM/실패 원문/계정 데이터는 게시하지 않았습니다. allRequiredGatesPassed/storyComplete/mergeAuthorized=false입니다.

아래는 보존한 2026-10-06 결과입니다.

- 실제 frontend738/42파일, 격리 PostgreSQL/API492·대시보드API26/파서·DOM56 통과. 기존 asyncio warning1 유지.
- 최종 production Chrome2: 합성 저장→일/주 조회→리로드/관리 복귀, 빈 기간/잘못된 URL/503 복구/실제403·좁은 창/확대/키보드 통과. 사람·카메라·의료 검증 아님.
- 실제 OpenAPI 타입 생성·Biome146·Ruff/format47·mypy12·typecheck·build·public guard·Node 증거 검사12·git diff --check 통과.
- **실패:** 기존 기록 Chrome headless1통과/3실패·headed4실패, 공개 Chrome2통과/6실패. 기존5초/30초 기준 유지. 변경 전 최신 main991ed2b의 격리 비교에서도 같은 공개6실패/2통과, 원인은 미확정입니다.
- BMAD3역할 보완·재검토, source29/artifact141 SHA·길이/strict 결과 독립 읽기 감사. 첫 publication self-log hash 실패도 별도로 보존했습니다.
- 증거: `bodyguard/docs/review/record-dashboard/README.md`와 `runs/dashboard-20261006T131052226822Z-f86b9b9c1635/artifacts.json`. allRequiredTestsPassed/storyComplete/mergeAuthorizedByThisBundle=false, 수집기 incomplete exit2.

## Excluded
- PR 병합·CI 변경·DB migration/운영 DB·서버/시크릿·외부 계약·결제·배포·출시를 하지 않습니다.
- 실제 측정 producer/classifier·두 최종 아바타·SDK privacy P2·참여자/실측·알림/PDF/LLM/변화·법무/HTTPS/운영·전체1~6단계 완료를 선언하지 않습니다.
- 같은 아바타 부위의 새 제작 사이클은 시작하지 않습니다. 독립 초기 웹 응답 분리·준비 하네스는 최신 main의 별도 Story에서 진행합니다.
- 현재 화면은 기능 검증용이며 최종 디자인이 아닙니다. 새 미승인 화면 구성 확장·대규모 제품 UI 적용은 하지 않았습니다. 화이트/블루 v4·텍스트 최소화는 클릭 가능한 구조/적용 범위 합의 후 적용·재검증합니다. 초기 시작 하네스는 PR #54로 이미 병합됐으며 이전 실패 원인 해결 선언은 아닙니다.
