# 여성 목·어깨 보호 보완 후보 — 미승인

2026-11-09 · Blender 5.1.1 · 기존 원본·실패 증거 보존 · 최종 외형/실제 추적 미완료

## 변경과 원본

[기존 Blender 원본](../README.md)의 SHA-256 `71c369c96667549d00a4e77ff5d0b301ce307d806d5f3b42e739f48b4b7a8a2d`을 별도 프로세스로 열었다. [이전 중단 시험](../protected-20261109/README.md)을 여성 메시만 대상으로 실행했다. 뒤 목·어깨의 기존 40° 초과 모서리 4개와 주변 정점 57개를 고정하고 나머지 영역에 Blender Laplacian 보완을 적용했다. 이 각도는 메시 보존을 위한 수치이지 사용자 자세 기준이 아니다. 남성 조형은 변경하지 않았다.

[원본 뒷면](original-back.png) · [후보 뒷면](candidate-back.png) · [원본 정면](original-front.png) · [후보 정면](candidate-front.png). 같은 카메라·재질·조명·16 samples로 실제 렌더했다. 뒷목·어깨에 여전히 요철이 보이므로 **최종 외형으로 채택하지 않는다.** [수정 가능한 Blender 후보](models/candidate-unapproved.blend)와 [여성 GLB](models/bodyguard-female-candidate.glb), 함께 출력한 [남성 GLB](models/bodyguard-male-candidate.glb)는 검수용이며 기존 파일을 덮어쓰지 않았다.

[표면 보고서](report.json) 기준 여성 선택 10,299점 중 10,242점 이동, 최대 약 0.807mm. 앞면·외부 정점과 토폴로지·가중치·뼈대 등의 보호 검사가 통과했고 선택 표면 최대 이면각 45.025392°는 그대로였다. 전체 표면 연결성 및 접힘 검사도 통과했다. 이 결과는 외관 완성이나 운동 안전성을 뜻하지 않는다.

## 실제 검증

- 후보 Blender 원본, 웹 변환 `.blend`, GLB 재수입 `.blend`에 기존 관절 변형·표면 검사를 각각 실행해 121개씩 통과했다([원본](deformation.json), [웹 변환](web-deformation.json), [재수입](web-roundtrip-deformation.json)). 이 테스트의 기술적인 관절 각도는 사용자 운동 지침이 아니다.
- 실제 GLB 내보내기와 재수입을 수행했다([roundtrip](roundtrip-report.json), [내보내기 로그](export.log.gz)). 이전과 같이 내보내기에서 가중치 제한 안내가 있었다. 양쪽 GLB의 내장 애니메이션은 0개이므로 올바른 시범 동작의 완성을 뜻하지 않는다.
- 실제 Chrome/WebGL에서 남녀 GLB와 합성 관절 방향을 각각 60프레임 구동하고 독립성·가중치·전신 구도·해제를 검사했다([결과](browser.json), [여성 화면](browser-female-after.png), [남성 화면](browser-male-after.png)). 카메라·외부 요청·페이지 오류는 0이었다. 이 기기에서 프레임 간격 p95는 남성 16.8ms·여성 16.7ms였으나 짧은 합성 시험이며 실제 웹캠 병행·냉시작·다른 노트북 성능은 아니다. [실행 runner](browser-runner.mjs), [실행 bundle](browser-probe.js.gz), [bundle 빌드 로그](browser-build.log.gz)를 보존한다.

SHA-256: Blender 후보 `5d7e559263a38a86de0e0f4ac64a606cc5673d61fb0393089baef6e49a501f09`, 여성 GLB `87fcc7ebff36132f5fb8c50324a91f0b96175371e059fbcb724368d346fb1367`, 남성 GLB `8c3d34b9d12c1d40f2c842c0167bff2c2d6ee72a427162b4c44d62e80bbf59bf`. 웹 변환과 재수입 Blender 파일은 임시로만 보관했고 SHA는 각각 `ab0499db027bac2b6ab660d7f6f616253244ff0a15effd028f58585a9e8e17db`, `f949e375861238174e5452b8098d2ceff85b116f607e8c20a5b4c5fa0f9bd415`다. 사용한 보완·렌더 스크립트는 [trial.py](trial.py), [render.py](render.py), 내보내기·변형 검사와 보조 모듈은 [기존 실행 자료](../executed/)다.

실제 웹캠의 자세·손 정확도, 관절별 모든 움직임, 전문가 동작 기준, 실제 사용 시 자연스러운 외형과 지속 성능은 검증하지 않았다. 이 후보는 제품에 연결하거나 배포하지 않았다.
