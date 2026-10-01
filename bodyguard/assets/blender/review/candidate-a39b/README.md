# A39b — 목 contour 재구성과 실제 재검수

2026-10-01 · S2.4 A-02 보완. **원본·GLB 기술 검사와 실제 Chrome은 통과했지만 외형은 미통과다.** 남녀 공통 무의상 백색 중성 마네킹 결정을 유지했다. 개발 기본 모델은 A37 그대로이며 이 후보를 채택하거나 Draft PR #9를 병합하지 않는다. 전체 1~6단계·승인·안전 기준은 변경하지 않았다.

## 제작과 보존

[새 편집 원본](../../bodyguard_avatar_candidate_a39b.blend)은 A38의 전문 제작 신체를 Blender 5.1.1 native Bisect/Bridge Edge Loops(`SURFACE`, 12cuts, smoothness1)/Shrinkwrap으로 국소 재구성한 실제 파일의 동일 바이트 사본이다. 전신 생성·전신 smoothing·새 에셋/의존성·셰이더로 결함 숨기기를 하지 않았다. 조형 입력·검사 좌표는 아티스트 에셋이며 사람 측정값이 아니다.

제작 코드 `rebuild_mannequin_neck.py` SHA-256 `7758b87abdc7f56acf323cc72fd2f1e33b25c09a73b4e5856e0552470aecd4d9`. 실제 절단은 신체 높이의0.83/0.855다. 큰 contour의 **새 절단점만** 호 길이로 분배해 native dissolve하고 기존 저차수 정점에 연결된 절단점은 보존했다. 원본 곡면 투영은 새 bridge점에만 적용했다. 영역 밖 기존 신체 좌표·skin 가중치·보호 손과 각163bones/rest 행렬 불변, 닫힌 표면·정규화 가중치를 실행형 assertion으로 확인했다. 원형 envelope6mm 제한은 아티스트 변경 예산이지 임상/사용자 측정 정확도가 아니다.

| 원본 대비 실제 검사 | 남성 | 여성 |
|---|---:|---:|
| 원본 → 후보 정점 |142,087 →111,011|139,882 →107,581|
| 절단 contour edge, 조정 전 → 후 |246/1,163 →246/313|152/1,102 →152/162|
| 재구성 영역 기존 정점 / 새 bridge점 |38,343 /7,267|36,383 /4,082|
| 원본 표면 → 후보 envelope(mm) |0.553090|0.659546|
| 새 표면 → 원본 envelope(mm) |0.000133|0.000131|
| 영역 밖 기존 정점 누락 |0|0|

[실제 제작 보고서](neck-retopology-report.json)의 pending은 생성 직후 상태이며 소급해 수정하지 않았다. 신체 전체 위상이 A38과 같다는 주장이나 기존 동일 edge 비교를 이 재구성에 재사용하지 않는다. 필요한 곡선·관절을 삭제해 매끄럽게 만드는 대신 기존 전문 표면에 국소 conformance했고, 원본·왕복·변형·렌더를 다시 검사했다.

| 실제 파일 | SHA-256 |
|---|---|
| `bodyguard_avatar_candidate_a39b.blend` |`774204bbc7483feaf5e889450167d806de33d66308e75e63271464c34f1c0691`|
| `a39b-web.blend` |`e04ac52490fe750b1d6d2919a29bfee3def3f642d796247473a7fb18990fd4af`|
| `a39b-web-roundtrip.blend` |`f9c2981368d93889a299f5f53573a29374749bd377439956dea01b54d8de8dc1`|
| [남성 GLB](glb/bodyguard-male-candidate.glb), 9,922,640bytes |`5e7a080dfb88bf03b3c06cec82e53ebe943bf5ea6e0937a787ab8057d90c79df`|
| [여성 GLB](glb/bodyguard-female-candidate.glb), 9,620,884bytes |`d3fd61d489b057ce4467c319d83c457694e1d71757b0d8ae3b0aac89e13771f8`|

