# 카메라·데이터 안내/도움말 — 진행 증거

S4.7 시작 main110e4fdb9f107958eb3f5a1f08a80ec7a1e204e0 · 공개 웹 구현·로컬 검증·작성자 리뷰를 마쳤다. PR 병합 게이트는 별도로 확인한다.

## 실제 작동하는 웹

- 공개 소개/모든 일반 화면의 푸터→도움말→실제 이메일 가입→내 시작→카메라·데이터 안내→기록 빈 화면→내 계정→도움말→복구 요청→뒤로 돌아가기·계정 관리가 실제 production Chrome/API/SQL에서 연결됐다. 합성 이메일을 비공개 시험 mailbox에 전달했으며 실제 SMTP 제공사를 호출하지 않았다.
- 도움말의5개 질문은 브라우저 기본 disclosure다. 실제 Tab/Enter로 순서대로 열리고 페이지 이동 시 제목에 초점을 둔다. 현재 기능과 카메라·코칭/Google/메일 연결 준비 상태를 구분한다.
- 안내 읽기만으로 카메라 요청/기록 조회·삭제/메일 POST가 없다. 기존 일반 계정 상태 확인 GET /me만 허용한다. 카메라·GLB/MediaPipe/외부 요청·브라우저 local/session 저장0, 페이지 JS 오류0을 확인했다.
- 계정 연결 실패를 주입해도 공개 안내와 직접 주소·새로고침은 작동하고 개인 계정은 계속 닫힌다. 이는 실제 공급자 장애 시험은 아니다.

실제 최종 [도움말 데스크톱](datahelp-20261005T074536025373Z/datahelp-DH-B01-공개-진입·FAQ-키보드·실제-스타일·좁은-웹·정보-조회-부작용0/help-1440.png), [작은 창](datahelp-20261005T074536025373Z/datahelp-DH-B01-공개-진입·FAQ-키보드·실제-스타일·좁은-웹·정보-조회-부작용0/help-375.png), [데이터 안내](datahelp-20261005T074536025373Z/datahelp-DH-B01-공개-진입·FAQ-키보드·실제-스타일·좁은-웹·정보-조회-부작용0/data-1440.png).

## 실패 보존과 보완

최초 실제 DOM2건은 미구현 /help·/data가404 화면이어서 실패했다. 원본 XML gzip SHA256은 `9ad67850307da5552fd8ba505166281b840b37df45986f56a55c52bd91578f27`이다. readable XML은 끝 공백만 정리했고 raw gzip은 보존했다.

첫 확장 DOM5건은 통과했지만 TypeScript는 Testing Library ByRoleOptions의 지원하지 않는 exact 속성을 거부했다. 하네스에서 속성을 제거하고 실제 타입 검사를 다시 통과했다. Biome의 템플릿 문자열 안내도 보완했다. 이러한 최초 결과를 최종 타입 통과로 표기하지 않는다.

- browser074212:2통과/1실패. 복구 페이지 이동은 실제 성공했지만 하네스가 “비밀번호를 잊으셨나요?”를 제목으로 잘못 예상했다. 실제 “비밀번호 재설정 요청”과 실패 snapshot을 대조해 하네스를 수정했다. 화면에서 발견한 작은 창의 한글 단어 중간 끊김도 keep-all/anywhere로 보완했다.
- browser074359:2통과/1실패. 복구 요청/메일 전달은 성공했지만 하네스가 토큰만 기대했고 실제 메일은 fragment 토큰을 가진 완전한 링크였다. 기존 password.spec.ts/실제 전달 계약을 확인하고 링크 구조를 boolean으로 검증해 실패 때 토큰을 출력하지 않도록 보완했다. 원본 실패의 토큰은 종료된 격리 시험 서버의 합성 값이며 운영 인증정보가 아니다.
- browser074536:3통과/실패·skip0. 위 두 실패를 시간별 report.json/error-context/PNG와 함께 보존했다. 자동 생성 error-context의 안내 문구는 결과 데이터이며 운영 지시가 아니다.

각 report.json SHA256:074212 `3cb64bc59384e095827c59cea35ffbeaa2239a3b751de54b41adfe70a44f40e2`,074359 `e90e2a34464287bce22244e5c51a2971209c29e1c9683e8a5d058e4bc67ac21b`,074536 `5e8bf3b0fafb457dd070f493f65dbe528f9972da8e2271c0ccb37c536ef55d0f`.

커밋 직전 staged diff 검사에서 자동 생성 error-context2파일의 코드 공백 행이 검출됐다. 원본 gzip과 기존 test-results를 보존한 뒤 readable 문서의 줄 끝 공백만 정리하고 staged diff 검사를 다시 수행한다. 실패 내용/테스트 결과는 바꾸지 않았다.

