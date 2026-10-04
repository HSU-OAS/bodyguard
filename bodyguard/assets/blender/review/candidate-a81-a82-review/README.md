# A81~A82 얼굴 국소 재토폴로지 — 실제 검수·미채택

2026-10-02 · S2.4 / Draft PR #9 리뷰 보완 · **외형 P2 미해결 / 병합하지 않음**. 여성 무의상·남녀 동일 백색 중성 마네킹 결정과 자연 곡선·관절/리깅 정확도·이전 원본/증거·1~6단계/승인 규칙을 유지한다. 개발 기본 A37은 바꾸지 않았다. [이전 A79/A80](../candidate-a79-a80-review/README.md)과 구분한다.

## 결과

| 후보/검사 | 실제 결과 | 미실행/판정 |
|---|---|---|
| A81 경계 probe | 원본 사본 12조건, 경계·구강 성분 확인. [원시 결과](a81-boundary-probe.json) | 후보/원본 저장 없음 |
| A81b/C Grid Fill probe | 직접 bmesh 연산 4조건 새 면0개. 기본 편집기 4조건 FINISHED, 새 면 생성. [b](a81b-native-grid-probe.json)·[c](a81c-editor-grid-probe.json) | 사본 검사이며 모델 제작/전체 QA 아님 |
| A81d/E 제작 | d는 native deform mapping 접근 오류, e는 남성 내부 구강 교차96/inside47·48·46으로 guard 실패 | 저장 전 exit1, e 여성 미실행. 실패 기준을 낮추거나 교차하는 잔여를 삭제하지 않음 |
| A81f 경계 재조사 | 8조건. .875 crown / y<-35mm는 남녀 모두 단일 성분/얼굴 링378·346. [결과](a81f-complete-boundary-probe.json) | .015m의 여성 선택은 3성분이므로 채택하지 않음 |
| A81g 접선 보간 | 원본118개 PASS/121행·실제8PNG·저장 파일 대조 PASS | 얼굴이 심하게 접혀 **반려**. GLB/Chrome 미실행 |
| A81h 단순 보간 | 원본118개 PASS/121행·실제8PNG·저장 파일 대조 PASS | 얼굴 앞면 깊이 붕괴·경계로 **반려**. GLB/Chrome 미실행 |
| A82 전문 앞면 투영 | 원본/재수입 각각118개 PASS/121행, 실제8PNG·Chrome3개/41.244s·브라우저2PNG·저장 파일 대조 PASS | 일부 전면 체적은 회복했지만 턱 플랫폼/이마·측면 경계·머리 비례 미달로 **반려** |

**수치 통과가 외형·해부학·실제 코칭·출시 통과가 아니다.** 아래24개 native PNG와2개 Chrome PNG를 실제로 열어 확인했다. 세 후보의 전체34컷은 실행하지 않았다. source/import `rendered:false`는118개 수치 검사에서 렌더하지 않았다는 뜻이며 별도 초회8컷을 전체34컷으로 세지 않는다.

## 원본·보존 대조

