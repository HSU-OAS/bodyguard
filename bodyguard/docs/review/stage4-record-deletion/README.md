# S4.4 수행 기록 삭제 — 실제 화면·검증 증거

최신 독립 [050606 실행](records-20261005T050606778320Z/report.json)은 실제11흐름 통과다. [미리보기 뒤 신규 저장 보존 화면](records-20261005T050606778320Z/records-RD-05-record-saved-93a64-en-with-an-earlier-end-time/deletion-new-record-preserved.png)에서 기존1건만 삭제되고 새 기록이 남는 것을 SQL 응답과 UI에서 확인했다. [700px 확인 화면](records-20261005T050606778320Z/records-RD-01-actual-previ-fd962-on-preserve-outside-records/deletion-preview-narrow.png)도 직접 검수했다.

최종 독립 [서버 XML](backend-isolated-20261005.xml)은205통과/실패0/skip0이며 기존 deprecation1개다. [전체 DOM JSON](frontend-confirmed-20261005.json)은265통과/실패0이며 명시된 모의 시험이다. [첫 독립 DOM](frontend-isolated-20261005.json)은257/8실패, [첫 격리 원본 서버 재실행](backend-final-20261005.xml)은198/6실패로 보존한다. [043849 Chrome](records-20261005T043849507838Z/report.json)은 동시 DB 초기화 영향으로11실패다. 새 작업트리·별도 소유 DB·migration/reset 전 독점 잠금으로 분리했고 실제 실패를 통과로 바꾸지 않았다. 로딩 실패 분리 [23건](frontend-loading-diagnostic-20261005.json), 보완 전 전체 [265건](frontend-final-isolated-20261005.json)도 각각의 결과다. 아래5개 이전 실행을 포함해 총7개 Chrome 폴더를 원본에서 복사해 보존한다.

고유 실행 폴더5개를 원래 test-results에서 복사해 보존했다. 실제 FastAPI·PostgreSQL18·production Chrome을 사용했고 사용자·기록·메일은 합성 fixture다. 서버 확인 만료는 사설 test IPC의 clock 이동으로 검증했으며 실제10분 대기나 운영 연결 완료를 뜻하지 않는다. 원본 영상·관절 좌표·아바타 파일은 생성하거나 변경하지 않았다.

최종 [043422 실행 보고서](records-20261005T043422869061Z/report.json)는 RD-01~04와 기존 RW-01~06의10건 통과다. 취소 후 기록 보존·명시 기간 삭제·다른 기간/계정 보존·대상 변경/만료 재확인·다른 계정/새 세션 서명 거부·로그아웃 후 늦은 삭제 응답 폐기를 확인했다. 카메라/모델/GLB 요청0, 외부 요청0, local/sessionStorage0을 각 시험에서 검사한다.

## 실제 미리보기

- [대상·기간·복구 불가와 취소/확인](records-20261005T043422869061Z/records-RD-01-actual-previ-fd962-on-preserve-outside-records/deletion-preview.png)
- [700px 좁은 노트북 레이아웃·키보드 포커스](records-20261005T043422869061Z/records-RD-01-actual-previ-fd962-on-preserve-outside-records/deletion-preview-narrow.png)
- [실제 삭제 수·갱신된 목록](records-20261005T043422869061Z/records-RD-01-actual-previ-fd962-on-preserve-outside-records/deletion-result.png)
- [대상 변경 재확인](records-20261005T043422869061Z/records-RD-02-changed-real-226c7--preserves-remaining-record/deletion-target-changed.png)
- [서버 확인 만료](records-20261005T043422869061Z/records-RD-03-server-confi-f6972--without-an-automatic-retry/deletion-expired.png)
- [로그아웃 뒤 닫힌 사적 화면](records-20261005T043422869061Z/records-RD-04-foreign-proo-f1966-on-cannot-reopen-private-UI/deletion-logout-boundary.png)

전체 화면과 좁은 확인·결과 이미지를 직접 읽어 줄바꿈·정렬·작업 구분을 검수했다. 사용자가 수행한 실제 운동·동작 정확성·의학 효과의 증거가 아니다. fixture 동작 식별자는 출시 동작명 연결 전의 저장 계약 확인용이다.

## 실패와 이전 실행 보존

[042523](records-20261005T042523041911Z/report.json)은7통과, [042809](records-20261005T042809581544Z/report.json)은8통과다. [042950](records-20261005T042950593908Z/report.json)은8통과/1실패로 시작 페이지 HTTP 탐색 실패·error-context·화면을 그대로 보존했다. 별도 빌드와 Chrome이 겹친 실행이며 같은 산출물 검사 중 다른 빌드를 실행하지 않는 순서로 보완했다. 단독 [043122](records-20261005T043122888269Z/report.json)은9통과다. 실패를 통과로 재표시하지 않는다.

DOM의 최초 삭제 진입점 미구현과 병렬 부하/포커스 보완은 [Story](../../stories/stage4-record-deletion-web.md)에 기록한다. 독립 UI 모의 시험과 실제 서버/브라우저 시험을 구분한다. 전체4단계·아바타·실측·운영·출시 게이트는 미완료다.
