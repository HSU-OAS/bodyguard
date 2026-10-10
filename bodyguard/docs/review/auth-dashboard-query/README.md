# S4.20 로그인과 일·주 기록 조회 연결

2026-10-10 · [사전 계약](../../stories/auth-dashboard-query.md) · main d2501686(PR117 실제 병합) · codex/auth-dashboard-query.

실제 AuthProvider ready 수명에 readDashboard를 연결했다. 명시 read만 조회하며 ready 데이터는 같은 계정/요청/화면 수명에만 유효하다. refresh·logout 실패/non-ready·취소·pagehide·unmount는 abort와 함께 snapshot을 idle로 폐기한다. 더 늦은 성공/401이 최신 결과를 덮어쓰거나 새 계정을 재확인시키지 않는다. 현재401만 기존 refresh로 서버 권한을 확인하며 오류 재조회도 명시적이다. 새 기본 날짜/timezone·cache/저장·자동 retry는 없다.

## 실제 결과

- 처음 module 부재: collection1실패/실행0. 실행 전 red-source와 원본 log/JSON 보존.
- 실제 React/AuthProvider 단위13통과: StrictMode·guest/명시 조회·같은 계정 refresh·logout 실패/late 성공·신규 요청과 옛 성공/401·취소/pagehide/unmount·503재조회·현재401guest·계정 교체. reader/auth fetch는 mock·합성 DTO이며 실제 서버 시험과 구분한다.
- 실제 Chrome155/AuthProvider/loopback FastAPI/새 PostgreSQL18.6: native6통과/retry0. 명시 day/week→같은 계정 refresh 결과 제거→새 조회, 실제 logout 중 held200 취소, 제어503→명시 retry, 실제 계정 교체2분→1분, 실제 React root.unmount 후 retained control 차단, 서버 revocation401→provider guest를 확인했다.
- 전체frontend1568/실패·pending0, tsc/Biome311(info16)·runner Ruff/format1·production build/guard 통과. build는 native runner가 실제 pnpm build→private Vite→preview로 실행한 것이다. 전체backend 재시험이라고 하지 않는다.
- 첫 tsc는 시험의 week string literal 추론 오류였고 as const로 수정했다. 최초 오류 log를 보존했고 최종 전체/typecheck/native는 수정 뒤 입력으로 실행했다. 당시 native 파일 전체 snapshot은 없으므로 당시 전체 source 증거가 있다고 주장하지 않는다. unit RED 원본과 최종 source9는 별도 보존했다.

private compiled React probe는 변경하지 않은 /start 웹과 나란히 별도 root/실제 AuthProvider를 만들고 기존 session API를 읽는다. 공개 앱 전체에 새 dashboard를 연결한 것이 아니다. 조회 버튼/상태는 **개발 연결 검증 UI이며 확정 디자인이 아니다**. held 응답/503은 명시적으로 제어했고 계정/메일·저장 요약은 합성이다. 두 root가 있는 이 시험을 단일 공개 화면/전체 사용성 시험으로 세지 않는다. camera/external/pageerror 및 local/sessionStorage는 최종6 각각0이다. 실제 사람/메일 공급자·자세/효과·SDK/아바타·전문가·운영/배포 검증0이다.

## 입력·증거·소유 확인

`node bodyguard/docs/review/auth-dashboard-query/collect.mjs --check`는 manifest의 압축/원본 SHA·최종 source9+collector·불변 제품/시험/설정·public JS/CSS2 byte 동일을 확인한다. 재시험/전체 출시 인증이 아니다. source9는 최종 전체/native 실행 전 입력이며 collector는 실행 뒤 작성했다. 불변 파일은 main과 byte 대조했다. 기존 checkout/동일 lock 설치만 재사용했고 기존 PR117 source/merge tree 동일을 확인한 main-equivalent public-after를 before 기준으로 보존했다. 형 검사/브라우저·전체를 필요 없이 반복하지 않았다.

임시 DB /private/tmp/bodyguard-auth-test.y2lPOui2는 새 생성/UID501/data·socket0700/bodyguard_test 역할·DB/TCP비활성이다. 실제 SQL data_directory·live PID92799/UID501/명령·경로를 확인한 뒤 해당 DB만 정상 중단했고 status는 no server running(exit3)이다. data/실패를 보존했다. 메일/cookie/token IPC·운영 DB·영상/좌표를 archive에 넣지 않았다. ps 조회와 stop은 다른 기존 서버에 적용하지 않았다.

## 작성자 scoped 최종 리뷰

engineering:testing-strategy로 계정/최신 요청/폐기 경계에 집중하고 engineering:code-review로 코드·경합·증거를 검토했다. 작성자 리뷰이며 외부/다중 에이전트/전문가 리뷰0이다. 현재 scoped 미해결 P1/P2는 없다.

- commit된 auth를 layout effect에서 받아 폐기하고 render 이전 단계의 새로운 auth와 일치하지 않는 데이터는 즉시 idle로 가린다. getSnapshot도 mount/원래 계정/요청/취소를 매번 확인한다. 사용자가 이미 복사한 과거 DTO를 외부 메모리에서 마법처럼 삭제한다는 뜻은 아니다.
- 새 op를 먼저 설치한 뒤 옛 abort를 수행하여 늦은 catch/401이 새 조회를 건드리지 못한다. 새 read도 명시적이며 replacement/unmount와 snapshot 폐기는 실제 React/native·mock 무시 transport 시험으로 나눠 확인했다.
- server auth/API/schema/정책·공개 route/CSS/문구/DTO/lock/CI는 불변이다. backend runner는 새 private suite3등록뿐이며 공개 번들에는 새 hook/probe가 없다. 아바타 보류·기존 원본/실패를 유지한다.

Draft51/새 대시보드 UI·FR-R-03 전체/4단계/1~6·출시 후보판은 미완료다. 실제 코칭/동작0/실측·승인 UI/SDK·시작P2·권리/법무·외부/Docker/HTTPS·안전한backup/restore·Q13/27/32도 유지한다. 비용/계정/시크릿·운영 migration/배포/출시·중요 범위/안전/개인정보 변경은 별도 승인이다.
