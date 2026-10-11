# S6.SDK — SDK 동일 출처 통신 경계

2026-10-11 CEO 승인: 코칭 화면·동작 선택 구조 적용과 SDK 동일 출처 통신·외부 계측 차단의 로컬 구현·검증·PR 진행. 아바타 보류 유지. 최신 main `f24310e`에서 독립 `codex/sdk-same-origin-policy`로 시작한다.

## 범위와 수용 기준

- 실제 제품 HTML에 SDK 실행 전 강제 CSP를 넣고, 자산·API는 동일 출처만 허용한다. 외부 계측·스크립트·이미지 요청을 차단한다. CSP 보고 전송은 만들지 않는다.
- production 추론 Worker는 문서 CSP를 상속하는 소유 Blob bootstrap으로 고정된 동일 출처 번들을 실행한다. 일반 URL Worker는 문서 CSP를 상속하지 않으므로 개발 서버의 Worker 응답에도 정책을 강제한다. Worker 종료/생성 실패 시 Blob URL을 회수하고 직접 URL로 우회하지 않는다.
- 모델·SDK·GPU/CPU fallback·판정·5초 응답/정리 한계는 바꾸지 않는다. 개발 HMR의 inline bootstrap만 개발 정책에서 허용한다. production에는 inline script 허용을 넣지 않는다.
- 실제 Chromium에서 강제 정책 아래 main/Worker 각각 신체·얼굴·손 SDK의 준비·합성 빈 프레임 추론·종료를 확인한다. 별도 loopback 수신기와 정책 없는 대조군으로 통신 시험이 실제 요청을 관찰할 수 있는지 확인한다. 테스트 라우트 차단이나 시험 전용 CSP로 제품 차단을 대신하지 않는다.
- 기존 Worker 소유권/응답 기한 시험, 새 bootstrap 실패·해제 시험, 전체 frontend unit·타입·정적 검사·직접 production build·고지/비공개 경계를 실행한다. 실제 웹의 동일 출처 요청 및 로그인 진입을 확인한다.

## 제외·위험·복구

비용 0원, 외부 계정/시크릿/운영 DB/배포/출시 없음. 새 아바타·카메라/사람 촬영·외형·임상 판정 검증은 하지 않는다. 공개 적격 동작 0개를 유지한다. 정책 호환성 위험은 실제 SDK/웹 회귀로 점검하며 실패 시 후보를 채택하지 않는다. 기존 에셋·증거·실패를 보존한다. 롤백은 이 목적의 Git 변경을 되돌리는 것, 운영 실행은 별도 승인이다.

일반 Worker의 정책 분리와 Blob의 상속은 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#content_security_policy), 번들 URL은 [Vite 공식 문서](https://vite.dev/guide/features.html#web-workers)를 따른다. SDK 내부 비공개 속성/전송 함수를 수정하지 않는다.

## 결과

로컬 구현·필수 검증·작성자 범위 리뷰 통과. [작동 흐름·실패·검증 경계와 source hash](../review/sdk-network-policy/README.md). 실제 강제 정책 아래 main/Worker 3SDK·프레임/종료·외부 수신 차단, 개발 정책/HMR, 별도 실제 HTTP/SQL 인증 복귀를 확인했다. 전체frontend1648·타입/범위 정적·production 고지/비공개 경계·diff 통과. 테스트 선택·초기 하네스/설정 실패는 보존했다. 이 Story 통과만으로 Draft36 전체, SDK의 임상 정확도·시작 지연 P2, 단계1~6/출시 후보판을 완료 처리하지 않는다. 조건부 PR 게이트를 진행한다.
