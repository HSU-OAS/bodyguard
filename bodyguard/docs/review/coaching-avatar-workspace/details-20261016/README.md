# 코칭 검수 화면의 머리·손 움직임 연결

2026-10-16 · 기존 Draft PR152 보완 · **2~4단계 완료 또는 출시 판정 아님**

기존 카메라 확인 → 입력 확인 → 두 모델 표시 흐름에서 `움직임 맞추기`를 누르면 다음 새 단일 신체 입력으로 표시 기준을 복사한다. 머리 회전과 양손 손바닥 기준을 독립 확인하고 왼쪽 머리·손목·손가락에 같은 관찰을 전달한다. 오른쪽 모델은 아직 시범 미연결 비교 모델이며 고정된다. 자세 판정·추천·성공·타이머·운동 기록은 활성화하지 않았다.

## 실제 작동과 검증 경계

- [최종 Chrome 결과](proof/final-details.json): 실제 남녀 GLB/여덟 가중치/React/WebGL로 기존 흐름과 머리·손 표시를 확인했다. 명시 정렬 후 왼쪽 머리/손가락 픽셀은 바뀌고 오른쪽 픽셀은 그대로다. 입력·계정 API는 합성이며 실제 SDK/사람 정확도 시험이 아니다.
- [머리 움직임](proof/final-details-head-moved.png), [손가락 움직임](proof/final-details-fingers-moved.png), [여성·800px 전신](proof/final-details-female-full-800.png). 미완성 검수 모델의 실제 화면이지 최종 외형 승인이나 올바른 스트레칭 시범이 아니다.
- 세대/새 시각/단일 완전 신체를 확인하며, 누락된 얼굴·손은 표시 기준을 만들지 않는다. 정렬은 임상 정상 자세나 신체 분석 기준선이 아니다. 단일 몸과 얼굴의 구조 검사도 같은 사람임을 입증하지 않는다.
- 중지·계정/화면/성별 변경은 표시 기준과 driver를 회수한다. 기존 개인정보 경계와 비공개 production gate를 유지했고 모델/Blender 원본·GLB·가중치·의상/표면은 수정하지 않았다.

## 실패를 보존한 분리 진단

최초 [화면 비교 실패](proof/head-hands.json), [기술 coverage 추적](proof/head-hands-traced.json), [뼈 변화 추적](proof/head-hands-bone.json)을 보존했다. 처음에는 머리 변형 미반영으로 의심했으나 실제 head coverage1/손 coverage32와 머리 뼈 변화가 있었다. footer 버튼 클릭이 스크롤을 바꿨는데 캡처 좌표를 다시 맞추지 않아 머리 대신 하반신만 비교한 하네스 결함이었다. 원래 canvas로 스크롤 복귀·boundingBox 동일 검사를 추가한 [재검증](proof/head-hands-scroll.json)과 최종 실행은 통과했다. 이 수정은 제품 렌더러 결함을 고쳤다는 주장이 아니다.

[별도 blank SDK 관찰](proof/sdk-lifecycle-blank.json)은 실제 heavy/face/hands SDK의 준비→빈 입력→종료, body/face/hands 생성 중 명시 취소에서 clean ack와 Worker 종료를 확인했다. 첫 준비부터 ready 약554ms, 빈 추론 응답 약1019ms, close부터 clean ack 약555ms였다. 생성한 빈 영상이며 신체 양성/임상/차가운 캐시·드라이버 시험이 아니다. 문서/Worker bundle cache와 한 브라우저를 공유했다. 실행 소스는 `executed/`에 당시 byte 그대로 보존했다. **이 성공은 기존 간헐 SDK 준비/정리 실패의 원인이나 해결을 입증하지 않는다.**

최초 compiler/lint·잘못 지정한 guard 경로·patch context 실패 일부는 도구 실행 기록에만 남아 있다. 별도 파일 원본이 있는 것으로 표시하지 않는다. 로그 원문의 공백 때문에 최초 staged diff 검사가 실패해 내용을 수정하지 않고 무손실 gzip으로 보관했다. 압축 해제 byte 동일성을 확인했으며 manifest에는 압축본과 원문의 SHA를 함께 기록했다. 보관 파일·실행 소스도 manifest로 확인한다.

## 작성자 리뷰와 남은 일

`code-review`의 보안·정확성·자원 소유권·성능 관점에서 공통 손 정렬 계산, 원래 frame stamp, 머리/손 정렬 독립성, 누락/오래된 입력·취소와 reference 고정, DEV-only lazy import 및 개인정보/저장0을 검토했다. 단위/DOM/실제 브라우저는 서로 다른 증거로 취급했다. 독립 전문가 리뷰가 아니다.

최종 frontend1956/110파일, 타입을 포함한 원래 build, scoped Biome0진단/전체 기존16 info·오류0, 원래 production guard와 diff를 통과했다. [실제 SDK/가짜 장치8흐름](proof/native-native-details.json), [촬영 기준7흐름](proof/reference-browser.json)의 기존 준비/종료·기준 수집·합성 API 회귀도 통과했다. 전체/관련 로그는 `proof/`에 보존한다. 이번 기능 연결을 위해 SDK 제한·face/hands 기능·가중치·기존 품질 기준을 줄이지 않았다.

**PR152는 SDK 준비/정리 불안정 P2 때문에 계속 Draft/병합 금지다.** 실제 SDK 양성→사용자 아바타 전체 통합, 얼굴/몸/손 대응과 실측, 최종 외형, 올바른 시범·교정·추천/결과 생산자 및 1~4단계 통과는 아직 미완료다. 공급자/컨테이너/HTTPS·운영·배포/출시는 실행하지 않았다.
