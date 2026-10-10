# 작성자 코드 리뷰: 앞면 보호 목 중앙 부분 보완

2026-10-10 · `engineering:code-review` · base b76f0a1 · 별도 사람/전문가/서브에이전트 리뷰 아님

전문 원본2932e63d의 중앙 목만 국소 재연결한 부분 후보be038c04와 읽기 전용 관찰, 보존·재열기 준비 코드를 검토했다. 실행된 저작의 내부 보호 검사는 통과했지만 새 파일의 독립 검증·외형은 미실행이다.

## 미해결 항목

| 항목 | 수준 | 필요한 보완 |
|---|---|---|
| 목 좌/우·어깨와 전체 관절 외형 | P2 | 앞면을 보호하는 별도 연결 설계와 실제 새 전체 외형 검증. 중앙 부분 성공을 전체 아바타 완료로 확대하지 않음 |
| 새be038 원본의 독립 보호·외형·변형·GLB·브라우저 증거 | 미실행 필수 검증 | 자동 승인 검토 제한 해소 후 현재 저장 후보 재열기부터 실행. 이후 완성된 새 전체 원본에서 나머지 필수 검증. 과거 결과 사용 금지 |

## 검토 범위

- 보안: `.env`/계정/시크릿/사용자 영상·좌표·SDK/API·배포 변경0. Blender는 별도 factory-startup/disable-autoexec 프로세스였고 기존열린 Blender·원본을 수정하지 않는다. archive는 고정 결과 경로·파일 whitelist·비symlink·wx·입력/후보 SHA를 검사한다. 승인 검토 거부를 우회하지 않았다.
- 성능: native BMesh/BVH/단면 검사·보고서는 오프라인 제작용이며 공개 브라우저 hot path에 들어가지 않는다. BMesh와 평가된 임시 Mesh는 finally에서 해제하고 skin-transfer 임시 객체·mesh는 저장 전 제거한다. 실제 새 노트북/WebGL 성능은 미실행이다.
- 정확성: 앞면은 실제 원래 ray 가시성으로 보호하고 coordinate Y>0을 뒤 표면과 동일시하지 않는다. 원래 point INT provenance·raw skin/위상·손/rest/world/PBR·history의 보호와6mm/닫힘/tiny·뒤 방향/원래 내부/추가 교차 거부가 유지된다. 새 점에 이전ID0을 부여하지 않는다. read-only의 복수 hole·CDT 삽입은 관찰 결과이지 통과된 새 제작이 아니다.
- 유지보수: 기존 frozen 원본·실패·helper는 변경하지 않았다. 새 helper와 초기 정적 실패 로그/일부source를 별도 보존하며 manifest는 현재helper SHA와 보존바이트를 대조한다. 준비된재열기와 기존렌더 helper는 새be038에 대해 아직 실행하지 않았다.

실제 로컬 Ruff check/format10파일·Biome archive checker·`git diff --check`, 새37개 보존바이트와 이전137/30/66/35개 해당manifest 바이트 점검은 통과했다. 기존Draft9 HEAD25a9bd6/1959개 상태·A318/ce8887d/7481c5f/2932e63d/CEO참조 SHA는 불변이다. 이 점검은 새 native 재실행이 아니다.

현재 갱신 직전 GitHub 읽기는 `error connecting to api.github.com`으로 실패했다. 원격 최신 상태·체크를 새로 확인했다고 표시하지 않으며 이번 보완의 푸시/PR 본문 갱신/병합은 아직 수행하지 않았다. 로컬 보존과 원격 완료를 구별한다.

## 판정

**Request Changes / Draft 유지 / 병합 보류.** P2와 미실행 필수 검증이 남았다. 새 후보를 공개 제품에 채택하거나 Story·D2-A·전체1~6 완료로 표시하지 않는다. 새원본/증거의 보존 커밋은 출시 승인·검증 완료가 아니다. 중요 안전/개인정보·비용/계정/시크릿/운영DB/배포/출시 별도 승인 경계는 그대로다.
