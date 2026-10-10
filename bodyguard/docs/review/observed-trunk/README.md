# 관찰된 몸통 방향 — 실제 연결 결과

2026-10-08 · 비공개 기술 검수 · 생성 관찰 · 실제 웹캠/올바른 수행 검증 아님

기존 사용자 모델이 어깨·골반 중점 사이 방향에 따라 옆/앞으로 기울어지고, 사지는 움직인 부모에 맞춰 같은 관찰 방향을 유지한다. 골반/root·중간 척추 local 회전과 길이·scale은 보존한다. 개별 척추/골반 각도·축 비틀림이나 신체 전체의 이동을 재현한 것은 아니다. 명시적 trunk=true에서만 연결되며 기존 사지8개 기본 호출·공개 JS/CSS byte는 그대로다.

## 실제 미리보기·흐름

[여성 옆 기울기](final-female-side.png) · [남성 앞 기울기](final-male-forward.png) · [남성 옆](final-male-side.png) · [여성 앞](final-female-forward.png).

**미완성 A37 원본의 생성 관찰 검수 화면**이다. 최종 아바타 외형/디자인 시안/임상적으로 올바른 시범이 아니다. 사진과의 외형 차이, 손/팔 표면 결함도 남아 있으며 새 조형/Blender 원본 저장/GLB export는 하지 않았다.

[실제 Chrome 결과](browser-final.json): 남녀 각각 옆→앞→골반 가림→복수 신체→복구→관찰 만료→종료. 두 모델의 source/시범·position/scale·저작된 중간 구조와 skin 가중치를 보존했다. 화면은 발끝까지 포함한다. 가림은 몸통과 해당 허벅지 coverage를 제거하고, 여러 신체/만료는 모두 보류한다. 카메라0·외부 요청0·저장0·pageerror0. 실제 SDK/사람 긍정 입력은0이다.

## 검증·실패 보존

- [전체 FE 원본](unit-final.json.gz)1205통과/실패0. 방향·mirror·가림/비정상/복구·세대/만료·옵션 복사와 bound bone·정리, 움직인 몸통 부모 아래 머리의 명시 world 방향 및 기존 손 회귀를 실행했다.
- [Biome](code-final.log.gz)·[tsc](types-final.log.gz)·[assets](assets-final.log.gz)·[build](build-final.log.gz)·[production guard](guard-final.log.gz) 실제 통과. [공개 bundle](public-assets-final.json)은 이전 JS/CSS와 byte/SHA 동일하다.
- [실제 소스와 범위](summary.json), [증거 SHA·gzip 원문 SHA](manifest.json). 시험 당시 HEAD는 기준선864dcf2이며 시험 코드의 실제 파일 SHA로 최종 소스와 대조했다. 기록을 새 커밋에서 실행한 것처럼 바꾸지 않았다.
- [구현 전 RED](unit-red.json.gz)는 missing module로 suite가 실행 실패했다. 수행된 테스트 통과로 세지 않는다. [초기 방향 테스트](unit-first.json.gz)는 통과했다.
- [소유권 초기 시험](unit-ownership.json.gz)은110통과/1실패였다. 골반 가림이 몸통뿐 아니라 해당 허벅지도 제외한다는 기대값 누락(8 기대/실제7)을 고치고 전부 재실행했다.
- [최초 Chrome 실패](browser-first.json)는 관찰 공급 중단 즉시 pose freeze를 요구한 시험 오류다. 원래 capture의 유효 기간에는 보간이 계속되므로 만료 **후** 정지를 확인하도록 시험 시점을 수정했다. 원본을 보존하고 [수정 시험](browser-corrected.json)과 최종 시험을 실행했다. timeout/skip/임계값은 바꾸지 않았다.
- 최초 타입 검사에는 probe의 closure nullable alias 오류4개가 있었다. 실제 오류 출력은 대화 실행 기록에 보존됐으며 확정 alias로 보완 후 재검사했다. 최초 assets 준비는 모델 없는 새 작업트리에서 DNS 실패했고, 기존 공식 모델5개의 cache를 SHA 대조 복사한 뒤 정상 통과했다. 이 두 실패에 별도 원본 로그 파일이 있다고 주장하지 않는다. deps/정책·SDK 버전은 그대로다.

## 리뷰·남은 조건

작성자가 실제 diff를 보안/성능/정확성/유지보수 관점에서 검토하고 원시 getter 한 번 복사·엄격 boolean·정리/coverage 경계와 머리 결합 시험을 보완했다. 독립 리뷰라고 주장하지 않는다. Story diff의 미해결 P1/P2는0이다. GitHub 체크·최신 diff/CLEAN·충돌·main 포함은 PR gate에서 별도로 확인한다.

몸통 집계 방향은 개별 해부학적 운동이나 실시간 코칭 정확도 증거가 아니다. 출시 적격 동작0·최종 외형/리깅/권리·실제 사람/다장치·SDK/승인 공개 UI·HTTPS/운영 및 시작 지연 P2와 전체1~6 필수 기준은 여전히 미완료다. 미완성 기능을 공개하지 않는다. 최소 텍스트·안전/오류 안내·이전 실패/원본과 기존 사전/별도 승인 규칙을 유지한다.
