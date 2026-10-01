# A46b — 실제 목 경계 재검수, 외형 반려

2026-10-01 · S2.4 A-02/A-04/A-07. **원본·GLB 기술 변형과 설치 Chrome은 통과했으나, 입 모양·상부 수평 경계와 돌출이 생겨 미채택한다.** 여성도 의상 없는 백색 중성 마네킹이며 자연 곡선·관절·리깅 정확도, 기존 1~6단계와 승인 규칙은 유지한다. 개발 기본 A37·외형 P2·Draft PR #9 병합 보류도 그대로다.

## 실제 원인과 수정

[읽기 전용 진단](read-only-diagnostics.json)에서 기존 머리와 전문 원본의 앞쪽 단면이 다름을 확인했다. 높이0.87의 앞쪽 극값 차이는 남34.813mm/여38.170mm,0.90은23.852/29.521mm다. 이는 동일 정점 대응·해부학 정답·사용자 측정 정확도가 아닌 아티스트 진단이다.

첫 A46은 당시 제작 코드 `db0c0055d9391f8da9ab8cb6d7be8486b813b87a2d66ece72614328ab52e79a3`의0.81/0.90을 실제 실행했으나 남성188개 edge에 face3개가 붙어 닫힘 assertion/exit1로 저장 전에 실패했다. 진단에서 전문 절단면의 외곽188개/내부86개 경계와 기존 머리482개를 함께 bridge한 원인을 확인했다. 보고서/원본은 생성되지 않았고 그 후보의 전체 QA/GLB/렌더/Chrome은 미실행이다. 예상 assertion을 잡아 상태를 읽은 진단 exit0은 제작 PASS가 아니다.

A46b는 같은 CC0 전문 원본의 neck patch에서 **native 삼각화로 내부 포함을 확인하고 외곽과 교차하지 않는 내부 경계만 native holes_fill**한다. 연결에는 정확히 두 개의 단순 닫힌 경계만 허용한다. 내부 닫힘은 좌표를 움직이거나 정점을 삭제하지 않으며, 외부/교차/분기/다중 경계를 임의로 덮지 않는다. 원본 전문 번들 SHA는 `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`다.

A46b의 정확한 [생성 코드 사본](producer-at-generation.py.txt) SHA는 `8172ac0c955d0f6803885c40a8b8a55be11113df13dad5554a37e20837c81443`다. [현재 제작 코드](../../replace_neck_from_artist.py) SHA `00c29c03d94b0c7964aaf09d80ad48aec7806a8d758b5cff134606bed0a06dfb`는 검수 중 정상 import를 위한 main 경계·동일 길이 zip의 strict 검사·형식을 보완했다. 실제 AST 대조로 그 외 helpers/제작 본문 불변을 확인했다. 현재 코드로 A46b를 새로 생성했다고 주장하지 않는다.

[생성 보고서](neck-replacement-report.json): 영역0.81~0.90/경계 여유8mm, 남녀 패치5,332/5,222개 좌표 그대로, 내부86/100개 edge 닫힘, 후보102,116/101,114정점. 영역 밖 원래 신체 좌표/skin·보호 손·각163bones/rest와 입력 신체 준비 불변을 실제 검사했다. 새 패치의 native 이름 대응 skin 전송과 SURFACE/cuts6 연결을 유지한다. 이전 실패 이음매→후보20.035002/18.425118mm, 반대52.165639/43.574113mm는 기록만 하며 기존 이음매를 해부학 목표로 삼지 않는다. 임계값 완화·전신 remesh·단순 도형 인체·새 에셋/의존성은 없다.

## 원본·GLB 실제 검증

- [원본](source-deformation-report.json):118개 기술 변형/121행/실패0/`rendered:true`, 실제34PNG.
- [GLB 재가져오기](web-deformation-report.json):동일118개/121행/실패0/`--qc-only`/`rendered:false`. 원본 렌더로 웹 렌더 실행을 대신하지 않는다.
- 최대 edge 비율은 원본2.943930367/GLB2.947679803, 원래1mm 초과 edge의 기존3미만 기준 유지. 목 네 포즈 원본 남1.722197/1.670228·여2.039263/2.050272, GLB1.722151/1.670206·2.039280/2.050235.
- 남녀 연결 성분1/non-manifold0/정규화 오류0, 각163bones. 별도 의상0, 백색 Base Color/Metallic/Roughness/Specular/Alpha 일치. 의상 침투는 대상 없음이며 전신 변형 검사는 생략하지 않는다.
- [왕복](roundtrip-report.json):남녀 각5meshes, 이미지/액션0, fin 제거0. 영향 제한 남260782/여258016·parent/influence 경고가 있었다. neutral 기술 후보이며 올바른 운동 클립이 아니다.

