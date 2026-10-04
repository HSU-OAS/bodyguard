# A47 — 얼굴 특징 없는 목 범위·연결 구간 재검수

2026-10-01 · S2.4 A-02/A-04/A-07. **원본·GLB 각각118개 기술 변형과 설치 Chrome3개는 통과했지만, 확대에서 목 경계가 남아 외형 미채택한다.** 개발 기본 A37·외형 P2·Draft PR #9 병합 보류·전체 1~6단계/승인 기준은 그대로다.

## 수정 근거와 보존

이전 [A46b 반려](../candidate-a46b-rejected/README.md)의 높은 절단면은 전문 원본의 입·턱을 목 패치에 포함했다. 이번에는 높이0.81~0.87의 목 범위를 유지하고, 실제 반대쪽 제거까지 적용한 native 단면 비교로 연결 여유10/12/14mm를 검사했다. [실측 요약](transition-profile.json)은 외곽 극값 차이이며 동일 정점 대응/해부학 정답/사용자 측정 정확도가 아니다.12mm는 전문 패치 위쪽의 얼굴 아래 돌출을 피하면서 기존 머리 경계에 연결하는 아티스트 시험값이다.

[생성 당시 코드](producer-at-generation.py.txt)의 SHA는 `774b34a1330548f9e6dfe087f0bd561bff5ba934577df9d0f07668b6a603f7d0`다. 기존 제작 코드에 유한한8~32mm 연결 여유를 명시하는 선택 입력만 추가했고 기존 기본8mm는 유지한다. 영역이 겹치면 중단하며, 기존 native SURFACE/cuts6·두 단순 경계·내부 닫힘·보존 검사는 그대로다. 임상 판정이나 QA 기준을 낮춘 변경이 아니다.

실제 생성은0.81/0.87/12mm로 exit0였다. 남녀 전문 패치1,771/1,804좌표, 영역 밖 신체 좌표/skin·보호 손·각163bones/rest를 보존했다. 내부 닫힘 대상은 각각0개다. 후보105,856/104,186정점이며 기존142,087/139,882정점과 동일 위상이라고 주장하지 않는다. 이전 이음매→후보10.196497/11.054702mm, 반대10.242811/10.984547mm는 진단 기록이지 해부학 목표가 아니다.

[native 회귀](native-boundary-regression.json)는 경계7개와 잘못된 CLI 입력8개, 합계15개를 실제 실행해 exit0 PASS했다. 정상 import는 제작 CLI를 실행하지 않고 잘못된 입력은 장면 변경 전에 차단된다. 합성 경계/입력 시험이지 실제 사람 동작 검증이 아니다.

[별도 파일/중복 대조](file-overlap-regression.json)2개도 실제 exit0였다. 이미 있는 A47 출력 거부와 입력 신체 좌표 불변을 확인했다. 원본은 저장하지 않고 메모리의 남성 메시만0.3배로 만든 음성 대조에서32mm 연결 구간 중복을 명확한 assertion으로 거부했다. 그 축소는 채택할 신체/품질 검사/운동이 아니다. 출력3개가 생성되지 않았고 입력 파일 SHA 불변을 확인했다.

## 실제 외형

[정면](faceless-front.png)에서 이전 입 모양 돌출은 없어졌다. 그러나 [남성 측면](faceless-side-male.png)의 머리 아래 수평 주름·뒤 목 경계, [여성 측면](faceless-side-female.png)·[뒤 목](faceless-body-back-female.png)의 옷깃 같은 턱과 [목 기울임](faceless-neck-female-left.png) 표면을 더 정제해야 한다. 남녀 무의상 백색 중성 표면·여성 자연 곡선·관절을 유지했지만 참조 품질은 미통과다. 구조를 지우거나 리깅 정확도를 낮추어 경계를 숨기지 않는다. 기술 PASS가 외형·의학/운동 정답·전문가/출시 승인은 아니다.

[실제 연결면 법선 진단](interface-normal-diagnostics.json)은 native 제작 결과의 네 경계에서 인접 face의 방향 변화를 읽었다. 남녀 기존 머리 경계의 p95는12.255681°/22.936701°, 최대116.656872°/58.133297°였다. 이는 메시 face 사이 각도이고 사용자 관절 각도/의학 목표/합격 기준이 아니다. 큰 극값의 발생 위치도 남겼다. 위상 정상·변형 PASS만으로 이런 주름을 배제할 수 없으므로 다음은 새 bridge의 곡면/접선과 경계 대응을 직접 보완한다. 전문 패치·영역 밖 구조·리그 보존과 전체 QA는 유지하며 높이 변경만 반복하지 않는다.

## 검증 종료 기록

- [원본](source-deformation-report.json):118개 기술 변형/121행/실패0, `rendered:true`, 실제34PNG.
- [GLB 재가져오기](web-deformation-report.json):동일118개/121행/실패0, `--qc-only`/`rendered:false`. 원본 렌더를 웹 렌더 실행으로 세지 않는다.
- 최대 edge 비율은 원본2.943930367/GLB2.947679803다. 원래1mm 초과 edge의 기존3미만 기준을 유지한다. 목 원본 남1.189189/1.186151·여1.288001/1.180155, GLB 남1.189183/1.186127·여1.288048/1.180257이다.
- 남녀 연결 성분1/non-manifold0/정규화 오류0/각163bones, 별도 의상0/동일 백색 Base Color·Metallic·Roughness·Specular·Alpha를 실제 확인했다. 의상 침투는 대상 없음이며 전신 변형 검사는 생략하지 않았다.
- [왕복](roundtrip-report.json):각5meshes, 액션/이미지0, fin 제거0. 남성 parent 경고/영향 제한258227·여성255747이 있었고 전체 재가져오기 변형을 별도로 실행했다. 생성·왕복 보고서의 pending 표시는 생성 당시 상태로 보존한다.