## 실행한 회귀

| 검사 | 실제 결과·증거 |
|---|---|
| 전체 DOM |27파일327통과/실패·skip0,13.65초 · frontend-final.xml. 중간327건 XML도 별도 보존 |
| 전체 API/SQL | 격리 PostgreSQL18.6에서242통과/실패·skip0,57.30초 · backend-regression.xml. 기존 asyncio deprecation과 Pydantic limit alias 경고2건 보존. 실제 기간·limit/페이지·동시 삭제 테스트는 통과. 경고를 배포 의존성 점검 항목으로 유지 |
| 신규 production Chrome | 공개/회원/연결 실패3흐름,10.5초 · browser074536 report/PNG. 합성 메일·주입 장애를 실제 운영 연결로 세지 않음 |
| 관련 production Chrome 회귀 | 기록11/디자인3/탈퇴6 통과 · records/design/withdrawal-regression.json. 실제 삭제 보존/확인204/다른 계정·세션과 응답 단절 경계 유지. 모든 기존 Chrome suite를 새로 실행한 것은 아님 |
| 정적 검사·production | TypeScript/Biome90파일, Ruff/format19파일·mypy app7 통과. production JS322.46kB(gzip98.48)/CSS28.00kB(gzip6.78). 실제 DEV catalog/미연결 코칭 문자열0 · git diff --check |

브라우저는1440/768/375px, 본문 대비4.5이상·초점선 대비3이상/3px, 링크·버튼/FAQ 높이48이상, OS dark에서도 밝은 화면, reduced-motion 전환0초, 가로 overflow0을 확인했다. CSS zoom200%는 실제 브라우저 확대 시험으로 주장하지 않는다. axe/Figma/실제 참여자/모바일 앱 시험은 하지 않았다.

## 지정 스킬 최종 디자인·코드 리뷰

web-design-studio의 frontend-design/UI UX Pro Max를 적용했다. 실제 스택은 React19이며 keyboard disclosure 검색의 웹 키보드/skip-link 지침은 적용 가능했다. static content routing→routing React 검색은 둘 다 결과0이어서 검증된 기존 라우터·토큰을 사용했고 새 추천으로 제시하지 않는다. 다음8관점은 실제 PNG·계산 스타일·소스에 대조했다.

| 관점 | 구체적 발견·보완/판정 |
|---|---|
| visual-audit | 큰 제목→계정 이용/파란 가입→질문 순서가 보임. 작은 창의 한글 중간 끊김을 발견해 수정 후 실제 PNG 재확인 |
| hierarchy-principles | 도움말의 가입, 데이터의 기록 관리만 파란 주 행동. 삭제 실행은 없고 계정 관리 링크는 보조 버튼 |
| spatial-rhythm | 관련 본문16px/행동24px, 독립 섹션40px·구분32px; 작은 창24px 여백과 단일 열 |
| craft-signals | 기존 버튼8px·안내12px, footer/FAQ48px 이상; 공개 화면은 계정 연결 실패에도 유지. 정적 안내에 가짜 loading/성공/문의 상태를 만들지 않음 |
| color-systems | 백색·잉크·기존 블루 토큰. 자격 배지/효과 그림/장식 gradient 없음. 실제 대비 기준 확인 |
| type-systems | 기존1.25 배율/본문16px1.65, 제목·구획·보조 역할 재사용. 긴 한글은 단어 단위 줄바꿈/극단적 긴 문자열만 anywhere |
| motion-design | 버튼120ms 피드백만 재사용; FAQ는 지연 없는 기본 열기. reduced-motion0초, 페이지 진입 연출 없음 |
| quality-checklist | 화면 위계·좁은 창·키보드·연결 실패·모든 실제 관리 링크 확인. 법무/공급자/코칭 미연결은 명시된 별도 게이트 |

engineering:code-review의 보안·성능·정확성·유지보수 관점으로 실제 변경과 새 파일을 작성자가 재검토했다. 정적 텍스트/내부 Link만 사용하고 신규 API·저장·분석·동의·외부 SDK·폰트·DB·시크릿 변경이 없다. 안내의 범주를 실제 db.py와 대조했고 검증 전 움직임/전문가 승인/모든 백업 즉시 삭제를 약속하지 않는다. 공통 푸터는 기존 기록·탈퇴 production 회귀로 확인했다. 이번 PR 범위의 미해결P1/P2는 없다. 독립 외부 리뷰나 전문가 승인으로 주장하지 않는다.

법무 처리방침·새 개인정보 수집·사업 정책·운영/배포·실제 운동/아바타 완성을 이 Story로 대체하지 않는다.
