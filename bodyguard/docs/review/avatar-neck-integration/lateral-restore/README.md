# 전문 배치 복원 — 접힘 감소 / 저장 전 실패

2026-10-10 · [Story](../../../stories/avatar-neck-integration.md) · Draft #108 · 외형 P2 미해결

[전문 원본 대조](../lateral-origin/README.md)에 따라 앞면을 보호하는 옆 목·어깨의 기존 점을 A318 배치로 복원했다. **남성 접힘이 14→1로 줄었지만 0 기준에 미달해 새 파일을 저장하지 않았다.** 이 방식의 실제 실행은 실패이며 여성 제작·외형/GLB/전체변형/브라우저는 미실행이다. 보호 통과나 접힘 감소를 최종 외형/출시 성공으로 표시하지 않는다.

## 실제 결과

- Blender5.1.1의 별도 factory-startup/disable-autoexec 실행 exit1, `AssertionError: Restored lateral folds remain`. 원본 A318은 use_scripts=false/load_ui=false로 읽었고 입력 be038c04를 다시 열어 복원했다.
- source point ID의 유일성/대응, 같은 world/rest/pose/group 이름·raw skin을 강제했다. 새점(-1)을 복원 대상으로 추정하거나 삭제하지 않았다. 전체 생성·리메시·재삼각화·스무딩/수치 sweep0.
- 남성 선택4964점 중4149점·최대3.769mm 이동. 외부/앞면/중앙 좌표·raw skin/위상/rest/pose/world/PBR/history/손/속성 exact, vertices131178/edges308715/faces177539 유지, nonmanifold0/winding0/tiny2 유지.
- 선택면8328 주변의 native dihedral>90°가14→1, 최대177.667°였다. 남은 접힘의 정확한 edge/인접면·경계 영향은 이 저작 보고서에서 분리하지 않았으므로 원인이 확정됐다고 하지 않는다. 다음은 동결된 복원 결과의 국소 연결과 선택/보호 경계 대조다. 같은 복원/스무딩을 수치 조정으로 반복하지 않는다.
- 남성 검사에서 멈춰 여성 저작0·새 후보/저장0이다. 남성의 미채택 메모리 상태도 별도 렌더하지 않았으며 기존8컷을 새 외형으로 재사용하지 않는다. 독립 재열기·새 GLB/118기술변형/Chrome/실제 사람0.

실제 archive 단계에서 두 원본 SHA 불변을 다시 확인했다. 제작 실패 JSON에는 후속 `two_input_files_unchanged` 필드가 생성되지 않았으며 이를 성공 필드로 덧붙이지 않는다. [manifest](manifest.json)의 archive_source_hashes_passed는 collector의 별도 실제 확인이고 저작 성공이 아니다.

## 보존과 다음 작업

[manifest](manifest.json)의8개는 실제 JSON/로그·동일 실행 저작자와4개 imported helper·collector다. 기존 전문 원본/부분 후보·모든 실패와 이전39/12/37/17개 증거는 그대로 보존했다. 실행 출력은 `/private/tmp/bodyguard-lateral-restore.2NTkpW`였으며 폴더의 모델 생성0을 확인했다. [작성자 리뷰](../lateral-restore-review.md)는 전문가/외부 승인과 다르다.

원래 배치 복원만으로 선택 경계의 연속성을 증명하지 못한다. 남은1개 native edge의 양쪽 면/source point·선택 안/밖·A318/현재 배치의 차이를 읽기 전용으로 대조한 뒤 필요한 국소 연결을 설계한다. 앞면/손·rig/skin·6mm/tiny/닫힘/winding/접힘0·실제 외형 기준은 낮추지 않는다. 전체 원본/GLB/변형/Chrome/목표 기기/실측과 D2/전체1~6은 여전히 필수다. 공개 웹/문구/SDK/판정/안전·개인정보/운영 변경0·텍스트 최소화·별도 승인·Draft/미채택을 유지한다.

```bash
node bodyguard/assets/blender/integration-neck/archive_lateral_restore.mjs --check
```

명령은 보존 바이트/보고서 감사이며 native 저작 재실행이나 새 외형 승인이 아니다. 같은 저작은 재시도하지 않는다.
