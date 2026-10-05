# 서버 생존·준비 상태 — 실패 보존·최종 검증

S5.1 시작 main34e433024bf8ceab059bb2071d440c4465aee37a · 최초 red부터 최종 로컬 구현/검증까지 기록한다. 운영/배포·전체5단계/1~6단계 완료가 아니다.

소유한 격리 PostgreSQL18.6과 실제 create_app/TestClient의 GET /api/v1/health/live·ready2건이 모두404로 실패했다(0.42초). 대체 handler/mock 성공을 만들지 않았다. [실패 XML](first-red.xml)과 원본 gzip을 보존한다. 실제 운영 HTTP/DB/HTTPS/메일/Google·백업 시험으로 세지 않는다.

## 실제 작동하는 흐름

DB가 준비되면 live/ready200, revision/필수 열·권한이 없거나 잠금/접속이 막히면 ready503/live200, 복구 뒤 ready200이다. 응답은 고정 status뿐이다. 점검 때문에 사용자 계정·세션 활동·카운터·기록·메일은 변하지 않는다. 기존 공개 도움말/데이터·가입/복구/계정·기록 웹은 변경하지 않고 화이트·블루 디자인을 유지한다. 이번 Story는 새 사용자 화면/3D/카메라/완성 코칭을 추가하지 않는다.

## 하네스와 실제 범위

- 최초2건 actual404/0.42초: [원본](first-red.xml.gz), hash42dfc0fd0a981333db7fa2f5cbd82d3fe34260d637940e7c2aa6fe8e5d63e420.
- 확장5건 actual404/0.815초: [가독본](expanded-red.xml)·[원본](expanded-red.xml.gz), gzip hash79dc3e93c5f8134bd962b16561ecfde51a60ca51ecc191ec5ff16ba76efeb091. 가독본은 줄 끝 공백만 정리하며 raw gzip/기존 파일을 보존한다.
- 중간 [5건 green](first-green.xml)/0.700초, [13건 경계](boundary-v1.xml)/6.956초, [18건 경계](boundary-v2.xml)/10.920초를 보존한다. 이후 필수 status/구형 client 차단 리뷰 보완 전 결과이며 최종 판정에는 아래만 쓴다.
- [최종 실제 API/SQL](final-api.xml):261건·77.444초·실패/오류/skip0, 신규19건 포함. psycopg3.3.6·libpq18.6·소유 PostgreSQL18.6에서 실행했다.
- [최종 DOM](final-dom.xml):327건/27파일·실패/오류/skip0. 실제 카메라/사람 수행 시험이 아니다.

실제 SQL은 읽기 전용 DELETE(false) 거부·SQL sleep timeout·ACCESS EXCLUSIVE 잠금 timeout·revision/열 변경/복원·SELECT-only 임시 역할의 실패/권한 복구·행 지문 불변을 확인했다. 임시 역할의 권한을 회수하고 역할을 제거했으며 schema/revision도 finally로 복구했다. 시험 DB/소켓/프로세스는 소유 자원만 사용했다. 인증 engine connect를 금지한 상태에서도 별도 ready/liveness가 응답했다.

실제 loopback 소켓의 연결 거부/무응답 접속은 ready503이다. 무응답 접속 중 live200과 동시 ready6건의503·추가 연결0/대기열0, 실패 이후 lock 해제를 확인했다. 실제 production 설정 Uvicorn+native HTTP에서 정상→revision 장애/복구·headers·쿠키0·공개 docs/openapi 차단·기존 /me401을 확인했다. **loopback HTTP이며 실제 HTTPS·공급자/운영 배포는 아니다.** Unsupported PostgreSQL17/19·libpq16 및 connect/deadline scheduling stall은 주입이다. 실제 그 버전 서버/client 설치, 외부 DNS 장애·연결 후 실제 망 단절/취소 packet·운영 장기 부하/replica 시험으로 세지 않는다.

## 생성·빌드·정적 검사

