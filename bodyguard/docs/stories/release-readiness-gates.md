# S6.10 — 출시 통합의 승인·실측 실행 경계 기록

상태: 문서·원본 대조 로컬 검증 통과 / PR 게이트 확인 전. 최신 main `5a1a3d8ec1149cf029c486aee35de1dc33a2f167`, `codex/release-readiness-gates`.

## 목적·범위

[출시 계약](../release-plan.md)의 전체 목표와 [운영 규칙](../operating-rules.md)을 유지하면서, 정적 코칭 시안·제품·검증된 동작·운영 배포를 구분한다. [실행 게이트](../release-readiness-gates.md)에 현재 사용자 흐름, 미충족 완료 조건, CEO에게 요청한 정확한 결정/연결, CTO 책임과 열린 Draft를 기록한다. 새 제품 기능·임계값·화면 구조·SDK 정책·개인정보·운영 변경은 없다.

## 수용 기준·하네스

1. 여섯 단계의 필수 흐름·기준이 유지되고 출시 적격0·모든 이월/미완료·최종 전문가 검토 전 실제 완료 요건을 낮추지 않는다.
2. 실제 시안 report의12개 이름/결과·실행 HEAD·다섯 파일 SHA·경계0을 원본과 대조한다. 실행 scope가 정적 HTML만이며 최신 main에 같은 다섯 byte가 있다는 것을 검증한다. 임상/제품/native/실제 참여자로 확대하지 않는다.
3. 원격 PR9/29/36/51/90/91의 시점별 HEAD/Draft/충돌/체크 없음과 현재 main을 확인한다. 실패한 필수 검증, 과거/이번 실행, 답변 없는 승인 요청을 구분한다.
4. 새 문서의 로컬 링크와 `git diff --check`, 변경 경로 allowlist를 검사한다. 실제 제품/API/SDK/아바타/원본/CI/기존 migration/연구/시크릿/운영 파일 변경0이어야 한다.
5. 정확한 HEAD·최신 main/diff/CLEAN/체크와 scoped P1/P2 없음 뒤 문서 목적의 PR만 조건부 merge commit 병합한다. 기존 Draft와 전체1~6 완료는 별개이며 브랜치를 보존한다.

## 제외

제품 적용/SDK 정책 승인 획득·실제 촬영·새 조형/GLB·판정/시범 임상 확정·PDF 내용/부가 기능 첫 출시 확정·비용/계정/시크릿/운영 DB migration/배포/출시, 기존 Draft 병합 없음. 기존 아바타와 모든 실패·증거를 보존한다.

## 실행 기록

최신 main에서 새 작업트리를 만들고 문서·기존 report/경계를 기록했다. `documentation`의 사용자 흐름/실제·미실행 구분과 `code-review`의 정확성·개인정보·유지보수 검토를 적용한다. 이 Story에 독립 에이전트/전문가 리뷰나 전체 제품 재검증을 주장하지 않는다.

`node bodyguard/docs/review/release-readiness-gates/verify.mjs`는 저장된 원문 SHA·12개 고정 이름/결과·실행 HEAD·시안5파일의 현재/base/실행 Git blob·경계0·시점별 Draft6개·문서만9파일·로컬 링크35개를 검사한다. 브라우저/SDK/API/임상 시험을 실행하는 명령이 아니다. 최초 링크 검사에서는 존재하지 않는 계정 Story 경로로 exit1이 발생했고, 같은 verifier의 재현 [원문](../review/release-readiness-gates/link-red.stdout)을 보존했다. 실제 가입/복구/탈퇴 Story에 연결한 뒤 통과했다.

처음 staged diff 검사는 공개 실패 stdout의 EOF 빈줄로 exit2였다. 내용과 변경 전 byte는 `link-red.stdout.original.gz`에 보존하고 공개 stdout의 끝 개행만 하나로 정리했다. 검증기는 gzip SHA·복원 SHA·공개 파일과의 끝 개행 정합을 확인한다. 첫 압축 보존 helper는 구문 오류로 실행 전 실패/파일 변경0이었고, 바로잡은 명령으로 보존/정합을 확인했다. 이 실패들은 도구 원문에도 남아 있다. 첫 Biome의 template-info3건도 수정해 다시 검사한다. 실패를 통과로 바꾸거나 whitespace 검사를 끄지 않았다.

작성자 검토: 제품 코드·화면·의존성·GLB·SDK·원시 신체 데이터·시크릿·운영 변경이 없고, 과거 실험/이번 정적 실행·답변 없는 요청·미정 요구를 구분했다. 원격 상태는 시점 기록이며 미래 병합 허가로 쓰지 않는다. 이번 문서 범위에서 미해결 P1/P2는 발견하지 않았고 기존 제품 P2/전체 단계는 여전히 미완료다. Node 구문/원문·링크·scope·diff 검증 후 exact HEAD/최신 main/PR 게이트를 별도로 확인한다.
