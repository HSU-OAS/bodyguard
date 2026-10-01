# Blender 아바타 작업 원본

2026-10-01: 기존 studio 원본을 보존하고 [A27 후보](bodyguard_avatar_candidate_a27.blend)를 별도로 제작했다. **원본 기술 변형 118개는 통과했지만 외형과 네 가중치 웹 변형은 미통과**다. [후보 결과·실제 웹 컷·실패](review/web-candidate/README.md)를 확인한다. 어느 파일도 합격한 출시 아바타가 아니다.

`bodyguard_avatar_studio.blend`는 **제작 중인 편집 원본**이다. 배포용 GLB나 합격한 아바타가 아니다. 기존 MPFB 시제품을 조형 베이스로 채택하지 않고, [Blender Foundation Human Base Meshes v1.4.1](https://www.blender.org/download/demo-files/)의 CC0 남녀 realistic body와 전문 제작 head 메시로 교체·조형했다. CEO의 남녀 참조 이미지는 파일 안에 패킹했다. 얼굴 요소를 제거하고 머리·목 표면을 연결했으며, MPFB core 리그·가중치를 전송했다. **아직 의상·관절 표현, 전체 관절 변형 검수, 시범 애니메이션과 웹 성능 검증은 없다.**

Blender에서 파일을 열어 `CEO references - modeling only` 컬렉션의 참조와 메시를 비교한다. 남성 메시 `BODYGUARD Male sculpt WIP`, 여성 메시 `BODYGUARD Female sculpt WIP`, 리그는 각각 `BODYGUARD Male rig WIP`, `BODYGUARD Female rig WIP`이다. 원본을 직접 편집할 수 있고 외부 메시 파일이나 실행 중인 Blender MCP 연결을 요구하지 않는다.

검수 이미지: [이전 시제품](review/mpfb-rejected-front.png), [새 조형 베이스의 시작 상태](review/sculpt-base-front.png), [현재 정면](review/faceless-front.png), [3/4](review/faceless-quarter.png), 측면 [남성](review/faceless-side-male.png)·[여성](review/faceless-side-female.png), 목 기울임 [남성 좌](review/faceless-neck-male-left.png)·[우](review/faceless-neck-male-right.png), [여성 좌](review/faceless-neck-female-left.png)·[우](review/faceless-neck-female-right.png). **외형 개선과 기초 리깅만으로 참조 품질이나 올바른 코칭 동작이 완성된 것은 아니다.** 차이와 다음 검수는 [제작 계약](../../docs/avatar-production.md)에 기록했다.

## 반복 검수

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

# 현재 후보는 남성 4개 변형 경보로 exit 1: 미통과
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b /private/tmp/bodyguard-new-web-roundtrip.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/review_avatar.py \
  -- /private/tmp/bodyguard-new-web-review --candidate --qc-only
```

`--qc-only`는 렌더만 생략하고 검사를 생략하지 않는다. 실패 목록·JSON·nonzero exit를 남긴다. 단일 관절 스트레스 검사와 의상 표본은 해부학·운동 정답·외형의 전문가 승인이나 실제 웹캠 사용 검증을 대체하지 않는다. native export의 남성 첫 선택에서 parent 경고가 있었으며 실제 계층·배율·두 복제 뼈대를 별도로 검사했다. 경고가 없었다고 기록하지 않는다.
