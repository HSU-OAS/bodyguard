# A65~A67 턱 밑 연결·분리 구강 표면 실제 검수

2026-10-02 · S2.4 진행 중 · FR-A-01~04/A-07. 여성 별도 의상 없는 남녀 통일 백색 중성 표면, 자연 곡선·관절/필요한 구조·리그 정확도 요구를 유지한다. **최종 외형 미달·미채택이며 개발 A37·외형 P2·Draft PR #9 미병합·1~6/승인 기준은 그대로다.** 기존 파일·증거는 보존한다. 전문 CC0 body/head와 기존 Blender native/검수 도구를 재사용하며 새 인체 생성/의존성/서비스 연결은 없다.

| 후보 | 실제 실행 | 외형·미실행 |
|---|---|---|
| [A65 원본](../../bodyguard_avatar_candidate_a65_rejected.blend) | 경계 회귀9개·생성·[연결 성분 진단](connected-surface-diagnostic.json)·실제8PNG | 원본 QA는 남성 연결 성분2에서 exit1. 118개 전체 변형과 보고서 생성 전 실패. 긴 얼굴 연결면/잔여·주름으로 반려. 전체34컷/GLB/Chrome 미실행 |
| [A66 원본](../../bodyguard_avatar_candidate_a66_review.blend) | [내부 구강 잔여 제거](a66/generation-report.json)·[원본118개/121행 PASS](a66/source-preflight-report.json) | 외부 좌표/skin은 A65와 정확히 동일하다. A65 PNG를 A66 실제 렌더로 표시하지 않는다. A66 렌더/전체34컷/GLB/Chrome 미실행·외형 미승인 |
| [A67 원본](../../bodyguard_avatar_candidate_a67_review.blend) | [원본118개/121행·실제34PNG PASS](a67/source/deformation-report.json)·[GLB 왕복118개/121행 PASS](a67/glb-deformation-report.json)·[실제 Chrome3개 PASS](a67/browser/playwright-report.json)·동일 경계9개 재실행 | 얼굴 잔여·머리/턱 연결선·주름으로 외형 반려. 원본/웹 변형 합격을 올바른 운동·코칭·출시 승인으로 확대하지 않음 |

## 원인·보완 경계

A65는 수평 body 절단에서 남던 입/코 일부를 피하려고 **턱 앞은 낮게, 뒤 목은 높게** 남기는 native oblique plane을 사용했다. 기존 A64 arc-length 대응을 재사용하되 두 절단면의 실제 평면성/분리·교차 없음/기존 좌표+skin을 검사한다. [A65 native9개](boundary-oblique-check-a65.json)와 [A67 같은9개 재실행](boundary-oblique-check-a67.json)은 non-star·역방향/다른 밀도·parallel oblique와 동일 평면/세 번째 ring/교차·nonplanar 거부, 이전 constant-Z 실패 재현이다. **18개 새로운 coverage가 아니다.** 변형 QA의118개와 edge 비율3미만 기준도 그대로다.

A65의 native cap 이후 내부 구강 shell이 분리돼 원본 QA가 실제 차단했다. [읽기 전용 진단](connected-surface-diagnostic.py.txt)은 남456/여336점이 세 방향 모두 외부 주표면 내부이며 표면 교차0임을 확인했다. A66은 이 **진단된 닫힌 내부 조각만** 제거했다. 모든 외부 표면 좌표/named skin은 Counter 정확 비교로 동일하며 보호 손·각163bones/rest/행렬을 보존했다. 외형 문제를 전신/손 remesh나 필요한 구조 삭제로 숨기지 않았다.

A67은 A66의 검증된 외부 표면/skin을 직접 재사용하고 head와 body 모두 parallel oblique cut으로 맞췄다. 새 body donor/기존 skin 복원/clamp/뼈 이동/QA 완화는 없다. 실제 source 남134,328/여135,656점, imported GLB 남134,237/여135,559점이다. 전문 head 표면·retained body/skin·손·163bones/rest/행렬 보존을 생성 시 검사했다. 생성 보고서의 QA pending은 **당시 상태**이며 실제 후속 보고서는 위 링크다.

[다음 수정의 단면 진단](lower-under-jaw-diagnostic.json)은 낮은 **oblique** 턱 아래에서 전문/기존 남녀 각각 외곽1개, 내부 구강/외부 ear contour0을 실제 확인했다. 원본은 저장하지 않았다. **새 후보·변형·외형 승인 증거가 아니다.** 다음에는 이 단면과 전문 blank-head 하부의 형태/접선을 대응시킨다. 렌더의 얼굴 잔여/연결 주름을 그대로 둔 채 채택하지 않는다.

## 실제 원본·웹 미리보기

