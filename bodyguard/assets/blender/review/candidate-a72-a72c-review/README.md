# A72~A72c — 전문 머리 하부 조형·실제 단면 정렬 검수

2026-10-02 · S2.4 / FR-A-01~04 / A-07 · **진행 중, 외형 P2 미해결, 출시 채택·병합 아님**.

여성 무의상 백색 중성 마네킹 결정은 유지한다. 남녀 의상/허리선/옷단을 추가하지 않았고 동일 백색 재질, 여성 자연 곡선·관절, 유두·생식기의 사실적 세부가 없는 표현을 실제 원본·웹에서 확인했다. 신체 구조를 삭제하거나 검증 기준을 낮추지 않았다. 이전 원본/GLB/증거·개발 기본 A37·전체 1~6단계/승인 경계는 그대로다.

이번에는 같은 CC0 전문 head의 **기존 266점 control cage**를 Blender native로 조형했다. 머리 하부 178점만 Y/Z 방향으로 12회/factor0.45 정제했고 X·상부 cage·전체 topology는 assertion으로 보존했다. 최대 artist 편집은 27.195mm다. 기존 전문 메시 편집이며 코드로 구/원기둥 인체를 생성한 것이 아니다. 이 수치와 아래 정렬/20° 시험은 해부학 목표·운동 처방·웹캠 측정 정확도가 아니다.

## 결과와 실패

- [0회](inspection-0/generic-side.png)·[6회](inspection-6/generic-side.png)·[12회](inspection-12/generic-side.png)의 실제 head 비교 6PNG와 import 정렬 보완 후 [12회 실제 재실행](inspection-12-verified/inspection-report.json) 2PNG를 보존했다. 입력 A71 source는 저장하지 않았다. 첫 inspector의 Ruff I001은 실제 실패했고 [원본 snapshot](head-cage-inspection-first-run.py.txt)·[그 코드의 실제 음성 재검사](initial-inspector-ruff-negative.json)를 보존했다. Native actor가 종료된 뒤 import만 고치고 실제 12회 검수를 재실행했다. 현재 실행 코드 Ruff와 역사 실패를 구분한다.
- **A72 저장 전 실패 / exit1**: 하부 조형 뒤 기존 초기 절단면이 머리와 만나지 않았다. [실제 진단](a72/initial-cut-diagnostic.json)에서 intended1.517318m보다 uncut projection minimum1.530917m가 높아 native cut edges0이었다. 진단 재실행도 동일 guard/exit1이다. A72 원본·generation JSON은 저장되지 않았다. 단독 head inspection은 존재하지만 실패한 인체 후보의 QA/GLB/렌더/Chrome은 미실행이다.
- **A72b 실제 단면 정렬**: 기존 신체/최종 head 절단면과 gap24mm는 바꾸지 않는다. 조형된 머리의 실제 lower section(projection minimum+artist inset12mm)을 진단하고 그 단면을 고정된 최종 head plane으로 강체 정렬한 뒤 다시 절단했다. 준비 skin은 이동 전 binding 후 그대로 유지했다. [원본](../../bodyguard_avatar_candidate_a72b_review.blend)·[제작](a72b/generation-report.json)·[121행/118개 실제 검사](a72b/source-preflight-report.json)·첫8PNG를 보존했다. 전체34컷/GLB/왕복/Chrome은 이 후보에서 미실행이다.
- **A72c 연결점만 정제**: [원본](../../bodyguard_avatar_candidate_a72c_review.blend)·[제작](a72c/generation-report.json)을 별도로 보존했다. 이전 A59의 native CORRECTIVE_SMOOTH/LENGTH_WEIGHTED/only-smooth·0.5/8회 정제를 재사용해 새 bridge2646/2658점만 편집했다. 최대 이동 남2.595mm/여1.852mm로 기존6mm guard를 유지했다. 모든 retained body/head 좌표·skin·보호 손·각163bones/rest/행렬·위상 보존 assertion을 실제 통과했다.
- [독립 원본 신체 대조](a72c/authored-body-preservation.json)는 A66의 **남75915/여75865점과 named skin**, 보호 손·각163bones/rest/행렬의 정확한 보존을 실제 확인했다. 변경된 head/new bridge는 이 독립 비교의 대상이 아니라 별도 제작 assertion·전체 QA 대상이다. 두 검사 범위를 혼동하지 않는다.
- [A72 native13개](a72/native-boundary-check.json), [A72b16개](a72b/native-boundary-check.json), [A72c16개](a72c/native-boundary-check.json)를 실제 실행했다. 같은13개 회귀+3개 단면 정렬/잘못된 plane 거부 조건이며 45개의 서로 다른 조건이라고 세지 않는다.

