# A79·A80 — 전문 연속 턱·목 / 얼굴 cage 경로 반려

2026-10-02 · S2.4 리뷰 보완. **외형 미통과·미채택·미병합**이다. 여성은 별도 의상 없이 남성과 같은 매끈한 백색 중성 마네킹으로 제작한다는 CEO 결정을 유지한다. 여성 자연 곡선·관절·필요한 구조/리깅 정확도·이전 원본/증거·개발 A37·전체1~6/승인 기준은 바꾸지 않는다.

## 실제 결과

[A80 수정 가능한 원본](../../bodyguard_avatar_candidate_a80_rejected.blend)은22,310,548bytes, SHA256 `7cdfd174a50e51ad16c818e034440447a6881979c0765266d3f651426220d5d1`이다. 남89,641/여89,690vertices·각163bones. [생성 보고서](generation-report.json)의 QA pending은 생성 당시 사실이며 후속 검사와 구분한다.

- [원본](source-deformation-report.json)과 [실제 GLB 재가져오기](roundtrip-deformation-report.json) 각각121행/118개 기술 변형 PASS·실패0. 두 검사는 `--qc-only`로 **전체34PNG를 렌더하지 않았다**. 기존 closed/normalized/no-garment/shared finish·original>1mm edge ratio3미만 기준은 그대로며 max는2.9439303671/2.9476798033이다.
- [독립 저장 파일 대조](saved-source-preservation.json): 편집 영역 밖 남75,849/여75,765좌표, 보호 손·위상·준비된 named skin·각163bones/rest/행렬 정확히 보존. 변경점 남13,780/여13,925, 얼굴 최대 편집53.378/53.672mm. **전체 좌표/머리 체적 보존 주장은 아니다.**
- 기존 첫 검수 코드로 실제 native8PNG와 [설치 Chrome3개](browser-report.json)/40.186s·웹2PNG를 완료했다. 원본/GLB 변형 PASS와 외형·해부학·올바른 운동·실제 사람 코칭 PASS는 다르다.20°는 기술 스트레스이며 사용자 목표 각도가 아니다.
- 실제 [정면](first-front.png)·[3/4](first-quarter.png), [남성 측면](first-side-male.png)·[뒤](first-back-male.png)·[기술 기울임](first-neck-male-left.png), [여성 측면](first-side-female.png)·[뒤](first-back-female.png)·[기술 기울임](first-neck-female-left.png), [남성 웹](browser/male-two-models.png)·[여성 웹](browser/female-two-models.png)을 확인했다. 연속 목은 유지했으나 **머리의 과도한 수축·정수리/뒤통수 변형·눈/입/귀 잔여**가 뚜렷해 반려했다. 무의상/같은 재질만 충족한다고 최종 외형을 승인하지 않는다.

## 원인과 제작 경로

[전문 cage 조사](professional-cage-inspection.json.gz)는 Blender Foundation CC0 Human Base Meshes v1.4.1의 실제 남녀 realistic whole body가 각10,582점 cage이고 머리 영역3523/3537점을 포함함을 확인했다. 이 좌표는 전문 모델링 에셋이지 사람 촬영 데이터가 아니다. 원문은 lossless gzip으로 보존했으며 기존 source SHA/라이선스는 [제작 계약](../../../../docs/avatar-production.md)을 따른다.

A79는 modifier 적용 뒤 무효화된 group 참조로 저장 전 exit1했다. A79b는 이름 재조회로 보완했지만 기존 exact coincident ring guard에서 exit1했다. [실패 경계 진단](failed-boundary-diagnostic.json)은 남성의 두132점 링에서 최대11.872μm/평균1.284μm 차이를 확인하고 같은 guard로 다시 차단했다. 오차 허용치를 늘리거나 좌표를 clamp하지 않았다. 여성 probe/후속 후보 검사는 미실행이다. [A79](a79-observed-failure.txt)·[A79b](a79b-observed-failure.txt)·[A79c](a79c-observed-failure.txt)는 관찰된 출력 발췌이며 전체 stdout이라고 주장하지 않는다.

A80은 기존 A60의 **연속 전문 턱·목/머리 위상**을 그대로 두었다. 기존 A63과 정확히 동일한 위상/이름 대응으로 준비 skin을 먼저 연결하고, 전문 원본 cage를 native triangulate → sparse Surface Deform 실제 bind → native Smooth0.65/240 → apply 했다. 새 절단 링·bridge·전신 remesh·구/원기둥 인체 생성은 없다. native 적용과 보존 assertion은 실제 통과했지만 **얼굴 세부 위상을 유지한 smoothing은 blank-head 제작 해법으로 채택하지 않는다.**

