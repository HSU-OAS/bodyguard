# A40b 반려·목 검사 누락 보완

2026-10-01 · S2.4 A-02/A-04. **A40b는 실제 원본·GLB 기술 검사와 Chrome을 통과했지만 목 외형 결함이 그대로여서 반려했다.** 남녀 무의상 백색 중성 마네킹 결정·자연 곡선/관절·기존 리깅 정확도 기준을 유지한다. 개발 기본 A37, 외형 P2, Draft PR #9 병합 보류, 전체 1~6단계/별도 승인 경계는 그대로다. 실패한 smoothing 실험은 현재 제작 코드에 남기지 않았다.

## 먼저 보완한 검사

이전 `review_avatar.py`는 사지 스트레스에 원래 길이 1mm 초과 edge의 변형 비율3미만을 검사했지만, 목 네 포즈에서는 회전축/각도와 의상만 검사했다. **기존118개 PASS에 목 skin-stretch 검사가 있었다고 소급하지 않는다.** 동일 edge 계산을 재사용해 목 좌우에도 같은 기준을 적용했다. 개수118개/121행은 그대로며 네 목 행에 `edge_ratio_max`를 추가했다. 기술 검사값이지 의학적 목표 각도·사람 판정 기준이 아니다.

- [기존 A39b의 실제 보강 검사](diagnostics/a39b-enhanced-neck-qa.json): 원본을 저장하지 않고 `--qc-only`로121행/실패0/exit0. 남성 좌우1.214349/1.207472, 여성1.288001/1.180155다. A39b/A38 원본 SHA는 동일했다.
- [실제 음성 대조](diagnostics/neck-scaled-negative-qa.json): 별도 background 장면에서 여성 `neck01.scale=(25,25,25)`만 주입하고 원본은 저장하지 않았다. head 회전축/20° 자체는 통과하지만 여성 목 edge 비율39.488032/39.479638로 실패를 수집했다. 전체121행/실패59(`목2+사지57`)/`passed:false`/exit1, 렌더 없음이다. 예상 실패를 합격 개수에 더하지 않는다.
- 이번 검사 코드 SHA-256은 `f712444c95cff9f56fbfb1a7d03580b2d9a3321fe7e11b93cf8f6448e0c83a39`다. 이는 아래 A40b 원본/왕복과 위 대조를 실제 실행한 코드다.

## 실제 제작·보존

[별도 편집 원본](../../bodyguard_avatar_candidate_a40b_rejected.blend)은 A38 전문 신체의0.83/0.855 밴드에 native Bisect/Bridge(`SURFACE`,12cuts,smoothness1)를 적용하고, 새 bridge점만 **임시 참조 표면**에 Shrinkwrap한 실제 파일의 동일 바이트 사본이다. 참조에만 native CorrectiveSmooth(`only_smooth`,length-weighted,factor0.8,64iterations)를 적용했고 저장 전에 참조를 제거했다. 영역 밖 기존 좌표·가중치/보호 손·각163bones/rest 행렬은 실행형 assertion으로 보존했다. 전신 smoothing·인체 재생성·새 의존성/에셋·수치 기준 완화는 없다.

당시 제작 코드 SHA는 `3a6c35938b67a2125290e4599e532b5bdb4b50ca01dd93248cad325512566819`다. 현재 코드에서 이 실패한 참조 정제는 제거했으므로 **현재 제작 스크립트가 이 A40b를 그대로 재생성한다고 주장하지 않는다.** 검수는 보존된 실제 원본/GLB로 재현한다. [제작 보고서](neck-retopology-report.json)의 pending은 생성 당시 상태라 소급 변경하지 않았다.

| 실제 제작 검사 | 남성 | 여성 |
|---|---:|---:|
| 원본 → 후보 정점 |142,087 →111,011|139,882 →107,581|
| contour edge 조정 전 → 후 |246/1,163 →246/313|152/1,102 →152/162|
| 원본 → 후보 envelope(mm) |1.445035|3.307953|
| 후보 → 원본 envelope(mm) |1.137465|3.345813|
| 영역 밖 기존 정점 누락 |0|0|

6mm envelope는 아티스트 변경 예산이지 사용자 측정 정확도다. 위상 재구성 후 기존 동일 edge ID 비교를 전신 보존 증거로 재사용하지 않는다.

