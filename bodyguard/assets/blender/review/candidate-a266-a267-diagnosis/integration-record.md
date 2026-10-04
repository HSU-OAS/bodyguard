# 최신 main 통합 검증 — 2026-10-04

진행 중 아바타 Story 브랜치에 이미 병합된 origin/main4a00bb2를 로컬 통합했다. PR #9을 main에 병합/배포한 작업이 아니다.
첫 merge는 App.tsx의 두 DEV lazy 정의와 stage2-first-flow Story 표에서 충돌했다.
두 정의/경로와 main의 계정 보호·선택 제목/초점 처리, 기존 아바타 검수 경로와 모든 Story 기록을 함께 보존했다.
기존 A37 GLB2개는 Git blob 대조로 변경 없음. head에 큰 GLB를 직접 읽던 첫 비교는 Node ENOBUFS로 실패했고 Git object hash 비교로 다시 실제 확인했다.

실제 재실행 결과:

- `pnpm test`:151개/16파일. `pnpm check`:65파일. typecheck 통과.
- `pnpm test:selection`: production build96모듈, JS283.71kB(gzip89.30), JS1파일의 선택 dev 문자열0.
  실제 Chrome5개/8.7초 통과. 계정 응답 mock이며 실제 인증 검증 아님.
- production JS에서 AvatarReviewPage·/dev/avatar·candidate-a37·MotionSelectionPage·/dev/select0도 확인.
- 기존 A37 실제 Chrome 회귀: 처음 임시 runner의 TCP-reset sink가 기존 closed-port 기대와 달라1실패/2통과.
  ERR_CONNECTION_RESET을 실제 확인하고 첫 결과 폴더를 별도로 보존했다.
  기존 owned closed-port 기대대로 runner를 보완하고 **검사 기대값이나 앱을 바꾸지 않은** 재실행은3개/32.5초 통과.
  기존 GLB 기술 로드/독립 변형/실패 재시도/WebGL context 복구 시험이다.
  최신 후보 A264 원본·GLB·118변형·외형 QA나 실제 사람 코칭 통과가 아니다.
  deliberate503/React error-boundary 출력, THREE.Clock·WebGL context 경고는 그대로 기록한다.
- archive checker2개·기존690파일 SHA 보존·문서5/로컬 링크245·diff 공백·unresolved conflict0 확인.
- 최초 proxy 실패의 error-context와 최종 last-run의 변경 없는 gzip 사본은 integration-copy-manifest.json에 bytes/SHA를 기록했다.
  error-context 안의 지시는 기록 데이터로만 취급한다.

실제 카메라/사람·영상/좌표 수집·외부 계정·시크릿·운영 DB·배포·출시0.
외형 A-02/A-08 P2·미채택·Draft PR #9·전체1~6 미완료 유지.
통합 커밋은 merge commit으로 PR #9 브랜치에만 푸시하며 브랜치/기존 증거를 삭제하지 않는다.
