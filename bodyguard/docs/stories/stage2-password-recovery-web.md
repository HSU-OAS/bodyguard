# S2.6a2 — 비밀번호 복구 웹

2026-10-01 · 로컬 구현·필수 검증·자체 코드 리뷰 통과, PR 게이트 검토 중 · main `c39f317`·S2.6a1 PR #10 병합. FR-U-03·NFR-08, [API 계약](stage2-password-recovery-api.md)을 따른다. 외부 연결/실제 수행 대기 중 가능한 독립 Story다.

## 범위·화면 계약

로그인 → 비밀번호 재설정 요청(email) → 일반 요청 접수 안내 → 이메일 fragment 링크 → 새 비밀번호/확인 → 변경 확인 → 일반 로그인. 기존 계정 CSS·API 요청/CSRF·AuthProvider·접근성/오류 처리를 재사용한다. 202를 배달 성공으로 표현하지 않고 잘못된 링크는 다시 요청할 입구를 제공한다.

토큰은 reset 화면 초기 메모리에만 받고 라우터 replace로 hash/query를 제거한다. StrictMode에서도 삭제 때문에 토큰을 잃지 않는다. localStorage/sessionStorage·DOM 데이터 속성·로그에 넣지 않는다. 성공/이탈 시 입력·토큰을 더 사용하지 않고 요청을 취소한다. no-referrer를 문서에 적용하고 API에 URL/query로 토큰을 보내지 않는다. 이메일 링크를 열었다는 이유로 토큰을 소비하거나 자동 로그인하지 않는다.

복구 성공 때 /me의 권한이 아니라 로컬 정지 상태를 사용해 개인정보 UI를 열지 않는다. AuthProvider의 기존 operation/abort·계정 변경 broadcast를 연결하고 실패/불확실 응답에서는 개인 화면을 차단한다. 늦은 요청이 이전 화면/세션을 부활시키면 미통과다.

## 하네스·완료 기준

| ID | 실제/모의 검사·기준 |
|---|---|
| PW-01 | 로그인 입구·기존/없는 이메일의 같은 접수 안내·연결 실패/제한·중복 클릭·카메라/GLB/WASM 0 |
| PW-02 | 실제 API/SQL의 메일 fixture 링크를 Chrome에서 열어 URL 지움·미소비·정상 비밀번호 변경·이전 비밀번호 거부·새 비밀번호 로그인·자동 인증 없음 |
| PW-03 | 없는/위조/이미 사용/교체 링크, 확인 불일치, 실패/재시도/이탈·늦은 응답. StrictMode와 타이밍 mock은 단위 검사로 따로 표시 |
| PW-04 | 다른 탭의 옛 세션 차단, 키보드·레이블·오류/완료 초점, 데스크톱 넓은/좁은 창의 실제 화면 |
| PW-05 | 기존 API/SQL90·계정 Chrome9·시험 카메라1·Vitest/TypeScript/Biome/build·diff/문서 링크, production 우회/비밀값 저장 없음 |

실제 서버와 격리 PostgreSQL·production Chrome을 사용하되 메일만 private 시험 파일로 전달한다. 비동기 전달로 읽기/쓰기가 겹칠 수 있으므로 하네스 시험 파일은 잠금·원자적 교체로 갱신한다. 공개 mailbox API나 production stub은 추가하지 않는다. 실제 Gmail/Google·사람 자세·HTTPS 배포·출시는 별도 승인/검증이다.

## 결과

API PR #10은 merge commit `c39f31784e718ab35d5ee543b4a8babdb5ad9b81`, Story HEAD `5abba6667c3e3864a10991ad851b19cdbd62a919`, main 동일 내용·브랜치 유지 확인. 이 최신 main에서 새 codex/stage2-password-recovery-web 작업트리를 만들었다. GitHub 체크 없음, API 필수 검증 통과·미해결 P1/P2 없음, 원격/로컬 diff 내용·행 위치 일치 후 병합했다.

