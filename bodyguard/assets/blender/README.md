# Blender 아바타 작업 원본

2026-10-02 [A50·A51 전문 head/경계 대응](review/candidate-a50-a51-rejected/README.md), [A52·A53 PATH/법선 대조](review/candidate-a52-a53-rejected/README.md), [A55 LINEAR/리그 정렬](review/candidate-a55-rejected/README.md)의 별도 원본과 실제40PNG를 보존했다. 각각 원본118개·121행은 완료했지만 외형 미달로 미채택한다. 이 다섯 후보의 전체34컷·GLB·왕복·Chrome은 미실행이다. [A54 목 국소 정제](review/candidate-a54-rejected/README.md)는 기존6mm guard/exit1로 저장 전에 중단됐다. 여성 무의상/남녀 같은 백색 표면·자연 곡선/관절·구조/리그 보존·기존 증거/개발 A37·외형 P2·병합 보류·1~6/승인 기준을 유지한다.

2026-10-01 [A49 별도 반려 원본](bodyguard_avatar_candidate_a49_rejected.blend)·[실제 원본/GLB/Chrome·36PNG·밀도/법선 진단·해시](review/candidate-a49-rejected/README.md)를 보존했다. native 경계 점 수 대응으로 각118개·Chrome3개·합성 대조6개를 실제 완료했으나 목 경계 외형은 미달이다. 다음은 전문 head–목 형상/정렬 대조이며 기본 제작 코드/개발 A37은 변경하지 않는다. 여성 무의상/남녀 같은 백색 표면·자연 곡선/관절·구조/리그 보존·외형 P2·병합 보류·전체 완료/승인 기준은 유지한다.

2026-10-01 [A48 별도 반려 원본](bodyguard_avatar_candidate_a48_rejected.blend)·[원본/GLB/Chrome·36PNG·좌표/법선 진단·해시](review/candidate-a48-rejected/README.md)를 보존했다. 동일 전문 목/12mm에서 native LINEAR 비교의 실제 형상 차이를 확인했고 각118개·Chrome3개를 실제 완료했다. 목 경계 외형은 미달이므로 기본 제작 SURFACE·개발 A37은 변경하지 않는다. 여성 무의상/남녀 통일 표면·구조/리그 보존·외형 P2·PR #9 병합 보류와 전체 완료/승인 기준은 유지한다.

2026-10-01 [A47 반려 원본](bodyguard_avatar_candidate_a47_rejected.blend)·[실제 원본/GLB/Chrome·36PNG·법선 진단/해시](review/candidate-a47-rejected/README.md)를 보존했다. 전문 목0.81/0.87 범위·12mm native 연결로 얼굴 돌출은 피했으나 목 경계가 남아 미채택한다. 원본/GLB 각118개·Chrome3개·경계7/입력8회귀를 실제 실행했다. 전문 패치/영역 밖 신체·skin·손·리그, 기본 A37·여성 무의상 결정·외형 P2·병합 보류·완료/승인 기준은 유지한다. 다음은 bridge 곡면/접선·경계 대응 수정이다.

2026-10-01 [A46b 반려 원본](bodyguard_avatar_candidate_a46b_rejected.blend)·[실제 원본/GLB/Chrome·36PNG·경계 진단/해시](review/candidate-a46b-rejected/README.md)를 보존했다. `replace_neck_from_artist.py`는 proven 내부 경계만 native 닫힘 처리하고 bridge에 정확히 두 단순 경계만 허용한다. `test_neck_cut.py`의 정상/오류 대조7개, 원본/GLB 각118개·Chrome3개를 실제 실행했다. 입/턱 특징과 수평 돌출로 **미채택·기본 A37/외형 P2/병합 보류 유지**다. 단면 높이만 반복하지 않고 얼굴 특징 없는 전문 목 범위와 머리 경계 조형/정렬을 다음에 수정한다. 기존 파일/증거·여성 무의상 결정과 완료/승인 기준은 그대로다.

2026-10-01 [A44b](bodyguard_avatar_candidate_a44b_rejected.blend)·[A45](bodyguard_avatar_candidate_a45_rejected.blend) 전문 목 패치 후보와 [실제 원본/GLB/Chrome·72PNG·해시·실패 기록](review/candidate-a44b-a45-rejected/README.md)을 보존했다. `replace_neck_from_artist.py`는 기존 CC0 전문 목 일부를 native 절단·가중치 전송·곡면 연결하며 전문 패치/영역 밖 좌표·skin·손·리그를 보존한다. 각118개/Chrome3개 PASS에도 목 경계 외형 P2가 남아 두 후보 미채택·개발 기본 A37 유지다. 이전 원본·GLB·증거는 삭제하지 않았다.

