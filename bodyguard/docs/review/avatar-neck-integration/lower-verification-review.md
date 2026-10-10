# 작성자 리뷰: 목 중앙 후보의 후속 실제 검증

2026-10-10 · `engineering:code-review` · base d734b0f · 외부/전문가/서브에이전트 리뷰 아님

저장be038c04의 독립 Blender 재열기와 실제 외형8컷을 별도17개 증거로 보존했다. 모델이나 native 검사 코드는 이번 구간에서 바꾸지 않았다. 보호 통과와 외형 반려를 구분하며 이전37개 체크포인트를 덮어쓰지 않는다.

## 미해결 P2

목 아래·어깨와 전체 관절 마감은 참조 외형에 못 미친다. 중앙의 미세 재연결은 전체 외형 개선을 보여 주지 않는다. 남녀 옆 목/어깨에서 원래 앞면을 보호한 연결 설계가 필요하다. 새 최종 원본의 GLB 왕복·118기술pose·브라우저와 실제 사람/목표 노트북·시범 정확도는 아직 미실행이다. 과거 성공을 새 후보에 복사하지 않는다.

## 검토

- 보안: 사용자 영상/좌표·API/SDK/계정/시크릿/운영 변경0. 새 archive는 고정 출력·whitelist·정규 private proof 경로·realpath/비symlink·wx를 검사한다. 관측된 native 검증은 factory-startup/disable-autoexec의 별도 프로세스다. 사용량 허용 상태 확인 후 정상 자동 승인 절차가 통과했으며 제한 우회/설정 변경은 없다.
- 성능: archive/검증은 오프라인 제작 도구이며 웹 hot path에 추가되지 않는다. 17개 제한된 원본 증거만 읽고 .blend는 기존 위치의 SHA로 결속해 다시 복사하지 않는다. 실제 웹 성능 통과를 주장하지 않는다.
- 정확성: 새 helper의 확인은 바이트/이미 실행된 JSON·로그 감사일 뿐 native 재실행이 아니다. 보존된 후보·입력 SHA, 앞면/손·raw skin/좌표/polygon·rig/world/PBR/history·이전 INT provenance exact, 닫힘·tiny 검사와 실제8PNG를 대조한다. archive의 외형 실패 플래그는 작성자 검수 결과이며 자동 이미지 품질 판정이 아니다.
- 유지보수: 이전 원본·실패·37개 체크포인트와 실행 helper는 변경하지 않는다. 당시의 미실행/승인 제한을 후속 실행과 구분해 새 README/Story/현재 실행표에 연결했다. 코드 작성자가 수행한 리뷰이고 외부 전문가 승인으로 세지 않는다.

## 실제 확인

별도 native 재열기 exit0/렌더 exit0와 새8컷 직접 검수, 새17개 archive 바이트 감사와 Biome 검사는 통과했다. 현재6개 Markdown의321개 로컬 링크/누락0, `git diff --check`와 이전137/30/66/35/37개 frozen 증거의 저장 바이트 감사도 통과했다. 이전 감사는 Blender/브라우저 재실행이 아니다. 이번 변경에는 제품 build/DOM/API/SQL/카메라/GLB/118pose/브라우저 실행이 없으며 미실행을 통과로 표시하지 않는다.

초기 로컬 임시 Markdown 진단은 Node 괄호 오타로 SyntaxError가 났고 수정 명령은269개 링크/누락0이었다. 초기 원시 파일은 캡처하지 않았고 도구 transcript에만 남았다. 이 진단 오류는 native 실패가 아니다. 현재 증거를 추가한 뒤 링크 검사는 다시 실행한다.

GitHub fetch/PR 조회는 이전 DNS/API 실패 뒤 정상 승인 절차로 재개됐다. main a466528/PR108 d734b0f·OPEN/Draft·체크 없음, 최초 UNKNOWN 이후 새 조회에서 MERGEABLE/CLEAN을 확인했다. 이 관찰을 후속 HEAD의 diff/CLEAN 증거로 재사용하지 않는다.

검증 보존e47bd748c5b72b467e670201561be49d86e4f1af의 실제 커밋·원격 푸시와588개 PR파일 상태/Git blob 일치·로컬/원격0/0·작업트리clean을 확인했다. 새HEAD 최초 UNKNOWN 이후 별도 최종 조회는OPEN/Draft·MERGEABLE/CLEAN·체크 없음이었다. [본문](https://github.com/HSU-OAS/bodyguard/pull/108)을 실제 갱신한 뒤 제출 원문과 동일함을 다시 읽었고 [작성자 검토](https://github.com/HSU-OAS/bodyguard/pull/108#issuecomment-6093381678)를 남겼다. P2 때문에 병합하지 않았다.

archive 중복 실행은 예상exit1로 거부됐고 README/manifest/증거 포함19개 바이트는 불변·후속byte audit 통과였다. GitHub CLI --slurp/--jq 동시 옵션은 설치 버전에서 지원되지 않아 첫 파일 조회가 실패했다. 첫 빈 출력은 증거로 쓰지 않고 지원되는 --paginate/--slurp의 새 원본으로588개를 대조했다. 초기 실패 메시지는 도구 transcript에 남고 별도 stderr 파일은 캡처하지 않았다. Codex 검증 문서 열기는queued 응답이며 사용자가 실제 화면을 봤다는 뜻이 아니다.

## 판정

**Request Changes / Draft 유지 / 병합 보류.** P2가 남아 Story·D2-A·전체1~6 미완료다. 승인되지 않은 외형/판정을 공개하지 않는다. 비용/계정/시크릿/운영DB/배포/출시·중요한 안전 및 개인정보 변경은 별도 승인이다.
