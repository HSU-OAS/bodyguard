# 원래 배치 복원의 선택 경계 대조

Blender 5.1.1 실제 진단은 exit0로 종료했다. **저작/외형 성공이 아니다.** 동결한 [복원 반려](../lateral-restore/README.md)를 같은 rows로 재현했고, 남성에 남은 접힘은 복원한 점과 선택 밖 점이 만나는 경계에서 발생했다. 새 후보 저장·렌더·GLB·전체 변형·브라우저·실측은 실행하지 않았다. 외형 P2, Draft #108, D2/전체1~6 미완료를 유지한다.

## 실제 확인

- Native edge293023(source128261–126107)의 두 면163755/174140은 입력에서1.089690°였으나 동결 복원 후177.667359°였다.
- 면163755의 source126108은 선택 밖이며 원래 앞면 보호점은 아니다. 해당 점의 현재 위치를 유지한 상태에서 나머지 세 점을 A318 배치로 복원했다. 두 면 모두 앞면 가시 면은 아니고, 두 번째 면만 모든 점이 선택 안에 있었다.
- 네 점 모두 유일한 A318 대응이 있고 두 면의 연결/winding도 같다. A318의 두 면은 normalY 양수였으나 혼합 배치의 첫 면은 음수로 뒤집혔다. 앞면 보호 때문에 복원이 불가능하다는 가설과, A318에서 그대로 상속된 접힘이라는 가설은 이 경계에 맞지 않는다.
- Frozen 저작 row exact·여성 body/rig exact·private probe body/rig exact, 두 입력 SHA 불변·새 저장0을 확인했다. 이 국소 원인 관찰로 전체 외형이나 임상/카메라 정확도를 판단하지 않는다.

다음 보완은 동일한 hard 복원이나 스무딩 수치 반복이 아니다. 현재 선택 범위 안에서 전문 원본 위치로 이어지는 연속 전이를 설계한다. 선택 밖/중앙/앞면 보호·raw skin/위상·리그·6mm/작은 면·닫힘/winding·접힘0을 유지하고 실제 저작 전에 계약을 확정한다. 새 원본이 통과하면 독립 재열기·같은 조건 외형·새 GLB/전체 변형/Chrome/실측을 다시 실행해야 한다.

## 보존과 실행 경계

첫 실행은 turn 중단 후 핸들·프로세스·임시 폴더를 읽을 수 없어 완료 여부가 미확정이다. [중단 관찰](../restored-boundary-interrupted.json)의 native exit=null을 후속 exit0로 대체하지 않는다. 첫 raw 로그/보고서는 현재 없으며, 보존했다고 주장하지 않는다. 기존 소스와 이전 커밋 증거는 유지했다.

재실행은 프로세스 없음 확인 뒤 **동일 inspector SHA a72bea96**으로 했으며 [영구 실행 폴더](../restored-boundary-run/native-exit.json)에 raw 로그/보고서·실행 소스·실제 terminal 결과를 남겼다. 새 authoring 파라미터/사용자 장면 변경/공개 제품 변경/의료 판정/운영 변경은 없다. Blender MCP 재연결은 오류였고 독립 background 프로세스로 실행했다.

[Inspector](../../../../assets/blender/integration-neck/inspect_restored_boundary.py), [runner](../../../../assets/blender/integration-neck/run_restored_boundary.mjs), [collector](../../../../assets/blender/integration-neck/archive_restored_boundary.mjs)를 실행 소스 gzip/원시 SHA와 함께 보존했다. 동결 imported helpers는 기존 복원 manifest의 원시 SHA를 재확인한다. 여기의 manifest는7개 gzip을 추적하며 byte/원시 SHA·실제 exit0·행/보호 guard 감사를 통과했다. 실행한 inspector/runner/collector는 이후 수정하지 않는다.

원본 be038c04와 A318 2eb274cf는 불변이다. 입력은 전문 제작 메시이지 사람 영상/관절 데이터가 아니다. 미실행 렌더/GLB/118 pose/브라우저/실제 참여자·전문가 검토, 출시 채택·배포를 과거 성공으로 대체하지 않는다. [Story](../../../stories/avatar-neck-integration.md)의 전체 완료 기준은 그대로다.
