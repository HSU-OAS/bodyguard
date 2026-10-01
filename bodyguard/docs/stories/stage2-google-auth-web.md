# S2.6b2 — 구글 로그인 웹·브라우저 하네스

2026-10-01 · **PR #13 merge commit 병합** `4bbb78416090bfd5a6b922e518fa74d680e479ab`(부모/트리·원격 브랜치 유지 확인) · 기준 main `d5cade78668105e3d9faf96b32f03490f9ce67ea`. [운영 규칙](../operating-rules.md)과 FR-U-01~04·NFR-08을 따른다. 2단계 전체·실제 공급자·사람·최종 아바타는 미완료다.

## 범위·화면 계약

로그인·이메일 가입 시작에서 `Google로 계속하기`와 기존 이메일 방식을 함께 제공한다. 이메일 인증 2단계에서는 구글 진입을 숨겨 미완료 가입을 다른 인증과 섞지 않는다. 기존 near-white/녹색/시스템 한글 폰트·48px 버튼·10px radius·초점 스타일을 재사용한다. 별도 디자인/아이콘 라이브러리·Google 사진/이름/SDK script를 추가하지 않는다. 웹/노트북과 좁은 데스크톱 창을 확인하되 모바일 앱/브라우저는 개발하지 않는다.

서비스 설정 상태를 typed `/auth/google/status`로 확인한다. 확인 중·미설정·네트워크/형식 오류는 구글 버튼을 비활성화하되 이메일 기능은 유지한다. 오류에는 구글 연결 재확인을 제공한다. 늦은 status 응답은 이탈한 화면을 부활시키지 않는다. 자격증명 입력·가입 요청·인증 중 구글로 이중 시작하지 않는다.

구글 버튼은 고정 same-origin `/api/v1/auth/google/login`으로 **브라우저의 정상 top-level 이동**을 한다. fetch로 외부 token/Google URL을 받거나 팝업·local/sessionStorage에 OAuth 상태를 보관하지 않는다. 현재 보호된 목적지 `/start`로만 복귀한다. 로그인 성공 여부는 `/me`가 결정하며 query만으로 성공 처리하지 않는다. 취소·실패·이메일 충돌·미설정·요청 제한·서버 연결 실패는 고정 enum의 한국어 복구 안내를 보여 준다. provider 원문 code/state/error/token이나 외부 next를 출력하지 않는다.

네이티브 이동의 시작 오류에서 JSON 오류 페이지에 사용자를 남겨 두지 않도록 **text/html 탐색 요청에만** 실패를 고정 로그인 enum으로 303 돌린다. 기존 API 클라이언트의 JSON 503/429 계약·실제 제한·인증 검사는 유지한다. 서버/DB 실패도 계정 생성이나 게스트 권한 폴백 없이 로그인 재시도로 끝난다. 바뀐 API의 타입은 native 생성기로 다시 검사한다.

## 실행형 하네스·수용 기준

| ID | 검사 | 통과 기준 |
|---|---|---|
| GW-01 | 미설정/상태 조회 실패·형식/지연 | 구글 시작 불가·이메일 유지·명시 재시도·이탈 후 응답 무효. 카메라 호출0 |
| GW-02 | 실제 로컬 로그인/가입·쿠키/복귀 | Chrome → FastAPI → 실제 PG/RSA/SDK → 두 방식의 /start. 외부 next 무시·HttpOnly 쿠키·local/sessionStorage0·/me 권한 확인 |
| GW-03 | 취소·재시작·잘못된 토큰·재생 | 취소/검증 실패는 한국어 안내·개인 화면 차단, 새 정상 시도로만 성공 |
| GW-04 | 기존 이메일 계정 충돌 | 자동 합치기/비밀번호 변경0, 기존 이메일 로그인·Google-only 복구 구분 유지 |
| GW-05 | native 탐색·quota/서버 오류 | 같은 시작 한도·JSON API 상태 보존, HTML은 안전한 로그인 복귀·실패 우회0 |
| GW-06 | 접근성·렌더·회귀 | 키보드/레이블/disabled/초점, 1440px·700px 데스크톱, 실제 PNG 검사, 기존 account/password·105 TS·154 API 회귀 |

기존 test-only `run_browser`·RSA 공급자 fixture를 재사용한다. 실제 로컬 시작 응답을 `route.fetch({maxRedirects:0})`로 캡처해 고정 Google URL/PKCE/state/nonce를 검사한 뒤 모의 승인/취소로 **로컬 callback만** 반환한다. native 서버의 OIDC 서명·state/nonce/PKCE·DB 로직은 그대로 실행한다. test-process 전용 비공개 IPC 파일에서만 합성 응답/시험 clock을 전달하고 외부 API/production 우회는 없다. 브라우저는 **소유한 닫힌 포트 proxy**를 필수로 쓰고 localhost만 우회한다. 별도 GW-00 시험이 route 없이도 외부 주소를 `ERR_PROXY_CONNECTION_FAILED`로 거부해야 한다. 실제 Google HTTPS/계정/동의 화면 검증이 아니다. API/Chrome suite는 같은 소유 DB에서 순차 실행한다.

### 실패 실행·시험 경계 보완

