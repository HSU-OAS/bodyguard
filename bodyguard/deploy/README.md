# 웹/API 로컬 패키지 — S5.2

현재 **미검증 로컬 구성**이다. 웹/API의 분리 빌드·TLS 프록시·격리 계약을 작성했지만 Docker engine이 없어 이미지 빌드/기동과 아래 실제 runtime 검증을 완료하지 않았다. [Story](../docs/stories/stage5-web-runtime-package.md)·[실패/실행 증거](../docs/review/stage5-web-runtime/README.md)를 따른다. 전체5단계·출시 후보판·공개 HTTPS 배포가 아니다.

## 포함한 것과 보존한 것

현재 공개·계정·기록 웹의 index/JS/CSS·공식 Google PNG와 아래 고지 파일을 출력한다. 기존 화이트·블루 디자인·로그인/복구/계정/기록 흐름을 변경하지 않는다. 미완성 카메라·코칭·아바타/개발 파일은 이번 패키지에 들어가지 않지만 원본/증거는 삭제하지 않는다. 최종 통합에서 검증한 파일을 명시적으로 추가해야 하며3D 필수 기능을 없앤 결정이 아니다.

최신 main PR #58 통합 후 고지3개(bundled-js.json/bundled-packages.json/tailwindcss.txt)도 설치 원문 대조를 통과해야 선별한다. 현재7파일의 실제 Vite→package byte/hash와 Chrome/소유 HTTP 시험 서버의 고지 전달을 확인했다. 이 HTTP 시험은 NGINX·HTTPS·API/계정/제품 CSP가 아니며 전체 image/runtime·권리/법무 완료도 아니다. [실행 범위와 원본](../docs/review/stage5-web-runtime/README.md).

API 이미지에는 기존 production app·고정 런타임 dependency·migration 원본만 있다. migration을 자동 실행하지 않는다. test provider/entrypoint·가짜 성공·가입 시드·운영 환경 변수·DB를 넣지 않는다. 정적 context 검사만으로 실제 이미지 내용을 보증하지 않는다.

## 입력·비밀 경계

compose에는 기본 키/메일/DB/운영 계정이나 기본 포트가 없다. `BODYGUARD_WEB_IMAGE`, `BODYGUARD_API_IMAGE`는 이번 소유 로컬 빌드 이미지 이름이고 `BODYGUARD_WEB_PORT`는 확보한 host loopback 시험 포트다. 같은 prefix의 `TLS_CERT_FILE`·`TLS_KEY_FILE`·`RUNTIME_ENV_FILE`은 시험 실행자가 소유하고 검증한 **절대 경로**여야 한다.

런타임 변수 파일은 운영 .env를 재사용하지 않는다. 격리 시험 DB/키/메일 설정만 준비한다. production origin은 `https://bodyguard.test:<시험 포트>`로 고정된다. test 환경 변수로 production entrypoint의 검사를 우회하지 않는다. Google 미설정은 기존503/고정 안내이며 실제 인증 성공으로 바꾸지 않는다. 계정/기록 시험은 소유 시험 DB의 synthetic 회원/기록을 사용할 수 있지만 실제 공급자 메일·사용자·코칭 기록 생산 증거가 아니다.

일반 `docker compose config`, `config --environment`, `inspect` 전체 출력은 secrets를 반사할 수 있어 기록하지 않는다. 아래 독립 parser 시험은 새 임시 경로/합성 값만 전달하고 `--env-file /dev/null --no-env-resolution`로 실제 변수 파일을 읽지 않는다. 레포의 기존 .env·신뢰 인증 개발 compose·운영 DB를 읽거나 수정하지 않는다.

## 로컬 프록시 후보

bodyguard.test용 TLS만 제공하며 host127.0.0.1에만 publish한다. API는 웹 network namespace의127.0.0.1:8000에 bind하고 밖으로 publish하지 않는다. default API 이미지 명령의 no-proxy-headers는 유지한다. 명시된 compose에서만127.0.0.1 peer 하나를 신뢰하고 NGINX가 외부 XFF를 실제 peer로 교체한다. 이는 인증 IP quota를 유지하기 위한 구성이지 신뢰할 외부 ingress/subnet을 정한 사업/배포 결정이 아니다.

API 경로는 SPA로 fallback하지 않는 구성이다. 현재 공개/계정/기록 route(알림 설정·자세 기록 포함)만 index로 직접 진입하도록 명시하며 없는 에셋/개발/미등록 파일은404 구성이다. 최신 route source 하네스는 간단한 pattern의 누락/과도한 허용을 검사하지만 실제 NGINX/PCRE·URI 정규화·HTTP/TLS 시험은 아니다. upstream 연결 실패는 고정503 JSON 후보 응답이다. URL/인증 입력을 access/error log에 저장하지 않는다. 공개 domain·외부 ingress·CA/HSTS·운영 관측/부하/복구는 별도 적용 승인과 실제 검증이 필요하다.

