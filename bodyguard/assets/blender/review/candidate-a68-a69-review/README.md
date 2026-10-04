# A68·A69 중성 머리·턱 연결 실제 검수

2026-10-02 · S2.4/FR-A-01~04/A-07. **남녀 무의상·동일 백색 중성 표면, 여성 자연 곡선/관절·필요한 구조·리그 정확도를 유지한다. 외형 P2는 남아 후보를 채택/병합하지 않고 개발 A37·전체1~6/승인 기준을 그대로 유지한다.** 이전 모든 파일과 증거는 보존한다.

| 후보 | 실제 완료 | 외형·미실행 |
|---|---|---|
| [A68 원본](../../bodyguard_avatar_candidate_a68_rejected.blend) | [원본118개/121행](a68/source-preflight-report.json), 경계9개, 실제8PNG | 턱 돌출·연결선으로 반려. 전체34/GLB/Chrome 미실행 |
| [A69 원본](../../bodyguard_avatar_candidate_a69_review.blend) | [원본118개/121행 + 실제34PNG](a69/source/deformation-report.json), [GLB 왕복118개/121행](a69/glb-deformation-report.json), [Chrome3개/42.277s](a69/browser/playwright-report.json), 경계10개, 초회8PNG | 얼굴 잔여는 줄었지만 각진 턱/목 경계로 외형 미승인·미채택. imported GLB native34컷 미실행 |

## 원인과 보완

A68은 실제 단일 외곽이었던 낮은 oblique 턱 단면으로 바꿨다. 내부 구강 cap0·retained 신체 좌표/skin·보호 손·각163bones/rest/행렬을 보존했지만 실제 측면에서 턱 돌출이 남아 반려했다. 단면 높이만 반복하는 경로를 채택하지 않았다.

[기존 CC0 generic 머리의 실제 읽기 전용 확인](generic-head-inspection/inspection-report.json)·[정면](generic-head-inspection/generic-front.png)·[측면](generic-head-inspection/generic-side.png)에서도 눈자리가 있어 그대로 채택하지 않았다. A69는 이 **기존 전문 머리 메시**에 native Y-only 표면 정제/Subsurf를 적용하고, 아래 턱 곡면을 더 남기는 `normal=(0,-0.6,1)` 절단과 기존 ordered arc 대응을 사용했다. 단순 도형 인체/새 에셋/의존성/서비스는 만들지 않았다. A68 [native9개](boundary-oblique-check-a68.json)와 A69 [native10개](boundary-oblique-check-a69.json)는 기존9개의 재실행 + steep-parallel1개이며 **19개 새로운 coverage가 아니다.** 원래 118개 변형/edge 비율3미만 기준은 그대로다.

[A69 읽기 전용 실제 경계 진단](registered-seam-diagnostic.json)은 head를 사선 절단한 **뒤** XY 정렬하면서 plane intercept가 남15.389mm/여16.705mm 이동했음을 실제 경계207/267개에서 확인했다. 의도된 artist vertical gap24mm가 남39.389mm/여40.705mm(실제 두 평면의 수직 거리33.776/34.904mm)로 달라졌다. 머리 경계 dihedral p95는 남138.477°/여124.549°다. **모델링 수치이지 해부학 기준·운동 각도·웹캠 측정 정확도가 아니다.** 닫힘/변형 수치 PASS와 별개로 실제 render/Chrome의 날카로운 연결을 외형 실패로 기록한다.

다음 보완은 **최종 head 정렬 후 실제 절단면을 고정**하고 native 곡면 접선을 맞추는 순서다. 준비한 skin 대응·retained 신체/손·163bones/rest 보존과 전체 QA를 유지한다. 좌표 clamp/기존 skin 덮기/필요한 구조 삭제/QA 완화로 숨기지 않는다.

## 실제 미리보기·원본

A68: [정면](a68/first/first-front.png)·[측면](a68/first/first-side-male.png)·[여 목 시험](a68/first/first-neck-female-left.png). A69: [정면](a69/source/faceless-front.png)·[3/4](a69/source/faceless-quarter.png)·[여 측면](a69/source/faceless-side-female.png)·[여 뒤](a69/source/faceless-body-back-female.png)·[여 목 시험](a69/source/faceless-neck-female-right.png)·[실제 Chrome 남](a69/browser/male-two-models.png)·[실제 Chrome 여](a69/browser/female-two-models.png). 나머지 source34/first8 컷도 함께 보존했다. **실제 PNG54(8+8+34+2generic+2Chrome)**이며 AI 예시/출시 승인 이미지가 아니다.

원본 SHA: A68 `90ae490e0161e07bc1dff31298cb1017749668b86524b48c746800712c24c0a0`(28,331,152bytes), A69 `8c31fbb8d40c81b45ad0b893de6f9837e7ee4f43165f73f20ce4f20f5c1a817c`(29,063,950bytes). A68 남136,528/여139,758점, A69 남144,735/여144,500점·각163bones이다. A69 source 최대 edge 비율2.9439303671031447, imported GLB2.94767980329051. 반복 source118개를 새로운236개 동작으로 세지 않는다.