- [A81g 원본](../../bodyguard_avatar_candidate_a81g_rejected.blend) SHA `768784e32ddf29a3ce9e1e89df5a4dace9f1c2f699be1eafb032e0d963271998`; [A81h](../../bodyguard_avatar_candidate_a81h_rejected.blend) `30a3c347ba83016f63b0bd4a78ae8e5fe7cfa21f1f0bce859f73abe764ec6f90`; [A82](../../bodyguard_avatar_candidate_a82_rejected.blend) `2fdacacb35671a0e96c1ff33c30f28d4b9dad51460434492888b7e1d3a58d8b1`. 모두 실제 저장 .blend와 동일한 바이트 사본이다.
- A60의 전문 연속 head/neck에 A63의 **동일 순서 위상/이름 대응** skin을 먼저 준비하고, 불필요한 얼굴·구강 세부만 native 기본 편집기의 Grid Fill로 교체한다. 임의 신체 생성·whole-head smoothing·neck 절단·global remesh·좌표 clamp·skin 복원이 아니다. 아티스트 영역 수치는 운동/측정 임계값이 아니다.
- 원래 좌표/준비 named skin 남79070·여78603개, 기존 face79020·78576개, 보호 손·정수리·각163 rest bones/행렬을 실제 저장 파일 독립 대조에서 확인했다. [g 대조](a81g-saved-source.json)·[h](a81h-saved-source.json)·[A82](a82-saved-source.json). 최초 library 미연결/평가 누락 대조 실패는 별도로 보존했으며 native scene link/update 뒤 **같은 정확한 행렬 기준**으로 재실행했다.
- A82는 새 패널 점만 native XZ regularize .25/16 및 PROJECT negative-Y/6 grid-layer blend로 이전 전문 A77에 투영했다. 원래 턱·정수리·뒤통수·목·몸통·손 좌표/skin·위상·리그는 그대로다. 사전 ray miss 남2685/여1614개를 숨기지 않으며 완전 피팅으로 표시하지 않는다. [제작 결과](a82-generation.json).
- [남성 GLB](bodyguard-male-candidate.glb) 7,881,300 bytes/`d9210c8e441052dbffd2f37902cdc52d3717b45e4d918c5b8e4971eed9973cb4`, [여성](bodyguard-female-candidate.glb) 7,714,360 bytes/`89250af31cfaa8d11134b751ba681f69505480ebdeec38deea594bda6d8778ea`. 각각5meshes/1skin/163joints, images/cameras/animations0. ratio1/native8weights/1μm cleanup/fins0·0,3mm envelope/.1mm bounds 기준은 그대로다. native5개 parent 경고/309438·311332 weights 제한도 기록한다. [왕복](a82-glb-roundtrip.json).

## 실제 변형·브라우저

[원본 g](a81g-source-deformation.json)·[h](a81h-source-deformation.json)·[A82](a82-source-deformation.json) 각각118개 최대2.9439303671, [A82 재수입](a82-roundtrip-deformation.json)118개 최대2.9476798033, 실패0. 원래 길이1mm 초과 edge ratio3미만 기준과 네 목 포즈도 그대로다. source A82 목 남1.2784/1.2883·여1.2523/1.2532, 재수입 남1.7251/1.5549·여1.4501/1.4965다. 이는 기술적20° stress이며 사용자 동작 정답이나 목표 범위가 아니다.

[실제 Chrome 보고서](a82-browser-report.json): Mac16,12/Apple M4/16GiB, **Chrome154.0.8037.93**, headless1440×1080/DPR1,3PASS/41.24397s/skip·unexpected·flaky0/errors[]; 모든 native actor가 terminal인 뒤 실행했다. 남녀 각180 RAF samples, 평균16.6644/16.6656ms·p9516.8000ms, triangles718866/703674/draw21/eight-weight mesh2, 정적 리그0/움직이는 리그≈.20944rad/독립true. **RAF 간격이며 GPU 완료·카메라·추론/사람 지연 측정이 아니다.** getUserMedia0/owned non-listening proxy 외부 차단 실제검사, API/SQL/SMTP/OAuth 미연결,401/503은 모의 응답, WebGL loss는 실제 extension으로 유발/복구했다. 정답 시범/실제 사람/웹캠/compound poses·장치 다양성·장시간/운영·배포·출시는 미실행이다.

## 실제 미리보기 — 승인된 모델 아님

