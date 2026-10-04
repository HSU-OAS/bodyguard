# A37 — 남녀 공통 무의상 백색 중성 마네킹

2026-10-01 CEO 외형 변경을 A36 실행 종료 뒤 반영했다. 이전 여성 참조의 탱크톱·쇼츠 요구만 대체했다. **최종 외형/실제 코칭/단계2 통과나 출시 승인이 아니다.**

## 제작과 보존

기존 전문 CC0 A36 신체에서 별도 의상 메시만 제거하고 남성 신체와 같은 백색 재질을 여성에게 연결했다. 전신 smoothing/새 인체 생성/리깅 변경은 하지 않았다. `unify_mannequin_surface.py` SHA-256 `aab4d5ef13ce57148c18447955e98350f6bcc00b2c24d83cea92195843c1fa70`의 assertion이 남녀 **모든 신체 정점 좌표·가중치·bone 이름/기준 행렬 불변**을 실제 확인했다. 원본 남142,087/여139,882정점·각163bones, 자연스러운 체형/관절을 그대로 유지했다.

[수정 가능한 새 원본](../../bodyguard_avatar_candidate_a37.blend)은 실제 생성 파일의 동일 바이트 사본이다. 새 웹 파일은 frontend의 `bodyguard-{male,female}-candidate-a37.glb`에 따로 추가하고 개발 검수 화면에만 연결했다. 기존 A27 원본/GLB는 덮지 않았으며 기존 해시와 일치한다. A36 파일/실패·의상 검사 기록도 보존한다. production에 모델/검수 경로를 추가하지 않는다.

| 실제 파일 | SHA-256 |
|---|---|
| 원본 `bodyguard_avatar_candidate_a37.blend` | `9c3442444f3339c76fcbc6ca232965cf2d9e5173dc3b26b6a3c2b8f8f5a5810f` |
| `a37-web.blend` | `ca72f64f334a7e72ecb7c2d4b2debb64a25ef549d520519cb73c2d96f91bf7fe` |
| `a37-web-roundtrip.blend` | `826e8a6a4e78f0f94f1088444002d8e027e97a3b78c5ed8190bffe13618bdcc3` |
| 남성 GLB12,656,976bytes | `cc85bcd449f3f31347e4f7174986d41e4aca3067990f5d8a2e6ba3a099171927` |
| 여성 GLB12,462,848bytes | `27c10902aa377e995bdbc115ab773cf22f8ea38582c49820304a33ad7685f25a` |

## 원본·GLB 실제 변형 검수

`review_avatar.py` SHA-256 `d36e378f2c70949e740e18a6e5a5ee925da6b6c3c2b006580e65d62e26ad285b`. [원본](source-deformation-report.json)과 [재가져오기](web-deformation-report.json)는 각각 **118개 관절 기술 변형·121행 실제 PASS**, 최대edge2.943930367/2.947679803·failures0·신체 연결성분1/non-manifold0/정규화오류0이다. 웹 원본은142,081/139,873정점·각163bones다. 여덟 가중치·edge3미만 등 기존 기준을 유지했다. 의상이 없어 의상 침투/닫힘 검사는 적용 대상 없음이다. 이를242행 실행으로 표시하지 않는다.

새 `--mannequin` 검사는 무의상·한 중성 material·남녀 실제 Base Color/Metallic/Roughness/Specular/Alpha 일치를 확인한다. Base Color(0.79,0.78,0.76,1)·Metallic0·Roughness0.62·Specular0.25·Alpha1, 실제 피부 texture/procedural 입력0이다. 원본/왕복 모두 같다. [내보내기](roundtrip-report.json)는각5meshes·이미지/애니메이션0이며 exporter parent/influence 경고가 있었다. `geometry_deformation_pending`은 내보내기 시점만 의미하고 이후 실제 변형 PASS와 구분한다.

같은 `--candidate --mannequin --qc-only`로 A36을 음성 대조했을 때 **exit1 / `Separate garment remained: ['BODYGUARD Female tank draft', 'BODYGUARD Female shorts draft']`**로 실제 거부했다. 검수 진입에서 중단되어 음성 대조의118개/전체JSON은 미실행이다. 이 예상 실패를 새 후보의 합격 수에 더하지 않는다.

