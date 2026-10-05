# 최초 환경/정적 실패

- suite 미등록: first-red.txt의 argparse exit2. DB/HTTP/Chrome 케이스는 실행하지 않았다.
- node_modules 기존 캐시 clone 후 제한 실행 pnpm은 store 연결을 재생성하며 tarball을 찾으려 했지만 sandbox DNS/접근 제한으로 실패했다. 자신이 실행한 session11699만 중단(exit130)했다. 실제 브라우저/제품 장애·다운로드 성공으로 세지 않는다. 기존 파일/다른 서버는 종료하거나 삭제하지 않았다. 전체 도구 출력은 대화에 남고 여기에는 원인/구분을 기록한다.
- 뒤의 pnpm install --offline --frozen-lockfile은 기존 캐시194개 재사용·다운로드0으로 성공했다. lock·package 버전·보안 정책은 바꾸지 않았다.
- 최초 타입 검사: security.spec.ts(325,69) TS2322. 서로 다른 header object의 추론 union이 optional undefined를 포함해 Record<string,string>과 맞지 않았다. browser 미실행. invalidHeaders를 실제 문자열 dictionary 배열로 명시하고 정적 검사를 재실행한다. 오류를 타입 강제 캐스팅으로 숨기지 않는다.

이 실패를 제품 API/화면 검증 실패나 완료 증거로 대체하지 않는다.

첫 실제 Chrome 실행 security-20261005T115253010912Z는2통과/1실패·16.4초였다. S02는 로그아웃 뒤 소개 화면을 기다리는 잘못된 하네스 기대값으로 실패했고 실제 화면/MemberPage는 승인된 로그인 화면이었다. 아직 방문 전 main page의 afterEach storage 접근도 SecurityError로 실패했다. 실패 JSON/error-context/화면을 보존하고 기대값은 기존 제품 계약대로 로그인 화면으로 수정한다. beforeEach에서 실제 소개를 먼저 열어 모든 case의 저장 검사가 실행 가능한 document에서 이뤄지도록 한다. 통과하지 못한 cookie 재전송/전체S02를 통과로 기록하지 않는다. 제품 동작은 바꾸지 않는다.

두 번째 실제 실행 security-20261005T115432073536Z도2통과/1실패·10.4초다. S02의 HTTP/화면 assertion은 진행됐지만 afterEach에 newPage의 about:blank에서 하네스 init이 mediaDevices 없는 window를 수정하려다 pageerror가 발생했다. 이를 성공이나 제품 카메라 결함으로 숨기지 않는다. init은 실제 mediaDevices가 있을 때만 instrument하고 실제 서비스 document의 secure context/mediaDevices 존재를 별도 확인한다. 실패 원본은 보존한다.

작성자 리뷰 P2 보완: user_id/잘못된 motion_id/extra password를 한 body에 묶으면 다른 필드의422가 소유권 입력 거부의 회귀를 가릴 수 있다. 세 입력을 각각 보내 generic422/실제 양쪽 목록 보존을 독립 확인하도록 보완한다. 최종 소스로 모든3 case와 관련 회귀를 다시 실행한다.

회귀 뒤 정적 명령의 mypy app을 frontend cwd에서 호출해 실제 app을 찾지 못한 exit2가 있었다. 그 앞 DOM/XML·DEV 차단·Biome/Ruff/format은 실행됐지만 이를 mypy 통과로 기록하지 않았다. backend cwd에서 Ruff/format/mypy app을 다시 실행해8개 실제 source 통과를 확인했다.

첫 staged diff check는 Playwright가 만든 두 번째 실패 error-context의3개 행 끝 공백으로 exit2였다. 커밋은 실행하지 않았다. 변경 전 evidence 사본도 소유 scratch/evidence-before-whitespace에 보존한 뒤 공개 Markdown 사본의 행 끝 공백만 정규화했다. raw source/원본 hash/실패 상태·PNG는 그대로다. 수집기의 같은 정규화와 기존 사본 byte 비교·checksum/diff를 실제 재실행하고 통과 후에만 커밋한다.

정규화 중 편집 도구가 마지막 개행을 추가해 수집기 byte 검사가 실제 불일치를 거부했다. 원본은 덮지 않았고 기존 사본도 private에 보존했다. 공개 Markdown의 행 끝 공백/최종 개행만 같은 규칙으로 정규화한 뒤 모든4실행의 raw hash·사본을 다시 비교해 통과했다. 실패 case/통계/본문 의미는 바꾸지 않았다.
