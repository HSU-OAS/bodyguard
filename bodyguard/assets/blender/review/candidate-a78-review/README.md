# A78~A78c — 턱·목 경계 양쪽 국소 정제 검수

2026-10-02 · S2.4 / Draft PR #9 리뷰 보완. **A78c 외형 미달·미채택, 개발 기본 A37 유지.** 원본/GLB 기술 검사는 통과했지만 A-02 P2가 남아 병합하지 않는다. 2단계와 전체 1~6단계 완료가 아니다.

## 변경과 실제 결과

[A77](../candidate-a76-a77-review/README.md)의 새 bridge만 정제하는 방식은 두 절단 경계를 고정해 접선 변화가 남았다. 별도 후보에서 기존 경계 양쪽의 국소 밴드까지 Blender native `Corrective Smooth / LENGTH_WEIGHTED / only-smooth`로 정제했다. 인체 생성·전체 remesh·좌표 사후 복원·가중치 수정은 없다. 남녀 무의상 백색 중성 표현과 원래 여성 체형/관절을 유지한다.

| 실제 제작 | native 강도/횟수 | 최대 이동 | 저장/후속 검증 |
|---|---|---|---|
| A78 | 0.5 / 16 | 남11.961mm | 기존6mm guard에서 exit1. 여성·저장·QA·GLB·Chrome 미실행 |
| A78b | 0.15 / 16 | 남6.688mm | 같은 guard에서 exit1. 여성·저장·후속 검증 미실행 |
| A78c | 0.15 / 8 | 남4.243/여3.102mm | 별도 저장, 아래 실제 재검증 수행 |

첫 두 실패는 [A78 발췌](a78-failure.txt)·[A78b 발췌](a78b-failure.txt)에 보존했다. 완전한 process log로 주장하지 않는다. 실패한 강도를 통과로 기록하지 않고 guard도 낮추지 않았다. [실행·재시도·미실행](execution-record.json)에 Ruff 실행 경로 quoting 실패/수정과 장치 읽기 sandbox 실패/동일 네 항목 native 재실행도 구분한다.

[A78c 편집 원본](../../bodyguard_avatar_candidate_a78c_review.blend) SHA256 `a5666e1dc2efd7a698a9c737c00d7e961ae151fefa357ed7b5e1b27406b0583b`. 입력 A77 SHA `5f158d9ad9cbba42e6eaf143eed761d3eabdc3fc46c4f30b860799963999dcf3`는 변하지 않았다. 기존 모든 원본·GLB·검증 증거는 보존한다.

[저장 원본 독립 native 대조](saved-source-preservation.json)는 남142115/여140259 정점, 영역 밖 남126384/여124943 좌표, 전체 named skin/edge/face·보호 손·각163bones/rest·행렬을 다시 확인했다. 밴드 안의 좌표는 실제 편집했으므로 모든 원래 신체 좌표 보존으로 확대하지 않는다. 편집 전 경계 ID는 보존됐지만 **수정 뒤 planar cut/gap 측정에 사용하면 안 되는 역사 ID**다. [제작 보고서](generation-report.json)의 flag를 따른다.

## 실제 검증과 한계

- [원본](source-deformation-report.json): 동일118개 변형/121행, 실패0, 실제 Cycles24 렌더34PNG. 최대 edge 비율2.9439303671.
- [native8 GLB 왕복](roundtrip-report.json)·[재가져온 변형](roundtrip-deformation-report.json): 동일118개/121행, 실패0, 최대2.9476798033. 남12659968/여12496816 bytes, 각5meshes/163joints. 원본 저장 없음, ratio1·기존3mm envelope/0.1mm bounds 유지. 재가져온34PNG는 미실행이며 원본34컷으로 대체하지 않는다.
- [실제 Chrome](browser-report.json): 3개 PASS/41.399s, skip/flaky/unexpected0. 일곱 native actor의 terminal을 확인한 뒤 실행했다. Mac16,12/Apple M4/16GiB/Chrome154.0.8037.58/headless1440×1080/DPR1. 카메라 요청0 assertion·외부 차단, 두 독립 리그·503/WebGL loss 재시도. 실제 사람·추론·운동 성공·운영 API/메일/SQL 검증은 아니다.
- 각180개 RAF 간격: 남 mean16.669ms/p95 18.0ms, 여16.665ms/p95 18.2ms. draw21, triangles1153290/1138442. RAF는 GPU render time·실제 웹캠 코칭 성능이 아니다.
- parent 경고5개, NO_COLOR/Three.Clock 및 주입503/복구 후 WebGL 경고가 있었다. 기술 검사 통과를 경고 없음으로 표시하지 않는다.

