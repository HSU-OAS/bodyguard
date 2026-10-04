# A89 — 새 참조형 연속 얼굴·목 보존과 뒤 목 국소 정제

2026-10-02 · S2.4/PR #9 리뷰 보완 · **외형 미통과/미채택.** CEO의 최신 남녀 사진을 얼굴·목 형태와 연속 연결 기준으로 적용했다. 사진과 가까운 A37의 전문 파생 연속형 표면을 재사용하며, 남녀 무의상 중성 백색·자연 곡선/관절·필요 구조/리깅·전체1~6단계/승인 규칙을 유지한다. 이전 여성 의상 요구는 대체됐다. 사진의 흐림/과노출·안 보이는 면을 품질/의학 근거로 삼지 않는다.

## 실제 제작과 보존

[최신 CEO 참조](ceo-reference.png)는 모델링용이며 GLB/마케팅 재배포용이 아니다. 기존 A37의 얼굴·앞목·머리를 새 도형으로 교체하지 않고 Blender5.1.1의 기존 Corrective Smooth/LENGTH_WEIGHTED/only-smooth/factor0.6/32 도구를 **뒤 목에만** 적용했다. 전신 remesh/생성·새 의존성·좌표 사후 복원·QA 기준 완화는 없다. 이전 후보/증거·개발 기본 A37·사용자 Blender 장면은 변경하지 않는다.

[별도 편집 원본](../../bodyguard_avatar_candidate_a89_rejected.blend) SHA-256 `b1263a8f7f8be59ff238f0615a2ab65f148ed94dfee02cabf4c4823b209d2d3c`. [제작 보고서](generation.json)의 pending은 제작 당시 상태이며 나중 결과로 다시 쓰지 않았다. 남142087/여139882정점·각163rest bones를 유지했다. 국소 최대 이동 남1.642217/여4.009153mm는 **기존6mm 아티스트 편집 guard** 안이며 사용자 측정/임상 수치가 아니다.

[저장 파일 독립 대조](saved-preservation.json)는 A37과 실제 저장된 A89를 다시 열어 전체 edge/face 위상·named skin·손·각163rest bones/행렬 동일, 영역 밖 남121062/여120406좌표의 **완전 동일**을 확인했다. 앞면과 목 위 머리 전체도 보호했다. posterior 범위/가중 마스크는 아티스트 에셋용이고 올바른 자세의 기준이 아니다.

[같은 원본 edge/원래 길이 분류를 고정한 진단](paired-original-edges.json)은 남 목114→102/여116→80, 손목 남30/34·여16/13 그대로였다. 제작 시 좌표를 재분류한103/85와 섞지 않는다. 이 수는 rest표면 아티스트 진단이며 외형/의학 합격이 아니다.

## 실제 원본·GLB 전체 검수

[원본](source-deformation.json)과 [GLB 실제 재수입](roundtrip-deformation.json)은 각각 **118개/121행/실패0·rendered:true**, 원본34PNG와 재수입34PNG를 실제 생성했다. 기존 원래1mm초과 edge ratio3미만을 유지하고 worst2.9439303671/2.9476798033, connected1/nonmanifold0/정규화 오류0·무의상/남녀 공통 재질을 확인했다. 20°는 기술 스트레스이며 임상/운동 정답이 아니다.

목 ratio 원본 남1.175452/1.177101·여1.323870/1.176640, 재수입 남1.175447/1.177119·여1.323748/1.175366이다. [native 왕복](glb-roundtrip.json)은 ratio1/8weights/1µm fin cleanup·기존3mm envelope/0.1mm bounds를 유지했다. 원본↔GLB 전체 geometry가 완전히 동일하다는 주장은 하지 않는다. native fin 정리 남6/여9, native 제한 weights300407/296607, 남 parent warning5개를 남긴다.

[남성 GLB](bodyguard-male-candidate.glb)12,656,976bytes/SHA `330f8af50d7784743efed95de7287a9ad4c5daeb7f52d583b9f0c003fcfed579`; [여성 GLB](bodyguard-female-candidate.glb)12,462,848bytes/SHA `7291cecad347558204d3068176f52f2585d303d151ddd5e399e6060f4e9a2c20`. 각5meshes/1skin/163joints/images·cameras·animations0. 재수입 남142081/여139873정점이다. 시범/리타게팅·올바른 운동 애니메이션 완료가 아니다.

## 실제 미리보기 / 잔여 외형

6첫 렌더+34원본+34재수입+2Chrome **76PNG 실제 생성**과 CEO 참조1PNG, 96사본/9gzip·decoded SHA를 보존한다. **직접 열람은 첫6/원본16/재수입16/Chrome2=40개**이며 전부76개를 열람했다고 표시하지 않는다.

