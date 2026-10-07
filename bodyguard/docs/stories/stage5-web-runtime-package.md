# S5.2 — 웹/API 로컬 배포 패키지

독립 패키지 구현 중·실제 컨테이너 게이트 미완료 · 시작 maincbfd07ff944c94de12674bd982bfe98f075616f0 · codex/stage5-web-runtime-package · NFR-08/FR-U-04·release-plan5단계

## 목표·승인 경계

PR #28의 제한된 서버 생존/DB 준비 경로를 실제 main 포함·브랜치 보존까지 확인했다. 다음 독립 작업은 현재 완성된 공개/계정/기록 웹과 API를 재현 가능한 패키지로 실행하는 구성이다. 앱/새 프레임워크/호스팅 사업 결정이나 실제 출시가 아니다. white/blue 웹 디자인을 유지하며 미검증 코칭/아바타를 출시 기능처럼 켜지 않는다.

CTO 권장안은 기존 Docker/Compose 스택의 빌드·API 기동·same-origin 정적 웹/프록시를 분리하는 것이다. 실제 호스팅/국가/도메인·유료 서비스·외부 계정·운영 키·DB migration/DB 위치·배포는 아직 결정/승인하지 않는다. 운영 secrets를 포함하거나 자동 migration/DB 초기화를 넣지 않는다. 기존 trust 인증 compose는 로컬 시험 전용으로 보존하고 운영 구성으로 승격하지 않는다.

이번 Story는 원본/기존 에셋·검증 증거를 보존한다. 개발 카메라/아바타/후보 파일은 출시 정적 패키지에 포함하지 않고, 향후 최종 통합 때 검증한 에셋만 추가하는 명시적 검증 기준을 둔다. 부가 기능·법무·개인정보·2단계 이월·실제 HTTPS 환경·전체 단계 게이트를 낮추거나 삭제하지 않는다.

## 수용 기준

1. 고정 lockfile의 기존 Node24/pnpm·Python3.14/uv로 웹과 API 이미지를 분리 빌드한다. 임의 dependency upgrade·테스트/개발 도구·.env/로컬 캐시/가상환경/미검증 모델 파일을 운영 이미지에 섞지 않는다. base image 버전/출처/digest와 실제 실행 가능성을 검증해 기록한다.
2. API는 migration/회원 생성/외부 공급자 요청 없이 시작하고 기존 production 설정의 HTTPS Origin/키/메일 필수 조건을 유지한다. source tests에만 synthetic 설정을 사용하며 앱/이미지에 성공 우회·fake mail 기본값을 넣지 않는다. access-log/proxy-header 경계와 생존/준비 상태의 뜻을 유지한다.
3. 정적 웹은 공개 직접 링크/새로고침·로그인/복구/기록/계정 흐름을 유지하며 API 경로를 SPA index로 잘못 응답하지 않는다. 현재 DOM/실제 브라우저로 확인한 화이트·블루 화면/상태를 바꾸지 않는다. 개발 경로/후보/카메라 모델/미완성 아바타를 완성된 웹처럼 제공하지 않는다.
4. 구성 파일과 실행 검사에서 운영 자격증명/키/DB URL을 출력하지 않는다. loopback/소유 테스트 프로젝트·컨테이너/volume/port만 다루며 다른 서버나 컨테이너를 재사용/중단/삭제하지 않는다. 테스트 종료/실패 때 소유 자원을 정확히 정리하고 복구 방법을 기록한다.
5. 실제 Docker 빌드·이미지/격리 컨테이너 실행·웹/API/보안 헤더/계정·기록/프로세스 재기동·DB 장애/복구를 검사한다. TLS/프록시는 로컬 handshake와 실제 공개 HTTPS를 구분하고 미실행을 통과로 세지 않는다. 운영 구성/장기 부하/백업/실제 공급자·공개 배포 승인 없이는 전체5단계 완료가 아니다.

## 하네스·진행 순서

engineering testing-strategy와 deploy-checklist의 승인/rollback 경계를 기존 Story에 맞춰 적용한다. 컨테이너를 실행하기 전 현재 Docker context가 소유 로컬 Unix engine인지 확인한다. remote/TCP/운영 context는 거부한다. missing daemon은 연결 의존성으로 기록하고 이미지 실행 검증을 skip 성공으로 숨기지 않는다.

- 최초 red는 아직 없는 Dockerfile/ignore/프록시 구성 파일의 실제 미존재 검사다. 이것을 이미지 빌드·기동·브라우저 검증으로 표시하지 않는다.
- 독립 구현은 정적 출력 allowlist/빌드 context·API entrypoint·명시적인 프록시 계약/안전한 fixture·rollback/runbook부터 진행한다. 구성 텍스트/모의 시험은 실제 runtime과 분리한다.
- Docker 연결 뒤 native compose/parser·build·image/container·실제 HTTP/SQL/production browser를 실행한다. 새로운 base/OS 패키지와 TLS 구성은 공식 출처를 확인한 뒤 선택하고 실제 검증한다.
- 명세→필요한 실제 하네스→구현/검증→작성자 보안/성능/오류 리뷰→최신 diff/HEAD/main/CLEAN/체크→한 목적 PR/merge commit·브랜치 보존이다. CI/.env/기존 migration을 고치지 않는다.

## 최신 main 통합·독립 재검증 계획 (2026-10-07)

