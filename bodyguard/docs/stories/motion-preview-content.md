# S2.V2 동작 선택의 Blender 움직임 미리보기

2026-10-16 · 최신 main8675f72 · codex/motion-preview-content · FR-S-01/06·FR-A-01/03·NFR-08

CEO의 1~4단계 우선 완성 요청에 따라 기존 동작 선택의 빈 영상 자리에 실제 Blender 후보의 미리보기를 연결한다. 처음에는 근거가 정리된 neck-side/shoulder-shrug/arm-overhead 3종을 제작하며 나머지4종을 삭제하거나 출시 범위를 임의 축소하지 않는다. 전체 동작의 실제 판정·올바른 시범과 추천은 별도 미완료다.

## 구현 전 계약·하네스

- 불변2be0ebe의 전문 Blender 후보 원본을 복사하고 남녀의 기존 메시·재질·리그/가중치를 유지한다. 기존 외형/목 접합 P2와 GLB/원본/과거 증거를 덮어쓰거나 최종 외형으로 채택하지 않는다. 2026-10-12의 제작 보류 해제와 이번 개발 재개 권한 안의 로컬 무비용 작업이다.
- 문헌의 정성적 수행 과정만 미리보기 제작에 사용한다. 환자용 치료/약물·횟수/유지 시간 처방을 제품에 옮기지 않는다. 애니메이션의 진폭/재생 길이는 동작 구분용 작화값이며 임상 정답 각도·추천 운동량이 아니다.
- Blender 원본 복사본·키프레임·대표 PNG와 실제 인코딩/디코딩 가능한 남녀 영상을 보존한다. 원본 파일과 메시 데이터의 변경 여부를 검사하고, 실제 영상을 직접 본다. 코칭용 GLB를 바꾸는 작업이 아니다.
- 개발 전용 고정 allowlist/해시 경로로만 영상과 poster를 제공한다. 영상·카메라 입력·신체 좌표 수집/외부 전송·제품 public 복사0이다. 미디어 파일 누락/변조는 실패로 처리하며 대체 자세를 지어내지 않는다.
- 기존 카드와 동작 대화상자만 연결한다. 마우스/키보드/명시 재생·정지, reduced-motion, 이탈/숨김·소스 변경·오류/수동 재조회, 실제 Chrome 디코딩과 계정 회수를 검증한다. 카메라·SDK·임상 성공·운동 기록을 시작하지 않는다.
- 기존 합성 media unit과 실제 로컬 미디어 재생을 구분한다. 전체 frontend·타입/Biome/build·production guard·diff를 확인하고 미해결 P1/P2가 있으면 Draft로 유지한다.

## 2026-10-16 제작 근거 재확인

[CUH Neck exercises and advice](https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/)의 Mobility Image2는 좌우로 머리를 기울이는 동작이며, Posture는 어깨/등의 긴장을 풀도록 안내한다(승인2024-07-16/version4/22379). 손으로 머리를 당기는 변형은 사용하지 않는다.

[CUH Neck sprain advice](https://www.cuh.nhs.uk/patient-information/neck-sprain-advice/)의 Exercises에는 양 어깨를 들어 올린 뒤 이완하는 수행이 있다(승인2025-02-07/version5/30927). 치료·약물·통증 범위 지시는 BODYGUARD의 일반 사용자 지시로 채택하지 않는다.

[North Bristol NHS Neck Injuries](https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries)의 After48hours는 의자에 바르게 앉아 시작하도록 하며 Exercise5는 한 팔씩 번갈아 편안한 범위에서 머리 위로 올리는 과정이다(editionApril2024/reviewApril2027/NBT002258). 뒤로 손 뻗기와 숫자 처방은 이 미리보기에서 사용하지 않는다. 상체 구도만 보여주며 앉은 하체/의자 전체를 시범했다고 주장하지 않는다.

세 자료는 환자 교육 문맥이다. 일반인 적합성·효과·웹캠 판정/의학적 정확도 인증이 아니다. 통증/어지러움 시 중지하는 기존 안전 안내와 출시 적격0을 유지한다.

## 실제 구현·검증 결과

남녀3종의 편집 가능한 Blender action6개, PNG6개와 24fps H264 영상6개를 제작했다. 기존 선택 카드와 코칭 동작 대화상자의 hover/focus/명시 재생에 연결했고, 하나만 재생·정지 시 대표 포즈 복원·reduced-motion·수동 오류 복구를 검증했다. 닫힌 대화상자는 영상/이미지를 요청하지 않는다. [실제 화면·실패·해시/명령](../review/motion-preview-content/README.md).

Chrome155의 실제6영상 디코딩·800/1440px 창·제어된401 회수7흐름, Blender5.1.1 원본 재열기/6action 변형·복귀, 전체frontend1946/109·build·Biome·production guard를 확인했다. 초기 OCIO 예외/뒷면 카메라 후보와 숨겨진 video를 visible로 기다린 하네스 실패를 보존한다. 전자는 렌더 실패, 후자는 시안 반려/시험 오류이지 제품 성공이 아니다.

이 결과는 **개발 미리보기 콘텐츠 연결**이다. 임상 정답 시범/자동 판정·실제 신체 기반 추천·코칭 결과 생성·원본 GLB 갱신·최종 아바타 외형 승인·실제 사람 정확도·2~4단계 통과가 아니다. 미리보기 없는4종과 기존 아바타/SDK 시작 P2를 그대로 남기며 공개 build에는 후보 파일/경로를 포함하지 않는다.
