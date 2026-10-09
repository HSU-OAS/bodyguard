# 최초 수용 시험 — 실패 보존

baseline `0cdacb03972c16ac7b3ddcd914172d444141dfa1`의 기존 제품 컴포넌트에 MC-01/02 하네스만 추가한 뒤 실행했다. 2026-10-09 20:15 KST, Vitest 5.0.2/happy-dom.

```text
node node_modules/vitest/vitest.mjs run src/pages/MemberPage.test.tsx src/pages/PasswordPage.test.tsx
Test Files 2 failed (2)
Tests 4 failed | 19 passed (23)
MC-01: expected 139 to be less than or equal to 110
MC-02 forgot / reset+fragment / reset without fragment:
account-form text did not contain "변경하면 기존 로그인은 모두 종료됩니다."
```

기존 19개는 통과했으며 새 4개는 실패했다. 문구 예산은 계정 섹션 설명만 공백 제외로 센 것이다. 보안 안내는 기존 숨겨지는 aside에만 있어 이 실패가 발생했다. 실제 브라우저 검증·메일 전달·SQL 검증으로 세지 않는다.

첫 원본 production Chrome 실행은 12개 화면과 4개 UI 흐름까지 진행한 뒤 하네스의 요청 도착 대기 부족으로 실패했다. 입력 상태의 “처리 중” 표시는 CSRF 요청 뒤의 실제 POST보다 먼저 나타날 수 있다. 이를 요청 도착을 기다린 뒤 검사하도록 고쳤으며 첫 실패 JSON/PNG는 원래 경로에 보존했다. 제품 실패나 완료된 브라우저 검증으로 세지 않는다.

원본 build 비교 중 새 단위 시험의 지역 이름이 Tailwind 자동 검색에 잡혀 불필요한 CSS272바이트가 추가되는 것도 발견했다. 지역 이름을 바꾸어 기존 CSS와 동일한 출력인지 다시 확인한다. 사용자 스타일 변경으로 승인하지 않는다.

두 번째 원본 실행은 14개 PNG와 복구 흐름을 만든 뒤 로그아웃으로 이동한 로그인 화면의 구글 준비 상태 endpoint를 하네스에 등록하지 않아 실패했다. 실제 외부 구글은 연결하지 않으며 기존 계약의 `configured:false` 합성 응답을 추가했다. 예상하지 않은 API도 예외를 밖으로 던지지 않고 실패 보고/503 처리하여 검증 자원 정리를 보장한다. 이전 실행 파일은 그대로 보존한다.

세 번째 원본 실행도 14개 PNG·6개 흐름 뒤 로그인 화면 제목을 “로그인”이라고 잘못 가정한 matcher 때문에 실패했다. 실제 기존 제목 “다시 만나 반갑습니다”로 고쳤다. 제품 제목/버튼은 변경하지 않았다. 하네스 문제를 제품 수정으로 세지 않는다.
