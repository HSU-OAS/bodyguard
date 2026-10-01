# A54 목 국소 정제 — 저장 전 guard 실패

2026-10-02 · Blender5.1.1 · S2.4 / FR-A-01~04. [기존 native 도구](../../refine_mannequin_joins.py)를 재사용하되 손목 선택을 제거해 목만 CORRECTIVE_SMOOTH/LENGTH_WEIGHTED/factor0.6/32회로 대조했다. 인체 생성·전신 remesh·새 의존성은 없다.

실제 실행은 남성 최대 이동 **0.05919476877139631m**로 기존 **0.006m** 조형 guard에서 **AssertionError / exit1**로 실패했다. 값은 모델 편집 변위이지 사람 추적 수치가 아니다. **예산을 높이거나 원래 좌표를 사후 복원하지 않았다.** 기존 skin·뼈/rest·손·영역 밖 좌표 검사 이후 저장 전 중단됐다. 여성 처리·새 원본/보고서/렌더·118개 변형·GLB·왕복·Chrome은 미실행이다. 입력 A53·기존 파일/증거는 저장하거나 덮지 않았다.

[실제 실패](guard-failure.json), [실행 코드](producer-at-generation.py.txt)를 보존한다. producer SHA-256은 `b7d787db0b6b23b6e2fadf51a9fcbe4a080b877ffb88dcb8cc12bca8e7495307`이며 Ruff check/format을 실제 통과했다. 새 임시 폴더에 `.py`로 복사한 뒤 기존 A53을 `-b`로 열고 `--python-exit-code 1 --python <producer> -- <존재하지 않는 새.blend> <존재하지 않는 새 preview 폴더>`로 재현한다. 허용 범위는 동일하며 실패 검사를 통과로 표시하지 않는다.

다음은 같은 전문 head·경계 위치·리그를 유지한 native LINEAR 연결 대조다. 광범위 smoothing 반복/param 축소로 외형 실패를 감추지 않는다. 여성 무의상/남녀 같은 백색 표면·개발 A37·외형 P2·Draft PR #9 병합 보류·1~6 완료/승인 규칙은 유지한다. 사람 촬영/좌표 저장·전송, 비용·계정·시크릿·운영 DB·배포·출시는 실행하지 않았다.
