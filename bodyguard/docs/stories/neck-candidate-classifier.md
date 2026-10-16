# S3.C1 목 동작 판정 후보와 진행·결과 연결

2026-10-16 · base main2ee43fe(PR156 merge) · codex/neck-candidate-classifier · FR-M-02/07·FR-S-01/02/03/04·FR-R-03

## 실제 누락과 범위

PR156에서 관찰과 Blender 시범은 연결됐지만 세션에 넣을 실제 동작별 classifier가 없다. 기존 nativeFeedback의 시험은 외부에서 분류를 공급했으며 그 시험을 자동 판정 구현으로 세지 않는다. 첫 후보 neck-side의 같은 입력→투영 지표→단계/방향·보상 후보→기존 진행 엔진→결과 DTO를 연결한다. 새 화면/메뉴/의료 기본값/출시 적격성 변경은 하지 않는다.

2026-10-16 재확인: [CUH](https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/) Mobility2는 한쪽 어깨 방향으로 기울이는 과정을 설명하지만 정답 각도는 없고 유지 시간/횟수는 빈칸이다(version4, approved2024-07-16, ID22379). [NBT](https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries) Exercise3는 편한 수행·어깨 이완과3 count/5회를 설명하지만 목 부상 환자 교육 문맥이다(editionApril2024/NBT002258). 일반인 공통 처방이나 화면상 각도 오차/보상 판정 수치로 옮기지 않는다. 이 둘은 수행 설명의 근거이고 자동 코칭 정확도의 근거가 아니다.

## 구현과 수용 기준

- 기존 observeCapturedNeckSide를 재사용한다. 이미지 비율·실제 반전·동일 generation/sequence/at와 단일 인물/신뢰도·가림/비정상 입력/신선도 검사를 유지한다. DOM/Three/추론을 stretch에 import하지 않는다.
- 판정 수치의 유일한 선언/검사는 posture/thresholds.ts의 명시 입력 계약이다. 초기 각도/유지 시간/횟수 기본값은 만들지 않는다. 시작 band·좌우 목표 band·어깨선 band·머리 위치 band와 프레임 한계/신뢰도를 반드시 공급하며, 잘못된/겹친/빠진/비유한 기준은 거부한다.
- classifier는 이 입력으로 시작·목표 접근·목표 유지·복귀 및 반대 방향/범위/어깨선/머리 위치의 **영상 평면 후보**를 구별한다. 실제 어깨 힘/통증/경추·깊이/같은 사람을 측정했다고 주장하지 않는다. 결과에 candidate-only 경계를 유지한다. 관찰/값을 사용자 정답 기준으로 자동 채택하지 않는다.
- 새/중복/역행/다른 소유자·만료·복수 인물/가림과 분류 오류가 성공/시간을 증가시키지 않아야 한다. phase에 맞는 start/returned를 분리하고 입력과 기준을 보존한다.
- 통합 시험은 분류 문자를 주입하지 않고 실제 생성 관절→classifier→기존 progression/session→결과/기존 저장 계약으로 좌우 정상·오류/복귀/중단/가림을 재현한다. 숫자 fixture는 수학/프로그램 시험값이지 출시 각도·운동량이 아니다. HTTP 모의는 실제 SQL/사람 검증으로 세지 않는다.
- 기본 releasedMotionIds0와 UI 코칭 비활성·production 후보 제외는 그대로다. 이미 구현한 두 모델에 이 후보를 최종 정답처럼 칠하지 않는다. 다음 Story에서 현재 코칭 stage와 판정 후보·오류별 시범을 묶되 임상/실측 검증 전 공개하지 않는다.
- 전체frontend·원래 type/build/Biome·production guard·diff/직접 리뷰와 조건부 PR 게이트를 통과한다. 실패/미실행/임상 미검증을 보존하며 1~4/1~6 완료로 표시하지 않는다.

## 남은 의존성

현재 문헌만으로는 출시 기준 수치를 정할 수 없다. 실제 검증 이월 결정에 따라 소프트웨어는 계속 작성하지만, 전문가 검토/실측 없이 fixture 수치를 제품 정답으로 승격하지 않는다. 추천·임상 기준/오류별 교정 시범·실제 UI 결과 생산·최종 외형/성능·기존 SDK P2 및 외부/운영 게이트는 계속 남는다. 원본/GLB·기존 Draft/증거와 승인 경계를 보존한다.

## 구현·검증 결과

판정 문자를 주입하던 기존 시험과 달리 생성 관절을 실제 투영/classifier로 처리해 기존 엔진의 좌우 수행·제한 결과 DTO/모의 HTTP 계약까지 연결했다. 실제 임상/SQL·코칭 화면 반영은 아니다. posture/thresholds.ts에 명시 기준의 검사·복사를 모으고 판정/피드백 연결기를 구현했다. [실패·재검증·직접 리뷰·남은 의존성](../review/neck-candidate-classifier/README.md). 기본 출시 목록/코칭 gate·공개 화면/SDK·원본/GLB/운영 변경0이다. PR156 source8822093→merge2ee43fe를 기준으로 하며 다음은 현재 두 모델 공간과 후보 판정/오류별 시범·결과 UI의 연결이다.
