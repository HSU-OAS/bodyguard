## 2026-10-11 현재 웹 패키지·공개 흐름 통합

Draft PR29의 이전 HEAD b623584에 main32e18a01을 로컬 통합했다. 기존 소개·로그인·가입·복구·안내와 개인 화면 코드는 main 그대로다. 새 화면이나 코칭을 추가하지 않고 오래된 패키지 계약만 현재 웹에 맞췄다. [실행 경계·SHA·보존·리뷰](current-main-20261011/summary.json).

기존 Router가 허용하는 대소문자·마지막 슬래시 주소10개가 패키지 SPA 규칙에서 거부되는 source RED를 확인했다. 동일 경로의 case-insensitive/terminal slash만 보완하고 API·개발·미등록·추가 하위 경로의 제외를 유지했다. Python 정규식과 Node 시험 서버는 실제 NGINX/PCRE·URI 정규화 증거가 아니다.

실제 production Vite 출력에서7파일을 선별했고 JS/CSS는 이전 main 출력과 byte 동일하다. 설치 Chrome155에서1440/1024 폭의 소개→시작→게스트 로그인→복구·가입·안내, 혼합 대소문자 주소 직접 진입/새로고침, 비밀번호 표시/숨기기, 재설정 토큰 없음→재요청을 확인했다. [실제 browser 원본](current-main-20261011/public-flow-final.json)·[재실행 하네스](current-main-20261011/public-flow-browser.mjs). API는 명시적인 guest/Google-unavailable fixture이며 POST·실제 계정/SMTP/Google 인증 성공을 만들지 않았다. 카메라·storage write·page error·외부 요청0, 소유 browser/server/sink 종료를 확인했다. 고지3개도 실제 HTTP/Chrome의 MIME·200·SHA 일치를 재확인했다.

첫 브라우저 하네스는 기존 가입 제목을 잘못 기대해 실패했다. 제품은 바꾸지 않고 기대값만 바로잡아 별도 결과에 재실행했다. [실패 원본](current-main-20261011/public-flow-failure.json). 첫 NFC-root 빌드의 metadata 누락 실패는 보존했고 canonical-root의 별도 wrapper로 같은 원래 Vite config/권리 checker를 실행해 통과했다. checker를 약화하지 않았으며 metadata 실패의 일반 원인이 해결됐다는 주장도 아니다. 최초 route·format 실패와 모든 raw 로그는 /private/tmp/bodyguard-runtime-current-main.SntevM에 보존했다.

공개 source/API/app·lock/migration/AGENTS는 main과 동일하고 이전 review의 immutable30파일은 byte 보존했다. 현재1600 unit/DOM·72 filesystem/source·53 deploy source/native parser/ASGI·TS·범위 Biome/Ruff/format·실제 production guard/원문 고지를 확인했다. API/SQL 전체·pnpm assets·Blender/GLB/아바타/물리 참여자 시험은 실행하지 않았다. 작성자 code-review는 최신 제외 목록 보존·before-output 거부·기존 경로/보안/자원 경계를 점검했으며 독립 전문가 리뷰가 아니다.

Docker 소켓과 native nginx는 없다. 실제 이미지/NGINX/TLS·패키지 인증/기록·quota·재기동/DB 장애 복구는 미실행이다. **Draft29 병합 조건·S5.2/5단계·1~6단계 완료는 미충족**이다. 기존 SDK/디자인/아바타 보류·실측/법무/운영 승인 경계도 유지한다. 아래 이전 기록은 그대로 보존한다.

추가 보존 확인: 전체 merge index의 diff-check는 이미 main에 커밋된 기존 아바타 evidence5파일의 EOF blank 경고로 실패했다. 이전 Draft HEAD→main만 대조해 같은5경고를 재현했으며 이번 편집이 아니다. immutable 기존 증거는 고치지 않았다. 이번 PR의 실제 base인 최신 main→현재 전체 diff-check는 통과했다. 증거 복사3개의 새 EOF blank는 제거하고 원본 byte와 다시 대조해 같음을 확인했다. 전체 merge index 검사 실패를 통과로 바꾸지 않는다.