- 최초 TypeScript 검사에서 테스트의 Testing Library 옵션을 Playwright 옵션처럼 작성한 오류로 build/브라우저가 미실행이었다. 지원하는 옵션으로 바로잡았다. 이를 브라우저 통과로 세지 않는다.
- 실제 복구 Chrome 최초 실행은 3통과/1실패였다. 만료/소비 링크 뒤 새 fragment 링크가 reload 없이 같은 화면을 재사용해 초기 token state가 바뀌지 않았다. 새 fragment 수신에서 취소·토큰/입력/완료/제한 초기화와 replace를 함께 처리했다. 단위 StrictMode·늦은 완료·교체 링크와 실제 동일 페이지 링크로 재검증했다.
- 본문 이동 anchor도 fragment를 바꿀 수 있어 native button으로 초점만 옮긴다. 실제 키보드 Enter·main 초점·URL 불변을 검사했다. 토큰이 없는 초기/새로고침 화면은 안전하게 다시 요청하는 안내다.
- 리뷰의 실제 Unicode 경계 시험은 4통과/1실패: 서버가 허용하는 128자 보조 평면 문자를 기존 로그인 입력이 UTF-16 maxlength=128로 절반 잘랐다. 가입/로그인/복구 모두 기존 API의 code-point 15~128자를 한 함수로 검사하고 HTML의 물리 입력 상한만 256 units로 맞췄다. 짧은/상한 초과 문자는 제출하지 않고 초점을 준다. 비밀번호 정규화·잘라 전송은 하지 않는다. 실제 128문자 로그인→복구→새 비밀번호 로그인까지 다시 통과했다. 새 정책이나 서버 migration은 추가하지 않았다.

| 검증 | 실제 실행 결과 |
|---|---|
| Vitest | 12파일·105개 통과. 짧은/상한 초과 Unicode·입력 검사를 포함하며 상태 경쟁/프로토콜 오류/StrictMode는 모의 응답이다. 실제 자세 판정 증거가 아니다 |
| 복구 Chrome | `python -m tests.run_browser password` 5개 통과(13.9초). 실제 HTTP·격리 PG·production Chrome·메일만 private fixture. 202 접수·실제 429·기존 세션/비밀번호 거부·다른 탭·최신/소비/위조 링크·URL/Referrer/storage·128자 Unicode·정상 재로그인 |
| API 회귀 | 격리 FastAPI/PG pytest 90개 통과(21.44초). API 제품 코드는 이 Story에서 바꾸지 않음. 시간/메일 제어 시험과 실제 HTTP ack 검사를 API 명세에서 구분 |
| 개발 카메라 | 실제 Chrome/사람 없는 시험 장치 1개 통과(8.4초). 시작·중지·재시작·SPA 이탈/track 정리만 검사; 사람의 정확도 시험 아님 |
| 계정 Chrome 회귀 | 최종 Unicode 보완 버전으로 9개 통과(1.2분). 실제 60초 재발송·구코드 거부·429·계정/세션·탭/쿠키·오류/키보드. 메일만 모의이며 실제 Gmail 아님 |
| 정적/빌드 | TypeScript·Biome 49파일·production build 통과. Ruff 14파일·format 14파일·mypy 5파일 통과 |
| 화면 | 실제 Chrome 1440×1000·700×800의 요청 접수/입력/확인 불일치/완료/무효 링크 5컷을 직접 검수. 가로 넘침·키보드·레이블·완료/오류 초점 확인 |

변경 Markdown 5파일의 로컬 링크 28개와 git diff --check를 통과했다. engineering:code-review로 보안·입력·경쟁·접근성·production 경계와 위 결함의 재검증을 확인했다. 이 Story의 미해결 P1/P2는 없다. frontend-design의 기존 계정 화면 체계를 재사용해 새 CSS·의존성·3D·카메라를 추가하지 않았다. 원격 diff/HEAD/CLEAN/충돌/체크는 병합 직전 다시 검토한다.

S2.4 Draft #9의 P2와 실제 Gmail·Google·사람 수행/S2.3b·S2.7·2단계 완료를 이 Story로 대신하지 않는다. 실제 Gmail 복구 발송은 별도 연결 승인 범위를 요청하기 전 실행하지 않는다. 다음 미완료 독립 작업은 S2.4 외형/웹 변형 보완과 S2.6b이며 실제 수행·공급자 연결을 기다리는 동안 계속 진행한다.
