# A48 — native LINEAR 연결 비교·실제 전체 검수

2026-10-01 · S2.4 A-02/A-04/A-07. **원본·GLB 각각118개 기술 변형과 설치 Chrome3개 PASS. 목 경계 외형은 미달이라 미채택한다.** 기본 개발 A37·외형 P2·Draft PR #9 병합 보류·1~6단계/승인 기준은 유지한다.

## 실제 변경과 보존

[A47](../candidate-a47-rejected/README.md)과 같은 A38 입력/CC0 전문 목 패치·0.81/0.87 범위·12mm 연결에 native bridge의 보간만 SURFACE→LINEAR로 비교했다. [생성 당시 코드](producer-at-generation.py.txt)의 실제 SHA는 `560e0a5be70483c0e0d30e1ab61f5444c973092e110e54a13e0be1aeac52de5a`이며 실행 코드와 report의 보간 문자열 두 곳만 다르다. 저장소의 기본 제작 코드는 SURFACE 그대로다. 실패한 비교를 기본으로 채택하지 않는다.

[실제 생성](generation-report.json)은 exit0였다. 전문 패치1,771/1,804점·영역 밖 기존 신체 좌표/skin·보호 손·각163bones/rest를 보존했고 내부 닫힘 대상은0/0개다. 원본105,856/104,186점이며 입력142,087/139,882점과 동일 위상이 아니다. 이전 실패 이음매→후보 남10.196497/여11.054702mm, 반대10.242811/10.984547mm는 진단 값이지 해부학/사용자 측정 정확도 목표가 아니다.

[실제 좌표 대조](surface-linear-comparison.json)에서 A47/A48 공통점은 남100,240·여98,906점이고 서로 다른 점은 각각5,616/5,280점이었다. **두 보간의 형상이 같다는 추정은 실제로 틀렸다.** 변경점을 수치로 확인했지만 외형 통과를 뜻하지는 않는다. readonly 진단은 파일/사용자 장면을 저장하지 않았다.

## 실제 외형·연결 진단

[정면](faceless-front.png)·[3/4](faceless-quarter.png)·[여성 측면](faceless-side-female.png)·[기울임](faceless-neck-female-left.png)을 실제 확인했다. 남녀 무의상 백색 표면·여성 체형 곡선·관절 구조는 유지했고 이전 여성 의상 경계/허리선/옷단을 되살리지 않았다. 유두·생식기의 사실적인 세부 표현은 추가하지 않았다. 그러나 머리 아래 수평 경계와 목 뒤의 옷깃 같은 턱은 남아 **참조 외형 미통과**다. 구조를 지우거나 리그/변형 정확도를 낮추어 숨기지 않는다.

[실제 face 법선 진단](interface-normal-diagnostics.json)에서 기존 머리 경계 p95는 남37.195373°/여53.531522°, 최대41.668122°/57.227228°였다. A47보다 극값 일부는 줄었지만 p95는 악화됐고 실제 렌더에도 경계가 남았다. 이것은 메시 인접 face 방향 변화이지 사용자 관절/임상 목표/합격 임계값이 아니다. 상부 경계 밀도는 남488↔134·여426↔132점으로 달랐다. 다음은 그 경계 대응과 접선 연속성의 native 국소 수정이며, 밀도 차이가 원인이라는 가설을 아직 검증 완료로 표시하지 않는다.

## 실제 원본·GLB 검수

- [원본](source-deformation-report.json):118개 기술 변형/121행/실패0·rendered:true·실제34PNG.
- [GLB 재가져오기](web-deformation-report.json):118개/121행/실패0·qc-only/rendered:false. 원본 렌더를 웹 native 렌더로 세지 않는다.
- 최대 원래1mm 초과 edge 변형 비율은 원본2.943930367·GLB2.947679803으로 기존3미만 기준을 유지했다. 목 원본 남1.189189/1.186151·여1.288001/1.180155, GLB 남1.189183/1.186127·여1.288048/1.180257이다.20°는 기술 스트레스이지 권장 운동 각도가 아니다.
- 양쪽 모두 연결 성분1/non-manifold0/정규화 오류0/각163bones·별도 의상0/동일 백색 Base Color·Metallic·Roughness·Specular·Alpha. 침투 검사의 별도 의상 대상은 없으나 전신 기술 검사는 생략하지 않았다.
- [왕복](roundtrip-report.json):각5meshes·이미지/액션0·fin 제거0, 영향 제한258227/255747·남성 parent 경고가 있었다. 기존1µm native 중복 정리 후 웹 정점105,854/104,183으로 원본과 정점 수 동일이라고 주장하지 않는다. 전체 재가져오기 변형을 별도로 실행했다. 생성/왕복 report의 pending은 당시 상태 그대로다.

