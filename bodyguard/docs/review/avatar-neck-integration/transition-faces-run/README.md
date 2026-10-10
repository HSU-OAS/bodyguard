# 연속 전이 반려의 원래 면·core 대조

실제 Blender5.1.1 진단 exit0·새 저장0이다. 동결한 연속 전이의 실패 rows를 exact 재현한 것이며 새 저작이나 외형 성공이 아니다. [원시 결과](diagnostic.json), [실제 terminal](native-exit.json), diagnostic.log·replayed-author.json와 실행7개 source gzip을 보존했다. 실제 렌더/새 원본/GLB/118변형/Chrome·실측은 미실행이다.

남은 native edge286804/296303/296304는122.584°/163.327°/164.739°였다. 면167049가 세 edge에 공통이고 관련 면103829/167048/171044의 source ID는 이전 A318 대조에서 확인했던 기존 ID다. 모든 관련 점은 원래 선택 안·앞면 보호 밖이며 기존 전이0.296~0.601이다. 단순히 원래 접힘을 재현한 원본 방향으로 부르는 대신 현재 입력/전이/A318 위치를 구별한다.

원래 입력14개 접힘의 전체 인접 면에서27개 서로 다른 **native 점**을 읽었다. 선택 밖0·앞면 보호0·새 source ID점0이고 원래 source ID 대응도 유일하다. A318의 실제 좌표를 모두 읽었으며 추정/외삽하지 않았다. Female body/rig exact·private probe body/rig exact·두 입력 SHA 불변을 확인했다.

진단 중 새저작·허용치/선택 변경·모델 저장은 없다. 기존 실패 source를 수정하지 않고 재현에 한 번 사용했으며 private BMesh의 좌표를 입력 배치로 바꿔 비교한 것이지 body에 쓰지 않았다. 외형P2/Draft/미채택·D2/전체1~6 미완료·최소 문구/별도 승인 기준은 그대로다.

## 다음 도구 선택의 근거와 제한

같은 설치commit `b70da489d7f4eae7760cc0a50cc6c60cd5464205`의 [공식 native Laplacian Deform 구현](https://github.com/blender/blender/blob/v5.1.1/source/blender/modifiers/intern/MOD_laplaciandeform.cc)을 GitHub API로 읽었다(blob `570b34105535f430c8740a07bd8b950a2b1324ec`). API의 v5.1.1 tag가 해당 commit을 가리킴도 확인했다. modifier는 양수 vertex group 값을 anchor membership으로 사용하고, 각 anchor는 least-squares 식에 계수1로 들어간다. 따라서 기존 falloff 값을 넣는다고 강한/약한 고정점이 되는 것이 아니며, 계산 결과 anchor가 원래 위치에 **exact 고정**된다고 가정할 수 없다.

5.1 manual/API 직접 조회는 접근 오류/402였으며 읽기 성공으로 표시하지 않는다. 검색의5.4/main 문서는 설치5.1.1 검증으로 사용하지 않았다. 아직 native API schema/비인체 probe·전문 메시의 제한 변형 저작을 실행하지 않았다. 다음은 해당 실제 core·외부 보호점을 구별하는 private 전문 메시 처리와 설치 API 검증이다. source provenance·보호/리깅·현재 허용치와 실제 기하/외형 기준은 유지한다. 코드/도구 기능 설명은 품질이나 의료 인증이 아니다.
