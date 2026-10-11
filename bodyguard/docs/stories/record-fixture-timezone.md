# 기록 집계 시험의 기본 시간대 고정

2026-10-12 · 기준 main `0c8d1726b36fc36f3935de2111937fdccd5006a1`

FR-R-03/06/U-04의 기존 기록 화면 시험은 UTC 응답 fixture를 반환하면서 브라우저 기본 시간대를 고정하지 않았다. Asia/Seoul에서 단독 실행은 8실패/3통과, 같은 원본을 `TZ=UTC`에서 실행하면 11통과였다. 엄격한 기간/시간대 검사는 올바르게 불일치 응답을 거부했으며 제품 오류로 단정하지 않는다. 기준 수집 Story의 전체 회귀 실패 원본은 `/private/tmp/bodyguard-camera-reference.QZP1jL/frontend.log`, 단독 실패/UTC 재현 로그도 같은 디렉터리에 보존한다.

이 PR은 시험의 기본 `Intl.DateTimeFormat`만 UTC로 명시하며, 옵션으로 전달한 실제 IANA 시간대는 네이티브 구현을 그대로 사용한다. afterEach의 기존 mock 복구로 다른 시험에 남지 않는다. 제품·API·시간대 정책·DB·운영·CI는 변경하지 않는다.

수용 기준: 기존 기록 시험과 기본/명시 시간대 보존 회귀가 Asia/Seoul·UTC·America/New_York에서 통과하고, 기본 환경의 전체 프런트 회귀·타입·Biome가 통과해야 한다. 실제 사람/외부 공급자 시험이 아니다.

## 결과

- `TZ=Asia/Seoul`, `TZ=UTC`, `TZ=America/New_York` 각각 `pnpm exec vitest run src/pages/RecordPeriodSummary.test.tsx`: **12통과**. 기본 UTC만 고정하고 명시 Seoul/New York을 네이티브로 보존하는 회귀를 추가했다.
- 기본 한국 시간대 `pnpm test`: **1897통과/105파일**. `pnpm typecheck`, `pnpm check`, `git diff --check` 통과. Biome의 기존16 info는 남으며 신규 진단은 없다.
- 첫 보완의 arrow constructor mock은 기존 시험10개 실패로 반려했고, Vitest에서 constructible function으로 고쳐 재실행했다. 원래 8실패와 반려 결과를 [증거](../verification/record-fixture-timezone-20261012/)에 압축 원문으로 보존했다.
- 직접 diff 검토: 변경은 시험 기본 시간대와 회귀뿐이다. strict 기간 파서/제품/DB/CI 변경0, mock 복구 유지, 본 PR 범위 미해결 P1/P2 없음. 독립 리뷰를 실행했다고 표시하지 않는다.
- 실제 웹 사용자 정확도·공급자·배포를 검증한 것이 아니다. PR 병합은 원격 최신 diff/CLEAN/체크/정확 HEAD 게이트를 따로 확인한다.
