# A290–A292 — 원본 축 보존 조형과 실제 전체 변형 검수

2026-10-04 · S2.4 · FR-A-02/03/08. **새 후보는 미채택이며 외형 P2·PR #9·2단계·전체1~6단계는 미완료입니다.**

최신 [CEO 얼굴·목 참조](../candidate-a88-review/ceo-reference.png)를 계속 적용합니다. 남녀 모두 의상 경계가 없는 중립 백색 마네킹, 매끄러운 얼굴–목 연결과 통일 재질을 목표로 합니다. 필요한 신체 구조와 리깅 정확도는 지우지 않습니다. [이전 후보·실패·검수 증거](../candidate-a283-a289-review/README.md)는 수정하지 않습니다.

## 수정 방식과 실제 결과

A287은 추가 조형만 Y-only이고 원래 A276의 XYZ 이동을 포함했습니다. 여성 제한점의 기존 Z 이동이 약4.245mm였으므로, 이번에는 **보존된 전문 A250에서 새로 시작해 처음부터 X/Z를 고정**했습니다. XYZ 편집 뒤 좌표를 복원하거나 작은 신체를 코드로 다시 만든 것이 아닙니다.

설치된 Blender5.1.1의 실제 `SMOOTH` 축 제한을 먼저 확인하고, 원래 normalY>0/높이.875–.975/half-width.060·경계 geodesic8mm·z fade.010·손 보호를 고정했습니다. native Y-only fairing32회/.6과 A284 실제 ray에서 정한 접합부 조형 anchor를 사용했습니다. anchor는 A276에서 측정한 값이며 A250에서 다시 측정했다고 주장하지 않습니다. 남녀 공통 국소 DISPLACE4mm는 조형 전에 원본 대비 누적5.9mm 여유/기존6mm 보호를 계산해 결정했습니다. 강도/범위를 실패 후 바꿔 재시도하지 않았습니다.

| 실제 검사 | 결과와 한계 |
|---|---|
| A290 원본 대비 형상·보호 | 남9737/여9655점 변경·최대4.317/4.876mm. 전체 X/Z 숫자 값 정확 보존, 앞면/선택 밖·손·경계 불변. raw skin·139그룹·각163rest·위상/변환/재질 보존, fold76/107·tiny2/0·nonmanifold/winding0. 양쪽 단계와 전체 보호를 통과한 뒤 별도 원본을 저장했습니다. |
| 곡률·외형 | 동일한 원래 edge 집합의 p95가 남4.147→5.192°·여4.299→5.275°로 **악화**했습니다. 실제 뒤통수 확대의 접합 흔적이 남습니다. 축 보존/변위 PASS를 연속 표면 개선이나 외형 승인으로 바꾸지 않습니다. |
| A291 저장 파일 독립 재열기 | 실제 별도 프로세스에서 원래 A250과 저장 파일을 대조했습니다. 전체 원래 X/Z·raw skin·139그룹·각163rest/부모·pose/world/PBR·point ledger/source-index 보존. 원래 좌표 그대로인 점121908/120893이며 skin 보호를 다시 통과했습니다. |
| A292 원본 | 118개 기술 pose·121행·실패0과 전체34장 실제 Cycles 렌더를 완료했습니다. 올바른 운동 수행/사용자 리타게팅이나 실제 웹캠 시험은 아닙니다. |
| A292 GLB 재수입 | 원본과 별도로118개 기술 pose·121행·실패0과 전체34장 실제 Cycles 렌더를 완료했습니다. ratio1·8가중치의 별도 웹 원본/GLB, 기존 triangle-fin 정제만 적용했습니다. 각GLB mesh1·images0·animations0이며 실제 운동 애니메이션은 없습니다. |
| 실제 Chrome154.0.8037.93 | 새 GLB로3개 PASS·34.387s. 두 독립 뼈대·합성 기술 변형·실제 WebGL context loss/재시도·GLB503 오류 복구를 검사했습니다. 외부 연결 차단·카메라0. 180frame 남 평균16.666ms/p9517.2ms·여16.667ms/p9517.3ms는 **합성 렌더 간격**이며 실제 사용자 지연/정확도 아닙니다. |
| 검수·회귀 | 머리8장·원본18장·GLB 재수입12장·Chrome2장, 실제40장을 직접 열람했습니다. 생성78장 전부를 직접 열람했다고 주장하지 않습니다. native6회 terminal exit0·Python6helper Ruff/format·순수 수학8개·Node syntax·frontend151개/16파일4.45s·Biome65파일·TypeScript noEmit을 실제 실행했습니다. |

