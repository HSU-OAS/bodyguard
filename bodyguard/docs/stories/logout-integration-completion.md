# S6.6 로그아웃 통합 시험 완료 경계

## Status

ready-for-review

## Story

기존 가입→기록 관리→로그아웃 통합 시험은 실제 로그아웃 응답과 게스트 화면을 확인한 뒤 보호된 주소를 새 문서로 방문해야 한다. 키보드 입력을 서버의 세션 폐기 완료로 간주하지 않는다. 제품 코드·인증 정책·화면은 바꾸지 않는다.

## Acceptance Criteria

- L01 최신 main885392c의 기존 `integration.spec.ts`에서 로그아웃 직후 문서 이동 실패를 보존하고, 추가 관측은 고정 카운트/boolean만 남긴다. 이메일·쿠키·CSRF·본문·원시 오류는 수집하지 않는다.
- L02 Enter 전에 실제 POST `/api/v1/auth/logout`의204 관측을 준비하고,204와 기존 게스트 화면 확인 후 `/records`로 이동한다. 응답·화면 모두5000ms 기준, sleep/재시도/제품 우회는 없다. 새 문서도 게스트이며 실제 `/me`401이다.
- L03 실제 Chrome·HTTP·전용 PostgreSQL 통합 시험, 기존 공개8·frontend 전체·타입/정적/build/production guard를 통과한다. 메일/기록 입력은 합성이며 실제 공급자·촬영·운동 완료가 아니다.
- L04 한 PR에 시험 완료 경계와 증거만 담는다. 미해결 P1/P2·최신 diff/CLEAN/체크·exact HEAD merge commit을 확인한다. 제품 보안 수정이나 임의 이탈 때 서버 폐기 보장으로 주장하지 않는다.

## Tasks

- [x] 실패를 별도 목적/최신 main 작업트리로 분리
- [x] 최초 실패와 원본 순서 추가 관측(2통과)을 분리 보존
- [x] 최소 시험 보완·실제 통합 GREEN·회귀
- [x] 작성자 리뷰·로컬 증거
- [ ] 최신 원격 diff/CLEAN/체크·조건부 PR 병합 확인

## Dev Agent Record

알림 전달의 보충 통합 검증에서1통과/1실패를 실제 관측했다. 기존 시험은 Enter 직후 로그아웃 응답/게스트 상태를 기다리지 않고 문서를 이동한다. 아직 원인 확정이나 제품 수정으로 표시하지 않는다. 원본 실패와 알림 작업은 보존한다.

후속 관측은 원본 순서에서2통과였으나 이동 직전204 미확인으로 남았다.5000ms 실제 POST 응답/204·게스트 확인 후 이동하는 보완은 실제 통합2·frontend693/선택8·정적/build/guard 통과다. requestfailed1은 그대로 보존한다. [원본 SHA·관측 한계·작성자 리뷰](../review/logout-integration-completion/README.md). 네트워크 중단 원인 해결이나 제품 보안 수정·전체 단계 완료가 아니다.

## File List

- bodyguard/docs/stories/logout-integration-completion.md
- bodyguard/frontend/e2e/integration.spec.ts
- bodyguard/docs/review/logout-integration-completion/README.md
- bodyguard/docs/review/logout-integration-completion/summary.json
- bodyguard/docs/tasks.md

## Change Log

- 2026-10-07: 제품을 변경하지 않는 별도 완료 경계 검증 시작. 알림 PR은 이 회귀 게이트 통과까지 병합 보류.