최초 Chrome 실행은 9개 중 7개 실패·2개 통과였다. `route.continue()`의 로컬 303 다음 hop을 같은 handler가 가로챈다고 잘못 가정해 **합성 client ID/state를 담은 Google 로그인 진입 GET 7건이 실제 전송**됐다. 실제 계정/시크릿·원본 영상/신체 좌표를 사용하지 않았고 Google 로그인은 invalid client로 실패했지만, **허용하지 않은 외부 통신이 있었으므로 이 실행을 모의/실제 공급자 검증 완료로 인정하지 않는다.** 발견 즉시 사용자에게 보고했고 해당 시험/서버/임시 Chrome 문맥은 종료했다. 외부 동의/계정 생성·실제 로그인·운영 변경은 없다.

[Playwright 공식 route 계약](https://playwright.dev/docs/api/class-route#route-fetch)을 읽고 자동 redirect 0회 캡처로 원인을 수정했다. route가 다시 빗나가도 전송되지 않도록 native browser proxy를 소유한 **listen하지 않는** loopback socket에 연결한다. 다른 listener/사용자 서버를 재사용하지 않고 설정 없으면 suite 기동을 거부한다. 10개 재시험은 GW-00의 실제 차단과 로컬 로그인·암호검증/충돌/재생/취소를 통과했다(21.7s). 이후 변경의 최종 회귀는 별도 재실행 결과로 남긴다.

## 구현·최종 로컬 증거

- API HTML 시작 2개·새 UI 11개는 미구현 경로에서 먼저 실제 RED를 확인했다. TypeScript 초기 `exact` 옵션 오용·회귀 단언 오류는 테스트 자체를 바로잡았으며 실패를 통과로 기록하지 않았다.
- 기존 인증 provider와 SQL/API/HTTP harness를 재사용했다. 신규 runtime 의존성·마이그레이션·외부 SDK/폰트 요청·CI·실제 시크릿 변경0. 미설정 이메일 기능, strict boolean 상태·고정 오류 enum·이탈/뒤로가기 재확인·이중 클릭 억제, native HTML 복귀를 구현했다. API의 CSRF·quota·claim 검증을 약화하지 않았다.
- **API 160개 실제 통과(37.53s, skip0)**: 기존90+Google70, FastAPI/격리 PostgreSQL18.6/자체 RSA/native Authlib. HTML/JSON·quota·시작/콜백 DB 실패(토큰 교환 전후)를 확인했다. DB 실패는 주입한 예외이며 운영 장애 시험은 아니다. 공급자 HTTPS/시간/메일은 통제된 시험 응답이다.
- **Vitest 120개/13파일 실제 통과(2.75s)**, TypeScript·Biome51파일·Ruff16파일·mypy5파일·`git diff --check` 통과. 기준105개에서 새 Google UI14개·pageshow 권한 회귀1개가 늘었다. API 타입 생성기를 재실행했고 생성 차이0이었다.
- 최종 production build96modules·JS283.68kB/gzip89.28kB·CSS18.61kB/gzip5.06kB 통과. 계정 화면에 카메라/추정/3D/Google SDK를 자동 로드하지 않는다.
- 최종 **production Chrome Google10개 실제 통과(21.9s)**: GW-00은 route를 제거한 외부 주소의 실제 `ERR_PROXY_CONNECTION_FAILED`를 확인했다. GW-01~06은 실제 HTTP/SQL/RSA/SDK/브라우저·고정 복귀·쿠키/저장소·계정 충돌/재생/nonce/audience 실패·취소·quota·키보드를 검사했다. suite에서 외부 URL 요청·카메라 호출0, local/sessionStorage0. 모의 동의·HTTPS와 controlled server clock은 실제 Google/시간 경과 증거가 아니다.
- 동일 외부 차단 harness에서 기존 **account9개(1.2m) → password5개(11.4s)**를 DB 순차 실행해 통과했다. 개발 fake-camera 시작/중지/재시작1개(10.2s)도 통과했지만 실제 사람·관절·정확도 증거가 아니다.
- [Chrome 화면 증거](../review/google-auth-web/README.md) 4장을 원본 PNG로 보존하고 직접 검사했다. 1440px/700px 데스크톱·키보드 초점·취소/충돌 안내의 줄바꿈을 확인했다. 화면에는 합성 계정 데이터만 있고 웹캠/신체 영상은 없다.
- API에는 기존 asyncio deprecation1개, Chrome에는 NO_COLOR 경고, fake-camera에는 기존 Three/MediaPipe 및 API 미기동 proxy 경고가 있었다. 경고 없는 검증으로 표시하지 않는다. 직접 실행한 로컬 결과이며 GitHub 체크 완료가 아니다.

Story 범위의 미해결 P1/P2는 없었다. 네이티브 start/callback DB 오류는 공통 SQL 예외 경계에서 보완했고 최초 외부 요청 실패는 위에 공개 기록했다. exact HEAD `201f4abc99781425f5b107f5836d4e6d86404ec2`·최신 diff24파일/805+23−·main·CLEAN/MERGEABLE·브랜치 자동 삭제 false를 확인해 PR #13을 조건부 merge commit으로 병합했다. GitHub checks/reviews는0(**체크 없음**), 로컬 시험을 GitHub 통과로 표시하지 않았다. 실제 공급자·사람·최종 아바타 미완료를 이 로컬 Story의 성공으로 덮지 않는다.

## 제외·다음 게이트

실제 Google 프로젝트/계정 연결·동의 화면·시크릿 주입·외부 로그인은 CEO 별도 승인 후 진행한다. Gmail·사람 S2.3b·최종 아바타/시범·코칭·S2.7·운영 DB migration·배포·출시는 이 Story 완료로 표시하지 않는다. b2 로컬 검증 뒤에도 S2.6 실제 공급자 게이트는 남는다. Draft PR #9의 외형 P2는 별도 보완한다.
