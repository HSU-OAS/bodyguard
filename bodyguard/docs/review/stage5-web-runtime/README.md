# 웹/API 패키지 — 최초 실패와 실행 경계

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
