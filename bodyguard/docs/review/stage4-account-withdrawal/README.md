# S4.5 계정 탈퇴 API — 실제 실행 증거

실제 FastAPI·소유한 격리 PostgreSQL18.6을 사용했다. 회원/수행 요약은 합성이며 이메일은 test-only outbox와 SMTP message capture다. 실제 SMTP 도착·Google 공급자·실제 사용자·카메라·운영 적용·탈퇴 Chrome 화면은 이 API Story에서 검증하지 않았다. 필수 로컬 검증을 마쳤으며 PR 게이트는 별도로 진행한다.

## 작동하는 API 흐름

본인 로그인→탈퇴 전용 이메일 확인 요청→명시 확인·코드 제출→계정/수행 기록/본인 세션/복구/연결된 Google 흐름/proof를 transaction 삭제→204·쿠키 제거다. 요청만 발급하거나 오입력/타 세션/타 계정/만료/잘못된 Origin·CSRF이면 삭제하지 않는다. 발송 실패는503·기존 확인 폐기이며, DELETE 뒤 합성 오류를 주입했을 때에도 모든 기존 자료가 rollback되었다.

실제 SQL에서 기록 INSERT·비밀번호 UPDATE·만료 세션 DELETE·가입 확인 FOR UPDATE·동시 확인·동시 로그인·quota 삭제/재생성이 겹치는 조건을 만들었다. 잠금 충돌은503/삭제0, 진행 가능한 순서는204와 다른 요청의 인증 실패이며 삭제한 계정은 인증되지 않는다. 다른 사용자·공유 IP 제한은 보존한다. 삭제 이후 사용자가 새 가입 절차를 다시 마치면 새UUID/빈 기록이다. 익명 보안 요청이 이후 새로 만드는 quota까지 영구 금지하거나 이메일 tombstone을 보존하는 기능은 추가하지 않는다.

## 보존한 원본 실행

| 파일 | 실제 결과 | 해석 |
|---|---|---|
| [최초 main red](backend-first-after-design.xml) |3실패/404| 미구현 API. 완료 증거 아님 |
| [sandbox 오류](backend-core-sandbox-error.xml) |3오류| Unix socket 연결 권한. 기능 실패/통과와 구분 |
| [기본 흐름](backend-core.xml) |3통과| 실제 삭제/오입력/추가 이메일 거부 |
| [첫 확장](backend-expanded.xml) |26통과/1실패| 비시험 서버 실제 시계와 fixture 차이 |
| [첫 경쟁](backend-with-races.xml) |33통과/1실패| 만료 세션이 시험 전 cleanup되어 경쟁 조건 누락 |
| [첫 전체 회귀](backend-regression.xml) |238통과/1실패| 새 테이블 기대값 누락 |
| [첫 최종 회귀](backend-regression-final.xml) |240통과/1실패| 동시 로그인의 미커밋 quota 순서 오기대 |
| [실제 경쟁 보완](backend-races-verified.xml) |10통과| 두 로그인 순서·실제 잠금·동시 오입력 포함 |
| [웹 DOM 최종](frontend-final.xml) |279통과| Vitest 단일 worker 실행. 실제 카메라/SMTP/탈퇴 Chrome 아님 |
| [최종 전체 SQL 회귀](backend-regression-verified.xml) |242통과/58.28초| 기존205+신규37, 실패/오류/skip0 |

모든 실패 원본을 보존했다. 최종 전체 SQL에는 asyncio deprecation 경고1건이 있으며 제품 오류로 숨기거나 별도 검증 통과로 세지 않는다. 병합 기록은 PR에 남긴다.

실패 traceback의 trailing whitespace 때문에 staged diff 검사에서 실패했다. 읽기용 XML의 줄 끝 공백만 기계적으로 정리했으며 **변경 전 전체 원본 바이트**는 각 .xml.original.gz에 보존했다. 압축 복원 바이트 일치와 아래 SHA-256을 확인했으며 결과·traceback 내용·실패 수를 바꾸거나 원본을 삭제하지 않았다.

| 복원 가능한 원본 | 변경 전 SHA-256 |
|---|---|
| [backend-first-after-design.xml](backend-first-after-design.xml.original.gz) | `3eb26409919d2748d31605b37d74cba50669f4a3a259e05af73c65116ddc4880` |
| [backend-core-sandbox-error.xml](backend-core-sandbox-error.xml.original.gz) | `0d26145948619ae55579dfd4642f2e31530fc2ecb9abd0c3cc95686ac7ce1e7a` |
| [backend-expanded.xml](backend-expanded.xml.original.gz) | `05aa2488ed6e4f2d7534bb36e6d9f523594196f8e78f69698c8e72cab2efbcc4` |
| [backend-with-races.xml](backend-with-races.xml.original.gz) | `5aa71fb7e9caee6f4208179a85821a2dfbfabedde96a75c27687275c5d7314b7` |
| [backend-regression.xml](backend-regression.xml.original.gz) | `2c64d5aa64f2631062885ab4a7a87917057637894d8dde41eba5665ca37a0018` |
| [backend-regression-final.xml](backend-regression-final.xml.original.gz) | `5138ca37e33bcda68e8136851d08bd81de390bdcc520133172df791983f3a428` |

## 정적·생성·production 검증

Ruff 전체25파일·mypy app7파일, Biome79파일·TypeScript, 실제 FastAPI OpenAPI 타입 생성, production Vite 빌드가 통과했다. 반복 타입 생성의 SHA-256 동일성을 실제 확인했다. JS302.11kB(gzip93.85), CSS24.98kB(gzip6.26). 미연결 코칭 엔진/개발 동작 카탈로그 문자열은 production 검사0이다. 기존 모델5개는 검증한 로컬 캐시를 복사했으며 아바타 원본/GLB는 수정하지 않았다.

## 범위별 자체 리뷰

`engineering:code-review`의 보안·성능·정확성·유지보수 관점으로 작성자가 직접 재검토했다. 독립 리뷰어나 전문가 검토가 아니다. 인증/CSRF→형식 검사→계정·세션·버전→전용 코드→transaction 삭제 순서를 확인했다. 위험한 역순 잠금은 NOWAIT/한정 대기·실제 경합 실패 rollback으로 보완했고 quota의 snapshot 소실은 bounded 재생성으로 보완했다. cascade 소유권 조회 인덱스를 새 migration에 포함하고 실제 upgrade/rollback 보존을 검사했다. 공유 IP 제한·타 사용자·이전 migration·운영 설정·시크릿·CI·카메라/판정 경계를 변경하지 않았다.

최종 전체 회귀와 최신 PR diff/HEAD/main/CLEAN/checks를 확인한 뒤에만 병합 게이트를 통과시킨다. 전체4단계와1~6단계·출시 후보판은 여전히 미완료다. 후속 작업은 같은 화이트·블루 웹 디자인의 본인 계정 화면/탈퇴 UX이며 외부 연결·실측·새 자료 삭제 통합은 기존 필수 게이트로 남는다.

최종 실제 diff·로컬 검증 기준에서 범위 내 미해결P1/P2는 없다. GitHub 체크 상태/최신 HEAD/main/충돌 확인은 병합 직전 실제로 다시 읽고 PR에 기록한다. 운영 DB migration·배포·출시를 하지 않는다.
