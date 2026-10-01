# A30b 반려 — 의상 겹침 보완, 손목 연결부 외형 미달

2026-10-01 · Blender5.1.1에서 A27의 별도 사본을 제작했다. 제작 코드 SHA-256 `bb21ed5165ef83d74742bd3aea0e2807a8b2df12abe8bc6b92127d71934e40d5`, 임시 원본 `draft-a30b-native.blend` SHA-256 `a4dec0b71eb3073e6db21b264ec944fb9f28aede9e85d2ed1e15ee33428d770a`다. 이 기록을 추가한 Git 버전의 코드를 사용하면 재현할 수 있다. 반려한 대형 바이너리는 로컬 제작 폴더에 보존하며 웹 에셋으로 복제하지 않았다.

앞선 A30은 native Laplacian의 체적 보정이 정제 영역 밖의 좌표도 변경해 assertion에서 **저장 전에 중단**됐다. A30 원본 QA/렌더는 미실행이다. A30b는 native `Corrective Smooth/LENGTH_WEIGHTED/only-smooth`로 교체했고 영역 밖 좌표 및 기존 모든 정점/가중치를 실제 assertion으로 검사했다. 상의8mm·쇼츠6mm의 별도 층으로 허리 겹침을 보완했다. 이 수치는 모델 제작용이지 사용자 판단/의학 임계값이 아니다.

[전신](front.png)·[뒤](female-back.png)·[손목](female-hand.png)·[목](female-neck.png)의 실제 렌더를 확인했다. 허리 겹침은 개선됐으나 **손목 연결부의 깊은 주름/삼각형 형태가 남아 채택하지 않는다**. 반복 smoothing으로 기존 연결 위상의 문제를 감추지 않고 다음 후보에서 국소 메시 연결 자체를 재구성한다. 조명이나 합격 임계값을 바꾸지 않았다.

[원본 기술 검사](source-deformation-report.json)는 118개 기술 변형·240행, 최대 국소 edge 비율2.943930, 남녀 연결 성분1·non-manifold0·가중치 오류0, 의상 내부/방향 불일치0으로 실제 통과했다. 이는 단일 관절/표본 QA이며 외형·해부학·옷끼리의 충돌·운동 정답을 보장하지 않는다. GLB 왕복/웹/실제 사람 연결은 이 후보에서 **미실행**이다. 현행 A27 웹/원본과 PR #9 외형 P2는 그대로다.