| 실제 파일 | SHA-256 |
|---|---|
| `bodyguard_avatar_candidate_a40b_rejected.blend` |`46f21f6ecd1a13f7cc7b32c63eb0fc170deeae08874f10c7d44db69ef7f5c858`|
| 임시 `a40b-web.blend` |`2c7af2da0fbd158e61ad3385490c1f323ff049473209e4fddf02f58072ea85a1`|
| 임시 `a40b-web-roundtrip.blend` |`dc91d6ee9500fd4b6282f09eb2a7a09d1963ffe320780a287cf16e8d9d076b24`|
| [남성 GLB](glb/bodyguard-male-candidate.glb),9,922,640bytes |`5aa598e2d950cc653f3756ae93b8c4edb1557916abe55e6cb2bdf1bccaf25daf`|
| [여성 GLB](glb/bodyguard-female-candidate.glb),9,620,972bytes |`c64cbebc45bf4ee8f580e53b919685f070ef62127c86265c85029206bd238928`|

웹용 두 `.blend`는 `/private/tmp/bodyguard-tailor.6b7Uvu/`에 보존했다. 이전 A27~A39b 원본·GLB·검증 증거와 사용자 장면은 덮거나 삭제하지 않았다. 새 GLB는 별도 검수 공급에만 썼고 frontend 기본/production 모델에 연결하지 않았다.

## 실제 전체 검사와 외형 판단

[원본 전체 검사](source-deformation-report.json)는118개 기술 변형/121행/실패0/`rendered:true`, [GLB 재가져오기](web-deformation-report.json)는118개/121행/실패0/`--qc-only`/`rendered:false`다. 최대 edge 비율은 각각2.943930367/2.947679803, 연결성분1/non-manifold0/정규화오류0이다. 목 skin-stretch 추가 검사와 무의상/동일 재질 검사를 실제 실행했다. GLB 남성 목 최대1.221066, 여성1.288048이다. 의상 침투는 적용 대상 없음이며 해부학·운동 시범 승인으로 확대하지 않는다.

[내보내기 보고서](roundtrip-report.json): 배율/위치 PASS, 각5meshes/163bones, 이미지/애니메이션0, fin 제거0/0. parent/influence 경고가 있었다. pending은 생성 당시 상태이며 경고0·운동 액션 완성으로 표시하지 않는다.

원본 실제34PNG, 실제 Chrome2PNG, 이전 A39b 동일 camera 비교2PNG로 총38PNG를 보존했다. [여성 목 좌측](faceless-neck-female-left.png) 대 [A39b](baseline-a39b-neck-female-left.png)의 찢김처럼 보이는 표면 결함은 여전히 남는다. [남성 뒤 목](faceless-body-back-male.png) 대 [A39b](baseline-a39b-body-back-male.png)에도 잔여 돌출이 있다. 참조 대비 재질·실루엣·전완 역시 미완료다. **기술 PASS로 외형을 승인하지 않는다. A40b 미채택/A-02 P2 유지다.**

## 실제 설치 Chrome

[실제 결과](browser-report.json)는3개/40.514477s PASS, skip0/flaky0이다. GLB byte 해시·여덟 가중치, 독립 두 뼈대/한쪽 합성 변형/정지, 제어된503/context-loss 복구, 이탈, 카메라 요청0회와 외부 차단 A-00을 검사했다. [남성](male-two-models.png)/[여성](female-two-models.png)은 실제 Chrome 화면이다. 후보 공급 검사이지 개발 기본 연결 후 검사나 실제 사람 코칭이 아니다.

| 두 모델 렌더 | 표본 | mean(ms) | p95(ms) | draw calls /triangles |
|---|---:|---:|---:|---:|
| 남성 |180|16.666667|17.500000|21 /904,442|
| 여성 |180|16.666667|18.100000|21 /877,002|

Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·M4·16GB, 모든 native 제작/렌더 종료 후 측정했다. renderer는WebKit WebGL, GPU 상세/전원/전체 부하 미수집이다. 프레임 간격은 GPU 시간·웹캠15fps·피드백1초·다른 노트북의 증거가 아니다. NO_COLOR/Three.Clock/WebGL 경고와 의도된503 오류가 있었다. wrapper 소유5182/비청취 프록시만 썼으며 계정 API/DB/SMTP·실제 카메라는 시작하지 않았다.

## 실패·원인 진단·미실행

