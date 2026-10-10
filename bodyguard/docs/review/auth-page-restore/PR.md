## Summary
- 실제 Back 캐시 복원이 실패/진행 중 auth/logout을 덮고 개인 화면을 재개하던 AuthProvider 경로를 기존 refresh 보호 계약에 맞췄습니다.
- 정상 캐시 복원의 fresh 권한 확인과 명시 로그아웃 재시도는 유지합니다. 기존 화면/CSS/문구/API/DB 정책은 변경하지 않습니다.
- 사전 명세·실제 캐시 하네스·원본 RED/실행 입력/SHA·실제 기존 화면·작성자 리뷰를 저장했습니다. [근거와 한계](bodyguard/docs/review/auth-page-restore/README.md).

## Verification
- corrected DOM RED 5실패/2통과, native CDP RED 2실패/1통과 → 부품49/전체frontend1504/native 캐시3 통과.
- 실제 Chrome155/production 웹/FastAPI/새 소유 PostgreSQL18.6: 동일 문서/native persisted1, 실패 확인 유지→명시 retry204→login/old-cookie401, 정상 ready 서버 폐기 재확인.
- 기존 native 계정11(실제60초)/통합2/비밀번호5/기록11, 관련 backend SQL64 통과. 메일/기록은 fixture, wrong200/503 응답 주입, pending 작업은 DOM 합성입니다.
- frontend tsc/Biome301(info15)/build/private guard, backend Ruff/format48/mypy app11, git diff --check, source19/불변187/120증거 압축·원본SHA 통과. 시험 전용 DB 소유 확인 후 정상 중단·원본 보존.
- 최초 unit matcher 오류·native goBack load 시간 초과·loopback sandbox 제한은 별도 실패로 보존했습니다. 최초 native pipeline tee exit0을 통과로 표시하지 않습니다. 500ms 관측/Chrome 한 버전이며 전체 브라우저·무한 시간 검증은 아닙니다.
- 작성자 scoped 리뷰: 미해결P1/P2 없음. 원격 최신 diff/HEAD/main/CLEAN/체크는 병합 직전에 확인하며 체크가 없으면 체크 없음으로 기록합니다.

## Excluded
- 새 아바타 제작/형상/GLB/변형/WebGL/실제 카메라/SDK 추론0. 최신 아바타 보류 지시를 유지합니다.
- 공개 코칭·디자인 구조 확장·판정/임상·정책/schema/운영DBmigration·CI·lock/의존성 변경0.
- 실제 공급자/계정·비용·시크릿·Docker/TLS·운영·배포·출시0. 기존 D2/시작P2·UI/SDK/실측·외부/운영/전체1~6 게이트는 미완료입니다.
