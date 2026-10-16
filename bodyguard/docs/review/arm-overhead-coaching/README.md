# S3.C6 — 한 팔씩 올림·복귀 판정과 세션 연결

2026-10-17 · base main `25429c004305de0393935f0b0bd470ecb0e0fd97` · `codex/arm-overhead-coaching`.

## 작동하는 계약

생성 입력으로 양팔을 내린 시작→지정 팔 올림/유지→복귀→반대쪽을 기존 실제 세션/진행 엔진에 연결했다. 두 반복씩 할 때는 총 네 번의 복귀가 필요하다. 위팔 방향·팔꿈치 투영·얼굴 기준 손목 높이를 함께 보고, 반대 팔/양팔·머리/몸통 보상을 구분한다. 가림·화면 밖·visibility/제공된 presence·다인·오래됨/gap·다른 세대·원본/현재 시각 역행·재진입에는 이전 목표를 이어 적립하지 않는다.

기존 상체 관찰을 같은 프레임의 private point 사본으로 재사용했다. capture 종횡비·반전을 보존하며 반환은 image-plane 수치다. 실제3D 관절 각·견갑/어깨 안쪽 회전·허리 과신전·통증·편안함·앉아 있는지·개인 적합성을 측정한 것이 아니다. 검사 숫자는 fixture의 명시 수학 자극이고 임상 기본값이 아니다. 공개 적격0·원래 동작 안내/화면·SDK·원본/GLB/재질·리깅은 그대로다.

[North Bristol NHS 원문](https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries)의 Exercise5 앞부분을 재확인했다(editionApril2024, NBT002258, reviewApril2027). 바르게 앉아 한 팔씩 편안한 범위로 올리는 설명만 사용한다. 환자용 횟수·약물·통증 처방을 일반인 프로필로 옮기지 않았다. 기존 PRD의150도/10초 가설을 채택하지 않는다.

## 실제 검증과 한계

| 실행 | 결과 | 실제/대체 범위 |
|---|---|---|
| 새 판정·adapter 및 기존 목/어깨 회귀 `core-e` | 6파일111검사 통과, 이 중 새 overhead55검사 | 순수 기하·실제 session/engine/result, 자원/HTTP는 mock. 실제 사람·SDK·SQL 아님. |
| `test-overhead-candidate.mjs … runtime-c` | 15흐름·전후15소스 SHA 일치 | Vite SSR의 실제 모듈. 좌우 완료/복귀·반복·오류·가림/다인/gap·false gate·인증 취소·pause/새 세대, 제한 DTO의 모의HTTP. 브라우저·아바타·실제 카메라 시험 아님. |
| 최종 전체 `full-b` | 127파일2134검사 통과 | 기존 main 전체 회귀 포함. 최초 전체도 기록하고 리뷰 보완 후 다시 실행. |
| 최종 타입·원래 production build/고지·guard | 통과 | math 프로필·후보 classifier/feedback은 공개 번들에서 제외. |
| 최종 Biome·diff | 전체469파일 오류0/info16, `git diff --check` 통과 | 기존 스타일 info는 수정했다고 표시하지 않음. |

내보내는 요약은 기존8필드뿐이다: id·motion_id·protocol_version·started_at·ended_at·outcome·observed_ms·repetitions. 관절/영상/투영 수치·오류 상세·세대·계정 식별자를 저장 요청에 넣지 않는다. 모의HTTP 1회는 실제 저장/운동 정확도 증거가 아니다.

## 실패 보존·작성자 리뷰

1. 테스트 먼저 추가한 시점의 타입/모듈 누락 RED를 보존했다. `classifier-a`는 중립 팔의 손목 투영 기대를 잘못 계산해5실패/24통과였다. 생성 상완/전완은 각각80이고 시작 손목은140−160=−20이므로 얼굴260 대비−2.8 hip-width가 맞다. 프로필/제품 허용 범위를 바꾸지 않고 시험 기대를−2.4에서−2.8로 고쳤다.
2. 첫 SSR `runtime-a`는15개 기능 흐름을 통과했지만 Vite의 별도WebSocket 시도가EPERM으로 거절됐다. **환경까지 정상인 통과로 세지 않는다.** `ws:false`를 명시하고 HTTP listener 없음/WS 꺼짐을 assert했다. Vite 오류 로그를 기록하면 runner가 실패하도록 보완해 `runtime-b/c`는 환경 오류0·15흐름 통과했다. 제품 SDK 네트워크 정책 변경이 아니다.
3. code-review에서 같은 프레임이 채택된 직후 세션 callback이 종료하면 오류 표시를 반환할 수 있는 P2를 실제 RED(1실패/9통과)로 재현했다. 현재 상태가 ended/paused이면 오류를 비워 보완했고 종료·일시정지 두 경우와 기존 회귀를 재실행했다. 현재 Story의 이 P2는 해결됐으며 **기존 PR163/150/152의 별도 P2 해결이 아니다.**
4. 두 복합 patch의 문맥 불일치는 전체 거절됐고 원문은 터미널에만 남았다. 이후 적용 diff/테스트만 제품 증거로 센다. 초기 unit의 모든 중간 소스 사본은 없고 실패 로그를 보존한다. runtime-a의 runner와 리뷰 보완 전 adapter는 당시 before SHA와 일치하는 압축 사본을 보존하며 최종 runtime-c와 구분한다.

testing-strategy 기준의 단위/실제 세션 계약/원래 전체 회귀를 구분했다. code-review로 profile 복사·상대 float 분리, private getter/reentry·시각/세대, 현재 motion/version/좌우 단계, 원시 입력/HTTP 경계·공개 제외와 terminal 피드백을 작성자 검토했다. 독립 리뷰/임상 승인/모든 단계 통과라고 주장하지 않는다.

## 다음 의존성

별도 PR163은 종료 P2 미해결 Draft로 유지한다. 이 Story는 거기에 의존하지 않는 순수 판정/세션 계약만 main에 제안한다. 다음은 좌우 실제 남녀 아바타·같은 프레임 오류 표면·단계 시범과 실행 화면 통합이다. 임상 프로필·개인별 추천·최종 외형/성능·실제 참여자 이월·운영/외부 별도 승인 및 전체1~4/1~6 완료 기준을 유지한다. 실제 사람/물리 웹캠·SDK·브라우저·GLB·SQL·메일/OAuth·Docker/HTTPS·배포/출시는 이번에 미실행이다.