웹용 `.blend` 두 파일은 제작 임시 폴더에 보존했다. 이전 A27~A38 원본·GLB·검수 파일과 사용자의 Blender 장면은 바꾸지 않았다. 새 GLB는 별도 검수 공급만 했으며 frontend 기본/production 경로에 연결하지 않았다.

## 실제 원본·왕복·외형 검사

[원본 전체](source-deformation-report.json)·[GLB 재가져오기](web-deformation-report.json)는 각각118개 기술 변형·121행/실패0 PASS다. 최대 edge 비율2.943930367/2.947679803, 연결성분1/non-manifold0/정규화오류0이다. 기존 edge3미만·여덟 가중치 기준을 유지했다. 무의상·남녀 동일 중성 재질 검사를 실행했으며 의상 침투는 적용 대상 없음이다. 원본 actual34PNG(`rendered:true`), 왕복은 `--qc-only`라 추가 native 렌더 없음(`rendered:false`)이다.

[내보내기 보고서](roundtrip-report.json)는 배율/위치 통과·각5meshes/163bones·이미지/애니메이션0이다. 기존1μm 미세 정리 기준에서 fin 제거0/0으로 닫힘 검사를 통과했다. parent/influence 경고는 있었다. pending은 내보내기 당시 상태이며 경고0이나 올바른 운동 애니메이션 완료로 기록하지 않는다.

남녀 정면·뒤 목·손목을 A38과 같은 camera/1000×1000/32samples로 각각 실제 렌더했다. [여성 뒤 목](female-neck-back.png) 대 [A38](baseline-a38-female-neck-back.png)의 날카로운 연결은 줄었지만 [남성 뒤 목](male-neck-back.png)에 잔여 돌출이 있고 [여성 목 기울임](faceless-neck-female-left.png)에 접힘/찢김처럼 보이는 표면 결함이 남는다. 참조 대비 재질·실루엣·전완 정제도 미완료다. **non-manifold0이나 기술 PASS는 변형 외형 통과가 아니다. A-02 P2 유지, 채택/병합 보류다.**

이 폴더의 최신 PNG는 native40컷(전체34+별도6), 동일 조건 A38비교6컷, 실제 Chrome2컷으로48개다. `history/`의 이전 A39 PNG1개는 이 수에 포함하지 않는다.

## 실제 설치 Chrome

backend `tests.run_browser avatar`에 위 GLB 디렉터리를 별도 공급했다. [실제 결과](browser-report.json)는 **3개/40.315642s PASS, skip0/flaky0**이다. 외부 차단 A-00·GLB byte 해시·추가 가중치·독립 두 뼈대/한쪽만의 합성 변형·정지·제어된503/context-loss 복구·이탈·카메라 요청0회를 확인했다. [남성](male-two-models.png)/[여성](female-two-models.png)은 실제 Chrome 화면이다. 후보 공급 검사이지 A39b 기본 경로 연결 후 검사나 실제 사람 코칭 시험이 아니다.

| 두 모델 기술 렌더 | 표본 | mean(ms) | p95(ms) | draw calls /triangles |
|---|---:|---:|---:|---:|
| 남성 |180|16.666111|17.900000|21 /904,442|
| 여성 |180|16.666667|17.500000|21 /876,994|

Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·AppleM4·16GB, native 제작/렌더 종료 후 측정이다. renderer는WebKit WebGL, GPU 상세/전원/전체 부하는 미수집이다. render 간격은 GPU 시간·웹캠15fps·피드백1초·다른 노트북 성능의 증거가 아니다. native 일부는 동시 실행했으므로 그 소요 시간을 성능 비교에 쓰지 않는다. NO_COLOR/Three.Clock/WebGL 경고와 의도된503 오류가 있었다. 계정 서버/DB/메일·실제 카메라는 시작하지 않았다.

## 실패 기록과 재현

