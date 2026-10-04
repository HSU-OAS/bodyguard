# A38 — 손목·뒤 목 국소 연결부 정제와 실제 비교

2026-10-01 S2.4 A-02 보완. CEO의 남녀 공통 무의상 백색 중성 마네킹 결정은 유지한다. **국소 기술 수치는 개선됐지만 목표 외형에는 미달이다. 기본 개발 모델은 A37 그대로이며 A38은 별도 검수 후보다. Draft PR #9 병합·S2.4/2단계·출시 통과가 아니다.**

## 제작·보존

기존 CC0 전문 A37 신체의 손목·목 영역에 Blender 5.1.1 native Corrective Smooth(`LENGTH_WEIGHTED`, only-smooth, factor0.6, 32회)를 적용했다. 전신 재생성·전신 smoothing·새 의존성/외부 에셋·셰이더로 결함 가리기는 하지 않았다. [편집 가능한 새 원본](../../bodyguard_avatar_candidate_a38.blend)은 실제 생성 파일의 동일 바이트 사본이다. 기존 A27~A37 파일과 증거, 실행 중인 사용자 Blender 장면은 바꾸지 않았다.

`refine_mannequin_joins.py` SHA-256 `9d38370bc7702d2a537a718996c0b01d1f79ed4b060637a8aabd8c11b63219c4`가 원본 남142,087/여139,882정점·각163bones·모든 skin 가중치/기준 뼈 행렬, 보호 손 정점과 편집 영역 밖 좌표 불변을 실제 검사했다. 최대 아티스트 좌표 변경은 남3.620870mm/여4.131688mm였다. 6mm 제한은 이 편집의 보수적 변경 예산이지 사용자 신체 측정 정확도가 아니다. 독립 paired 검사로 모든 edge/face 연결 순서도 동일함을 확인했다. 자연 곡선·관절·손 구조를 삭제해 매끈하게 만들지 않았다.

| 실제 파일 | SHA-256 |
|---|---|
| `bodyguard_avatar_candidate_a38.blend` | `9a82176b42fee0a2ff1054f8109e78b3238e660fc170ba27ee6ec6a2779e2644` |
| `a38-web.blend` | `0c5ce6c095992db8fd8abc4b592b3bbe8c1809a0e816bd17a25cff7435148190` |
| `a38-web-roundtrip.blend` | `50373a0bd3a0526ae5fd392910b274aca5945407226a32e0352a5c6ee97dd8b6` |
| [남성 GLB](glb/bodyguard-male-candidate.glb), 12,656,976bytes | `edbdd3dcf461d235472d36587243224616e203b8bc990f11bb5fdb184e662ec0` |
| [여성 GLB](glb/bodyguard-female-candidate.glb), 12,462,848bytes | `c6a4ba3b839e605076aa1b559edd049ee0a30de5993e2253a4a420fd61cc9c17` |

웹용 `.blend` 두 파일은 제작 임시 작업 폴더에 보존했고 원본/GLB/JSON/실제 PNG를 이 저장소에 추가했다. 새 GLB를 frontend 기본 경로에 연결하지 않았고 production에 노출하지 않았다.

## 원본 표면을 공정하게 비교

A37 native 표면은 flat face0/custom normals없음/Armature외 modifier없음이었다. 법선 캐시를 지우거나 조명만 바꾸는 문제가 아니라 실제 연결부 표면을 다뤘다. 아래는 **아티스트 rest mesh 진단**이며 의학 각도·사용자 성공 판정·외형 승인 기준이 아니다.

`diagnose_mannequin_joins.py` SHA-256 `e9eec1dc5ab54b9e4c282a0149cb83b27be76f0786d8d3be038a47bf0a1ceaf5`는 A37의 선택 edge ID와 당시 길이1mm초과 분류를 둘 다 고정하고 같은 edge의 face angle90°초과 수를 다시 센다. 원본/후보 전체 edge/face 연결이 다르면 실패한다. [실제 독립 비교 6행](paired-original-edges-report.json):

| 원본 동일 edge 집합 | A37 | A38 |
|---|---:|---:|
| 남성 목 |114|79|
| 남성 왼손목 |30|0|
| 남성 오른손목 |34|0|
| 여성 목 |116|65|
| 여성 왼손목 |16|0|
| 여성 오른손목 |13|0|

[제작 시 진단](join-fairing-report.json)은 후보 좌표에서 선택/길이를 재계산해 목95/77로 나왔다. [초기 edge ID만 고정한 비교](edge-membership-only-report.json)도 후보 길이 분류를 사용했다. 이를 위의 원본 길이까지 고정한79/65와 섞지 않는다. 제작 보고서의 `full_deformation_visual_browser_qa_pending`은 제작 직후 상태이며 이후 검증을 소급해 다시 쓰지 않았다.

남녀 정면·뒤 목·손목 각각 A38과 A37을 **동일 camera/1000×1000/32samples**로 실제 렌더했다. [여성 정면](female-front.png)·[남성 정면](male-front.png), [여성 뒤 목](female-neck-back.png) 대 [A37](baseline-a37-female-neck-back.png), [남성 손목](male-wrist.png) 대 [A37](baseline-a37-male-wrist.png)을 비교했다. 손목의 날카로운 접힘은 줄었지만 차이가 제한적이고 뒤 목 연결·인접 전완의 줄무늬·참조 대비 재질/실루엣 정제가 남는다. **손목 진단0을 전체 외형 통과로 확대하지 않는다. A-02 P2는 미해결이다.**

## 실제 원본·GLB 변형·브라우저 검증