웹 재생성 시 API가 오래된 namespace를 계속 쓰지 않도록 **소유 패키지의 두 서비스를 함께** 다룬다. compose의 restart 의존성만으로 재기동 검증을 통과 처리하지 않는다.

## 독립 검증 명령

frontend에서 다음 exporter 시험을 실행한다. 기존 출력 경로는 덮어쓰지 않으므로 새 소유 경로를 사용한다.

```bash
node --test scripts/export-web-runtime.test.mjs
node --test scripts/runtime-notice-boundary.test.mjs scripts/check-build-notices.test.mjs
pnpm typecheck
pnpm check
pnpm build
node scripts/check-selection-production.mjs
node scripts/export-web-runtime.mjs /private/tmp/<새-소유-폴더>/package
node scripts/test-runtime-notices-browser.mjs /private/tmp/<새-소유-폴더>/package
```

Dockerfile 빌드는 기존 prepare-assets를 실행하지 않으며 카메라 모델 다운로드가 필요 없는 현재 웹만 빌드한다. 개발 환경의 pnpm build/모델 원본은 그대로다. 실제 빌드에서 frozen lockfile·pnpm 정책·Linux dependency/출력을 검사해야 한다.

backend의 기존 시험 환경에서 다음을 실행한다.

```bash
.venv/bin/pytest -q tests/test_web_runtime_package.py
.venv/bin/pytest -q ../deploy/tests/test_local_package_contract.py
.venv/bin/pytest -q ../deploy/tests/test_web_route_contract.py
.venv/bin/ruff check . ../deploy/tests
.venv/bin/ruff format --check . ../deploy/tests
.venv/bin/mypy app
```

파일 존재 시험은5개 파일의 존재만 확인한다. 별도7개 시험은 실제 Compose parser와 native Uvicorn ASGI forwarding 경계다. 추가31개는 현재15개 웹 route 목록·14개 SPA pattern·16개 제외 경로의 source 계약이다. **모두 image/컨테이너/NGINX/TLS/브라우저 시험이 아니다.** 실제 DB 회귀는 별도의 소유 DB·기존 advisory ownership lock을 사용한다.

## engine 연결 후 필수 실행·복구

1. 현재 context를 읽어 local Unix endpoint/소유 Docker engine임을 확인한다. TCP/remote/운영 엔진이나 기존 컨테이너를 재사용하지 않는다. 누락 engine은 실패/의존성이며 skip 성공이 아니다. registry 조회에는 새 빈 임시 Docker config를 사용해 기존 credential helper/계정 정보를 읽지 않는다.
2. 실행별 새로운 프로젝트 이름·ownership label·경로·loopback 포트를 생성하고 같은 이름의 기존 컨테이너/네트워크가 있으면 거부한다. 고정 digest로 실제 웹/API를 build한다. 이미지 파일·런타임 패키지/uid·원본/공급망·OS 취약점·미등록 개발 파일/secret 제외를 확인한다. 공개 registry manifest 조회를 빌드/보안 검사로 세지 않는다.
3. 새 로컬 TLS fixture·격리 PostgreSQL18 DB를 준비한다. 운영 자격증명이 아닌 합성 시험 값만 쓰고 외부 공급자/네트워크 요청을 차단한다. 테스트 DB 초기화/migration은 소유권을 검사한 별도 시험 절차에서만 수행한다. production API 시작 전후 회원/기록/메일 부작용0을 실제 확인한다.
4. native NGINX 문법/기동·SSL handshake/로컬 CA 검증·잘못된 Host 거부·직접 링크/새로고침·실제 image 파일·API404/장애503·보안 헤더·production Cookie/CSRF·본인/타인 기록을 검사한다. 한 client의 위조/중복 Forwarded/XFF가 quota를 바꾸지 않고 실제 다른 peer를 전부 한 IP로 합치지 않는지 실제 프록시/DB로 확인한다.
5. 로그인→기록→계정→로그아웃/재로그인·오류 복구를 **패키지의** production Chrome에서 실행한다. CSP/readonly/tmpfs·좁은 웹 창/키보드·연결 단절·API/웹 재기동·DB 장애/복구를 함께 검증한다. 로컬 fixture TLS는 공개 domain/실제 SMTP·Google/카메라/사용자 검증이 아니다.
6. 실패하면 해당 실행의 결과를 보존하고 공개하지 않는다. 소유 label·정확한 container ID/프로젝트 network를 재확인한 뒤 해당 시험 서비스만 중단/제거한다. 임의 down/prune·기존 source/DB/volume 삭제는 하지 않는다. 새 시험 DB는 운영/기존 DB와 별개이며 백업·보관 정책을 대신 결정하지 않는다. 복구/재시험은 보존된 source/digest/소유 자원만 대상으로 한다.

이 실행 절차/하네스의 실제 작동과 정리까지 확인해야 S5.2가 완료된다. 현재 engine 미연결 상태에서는 이 항목들을 통과하지 않았고 PR 병합 조건도 미충족이다. 공개 운영 작업은 정확한 대상·범위·비용·위험·복구 계획에 대한 CEO 별도 승인 전 실행하지 않는다.