- 초기0.83/0.89 bridge는 남성 원형 편차19.70/23.35mm로6mm guard 실패, 저장/전체 QA 없음.0.83/0.86은 여성9.88mm, smoothness0.5는 여성9.52mm,0.83/0.855만 적용한 시험은 여성7.10mm로 각각 저장 전 실패했다. 실패 예산을 늘리지 않았다.
- 새 점 native conformance를 적용한 [첫 A39 원본](../../bodyguard_avatar_candidate_a39_rejected.blend), SHA-256 `65e0988918d7fca7b3d3016f0e79994cbc441a288758739c883f63c50af73685`, 은 [실제 원본121행/118개](history/a39-source-deformation-report.json)를 통과했지만 GLB 내보내기에서 닫힘 오류/exit1로 실패했다. [실제 이전 렌더](history/a39-body-back-male.png)를 보존했다. 당시 웹/GLB/왕복 보고서 생성·브라우저 검수는 미실행이다. 이 원본 제작 당시 코드 SHA는 `03b1fe17ddf600ee66452c64ebb335e1f78e03a909e2713f16003eac8afc18ed`이며 현재 코드와 구분한다.
- 실제 진단에서 크기가 다른 dense contour가 투영 후 미세 collapsed strip을 만들었다.10μm neck 중복 정리 실험도 닫힘 실패로 채택하지 않았다. dissolve 초회와 face-split 변경만의 시험은 영역 밖 기존 남성 정점1개가 제거돼 preservation guard로 저장 전 실패했다. 기존 저차수 정점과 이웃한 새 절단점을 보존한 현재 후보에서 재검수했다. exporter 정리 허용값을 올리거나 non-manifold 실패를 무시하지 않았다.
- 최신 코드로 이미 존재하는 A39b 출력에 실행한 대조는 `FileExistsError`/exit1, upper-ratio`nan`은 `ValueError`/exit1로 생성 전에 거부했다. 기존 A39b/A38 해시는 동일하고 실패 출력/보고서는 생성되지 않았다. 예상 거부를118개 합격 수에 더하지 않는다.

저장소 루트·설치 Blender에서 **존재하지 않는 새 출력 경로**를 쓴다. 사용자 장면·기존 파일을 덮지 않는다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a38.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/rebuild_mannequin_neck.py \
  -- /private/tmp/bodyguard-new-neck.blend /private/tmp/bodyguard-new-neck.json 0.855
```

전체 원본/내보내기/왕복은 [기존 실행법](../../README.md)에서 새 source/output을 지정한다. 원본/왕복에 `--candidate --mannequin`, 왕복에 `--qc-only`를 사용했다. backend에서 `BODYGUARD_AVATAR_QA_DIRECTORY=<이 폴더의 glb 절대 경로> PLAYWRIGHT_JSON_OUTPUT_NAME=<새 JSON 절대 경로> .venv/bin/python -m tests.run_browser avatar`로 설치 Chrome을 재현한다. 브라우저 측정 전에 native 제작/렌더를 종료한다.

`engineering:code-review`로 제작 범위·덮어쓰기/유한 입력 거부·native dissolve의 기존 정점 보존·RNA 재조회·좌표/가중치/손/리그 guard·실제/모의/미실행 경계를 점검했다. 새 코드의 미해결 P1/P2는 없으나 Story의 **실제 외형 P2는 미해결**이다. 이번 변경은 native 제작/에셋/증거이며 API160·Vitest133·계정/Google·production build의 이전 결과를 재실행으로 세지 않는다. 실제 사람·올바른 운동 시범·사용자 리타게팅·최종 외형·단계2·실제 공급자·1~6단계/출시는 미완료다. 별도 승인 외부 작업은 실행하지 않았다.

커밋 전 native 전체 Ruff lint·새 제작 파일 format, 변경 Markdown5파일/로컬 링크91개(누락0)·최신48PNG/역사1PNG 분리·`git diff --check`를 실제 통과했다. 전체 native format의 이전 미변경3파일 문제는 해결하지 않았으며 전체 format PASS라고 표시하지 않는다.
