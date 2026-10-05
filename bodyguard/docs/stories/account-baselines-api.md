---
story: S4.13
status: in-progress
baseline: e4265f5f58646e9774d5957e419e1ef80bdc58bf
branch: codex/account-baselines
---

# S4.13 — 계정별 기준선 저장·교체·과거 조회

Status: in-progress

## Story

로그인한 사용자로서 재보정한 기준선을 본인 계정에 저장하고 이전 기준선도 조회하고 싶다. 이후 측정과 과거 기록 해석이 서로 다른 기준선·계정·계산 방법을 섞지 않아야 한다.

근거: [PRD](../prd.md) FR-M-03/FR-R-01/06/FR-U-04/05/NFR-07/08, [설계](../design.md) §10–12, [개인 기준선 ADR](../adr/0005-personal-baseline.md), [직전 집계](minute-aggregation.md). 이번 결과는 **client-reported 기준선 API**이며 실제 3초 보정·정자세/지표 정확성·의학 효과의 검증이 아니다. 서버는 판정하지 않는다.

## 고정 계약 / 수용 기준

- B01: `GET /api/v1/baselines/active`는 본인 현재 기준선 또는200 null이다. 미보정 값을 만들거나 GET으로 기준선 행을 쓰지 않는다. `GET /api/v1/baselines/{id}`는 본인 과거/현재 값만 반환하고 타인·없는 ID는 동일404다. 응답에 계정ID·이메일이 없다.
- B02: POST body는 정확히 `id, client_version, neck, shoulder, trunk`. id는 UUID(version1–8/variant89ab), 소문자 canonical 저장/반환. 지표는 `{method, unit, value}`, shoulder 필수, neck/trunk는 null 허용이다. method/unit/version은 기존 집계와 같은 ASCII `[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}`. 숫자는 유한 ±9007199254740991 범위, bool/문자/추가 필드/원시 좌표·샘플 목록 거부. 이는 자료형의 기술 한계이지 임계값이나 계산법의 채택이 아니다.
- B03: 최초 저장201, 같은 본인ID/내용 재전송200·동일 created_at, 내용 충돌409·기존 활성/내용 보존. 신규ID는 기존 것을 비활성화하고 새 것을 활성화하는 원자적 transaction이다. 과거ID 재전송은 과거 응답만 반환하고 **재활성화하지 않는다**. 동시 신규/재시도에도 본인 활성은 최대1개, 과거 내용은 불변이다. 새 미처리 요청의 처리 순서는 서버 잠금 획득 순서이며 카메라 캡처 시각을 추측하지 않는다.
- B04: 소유자는 인증 쿠키만 결정한다. GET/POST 모두 기존 세션·자격증명 버전, POST Origin/CSRF 검사. 잠금 대기 중 idle/absolute 만료·credentials 변경을 다시 검사한 뒤에만 활동 갱신/저장한다. 다른 세션/다른 계정 proof는 권위가 아니다. no-store/고정 오류·값 로그 금지를 유지한다.
- B05: owner advisory transaction lock, user KEY SHARE, 마지막 인증 재확인으로 교체와 reset/탈퇴를 직렬화한다. 대기2초 제한에서 실패하면503·전체 rollback. 기존 탈퇴 NOWAIT 충돌 뒤 재시도/owner cascade·타인 보존을 실제 SQL로 확인한다. 기존 인증 API의 기본 동작은 바꾸지 않는다.
- B06: 새0007_account_baselines만 추가한다. `(user_id,id)` PK, owner FK CASCADE, 부분 unique 활성1개, token/UUID/finite/null triplet CHECK. saved-row downgrade는 첫 ACCESS EXCLUSIVE 잠금 뒤 검사하여 데이터 손실 전에 거부; 빈 테스트 DB에서만 downgrade/upgrade 검증한다. 운영 migration/rollback은 **실행하지 않는다**.
- B07: 실제 FastAPI OpenAPI에서 타입을 재생성한다. readiness는 새head/열을 검사한다. 소유한 native PostgreSQL backup/restore에서 실제 API 저장한 현재·과거 기준선과 ownership/제약/활성 인덱스를 보존한다. 기존 삭제·logout·옛 비밀번호 replay 위험은 그대로 실패/미충족으로 남긴다. 운영 restore 승인이 아니다.
- B08: 실제 PostgreSQL/ASGI·합성 계정/메일/clock을 구분하고 실패 원본을 보존한다. 전체 backend·frontend 타입/정적/build/공개 웹 회귀와 scoped diff/review/main 게이트를 통과한 결과만 병합한다. UI·카메라/SDK·classifier·아바타·공개 producer·법무/배포는 변경하지 않는다. 화이트·블루 웹 디자인과 단계2 이월/전체1–6 미완료를 유지한다.

## Tasks / Subtasks