원본 전체 검수는 실제 렌더34컷을 생성했다. 별도 [정면](front.png)·[3/4](quarter.png)·여성 [몸통 확대](female-torso.png)·남성 [몸통 확대](male-torso.png)4컷도 보존한다. 실제 정면/측면/뒤/몸통/목/손/무릎과 웹 두 화면을 대조해 의상 경계·허리선·옷단 및 사실적 유두/생식기 묘사가 없는 중성 표면을 확인했다. [여성 측면](faceless-body-side-female.png)/[뒤](faceless-body-back-female.png)/[목](faceless-neck-female-left.png)/[무릎](faceless-knee-female.png)·[남성 손목](faceless-hand-male.png)은 실제 검사 컷이다. 일부 손목/뒤 목의 연결·참조 재질/실루엣 정제가 남아 **전체 A-02 외형 P2는 미해결**이다. 기술 포즈는 올바른 운동 시범이 아니다.

## 실제 Chrome: 후보 공급과 개발 화면 연결을 구분

backend의 `tests.run_browser avatar`는 자체localhost5182/소유한 비청취 프록시를 사용하며 계정 API/DB/SMTP를 시작하지 않는다. A-00은 외부example.invalid 요청의 ERR_PROXY_CONNECTION_FAILED를 실제 확인했다. `BODYGUARD_AVATAR_QA_DIRECTORY`로 native 후보를 공급한 [첫 A37 시험](browser-native-candidate-report.json)3개/42.839s와, 별도 파일을 개발 화면 기본 경로에 연결한 [재실행](browser-connected-report.json)3개/43.371s는각skip0/flaky0 실제 PASS다. 원본 GLB 해시/추가 세트 수를 attachment로 남겼다.

| 연결된 두 모델 실제 기술 변형 | 표본 | mean(ms) | p95(ms) | draw calls /triangles | 추가 세트 메시 |
|---|---:|---:|---:|---:|---:|
| 남성 |180|16.665556|16.900000|21 /1,153,018|2|
| 여성 |180|16.665000|16.900000|21 /1,135,354|2|

[남성](male-two-models.png)/[여성](female-two-models.png)은 연결 후 실제 화면이다. 설치Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·AppleM4·16GiB, native 제작 종료 후 조건이다. renderer는WebKit WebGL이며 GPU 상세/전원/전체 부하는 미수집이다. 간격은 GPU 시간/실제 웹캠 지연이 아니고 여러 노트북의 성능 보장도 아니다. 한쪽 합성 변형·정지/독립 뼈대·GLB503·native context-loss 복구·이탈·카메라0회를 확인했다. 오류주입/guest401은 제어된 상태, NO_COLOR/Three.Clock/WebGL 경고가 있었다.

최종 연결 후 Vitest133/14파일2.34s·Biome56파일·TypeScript/production build96modules·Ruff(native 포함)·diff 검사를 실행했다. 기존 제작 스크립트3개의 Ruff 정리는 동일 import 집합/그 밖 AST 불변도 검사했다. 공통 실행기 Google 회귀의 초회는 병행한 두 build가 같은dist를 정리해 **브라우저 시작 전 실패**했다. 해당 실행은 완료로 세지 않았다. 다른 build 종료 후 단독 재실행은 **10개/19.4s 실제 통과**했다. API/격리SQL/Chrome/RSA는 실제, Google/메일·일부clock은 모의다. 실제 공급자 연결 성공이 아니다. 같은worktree의 build와 production 브라우저 하네스를 동시에 실행하지 않는다.

실제 사람/운동 시범/리타게팅·추론15fps/피드백1초·최종 아바타/2단계·출시는 미완료다. Draft PR #9 병합 보류, 기존1~6단계와 승인 규칙을 유지한다.

마지막 diff 검토에서는 native 전체 Ruff lint는 통과했지만 전체 native format 검사에 기존 미변경3파일(`diagnose_web_skin.py`/`export_avatar_candidate.py`/`polish_avatar_candidate.py`)과 변경한 제작 파일의 형식 차이가 나왔다. 변경 제작 파일만 AST 동일성을 확인하며 정리한 뒤 변경 native6파일+공통 실행기 총7파일의 format 검사를 실제 통과했다. 무관한3파일은 이 PR에서 재형식화하지 않았고 전체 native format 통과라고 표시하지 않는다. production dist의 GLB/Blender 파일0개, 기존 A27 원본/GLB3개의 해시 불변도 재확인했다.
