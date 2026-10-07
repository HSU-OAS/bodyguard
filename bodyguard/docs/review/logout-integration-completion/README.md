# 로그아웃 통합 시험 완료 경계

[Story](../../stories/logout-integration-completion.md) · [실제 집계·원본 SHA](summary.json)

최신 main885392c에서 분리한 시험 전용 보완이다. 제품 인증/화면/DB/정책은 바꾸지 않았다. 기존 통합 시험은 Enter 직후 서버 폐기 확인 없이 문서를 이동했다. 알림 작업트리의 첫 실행은1통과/1실패였다. 동일 제품의 추가 관측은2통과였지만 이동 직전204 관측은0이었다. 이 재실행을 최초 실패 해결이나 요청 취소 원인의 확정으로 표시하지 않는다.

보완은 Enter 전부터 실제 POST `/auth/logout` 응답을5000ms로 기다리고,204와 기존 게스트 화면을 확인한 뒤 `/records`로 이동한다. 새 문서의 로그인 화면과 실제 `/me`401을 확인했다. timeout 증가·sleep·자동 재시도·인증 우회는 없다.

최종 실제 Chrome/HTTP/전용 PostgreSQL 통합2·frontend693·기존 선택/공개 Chrome8·타입/Biome/build/production guard가 통과했다. 원본 XML/Chrome report/실패 로그는 소유한 로컬 시험 경로에 보존하며 summary의 SHA로 연결한다. 메일과 기록 입력만 합성이며 실제 SMTP·Google·촬영·운동·출시 검증이 아니다.

고정 진단값은 `movedBeforeConfirmation:false`,204 관측1,requestfailed1,CSRF 실패0이다. requestfailed1을 삭제하거나0으로 바꾸지 않았다.204/게스트/401을 통과한 뒤에도 수명 이탈 시 요청 이벤트가 실패로 관측될 수 있음을 남기며, 임의 이탈에서 서버 폐기를 보장하는 보안 수정으로 주장하지 않는다. 제품 정책을 바꾸는 문제라면 별도 Story·안전 경계 검토가 필요하다.

작성자 리뷰: 보안(이메일/쿠키/CSRF/본문 수집0),성능(고정 카운트·동기 sleep0),정확성(실제 응답과 UI 상태를 완료 경계로 사용),유지보수(기존 통합 시험 한 구간만 변경)를 확인했다. 이 시험 보완 범위의 미해결 P1/P2는 없으며 독립 에이전트 리뷰는 실행하지 않았다. 전체 시작 성능·SDK privacy·아바타/실측·디자인 구조/적용·운영·1~6단계 게이트는 해결되지 않았다.

Git 조건부 게이트는 최신 main/diff/exact HEAD/CLEAN/체크를 별도로 확인한다. 원격 병합 결과는 PR의 merge commit과 후속 진행 기록으로 확인하며 미래 병합을 완료로 기록하지 않는다.
