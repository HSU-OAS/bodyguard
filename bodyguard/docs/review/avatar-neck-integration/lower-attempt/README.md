# 목 중앙 부분 원본 — 저장 성공 / 후속 검증 미실행

2026-10-10 · [Story](../../../stories/avatar-neck-integration.md) · Draft PR #108 · 출시 아바타 아님

남녀 목 중앙을 실제 Blender에서 국소 재연결하고 [새 부분 원본](candidate-neck-center.blend)을 저장했다. **독립 재열기와 새 외형 미리보기는 아직 없다.** 자동 승인 시스템의 사용량 제한 때문에 렌더 프로세스가 시작되지 않았다. 이는 Blender 실행 실패나 안전 반려가 아니며 검증 통과도 아니다. 승인 검토를 우회하거나 같은 명령을 다른 경로로 재시도하지 않았다.

## 실제 결과

- 입력은 이전 부분 후보2932e63d다. 실제 앞면 ray 관찰로 원래 앞면을 보호했다. 단순Y>0 선택이 모두 뒤 표면이라고 판단하지 않는다.
- 목 중앙의 native 경계는 남성183/여성148점, 앞면 포함0이다. 남성은 한 원래 삼각 전이 뒤182점으로 연결했다. 이 제작 구간은 사람의 정상 자세 기준이 아니다.
- 남녀 저작은 각각3428/3191개 원래 선택 면에 대해1470/1152개 새 점을 만들고, 원래 선택 표면 거리 최대23.299/15.725µm를 관찰했다. 이 수치는 전문 에셋의 국소 거리이지 웹캠 정확도가 아니다.
- 제작 프로세스 안에서 외부 원래 좌표·polygon·raw skin·history·rest rig·world·PBR·손과 이전 point INT provenance를 보호했다. 닫힘/winding0, tiny2→2/0→0을 확인했다.
- 전체 새 연결띠336/280면의 뒤 방향·tiny·원래 투영 밖 점/면 중심·추가 뒤 교차0, 각2178개 고정 에셋 ray에서 원래/후보 중복 교차0·최대1이었다. 이 검사는 실제 사람·관절 정확도나 전체 외형 승인에 해당하지 않는다.
- 읽기 전용 native 검사와 초기/수정 후 결과를 모두 보존했다. pairwise/import 정리 전후의 posterior/sided JSON은 동일하다. 초기 Ruff RUF007/F401/I001은 실패 로그로 남겼다. 앞의 두 초기 source는 별도 보존했고 I001 초기 source 사본은 없다.

새 원본SHA256 `be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068`, 입력SHA256 `2932e63d0d9f7565ae2b9835377d941af2ffe894f8036037479fb2c3fcc1e394`다. [manifest](manifest.json)은37개 원본/보고서/로그/helper의 raw·archive SHA를 보존한다. 재실행하지 않은 검사 코드를 준비된 상태로 보존했으며 통과로 표시하지 않는다.

## 남은 문제와 재개 조건

| 문제 | 해결 조건·의존성 |
|---|---|
| 새 중앙 원본의 보호 확인 | 자동 승인 검토가 가능한 상태에서 아래 독립 재열기를 실제 실행. 원래2932e63d·새be038 SHA와 외부 좌표/raw skin/위상·앞면/손·이전 provenance exact 재검증 |
| 새 외형 | 같은 조명·재질·카메라로 남녀8컷을 새be038에서 실제 생성·직접 확인. 이전2932e63d8컷을 새 후보의 미리보기로 제시하지 않음 |
| 목 좌/우·어깨 | 여성 옆 목과 남녀 어깨의 보호 경계는 복수 hole·CDT 삽입이 남아 별도 연결 설계 필요. 앞면/기존 머리를 바꾸거나 점 반올림으로 우회하지 않음. 전체 외형 기준 유지 |
| 최종 원본·GLB·변형·웹 | 남은 제작 구간을 해결한 새 최종 원본에서 GLB 왕복·118 기술 pose·Chrome/WebGL·외형 검증을 실제 재실행. 이번 부분 저작/과거 ce8887d QA로 대체하지 않음 |
| 출시1~6 | 실제 참여자·목표 노트북·시범/판정·승인 UI·공급자·HTTPS 등 기존 완료 게이트 충족. 운영/비용/계정/시크릿/배포 별도 승인 |

이번 파일에서 독립 재열기·GLB·118변형·Chrome·실제 카메라·새 외형 승인 **미실행**이다. 외형 P2/Story·D2-A·전체1~6 미완료, 미채택·Draft/병합 보류를 유지한다. 공개 웹 UI·SDK·판정·개인정보·운영 변경0이며 문구 최소화 원칙은 유지한다.

## 후속 실제 실행 명령 — 아직 실행하지 않음

승인 검토 제한이 해소된 뒤 기존파일을 덮어쓰지 않는 새 proof 폴더에서만 실행한다. 아래 명령을 적은 것 자체는 실행 증거가 아니다.

```bash
proof_dir=$(mktemp -d /private/tmp/bodyguard-neck-center-qa.XXXXXX)
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup --disable-autoexec \
  -b bodyguard/docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/integration-neck/reopen_neck_center.py \
  -- bodyguard/docs/review/avatar-neck-integration/projected-attempt/candidate-projected.blend \
  "$proof_dir/reopen.json" be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068
/Applications/Blender.app/Contents/MacOS/Blender --factory-startup --disable-autoexec \
  -b bodyguard/docs/review/avatar-neck-integration/lower-attempt/candidate-neck-center.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/integration-neck/render_comparison.py \
  -- "$proof_dir/render"
```

저장 바이트와 기존 보고서만 읽는 점검은 다음과 같다. 새 native/브라우저 검증을 실행하지 않는다.

```bash
node bodyguard/assets/blender/integration-neck/archive_lower_attempt.mjs --check
```
