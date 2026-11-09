# 여성 후보 재질·표면 설정 확인

2026-11-09 · [검사 대상 Blender 후보](../protected-female-20261109/README.md) · 비파괴 읽기 전용

Blender에서 여성 메시의 재질·표면 설정을 조사했다([보고서](report.json), [실행 스크립트](inspect.py), [로그](run.log.gz)). 하나의 흰색 재질에는 Principled BSDF와 Material Output 노드만 있고 이미지 텍스처 노드는 없다. 메시 176,543개 면은 모두 smooth shading이며 사용자 지정 법선은 없고, 렌더에 표시된 modifier는 armature 하나다.

이 자료는 별도의 이미지 텍스처 노드가 요철을 그리는 경우는 배제하지만, 메시 형상과 자동 법선·재질의 반사 설정·조명이 각각 어떻게 기여하는지는 구분하지 못한다. 시각적 개선이나 변형 정확도를 증명하지 않는다. 원본·후보 Blender 파일은 저장하거나 수정하지 않았다.