| 보존 파일 | SHA-256 |
|---|---|
| [편집 원본](../../bodyguard_avatar_candidate_a46b_rejected.blend),22,362,273bytes | `1d614f170091c06068f184ba7df4239ea42cadb264a8762e9dfef95a583a12ed` |
| [남성 GLB](glb/bodyguard-male-candidate.glb),9,139,880bytes | `c1926d90f8d252014f0f008b9909948525d9e6da114608e75f6e3ac1d53e0654` |
| [여성 GLB](glb/bodyguard-female-candidate.glb),9,051,964bytes | `d513ed65f20f66b7de18b2a12a2bb05cfb1fb7d1dc26ca93d4be1a65c12a87db` |

웹/왕복 파일도 `/private/tmp/bodyguard-tailor.6b7Uvu/a46b-web.blend`·`a46b-web-roundtrip.blend`에 보존했다. SHA는 각각 `e8f14cb26bf84054bcf818c1e36b99b8cec64a158e5691cb089ef8b5bf8a89e0`·`18919d4c278c589afc154886a617112c01ae2156a2c6cef0b8ddf77396fff4d8`다. 입력 A38 SHA `9a82176b42fee0a2ff1054f8109e78b3238e660fc170ba27ee6ec6a2779e2644` 불변을 확인했다. 기존 원본/GLB/검사 증거·사용자 장면을 덮거나 지우지 않았다.

## 실제 외형 판단

[정면](faceless-front.png)·[3/4](faceless-quarter.png)·[남성 측면](faceless-body-side-male.png)·[여성 측면 확대](faceless-side-female.png)·[여성 목 기울임](faceless-neck-female-left.png)·[남성 목](faceless-neck-male-left.png)·[여성 뒤](faceless-body-back-female.png)에서 입/턱 모양, 얼굴 아래쪽 수평 돌출과 뒤쪽 단차를 확인했다. 단면을 높이면 목 seam이 없어지는 것이 아니라 **얼굴 특징이 목 패치에 들어온다**. 따라서 높이 조절만 반복하는 경로는 채택하지 않는다. 다음 외형 수정은 얼굴 특징이 포함되지 않는 전문 목 범위와 머리–목 경계의 형태/정렬을 대조해 조형하고 모든 QA를 별도 실행한다.

여성 곡선·관절과 남녀 재질/무의상 조건은 유지됐지만 최종 매끈한 백색 중성 마네킹 외형은 미통과다. 필요한 신체 구조를 지우거나 리깅 기준을 낮춰 숨기지 않는다. A-02/A-07 전체 외형 P2·미채택이며 기술 PASS를 해부학/운동 정답/전문가/출시 승인으로 확대하지 않는다.

## 실제 설치 Chrome

[보고서](browser-report.json)는3개/40.491585s PASS, skip0/flaky0/unexpected0다. [남성](male-two-models.png)·[여성](female-two-models.png)은 실제 두 모델 화면이며 native34PNG와 합쳐36PNG를 보존했다.

| 두 모델 | 표본 | mean(ms) | p95(ms) | draw calls/triangles |
|---|---:|---:|---:|---:|
| 남 |180|16.665000|18.500000|21 /833,282|
| 여 |180|16.675000|18.200000|21 /825,274|

실제 설치 Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·Apple M4·16GiB 조건이다. 모든 소유 native 제작/QA handle 종료 후 실행했으며 GPU 상세/전원/전체 부하는 미수집이다. 프레임 간격은 GPU 시간/실제 웹캠15fps·피드백1초/다른 노트북 증거가 아니다. 공급 GLB byte SHA·여덟 가중치/두 독립 뼈대·한쪽 합성 변형/정지·503/context-loss 복구·이탈·카메라0·native 외부 차단 A-00을 실제 검사했다. 후보 공급만 했고 기본 연결/채택은 하지 않았다. 자체5182/비청취 프록시만 사용하고 계정 API/DB/SMTP는 시작하지 않았다. NO_COLOR/Three.Clock/WebGL 경고와 의도된503 오류가 있었다.

