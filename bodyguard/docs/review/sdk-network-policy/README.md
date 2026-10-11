# SDK 동일 출처 통신 경계 — 실제 로컬 검증

2026-10-11 CEO의 직접 승인으로 구현했다. 실제 제품 HTML에 SDK 실행 전 강제 CSP를 주입하며 production Worker는 그 CSP를 상속하는 소유 Blob에서 고정된 동일 출처 번들을 읽는다. 개발 Worker 응답에도 강제 정책을 붙인다. SDK 내부 코드를 바꾸거나 외부 계측을 허용하는 fallback은 없다.

[실행 결과·원본 hash·source hash](report.json). 원본 브라우저 JSON/계정 시험과 화면은 `/private/tmp/bodyguard-sdk-policy.YdLPiv`에 보존했다. 원본 영상·관절 좌표·계정/토큰·외부 전송 본문은 이 저장소 증거에 없다.

## 실제 작동한 흐름

- 정책 없는 대조군의 페이지/Worker 요청은 별도 로컬 출처 수신기에 2건 도착했다. 제품과 byte 동일한 CSP 아래서는 두 요청 모두 거부되고 수신 0건이었다. 응답 CSP나 Playwright 라우트 차단으로 이 결과를 대신하지 않았다.
- 실제 Chromium 154의 main/Worker 각각 신체·얼굴·손 SDK 준비 → 빈 합성 프레임 3개 추론 → 결과/프레임·SDK 정리 → Worker 종료를 통과했다. 같은 프레임을 겹쳐 맡기지 않는 경계도 유지했다. 신체 촬영·정확도·노트북 성능 또는 최종 아바타 검증이 아니다.
- 제품 웹 → 로그인 진입과 동일 출처 fetch가 동작했다. 이 네트워크 하네스의 익명 응답은 제어 fixture다. **별도로** 실제 FastAPI·새 소유 PostgreSQL18·실제 production Chrome의 가입/인증→원래 기록 기간, 로그인→계정, 외부/중복 next 거부 3건을 통과했다. 메일은 합성이고 Gmail/Google 검증이 아니다.
- 실제 Vite 개발 문서 정책·Worker 응답 헤더·HMR 연결을 확인했다. 이 시험은 개발 native SDK 추론을 실행한 증거는 아니다. API가 없었던 개발 smoke의 proxy connection-refused를 인증 통과로 세지 않는다.
- 전체 frontend 81파일/1648건, 타입, 변경 범위 Biome, 원래 제품 고지 게이트가 있는 production build, 기존 비공개 경계 검사, diff를 통과했다. guard 입력 폴더만 소유 출력으로 바꿔 원래 검사를 실행했다. 전체 backend/SQL suite·외부 공급자·Docker/HTTPS/배포는 미실행이다.

## 실패 보존과 리뷰

초기 구현 전 import-absence RED, private SDK fixture의 CSS 누락/고지 입력 필드 실패, HTML entity를 해석하지 않은 사전 assertion 실패, PostgreSQL 빈 host 인용 실패, `^RETURN`의 0건 선택과 list-only mailbox 경로 거부를 도구 원문에 보존했다. source 결함을 고친 뒤 필수 조건을 다시 실행했으며 별도 로그 파일이 있다고 주장하지 않는다. 제품 build 고지 검사를 끄지 않았다. private SDK fixture만 제품 배포 고지 게이트의 대상으로 삼지 않으며 fixture 산출물은 배포하지 않는다.

첫 브라우저는 5개 기능 case를 통과했지만 전체 Chrome 프로세스 프록시 횟수 assertion이 실패했다. [실패 원문](report.json)의 initialFailed를 보존했다. 페이지/Worker 요청 관찰 0, SDK의 설치된 계측 endpoint 프록시 시도 0, 실제 수신기 0을 별도 확인했다. SDK가 아닌 프로세스 수준 시도는 전부 거부 프록시에서 차단하고 전체 횟수를 숨기지 않았다. 정상 실행으로 이 첫 실패를 삭제하거나 “아무 외부 시도도 없음”이라고 바꾸지 않는다.

code-review 스킬의 작성자 범위 리뷰로 Worker CSP 상속·고정 URL·생성 실패의 회수/우회 금지·종료 실패의 회수·응답 한계/세대 소유권 유지·development/production 분리·보고 endpoint 없음·인증 회귀·비공개 bundle 경계를 점검했다. 별도 독립 리뷰/전문가 승인으로 표시하지 않는다. 현재 Story 범위 미해결 P1/P2 없음; 조건부 PR 게이트를 적용한다.

전용 SQL의 실제 data_directory를 확인해 `/private/tmp/bodyguard-auth-test.7oWcWm/data`만 정상 종료했고 API8000/preview4173 listener가 없음을 확인했다. 파일/기존 증거는 삭제하지 않았다. 아바타 보류·출시 동작0·실측/시작 지연P2·참여자/운영/권리·1~6 완료 기준은 유지한다. Draft36 전체 정합·병합 및 코칭 화면은 후속 목적이며 이번 PR로 완료 처리하지 않는다.
