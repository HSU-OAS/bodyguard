# A124–A129 — 목 경계 측정·국소 정제 반려·native 참조 보완

**새 모델 저장/채택 없음·외형 미통과**다. 개선된 A123을 입력으로 이어갔고 기존 원본·GLB·검증 증거·개발 A37은 보존했다. CEO 최신 사진의 매끈한 얼굴–목 연결, 무의상 중성 백색 남녀 통일 표면·자연 곡선·필요 관절·리깅 정확도와 전체1~6 완료/승인 기준은 그대로다. A-02/A-08 외형 P2가 남아 Draft PR #9를 병합하지 않는다.

## 실제 원인 대조와 결과

A124는 A106의 원래 face ring과 A123의 original-id ledger를 대조해 새 cap2,598/2,521면과 경계374/363 edge를 정확 식별했다. 경계 면각 p95는 원래6.258°/11.207°에서 A1238.539°/15.923°다. 작은 edge까지 포함한 최댓값177.326°/29.343°이며 최댓값 자체를 1mm 초과 긴 접힘/의학 판정과 혼동하지 않는다. 뒤쪽 높이.87..94의 관측 edge/인접 면은 원래 좌표·연결이 그대로였고 45° 초과 edge는0이었다. 이는 사진에서 보이지 않는 뒤통수 외형이나 전체 침투 검사의 통과가 아니다.

