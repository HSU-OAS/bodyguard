# A63·A64 — 연속 전문 목·가중치 보완 / 외형 미채택

2026-10-02 · S2.4 진행 중 · FR-A-01~04/A-07. 여성 의상 요구는 CEO의 **남녀 통일 무의상 백색 중성 마네킹** 결정으로 대체한다. 자연 여성 곡선·관절과 필요한 구조·리그 정확도, 기존 원본·증거·개발 기본 A37을 유지한다. **두 후보는 외형 미달로 채택하지 않으며 PR #9의 외형 P2와 1~6단계/승인 기준은 그대로다.**

## 실제 검사와 외형

| 후보 | 원본 변형 | GLB 왕복 변형·실제 Chrome | 실제 미리보기·판단 |
|---|---|---|---|
| A63 연속 목·국소 머리 깊이/가중치 정제 | 118개/121행 PASS | 118개/121행 PASS, Chrome3개/43.0s PASS | native8컷+Chrome2컷. 머리 깊이 과도 수축·눈/입/귀 잔여로 반려 |
| A64 유지 턱·전문 중성 머리·경계 순서 대응 | 118개/121행 PASS | 미실행 | native8컷. 입/코 잔여·수평 이음매·여성 기울임의 검은 입 틈으로 반려 |

[A63 원본 검사](a63/source-preflight-report.json)·[GLB 검사](a63/glb-deformation-report.json)·[A64 원본 검사](a64/source-preflight-report.json)는 실제 Blender 5.1.1 실행 결과다. 각 남녀 연결 성분1/non-manifold0/정규화 오류0/163bones, 무의상·공통 백색 재질을 검사했다. 목 네 방향도 기존의 원래1mm 초과 edge/비율3미만 기준을 통과했다. A63 목 최대는 원본 약1.433/GLB 약1.501, A64 원본 약1.419다. 합격 임계값은 변경하지 않았다.20°는 엔지니어링 스트레스이며 운동 목표·의학적 정확성·올바른 시범 승인이 아니다.

**두 후보의 전체34컷 하네스와 A64 GLB/왕복/Chrome은 미실행**이다. 실제 수행자/관찰자·시범·리타게팅·웹캠 통합 성능도 미검증이다. A63 결과를 A64나 출시 완료의 증거로 확대하지 않는다. [이전 A60~A62](../candidate-a60-a62-review/README.md)와 [A37](../candidate-a37/README.md)을 덮지 않았다.

실제 [A63 정면](a63/first-front.png)·[측면](a63/first-side-male.png)·[여성 Chrome](a63/browser/female-two-models.png), [A64 정면](a64/first-front.png)·[여성 측면](a64/first-side-female.png)·[여성 기울임](a64/first-neck-female-left.png)을 확인했다. 의상 없는 동일 표면·자연 체형은 유지하지만 참조 외형 충족이라고 판단하지 않는다.

## 변경과 원인 대조

- [목 리그/표면 읽기 전용 조사](cervical-rest-diagnostic.json)·[코드](cervical-rest-diagnostic.py.txt): 목 연결점은 기존/전문 표면의 내부에 있었으며 rig를 임의 이동하지 않았다. head tail은 두 표면 밖이었다. 이 표본의 ray parity만으로 해부학이나 임상 리깅 정확성을 승인하지 않는다.
- A63은 [A60 연속 전문 원본](../../bodyguard_avatar_candidate_a60_rejected.blend)의 목을 유지했다. native `SMOOTH/Y only`1200회는 머리 깊이를 최대 약54.741/52.731mm 바꿔 외형을 악화시켰다. 이전 bridge-only6mm guard의 통과로 부르지 않는다. X/Z와 편집 밖 표면·신체/손·리그는 보존했으나 이 머리 정제는 미채택이다.
- 새 전문 상부의 최근접 전송에 있던 턱 가중치 불연속은 기존 `make_avatar_candidate.py`의 **선택 영역 이웃 가중치 처리**를 재사용해 보완했다. 편집 밖 가중치를 사후 복원하거나 뼈/검사 기준을 바꾸지 않았다. [생성 보고서](a63/generation-report.json)의 생성 시점 QA pending은 보존하고 실제 후속 검사와 구분한다.
- A64는 A63과 동일한 위상에서 **native TOPOLOGY/NAME으로 가중치만** 옮겼다. 과도하게 평평해진 A63 좌표는 복사하지 않았다. A60 전문 목·턱을 유지하고 기존 blank-head 에셋을 연결했다. professional patch 밖의 원래 skin·신체/손/163bones/rest/행렬 보존은 assertion으로 검사했다. [생성 보고서](a64/generation-report.json).
- [실제 턱 단면 조사](jaw-cut-diagnostic.json)·[코드](jaw-cut-diagnostic.py.txt)는 raw 전문 원본의 남성 단면3개 중 작은 외부 귀 경계를 확인했다. 이를 내부라고 닫지 않았다. 실제 유지한 A60 턱의 내부 경계만 기존 포함/교차 guard로 검증·native cap했다. frozen A49 helper는 수정하지 않았다.
- 여성의 비원형 턱은 기존 polar 대응에서 실패했다. 실제 연결된 경계 순서·호 길이를 기준으로 **native edge split**하며 원래 경계 좌표/skin과 두 단순 경계를 보존하는 방식으로 바꿨다. [실제 native 대조6개](boundary-arc-check.json)·[코드](boundary-arc-check.py.txt)는 비원형/역방향/밀도 차이 통과, 같은 평면/세 경계 거부, 기존 polar 실패 재현을 확인했다. 인체나 운동 fixture가 아니다.
- 다음은 얼굴 특징을 남기는 수평 절단 대신 턱 밑 연결을 조형한다. [비수평 단면 읽기 전용 조사](oblique-jaw-cut-diagnostic.json)·[코드](oblique-jaw-cut-diagnostic.py.txt)는 원본을 저장하지 않은 형태 조사일 뿐, 새 조형·변형·외형 통과가 아니다. 단순 smoothing 반복이나 필요한 구조 삭제로 완료 처리하지 않는다.

