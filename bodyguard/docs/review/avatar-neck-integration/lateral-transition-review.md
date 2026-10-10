# S2.A1 연속 전이·원래 core 진단 — 작성자 리뷰

2026-10-10 · engineering:code-review · **Request Changes: 기존 외형 P2 미해결**

이번 변경은 같은 전문 원본 위치의 연속 전이·실패/원래 면 진단·영구 결과/소스 보존이다. 공개 웹/API/SDK/판정/개인정보·운영은 변경하지 않는다. 새 모델 저장0이며 원래 원본/부분 후보/이전 실패를 보존했다.

## 실제 결과와 검토

- **정확성:** 기존 falloff를 원래 source ID 좌표의 전이에 적용했고 world/rest/pose/group/raw skin/topology/PBR/history/손·외부 좌표 exact를 확인했다. 남성 접힘3개가 남아 native exit1로 저장 전 중단했다. 여성 제작·새 원본/외형/GLB/전체변형/Chrome·실측은 미실행이다.
- **원인 분리:** read-only private BMesh 진단exit0는 동결 rows·여성·private probe·두 입력 불변을 확인했다. 남은 세 edge는 이전 작은 삼각면 주변의 부분 전이이며 원래 core27점은 선택 안/앞면 보호 밖/기존 ID다. 감쇠 수치의 반복 조정이나 보호 범위 확장은 하지 않았다.
- **초기 오류:** QA 실패 뒤 잘못 이어진 runner가 proof ENOENT에서 종료했다. Native는 실행되지 않았고 exit=null이다. 초기 source/관찰은 별도 보존, 새 이름의 runner는 실제 QA 통과 후 실행했다. 초기 반려 runner는 동결 negative source로 남기며 active QA 통과 source로 표시하지 않는다.
- **보안/보존:** fixed output·두 입력 SHA·factory startup/disable autoexec·wx 기록, professional asset만 처리한다. 비용/계정/시크릿·사람 데이터 업로드/촬영·원본 덮어쓰기는 없다. 실제 terminal signal/spawn error와 진짜 native0/1을 구분한다.
- **성능/유지보수:** 제작 snapshot/provenance·native 원본 대조는 offline 작업이며 실시간 웹 성능 증거가 아니다. 실패한 파일을 성공 소스로 고쳐 쓰지 않고 새 source와 연결된 실제 raw/압축 증거를 보존했다.

동일5.1.1 공식 source는 도구의 binary anchor/least-squares 특성을 확인하는 근거일 뿐, 새 모델의 변형/외형 합격이 아니다. 설치 API의 비인체 probe는 실제 exit0이며 양수 그룹 값1/0.25의 결과가 같고 고정점 오차가 남음을 확인했다. 첫 sandbox 초기화 SIGSEGV/native null도 별도 보존했다. professional 아바타 저작·렌더·GLB·브라우저 검증은 이 probe에서 실행하지 않았다.

## 최신 CEO 결정과 미실행 범위

새 제한 변형 저작은 자동 승인 검토에서 프로세스 생성 전에 두 번 차단됐다. 같은 질문의 두 CEO 답변 중 마지막 **“아바타는 보류하고 독립 웹 작업 진행”**이 적용되므로 먼저 도착한 승인으로 재실행하지 않는다. 준비한 helper/runner는 미실행 제안이고 정적 검사는 native 실행 증거가 아니다. 새 후보0·native exit=null·원본 불변이며 우회 실행이나 공개 제품 적용은 없다. 현재 실패와 증거 보존을 마친 뒤 독립 웹 Story를 진행한다. 해결 조건과 의존성은 기존 2단계 이월 목록을 유지한다.

작업 범위의 새 P1/P2 코드 문제는 발견하지 않았으나 전체 PR의 외형 P2는 미해결이다. Draft #108 병합/출시 후보판 선언은 하지 않는다. 작성자 검토이며 외부 리뷰/전문가 승인이 아니다.

## 인계 전 실제 정적·보존 검증

- Ruff check/format check: 새 Python4개 실제 exit0. Biome check: 활성 Node6개 실제 exit0, 변경 없이 확인했다. 초기 반려 runner는 동결 negative source로 제외했다.
- 전이 archive10개·이전 경계 archive7개와 진단11개·첫 probe5개·확인 probe5개의 manifest bytes/hash를 실제 확인했다. 재저작·native 재실행이 아니다.
- 관련 문서9개/로컬 링크321개를 확인했다. 보류 runner의 출력 폴더는 비어 있으며 최신 CEO 결정과 미실행 JSON이 일치한다.
- `git diff --check` 실제 exit0. 전체 웹/API·GLB·118 pose·실측·브라우저 검증은 이 인계에서 재실행하지 않았다.