| 후보 | 정면 / 3/4 | 남성 측면·뒤·기술 목 | 여성 측면·뒤·기술 목 |
|---|---|---|---|
| A81g | [정면](a81g/first-front.png) · [3/4](a81g/first-quarter.png) | [측면](a81g/first-side-male.png) · [뒤](a81g/first-back-male.png) · [목](a81g/first-neck-male-left.png) | [측면](a81g/first-side-female.png) · [뒤](a81g/first-back-female.png) · [목](a81g/first-neck-female-left.png) |
| A81h | [정면](a81h/first-front.png) · [3/4](a81h/first-quarter.png) | [측면](a81h/first-side-male.png) · [뒤](a81h/first-back-male.png) · [목](a81h/first-neck-male-left.png) | [측면](a81h/first-side-female.png) · [뒤](a81h/first-back-female.png) · [목](a81h/first-neck-female-left.png) |
| A82 | [정면](a82/first-front.png) · [3/4](a82/first-quarter.png) | [측면](a82/first-side-male.png) · [뒤](a82/first-back-male.png) · [목](a82/first-neck-male-left.png) | [측면](a82/first-side-female.png) · [뒤](a82/first-back-female.png) · [목](a82/first-neck-female-left.png) |

Chrome 실제 화면: [남성 두 모델](browser/male-two-models.png)·[여성 두 모델](browser/female-two-models.png). 여성도 탱크톱·쇼츠·허리선·옷단 없는 동일 중성 백색 표면이며 기존 자연 체형/관절은 유지한다. A-02 최종 외형은 미통과다.

## 재현·기록·검사

[65개 사본 해시](copy-manifest.json)·[실행/미실행 기록](execution-record.json), `scripts/`의18개 gzip 스냅샷은 압축 해제 뒤 원래 SHA와 같은 바이트다. 이전 파일은 덮어쓰지 않는다. raw 제작/검사 스크립트는 원래 임시 폴더에도 보존했다. 실패 출력은 tool이 관찰한 발췌이며 전체 합쳐진 stdout 보장으로 표시하지 않는다: [d](a81d-observed-failure.txt)·[e](a81e-observed-failure.txt)·[g 대조](a81g-first-saved-compare-failure.txt)·[h 대조](a81h-first-saved-compare-failure.txt).

새 경로만 사용하는 Blender 재현: `--background --factory-startup --disable-autoexec <source.blend> --python-exit-code 1 --python <decoded.py> -- <args>`. 해당 스냅샷 상단/실제 argv 계약을 따른다. g/h 입력은 보존 A60 원본과 A63 skin donor, A82 입력은 실제 h 원본과 보존 A77 target. frozen-boundary-helper를 같은 폴더에 원래 `a49-density-producer.py` 이름으로 풀어야 한다. source/GLB/render/왕복 각각 새 출력 경로를 사용하며 기존 파일 덮어쓰기를 거부한다. Native QC는 `review_avatar.py -- <new-directory> --candidate --mannequin --qc-only`; 전체34컷을 원하면 `--qc-only`를 빼고 실제 실행 결과를 따로 남긴다. 브라우저는 `BODYGUARD_AVATAR_QA_DIRECTORY=<new-absolute-glb-directory> PLAYWRIGHT_JSON_OUTPUT_NAME=<new-absolute-report> .venv/bin/python -m tests.run_browser avatar`이며 backend에서 실행한다. 외부 차단 helper를 우회하지 않는다.

저장소 사본만으로 재검증: `node bodyguard/assets/blender/review/candidate-a81-a82-review/evidence-check.cjs <absolute-repository-root>`. 실제65개SHA/18decodedSHA/26PNG·원본3×118/재수입118·브라우저3개/GLB자산해시·정확한 retained counts·미채택 상태를 검사한다. Ruff는11개 Python 스냅샷의 **E9,F만** 실제통과했으며 full style/format·전체 서비스/API/Vitest/typecheck/build 회귀는 이번 보완에서 실행하지 않았다.

다음은 전문 중성 머리의 **전체 앞면을 실제 정수리/턱/두개골에 먼저 피팅한 후** 국소 패널을 투영하는 작업이다. 경계 조형과 3D 실루엣을 먼저 검사하며 강도 증가나 부분 수치만으로 채택하지 않는다. 외형 P2/Draft PR #9 미병합·2단계/1~6 미완료·기존 별도 승인 경계를 유지한다.