[원본 전체](source-deformation-report.json)와 [GLB 재가져오기](web-deformation-report.json)는 각각118개 기술 변형·121행/실패0으로 실제 PASS했다. 최대 edge 비율2.943930367/2.947679803, 연결성분1/non-manifold0/가중치 정규화오류0이다. 여덟 가중치·기존 edge3미만 조건을 유지했다. 무의상·남녀 동일 중성 재질 검사도 실행했다. 의상 침투는 적용 대상 없음이다.

원본 전체 검수는 실제 PNG34컷(`rendered:true`), 왕복 검수는 `--qc-only`라 추가 native 렌더 미실행(`rendered:false`)이다. [내보내기 보고서](roundtrip-report.json)의 변형 pending은 내보내기 당시 상태다. 각5meshes/163bones·이미지/애니메이션0이며 기존 미세 fin 정리 남6/여9와 exporter parent/influence 경고가 있었다. 경고0이라고 기록하지 않는다. 이 폴더는 A38 native40컷(전체34+별도6), 동일 조건 A37비교6컷, 실제 A38 Chrome2컷 **총48PNG**를 보존한다.

backend `tests.run_browser avatar`의 `BODYGUARD_AVATAR_QA_DIRECTORY`로 위 GLB를 공급했다. [실제 설치 Chrome 결과](browser-report.json) **3개/41.715s PASS, skip0/flaky0**이다. A-00 외부 차단/GLB byte 해시/여덟 가중치, 두 독립 뼈대와 한쪽만의 합성 기술 변형·정지·503/context-loss 복구·이탈·카메라 요청0회를 확인했다. [남성](male-two-models.png)/[여성](female-two-models.png)은 그 실제 화면이다. **후보 공급 시험이지 A38 기본 경로 연결 후 시험은 아니다.**

| 두 모델 기술 렌더 | 표본 | mean(ms) | p95(ms) | draw calls /triangles |
|---|---:|---:|---:|---:|
| 남성 |180|16.666667|16.800000|21 /1,153,018|
| 여성 |180|16.667778|16.800000|21 /1,135,354|

Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·AppleM4·16GB, native 작업 종료 후 조건이다. renderer는WebKit WebGL, GPU 상세/전원/전체 부하는 미수집이다. render 간격은 GPU 시간/웹캠 추론15fps/피드백1초나 다른 노트북의 성능 보장이 아니다. native 렌더 일부는 동시 실행했으므로 해당 소요 시간을 성능 벤치마크로 쓰지 않는다. 503/context-loss/guest401은 제어된 시험, NO_COLOR/Three.Clock/WebGL 경고가 있었다. 계정 API/DB/SMTP·실제 사람 카메라를 시작하지 않았다.

## 실패·재현·미실행

초회 native 실행은 modifier 적용이 무효화한 캐시 DeformGroup RNA를 제거하다 exit1로 중단했다. 원본 저장/렌더 전에 실패했으므로 그 시도의 원본/GLB/118개/웹 검수는 미실행이다. 그룹 이름을 저장하고 적용 뒤 다시 조회하는 기존 제작 패턴으로 수정한 후 위 전체 검증을 실행했다. 이미 존재하는 A38 출력 경로로 다시 실행한 음성 대조는 `FileExistsError: Preserve the prior artist source`/exit1로 거부했고 원본 해시가 변하지 않았다. 예상 실패를 전체 합격 수에 더하지 않는다.

저장소 루트에서 설치된 Blender를 사용하며 **출력은 존재하지 않는 새 경로**여야 한다. 사용자 장면·기존 원본·증거를 덮지 않는다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a37.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/refine_mannequin_joins.py \
  -- /private/tmp/bodyguard-new-a38.blend /private/tmp/bodyguard-new-a38-preview

/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a37.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/diagnose_mannequin_joins.py \
  -- bodyguard/assets/blender/bodyguard_avatar_candidate_a38.blend \
  /private/tmp/bodyguard-new-a38-paired.json
```

전체 검수/내보내기는 [기존 실행법](../../README.md)의 원본/출력을 A38의 별도 파일/폴더로 지정하고 원본 및 왕복에 `--candidate --mannequin`을 적용한다. `--qc-only`는 렌더만 생략한다. 브라우저 실행은 backend에서 `BODYGUARD_AVATAR_QA_DIRECTORY=../assets/blender/review/candidate-a38/glb .venv/bin/python -m tests.run_browser avatar`로 재현한다. 같은 worktree의 production build와 production browser wrapper를 동시에 실행하지 않는다.

A38은 native 코드/새 에셋/증거만 변경했다. API160·Vitest133·계정/Google 회귀·production build의 이전 A37/main 실행을 A38에서 재실행한 것처럼 표시하지 않는다. 실제 사람/올바른 운동 시범·리타게팅·최종 외형·단계2·실제 공급자·1~6단계/출시는 여전히 미완료다. 별도 승인 작업을 실행하지 않았고 기존 완료/승인 기준을 유지한다.

커밋 전 native 전체 Ruff lint·새 native2파일 format, 변경 Markdown5파일/로컬 링크86개·`git diff --check`를 실제 통과했다. `engineering:code-review`로 새 제작/진단 코드의 덮어쓰기 거부·지연 바인딩·modifier 적용 뒤 RNA 재조회·보호 영역/가중치·동일 edge 비교·실제/모의/미실행 경계를 검토했다. 새 코드의 미해결 P1/P2는 없지만 **Story의 A-02 외형 P2는 여전히 미해결**이므로 Draft 상태와 병합 보류를 유지한다. 전체 native format은 이전 미변경3파일 문제를 해결하지 않았고 통과로 표시하지 않는다.
