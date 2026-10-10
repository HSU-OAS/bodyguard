# 기록 저장부터 확인 삭제까지 — 실제 실행 결과

2026-10-10 · S6.24 · 시작 main `665c914e2befc3fcfca04366c0eaf6ee225eef3c`. 실행 전 [계약](../../stories/record-data-journey.md)을 작성했고, 최종 입력5개를 복사한 뒤 실제 시험을 실행했다. 제품 코드·공개 디자인·정책 변경 없이 연결 검증을 추가했다. 작성자 scoped 리뷰이며 독립 리뷰/전문가 검토는 아니다.

## 작동한 사용자 흐름

- 합성 관찰 전 전송0 → 기존 엔진으로2분 집계 → 실제 업로드 → 본인 일 조회2분 → 기존 공개 기록 목록/상세. 측정 없는 목은 `—`/0초이고 어깨1.25deg/측정30초/합성 이탈30초를 그대로 표시한다.
- 삭제2건 확인 → 취소 시 삭제0/조회2분 → 다시 확인 후 삭제2건 → 공개 빈 목록/대시보드0분. 타 계정에 HTTP로 생성한 비교 행1개는 보존했다.
- 실제 저장201 뒤 제어된 응답 단절 → uncertain → 명시 동일 재시도200 → 한 행. 실제 삭제200 뒤 제어된 단절 → 불확실 안내 → 자동 재삭제0 → 명시 빈 목록 확인.
- 삭제 preview 뒤 새 분을 실제 업로드하면 기존 확인은 원래1건만 삭제한다. 새 분1건은 목록·조회·실제 API에 남는다.
- 계정 변경은 전송 전 버퍼를 폐기한다. 이미 A에 수락된201 응답을 보류한 뒤 B로 전환/새 업로드/옛 응답 전달을 해도 B의 상태와1건은 유지되며 A의 원래1건도 보존된다. 네트워크 취소가 서버의 이미 완료된 저장을 되돌린다고 주장하지 않는다.

[저장된 기존 기록 화면](saved-record-detail.png) · [삭제 후 실제 빈 화면](deleted-record-empty.png). 합성 값이 표시된 기존 화면이며 새 디자인 시안/확정 디자인/실제 운동 기록은 아니다.

## 실제 검증과 경계

actual Chrome155·별도 실제 AuthProvider root·기존 집계/upload/query·공개 자세 기록 UI·loopback FastAPI·새 PostgreSQL18.6의 native5건이 **첫 실행에서 모두 통과**, 재시도/skip0이다. 공개 앱의 provider와 private provider는 별도 root이며 하나의 공개 측정 흐름이라고 주장하지 않는다. RJ-W01의 비교 계정 행은 Node API helper의 합성 body이고 주 사용자 정상 저장은 실제 브라우저 집계/upload 경로다. RJ-W05의 A 복귀 확인도 Node API helper다. 카메라/SDK/아바타/실제 몸/임상/실제 SMTP/Google/운영 검증0이다.

전체 frontend1568/실패·pending0, `pnpm typecheck`, `pnpm check`(314파일/기존 info16/오류0), runner `ruff check`와 `ruff format --check`, native가 실행한 production build/private build, `node frontend/scripts/check-selection-production.mjs`, `git diff --check`가 통과했다. 서버 제품 코드/DB schema 변경이 없어 전체 backend/타입 재생성은 재실행하지 않았다. frontend 회귀의 기존 모의 SDK/아바타 테스트를 실제 에셋 검증으로 세지 않는다.

검증 명령은 새 전용 `BODYGUARD_TEST_DATABASE_URL`·`BODYGUARD_TEST_RECORD_JOURNEY_PROBE`를 지정한 기존 locked Python의 `-m tests.run_browser recordjourney`다. 원본 output은 `frontend/test-results/recordjourney-20261010T121138095421Z`에 있다. `native-first.log`/원본 report에 실제 명령·각 결과가 있다. 콘솔의 NO_COLOR/FORCE_COLOR 경고는 보존했고 시험 실패는 없었다. 초기에 넓은 rg 출력 잘림·잘못된 파일 경로 읽기 실패는 대화 도구 기록에 있으며 별도 로그 파일이 있다고 주장하지 않는다. 정상 구현이 이미 있었으므로 인위적인 RED를 만들지 않았다.

메인 browser context의 카메라/SDK·외부 요청/JS 오류/브라우저 영구 저장0을 모든 native case에서 assertion/receipt로 검사했다. 비교 계정의 Node HTTP helper는 코드에 고정된 localhost API만 호출하며 browser 요청 카운터에 포함되지 않는다. 환경의 닫힌-port proxy는 기존 정책을 유지했다. 원본 영상/좌표/메일 IPC/쿠키/시크릿은 증거에 저장하지 않았다.

소유 PG PID99711/UID501·정확한 data path·bodyguard_test 역할/DB·TCP 없음·data/socket0700을 실제 대조한 뒤 종료했다(`server stopped`, `no server running`). 원본 data/log/실패·기존 파일은 삭제하지 않았다. 전체 단계/출시/실측/미승인 코칭·SDK/아바타 보류/시작P2/외부·운영 게이트는 그대로 남는다.

## 증거와 리뷰

[`manifest.json`](manifest.json)/[`verify.mjs`](verify.mjs)는 실제 실행 **후** 작성한 기계적 아카이브다. 증거27/입력6(실행 입력5+collector)/baseline와 현재 동일한 제품·migration·lock/config194개·공개 JS/CSS2개를 대조한다. public-before는 PR118 검증의 after 파일이며 tested source172d6와 merged665c의 동일 tree를 앞선 병합 기록으로 확인했다. 현재 public-after는 이번 native production build에서 읽었다.

```bash
node bodyguard/docs/review/record-data-journey/verify.mjs --check
```

작성자 리뷰는 테스트가 실제 기존 producer/HTTP/SQL/UI를 통과하는지, 원래 owner/CSRF와 cutoff·null을 유지하는지, 제어 응답/합성과 실제 시험을 구분하는지, private fixture가 공개 번들에 들어가지 않는지, 기존 runner 소유·reset·egress·결과 보존을 바꾸지 않는지 확인했다. scoped 미해결 P1/P2 없음. 외부 리뷰 없음은 독립 승인으로 세지 않는다. 최신 원격 main/diff/HEAD/CLEAN/체크 확인·조건부 병합 결과는 PR에 별도로 기록한다.
