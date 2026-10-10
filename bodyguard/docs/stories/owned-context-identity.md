# S4.21 — 기록·설정 요청의 원래 계정 ID 고정

2026-10-10 · 시작 main `0b440af763e8247680caa2c1335036cf7497d0e5` · `codex/owned-context-identity` · 실행 전 계약.

FR-U-04·FR-R-03/06·FR-N-03·NFR-08. 기록 조회/삭제와 알림 설정의 기존 준비된 context가 원래 ready 객체뿐 아니라 **준비 시점의 계정 ID**를 유지하도록 보완한다. 대시보드/소유 업로드에는 이미 있는 방어다. 새 계정/권한/저장·통신·개인정보 정책이 아니라 기존 본인 소유 경계의 기술적 정합성 보완이다.

## 수용 기준

1. ready 객체를 교체하지 않고 그 안의 ID가 달라지는 caller 결함을 결정적 모의 fetch로 먼저 재현한다. 준비의 CSRF 대기/결과 JSON, 준비 후 list/preview/remove 또는 settings save 직전/응답 중 변화를 시험한다. 정상 브라우저에서 계정 ID가 저절로 변한다거나 서버 CSRF를 우회하는 실제 취약점이라고 주장하지 않는다.
2. 준비 시작의 ID를 primitive로 고정하고 check·서버 /me 대조·기록 X-Account-ID에 같은 값을 사용한다. ID 불일치 시 context/proof를 닫고401로 거부한다. 아직 시작하지 않은 기록/설정 요청0, 대기 결과 성공 반환0이며 기존 single-flight/원래 CSRF/시간·삭제/DTO·계정 교체 의미는 유지한다.
3. 정상 기존 기록/삭제·설정 조회/수정 UI는 그대로다. related mock/전체frontend·tsc/Biome·production build/private guard·실제 Chrome/localhost API/전용 새 SQL의 summaries와 notifications suite를 검증한다. 합성 계정/메일/요약·제어 오류를 실제 사용자/외부 공급자/코칭으로 세지 않는다. 새 SDK/3D/아바타 시험0이다.
4. RED 원본/입력, 수정·실제 결과·소스 SHA와 공개 CSS/제품 UI 소스 불변을 보존한다. JS는 의도한 계정 guard 변경으로 달라질 수 있다. scoped 작성자 리뷰·최신 main/diff/HEAD/CLEAN/체크와 미해결 P1/P2 없음 뒤 단일 목적 PR/조건부 merge commit·브랜치 유지.

추가 코드 검토에서 설정 GET은 요청 순간의 소유자 binding 없이 전후 /me만 사용함을 확인했다. A의 준비/최종 확인 사이에 GET만 B 쿠키로 전송되는 제어 조건도 같은 소유 임대 목적에 포함한다. 실제 API/Chrome RED부터 보존하고, 기존 기록의 optional read-binding 함수를 설정 GET에 재사용한다. 웹은 원래 proof/owner를 보내며 header 없는 기존 API 호출·cookie/Origin/HMAC·저장/기본값/schema 정책은 유지한다. 새 헤더의 실제 OpenAPI 타입 생성·전체 backend/정적 검증도 필수다. 이것은 개인정보 수집/보관/외부 전송이나 계정 선택 권한 변경이 아니다.

이미 반환된 데이터 복사본의 강제 소거나 모든 caller 객체를 전역 freeze하는 변경은 아니다. AuthProvider/UI/저장 schema/생산자/임상/SDK 정책·운영 변경0, 아바타 보류·실측/동작0·미승인 UI/SDK·시작P2·외부/법무/운영·전체1~6 미완료는 유지한다. 중요한 범위/안전/개인정보 변경·비용/계정/시크릿/운영 DB migration/배포/출시는 별도 승인이다.

## 실제 완료 증거

[실제 화면·실패 원본·코드 리뷰·재검증](../review/owned-context-identity/README.md). 수정 전 모의9/실제 API1/실제 Chrome1 실패, 수정 후 전체frontend1577·backend537·실제 기존 설정5/기록4·API 생성/정적/build/private guard를 통과했다. 카메라/3D/새 공개 UI/운영 실행0이다. 이 Story 범위의 수용 기준은 충족했으며 최신 remote PR의 조건부 병합 게이트를 진행한다. 전체 단계 완료는 아니다.
