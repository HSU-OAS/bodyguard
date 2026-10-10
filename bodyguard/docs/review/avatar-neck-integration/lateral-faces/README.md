# 남은6면 진단 — 원래 접힘 확인 / 새 아바타 아님

2026-10-10 · [Story](../../../stories/avatar-neck-integration.md) · Draft #108 · 입력 be038c04 보존

원래 입력과 [반려 상태](../lateral-attempt/README.md)의6면을 실제 Blender에서 비교했다. **원래 입력부터 뒤 방향으로 접힌 삼각면이 있으며 계산용 삼각화만으로 해소되지 않는다.** 같은 마감·단위·삼각화를 다시 반복하지 않는다. 새 후보/이미지·여성 제작·GLB/전체변형/브라우저는 없다. 외형 P2·Story/D2/전체1~6은 미완료다.

## 실제 확인

- 진단 프로세스 exit0. 동결된 마지막 반려를 같은 조건으로 한 번 복원했고4939점/접힘4개/기하 row가 앞선 실제 실행과 exact다. 복원은 새 저작/파라미터 변경/합격이 아니다.
- 6면은 삼각3/quad3이며 모두 원래 앞면 밖·선택 구간 내부다. 삼각면167049는 원래 normalY=-0.8564, 인접삼각103829/167048은+0.8426/+0.8366이다. 평면 오차는 약5.1e-11m로, 이 삼각면의 기존 접힘을 비평면 quad 탓으로만 설명할 수 없다.
- 원래 quad171044도 normalY=-0.8728이며 반려 후 plane distance가11.739µm→238.560µm, area0.8666mm²→0.08023mm²로 변했다. 이는 에셋 기하 관찰이며 인체 측정값/정상 범위가 아니다. 나머지 전체 결함 원인을 모두 확정했다고 주장하지 않는다.
- private BMesh의6면 삼각화 probe는177539→177542면/반환9면, 원래 점 좌표 exact다. 반환 면 연결의>90°는 원래 상태5개/반려 상태6개로 남는다. 이 수는 반환 면 주변 검사이고 원래 전체 선택 구간의14→4와 범위가 다르다. 두 값을 동일시하거나 삼각화 성공으로 표시하지 않는다.
- 원본 파일 SHA 불변·여성 body/rig exact, 각 private probe 전후 body/rig·속성/위상 exact다. 검사 사본을 원래 body에 쓰지 않았고 새 후보 저장0이다. 진단 상태의 남성은 동결 저작 재현으로만 메모리에서 바뀌었으며 전체 장면을 불변이라고 주장하지 않는다.

다음은 원래 전문 원본에서 이 국소 point/face의 출처·위치/연결과 표면 연속성을 대조하고, 필요한 점 배치/국소 연결 설계를 확정하는 작업이다. 삼각/quad의 점은 모두 기존 source point ID를 갖지만 그것만으로 원래 전문 원본에서의 좌표/연결 불변을 입증하지는 않는다. 앞면/손/체형·raw skin/rig·6mm/닫힘/winding/tiny·실제 외형 기준을 유지한다. 실제 새 원본/GLB 왕복·전체변형/Chrome/목표 노트북/실측은 후속에서 따로 통과해야 한다.

## 진단 도구의 실제 실패와 보완

첫 실행은 `AttributeError: 'int' object has no attribute 'cross'`로 exit1이었다. tessellate_polygon 반환을 좌표로 취급한 잘못된 가정이다. 원래6면 관찰/동결 반려 복원 전에 중단됐으며 새 후보0이다. 최초 소스·JSON/로그는 그대로 보존하고 실패한 파일을 고치지 않았다.

별도 비인체 private quad probe는 설치5.1.1에서 실제 인덱스 삼각형2개와 native Triangulate의 반환2면·점 좌표 불변을 확인했다(exit0). [공식5.1 geometry API](https://docs.blender.org/api/5.1/mathutils.geometry.html#mathutils.geometry.tessellate_polygon)와 [BMesh API](https://docs.blender.org/api/5.1/bmesh.ops.html#bmesh.ops.triangulate)의 검색 결과도 인덱스/반환면 형식을 설명한다. 전체 문서를 직접 열람했다고 주장하지 않는다. 새 `inspect_lateral_faces_native.py`는 검증된 인덱스를 원래 점에 대응하며 처음 실패/실행 소스를 덮어쓰지 않는다. 후속 weight 필드는 각 상태의 현재 좌표/원래 domain에서 계산한 제작용 값이지 원래 raw skin이나 고정 전후 weight가 아니다.

첫 format --check 오류는 native 전 준비 단계이고 formatter로 정리했다. 그 소스도 별도 보존했다. 프로세스 진단용 ps 조회는 sandbox의 operation not permitted로 실패했으며 실행 핸들로 실제 종료0을 확인했다. ps 실패를 native 중단/성공으로 세지 않는다. 사용자 장면/설정·플러그인/의존성/계정/비용 변경0.

## 증거와 재현

[manifest](manifest.json)의12개는 첫 실패·native API probe·후속 실제 진단의 로그/JSON·같은 실행 source와 초기 포맷 source다. 이전39개와 원본·37/17개 증거는 바꾸지 않았다. [작성자 리뷰](../lateral-faces-review.md)는 외부/전문가 승인과 구분한다.

입력 [be038c04](../lower-attempt/candidate-neck-center.blend) SHA256 `be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068`. 당시 최초/API probe는 `/private/tmp/bodyguard-lateral-faces.cHBtXE`, 후속 진단은 `/private/tmp/bodyguard-lateral-faces-native.QcenCA`였다. 별도 factory-startup/disable-autoexec 프로세스에서 원본을 열고 새 진단 출력에만 기록했다. 다음 재현도 새 private proof가 필요하며 기존 출력 덮어쓰기는 거부한다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup --disable-autoexec \
  -b bodyguard/docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/integration-neck/inspect_lateral_faces_native.py \
  -- "$proof_dir"
node bodyguard/assets/blender/integration-neck/archive_lateral_faces.mjs --check
```

마지막 Node 명령은 보존 바이트/보고서 감사다. Blender/브라우저 재실행·외형 승인·실제 사람 검증이 아니다. 공개 웹/문구/SDK/판정/안전·개인정보/운영 변경0, 최소 문구·별도 승인 경계를 유지한다. PR #108은 Draft/병합 보류다.