2026-10-01 [A40b 반려 원본](bodyguard_avatar_candidate_a40b_rejected.blend)·[목 검사 보완/실제 재검수/실패 진단](review/candidate-a40b-rejected/README.md)을 보존했다. 목에도 기존 사지 skin-stretch 기준을 적용하고 실제 양성/음성 대조를 실행했다. 별도 후보 원본/GLB 각각118개·Chrome3개는 통과했으나 외형 P2는 남아 미채택이며 개발 기본 A37은 그대로다. 현재 제작 코드에는 실패 smoothing 대신 native bridge 투영 전후의 **진단**만 추가했다.

2026-10-01 [A39b 새 원본](bodyguard_avatar_candidate_a39b.blend)·[실제 원본/GLB/Chrome 재검수와 이전 실패](review/candidate-a39b/README.md)를 보존했다. `rebuild_mannequin_neck.py`는 전문 A38 목 contour를 native 재구성하며 기존 영역 밖 신체·skin/손/리그와 원형 envelope를 검사한다.118개 기술 변형과 Chrome 통과에도 실제 변형 외형 결함이 남아 **미채택/개발 기본 A37 유지**다. [첫 A39 GLB 실패 원본](bodyguard_avatar_candidate_a39_rejected.blend)도 별도 보존했다.

2026-10-01 A38 [별도 편집 원본](bodyguard_avatar_candidate_a38.blend)·[손목/뒤 목 실제 비교와 전체 재검수](review/candidate-a38/README.md)를 보존했다. `refine_mannequin_joins.py`는 전문 A37의 국소 표면만 native 정제하고, `diagnose_mannequin_joins.py`는 같은 원본 edge/길이 분류를 고정해 비교한다. 기존 파일 덮어쓰기·인체 재생성·리그/가중치 변경을 하지 않는다. 전체 기술 변형과 Chrome은 통과했지만 목표 외형은 미달이라 **A38은 채택하지 않았고 기본 개발 모델은 A37 그대로**다.

2026-10-01 CEO 변경: 남녀 모두 별도 의상 없는 백색 중성 마네킹을 목표로 한다. 여성 참조의 의상 요구만 대체했다. 새 [A37 편집 원본](bodyguard_avatar_candidate_a37.blend)·[실제 원본/GLB/웹/외형 검수](review/candidate-a37/README.md)를 추가했고 개발 검수 화면만 A37로 연결했다. 이전 A27/의상/실패 증거는 보존한다. **최종 외형 P2와 실제 코칭 검증은 남아 있다.** 아래 A27·studio 제작 기록은 역사적 상태다.

2026-10-01: 기존 studio 원본과 [A27 후보](bodyguard_avatar_candidate_a27.blend)를 보존했다. 원본 118개·새 여덟 가중치 GLB 왕복 118개 기술 변형과 실제 Chrome 두 모델 검사를 통과했다. **외형은 미통과**다. [새 웹 검수](review/web-eight-weight/README.md)와 [이전 네 가중치 실패](review/web-candidate/README.md)를 구분한다. 어느 파일도 합격한 출시 아바타가 아니다.

