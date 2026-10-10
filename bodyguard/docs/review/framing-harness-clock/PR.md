## Summary
- S6.23: 기존 DEV 촬영 안내 첫 DOM fixture/capture 시계를 고정하여 render/접근성 조회의 경과 시간에 의존하던 시험을 보완합니다. 제품·공개 화면 변경0.
-1000ms 포함→1001ms 거부→새 프레임 재개 DOM 경계를 추가하고 최초 전체 실패·명시적 stale 반례와 실행 입력/결과를 보존합니다.

## Verification
- 원래 전체1503통과/1실패; 명시적1001ms private 반례1실패/5skip. 원래 elapsed age는 미기록이며 stale 제품 거부는 올바른 동작입니다.
- 페이지/순수 framingTrial29·전체frontend1505 통과; tsc/Biome/build/private guard 통과. 기존 info15 유지.
- 실제 public JS/CSS2파일 byte 불변, proof27/source8/불변188 SHA 검증·작성자 scoped 리뷰 P1/P2 없음·git diff --check.
- happy-dom/mocked input이며 실제 카메라/SDK/아바타/사람 검증0. [명세](bodyguard/docs/stories/framing-harness-clock.md), [증거와 한계](bodyguard/docs/review/framing-harness-clock/README.md).

## Excluded
- API/DB·제품 신선도 기준·판정/UI/디자인·의존성/CI·미승인 코칭 구조·avatar 제작/검증·비용/계정/시크릿·운영 migration·배포·출시 변경0.
- S4.18은 별도 API 작업트리에 보존하며 자체 전체 검증 후에만 병합. Draft51/역사적 시작P2·전체1~6는 완료로 표시하지 않습니다.