기존 Draft #29의 source1336d3d에 main33a6e8b를 통합한다. 최신 공개 계정·알림 설정·분별 기록/삭제·기간 입력 복구는 main의 실제 코드 그대로이며 신규 화면 구성을 확장하지 않는다. main에 추가된 private 코칭/관찰/분 집계·업로드 producer와 test probe의 production 제외 검사도 기존 exporter 함수 경계에 보존한다. 기존 원본/실패·의상/머리·목 에셋은 수정하지 않는다.

새 하네스는 main의 금지 문자열을 포함하는 synthetic JS를 exporter에 전달해 출력 생성 전 거부·원본 보존을 확인한다. 최신 production TS/build·실제 파일 hash 선별·DOM 회귀·native Compose parser/ASGI·정적 검사를 실제로 재실행하고 실행 HEAD/전후 source·보존 원본 SHA를 별도로 남긴다. 파일 선별과 native parser가 통과해도 이미지/컨테이너·NGINX/TLS·계정 쿠키/두 peer quota/장애·복구의 실제 패키지 검증을 대체하지 않는다. Docker engine이 없으면 그 게이트는 실패/대기로 기록하고 Draft를 유지한다.

## 현재 의존성·남은 게이트

Docker CLI29.2.1·desktop-linux context는 있지만 daemon Unix socket이 없어 실제 engine이 미연결이다. CEO에게 Docker Desktop의 로컬 실행 도움을 요청했다. 새 계정/결제/운영 연결이 아니며 기다리는 동안 위 독립 구현을 계속한다. 연결 불가이면 해당 runtime gate를 보류하고 라이선스/백업·복구/6단계 하네스 등 다음 독립 작업으로 진행한다.

미정 Q-04 실제 호스팅, Q-17 보관/백업 정책, Q-26 법무/동의, Q-32 부가 기능 및2단계 이월·실제 코칭/기록 생산·실측/참여자 검증·SMTP/Google/HTTPS·최종 통합은 그대로 남는다. 운영 적용 전에는 대상/비용/위험/복구 계획을 묶어 별도 승인을 요청한다.

## 최초 실제 실패·다음 구현

필수 Dockerfile/ignore/프록시 구성5개가 실제 없어 첫 하네스5건이 실패했다(0.11초). [원본/실행 경계](../review/stage5-web-runtime/README.md)를 보존했다. 이미지/컨테이너 실행 실패나 검증 완료로 바꿔 쓰지 않는다. 다음 독립 구현은 개발용 dist 전체를 복사하지 않는 정적 출력 allowlist와 실제 파일 하네스다. 기존 Google 아이콘과 현재 웹의 index/JS/CSS는 유지하고 기존 모델/검증 파일은 삭제하지 않는다. 현재 branch의 전체 하네스가 통과한 상태로 표시하지 않는다.

## 로컬 패키지 계약·시험 구분

정적 exporter는 현재 index/JS/CSS·공식 Google PNG만 별도 경로로 복사한다. 기존 목적지 덮어쓰기·symlink·미등록 확장자·외부/누락 entry 참조·개발 코칭 코드를 거부한다. 현재 production 출력4개를 실제 선별하고 원본과 byte/hash 일치를 확인했다. React 화면/카메라/아바타를 새로 구현한 결과가 아니다.

웹/API는 별도 고정 digest 이미지다. default API 명령은 기존 no-proxy-headers·loopback·no-access-log다. 이 로컬 TLS compose에서만 API가 웹의 network namespace를 공유하고127.0.0.1:8000에 bind한다. 신뢰할 프록시는127.0.0.1 하나이며 외부 subnet/*·임의 Forwarded/XFF를 신뢰하지 않는다. NGINX는 XFF를 실제 연결 peer로 덮어쓰고 Proto=https로 고정하며 Forwarded/X-Real-IP를 지운다. 기존 IP별 인증 quota를 모든 사용자가 하나의 프록시 IP로 공유하지 않기 위한 CTO 기술 구성이다. 앱의 정보 수집·저장·Origin/CSRF·auth 정책은 변경하지 않는다. 공개 hosting ingress/프록시 경계는 별도 승인·시험 전 운영에 적용하지 않는다.

compose는 bodyguard.test 로컬 TLS/host loopback 포트만 제공한다. production 환경을 강제하고 외부 런타임 변수 파일·TLS 원본 경로를 명시적으로 요구한다. 자동 DB/migration·provider/test entrypoint·신규 계정·기본 secrets·운영 연결은 없다. 설정/인증 입력을 출력하거나 URL·본문을 NGINX access/error log로 보관하지 않는다. HTTPS/public hostname·신뢰할 인증서/HSTS·운영 장애 관측/배포는 이 로컬 설정을 그대로 승인된 운영 구성으로 볼 수 없다.

다음 독립 하네스는 실제 Compose parser로 서비스/loopback/API 미공개·readonly mount·누락 입력 거부를 검사하고 native Uvicorn middleware로 단일 peer 신뢰 경계를 확인한다. 이는 **컨테이너 namespace/NGINX header 덮어쓰기·TLS·인증 quota·브라우저 실행 증거가 아니다.** 실제 이미지 내용/기동·direct link·API 미존재/장애·쿠키/CSRF·두 client quota·로그 반사·재기동/DB 복구 시험은 engine 연결 후 필수다. 아직 S5.2 완료·PR 병합 조건을 충족하지 않았다.