## 실제 미리보기

실제 새 Blender 후보의 렌더입니다. 참조 사진을 편집한 이미지나 완성 코칭 화면이 아닙니다.

[남녀 정면](source/faceless-front.png) · [남녀3/4](source/faceless-quarter.png) · [남성 뒤통수](native/head-back-male.png) · [여성 뒤통수](native/head-back-female.png) · [남성 목 변형](source/faceless-neck-male-left.png) · [여성 목 변형](source/faceless-neck-female-left.png).

[실제 남성 Chrome](browser/남성-two-models.png) · [실제 여성 Chrome](browser/여성-two-models.png) · [GLB 재수입 정면](roundtrip/faceless-front.png). 기본 에셋으로 교체한 서비스 화면이 아니라 재검증용 새 GLB override를 사용한 개발 검수 화면입니다.

## 검수 결론과 다음 작업

**A-02/A-08 외형 P2를 유지합니다.** 뒤쪽 접합부·측면과 일부 손 변형의 마감이 남아 이 후보를 기본/출시 에셋으로 교체하지 않습니다. 원래 전신 좌표/skin을 이번에는 바꾸지 않았지만 전신 확대·변형에서 보이는 기존 결함이 해결됐다고 하지 않습니다. 다음 보완은 단순 fairing 강도 반복 대신 비균일 원래 메시 분포와 접합부 공간 곡률의 영향을 대조해 국소 연속면 편집 방식을 정하는 것입니다. 필요 외곽선 제거·whole-neck remesh·skin/좌표 복구·보호 완화는 하지 않습니다.

A37 개발 기본 모델과 서비스 runtime은 그대로입니다. 실제 사람·웹캠·올바른 시범 동작/리타게팅·Gmail/Google·내부 사용성·배포/출시 검증은 미실행/미완료이며 별도 승인 경계와 전체1~6단계 기준은 그대로입니다. 문서화·리뷰 스킬로 실제/모의/미실행과 수치/외형 승인을 분리했습니다.

## 재검증 및 보존

`node bodyguard/assets/blender/review/candidate-a290-a292-review/evidence-check.cjs`로104개 정확 사본(21gzip·78PNG·blend3·GLB2), 보호된 이전868파일 SHA, 원본/독립 재열기·각118변형/34렌더·Chrome 결과와 곡률 악화를 확인합니다. 검사 명령·전체 native stdout·사전 계약·원본 helper는 복제 실행 기록에 있습니다. 사본/검수 integrity PASS는 외형이나 출시 PASS가 아닙니다.

원본 A250 SHA `0e6243e64b65841510d2ed926f3bf315e3cc101dbfa57d41beafb8bcedc8a104`, 새 A290 `f432631aaeb37ca0808c14238a25f10cef7d23f0d3f8d82d74bdbbc99f6b87ed`, 남성GLB `81c534595df2d2c672926bd6cc87a2d01253df10aff365f1d688201615e5faa6`, 여성GLB `d7262c43266f09b4ea0fac2142c07b517337f351403c4e2ad2f0f0c3dfc41927`입니다. [새 원본](native/artist-candidate.blend)·[웹 원본](native/web-candidate.blend)·[재수입 원본](native/web-candidate-roundtrip.blend)·[남성 GLB](export/bodyguard-male-candidate.glb)·[여성 GLB](export/bodyguard-female-candidate.glb)는 별도 보존합니다.

원래 지표/pose/카메라/런타임·CI/운영 파일은 바꾸지 않았습니다. 이번 production build·실제 사람·공급자·다른 장치 검증은 미실행입니다. 초기에 archive 준비 코드의 존재하지 않는 helper 이름을 읽기 전용 목록과 대조해 실제 `web_surface_topology.py`로 수정했으며 archive 실행 전에 Node 검사를 재실행했습니다. 읽기 전용 잘못된 manifest/scripts 경로와 잘린 조회 출력은 native 실행 실패나 전체 native stdout 손실로 오인하지 않습니다.
