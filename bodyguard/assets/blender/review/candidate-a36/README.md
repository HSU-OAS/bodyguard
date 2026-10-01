# A36 — 기존 의상 후보의 실제 검증 종료

2026-10-01 · Blender5.1.1. 다음 후보부터 CEO의 남녀 공통 무의상 백색 중성 마네킹 결정으로 전환했다. **A36 의상 외형을 최종 목표로 채택하지 않는다.** 기존 원본/실패 기록을 보존하며 A36 원본/GLB는 로컬 제작 폴더에 보존한다. A36 검사 당시 웹은 A27이었고 현재 개발 검수 화면은 별도 [A37](../candidate-a37/README.md)이다.

native Bridge Edge Loops의 SURFACE 보간/6분할로 전문 손목 연결을 정제했다. 원래 손가락/영역 밖 정점·가중치 보존 assertion을 통과했다. 의상은 arm 제외·native Smooth/Bevel로 정제하고 어깨 원형 장식만 제거했다. 새 인체·외부 에셋·의학 시범은 없다.

| 파일 | SHA-256 |
|---|---|
| 제작 코드 `tailor_avatar_candidate.py` | `8c3a599dcc2ec29f06b2f5c3bba2212a76ab3403ba45a68419d6d032443db972` |
| `draft-a36-native.blend` | `2aad1ab27b3a6e1382300c5d30b9bf1a2971799767a143a6b1d7d378f34aa959` |
| `a36-web.blend` | `9e5c629e33149c0fcbde3ce48b2975c591e4a11b7df13dce05b0ac6f14a37242` |
| `a36-web-roundtrip.blend` | `dec1f331fb300ffcfbb67671a8b3ca45c80aca99c348c41e402deb58e4a8aceb` |
| 남성 GLB12,656,976bytes | `cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927` |
| 여성 GLB15,174,316bytes | `cc21d218e61aba3daadb90bc6e7f58b962503a22a919a6ec1a3c97afcb854da8` |

위 제작 코드 해시는 실제 A36 실행 버전이다. 이후 변경 파일의 Ruff 형식 정리만 적용한 현재 해시는 `8d9a29b0b75ed19caab25cd926e015b9ad786fd97adb50558d3bc1793e55cb39`이며 정리 전/후 Python AST 완전 일치를 실제 검사했다. 결과 파일/렌더/JSON을 재작성하거나 원래 실행 해시를 소급 바꾸지 않았다.

[원본](source-deformation-report.json)과 [재가져오기](web-deformation-report.json)는 각각118개 기술 변형·242행 실제 PASS, 최대edge2.943930367/2.947679803·침투/불일치0·failures0이다. 신체/의상 연결성분1/non-manifold0/정규화오류0이다. 원본 남142,087·여139,882정점, 웹142,081/139,873정점·각163bones다. [내보내기](roundtrip-report.json)는5/7meshes·images/actions0이며 `geometry_deformation_pending`은 내보내기 시점 상태다. 이후 별도 변형 PASS와 구분한다. parent/skin-influence 경고가 있었다.

[정면](front.png)·[여성 뒤](female-back.png)·여성 [손목](female-hand.png)/[목](female-neck.png)·남성 [손목](male-hand.png)/[목](male-neck.png)은 실제 native6컷이다. 남성 손목 미세 주름·뒤 목·참조 재질/실루엣 정제가 남았다. 외형 A-02 최종 통과가 아니다.

## 하네스 수정과 실제 Chrome

[첫 실행](browser-initial-failed-report.json)은3개 중2통과/1실패다. 기존 `eight_weight_meshes>=4`가 제거한 의상/장식도 기대했다. 인체의 JOINTS_1/WEIGHTS_1은 그대로여서 기준을 단순 낮추지 않고 **native GLB 인체 추가 세트 보존/완전성 및 실제 모든 추가 세트 메시와 두 복제본의 정확한 수 일치**로 수정했다. 기존 A27은8/10개, A36은2/6개를 기대한다.

backend에서 `PLAYWRIGHT_JSON_OUTPUT_NAME=<새 경로> BODYGUARD_AVATAR_QA_DIRECTORY=<native GLB 절대 폴더> .venv/bin/python -m tests.run_browser avatar`를 실행했다. 기존 에셋을 덮지 않고 하네스에 새 바이트를 공급했다. [A36 JSON](browser-report.json)3개/51.301s·[A27 회귀](baseline-a27-browser-report.json)3개/41.398s·각skip0/flaky0 실제 통과다. 실제 화면은 A36 [남성](male-two-models.png)/[여성](female-two-models.png)과 A27 [남성](baseline-a27-male.png)/[여성](baseline-a27-female.png)이다.

| 기술 변형 | 표본 | mean(ms) | p95(ms) | draw calls /triangles | 추가 세트 메시 |
|---|---:|---:|---:|---:|---:|
| A36 남 |180|16.665556|19.500000|21 /1,153,018|2|
| A36 여 |180|19.815556|44.100000|29 /1,420,474|6|
| A27 남 |180|16.665556|17.500000|33 /1,190,242|8|
| A27 여 |180|16.662222|17.300000|37 /1,374,162|10|

자체localhost5182·소유한 비청취 프록시·설치Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·AppleM4·16GiB, 제작 프로세스 종료 후 조건이다. GPU 상세/전원/전체 부하는 미수집이다. A36 여성 p95 증가를 숨기지 않으며 기능 PASS는 프레임 안정성/코칭 성능 합격이 아니다. 다음 무의상 후보에서 다시 측정한다.

A-00 외부example.invalid는 native ERR_PROXY_CONNECTION_FAILED로 차단됐다. 독립 뼈대/한쪽 변형·정지·503/context loss 재시도·이탈·카메라0회를 확인했다. guest401/오류 주입은 제어된 상태며 NO_COLOR/Three.Clock/WebGL 경고가 있었다. 이전 실행에도 프록시가 있었다고 소급하지 않는다.

실제 사람·운동 시범·리타게팅·추론15fps/피드백1초·최종 외형·단계2·출시는 미완료다. **Draft PR #9 병합 보류**를 유지한다.