- 원본: [정면](source/faceless-front.png), [3/4](source/faceless-quarter.png), 남 [전신 측면](source/faceless-body-side-male.png)/[뒤](source/faceless-body-back-male.png)/[머리·목 측면](source/faceless-side-male.png)/[목 좌](source/faceless-neck-male-left.png)/[목 우](source/faceless-neck-male-right.png)/[손](source/faceless-hand-male.png)/[무릎](source/faceless-knee-male.png), 여 [전신 측면](source/faceless-body-side-female.png)/[뒤](source/faceless-body-back-female.png)/[머리·목 측면](source/faceless-side-female.png)/[목 좌](source/faceless-neck-female-left.png)/[목 우](source/faceless-neck-female-right.png)/[손](source/faceless-hand-female.png)/[무릎](source/faceless-knee-female.png).
- 재수입: [정면](import/faceless-front.png), [3/4](import/faceless-quarter.png), 남 [전신 측면](import/faceless-body-side-male.png)/[뒤](import/faceless-body-back-male.png)/[목 좌](import/faceless-neck-male-left.png)/[목 우](import/faceless-neck-male-right.png)/[손](import/faceless-hand-male.png)/[무릎](import/faceless-knee-male.png), 여 [전신 측면](import/faceless-body-side-female.png)/[뒤](import/faceless-body-back-female.png)/[목 좌](import/faceless-neck-female-left.png)/[목 우](import/faceless-neck-female-right.png)/[손](import/faceless-hand-female.png)/[무릎](import/faceless-knee-female.png).
- 국소 확대: 남 [뒤 목](first/male-neck-back.png)/[정면](first/male-front.png)/[손목](first/male-wrist.png), 여 [뒤 목](first/female-neck-back.png)/[정면](first/female-front.png)/[손목](first/female-wrist.png).
- 실제 Chrome: [남성 두 모델](browser/male-two-models.png), [여성 두 모델](browser/female-two-models.png).

얼굴–앞목의 연속 실루엣은 최신 참조형으로 유지했다. **뒤 목의 거친 면/접힘과 기존 전완·손목 마감은 여전히 미달**이다. 기술PASS·국소 진단 감소를 전체 외형 통과로 확대하지 않는다. A-02 P2·A-08 전체 검수·S2.4/2단계/전체1~6 미완료, 개발 A37 그대로·Draft PR #9 미병합이다. 다음 안전한 작업은 얼굴/앞목을 그대로 보호하며 남은 연결부의 국소 표면/위상을 확인하는 것이다. head graft/전체 smoothing 반복으로 완료 처리하지 않는다.

## 실행·실패·재현

`engineering:debug`로 기존 문제/새 참조에 맞는 연속 원본을 대조하고 기존 도구를 최소 국소 범위에 재사용했다. `documentation`으로 최신 수용 기준과 실제/미실행 경계를 기록했고 `engineering:code-review` 기준으로 덮어쓰기 거부·SHA·native modifier 뒤 RNA 재조회·좌표/위상/skin/손/리그와 독립 저장 대조를 검토했다. 새 의존성/인체 원시 도형 생성은 없다.

maker 초회 Ruff는 기존 복사 helper의 C419와 format/exit1이었다. **native 실행 전에** generator 표현식/format을 정리하고 maker/checker의 기본 Ruff+format을 실제PASS해 실행했다. 실행 코드 SHA는 manifest의 gzip decoded SHA이며 초기 styleFAIL을 native 실패로 합산하거나 숨기지 않는다. 이번7 native/browser 실행은 모두 exit0이고 native 실패0이다. 전체 저장소 style검사 통과 주장은 없다.

모든 native 종료 후 설치 Chrome154.0.8037.93/Mac16,12·AppleM4·16GiB/headless1440×1080DPR1에서 실제3검사/41.457185s PASS, skip/flaky0. 남녀180RAF mean16.663333/16.666667ms·p9516.800000/16.900000ms, 21draw/triangles1,153,018·1,135,354·static0/moving.209436·.209439·독립 리그/eight-weight meshes2를 확인했다. 외부 프록시 차단과 WebGL loss/복구는 실제, guest401/model503은 모의·camera0/API/SQL/SMTP/OAuth 없음이다. NO_COLOR/Clock/WebGL cleanup 경고와 주입503을 남긴다.

실제 결과/장치·시간·모의 범위는 [실행 기록](execution-record.json)과 [browser JSON](browser-report.json)에 있다. RAF는 GPU·실제 카메라/추론/사람/목표 노트북 승인이 아니다. native 렌더 일부는 겹쳤으므로 그 시간을 성능 벤치마크로 사용하지 않는다. export/browser 경고를 숨기지 않는다.

**미실행:** 전체 서비스/API/Vitest/typecheck/build/저장소 style·시범/retarget/복합동작·실제 사람/웹캠/pose/video·여러 장치/목표 노트북/장시간/GPU timing·전문가·공급자/계정/시크릿/비용/운영 migration/배포/출시. 외부 상태 변경은 별도 승인 규칙을 유지한다.

반복 정합성 검사: `node bodyguard/assets/blender/review/candidate-a89-review/evidence-check.cjs <저장소 절대경로>`. [사본 manifest](copy-manifest.json)·[실행 기록](execution-record.json). 재현은 새 임시 폴더에 gzip 실행 코드를 풀고 설치 Blender5.1.1/기존 A37 원본을 사용해 반드시 **존재하지 않는 새 source/preview/report/export 경로**를 지정한다. 원본 입력SHA `9c3442444f3339c76fcbc6ca232965cf2d9e5173dc3b26b6a3c2b8f8f5a5810f`. stateful preservation 스크립트는 기존 archive에 재실행하지 않는다.
