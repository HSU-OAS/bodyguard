# S2.M3 — 전달된 관절 존재 신뢰도의 소비 경계

2026-10-09 · 기준 main42cfa7d(PR95). FR-M-02/07·FR-A-01/03·constitution P3.

## 문제와 범위

S2.M2는 optional presence를 보존하지만 기존 trustedJoints는 visibility와 화면 좌표만 확인한다. 그 결과 presence가0이거나 비정상인데 visibility가 높으면 사지·몸통 방향과 부위 강조의 관찰 coverage에 사용될 수 있다. 원래 가림/비정상 입력 보류 계약의 누락이며 존재 점수가 실제 정확도의 증거는 아니다.

이미 명시된 min을 presence에도 적용하고, 제공된 값이 비수치·비유한·범위 밖이면 관절을 신뢰하지 않는다. 새로운 기준값·의료 classifier·성공/추천 규칙은 만들지 않는다. optional 값이 생략된 기존 입력은 유지한다. 디버그용 headShoulderConfidence의 visibility 평균 계약은 변경하지 않으며 이 평균을 관찰 적격성이나 실제 사람 정확도로 사용하지 않는다.

## 구현 전 하네스와 완료 기준

1. 낮은/비정상 presence와 높은 visibility의 기존 거짓 trust를 RED로 재현한다. 기존 min·경계·생략·입력 불변성을 함께 검사한다.
2. 같은 결과의 팔/몸통 coverage가 제거되고 해당 local rotation은 마지막 표시를 유지하되 유효 관찰로 세지 않는지, 새 유효 관찰에서 복구하는지 확인한다. 화면에 별도 확인 불가 색을 추가하지 않는다.
3. 실제 Chrome/WebGL의 기존 남녀 두 모델·부위 강조에서 저작된 presence 입력→coverage 해제→강조 해제→복구·종료를 검증한다. 합성 입력과 실제 SDK/사람 검증을 명확히 구분하고 영상·좌표·프레임별 신체값은 저장/내보내지 않는다.
4. 전체 FE/type/Biome/build·공개 guard/byte·diff·기존 source/GLB hash를 확인한다. 관찰 consumer의 기존 회귀를 재실행하고 실패를 보존한다.
5. 작성자 리뷰와 최신 main/HEAD/diff/CLEAN/체크를 실제 확인한다. 이 Story의 미해결 P1/P2가 없어야 조건부 병합한다.

## 제외와 남은 출시 게이트

공개 UI·문구/디자인·SDK 정책·기본 main 경로·외형/원본/GLB·임상 각도/시간/효과·실측/올바른 시범·계정/API/DB/운영 변경0. 합성 coverage 해제를 실제 웹캠 정확도 검증이나 D2/전체1~6 통과로 세지 않는다. 기존 시작P2, 승인 UI/SDK 정책·촬영 참여자/관찰자·Docker 연결/HTTPS/외부 공급자·최종 외형/권리·사업/개인정보 결정은 별도 미완료다.

## 실행 결과

제공된 낮은/비정상 presence를 같은 기존 min으로 거부하도록 trustedJoints를 보완했다. 팔/몸통은 해당 관찰 coverage만 잃고 표시용 마지막 local rotation은 유지한다. 디버그 가시성 평균은 그대로이며 적격성/정확도 점수가 아니다.

실제 Chrome154의 남녀 기존 GLB에서 팔·다리 강조→낮은/비정상 presence→해제→다른 신뢰 가능한 부위 표시→새 관찰 복구→만료/종료 흐름을 통과했다. 합성 입력/오류이며 실제 SDK·카메라·참여자 검증은 아니다. 전체 FE1397, 타입·Biome269·빌드·공개 guard와 JS/CSS byte 동일을 확인했다. 원본/모델·공개 문구/구조/품질/승인 경계는 유지한다.

[실패 원문·실제/합성 구분·검증 증거](../review/pose-presence-guard/README.md). 작성자 리뷰이며 독립 reviewer/전문가 승인이 아니다. 조건부 PR 게이트는 별도 최신 확인한다.
