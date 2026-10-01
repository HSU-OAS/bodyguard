# A28 표면 정제 실험 — 외형 반려

2026-10-01 · Blender 5.1.1. A27 전문 body/head의 목 표면, 파생 의상의 외곽과 관절선을 별도 A28에서 정제했다. 원본은 덮어쓰지 않았으며 body의 정점 수·가중치와 전문 손/리그를 그대로 유지하는 실행형 검사를 넣었다.

[원본 검사](source-deformation-report.json)·[여덟 가중치 왕복 검사](web-deformation-report.json)는 각각 118개 기술 변형, 위상/가중치/의상 내부·방향 불일치 검사를 통과했다. 이것이 외형 통과를 뜻하지 않는다. 실제 [정면](front.png)·[여성 뒤](female-back.png)·[목 확대](female-head-neck.png)를 대조했으며, 여성 상의의 허리·진동·목 경계가 더 두드러지고 머리–목 실루엣도 참조 수준에 이르지 못했다. **현재 후보로 채택하지 않았다.**

반려 후보의 31MB 원본·전체 34컷을 추가로 저장소에 중복 적재하지 않는다. A27을 Blender에서 열고 `polish_avatar_candidate.py -- new-polish.blend`로 별도 재현할 수 있다. 첫 실행의 modifier 적용 중 Python/RNA group 참조가 무효화돼 파일 저장 전 실패했고, 이름으로 재조회한 뒤 생성/검수했다. 편집 원본이나 라이브 장면은 바꾸지 않았다. 현재 웹은 [A27 여덟 가중치](../web-eight-weight/README.md)를 사용한다.
