# 동작 설명·원문·시범 대조

2026-11-11. 개발 목록 7개를 원문의 해당 구간과 다시 대조했다. 수행 설명 근거와 실제 사람의 관절·안전·효과 검증은 구별한다. 시간·횟수·각도 처방을 원문에서 일반 사용자에게 옮기지 않았다. 출시 적격 동작은 0개다.

| 개발 동작 | 확인한 원문 구간 | 설명과 대조 | 시범·판정의 남은 필수 조건 |
| --- | --- | --- | --- |
| 목 옆 기울이기 | [CUH Mobility exercises](https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/)와 [NBT Exercise 3](https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries) | 천천히 좌우로 기울이고 어깨를 편하게 두는 변형. 손으로 당기는 다른 변형을 섞지 않음 | 카탈로그는 앉은 시작인데 기존 시범은 선 자세. 시작 자세 통일, 실제 머리·어깨 보상과 가림 검증 필요 |
| 턱 당기기 | CUH Chin retraction | 앉아서 목·등을 세우고 숙임 없이 뒤로 당기기 | 정면 깊이 이동은 검증되지 않아 안내 후보 유지. 시범 새 제작 필요 |
| 어깨 으쓱·이완 | [CUH Neck sprain advice, Exercises 5](https://www.cuh.nhs.uk/patient-information/neck-sprain-advice/) | 양쪽 어깨 올림과 이완의 수행 설명 일치 | 기존 임시 진폭·유지 구간은 작화값. 머리·몸통·한쪽 어깨 보상과 실제 상승·복귀 판정 검증 필요 |
| 팔 교차 어깨 늘이기 | [AAOS Crossover Arm Stretch, PDF p.2](https://orthoinfo.aaos.org/globalassets/pdfs/2024-rotator-cuff-and-shoulder-conditioning-program.pdf) | 어깨를 편하게 하고 위팔을 잡으며 팔꿈치 압박 금지 | 정확한 손 위치·압력은 카메라로 확정할 수 없어 안내 후보. 시범 새 제작 필요 |
| 팔 위로 뻗기 | NBT Exercise 5의 머리 위로 뻗는 앞부분 | 의자에 앉아 한 팔씩 편안한 범위로 움직이는 설명이며 뒤로 손 뻗는 부분은 제외 | 기존 시범은 한 팔씩 올리지만 선 자세. 앉은 시작으로 수정해야 하며 어깨 내부 회전·허리 과신전 자동 판정은 금지 |
| 옆구리 늘이기 | [Leeds NASS Lateral muscles stretch, PDF p.5](https://www.leedsth.nhs.uk/wp-content/uploads/2023/08/Exercise-NASS-Home-exercises-for-axSpA_AS-v2.pdf) | 의자에 앉아 한 팔 위·반대 손 아래, 앞 숙임·비틀림 없이 옆으로 움직임 | 정면에서 비틀림·앞 숙임 배제 미검증. 안내 후보, 시범 새 제작 필요 |
| 앉아서 상체 비틀기 | [Kingston and Richmond Trunk stretch](https://www.kingstonandrichmond.nhs.uk/patients-and-families/patient-leaflets/home-exercise-programme-falls-prevention) | 의자 등받이에서 떨어져 팔을 가슴 앞에 모으고 골반을 유지하며 상체·머리를 함께 움직임 | 정면 어깨 폭만으로 회전 성공 판정 금지. 개인별 운동 제한 안내와 새 시범 필요 |

## 시범 불일치의 실제 확인

기존 Blender 원본 SHA `130d32ff93fb2bfd252f4ef068bc587490b0b904640adf91efa002e276d17794`을 저장하지 않고 6개 action의 첫 프레임을 실제 평가했다([스크립트](native-audit.py), [결과](native-audit.json), [실행](native-audit.log.gz)). 남성 허벅지 방향은 아래 수직에서 약 3.75도, 여성 약 2.08도였으며 두 다리는 의자에 앉은 자세로 굽혀져 있지 않았다. 이 값은 모델의 포즈 대조용이며 사용자의 의학적 허용 각도가 아니다.

목/팔 올림 동작의 시작 자세를 앉은 설명과 맞추는 것이 필요하다. 기존 원본·GLB·기록은 보존하고 별도 native action 후보를 제작한 뒤 정지 뼈대·바인딩·좌우·변형·전신 화면을 다시 검증해야 한다. 기존 클립을 ‘올바른 자세’로 출시할 수 있는 상태로 취급하지 않는다. 원문 재확인은 환자 교육 자료에 해당 동작이 있음을 확인한 것이며, 대상자 선정·효과·개별 금기·자동 판정 임계값을 보증하지 않는다.