다음 제작은 연속된 턱·목을 유지하면서 얼굴 세부 표면의 **국소 재토폴로지**를 전문 도구로 다룬다. 강도/횟수만 다시 조정하거나 필요한 신체 구조를 삭제해 완료 처리하지 않는다. 기존 기술/외형/웹/실측 게이트는 유지한다.

## 실제 GLB·브라우저 조건

[GLB 왕복 메타데이터](glb-roundtrip-report.json)·[남성 GLB](bodyguard-male-candidate.glb)8,042,252bytes/`0028077267cd1c4060e1fc2b6cdb988c92ea4ef4359de38005e8a2a132d3b92c`·[여성 GLB](bodyguard-female-candidate.glb)8,046,736bytes/`3d68a92aff8840951b0d769ba38d5bf968e131f45d37af170ddf371788ea8a1f`. 각5meshes/163joints·native8influences·ratio1·fin0/0·silhouette3mm/roundtrip bounds0.1mm 기술 기준 유지, images/cameras/animations0.

Mac16,12/AppleM4/16GiB/Chrome154.0.8037.58/headless1440×1080/DPR1·owned5182. 모든 native actor terminal 이후 격리 Chrome를 실행했다. 비청취 proxy/A-00 외부 차단, 실제 카메라 요청0, API·SQL·SMTP·OAuth 연결 없음.401/503/회전은 fixture/합성이고 WebGL loss는 실제 확장 호출이다. 남/여180RAF 평균16.674/16.667ms·p9518.2/18.5ms·draw21·triangles733498/733890·독립뼈대·정지회전0·8weightmesh2. **RAF는 GPU 시간·추론/웹캠 fps·사람 코칭 지연/정확도·다기기 성능이 아니다.**

## 보존·재현·미실행

[27개 정확한 사본 manifest](copy-manifest.json)·[실행 기록](execution-record.json)·[실행형 증거 검사](evidence-check.cjs)를 보존한다. `node evidence-check.cjs <저장소 루트>`는 실제 파일/SHA·lossless gzip 원문·118개/Chrome 결과·미통과 구분을 검사하며 출시 승인 도구가 아니다. 이전 A78와 모든 tracked 파일은 삭제/수정하지 않고 Story/제작 계약에 새 결과만 추가한다.

생성 당시 [조사](cage-inspector.py.txt.gz)·[A79](a79-producer.py.txt.gz)·[A79b](a79b-producer.py.txt.gz)·[A79c](a79c-boundary-probe.py.txt.gz)·[A80](a80-producer.py.txt.gz)·[저장 파일 대조](saved-source-check.py.txt.gz)는 **lossless gzip**으로 실행 바이트를 보존했다. 새 임시 폴더에 압축 해제해 `.py`로 실행한다. A79 계열은 기존 A63을 열고 같은 폴더의 frozen A49 helper/CC0 bundle·새 출력 경로를 사용한다. A80은 기존 A60을 열고 `-- new-source.blend new-report.json CC0-bundle.blend 기존-A63.blend` 인자를 받는다. [기존 공통 QA/export/브라우저 실행법](../../README.md)을 재사용한다. QA·export helper/서비스 구현을 변경하지 않았다.

6개 실제 snapshot에 Ruff `--select E9,F`를 실행해 통과했다. **전체 style/format 검사는 아니다.** 첫 patch context 불일치·추정 경로 읽기 실패·verbose GitHub 출력 truncation을 실행 기록에 구분했다. male export parent 경고5개·native weight limit·NO_COLOR/Clock·의도적503/context-loss 경고도 숨기지 않는다.

A79/A79b 저장 원본·QA/GLB/렌더/Chrome, 여성 A79c probe, A80 source/import **전체34PNG**·API/Vitest/type/build/전체style회귀·실제 사람/observer·시범/리타게팅·웹캠 통합·다장치/장시간은 미실행이다. 외형 초회에서 반려됐으므로 추가34컷으로 출시 통과를 주장하지 않는다. 새 계정·외부 서비스·비용·시크릿·운영 DB·배포·출시/병합은 없다. **개발 A37·외형 P2/Draft PR #9·2단계 및 전체1~6 미완료 상태를 유지한다.**