## 실제 웹 조건

[Playwright 원본 보고서](a63/browser/playwright-report.json)는 M4/Mac16,12/16GiB·Chrome154.0.8037.58·headless1440×1080/DPR1이다. 모든 native 제작/검사가 끝난 뒤, 별도 localhost5182와 비청취 proxy로 외부 egress를 차단하고 실제3개 검사를 완료했다. API guest401·GLB503·context loss·회전은 모의/오류 주입이다. 카메라 요청0을 실제 assertion으로 확인했으며 auth API·SQL·SMTP나 사람 데이터는 사용하지 않았다.

남/녀 각각180RAF에서 평균16.664/16.666ms, p9517.3/17.0ms, draw21, triangles733498/733890, 여덟 가중치 mesh2, 정지 쪽 회전0을 기록했다. **RAF 간격은 GPU 실행 시간·웹캠 추론fps·피드백 지연·판정 정확도가 아니다.** 실제 [남성](a63/browser/male-two-models.png)·[여성](a63/browser/female-two-models.png) 화면과 [GLB 왕복 메타데이터](a63/glb/roundtrip-report.json)를 보존했다. 남성 GLB8,042,252bytes/여성8,046,736bytes, 각5meshes/163bones/여덟 가중치, 이미지·카메라·조명·운동 액션0개다. 남성 parent 경고5개, NO_COLOR/Clock 경고와 의도적인503/context loss 경고가 있었으며 경고0으로 기록하지 않는다.

## 보존·실패·재현

[A63 원본](../../bodyguard_avatar_candidate_a63_rejected.blend)22,471,719bytes SHA256`07b120b2692a91dc36921f8e6198ddfaa268022130f059593d0b146a4fed88c4`, [A64 원본](../../bodyguard_avatar_candidate_a64_rejected.blend)26,778,155bytes `4b3a5f97c120dadd4d11814e2c5f45d1c2a2a27dd2f809c6a384077a43a03077`를 별도 보존했다. A63 GLB는 [남성](a63/glb/bodyguard-male-candidate.glb)·[여성](a63/glb/bodyguard-female-candidate.glb)이다. 임시 web/roundtrip `.blend`도 삭제하지 않았으며 출력 경로는 [실행 기록](execution-record.json)의 검사 순서를 따른다.

생성 시점 [A63 코드](a63/producer-at-generation.py.txt)·[A64 코드](a64/producer-at-generation.py.txt)를 새 임시 폴더에 복사해 `.py`로 실행한다. A63은 기존 A60을 열며, [임포트 순서만 정리한 재현 코드](a63/producer-import-sorted.py.txt)도 보존했다. A64는 같은 폴더에 보존된 A63 원본을 `draft-a63-continuous-neutral-head.blend`, [frozen A49 helper](../candidate-a49-rejected/producer-at-generation.py.txt)를 `a49-density-producer.py`로 복사하고 A60·CC0 원본·새 출력 경로를 사용한다. 경계 대조에는 A64/A62/helper를 각각 코드에 적힌 파일명으로 복사한다. [기존 첫8컷 코드](../candidate-a60-a62-review/first-preview.py.txt)와 [공통 QA/GLB/Chrome 실행법](../../README.md)을 재사용한다.

첫 A63 native VGroup Smooth는 선택 밖 skin 변경 assertion에서 저장 전 실패했다. [실패 코드](a63/producer-first-failed.py.txt)를 보존했고 bounded 처리로 실제 재실행했다. A64의 [첫 실패](a64/producer-first-failed.py.txt)는 외부 귀 경계, [두 번째 실패](a64/producer-second-failed.py.txt)는 여성 non-star 경계를 거부했으며 후보를 저장하지 않았다. A63 기존 출력 경로 재사용도 실제 거부/exit1하고 SHA를 보존했다. 잘못된 preview 경로·I001·실행 전 F821·sandbox metadata 거부는 PASS가 아니며 수정/실제 결과를 [관찰된 실행 요약](execution-record.json)에 구분했다. 요약은 전체 stdout 사본이 아니다.

기본 제작 코드·개발 A37·frontend/API/운영 설정은 변경하지 않았다. 새 외부 에셋·계정·시크릿·비용·배포, 영상·사람 좌표 저장/전송은 없다. 현재 실행용 producer/probe의 Ruff와 실행형 증거·링크 감사를 거친다. 서비스/전체 frontend/build/실제 공급자 회귀는 이번 후보에서 재실행하지 않았다.

[실제로 통과한 파일·결과·링크 감사](evidence-audit.json)·[감사 코드](evidence-audit.js.txt)는 `node <복사한 .js> <저장소 루트> <기존 임시 원본 폴더>`로 재실행한다. 두 원본/GLB/18PNG·기존 파일 불변·검사 결과·native 회귀·기술 통과/외형 반려 구분을 확인하며 manifest는 자기 보고서만 제외한다.6개 실행용 producer/probe의 Ruff check/format --check도 실제 통과했다. 생성 시점 A63의 임포트 순서 경고와 당시 실행 코드는 별도 보존한다.
