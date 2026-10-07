# 실제 결과→기록 — 실제 저장/조회와 미완료 경계

main6d7e78fd · codex/coaching-result-record · [명세](../../stories/coaching-result-record.md)

serializer/HTTP/세션 lease writer를 구현했다. 실제 main의 session을 합성 자원/관찰로 실행한 뒤 기존 API/격리 SQL에 저장하고 production Chrome의 본인 목록/상세에서 확인했다. 공개 코칭/실제 classifier/auth·UTC capture는 연결하지 않는다.

[실제 현재 기록 상세](final-result-record-detail.png)는 화이트/블루 공개 UI에서 합성100ms 결과를 조회한 사진이며 실제 사람의 운동/아바타/정확도 검증이 아니다. 공개 JS/CSS는 이전 빌드와 SHA가 동일하다. web-design-studio 요구를 유지했으며 새 화면 디자인/Figma/외부 audit는 이 Story에서 실행하지 않았다.

## 실제 사용자 흐름·오류 경계

- 완료 결과8필드→POST201→본인 기록 상세. 중복 submit은 POST1, 동일 내용200/변경409.
- 부분 수행 후 skip은 원래 engine skipped·pending을 보존하고 기록만 interrupted+100ms. pause/resume은40ms를 보존, 전체 skipped만 수행0.
- 서버 수락 후 응답을 끊어 실패를 표시했다. 자동 재시도0, 명시 retry200·동일 ID·SQL 한 건.
- 다른 쿠키로 바뀌면 과거 CSRF proof403. caller가 owner 폐기를 놓쳐도 새/원 계정 저장0. owner 통지 후 retry POST0.
- 서버가 이미 수락한 뒤 owner 폐기/late 응답은 writer closed를 유지한다. 새 계정 기록0, 원 계정 기록1이므로 abort를 rollback이라고 부르지 않는다.

최종 실제 Chrome/API/SQL5건(18.6초), 초기3건(15.9초), public Chrome7건+private 합성 RAF1건(21.4초). 카메라/GLB/model/외부 요청/영구 저장소 변경0. 메일/관찰·자원은 합성, 공급자/참여자/실제 HTTPS는 미실행이다.

## 명령·실패 원본·리뷰

[first-red.xml](first-red.xml)/contract-red는 missing module 수집 실패1·시간0·exit1이며 실제 기능 시험 실패/완료가 아니다. [최초 SHA](artifacts-first.json)를 그대로 보존했다. 상세23건 green 뒤 초기 typecheck의 fetch spy tuple2오류를 RequestInit 인자로 수정했다. engineering:code-review에서24:00 정규화/내림 전24h 한도·accessor raw error 경계를 추가했다. [review-red.xml](review-red.xml)의26건 중3실패를 fixed failure로 해결하고26건 green, 최종29건·전체459건 통과다.

실행: pnpm exec vitest run --maxWorkers=1 --reporter=junit, pnpm typecheck/check/test:selection, 기존 보호된 BODYGUARD_TEST_DATABASE_URL로 pytest -q --junitxml 및 python -m tests.run_browser resultrecord, Ruff check/format --check·mypy app. API/실제 SQL291건(135.49초), 기존 asyncio deprecation 경고1. guard를 의도적으로 누출해 exit1 확인 후 해당 생성 시험 파일만 제거해 exit0. 우회 설정0. formatter 첫 실행은 repo root에 바이너리가 없어 exit1, frontend 설정으로 다시 실행했다.

[증거23개·실행 source9개 SHA](artifacts.json)를 collect-proof.mjs가 고정된 소유 scratch·해당 Story test-results 경로에서 수집했다. 기존 파일은 동일 byte 여부만 확인, 덮어쓰기0. 호스트/로컬 경로/EOL 공백만 공개 자료에서 정리했고 private raw는 그대로 보존한다. raw/공개 SHA는 각각 기록한다. 숨긴 실제 영상/좌표/계정 시크릿은 없다. 루트 node_modules·API deps·시크릿·운영 migration·CI 변경0.

## 남은 통합

명시적인 session lease/시작 CSRF/최초 ready UTC를 **실제 인증 lifecycle**에서 확보·폐기하는 caller가 아직 없다. private 합성 probe를 제품 사용자 기록 생산으로 연결하지 않는다. 아바타/실측/동작 gates/classifier·Draft36 SDK 개인정보 P2·운영/참여자·부가 기능·전체1~6단계 완료는 여전히 미충족이다. 현재 기술 Story만 범위 내 로컬 검증/리뷰를 통과했다. 병합은 최신 diff/main/CLEAN/체크/exact HEAD 게이트 확인 뒤 진행한다.

순수 engine은 skip 뒤 일부 단계 수행을 보존하지만 기존 API skipped는 수행0만 허용한다. 권장 기술 정합화는 전체 pending만 기록 skipped, 부분/완료 단계가 있으면 기록 interrupted로 실제 수행을 보존하는 것이다. engine 결과/판정·서버 스키마/개인정보 필드는 바꾸지 않는다. 실제 제품 흐름과 owner/UTC anchor capture는 후속 통합이 필요하다.

저장 시 새로운 CSRF proof를 받으면 로그아웃/다른 쿠키 상태로 과거 결과를 잘못 귀속할 수 있다. 서버 main.py의 protect는 현재 cookie에 결합된 HMAC/locked session을 검사한다. 해당 코칭 owner/session에서 확보한 proof만 명시 입력으로 받고 신호/소유권 폐기·late 응답을 검증한다. 운영 시크릿 생성/주입이 아니라 기존 메모리 CSRF 사용이며 proof를 payload/저장소/URL/로그에 넣지 않는다.

초기 patch의 JS 문법 오류와 상세 patch delete+add/반복 hunk 검증 실패는 해당 호출 실행·변경0으로 기록했다. auth.py/AGENTS.md/guard의 추정 경로 읽기 실패는 실제 경로를 찾아 정정했다. 모의/미실행을 실제 완료로 세지 않는다. source·원본·검증 증거 보존과 별도 승인 경계는 그대로다.