---

## 2026-10-07 고지 패키지 연결 결과

Draft #29에 PR #58의 main885392c를 통합한 실행 HEAD는 `68130f67f59f1eb7d9d3fb27ad0b2204f6fe146a`다. exporter에 설치 원문 대조를 연결해 실제 JS/CSS/index/Google PNG4개와 고지3개를 선별한다. 실제 Vite 출력→새 package7개는 byte/hash 동일하며 기존 화면 출력4개도 전과 동일하다. Docker ignore에 필요한 TS build helper 하나만 추가했고 시험/브라우저/개발 파일 제외와 기존 SDK/CSP 정책은 변경하지 않았다.

[이번 원본·source/output/hash](notices-20261007/summary.json). 새 source/파일 하네스는 누락된 고지 선별·Docker 입력·NGINX exact 경로를 먼저 RED로 확인했다. 최초 symlink fixture는 다른 파일도 link로 만들어 고지 자체 경계를 분리하지 못했다. 원본을 보존하고 고지 한 파일만 link인 입력으로 좁혀 실제10건 RED 후 구현했다. 최종64건은 기존 export33·고지18·새 notice/source13의 **합성 filesystem/source 검사**이며 실제 image/context/NGINX 시험이 아니다.

실제 설치 Chrome154.0.8037.98은 새 package의 고지3개를 소유 loopback HTTP 시험 서버에서200으로 받았다. JSON/text MIME·nosniff·원문 SHA가 같고 고지 파일은 실행 중 변하지 않았다. 미등록 고지/추가 하위 경로/.env/API4개가404인 것은 **이 고지 전용 시험 서버**의 결과이며 NGINX·실제 API 권한/계정·제품 CSP·HTTPS를 검증한 것이 아니다. 외부 요청은 차단했고 browser/server/sink 종료를 실제 확인했다. SDK/카메라는 실행하지 않았다.

