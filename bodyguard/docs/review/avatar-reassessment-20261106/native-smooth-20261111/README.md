# 여성 국소 Smooth 조형·변형 대조 — 미채택

2026-11-11. 앞면·외부·원래 위상/피부 가중치/뼈대 등을 보존하며 Blender Smooth를 뒤 목·어깨 보호 영역에 적용했다. 최초 [시험](unbounded-trial.py)은 최대 약 5.07mm 이동해 기존 2mm 경계를 넘었으므로 저장되지 않았다([실패](unbounded-report.json), [로그](unbounded.log.gz)). 이후 원래의 전체 변위장을 같은 비율로 줄여 최대 약 1.8mm로 제한한 [별도 후보](models/candidate-unapproved.blend)를 만들었다. 한계를 올리지 않았고 앞면·외부 위치는 정확히 보존했다([실행](trial.py), [기술 결과](report.json)).

같은 원본 재질·조명에서 [정면](female-front.png)·[뒷면](female-back.png)을 실제 렌더했다. 새 [기술 시험 자세](posed/render.json)에서 목 좌우와 한쪽 어깨를 평가해 보니 [목 기울임 뒷면](posed/neck-left-back.png)의 머리-목 연결부가 집히는 외관이 남았다. 따라서 외형·자연스러운 변형 완료로 채택하지 않는다. 시험 자세의 각도는 기술 부하값이며 사용자에게 제시할 올바른 스트레칭 각도가 아니다.

후보 Blender·웹 변환본·GLB 재수입본에 기존 변형 harness를 각각 실제 실행해 121개씩 통과했다([원본](deformation.json), [웹](web-deformation.json), [재수입](roundtrip-deformation.json)). 실제 [남성 GLB](models/bodyguard-male-candidate.glb)·[여성 GLB](models/bodyguard-female-candidate.glb)를 내보내고 재수입했다. 두 GLB의 내장 시범 애니메이션은 0개다. 기존 내보내기의 가중치 제한 안내는 [로그](export.log.gz)에 보존한다.

실제 Chrome/WebGL에서 두 GLB를 합성 방향으로 각각 60프레임 구동해 독립성·8개 가중치·전신 구도·해제를 확인했다([결과](browser.json), [runner](browser-runner.mjs), [로그](browser.log.gz)). 카메라를 사용하지 않았고 사람의 자세 정확도나 자연스러운 움직임을 입증하는 시험이 아니다. runner는 frontend/scripts에 두고 로컬 probe 번들을 준비해야 실행된다. 기술적 edge stretch 검사와 짧은 합성 렌더가 위 외관 결함을 잡지 못한다는 한계를 확인했다.

이 후보는 원본과 기존 증거를 보존한 미채택 작업본이다. 표면 미세 조형만으로 최종 외형과 목 연결부의 변형이 해결됐다고 주장하지 않으며 제품 적용·배포를 하지 않는다.
