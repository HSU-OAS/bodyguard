# 전문 원본 대조 — 접힘은 현재 후보에서 생김 / 새 아바타 아님

2026-10-10 · [Story](../../../stories/avatar-neck-integration.md) · Draft #108 · 외형 P2 미해결

남은6면과9개 점을 원래 A318 전문 원본에 실제 대응했다. **해당 면 연결은 같지만 현재 점 배치가 달라져 접혔다.** 같은 스무딩·단위·삼각화 반복 대신 원래 전문 배치에 근거한 국소 복원을 설계했다. 이 검사는 원인 대조이며 외형 개선이나 새 후보 제작 성공이 아니다.

## 실제 확인

- 별도 Blender5.1.1 factory-startup/disable-autoexec 프로세스 exit0. A318은 use_scripts=false/load_ui=false로 열었다. 두 입력 파일 SHA와 각 읽기 전후 남녀 body/rig 전체 snapshot은 불변이다. 모델 저장·저작·반려 재현·렌더/GLB/전체변형/Chrome·실제 사람 시험0.
- 9개 point ID는 두 파일에서 각각 유일하다. 대응 점의 raw skin과 one-ring source ID, 6면의 연결/winding은 exact다. 같은 world/그룹 이름을 확인했다. point ID 존재만으로 좌표 보존을 가정하지 않았다.
- 현재 점은 A318에서 0.140~2.127mm 이동해 있다. 좌표는 에셋 내부의 제작용 값이며 사람의 관절 좌표/정상 범위가 아니다. 해당 6면/9점의 결론을 전체 body 보호나 전체 외형 원인으로 확장하지 않는다.
- A318 대응 6면은 모두 normalY 양수·검사한 주변 edge 최대 5.705°다. 현재 입력의 삼각167049/quad171044는 normalY 음수·edge 최대176.768°다. A318과 연결이 같은 면이 현재 기하에서 접혔으므로 이 국소 문제는 원본 A318의 접힘을 그대로 상속한 것이 아니다. 변형을 일으킨 정확한 중간 저작 단계를 이 대조만으로 확정하지는 않는다.
- [이전6면 진단](../lateral-faces/README.md)의 “원래”는 그 시험의 입력 be038c04였다. 전문 원본 A318을 뜻하지 않으며 이 결과와 혼동하지 않는다. 이전 실패/진단은 그대로 보존한다.

## 증거·경계

[manifest](manifest.json)의 4개는 실제 JSON/로그·동일 실행 Python과 collector다. collector --check는 보존 바이트/보고서 감사이며 native 재실행/외형 승인이 아니다. [작성자 리뷰](../lateral-origin-review.md)는 전문가 검토/외부 승인과 구별한다.

입력 be038c04는 [보존 부분 원본](../lower-attempt/candidate-neck-center.blend), SHA256 `be038c042c8b29acf53e0877adc085fec92608e230a563b6860914a01f58e068`이다. A318의 SHA256은 `2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff`이며 Draft #9의 원래 작업트리에서 읽기만 했다. 실행 출력은 `/private/tmp/bodyguard-lateral-origin.RC3Wjj`였다.

다음 보완은 같은 앞면 보호 선택 구간의 기존 point만 원래 전문 배치로 복원하는 것이다. 새점(-1)은 추정/삭제하지 않고 외부/앞면/중앙·raw skin/rig/위상/history/PBR·6mm/tiny/닫힘/winding/선택 접힘0을 유지한다. 남녀 모두 통과한 새 파일만 저장하고 독립 재열기/실제 외형·새 GLB/전체변형/Chrome/실측은 별도로 재실행해야 한다. 현재 외형 P2·D2/전체1~6 미완료·Draft/미채택과 최소 문구·안전/개인정보/별도 승인 경계는 그대로다. 공개 웹/SDK/판정/운영 변경0.

```bash
node bodyguard/assets/blender/integration-neck/archive_lateral_origin.mjs --check
```
