# 여성 목·어깨 강도 상향 대안 — 미채택

2026-11-09 · Blender 5.1.1 · [직전 후보와 원본 전후](../protected-female-20261109/README.md)

직전 여성 후보와 같은 원본·영역·날카로운 모서리 보호 및 기존 기술 조건을 사용하고 Laplacian 강도만 0.2에서 0.3으로 바꿨다. [실행 스크립트](trial.py)와 [보고서](report.json)를 보존한다. 여성 최대 이동은 약 0.980mm이고 기존 최대 이면각은 45.025392°로 유지됐다. 기존 앞면·외부 정점·토폴로지·가중치·뼈대의 보호 조건과 표면 기초 검사는 통과했다. 원본 해시는 변하지 않았다.

동일 조명·카메라·16 samples의 실제 Blender [뒷면](candidate-back.png)과 [정면](candidate-front.png)을 직전 후보의 [뒷면](../protected-female-20261109/candidate-back.png)·[정면](../protected-female-20261109/candidate-front.png)과 비교했다. 뒷목·어깨의 요철이 여전히 보여 뚜렷한 시각적 개선을 확인하지 못해 대안을 채택하지 않았다. 보완 후보 Blender 파일은 로컬 임시 경로에만 보존하며 SHA-256은 `b00e31fb4a9bb6d72b8667577de7fd25c76e0856a718514661ab97b9a3b6aab3`다. GLB 내보내기·관절 변형·브라우저 검사는 이 대안에 대해 수행하지 않았다. 직전 후보는 그대로 보존하고 외형 P2를 유지한다.
