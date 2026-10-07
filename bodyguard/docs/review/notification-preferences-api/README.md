# 내 알림 설정 API 검증

기존 FR-N-03의 시간·켜기/끄기·소리 설정을 계정별로 저장한다. GET/POST `/api/v1/settings/notifications`는 본인의 5필드 설정만 반환하고, ID·이메일·영상·좌표·판정 민감도를 받지 않는다. 최초 GET은 기본 설정을 반환하되 설정 행을 쓰지 않는다. API에 연결할 웹 화면과 실제 알림은 후속 작업이다.

## 실제/합성 구분

새 전용 PostgreSQL 18·HTTP·세션/CSRF·제약·migration/rollback 시험이다. clock·메일은 합성이고 SMTP·실제 카메라·사람의 자세·SDK·운영 HTTPS/DB 검증이 아니다. 서로 다른 계정, 같은 계정의 두 세션, 잘못된 cookie-bound proof/Origin, 만료·credentials-version·로그아웃, 잘못된 입력 보존을 확인한다.

설정 전체를 한 번에 검증·upsert하므로 자동 부분 수정이나 누락 값 초기화가 없다. 1~1440분은 기술 상한으로만 사용하며 의학 권장 간격이 아니다. 브라우저 알림 권한·소리·카메라/판정을 실행하지 않는다. NFR-07의 기존 저장 허용 범위인 설정 외에 새 신체 데이터를 추가하지 않는다.

## 실패 보존/리뷰

구현 전 실제 27건은 미구현 404 등의 계약 불일치로 실패했다. collection-only red가 아니다. 이후 초기 27건 및 추가 CSRF/동일 계정 두 세션·실제 DB 제약·downgrade/rollback 30건을 통과했다. 다른 계정 보존까지 포함한 최종 전체 API321건은153.28초에 통과했다(기존 asyncio deprecation 경고1). 프런트503건·타입/정적/build/차단 guard·Ruff/mypy·생성 타입2회 SHA 비교도 통과했다. artifact14/source16 SHA와 수집기 동일 재실행2회를 확인했다.

작성자 engineering:code-review의 보안/정확성/성능/유지보수 검토: 기존 잠긴 세션과 CSRF 보호, 본인 PK만 upsert, 5필드 allowlist/strict 타입, FK cascade, 저장 실패의 transaction rollback, 단일 행 조회·갱신을 확인했다. 새 table이 있으므로 readiness와 기존 migration/복구 시험의 기대 head만 함께 갱신했다. native backup 시험에는 실제 합성 설정 한 행을 넣어 복구 뒤 정확한 값을 비교한다. 기존 위험 관찰·운영 승인 경계를 지우지 않았다.

새 migration은 저장된 설정이 있으면 downgrade를 거부한다. 운영 실행 전 별도 승인·백업·복구·코드/DB 버전 순서 확인이 필요하다. 이번 PR은 migration 파일/전용 로컬 시험만 포함하고 운영 migration이나 배포를 하지 않는다.

## 화면·남은 일

화이트·블루 기존 웹의 디자인/라우트는 변경하지 않는다. 이번 작업으로 설정 화면이 작동하거나 알림이 사용자에게 발송됐다고 주장하지 않는다. 이어서 승인 범위 안의 웹 설정 화면을 구현하고, 실측·관찰 정책을 확정한 후 scheduler/코칭과 연결한다. SDK 개인정보·2단계 아바타 이월·참여자·외부/운영/법무·1분 요약/리포트/전체1~6단계 게이트는 여전히 남아 있다.

[Story](../../stories/stage4-notification-preferences-api.md) · [실제 소스/결과 SHA 수집기](collect-proof.mjs)

최신 main PR41 통합 후 실제 frontend523건(19.81초)·타입/Biome120파일/build/production guard를 다시 통과했다. API source16 SHA가 앞선 실제321건 검증과 같음을 확인했다. 기존503건/manifest는 보존하고 통합 artifact19/source16은 artifacts-v2.json으로 별도 수집했다. 원본을 덮어쓰거나 다른 Story의 작업을 이 PR에 섞지 않았다.
