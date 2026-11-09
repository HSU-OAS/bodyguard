# 여성 후보 재질·표면 설정 확인

2026-11-09 · [검사 대상 Blender 후보](../protected-female-20261109/README.md) · 비파괴 읽기 전용

Blender에서 여성 메시의 재질·표면 설정을 조사했다([보고서](report.json), [실행 스크립트](inspect.py), [로그](run.log.gz)). 하나의 흰색 재질에는 Principled BSDF와 Material Output 노드만 있고 이미지 텍스처 노드는 없다. 메시 176,543개 면은 모두 smooth shading이며 사용자 지정 법선은 없고, 렌더에 표시된 modifier는 armature 하나다.

이 자료는 별도의 이미지 텍스처 노드가 요철을 그리는 경우는 배제하지만, 메시 형상과 자동 법선·재질의 반사 설정·조명이 각각 어떻게 기여하는지는 구분하지 못한다. 시각적 개선이나 변형 정확도를 증명하지 않는다. 원본·후보 Blender 파일은 저장하거나 수정하지 않았다.

## 단순 무광 재질 분리 렌더

동일 후보·카메라·조명과 64 samples를 유지하되 기존 재질을 실행 중에만 반사와 표면하 산란을 끈 흰색 무광 재질로 대체해 뒷면을 렌더했다([대체 재질 화면](clay-corrected.png), [원래 재질 화면](../protected-female-stronger-20261109/candidate-back-64.png), [스크립트](clay-corrected.py), [로그](clay-corrected.log.gz)). 대체 재질에서도 불균일해 보이는 부위가 남았다. 이 한 시점의 정성 비교는 기존 재질의 이미지 텍스처만이 유일한 원인이라는 설명을 뒷받침하지 않지만, 메시 형상·자동 법선·조명 중 원인을 단독으로 입증하지 않는다. 입력 Blender 파일은 저장하지 않았다.

첫 렌더도 무광 재질을 적용했지만 결과 JSON의 `same_source_material_world_lights`가 복사된 이전 스크립트의 고정 `true`로 잘못 기록됐다([첫 스크립트](clay-first.py), [첫 보고서](clay-first-report.json), [첫 렌더](clay-first.png), [첫 로그](clay-first.log.gz)). 해당 값을 사실로 사용하지 않으며, 필드를 바로잡은 [재실행 보고서](clay-corrected-report.json)를 별도로 보존한다.