## 실제 GLB·브라우저

[Native 왕복 보고서](a69/glb/roundtrip-report.json)와 [남 GLB](a69/glb/bodyguard-male-candidate.glb)·[여 GLB](a69/glb/bodyguard-female-candidate.glb)는 ratio1/8influences/1µm cleanup/3mm envelope/0.1mm bounds를 유지했다. 남12,890,528bytes/여12,870,020bytes·각5meshes/1skin/163bones, images/cameras/animations0. Male parent 경고5개·weights limited1126921/1161470·fin0/0을 보존한다.

모든 native 핸들 종료 후 **Mac16,12/Apple M4/16GiB·Chrome154.0.8037.58/headless1440×1080/DPR1**에서 owned5182/예약 비청취 proxy·외부 차단/카메라0으로 Chrome3개를 실제 통과했다. API401/503·artist 회전·context 복구는 fixture이며 DB/SMTP/OAuth 없음·사용자5173 미사용이다. 각180RAF mean16.660/16.667ms·p95 18.100/17.700ms·draw21·triangles1,174,250/1,172,370, 독립 뼈대·정지0·움직임>0.2·8weight mesh2를 확인했다. **RAF 간격이지 GPU timestamp·인식fps·실제 webcam 지연/정확도 검증이 아니다.** GPU 상세/전원/전체 부하는 미확인이다. NO_COLOR/FORCE_COLOR·Clock·의도한503/context-loss 경고를 기록했다. 샌드박스 sysctl 조회 exit1은 같은 세 값 읽기 전용 조회를 허용 실행해 확인했으며 아바타 테스트 실패로 세지 않는다.

## 재현·보존·미충족

[실행 요약](execution-record.json)·[A68 제작 코드](a68/producer-at-generation.py.txt)·[A69 코드](a69/producer-at-generation.py.txt)·[native10개 검사](boundary-oblique-check-a69.py.txt)·[실제 경계 진단 코드](registered-seam-diagnostic.py.txt)·[초회 렌더 코드](first-preview.py.txt)와 [증거 감사](evidence-audit.js.txt)·[최종 실제 감사 결과](evidence-audit-post-format.json)를 보존한다. 감사는 native bytes/SHA·실행 결과·PNG/GLB·이전 증거·문서 링크/미실행을 검사하는 것이며 임상/코칭 합격이 아니다. 자기 결과JSON은 재귀 hash에서 제외하고 실제 저장 후 링크/내용을 별도로 확인한다. Git staged diff 검사에서 새 감사 코드의 EOF blank line을 잡아 커밋 전에 수정했으며, [수정 전 첫 감사 결과](evidence-audit.json)는 당시 기록으로 그대로 보존한다. 이를 최종 파일 동일성 검사나 사전 diff PASS로 확대하지 않는다.

기존 Blender5.1.1 background/factory-startup/disable-autoexec/--python-exit-code1을 사용한다. 보존 코드 재현은 새 임시 폴더에 해당 producer와 [불변 A49 helper](../candidate-a49-rejected/producer-at-generation.py.txt)를 각각 실행 당시 이름과 `a49-density-producer.py`로 복사한다. 경계 회귀에는 [이전 A64 코드](../candidate-a63-a64-review/a64/producer-at-generation.py.txt)도 `a64-continuous-jaw-neutral-head.py`로 같은 폴더에 둔다. 제작 입력은 [보존 A66](../../bodyguard_avatar_candidate_a66_review.blend)/기존 CC0 bundle과 **새** source/report, QA는 기존 `review_avatar.py -- 새폴더 --candidate --mannequin [--qc-only]`, export는 `export_avatar_candidate.py -- 새web.blend 새GLB폴더 1`, browser는 backend `BODYGUARD_AVATAR_QA_DIRECTORY=명시적절대GLB폴더 PLAYWRIGHT_JSON_OUTPUT_FILE=새JSON .venv/bin/python -m tests.run_browser avatar`다. 현재 실행형 producer2/native검사2/진단2의 **6파일 Ruff check/format**만 재검증하며 전체 repository lint/build/API 완료로 확대하지 않는다.

**미실행**: A68 전체34/GLB/Chrome, A69 imported native34, 실제 수행자/관찰자·올바른 시범/리타게팅·webcam 통합/다양한 장치, 실제 Gmail/Google·외부 계정/시크릿/비용·운영 DB·서버·배포·출시. 기존 API/Vitest/build 검증은 이번 재실행이 아니다. **Story 외형 P2가 남아 병합 게이트 미충족**, S2.4/2단계·1~6 전체/전문가 검토만 남은 상태로 표시하지 않는다.