NGINX에는3개 exact 경로와 `try_files ... =404`·기본 MIME source만 추가했다. [NGINX 공식 core 문서](https://nginx.org/en/docs/http/ngx_http_core_module.html#default_type)의 default_type/types 구분을 확인했지만 실제 image mime.types·NGINX/PCRE·URI 정규화·TLS는 엔진 연결 후 재검증해야 한다. source assertion이나 시험 서버를 실제 NGINX 응답으로 표시하지 않는다.

기존 DOM/순수693개·TS/Biome·43개 파일/native parser/ASGI/route 계약·Ruff/format/mypy를 실제 실행했다. production guard는 실제 exporter 호출에서 실행됐다. dependency/lock·frontend/src·backend/app/migration·LICENSE는 최신 main과 같다. API/SQL 전체·pnpm assets 모델 준비·최종 avatar는 이번에 실행하지 않았다. source/hash는 기록된 HEAD의 당시 uncommitted 구현을 검증하며 이후 증거 커밋 자체가 실행됐다고 주장하지 않는다.

기존 검증30개 자료는 수정 전 실제 이전 Draft source05c2d55와 byte 대조했다.29개 immutable 파일은 그대로 두고 이 README index의 원문은 private `previous-review.md`에 보존해 아래에 그대로 이어 붙였다. 기존 실패·원본 아바타·private 출력은 삭제하지 않았다. raw 실행/실패·출력·helper는 `/private/tmp/bodyguard-runtime-notices.WzFnZh`에 보존하며 공개본은 상대 경로/hash·범위 결과만 있다.

작성자 code-review로 고지 누락/원문/경로·before-output 거부, 기존 destination/개발 제외 유지, build-only I/O와 browser 자원 정리, UI/API 변경0을 확인했다. 별도 에이전트/전문가 리뷰는 아니다. Docker desktop-linux의 소유 Unix endpoint/socket 부재와 실제 server:null/exit1을 다시 확인했다. **Docker/NGINX/HTTPS·실제 package 계정/기록·quota/재기동/DB 장애·전체 권리/법무·최종 아바타/실측·1~6단계는 미완료이며 Draft/병합 보류**다. 아래는 기존 원문이다.

---

# 웹/API 패키지 — 최초 실패와 실행 경계

## 2026-10-07 최신 main 통합 결과

Draft #29의 기존 source1336d3d에 main33a6e8b(PR #57 merge)를 통합한 실행 HEAD는6cb4b3138931290ee964f720f3d0bbfa2903173a다. 두 충돌 파일에서 이전 실행 기록과 main의42개 private producer 제외 문자열을 보존했고 기존 exporter 함수와 추가 개발 경로2개 제외도 유지했다. 공개 frontend/src·backend/app·migration·dependency/lock은 latest main과 같다. 새 화면 구성/카메라/아바타/SDK 정책/계정·운영 변경은 없다.

[첫 native 통합 실행·203개 source·기존 원본 SHA](integrated-20261007/summary.json): 기존 실패/실행 자료를 byte 보존하고 파일 exporter33개·DOM693개/42파일·파일 존재5개와 native Compose parser/ASGI7개·TS/Biome150파일·Ruff/format/mypy11source·실제 Vite production build·출력 guard를 통과했다. tsc와 Vite를 각각 실행했으며 prepare-assets/모델 다운로드·Docker build가 아니다. 선별된 index/JS/CSS/Google PNG4개가 실제 dist 원본과 byte/hash 동일하다. 이 시점 source의 테스트이며 이후 서버 직접 경로 보완은 아래 별도 증거다. 전체 API/SQL 회귀는 이번에 재실행하지 않았고 기존266개를 최신 회귀로 표시하지 않는다.

실제 App 경로와 패키지 구성을 읽다가 `/account/notifications`·`/posture-records`의 SPA 직접 주소 누락을 발견했다. [직접 경로 RED→GREEN·204개 최종 source·실패 보존](routes-20261007/summary.json): source 계약31건 중 이2건이 실패했고 NGINX 규칙의 이2개 경로만 추가했다. 최종 계약43건은 파일 존재5·parser/ASGI7·route source31이며 실패/skip0이다. route 목록15개·SPA pattern14개·API/개발/미등록 제외16개를 확인했다. Python의 현재 단순 pattern 대조는 실제 NGINX/PCRE·URI 정규화·HTTP/TLS 실행 증거가 아니다. 새 테스트의 format 실패1개도 보존하고 최종 Ruff/check·format·mypy를 통과했다. 첫 XML preflight의 sourceAtRunVerified=false 한계와 이후 실행 전후 정확한 source/unstaged 변경 표시를 구분했다.

직접 경로 보완 이후 source 차이는 deploy/nginx.conf와 신규 route test뿐이며 기존 frontend/API/build/선별 출력은 같다. 작성자 code-review에서 main 제외 목록·source/current 파일·원본 hash·직접 경로/API 구분·raw 개인정보 미게시·실제/미실행 표기를 확인했다. 별도 에이전트/전문가 리뷰는 하지 않았다. 실제 Docker CLI29.2.1 daemon 확인은 exit1/server 없음이며 켜거나 기존 컨테이너를 사용하지 않았다. **이미지/NGINX/TLS·패키지 계정/기록·두 peer quota·재기동/DB 장애 복구 검증은 여전히 미완료이며 Story 완료/PR 병합 불가**다. Draft #29·2단계 이월·디자인 구조 승인·SDK/실측/참여자·외부/운영·전체1~6 게이트는 그대로다. 아래 내용은 최초 작성 시점의 보존 기록이다.

S5.2 시작 maincbfd07ff944c94de12674bd982bfe98f075616f0 · 독립 패키지/선별 출력·로컬 TLS 구성 후보를 구현했다. **실제 Docker 이미지 빌드/컨테이너·NGINX/HTTPS·패키지 브라우저 검증은 미완료**이며 Story 완료/병합·5단계 통과가 아니다.

[최초 red](first-red.xml)5건은 backend/frontend Dockerfile·ignore와 deploy/nginx.conf가 실제 없어 실패했다(0.11초). 대체 파일/모의 성공을 만들지 않았다. 가독본은 줄 끝 공백만 정리하고 원본 gzip/기존 증거를 보존한다. 이 파일 존재 검사는 실제 이미지 빌드/서비스 실행/브라우저 검증이 아니다.

Docker CLI29.2.1의 desktop-linux endpoint는 소유 로컬 unix:///Users/gongman/.docker/run/docker.sock이며 현재 socket/daemon이 없다. 원격 엔진을 대신 연결하지 않는다. CEO에게 로컬 Desktop 실행 도움을 요청했고 연결 대기 중 독립 빌드 context/정적 출력·fixture/실행 계약을 진행한다. 실제 운영 계정·키·DB·외부 공급자·배포/비용은 사용하지 않는다.

## 정적 출력에서 발견한 경계

기존 prepare-assets는 개발용 MediaPipe/모델을 public에 준비하고 Vite가 그 파일을 dist에도 복사한다. 현재 production JS의 미검증 코칭/후보 문자열은0이지만, **dist 전체 복사만으로 개발 파일 제외를 보장하지는 못한다.** 기존 dist/모델/원본/검증 증거를 삭제하지 않고, 현재 웹이 참조하는 index·빌드 JS/CSS·기존 Google 브랜드 아이콘만 별도 생성 출력에 복사하는 경계를 구현/검증한다. 향후 검증한3D/카메라 에셋은 최종 통합의 명시적 allowlist/실제 검증으로 추가한다. 지금 사용 가능한 Google 로그인 화면의 공식 아이콘은 유지하며 기존 디자인을 바꾸지 않는다.

## 실제 구현·검증 경계

파일 exporter/deny-by-default context·고정 digest multi-stage Dockerfile·명시 TLS config·loopback compose를 작성했다. 현재 웹의4개 파일을 실제 출력하고 원본과 hash 일치를 확인했다. 신규 화면/실제 코칭을 완성한 변경은 아니며 Google PNG·화이트/블루 UI는 그대로다. exporter 목적지/디렉터리 alias·symlink·미등록 파일·개발 코드를 거부한다.

- [export 최초 실패](export-first-red.xml): 아직 모듈이 없어 test 파일1개 실패. 12개 test body 실패로 쓰지 않는다. 원래 Node 콘솔은 ERR_MODULE_NOT_FOUND를 확인했고 JUnit에는 모듈 원인이 포함되지 않는다.
- [첫 green](export-first-green.xml)12개→[경계 확장](export-boundary.xml)16개→[작성자 리뷰 보완](export-review-green.xml)18개, 실제 파일 시험0실패/0skip. 기존 source/destination 보존과 디렉터리 alias 경로 우회를 실제 filesystem에서 확인했다.
- [native 첫 오류](native-contract-first.xml)7개 setup error: 정제한 child 환경에서 Docker CLI가 Compose plugin을 찾지 못했다. production compose 실패나 실제 namespace 실행으로 쓰지 않는다. 실제 설치된 standalone Compose5.0.2를 우선 찾도록 수정하고 [native green](native-contract-green.xml)7개0실패/0skip을 통과했다. Docker engine 없이 native parser와 Uvicorn0.54.0 ASGI 경계만 검사했다.
- [파일 존재 green](package-presence-green.xml)5개는5개 파일의 존재만 확인한다. runtime 성공이 아니다.
- [API/실제 SQL 회귀](api-sql-regression.xml)266개0실패/0skip,69.13초. 기존 소유 PostgreSQL18.6 Unix 시험 DB와 기존 advisory guard를 사용했으며 실제 메일/Google/운영 DB는 아니다. native asyncio deprecation warning1개를 원본에 남겼다.
- [DOM 회귀](dom-regression.xml)327개0실패/0skip. Biome92파일·TS·production build·production 개발 후보/미연결 엔진 문자열0·Ruff30파일·mypy8source·diff 검사를 실제 통과했다. **이번 패키지의 브라우저/CSP/TLS를 검사한 결과가 아니다.**

모든 XML의 .gz는 줄 끝 공백 정리 전 실행 원본이다. 기존 최초red/이전 파일을 덮어쓰지 않는다. 원본 source/개발 모델·기존 실제 브라우저 화면/아바타 증거는 삭제하지 않았다.

현재 index hash는86213da1f688aebd2846d2d19324be3f75b12d53af763914bc8350a18b06e463, CSS는c0123052b60a122ff54814fc1d4715fa439f58355f761ddc67260a54035b0f15, JS는deae9447e06341db59a98b407bb60f6a39eac0e4585b114ecfcafbc3f4aee061, Google PNG는2bc2ae8e4c67de66d74bf1deed12cd8f22981270266a487576b671b0b4df361c다. 실제 선별 파일4개와 원본의 byte/hash가 같았다. 파일 일치는 이미지 실행·서비스 가용성의 대체 증거가 아니다.

## base image 출처·실패

기존 Docker config의 credential helper는 이번 공개 manifest 조회 중8분 이상 응답이 없었다. 확인한 이번 조회 shell/하위3개만 SIGTERM으로 종료했고 다른 Docker/server 작업은 건드리지 않았다. 이후 소유 임시 빈 Docker config로 익명 공개 metadata 조회를 완료했다. login·image pull/build/실행·운영 계정/secret을 사용하지 않았다.

Node24.20.0-bookworm-slim의 [manifest](node-manifest.json)는 digest ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e, Python3.14.7-slim-bookworm [manifest](python-manifest.json)는82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56, uv0.11.3 [manifest](uv-manifest.json)는90bbb3c16635e9627f49eec6539f956d70746c409209041800a0280b93152823다. amd64/arm64가 있다. 실제 image binary/OS/lockfile Linux 실행은 미검증이다.

NGINX stable-bookworm 조회는1.28.0 metadata였다([보존 manifest](nginx-stable-rejected-manifest.json)). [공식 보안 권고](https://nginx.org/en/security_advisories.html)와 대조해 사용 후보에서 제외했다.1.30.1-bookworm·1.30.5-bookworm 조회는 실제 not found/exit1이었다. [공식 stable 원본](https://raw.githubusercontent.com/nginx/docker-nginx-unprivileged/main/stable/debian/Dockerfile)이 현재 trixie 변형임을 확인한 후 [1.30.5-trixie manifest](nginx-selected-manifest.json)의 d715f7a85cdfea820fec743ea5aee8a22f91e00ff310ad6275d2638112d8cf8d를 선택했다. 공개 config의 amd64/arm64는 NGINX_VERSION=1.30.5/User101이었다. 이를 실제 실행/전체 취약점 검사로 세지 않는다. 이전 잘못된 후보/조회 오류를 없애거나 성공으로 바꾸지 않는다.

## 작성자 리뷰·미충족 완료 기준

engineering code-review의 security/correctness/performance/유지보수 관점에서 source/전체 diff·실제 fixture를 검토했다. 부분 정적 exporter는 부모 alias를 통한 source 내부 출력 가능성을 보완하고 실제 시험을 추가했다. 전체 package에는 미검증 런타임 경계가 있어 **병합 보류**다.

필수 잔여는 Docker build/native NGINX 기동·실제 파일/uid/비밀 제외/OS 취약점·TLS·CSP/직접 링크·두 peer quota/위조 forwarding 거부·로그 반사0·production 계정/기록 웹·namespace 재기동/DB 장애·복구와 소유 자원 정리다. [실행/rollback 계약](../../../deploy/README.md)을 따른다. 실제 공개 HTTPS·공급자·코칭/아바타/참여자·백업·법무·부가 기능·전체5단계/1~6단계 게이트는 열려 있다. 이 검증 기록은 원격 PR/병합이나 운영 실행의 증거가 아니다.
