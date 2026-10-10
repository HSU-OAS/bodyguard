# 로그인 후 원래 개인 흐름 복귀

기록/계정 직접 주소를 열면 로그인 뒤 시작으로만 돌아가던 누락을 보완했다. 기존 개인 경로/UUID 상세·기록 기간·자세 기록 page만 정규화해 로그인/가입 전환과 이메일 인증 뒤 전달한다. 새 화면·문구·CSS·인증/서버 정책/아바타/SDK/운영 기능은 없다. [Story](../../stories/web-login-return-flow.md)·[실행 범위/SHA/원본](summary.json).

실제 Chrome·소유 PostgreSQL18/loopback API에서 기록 기간→가입/인증→동일 기간·새로고침, 잘못된 비밀번호 거절→정상 로그인→계정, 외부/중복 next→안전한 시작이 동작했다. HTTP/SQL 인증 성공은 stub하지 않았다. 메일과 계정은 합성 시험용이며 실제 Gmail/Google/HTTPS·사용자 운동은 아니다. 카메라 호출은 기존 afterEach의 실제0 검사로 확인했다. 외부 proxy는 닫힌 포트로 차단했고 요청 시도 수/storage write/JS pageerror를 새로 계측했다고 주장하지 않는다.

초기 DOM4 누락 RED를 확인한 뒤 순수/DOM과 실제 흐름을 연결했다. 최종 frontend1639·TS·범위 Biome·원래 Vite config/고지/production private guard·diff를 확인했다. guard는 입력 root만 별도 출력으로 바꾼 원래 검사를 사용했다. CSS는 main과 byte 동일하며 JS는 복귀 기능 때문에 바뀌었다. 전체 backend/SQL 회귀나 avatar/Blender/GLB/물리 webcam 시험은 실행하지 않았다.

실패를 보존했다: 제어 문자 regex lint/DOM role 옵션 타입 오류, 없는 상대 Python 경로, 잘못된 grep으로0건 선택, 종료되지 않은 시험 preview/API가 남아 조기 다음 실행이 거부됐다. 정확히 확인한 소유 preview만 TERM으로 종료한 뒤 이전 핸들의 terminal·포트 미사용·목록3건을 확인하고 별도 confirmed 결과로 실행했다. 마지막 private command는 exec node로 단일 소유 프로세스를 사용한다. timeout 확대·재시도·skip·성공 응답 대체는 하지 않았다. [실패/최종 로그](evidence/). 원본 full browser JSON/화면·초기 자료와 PG 파일은 private scratch에 보존했다.

frontend-design은 기존 폼/화면/화이트·블루/계층/문구를 그대로 쓰고 요청했던 과제로 복귀하는 원칙에만 적용했다. 실제1440 기록/1024 계정 PNG를 육안 확인했고 기존 화면·조작과 줄바꿈을 유지했다. code-review는 작성자 보안·오류·성능·유지보수 점검이며 별도 전문가/독립 에이전트 승인이 아니다. 현재 Story의 미해결 P1/P2는 없고 조건부 PR 게이트를 진행한다.

소유 DB data_directory를 확인해 해당 클러스터만 정상 종료했고 API/preview 포트와 이번 프로세스가 없음을 확인했다. 기존 원본/사용자 서버/DB 파일은 삭제하지 않았다. 공개 코칭 구조/SDK 승인·아바타 보류·동작 적격0/실측·참여자·기존 시작P2·실제 공급자/Docker/HTTPS/법무/권리/운영·1~6은 여전히 미완료다. Google·복구 callback의 복귀 확장은 별도 후속 연결이며 이번에 완료한 것으로 세지 않는다.

증거 저장의 최초 staged diff-check는 log3개의 EOF blank로 실패했다. repository 사본 browser-real/dom-red/frontend-confirmed만 EOF를 정규화했고 원본 raw는 private scratch와 기존 SHA 그대로 보존했다. summary의 rawHashes는 정규화 사본이 아니라 실제 실행 원본을 가리킨다. 실행 결과·실패 본문·source/하네스는 바꾸지 않았다.