- [x] Story 계약·독립 읽기 전용 검토 및 최초 실제 API red (B01–08)
- [x] strict DTO·owner API·원자적 교체/멱등·DB/migration/readiness (B01–06)
- [x] 실제 SQL/인증 경쟁·rollback·migration 하네스 (B03–06)
- [x] native owned backup·타입 재생성·전체 회귀 (B07–08)
- [ ] diff/리뷰 보완·최신 main·PR 조건부 게이트와 증거 보존 (B08)

## Dev Notes

독립 검토에서 FK 대기 뒤 reset의 옛 자격증명 통과 가능성과 downgrade EXISTS→DROP 경합을 발견했으므로 위 KEY SHARE 재검증/ACCESS EXCLUSIVE를 명세에 포함한다. 마지막 재확인 전 last_seen을 갱신하지 않는다. 기존 기록/설정 경로에는 기본 갱신 동작을 유지한다. future summaries의 baseline 참조는 `(user_id, baseline_id)` composite FK로 연결해야 한다(후속 Story).

잠금 선택은 [PostgreSQL18 공식 잠금 문서](https://www.postgresql.org/docs/18/explicit-locking.html)의 transaction advisory/KEY SHARE 호환성과 [SQLAlchemy PostgreSQL 문서](https://docs.sqlalchemy.org/en/21/dialects/postgresql.html)의 부분 인덱스에 근거한다. strict/finite 검증은 [Pydantic 공식 자료형 문서](https://pydantic.dev/docs/validation/latest/api/pydantic/standard_library_types/)를 확인하고 실제 고정 버전에서 bool/string/비유한 경계를 테스트한다. 의존성 버전 변경은0이다.

BMAD create/dev Story skill·template/checklist를 적용한다. 저장소 `_bmad` resolver/config/override·sprint status가 없어서 resolver 시도는 missing-file 실패이며 자동 설치나 성공 주장 없이 기존 저장소 운영 규칙/문서에 매핑한다. 커밋·PR/조건부 병합은 기존 사전 승인, 운영/비용/시크릿/중요 safety/privacy 변경은 별도 승인이다.

## Dev Agent Record

### Debug Log References

- 준비 기준main e4265f5. 최초 red/실패·green 결과는 검증 후 기록한다.
- 최초 실제404 red→기준선36/경쟁8/독립 backup5·전체365 API 통과. 독립 OpenAPI200/404/409 P2는 실제 schema red 후 응답 모델·생성 타입에 반영했다. timeout·logout·DB 길이 경계를 추가했다.
- 보완 중 신규 test를 잘못된 함수 중간에 넣어 테스트 배치 NameError로1실패/368통과였다. 원본과 static 실패를 보존하고 위치를 수정했다. 실제 API 결함/의학 검증 실패로 바꾸어 주장하지 않는다. 수정 후 기준선/경쟁48건을 다시 통과했다.
- 독립 읽기 전용 최종 리뷰는 신규 P1/P2 없음. 독립 test 실행0이며 전체 회귀는 작성자가 실제 실행한다. 최종 결과와 SHA/화면은 [증거](../review/account-baselines/README.md)에 연결한다.
- 최종 작성자 실행은 전체369 API/실제 owned native 복구·frontend558·공개8·타입/정적/build 통과. source18/artifact36 SHA·수집기 재실행 동일성을 확인했다. main PR45의 알림 설정 웹은 후속 통합/회귀 대상이며 현재 공개 CSS/JS는 이전main과 동일하다.

### Completion Notes

- 기준선 API의 로컬 수용 기준은 통과했다. 최신 main 통합/PR 게이트는 진행 중이며 실제 보정·public 연결·전체1–6 완료를 뜻하지 않는다.

### File List

- backend/app/baselines.py, db.py, main.py, readiness.py; 새 migrations/versions/0007_account_baselines.py, backend/README.md
- backend/tests/test_baselines.py, test_baseline_races.py, backup_restore_proof.py, test_backup_restore_proof.py, test_readiness.py
- backend/tests/test_auth.py, test_google_auth.py, test_password_reset.py, test_records_integrity.py, test_account_withdrawal.py, test_notification_preferences.py: head 기대값만 갱신(필요한 formatter 포함), auth table 기대에 baselines 추가
- frontend/src/api/generated/index.ts, types.gen.ts: 실제 OpenAPI 재생성
- docs/stories/account-baselines-api.md, docs/review/account-baselines/: 원본 실패/실제 검증·PNG·SHA·수집기

## Change Log

- 2026-10-06: S4.13 명세·하네스 계약. 독립 검토의 인증 대기/rollback 보완 포함.
- 2026-10-06: 실제 기준선/인증 경쟁·rollback·native 복구 및 OpenAPI 보완. test 배치 실패 보존/48건 재검증. 전체 회귀/최신 main/PR 게이트 진행 중.
