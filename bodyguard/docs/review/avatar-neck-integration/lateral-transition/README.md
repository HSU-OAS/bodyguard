# 전문 배치의 연속 전이 — 실제 반려

남성의 앞면/중앙/선택 밖 좌표·raw skin/위상·리그·마감은 유지됐으나 접힘이 남아 **native exit1·저장0**으로 종료했다. 여성 제작·새 원본/렌더/GLB/전체 변형/Chrome·실측은 미실행이다. 실패를 외형 개선이나 아바타 완성으로 표시하지 않는다. 외형 P2·Draft #108·D2/전체1~6 미완료를 유지한다.

## 실제 결과

같은 be038c04/A318 입력과 기존 `lateral_domain.weight`를 사용했다. 기존 hard 복원은 선택 여부만 판별하고 모든 선택점을 원래 위치로 옮겼으나, 이번은 동일한 감쇠를 위치 전이에 적용했다. 새 감쇠 수치·스무딩·전신 생성·위상 변경은 없다.

남성4964개 선택점 중4119개·최대3.730mm가 이동했고 기존 geometry/원래 보호·skin/rig/PBR/history/손/속성 exact·닫힘0/winding0·tiny2→2를 확인했다. 접힘14→3/최대164.739°로0 기준을 충족하지 못했다. hard 복원에서 접힌 경계의 세 점 전이는0.000402/0.000515/0.004218이며 선택 밖 점은0이다. 이 전이 값을 바꿔 통과시키는 반복 시험은 하지 않는다.

후속 [원래 면/위치 진단](../transition-faces-run/README.md)은 동일 실패 rows를 exact 재현했다. 남은3개 edge는 이전 A318 대조의 작은 삼각면167049 주변이고 기존 전이는0.296~0.601이었다. 원래14개 접힘의 관련27점은 모두 현재 선택 안/앞면 보호 밖/기존 양수 source ID이며 A318 대응이 유일했다. 따라서 해당 원래 core의 실제 형태와 보호 경계 사이의 연결을 별도로 설계할 수 있다. 단순 감쇠 재조정으로 해결됐다고 주장하지 않는다.

## 보존과 검증 경계

[원시 실제 종료](../lateral-transition-run/native-exit.json), author.json/log·실행 helper/runner4개 imported source를 별도 영구 폴더에 보존했다. collector의10개 gzip/원시 SHA와 실제 exit1·후보 없음·입력 두 SHA 불변을 감사했다. 실행된 source는 이후 수정하지 않는다. 원본/이전 후보·반려를 덮어쓰지 않았다.

초기 준비 검사에서는 import 순서의 Biome exit1 뒤 proof 생성이 건너뛰어졌는데도 runner를 호출해 ENOENT/Node exit1이었다. Blender는 실행되지 않았으므로 native exit는 null이다. [초기 실패와 실행 source](../lateral-transition-preflight/result.json)를 보존했고 새 이름의 runner에서 정적 검사 통과를 확인한 뒤 proof를 생성/실행했다. 초기 실패를 native 제작 결과로 세지 않는다.

다음은 실제 원래 core를 기준으로 한 전문 도구의 제한 변형/연결 설계다. 원래 앞면/중앙/외부 좌표와 raw skin/topology/rig·6mm/tiny/닫힘/winding/접힘0을 유지한다. API 가능성 확인과 새 제작·외형/GLB/변형/브라우저·실제 사람 검증을 구분한다. 공개 제품·UI 최소 문구·판정/SDK/안전/개인정보·운영과 별도 승인 경계는 변경하지 않는다.