기존 A87의 finite ramp/native 국소 fairing과 A63의 깊이축 전용 native 정제 패턴을 재사용했다. 같은 build의 [Blender 공식 스무딩 소스](https://github.com/blender/blender/blob/b70da489d7f4/source/blender/modifiers/intern/MOD_correctivesmooth.cc)를 실제 전체 읽었다. LENGTH_WEIGHTED는 edge 길이와 이웃 수를 사용하는 스무딩이지 전문 표면 투영이 아니다. 성긴 cap과 촘촘한 기존 면의 경계에서 단순 fairing이 적합하지 않다는 판단은 **아래 실제 실패와 소스에서 한 추론**이며 유일한 형상 원인을 증명한 것은 아니다. 강도 반복 탐색·guard 완화는 없다.

| 실제 native 대조 | 남성 | 여성 | 판정 |
|---|---:|---:|---|
| A125 LENGTH_WEIGHTED, factor.15/8회 이동 | 9.697mm | 6.426mm | 기존6mm 초과, 접힘1→66/0→56·반려 |
| A126 SMOOTH/Y-only, 같은 factor/횟수 이동 | 6.467mm | 5.754mm | XZ 보존에도 접힘1→85/0→88·반려 |
| A128 기존 점 실제 보존 | 123,513 | 122,269 | 좌표/skin 정확·누락/중복0, 손 누락0 |
| A129 native 새 cap 내부점 | 11,130 | 10,800 | 기존 cap 경계/모든 A123 점 보존 |
| A129 tiny 면 / global nonmanifold | 27 / 1 | 33 / 0 | 접힘1/0 유지해도 형상 guard 불합격 |

A125/A126은 각각11,716/11,197점만 연속 artist mask로 편집했다. 영역 밖111,797/111,072점, 전체 skin/위상·손·각163 bones의 head/tail/parent/rest와 world 행렬을 실제 대조했다. 이는 **메모리 시험의 보존**이며 저장 원본의 독립 재열기 검수가 아니다.

A127은 `BMVert` 객체 참조가 무효화돼 표면 맞춤 전 exit1로 중단됐다. 별도 A128에서 세분화 후 모든 이전 handle이 무효였지만 숫자 parent ID·좌표·skin을 다시 대조하면 기존 점은 모두 정확히 남음을 확인했다. A129는 이 근거로 **stale handle 대신 exact numeric identity를 비교**하도록 보완했다. 이전 파일의 실행 byte를 고치지 않았고 손 선택의 실제 point index도 검사했다. 원래 점을 사후 복원하거나 보존 guard를 삭제한 수정이 아니다.

A129는 cap 내부 edge3,710/3,600개만 native cuts3/BEAUTY로 세분화하고 새 점만 A106 전문 표면에 맞췄다. 기존 모든 A123 점의 좌표/skin·경계374/363, 변경 밖 face/winding163,732/161,970·손/각163rest/행렬을 보존했다. 새 cap24,858/24,121면, 표본 old→new 최대2.757/2.353mm·new→original0.988/0.514mm와 새 점 fit 이동4.297/3.085mm지만 tiny 면/남성 열린 edge guard에서 중단했다. 표본 거리는 전체 Hausdorff/사용자 신체 오차가 아니다. 열린 edge가 subdivision/triangulation/conformance 어느 시점에 생겼는지는 이번에 분리 측정하지 않았다.

## 검증·보존·미실행

새 텍스트/gzip24개에 대한 제한된 시크릿 패턴 확인은 hit0/exit0이었다. 전체 보안 감사나 형상 통과가 아니다.

Blender5.1.1/build b70da489d7f4의 별도 native6회가 각각 **exit0/1/1/1/0/1**로 종료된 뒤 다음 actor를 실행했다. 새 source·GLB·PNG·118변형·Chrome·카메라 요청은 **모두0**이다. 반려를 통과로 바꾸지 않았고 A123의 기존 성공 결과를 이번 실행으로 재표시하지 않았다. 기존 실제 A123 이미지4개(남녀 측면·웹 뒤 목)를 다시 직접 열람했으나 새 preview 제작으로 계산하지 않는다. 저장 후보가 생긴 다음 독립 재열기·원본/GLB118개·실제 브라우저/외형을 다시 수행한다.

[경계 대조](cap-seam.json)·[국소 fairing 반려](weighted-fairing.json)·[깊이축 반려](depth-fairing.json)·[실제 parent 보존](native-point-retention.json.txt.gz)·[세분화 반려](density-trial.json), [실행/미실행 기록](execution-record.json)과 [20사본/16gzip SHA](copy-manifest.json)를 보존했다. Python6개의 default Ruff·isolated E4/E7/E9/F/I/B·88 format0, copier/checker Node syntax0, exact native parent data check0을 확인했다. 입력과 이전 검수 사본/controls·개발/helper를 연결한 **278기존 파일 SHA 불변**을 재확인하며 저장소 전체 감사/외형 승인의 대체가 아니다.

```sh
node bodyguard/assets/blender/review/candidate-a124-a129-diagnosis/evidence-check.cjs
```

copy script는 재실행하지 않는다. gzip은 실제 실행 byte/JSON/관측 로그의 사본이며 추출한 의존 파일 경로·새 출력 경로를 명시해야 native 명령을 재현할 수 있다. 로그는 tool 관측 chunk이고 전체 stdout을 보장하지 않는다. A128은 authored ID 전체 stdout이 tool에서 잘렸고 archive도16,000자 prefix로 제한했지만 **완전한 native JSON은 gzip으로 보존**했다. 다음 diagnostic stdout은 요약만 출력한다. 잘못된 읽기 glob/경로와 web fetch 실패·restricted curl DNS 실패는 native 제작 실패와 구분하며 공식 소스의 escalated read-only curl은 exit0이었다. 첫 문서 patch는 header 불일치로 반영되지 않았고 실제 header 확인 후 새 patch를 적용했다.

debug·코드 리뷰·문서화 스킬로 원인/참조 오류·반려/미실행 경계를 확인했다. 다음은 A123을 유지한 **작은 child 면/남성 nonmanifold edge의 native 단계별 국소 조사·정리**다. 기존 부모점·경계/skin·리그/형상 guard를 통과할 때만 새 후보를 저장한다. 전신 충돌·전문가 승인 동작·실제 수행자/리타게팅/웹캠 정확도·다른 장치/사용성·운영/HTTPS 배포·출시는 이번에 미실행이며 S2.4·2단계·전체1~6 완료로 표시하지 않는다.