A72b/C의 강체 정렬로 head crown은 남1.684627→1.676680m, 여1.638830→1.632287m로 바뀐다. Artist 피팅을 기록한 것이며 원래 crown이 정확히 유지됐다고 주장하지 않는다. Retained 신체/리그는 정확히 보존했다.

## 실제 연결 단면 대조

[정제 전](a72b/actual-seam-diagnostic.json)과 [정제 후](a72c/actual-seam-diagnostic.json)는 같은 최종 gap24mm(수직),20.580mm(plane 법선 방향)의 실제441/443개 edge ring을 검사했다.

| 후보·부위 | 남 p95 / max | 여 p95 / max |
|---|---|---|
| A72b body 경계 | 18.678° / 156.706° | 15.109° / 140.179° |
| A72b head 경계 | 17.847° / 100.499° | 14.559° / 167.597° |
| A72c body 경계 | 35.414° / 46.381° | 26.764° / 43.053° |
| A72c head 경계 | 52.074° / 60.316° | 38.123° / 50.399° |

최악의 국소 꺾임은 줄었지만 p95는 악화됐다. 평균/최댓값 일부 개선을 전체 외형 승인으로 확대하지 않는다. [남성 측면](a72c/source/faceless-side-male.png)·[여성 측면](a72c/source/faceless-side-female.png)·[여성 목 변형](a72c/source/faceless-neck-female-left.png)을 실제 확인했다. 뒤 목 잔주름은 줄었으나 머리의 얕은 얼굴/이마 경계, 턱–목의 경계·실루엣과 참조 대비 전체 외형은 더 조형해야 한다. **기본 개발 A37을 바꾸지 않고 두 후보 모두 미채택한다.** 다음은 기존 전문 head cage의 이마/얼굴 곡면과 고정 cervical 접선 정제이며 수치/보간 반복만으로 완료 처리하지 않는다.

## A72c 실제 원본·GLB·브라우저

- [Source QA](a72c/source/deformation-report.json): Blender5.1.1,121행·118개 기술 변형/실패0, actual34PNG, 마지막 native 렌더3:47.847. 최대 original>1mm edge 비율2.9439303671(기존3미만). 목 좌우 남1.413914/1.399363, 여1.272681/1.269248. 실행 중 다른 native 검사가 있었으므로 renderer 작업 경과를 단독 제작 성능으로 주장하지 않는다.
- [Export 왕복](a72c/roundtrip-report.json): ratio1/native8influences/1µm 미세 중복·퇴화 정리, fin0/0, 기존3mm envelope·0.1mm bounds 통과. 제한된 weight986029/1017025와 armature-parent 경고5개가 있었고 숨기지 않았다. GLB당5mesh·1skin·163joints, images/cameras/animations0, JOINTS_1/WEIGHTS_1 유지.
- [재가져온 GLB QA](a72c/roundtrip-deformation-report.json):121행·118개/실패0/rendered:false. 최대2.9476798033, 목 좌우 남1.413905/1.399297, 여1.272606/1.269305. Imported34PNG는 미실행이다.
- [실제 Chrome](a72c/browser-report.json): Mac16,12 / AppleM4 /16GB / Chrome154.0.8037.58 / headless1440×1080/DPR1. 모든 native actor가 terminal인 뒤 시작했다. 실제3PASS/41.061s, 시작2026-10-01T20:21:57.946Z. 별도5182·비청취 native proxy/A-00 외부 차단, camera0. API/DB/SMTP/OAuth actor는 시작하지 않았다.
- Native GLB 실제 attachment3개씩의 SHA/bytes와 [남성 두 모델](a72c/browser/male-two-models.png)·[여성 두 모델](a72c/browser/female-two-models.png)을 보존하고 확인했다. 정지 skeleton 변화0, 움직이는 skeleton0.209439/0.209431rad, 서로 독립, eight-weight mesh2, draw21/triangles1133490·1133218. 401/503/context-loss는 제어된 fixture다.
- Actual180RAF interval: 남 mean16.660556/p9518.400000ms, 여 mean16.665000/p9518.200000ms. GPU시간·카메라 추정/실사용 지연·정확도·다른 장치·전력/전체 시스템 부하는 미측정이다.
- NO_COLOR/FORCE_COLOR, deprecated THREE.Clock, 주입한503, 재복구 후 WEBGL_lose_context warning이 있었다. 실제 tests3PASS와 구분한다. API/Vitest/production build 등 변경하지 않은 서비스 회귀는 이번 실행에 포함하지 않았다.