- LINEAR/free bridge A40는 여성 원형 편차10.214/10.792mm로6mm guard/exit1 실패했다. 출력 `.blend`/보고서 생성 전 중단했고 GLB/전체 QA/브라우저는 실행하지 않았다. 정확한 실행 코드 SHA는 미수집이며 다른 시점의 코드 SHA로 대체하지 않는다.
- [A39b](diagnostics/a39b-neck-stress.json)·[A40b](diagnostics/a40b-neck-stress.json)의 실제 read-only 중립/목 좌우6포즈 진단: 확대 영역의 남성 장-edge 접힘314/314/311 →316/316/313, 여성129/130/128 →129/126/130. 뚜렷한 일관 개선이 없어 외형 반려를 유지했다. 위상 변경 전후 고정 edge 비교나 임상 판정이 아니다.
- [A40c 생성 진단](diagnostics/a40c-generation.json)은 bridge점 투영 전부터 남/여338/127개 접힘, 임시 참조 정제 투영 후306/118개였다. [A41 새 절단 contour XY 정제](diagnostics/a41-generation.json)는1,218/350 →881/320으로 더 악화돼 제거했다. 이 수치는 길이1mm 초과/양끝점이 실제 절단 밴드 내/face angle90° 초과의 **엄격 밴드 진단**으로 앞의 확대6포즈 수와 정의가 다르다.
- [현재 코드 A42 실행](diagnostics/a42-generation.json)은 실패한 smoothing을 제거하고 기존 A39b 방식에 진단만 추가했다. 투영 전338/127, 후314/129다. **투영 전 bridge 단계부터 접힘이 존재하며 Shrinkwrap만 원인이라고 단정할 수 없다.** 다음 제작은 경계 대응/전문 원본의 연속 목 구조를 직접 확인한다. 공식 기존 body 에셋을 실제 read-only 검사해 남녀 각10,582정점/경계edge0을 확인했지만 이것만으로 수정·변형 외형 통과를 주장하지 않는다.
- A40c/A41/A42는 native 생성·보존/geometry assertion까지만 실행했다. **전체 변형 QA·GLB·Chrome·외형 렌더 미실행**이며 A40b 결과를 이 후보들의 결과로 돌리지 않는다. 실제 원본은 같은 제작 임시 폴더에 별도로 보존했다: `draft-a40c-neck-native.blend` SHA`fc5237ea68e5c957507453ae4eb98a40e8fbee4fadb855a7b931b2fa1c87ef48`, `draft-a41-neck-native.blend` SHA`2279681a95dfd21df1678f9f45baff84f2c9d88e3ea00750fb81e80f167220f5`, `draft-a42-neck-diagnostic.blend` SHA`e3f2e1aafc7e4de424fc72192c5e4027b7cdba44201a99672fbbe807dfc5820d`.

현재 `rebuild_mannequin_neck.py` SHA는 `2bf85ed2e0a607f6f21989f4e3d0c1c3435a09309671fb303007f51c7e990125`다. native 생성 결과에 band 접힘 전후를 기록하지만 합격 판정을 추가하지 않았고 원형/보존 guard도 낮추지 않았다. 이 코드는 A42 생성 진단만 실제 실행했으며 A40b 제작 코드와 구분한다.

## 재현과 검토

저장소 루트에서 존재하지 않는 새 검수 폴더를 쓴다. 아래는 보존된 A40b 검사이며 생성 방법을 현재 코드로 바꿔 설명하지 않는다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a40b_rejected.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/review_avatar.py \
  -- /private/tmp/bodyguard-new-a40b-review --candidate --mannequin
```

왕복/Chrome 재현은 [기존 실행법](../../README.md)을 사용하고 이 폴더의 GLB를 별도 공급한다. 음성 대조는 기존 A39b에 `--python-expr`로 `bpy.data.objects['BODYGUARD Female rig WIP'].pose.bones['neck01'].scale=(25,25,25)`를 설정한 다음 `runpy.run_path('<review_avatar.py 절대 경로>',run_name='__main__')`를 호출해 `--candidate --mannequin --qc-only`를 지정한다. 원본 저장 명령은 실행하지 않는다.

`engineering:documentation`에 따라 실제·예상 실패·미실행을 분리하고 과거 검증 범위를 정정했다. `engineering:code-review`로 같은 edge 집합/기준의 목 적용, 실패 수집, 기존 파일/신체 보존, 진단과 품질 게이트의 경계를 점검했다. 새 코드의 미해결 P1/P2는 없지만 **Story 외형 P2는 미해결**이다. API160·Vitest133·계정/Google·production build의 과거 결과를 이번 재실행으로 세지 않는다. 실제 사람 동작/시범/리타게팅·공급자·2단계/1~6단계·출시는 미완료이며 별도 승인 작업은 실행하지 않았다.

커밋 전 native 전체 Ruff lint·변경 Python2파일 format·변경 Markdown5파일의 로컬 링크100개(누락0)·38PNG 수·원본/GLB/이전 원본 SHA5파일·실제 보고서 assertion·`git diff --check`를 통과했다. 새 README 구조 검사도 통과했다. 보조 구조 검사의 초회는 코드 fence 내 주석을 제목으로 오인해 수정했고, 기존 `tasks.md`의 미변경 목록 앞 빈 줄 문제는 보존했다. 기존 문서 전체 구조 검사나 이전 native3파일의 전체 format을 PASS라고 표시하지 않는다.
