# S3.2 실제 화면 증거

2026-10-05 · localhost production 빌드 · Chrome · 계정 응답 mock

[추천 목적 선택](recommendation.png) · [직접 선택 빈 목록](selection.png)

화면은 실제 브라우저에서 캡처했다. 실제 사용자 영상이 아니며 카메라를 요청하지 않았다. 신체 분석·추천 판정·아바타·운동 수행 완료 증거가 아니다.

- recommendation.png SHA256: 3874cac87aad7e4f433c40c3f1ecded9ab08119c76c351e81cc23f74450669c0
- selection.png SHA256: 55855e0bfe69a71163bd092c592b8474d9d0340314cbb4fd138dc45baecaf877

실행: pnpm test / pnpm check / pnpm build / node scripts/check-selection-production.mjs / node scripts/test-selection-browser.mjs. 결과와 초기 실패는 [Story](../../stories/stage3-explore-web.md)에 구분했다. 기존 아바타 증거는 변경하지 않았다.