## 바이트·해시·보존

| 파일 | bytes | SHA-256 |
|---|---|---|
| A72b source | 28442219 | `1d0c0d70622b684cdad78dfecd60738bf8eaee312ba84228ce1c8fe83fb52d9c` |
| A72c source | 28442426 | `8e659fcfc983aae587044fd08e61c8253962259043753da7eb945aebf8d845c8` |
| [남 GLB](a72c/bodyguard-male-candidate.glb) | 12442168 | `f60fbc7ebca8191f4d2ee7a4c2d030a0b6e39afa51afd1057e287008b15f4740` |
| [여 GLB](a72c/bodyguard-female-candidate.glb) | 12439348 | `b6132c21ed6b962087dffbd50f384bed7d9cf2e189b2c6d70054b1a22151f3c0` |

[실행 기록](execution-record.json)·[실행형 증거 검사](evidence-audit.js.txt)·[실제 검사 결과](evidence-audit.json)에 SHA·PNG52개·기술/실패/미실행과 이전 A70/A71 증거 보존을 기록한다. Source2개는 생성 native 파일의 동일 바이트 사본이다. 기존 후보/GLB/QA/참조·기본 제작 helper·운영 문서/승인 규칙을 덮어쓰지 않았다. 제작 당시 JSON의 QA pending은 당시 시점이며 이후 검증은 별도 실제 보고서를 따른다.

[실제 제작 코드 A72](a72/producer-at-generation.py.txt)·[A72b](a72b/producer-at-generation.py.txt)·[A72c](a72c/producer-at-generation.py.txt), [cage helper](head-cage-sculpt.py.txt), [QA](review-avatar-at-execution.py.txt), [export](export-avatar-at-execution.py.txt)를 보존했다. 재현 시 snapshot을 새 임시 작업 구간에서 원래 파일명으로 복사하고 기존 A49 boundary helper와 검증한 CC0 bundle을 사용한다. A72b/C는 기존 A66 source를 입력하며 기존 출력 재사용/덮어쓰기를 거부한다. 원본/GLB QA 명령은 각각 `review_avatar.py -- new-directory --candidate --mannequin`, GLB는 `--qc-only`; browser는 실제 사용한 `BODYGUARD_AVATAR_QA_DIRECTORY=<새 native GLB 절대경로> PLAYWRIGHT_JSON_OUTPUT_NAME=<새 JSON 절대경로> .venv/bin/python -m tests.run_browser avatar`이다. 재현 예시는 실행 완료 증거가 아니다.

실제 사람/관찰자·올바른 운동 시범/리타게팅/웹캠 통합·공급자 연결·다중장치·운영 migration/배포/출시·전문가 승인은 미실행이다. 중요한 범위·안전·개인정보·비용/계정/시크릿·운영 변경은 별도 승인 경계다. **Story 외형 P2가 남아 병합 게이트 미충족**이며 Draft PR9/Stage2/1~6은 완료가 아니다. 전문가 최종 사용 검토만 남은 상태라고 표시하지 않는다.