`bodyguard_avatar_studio.blend`는 **제작 중인 편집 원본**이다. 배포용 GLB나 합격한 아바타가 아니다. 기존 MPFB 시제품을 조형 베이스로 채택하지 않고, [Blender Foundation Human Base Meshes v1.4.1](https://www.blender.org/download/demo-files/)의 CC0 남녀 realistic body와 전문 제작 head 메시로 교체·조형했다. CEO의 남녀 참조 이미지는 파일 안에 패킹했다. 얼굴 요소를 제거하고 머리·목 표면을 연결했으며, MPFB core 리그·가중치를 전송했다. **아직 의상·관절 표현, 전체 관절 변형 검수, 시범 애니메이션과 웹 성능 검증은 없다.**

Blender에서 파일을 열어 `CEO references - modeling only` 컬렉션의 참조와 메시를 비교한다. 남성 메시 `BODYGUARD Male sculpt WIP`, 여성 메시 `BODYGUARD Female sculpt WIP`, 리그는 각각 `BODYGUARD Male rig WIP`, `BODYGUARD Female rig WIP`이다. 원본을 직접 편집할 수 있고 외부 메시 파일이나 실행 중인 Blender MCP 연결을 요구하지 않는다.

검수 이미지: [이전 시제품](review/mpfb-rejected-front.png), [새 조형 베이스의 시작 상태](review/sculpt-base-front.png), [현재 정면](review/faceless-front.png), [3/4](review/faceless-quarter.png), 측면 [남성](review/faceless-side-male.png)·[여성](review/faceless-side-female.png), 목 기울임 [남성 좌](review/faceless-neck-male-left.png)·[우](review/faceless-neck-male-right.png), [여성 좌](review/faceless-neck-female-left.png)·[우](review/faceless-neck-female-right.png). **외형 개선과 기초 리깅만으로 참조 품질이나 올바른 코칭 동작이 완성된 것은 아니다.** 차이와 다음 검수는 [제작 계약](../../docs/avatar-production.md)에 기록했다.

## 반복 검수

새 무의상 후보는 `review_avatar.py -- <새 검수 폴더> --candidate --mannequin`으로 전체118개 기술 변형·실제 렌더·동일 재질/무의상 조건을 검사한다. GLB 재가져오기도 같은 옵션을 사용하며 `--qc-only`는 렌더만 생략한다. 기존 의상 후보에는 `--mannequin`을 적용하면 의상 조건에서 실패한다. `unify_mannequin_surface.py -- <새 원본> <새 렌더 폴더>`는 A36 같은 전문 기존 후보에서 의상만 제거하며 신체 좌표/가중치/리그 불변을 검사한다. 이미 있는 출력 파일을 덮지 않는다. 유두·생식기 사실적 세부/실루엣의 최종 판단은 실제 렌더 검수 대상이며 자동 수치 PASS로 대신하지 않는다.

Blender 5.1.1에서 실행했다. 로컬 Blender 실행 파일을 지정하고 저장소 루트에서 실행한다. 출력 폴더는 검수 이미지를 새로 생성할 곳이며, 원본 `.blend`는 저장하거나 변경하지 않는다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  -b bodyguard/assets/blender/bodyguard_avatar_studio.blend \
  --python-exit-code 1 \
  --python bodyguard/assets/blender/review_avatar.py \
  -- /private/tmp/bodyguard-avatar-review
```

남성 base vertex 95,962개·여성 93,746개, 각각 163 bones·139 deform weight groups다. 전신이 보존됐는지, 좌표·가중치가 유한한지와 연결 성분 1개, non-manifold edge 0개, 가중치 합 미달/초과 정점 0개를 검사한다. 네 목 뼈의 회전축을 **장면 좌표에서 변환**해 남녀 좌우 기울임을 재현한다. `20°`는 변형 시험값이지 사용자에게 요구하는 각도나 운동 처방이 아니다. 이 조형용 밀도가 웹에서 적합한지는 검증하지 않았으며 자동 위상 검사도 육안 검수를 대체하지 않는다.

## 선택 사항: 처음부터 다시 만들기

현재 원본 편집·검수에는 재생성이 필요 없다. 두 생성 스크립트는 제작 경로를 남긴 것이며, 다시 생성하려면 별도로 받은 공식 번들과 로컬 MPFB donor `.blend`가 필요하다. donor의 남녀 메시·리그 이름은 `Bodyguard_Male_Base`, `Bodyguard_Male_Base.rig`, `Bodyguard_Female_Base`, `Bodyguard_Female_Base.rig`여야 한다. 원래 donor 파일은 변경하지 않는다.

1. `prepare_sculpt_studio.py`에 공식 번들, 여성 참조, 남성 참조, **새 base-studio 경로**를 전달한다.
2. 생성된 base-studio를 `-b`로 열고 `refine_avatar_studio.py`에 공식 번들, donor, **새 draft 경로**를 전달한다.
3. draft에 위 검수 하네스를 실행하고 이미지를 대조한 뒤 편집 원본을 선택한다.

각 실행에 `--python-exit-code 1`을 사용한다. 두 생성 스크립트는 이미 존재하는 출력 파일을 덮어쓰지 않는다. 합격 여부를 확인하지 않은 파일을 작업 원본에 자동 반영하지 않는다.

## 에셋 출처와 권리

기초 조형 메시 출처: [Blender Foundation 공식 데모 파일, Human Base Meshes v1.4.1 (CC0)](https://www.blender.org/download/demo-files/). 번들의 `GEO-body_male_realistic`, `GEO-body_female_realistic`, `GEO-head_male_primitive_realistic`, `GEO-head_primitive_female_realistic`을 사용했다. 이름의 `primitive`는 전문 제작자가 제공한 head 에셋 분류이며, 코드로 구·원기둥을 조합해 인체를 만든 것이 아니다. [원본 아카이브](https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip)의 SHA-256은 `811f43accbb31a88266d932f8f5563b2d13586fca0ba2693aad1f5fe582b3515`다. 전체 번들은 저장소에 넣지 않았다.

리그·가중치 출처: MPFB standard/core assets. [MakeHuman/MPFB 공식 라이선스](https://static.makehumancommunity.org/about/license.html)는 core assets CC0와 프로그램 소스 GPL/AGPL을 구분한다. 기존 studio에는 donor의 core 리그·가중치만 가져왔다. A27 후보는 core의 전문 제작 손 메시와 대응하는 리그/가중치도 함께 사용해 손목에서 전문 body에 연결했다. donor `bodyguard_mannequins_working.blend` SHA-256은 `87a75e038013714b2ca3b73304759e522c1966f59ddebfe2c598410f81cc2e6c`다. 플러그인 소스, 커뮤니티 의상·피부·모션은 포함하지 않았다. 후보 의상은 전문 body에서 Blender native 표면 편집·투영·두께·스킨 바인딩으로 만든 파생 표면이다. 새로운 외부 에셋은 추가 전 라이선스를 별도로 기록한다. 참조 이미지는 모델링용이며 GLB·제품 화면·마케팅 이미지로 자동 재사용하지 않는다.

## A27 후보 제작·왕복 검수

원본은 자체 메시·리그·의상·재질이 포함돼 donor 없이 편집/검수할 수 있다. 처음부터 재생성할 때만 위 donor가 필요하다. 모든 출력은 **존재하지 않는 새 경로**를 쓴다. 사용자 Blender/MCP 장면이나 기존 studio를 수정하지 않는다. 저장소 루트에서 실행하며 macOS의 Metal 렌더링 권한이 필요할 수 있다.

```bash
# 선택 사항: 기존 studio + 로컬 CC0 donor로 새로운 후보 제작
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_studio.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/make_avatar_candidate.py \
  -- /private/tmp/bodyguard-new-candidate.blend /private/tmp/bodyguard-new-candidate-render \
  /private/tmp/bodyguard-avatar-assets/bodyguard_mannequins_working.blend

# 추적한 실제 A27 원본: 118개 기술 검사 + 실제 렌더
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a27.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/review_avatar.py \
  -- /private/tmp/bodyguard-a27-review --candidate

# 별도 웹 파일/GLB/roundtrip 생성. 기본 비율 1, 원본 덮어쓰기 없음
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a27.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/export_avatar_candidate.py \
  -- /private/tmp/bodyguard-new-web.blend /private/tmp/bodyguard-new-web-glb

# 현재 여덟 가중치 왕복은 118개 기술 검사 통과. 외형/운동 정답 승인 아님
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b /private/tmp/bodyguard-new-web-roundtrip.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/review_avatar.py \
  -- /private/tmp/bodyguard-new-web-review --candidate --qc-only
```

`--qc-only`는 렌더만 생략하고 검사를 생략하지 않는다. 실패 목록·JSON·nonzero exit를 남긴다. 단일 관절 스트레스 검사와 의상 표본은 해부학·운동 정답·외형의 전문가 승인이나 실제 웹캠 사용 검증을 대체하지 않는다. native export의 남성 첫 선택에서 parent 경고가 있었으며 실제 계층·배율·두 복제 뼈대를 별도로 검사했다. 경고가 없었다고 기록하지 않는다.

`diagnose_web_skin.py -- new-report.json [--triangulate]`는 원본/웹 파일을 저장하지 않고 어깨·손바닥 8개 집중 검사와 **에셋**의 정점·가중치를 대조한다. 이는 사람 좌표나 전체 QA가 아니다. 새 경로만 받으며 검사 기준을 완화하지 않는다.

`polish_avatar_candidate.py -- new-polish.blend`는 전문 A27 표면을 별도 파일에서 정제하는 제작 실험이다. A28 원본/왕복 118개는 통과했지만 실제 렌더에서 의상 경계가 더 두드러져 **채택하지 않았다**. [실제 반려 기록](review/candidate-a28-rejected/README.md)을 따른다. 당시 웹은 A27이었고 현재 개발 검수 화면의 별도 GLB는 A37이다.