| 보존 파일 | bytes | SHA-256 |
|---|---:|---|
| [원본](../../bodyguard_avatar_candidate_a48_rejected.blend) |22,931,173|`c3e63179a0ad28d8721b9444fe32965c2b094a43ef93c3698ccd9db1bbf64e20`|
| [남성 GLB](glb/bodyguard-male-candidate.glb) |9,469,000|`20353cebaaf22f8d825f85d816159d07732bf529ca476483e762cf91ab5415aa`|
| [여성 GLB](glb/bodyguard-female-candidate.glb) |9,322,124|`0efaa238be19d49120010bc0614f490f92d7f6c17cb6c56ca2030813d88ed81a`|

웹/왕복 원본은 `/private/tmp/bodyguard-tailor.6b7Uvu/a48-web.blend`·`a48-web-roundtrip.blend`에 보존했다. SHA는 각각 `05a1e1a7a91d5277578c3055b3b297ff77219bceb09566142eedf4cedb5d1c0a`·`406abdb00cfe71707eff709c2ce6410600ebfaad646c1baa872ec118107fbb38`다. 입력 A38 SHA `9a82176b42fee0a2ff1054f8109e78b3238e660fc170ba27ee6ec6a2779e2644`·전문 번들 SHA `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`는 이전과 같다. 기존 파일/증거·사용자 Blender 장면·기본 개발 연결을 변경하지 않았다.

## 실제 설치 Chrome

[보고서](browser-report.json)는3개/40.762680s/skip0/flaky0/unexpected0/exit0 PASS다. [남성](male-two-models.png)·[여성](female-two-models.png) 실제 두 모델 화면을 native34컷과 함께 총36PNG로 보존했다.

| 두 모델 | 실제 표본 | mean(ms) | p95(ms) | draw calls/triangles |
|---|---:|---:|---:|---:|
| 남 |180|16.663333|17.900000|21 /863,202|
| 여 |180|16.664444|18.200000|21 /849,834|

설치 Chrome154.0.8037.58/headless1440×1080DPR1·Mac16,12/Apple M4/16GiB에서 원본/GLB/진단 native handle을 모두 종료한 뒤 실행했다. GPU 상세/전원/전체 부하는 미수집이다. native GLB SHA·여덟 가중치·독립 두 뼈대·한쪽 합성 변형/다른 모델 정지·정지 버튼·503/context-loss 재시도·이탈·카메라0·외부 차단 A-00을 실제 검사했다. 자체5182/비청취 프록시만 사용하고 API/DB/SMTP는 시작하지 않았다. NO_COLOR/Three.Clock/WebGL 경고·의도한503 로그가 있었다. 이 프레임 간격은 GPU 시간·실제 사람/웹캠15fps·피드백1초·다른 노트북 성능 증거가 아니다.

## 재현·미실행

검수에는 donor 없이 [이 원본](../../bodyguard_avatar_candidate_a48_rejected.blend)에 [기존 명령](../../README.md)의 새 폴더와 `--candidate --mannequin`을 사용한다. GLB 재가져오기만 `--qc-only`를 추가한다. 재생성은 보존된 생성 당시 코드의 바이트 사본을 새 .py 경로로 만든 뒤 A38/기존 전문 번들·0.81/0.87/0.012·존재하지 않는 새 출력을 명시한다. 현재 SURFACE 코드를 A48 재현 코드라고 하지 않는다.

Chrome은 backend에서 `BODYGUARD_AVATAR_QA_DIRECTORY=<이 glb 폴더 절대 경로> PLAYWRIGHT_JSON_OUTPUT_FILE=<새 보고서 경로> .venv/bin/python -m tests.run_browser avatar`다. 재실행 전에 결과를 보존한다. 이번에 제작 코드/CLI guard·검사 임계값은 변경하지 않았고 A47의 native15·파일/중복2회귀를 새로 실행한 것으로 세지 않는다.

`engineering:debug`로 실제 보간 차이·법선/렌더를 대조했고, `engineering:code-review`로 두 문자열만 다른 비교·기존 보존 guard를 확인했다. `engineering:documentation`으로 실제/합성/미실행·외형 반려를 분리했다. 새 의존성·단순 도형 인체·전신 remesh·임계값 완화는 없다. 외형 P2는 미해결이므로 병합하지 않는다.

로컬 증거 검사162개 assertion에서6파일 SHA/크기·생성 코드의 정확한 두 문자열 차이·36PNG 시그니처·QA242행/각118개·Chrome3개/공급 GLB SHA·변경 Markdown4파일의 로컬96링크를 실제 통과했다. `git diff --check`도 통과했다. 저장소 제작 코드/테스트는 수정하지 않았으며 이번의 새 native Ruff/format·CLI 회귀를 실행한 것으로 세지 않는다.

이번 후보의 API160/Vitest133/계정·Google/production build는 재실행하지 않았다. 실제 사람·시범·리타게팅·Gmail/Google 공급자·2단계/1~6단계·전문가 승인·출시는 미완료다. 별도 승인 대상은 실행하지 않았다.
