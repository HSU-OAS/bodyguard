# 본인 기준선 API — S4.13 검증 기록

현재 기준선 저장·교체와 본인 과거 조회가 동작한다. 새 보정은 이전 기준선을 삭제하지 않고, 같은 과거 요청을 재전송해도 현재 기준선으로 되돌리지 않는다. 기준선이 없으면 null이며 서버가 신체 상태나 기본값을 추측하지 않는다. 값은 client-reported이다.

## 실제 실행과 한계

실제 FastAPI/ASGI·소유 PostgreSQL18·인증 쿠키/CSRF·독립 SQL 잠금·migration을 실행한다. 계정·메일·시각·기준선 값은 합성이다. HTTP TestClient의 HTTPS base URL은 실제 TLS/배포 증거가 아니다. native backup 시험은 새 소유 source/target DB의 실제 API 저장·pg_dump/pg_restore·현재/과거 기준선 조회·타인404·제약 보존·실패 시 정리를 확인한다. 기존 snapshot 이후 삭제·로그아웃·비밀번호 변경이 restore로 재생되는 위험은 그대로 관찰됐고 운영 복구 승인은 false다.

웹은 기존 화이트·블루 디자인/라우트를 바꾸지 않는다. 공개 웹 Chrome 회귀의 가입/탐색 상태와 합성 RAF 시험은 실제 카메라·사람의 정자세·보정 정확성·아바타 검증이 아니다. 이번 API 저장을 공개 측정 기능의 완성으로 표시하지 않는다. 지정 web-design-studio의 기존 계약을 유지하고 새 UI/Figma/axe 또는 디자인 개편을 주장하지 않는다.

## 실패·리뷰 이력

- 최초 B01은 미구현 `/baselines/active`의 실제404로 실패했다. collection-only 실패가 아니다.
- 초기 기준선36·경쟁8/독립 backup5 및 전체365 API, frontend558·공개8 회귀가 통과했다.
- 독립 읽기 전용 리뷰에서 상세404/재시도200/충돌409가 OpenAPI에서 빠진 P2를 발견했다. 별도 red는 실제 schema의200 KeyError였고 새 route 응답 모델·타입 재생성으로 보완한다. 기존 기록 route는 범위 밖으로 보존한다.
- 설치 offline cache 부족·초기 lint/format·기계적 patch 오류는 성공으로 바꾸지 않는다. 원본 결과와 후속 보완 결과를 구분한다. 제품 테스트의 실패와 도구/환경 실패도 구분한다.

최종 기준선/경쟁48건·전체369 API(107.87초), frontend558·공개8·타입/Biome/Ruff/format/mypy/build를 통과했다. 별도 실제 native 복구의 aggregate도 baseline_history_and_owner_restored·owned_servers_stopped=true이며 운영 restore 승인=false/기존 replay 위험 관찰=true다. 보완 과정의 test 함수 배치 오류는1실패/368통과였으며 원본을 보존하고 수정 후 다시 전체를 검증했다. [artifacts.json](artifacts.json)은 실제 소스18개/출력36개를 SHA로 연결한다. 수집기 재실행2회는 원본 동일성을 검사하고 덮어쓰지 않았다.

독립 리뷰는 **읽기 전용 소스 검토**이며 테스트 실행0이다. OpenAPI P2/실제 timeout 증거 공백 보완 후 미해결 scoped P1/P2 없음. 작성자도 owner/CSRF·대기 재확인·교체 불변성/rollback·DB 제약·native restore·OpenAPI/생성 타입을 재검토했다. 최신 main 통합과 원격 PR 게이트는 아직 진행 중이다. 체크 없음은 CI 통과로 표시하지 않는다.

## 남은 일

실제 3초 보정/지표·classifier·public producer, 두 아바타/단계2 이월, 1분 요약 업로드·대시보드/알림·PDF/LLM/변화 탐지, 실제 참여자/노트북 실측·SDK 개인정보 P2·공급자/운영/라이선스/법무·전체1–6 완료 기준은 그대로 남아 있다. 이번 원본/이력 보존은 새로운 보관 정책이나 공개 출시 승인이 아니다.

[Story](../../stories/account-baselines-api.md) · [재현 가능한 실제 결과 수집기](collect-proof.mjs)