A65: [정면](a65/first-front.png)·[3/4](a65/first-quarter.png)·[남 측면](a65/first-side-male.png)·[여 측면](a65/first-side-female.png)·[남 뒤](a65/first-back-male.png)·[여 뒤](a65/first-back-female.png)·[남 목 시험](a65/first-neck-male-left.png)·[여 목 시험](a65/first-neck-female-left.png).

A67: [정면](a67/source/faceless-front.png)·[3/4](a67/source/faceless-quarter.png)·[남 측면](a67/source/faceless-side-male.png)·[여 측면](a67/source/faceless-side-female.png)·[남 목 시험](a67/source/faceless-neck-male-left.png)·[여 목 시험](a67/source/faceless-neck-female-left.png)·[실제 Chrome 남 두 모델](a67/browser/male-two-models.png)·[실제 Chrome 여 두 모델](a67/browser/female-two-models.png). source 폴더에 나머지 전신/손/무릎/관절34컷이 있다. **전체44PNG(8+34+2)**이며 AI 예시 사진이 아니다.

## 실제 GLB·Chrome 조건

[Native export/왕복](a67/glb/roundtrip-report.json)은 ratio1·8influences·1µm cleanup·3mm envelope·0.1mm bounds를 유지했다. 남11,966,704bytes·여12,083,216bytes, 각각5meshes/1skin/163bones, 참조 이미지·카메라·조명·시범 액션0이다. 남성 parent 경고5개를 실제 기록했다. [남 GLB](a67/glb/bodyguard-male-candidate.glb)·[여 GLB](a67/glb/bodyguard-female-candidate.glb). source SHA: A65 `086fafa0332240ed5b7eb5e990020de4c545d59a7ab92204aa0dd1f7d463c5c3`, A66 `03ac3629b76858ee7f55fc0ffa9e6118c5d64fcbf4ba29100889af1318a8b3b5`, A67 `2f6e1fc510ddc3deb2b500e62ec3e274197a475046a4421d2d2af0bb766d03f3`.

모든 native 작업 종료 후 **Mac16,12/Apple M4/16GiB·Chrome154.0.8037.58/headless1440×1080/DPR1**에서3개/44.824s를 실행했다. owned5182·예약 비청취 proxy/외부 차단·카메라0이고 API401은 fixture이며 DB/SMTP/OAuth 없음·사용자5173 미사용이다. 각각180RAF mean16.663/16.671ms·p95 18.300/18.400ms, drawcalls21, triangles1,090,266/1,100,842, eight_weight_meshes2, 정지0/움직임0.209438/0.209430·독립 뼈대 실제 확인. **RAF 간격이지 GPU timestamp·추론fps·실제 웹캠 지연/정확도 합격이 아니다.** GPU 상세/전원/전체 부하는 미확인이다. NO_COLOR/FORCE_COLOR·Clock 경고·의도한503/context-loss 경고를 보존했고 모의 복구를 실제 운영 검증으로 바꾸지 않는다.

## 재현·보존·미충족

[정확한 A65 제작 코드](a65/producer-at-generation.py.txt)·[A66 코드](a66/producer-at-generation.py.txt)·[A67 코드](a67/producer-at-generation.py.txt)·[진단/실행 요약](execution-record.json)·[native 경계 검사](boundary-oblique-check-a67.py.txt)·[초회8컷 도구](first-preview.py.txt)를 보존했다. 원래 A49 helper SHA와 전문 bundle SHA guard를 유지한다. 설치된 Blender5.1.1 background factory-startup/disable-autoexec에서 `--python-exit-code 1`로 실행한다. head/jaw 제작은 명시된 이전 source·새 .blend/.json·기존 CC0 bundle, QA는 기존 `review_avatar.py -- 새폴더 --candidate --mannequin [--qc-only]`다. source/보고서를 덮으려는 A66/A67 호출도 실제 저장 전 exit1·기존bytes/SHA 불변으로 거부했다.

[실행형 증거 감사](evidence-audit.js.txt)·[실제 결과](evidence-audit.json)는 별도 source·GLB·PNG의 원본bytes/SHA, 실제 QA/Chrome/native9개, 실패/미실행/미채택과 문서 링크를 검증한다. 수정 전 format/E501 실패는 native 실행 전 정정했다. 프로젝트설정 Ruff check/format은 **현재 제작3·회귀2·진단2 실행형7파일 범위**에서 실제 통과했으며 전체 저장소 검증으로 표시하지 않는다.

**미실행**: A65 complete118/전체34컷/GLB/Chrome, A66 실제 렌더/전체34컷/GLB/Chrome, A67 imported GLB native34컷, 실제 수행자/관찰자·올바른 시범·리타게팅·웹캠 통합 성능/다양한 장치, 실제 Gmail/Google·외부 계정/시크릿/비용·운영 DB migration·배포·출시. 기존 API/Vitest/build/계정 결과는 이번 재실행이 아니다. **외형 P2 때문에 병합하지 않고 2단계·1~6 전체/전문가 검토만 남은 상태로 표시하지 않는다.**
