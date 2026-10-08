# S2.M2 — 촬영 프레임에서 목·어깨 관찰 연결

2026-10-09. 기준 main: d3be7addecf4c1107b6b39f026b7a369cbe9f25a(PR #94).
FR-M-01/02/07·FR-S-03/04·NFR-07/08·ADR-0012. 합의된 최종 통합의 독립 입력 연결이다.

## 범위와 계약

- VideoFrame의 displayWidth/displayHeight를 생성 시점에 고정한다. CSS, callback 메타데이터나 추론 후 video 크기로 대체하지 않는다.
- 같은 generation/sequence/at의 frozen 이미지 기하와 결과를 코칭 evaluator에 전달한다. native source는 픽셀 반전을 수행하지 않으므로 imageIsMirrored=false이다. 아바타 표시 반전과 별개이며, 카메라 드라이버의 방향/좌표계 정확도를 인증하지 않는다.
- 기존 합성 source의 기하 생략은 호환한다. 누락이면 목 관찰은 unavailable; 유효하지 않은 제공 기하는 source 실패로 처리한다. 이전 값/기본 크기를 재사용하지 않는다.
- SDK가 제공한 optional presence를 결과 복사에서 보존한다. 값이 잘못되면 정상값으로 바꾸거나 생략하여 신뢰도를 높이지 않는다.
- 순수 observeCapturedNeckSide는 현재 frame의 기하만 사용한다. now·minimumConfidence·maxAgeMs는 호출자가 명시한다. 경계 검증과 소유/순서 검증은 각각 기존 관찰 함수와 native 소유 흐름의 책임이다.
- 관찰값은 이미지 평면의 상대 기하이다. 올바름·오류 classifier, 임상 각도/시간/효과, 실제 사람 검증, 추천 승격 또는 성공 기록을 추가하지 않는다.
- 영상/관절/프레임별 관찰값은 임시 메모리만 사용한다. 로그·저장·내보내기·촬영은 없다. 증거는 고정 상태/카운터와 합성 시험 결과만 남긴다.

## 하네스와 완료 기준

1. 구현 전 실패: 지연 추론 중 capture/video 크기를 변경해도 원본 기하가 유지되고 immutable인지, 낮거나 잘못된 presence가 available로 승격되지 않는지 시험한다.
2. 누락/잘못된 기하·중복/다른 세대·가림·여러 사람·만료·취소/늦은 응답에서 관찰을 지어내지 않는다. 결과/input close와 기존 소유 흐름은 유지한다.
3. 실제 Chrome/가짜 카메라/native SDK의 main/worker 입력에서 기하 전달·빈 관찰·해제를 확인한다. 양성 기하 시험은 저작된 합성으로 별도 구분한다.
4. 기존 남녀 native 계정/두 모델/중단 기록의 실제 브라우저 회귀, 전체 FE 단위/type/lint/build/공개 산출물 guard와 diff를 실행한다.
5. 공개 화면/최소 문구·SDK 제품 정책/기본 main·원본/GLB·운영은 변경하지 않는다. 기존 증거/실패를 보존한다.

이 Story 통과는 D2-M/T/I 또는 1~6단계 완료가 아니다. 동작별 실측/올바른 시범·classifier·최종 외형/권리·승인 UI/외부 연결/참여자·기존 시작 P2는 별도 필수 게이트로 유지한다. 요청한 연결의 답변을 기다리며 독립 개발을 계속한다.