## 회귀·실패·미실행

[현재 코드의 native 경계 검사](native-boundary-regression.json)/[실행형 하네스](../../test_neck_cut.py)는 단일/내부 경계 정상2개, 분리·외곽 교차·3경계·오목한 외곽 횡단·분기 거부5개, 합계7개/exit0 PASS다. 좌표/face 불변, 정상 import의 CLI 무실행도 실제 확인했다. 합성 경계 시험이지 사람/운동 검증은 아니다.

0.81/0.89 비교는 분기 실패를 예상했지만 **실제 제작은 exit0/원본 저장**이었다. 읽기 전용 full-cut의 분기 수와 반대쪽을 제거한 실제 patch의 경계가 달랐다. 예상 실패 PASS로 세지 않는다. [실제 생성 보고서](comparison-089-generation-report.json), 당시 코드 `8e51a73445051a0dfb34622a778fe7b2f949834be39a025f514138b771e0e5c9`, 임시 원본 `a46-ambiguous-cut-must-not-exist.blend` SHA `3706419711e79452f637df1722eaf37137cb889760296dc5894838f5d033bfe0`를 보존한다. 그 이름은 당시 의도일 뿐 미생성/실패를 뜻하지 않는다. 그 비교의 전체 QA/GLB/렌더/Chrome은 미실행이다.

초회 uv는 기본 cache 권한으로 실패해 잠긴 기존 .venv 도구를 직접 사용했다. 초회 글로벌 Ruff의 test exec/S102는 정상 import로 제거했다. 글로벌 전체 검사 C419는 기존 미변경 파일에 남으며 그 실행을 전체 PASS로 표시하지 않는다. 저장소 정의의 backend pyproject 설정으로 검사한 새 zip/B905는 strict 검사로 보완했다. 기존 검사 설정을 변경하지 않는다. 최종 프로젝트 설정 native 전체 lint/새2파일 format/native7개·AST 대조·변경 Markdown6파일 로컬 링크142개/누락0·36PNG 시그니처/SHA7파일·QA242행/Chrome3개/GLB 공급 해시·첫 실패 출력 없음/예상 밖0.89 출력 보존·diff를 실제 검사해 통과했다. 기존 전체 Markdown 구조/미변경 native 전체 format을 PASS로 표시하지 않는다. 이전 API160/Vitest133/계정/Google/production build는 이번 재실행으로 세지 않는다.

`engineering:debug`로 실제 경계 원인과 예측 실패를 구분했고 `engineering:code-review`로 입력/출력 guard·내부 포함/교차·두 경계·좌표/skin/손/리그·검사/채택 경계를 점검했다. `engineering:documentation`으로 생성 당시 pending·실제/합성/미실행·외형 반려를 구분했다. 새 제작 로직의 미해결 P1/P2는 없지만 Story 외형 P2는 남아 병합하지 않는다. 실제 사람 동작/시범/리타게팅·Gmail/Google 공급자·2단계/1~6단계·전문가 승인·출시는 미완료며 별도 승인 작업은 실행하지 않았다.

## 재현

보존 원본 QA에는 추가 donor가 필요 없다. 새 생성만 이미 받은 전문 번들이 필요하다. 저장소 루트/존재하지 않는 출력 경로/동일 옵션으로 실행한다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec -b \
  --python-exit-code 1 --python bodyguard/assets/blender/test_neck_cut.py

/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a46b_rejected.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/review_avatar.py \
  -- /private/tmp/bodyguard-new-a46b-review --candidate --mannequin
```

GLB 왕복은 [기존 명령](../../README.md)에 같은 보존 원본과 별도 새 경로를 사용하며 재가져오기에 `--candidate --mannequin --qc-only`를 적용한다. Chrome은 backend에서 `BODYGUARD_AVATAR_QA_DIRECTORY=<이 glb 폴더 절대 경로> PLAYWRIGHT_JSON_OUTPUT_FILE=<새 보고서 경로> .venv/bin/python -m tests.run_browser avatar`다. 재실행 전에 실제 browser-report/화면을 보존한다.
