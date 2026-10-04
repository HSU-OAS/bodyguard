# S2.5a 하네스 계약

2026-10-04 · 구현 전 계약 작성 후 실제 실행 · [Story](stage2-motion-selection.md)와 FR-S-01/06·FR-U-04·FR-V-02/03·NFR-08 대응.

| 기준 | 재현/검사 | 통과 기준 |
|---|---|---|
| C-01 | App의 /me pending/401/503/ready·refresh·이탈 mock | ready 전 후보 DOM0, 오류 재시도/기존 보호 상태 유지 |
| C-02 | 순수 TS 검색/부위/공백/없음·성분 테스트, React 검색·초기화 | 결과/count 정확, 실제 empty와 복구 |
| C-03 | 상세 UI / 불변 데이터·출처 검사 | 올바른 과정/주의점/촬영 범위, 각도·시간·효과 없음 |
| C-04 | direct ID/잘못된 ID·query·뒤로/목록·키보드 | 없는 동작 복구, 내부 검색/선택만 허용 |
| C-05 | DOM·getUserMedia spy·네트워크 기록·local/sessionStorage | camera0, model/WASM/3D0, 신규 API/기록/스토리지0 |
| C-06 | production build/preview·출력 JS 탐색 | dev route404·링크0·후보 title/ID 문자열0 |
| C-07 | 설치된 Chrome, 1440×1000/700×800, 실제 screenshot·view_image | 페이지 오류0·가로 overflow0·초점 정상, 실제 열람 |
| C-08 | 결과 문서·PR 검토 | mock/실제/미실행 분리, 선행 gate 미완료 유지 |

순수 데이터와 React 하네스를 구현 전에 준비해 최초 미구현 실패를 확인한 뒤 구현한다.
Chrome 계정 응답은 테스트에서만 가로채며 앱/production에 테스트 세션 endpoint/전역 우회0.
브라우저 네트워크는 localhost 외부 요청을 거부하고 camera 메서드는 테스트 spy로 실패시킨다.
별도 proxy를 사용해 외부 egress를 닫는다. 소스 링크는 URL/label만 검증하며 외부에 접속시키지 않는다.
현재 승인되지 않은 실제 사람·웹캠/원시좌표 저장·외부 계정·시크릿·운영 DB·배포는 실행하지 않는다.

## 재실행 가능한 로컬 검사와 결과

frontend에서 `pnpm test && pnpm check && pnpm typecheck && pnpm test:selection` 실행: 138개/15파일·Biome60파일·tsc·build·production 출력 검사·Chrome5개 통과.
신규9개 순수·9개 React 검사는 합성 데이터이고 Chrome은 설치된 실제 브라우저에 계정 응답을 mock한다.
localhost dev/preview를 하네스가 소유하며 외부 egress를 닫고 종료 시 proxy와 서버를 정리한다.
기존 로그인 화면의 Google 상태 요청만 게스트 redirect 경우 허용한다. 그 외 신규 API·모델/WASM/GLB·카메라·저장0.
cached 복귀 제목 문제를 실패로 재현한 뒤 child 제목/초점 소유권을 보완하고 React/실제 Chrome에서 재검사했다.
실제 PNG6개 직접 열람·이전 증거 보존. [실행/실패/미실행 기록](../review/motion-selection/README.md)을 따른다.
본 하네스의 통과가 실제 로그인·사람 수행·아바타·세밀한 코칭·전체 S2.5를 통과시키지 않는다.
