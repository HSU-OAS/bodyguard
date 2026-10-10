# S4.22 — 웹 진입·없는 주소의 페이지 식별

시작 main `dd6bde6ba83ccf00e754ceae87ce9ae2fde0ec76` · `codex/web-page-navigation-titles` · release-plan4·6/FR-V-02·FR-U-04

## 범위·확인한 문제

공개 서비스 소개와 존재하지 않는 주소의 화면은 이미 다르게 렌더되지만 브라우저 탭 제목이 모두 `자세 코칭 · BODYGUARD`다. 짧고 정확한 제목으로 현재 화면을 식별하고 없는 주소에서 서비스 소개로 돌아가는 기존 동작을 유지한다.

초기 코드 탐색에서는 기록·설정·탈퇴도 fallback 제목이라고 추정했다. 실제 Shell의 조기 return과 각 화면의 자체 제목/초점 처리, 기존 시험을 읽어 그 추정을 철회했다. 이 화면들은 수정하지 않는다. 계정 연결·요청 소유권·개인 정보/ID 비노출·화이트/블루의 기존 화면/문구/메뉴는 유지한다. frontend-design의 기존 어휘/상태 식별 원칙만 적용하고 새 디자인/화면 구성을 추가하지 않는다.

아바타/Blender/GLB·코칭 공개/판정·SDK 정책·dependency/lock·API/DB/CI·운영/배포·사업 결정은 범위 밖이다. 기존 전체1~6단계 기준과 별도 승인 경계를 유지한다.

## 수용 기준·하네스

1. 실제 App에서 `/`는 `서비스 소개 · BODYGUARD`, 미등록 주소는 `페이지를 찾을 수 없습니다 · BODYGUARD`가 된다. 원래 h1·계정 진입·복귀 버튼과 화면 본문은 변하지 않는다.
2. 없는 주소→기존 서비스 소개 링크→계정 로그인 진입의 라우트/제목/본문 흐름을 제어된 DOM·실제 Chrome에서 대조한다. 네트워크 계정 응답은 모의이며 실제 가입/공급자/DB 검증으로 세지 않는다.
3. 개인 화면의 조기 return/자체 title/focus, 복구 fragment·쿼리·인증 경계는 바꾸지 않는다. 타 사용자·동작·이메일/ID를 제목에 넣지 않는다. unknown 입력 문자열도 그대로 반사하지 않는다.
4. 먼저 원래 제목의 실패를 보존하고 수정 후 같은 assertion을 통과시킨다. DOM 관련 회귀·타입/정적 검사·production build/개발 코드 제외·diff 및 PR 게이트를 실행한다. 아바타/실제 촬영·전체 API/SQL·Docker/HTTPS는 미실행으로 명시한다.

같은 페이지 식별 계약에서 Router가 허용하는 대소문자/trailing slash와 실제 없는 유사 prefix를 대조한다. Shell의 metadata/메뉴 판별에만 Router와 맞추고 실제 URL/query/fragment를 쓰거나 개인 화면의 자체 title/focus 정책을 바꾸지 않는다. 내 시작의 현재 메뉴 표시, 이미 제공하던 기록/계정/안내 메뉴의 정확한 현재 페이지를 유지한다. 기존 reset 화면의 fragment/query 제거·canonical replace 동작은 그대로다.

debug의 재현→범위 분리→원인→최소 보완과 code-review의 보안/정확성/성능/유지보수 검토를 적용한다. 작은 title 보완은 현재 코칭 완성이나 전체 접근성/4·6단계 통과가 아니다.

## 결과

기존 제목의 DOM2개 실패·Chrome4개 불일치를 확인하고 소개/없는 페이지 식별·Router case/slash·정확한 현재 메뉴를 보완했다. 기존 소개 복귀→로그인 Chrome 흐름과 그 body6개는 유지됐다. 최종 Chrome10개·전체frontend1600·타입/범위 Biome·새 Vite production build/개발 제외를 통과했다. 첫 새 reset assertion1개·잘못된 TypeScript 시험 옵션 실패를 보존하고 기존 복구 코드/정책을 바꾸지 않은 채 하네스를 수정했다. [실제 증거·작성자 리뷰·미실행·한계](../review/web-page-navigation-titles/README.md). PR 최신 게이트는 다음이며 모든 출시 기준은 미완료를 유지한다.