실제 FastAPI schema에서 typed OpenAPI를 만들었다. 필수 literal status와 준비 실패의 별도503모델/입력 없음/GET만을 검사했다. DB/메일 없이 생성2회 hash 동일: index.ts6e90072bdc6fe7b682885f7f6e68d8e889324a63c9ba7f3108ee20dd889183b0, types.gen.tsacb733c26a365f0b0ea7825b8284370039bbf0b05cda921b49e23c8f0021a895. TypeScript/Biome90파일·Ruff/format28파일·mypy8소스 통과. production JS322.46kB(gzip98.48), CSS28.00kB(gzip6.78), 개발 동작 후보/미연결 코칭 문자열0이다. UI/bundle 해시가 S4.7과 같고 새 UI 변경이 없어 모든 Chrome UI suite를 재실행하지 않았다. 이번 새 실제 HTTP 시험은 위 API 하네스에 포함된다.

타입 생성 첫 시도는 uv cache sandbox 권한 실패로 중단돼 이후 검사가 실행되지 않았다. 소유한 임시 cache/UV_OFFLINE을 사용해 재실행했다. 이를 타입 검사 실패나 기존 정상 실행으로 숨기지 않는다. 중간 전체API260건의 [v1](full-api-v1.xml)·[v2](full-api-v2.xml)을 보존하되 v1 실행 중 status 명세를 보완했으므로 최종 source gate 증거로 쓰지 않는다. v2에는 기존 asyncio와 Pydantic 의존성 경고2건, 최종은 asyncio 경고1건이며 경고를 숨기거나 최신 라이브러리로 임의 교체하지 않았다.

## 작성자 코드 리뷰 — engineering code-review

검토 범위는 새로운 readiness.py, main 등록2줄, 실제 하네스/생성 타입/설명이다. 별도 사람/독립 에이전트 리뷰로 표시하지 않는다.

1. 보안: 요청 body/query를 읽지 않고 고정 응답만 반환한다. 새 auth 우회/회원·영상/좌표/로그 수집0. native DB 진단 logger는 차단하고 기존 no-store/no-referrer와 access-log 금지 원칙을 유지한다.
2. 성능: 인증 pool checkout/스레드 풀 대기가 없다. 한 process당 접속1개, busy fail-closed, 접속/SQL/잠금/idle 한계와 전체 취소 deadline이 있다.3초는 native 취소/정리까지 포함한 확정 HTTP SLA가 아님을 README에 명시한다. 구형 client의 무한 blocking 취소 가능성을 발견해 libpq17 미만을 거부했다.
3. 정확성: SELECT1만 통과하지 않는다. primary/version/revision/필수 열/역할 권한을 확인하고 schema 장애는 복구 뒤 정상으로 돌아온다. 계정/세션 지문 불변과 메일0을 검증했다. 모든 제약/인덱스/보안 설정 감사나 전체 제품 준비를 보증하지 않는다.
4. 계약: 기본 status 때문에 생성 타입이 선택 필드였던 P2를 필수 literal로 보완했다. 실제 schema/타입 소비 회귀를 재실행했다. 이전 migration/CI/.env/기존 테스트 계약을 변경하지 않는다.

Verdict: 최종 범위 내 미해결P1/P2 없음. 기존 아바타 Draft PR #9 외형P2와2단계 실측/통합 이월, 실제 코칭/메일/Google/HTTPS/백업/법무/참여자/전체 단계 게이트는 그대로 미완료다. 최신 diff/HEAD/main/CLEAN/체크를 확인한 뒤에만 merge commit PR 게이트를 진행한다. 실제 운영 점검 연결·서버·시크릿·DB migration·비용·배포/출시는 실행하지 않았다.

기술 확인은 [PostgreSQL18 접속·대상별 timeout](https://www.postgresql.org/docs/18/libpq-connect.html), [native psycopg async DNS/취소](https://www.psycopg.org/psycopg3/docs/advanced/async.html)와 설치된 고정3.3.6 소스를 대조했다. Docker client29.2.1은 있으나 daemon socket은 없다는 읽기 전용 상태 확인만 했다. 컨테이너 빌드/기동으로 표시하지 않으며 다음 배포 패키지의 실제 실행 검증에는 연결이 필요하다.