| 보존 파일 | bytes | SHA-256 |
|---|---:|---|
| [원본](../../bodyguard_avatar_candidate_a47_rejected.blend) |22,972,054|`c5b7ee2b4304b403b381f39afb1c53b28e4eba925fd40396e62274ea31c72a58`|
| [남성 GLB](glb/bodyguard-male-candidate.glb) |9,469,176|`f1d056f0bfca7735e2756f507147fdf38040e63f2d814182362c66d274442dc7`|
| [여성 GLB](glb/bodyguard-female-candidate.glb) |9,322,388|`05f2fa74dd2777372053a2153f3ff9ed128df095af335c01fae75186d21a309a`|

웹/왕복 `.blend`는 `/private/tmp/bodyguard-tailor.6b7Uvu/a47-web.blend`·`a47-web-roundtrip.blend`에 보존했다. 각각 SHA`28fb79d02cc160d662744e2a05cd1028a382a95a4bb75a5a5d42b738f89f11b8`·`95cdb15def5eae2432d19b4b4d7b5518cb64b87924ac8694027bdaeee42c4576`이다. 입력 A38·전문 번들과 생성 코드 SHA도 기록했다. 기존 파일/GLB/증거·사용자 Blender 장면·기본 연결은 보존한다.

## 실제 설치 Chrome

[보고서](browser-report.json)는3개/40.103702s/skip0/flaky0/unexpected0/exit0 PASS다. [남성](male-two-models.png)·[여성](female-two-models.png)의 실제 두 모델 화면을 native34컷과 함께 총36PNG로 보존했다.

| 두 모델 | 실제 표본 | mean(ms) | p95(ms) | draw calls/triangles |
|---|---:|---:|---:|---:|
| 남 |180|16.665556|18.300000|21 /863,218|
| 여 |180|16.666111|18.300000|21 /849,858|

실제 설치 Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·Apple M4·16GiB 조건이다. 최초 sandbox sysctl은 권한 오류였고 허용된 읽기 전용 재실행으로 위 장치 조건을 확인했다. GPU 상세/전원/전체 부하는 미수집이다. 원본/GLB QC·진단 등 모든 소유 native handle 종료 후 Chrome을 실행했다. GLB byte SHA·여덟 가중치 두 복제본·독립 뼈대·한쪽 합성 변형/다른 모델 정지·정지 버튼·503/context-loss 재시도·이탈·카메라0·외부 차단 A-00을 실제 검사했다. 모델 공급만 했고 기본 연결/채택은 하지 않았다. 자체5182/비청취 프록시, API/DB/SMTP 미시작이다. NO_COLOR/Three.Clock/WebGL 경고와 의도한503 로그가 있었다. 프레임 간격은 GPU 시간·실제 웹캠15fps/피드백1초·다른 노트북/사용자 동작 정확도 증거가 아니다.

## 리뷰·미실행과 재현

`engineering:debug`로 얼굴 특징 포함과 남은 접선 경계를 구분했다. `engineering:code-review`로 입력/출력 guard·연결 영역 중복·유한한 여유·두 경계·패치/좌표/skin/손/리그 불변을 확인했다. `engineering:documentation`으로 실제/합성/미실행·생성 당시 pending·외형 반려를 분리했다. 새 제작 코드의 미해결 P1/P2는 없지만 Story의 외형 P2는 남아 병합하지 않는다. 새 의존성/단순 도형 인체/전신 remesh/임계값 완화는 없다.

프로젝트 backend 설정의 native 전체 Ruff lint·변경2파일 format,6파일 SHA/생성 코드 사본 일치·36PNG 시그니처·QA242행/각118개·Chrome3개/공급 GLB 해시·변경 Markdown5파일의 로컬116링크·diff를 실제 검사해 통과했다. 기존 전체 Markdown 구조/미변경 native 전체 format을 PASS로 표시하지 않는다. 판정/카메라/API·운영 코드와 검사 임계값은 변경하지 않았다.

이 후보의 API160/Vitest133/계정·Google/production build는 재실행하지 않았으며 이전 증거를 이번 PASS로 세지 않는다. 실제 사람/시범/리타게팅·Gmail/Google 공급자·2단계/1~6단계·전문가 승인·출시는 미완료다. 별도 승인 대상은 실행하지 않았다.

보존 원본 검수에는 donor가 필요 없다. 생성만 이미 받은 공식 번들이 필요하다. 저장소 루트와 **존재하지 않는 새 출력**을 사용한다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec -b \
  --python-exit-code 1 --python bodyguard/assets/blender/test_neck_cut.py

/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a38.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/replace_neck_from_artist.py \
  -- /private/tmp/bodyguard-new-a47.blend /private/tmp/bodyguard-new-a47.json \
  /private/tmp/bodyguard-base-meshes/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend \
  0.81 0.87 0.012
```

전체 검수는 [기존 명령](../../README.md)에 이 보존 원본/새 폴더/`--candidate --mannequin`을 쓴다. GLB 재가져오기만 `--qc-only`를 추가한다. Chrome은 backend에서 `BODYGUARD_AVATAR_QA_DIRECTORY=<이 glb 폴더 절대 경로> PLAYWRIGHT_JSON_OUTPUT_FILE=<새 보고서 경로> .venv/bin/python -m tests.run_browser avatar`다. 재실행 전에 실제 보고서/화면을 보존한다.