[정면](source/faceless-front.png)·[3/4](source/faceless-quarter.png)·[남 측면](source/faceless-side-male.png)·[여 측면](source/faceless-side-female.png)·[남 목 변형](source/faceless-neck-male-left.png)·[여 목 변형](source/faceless-neck-female-left.png), 실제 웹 [남](browser/male-two-models.png)·[여](browser/female-two-models.png)를 확인했다. 손/무릎/뒤 전신과 팔 변형도 실제 렌더로 확인했다. 전체34개 각각의 해부학 승인으로 확대하지 않는다.

경계 head 법선 median은 남70.972→34.912°/여44.125→20.892°로 줄었지만, body 경계 max는 남62.045→76.159°/여47.392→76.390°로 악화됐다. 평균적인 정제 개선만으로 채택할 수 없다. **옷깃 같은 목/턱 연결과 머리 형태·손목/최종 마감은 참조 외형 미달**이다. 단순 강도/횟수 증가 경로는 채택하지 않는다. 다음은 전문 연속 턱·목의 하부 형상과 실제 연결 단면의 조형 대응이며 기술 gate를 낮추지 않는다.

## 재현·증거 확인

제작 snapshot [A78](a78-producer.py.txt.gz)·[A78b](a78b-producer.py.txt)·[A78c](a78c-producer.py.txt), [독립 원본 검사](saved-source-check.py.txt.gz)를 보존했다. 끝 빈 줄까지 실행 당시 바이트를 유지해야 하는 두 snapshot은 lossless gzip으로 보관하며 압축을 별도 임시 경로에 풀어 실행한다. 압축/해제 SHA를 실행형 검사로 확인한다. Blender5.1.1 background/factory-startup/disable-autoexec/python-exit-code1로 입력 A77을 열고 해당 snapshot을 실행한다. 제작 인자는 새 `.blend`, 새 `.json`, 횟수(A78/A78b16, A78c8)다. 기존 출력은 거부하며 실패를 감추기 위해 원본이나 script를 덮어쓰지 않는다.

전체 QA와 export는 기존 `assets/blender/review_avatar.py`·`export_avatar_candidate.py`, 웹 검사는 기존 `backend/tests/run_browser.py avatar`를 그대로 사용했다. 원본 QA는 `--candidate --mannequin`, GLB 재수입 QA는 추가 `--qc-only`다. export ratio1/new web/new GLB 경로와 `BODYGUARD_AVATAR_QA_DIRECTORY`를 지정한다. production/사람 코칭으로 연결하지 않는다.

49개 원본·생성 증거 사본과 SHA/bytes는 [manifest](copy-manifest.json)에 있다. 두 실패 발췌·실행 기록·이 문서·실행형 검사는 별도다. 아래 검사는 사본과 실제 scoped report만 확인하며 외형/해부학/출시 승인이 아니다.

```bash
node bodyguard/assets/blender/review/candidate-a78-review/evidence-check.cjs "$(pwd)"
```

실제 사람/시범/사용자 리타게팅/복합 동작/다양한 장치/장시간/GPU timing, 공급자·운영 DB·배포·출시는 미실행이다. 현재 안전·개인정보·승인·1~6단계 기준을 바꾸지 않았으며 전문가만 남은 출시 후보판으로 표시하지 않는다.
