# S3.C6 — 한 팔씩 위로 뻗기의 관찰·판정·세션 계약

2026-10-17 · 최신 main `25429c004305de0393935f0b0bd470ecb0e0fd97` · PR163은 종료 P2 미해결 Draft로 보존하며 의존하지 않는다.

## 범위·근거

기존 `arm-overhead`의 앉아서 한 팔씩 올림→복귀→반대쪽 과정을 순수 관찰/후보 판정과 기존 실제 세션/제한 결과 계약에 연결한다. [North Bristol NHS Neck Injuries](https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries)의 After48hours/Exercise5 앞부분을2026-10-17 재확인했다(editionApril2024/NBT002258, reviewApril2027). 양팔 동시 동작/서서 수행/뒤로 손 뻗기로 바꾸지 않는다. 환자 교육 자료의 기간·횟수·통증/약물 처방을 일반 사용자 기본값으로 복사하지 않는다.

원문은 웹캠 수치/개인별 운동량을 검증하지 않는다. 따라서 공개 임상 프로필/기본 각도·시간·출시 적격은 만들지 않는다. 기존 PRD의 코보다 높이/150도/10초 가설도 채택하지 않는다. image-plane 후보에서 각 팔의 위팔 방향·팔꿈치 **투영** 각·손목의 얼굴 기준 투영 높이를 따로 확인한다. 머리/몸통의 정면 보상과 반대 팔 움직임은 구분한다. 실제3D 관절 각, 견갑/상완 안쪽 회전·허리 과신전·통증·편안함·의자에 앉았는지/개인별 적합성을 측정한다고 주장하지 않는다.

## 구현 순서·파일 계약

1. `posture/thresholds.ts`: `OverheadReviewCriteria` 복사/동결. 명시 version/신뢰도·시간·양팔 시작·활성 팔 목표·반대 팔/머리/체간 검수 band만 받는다. neutral/target은 comparator 상대 부동소수점 오차보다 충분히 분리한다. 임상 기본 수치 없음.
2. `e2e/fixtures/overheadCandidate.ts`와 판정/관찰 테스트: 좌·우 독립 생성 평면 기하와 명시 수학 프로필. 사람이 수행한 정답·실측이 아님.
3. `posture/armOverheadObservation.ts`: 원본 stamp/크기/반전·머리/양 어깨/팔꿈치/손목/골반을 한 번 복사하고 기존 같은 프레임 상체 관찰을 재사용한다. 픽셀 종횡비·반전과 팔꿈치 투영/손목 높이를 계산한다. raw/world 좌표 반환·저장·브라우저 import 없음.
4. `stretch/overheadCandidateClassifier.ts`: left/right·준비/수행/유지/복귀, 활성/반대 팔·머리·몸통·범위의 별도 오류. 소유/순서/원본 시각·gap/가림/다인·reentry에 늦은 성공 없음.
5. `coaching/overheadCandidateFeedback.ts`와 실제 session 하네스: 정확한 motion/version/2단계·세대/현재 snapshot만 전달한다. 공개 gate를 열거나 원본 입력을 HTTP에 넣지 않는다. `check-selection-production.mjs`·기존 전체 회귀로 후보 제외를 확인한다.

## Given–When–Then 수용 기준

- Given 한 명과 필요한 전체 상체가 보임, When 양팔을 내린 시작→지정 팔 올림/유지→내림→반대쪽을 수행, Then 순서가 맞을 때만 기존 세션이 진행/완료한다. 준비 중 이미 올린 팔·반대 팔/양팔 동시 올림·팔꿈치 투영 불일치·머리/몸통 보상은 목표 유지로 적립하지 않는다.
- Given 같은 물리 기하, When capture 종횡비/반전/확대·이동이 달라도, Then 같은 투영 판정이다. 손목만 화면 위로 옮기거나 잘못된 팔을 올려 성공을 만들지 않는다. 단일 정면 영상의 관찰 한계를 숨긴3D 측정값으로 바꾸지 않는다.
- Given 이전 목표 이후, When 필수 관절 가림/화면 밖/낮은 visibility·제공된 presence/다인·빈 입력·늦음·큰gap·다른 세대·역행/중복 stamp·변조 getter/닫힘, Then 목표를 재사용하지 않고 세션 유지가 이어 적립되지 않는다. 알려진 잘못된 원본 시각/reentry는 후보 소유를 폐기한다.
- Given session/protocol/gate가 다르거나 수행 중 취소·교체/close, When adapter를 호출해도, Then gate 우회/이전 오류 표면/완료/HTTP 전송이 없다. 실제 세션·결과 DTO/모의 저장은 관절/투영 숫자·계정 식별자 없이 기존 제한 필드만 쓴다.
- Given 실제 회귀 명령, When 검증, Then 생성 기하/모의 자원·HTTP와 실제 사람/SDK/SQL/3D 화면을 구분한다. 실패 원문/전후 소스 SHA·범위·리뷰와 기존 기본 build/고지/production guard·Biome/diff 결과를 남긴다. 새 수학 수치는 fixture 전용이다.

## 제외·후속 의존성

이 Story는 전체 코칭 완성이 아니다. 남녀 GLB 두 아바타 실행·세밀한 표면/시범 반응과 UI는 이 판정 계약 이후 통합하며, PR163의 표시/정리/준비 보완을 무단 병합하지 않는다. 실제 사람 정확도·개인별 추천/임상 실행 프로필·최종 외형/성능·기존 Draft/P2·전체1~4/1~6 게이트는 남는다. 새 원본/GLB·공개 활성화·새 메뉴/디자인 개편·정책/API/DB·운영/비용/계정/시크릿/배포·출시는 없다. 중요 안전/개인정보 변경은 별도 승인한다.

## 로컬 결과·PR 검토

[실제 구현·생성/실제 구분·RED/P2 보완·검증 증거](../review/arm-overhead-coaching/README.md). 같은 프레임의 한 팔씩 올림/복귀→기존 실제 세션/제한 DTO를 연결했다. terminal 피드백 P2를 RED로 재현해 보완했고 관련6파일111/전체127파일2134·최종SSR15흐름·타입/build/guard·Biome/diff를 통과했다. 순수 계약 범위의 조건부 PR 게이트로 진행하며 화면·SDK/실측·전체 단계 완료가 아니다.
