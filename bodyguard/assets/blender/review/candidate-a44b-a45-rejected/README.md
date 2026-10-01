# A44b·A45 전문 목 패치 교체 — 외형 반려

2026-10-01 · S2.4 A-02/A-04/A-07. **두 후보 모두 실제 원본·GLB 변형 검사와 설치 Chrome을 통과했지만 목 위쪽의 옷깃 같은 경계가 남아 미채택한다.** 여성 무의상·남녀 동일 백색 중성 마네킹 결정, 자연 곡선·관절/리깅 정확도, 전체 1~6단계·승인 규칙은 유지한다. 개발 기본 A37·외형 P2·Draft PR #9 병합 보류는 그대로다.

## 제작 방식과 보존 기준

기존 실패한 연결망에 표면 투영을 반복하는 대신, [이미 사용 중인 CC0 전문 원본](../../README.md)의 연속 목 일부를 Blender native Multires1/Bisect/skin 전송/Bridge로 교체했다. 단순 도형 인체 생성·전신 remesh·새 의존성/에셋/외부 계약은 없다. 전문 번들 SHA는 `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`다.

A45를 생성한 코드 SHA는 `880339aa30caca6acb9f16ceb005cea8879d92b7350eac99f7ab09618697e959`다. A44b 당시 코드는 `0c194a2612cc5ca1bb17e126c7f08a63619a3ca5529b7b2e49cde5645d4f57b6`이며 동일 코드라고 주장하지 않는다. 각 정확한 실행 코드 사본은 제작 임시 폴더의 `a44b-producer.py`/`a45-producer.py`에 보존했다. [현재 제작 코드](../../replace_neck_from_artist.py) SHA는 `db0c0055d9391f8da9ab8cb6d7be8486b813b87a2d66ece72614328ab52e79a3`이며 검수 후 출력 확장자/경로 충돌 guard만 보완했다. 실제 바이트 비교로 그 외 제작 부분이 같은지 확인하며 정상/실패 사전 검사도 실행했다. 이 후속 guard 검사를 새 원본 생성/전체 QA로 세지 않는다.

남녀별 높이0.81~0.87 밴드를 편집하고 전문 패치는 절단 경계에서8mm 안쪽까지 둔다. A44b는 직선 native bridge, A45는 기존 곡면 연결 기능 `SURFACE/cuts6/smoothness1`을 사용했다. 전문 패치의 모든 좌표, 영역 밖 기존 좌표·skin, 보호 손, 각163bones/rest를 실제 assertion으로 보존했다. 이름 대응 가중치를 새 패치에만 전송하고 전송/정규화 준비 중 입력 신체 불변도 확인했다.

| 실제 제작 값 | A44b 남/여 | A45 남/여 |
|---|---:|---:|
| 원본 정점 |142,087 /139,882|142,087 /139,882|
| 후보 정점 |100,566 /99,158|106,338 /104,558|
| 정확히 보존한 전문 패치 정점 |2,097 /2,056|2,097 /2,056|
| 이전 실패 이음매→새 후보(mm) |10.196497 /11.154131|10.196497 /11.112547|
| 새 후보→이전 실패 이음매(mm) |20.993110 /14.434977|22.013776 /14.634626|

[A44b 제작 보고서](a44b/neck-replacement-report.json)·[A45 제작 보고서](a45/neck-replacement-report.json). 위 편차는 **아티스트 표면 교체 진단**이지 사용자 정확도/임상 수치가 아니다. 이전 실패 이음매를 해부학 정답으로 삼지 않는다. 기존 retopology 코드의6mm guard를 낮추지 않았으며 이 다른 교체 경로에서는 공급된 전문 패치 좌표의 정확한 보존을 요구한다. 원본/GLB/웹/외형·운동 판정의 완료 기준을 낮추지 않는다. 보고서 pending은 생성 당시 상태를 보존한 것이다.

## 실제 원본·GLB·변형 검사

- 원본 [A44b](a44b/source-deformation-report.json)·[A45](a45/source-deformation-report.json): 각각118개 기술 변형/121행/실패0/`rendered:true`, 실제 native34PNG씩.
- 재가져온 GLB [A44b](a44b/web-deformation-report.json)·[A45](a45/web-deformation-report.json): 각각118개/121행/실패0/`--qc-only`/`rendered:false`.
- 최대 edge 비율은 각 원본2.943930367/각 GLB2.947679803. 목4포즈에도 원래 길이1mm 초과 edge의 기존3미만 기준을 적용했다. 원본 목 비율은 남성 좌/우1.200164/1.205998, 여성1.288001/1.180155이며 GLB는1.200155/1.205923·1.288048/1.180257다.
- 남녀 각각 연결성분1/non-manifold0/정규화오류0, 각163bones, 별도 의상0/같은 재질. 의상 침투는 대상 없음이며 신체 변형 검사를 생략하지 않았다.
- 왕복 [A44b](a44b/roundtrip-report.json)·[A45](a45/roundtrip-report.json): 각5meshes/163bones, 이미지/액션0, fin 제거0/0, 배율·위치 검사 PASS. parent/influence 경고가 있었다. 영향 제한 native 출력은 남258406/여255825였다. 경고0·운동 액션 완성으로 표현하지 않는다.

| 보존된 실제 파일 | SHA-256 |
|---|---|
| [A44b 편집 원본](../../bodyguard_avatar_candidate_a44b_rejected.blend) | `82b2c6593284d257bb0d65a8fd52df4263500084eaf1b7feb519b1b96f451011` |
| [A45 편집 원본](../../bodyguard_avatar_candidate_a45_rejected.blend) | `d2554a2a9ccab4239076dee5566817ab57faac4701c75519f4f0eb161bb13679` |
| [A44b 남성 GLB](a44b/glb/bodyguard-male-candidate.glb),9,003,656bytes | `a11555a598ed0a804bddd6f88f3d60ce6a25ba2941be377590d1edbae083f4ea` |
| [A44b 여성 GLB](a44b/glb/bodyguard-female-candidate.glb),8,879,920bytes | `dbf631890e09bb06232857cc70b70260500aab4251cd75a49879ae4598f8bc74` |
| [A45 남성 GLB](a45/glb/bodyguard-male-candidate.glb),9,511,592bytes | `9cedb431140245a50c1b3f2ca4203b9de5ec8efbcc8e82408e5eac24b136e5fc` |
| [A45 여성 GLB](a45/glb/bodyguard-female-candidate.glb),9,355,124bytes | `a9fde6b7fbe3e2c4a96117706e6a486669e81c319c5f5dddffe0c45d10cfc495` |

웹 편집/왕복 파일도 `/private/tmp/bodyguard-tailor.6b7Uvu/`에 보존했다. A44b 웹 SHA는 `0d293bcb3ede99a4ec81ed0584304e40956572135c86e10f66d72591389e90fc`, 왕복 `5b81ce014e40fdca0b79177b4609c6bd7a9bf1e966624a93bf44e05dbf378913`다. A45 웹 SHA는 `7511280220a1ceec490719aab4d3defb82b05192aba3a626522e0a0888186582`, 왕복 `6569148cae1e6bde0d20f43387db0f40f74f54f21d0c57edcc90921faaa210f5`다. 기존 A27~A40b 원본/GLB/증거·사용자 장면은 덮거나 삭제하지 않았다.

## 실제 외형 판단

[A44b 여성 목 좌](a44b/faceless-neck-female-left.png)·[A45 여성 목 좌](a45/faceless-neck-female-left.png)는 [이전 A40b](../candidate-a40b-rejected/faceless-neck-female-left.png)의 찢어진 듯한 목 연결을 줄였다. 하지만 [A45 남성 목 좌](a45/faceless-neck-male-left.png), [여성 측면](a45/faceless-side-female.png), [남성 뒤](a45/faceless-body-back-male.png)에 **상부 수평 경계·돌출과 하부 잔여 표면 결함**이 있다. 곡면 bridge만으로 외형 P2가 해결되지 않았다. 참조 대비 머리 비례·전체 실루엣·재질/전완 정제도 남아 있다.

실제 렌더/Chrome에는 의상·옷단·허리선이 없고 남녀 백색 재질은 같지만, 목의 옷깃 같은 경계까지 제거된 완성품은 아니다. 여성 곡선·필요 신체 구조/기존 리그 정확도를 지워 결함을 숨기지 않는다. **A-02/A-07 전체 외형 미통과·두 후보 미채택**이며 자동 기술 PASS로 해부학·의학 시범·출시를 승인하지 않는다. 다음 작업은 기존 머리와 전문 목의 경계 위치/형태 대조 및 연결 수정이며 별도 후보에서 실제 검수한다.

## 실제 설치 Chrome

[A44b 보고서](a44b/browser-report.json)는3개/39.422044s, [A45](a45/browser-report.json)는3개/41.168353s PASS, 각각 skip0/flaky0/unexpected0이다. 네 실제 화면 [A44b 남](a44b/male-two-models.png)·[여](a44b/female-two-models.png)·[A45 남](a45/male-two-models.png)·[여](a45/female-two-models.png)를 native34PNG씩과 합쳐 **72PNG** 보존했다. 후보 공급 검사이며 기본 모델 연결 후 검사/실제 웹캠 코칭은 아니다.

| 후보/두 모델 | 표본 | mean(ms) | p95(ms) | draw calls/triangles |
|---|---:|---:|---:|---:|
| A44b 남 |180|16.665556|17.800000|21 /820,898|
| A44b 여 |180|16.666111|18.100000|21 /809,634|
| A45 남 |180|16.665000|17.900000|21 /867,074|
| A45 여 |180|16.667222|16.800000|21 /852,834|

Chrome154.0.8037.58/headless1440×1080DPR1/Mac16,12·Apple M4·16GB를 실제 확인했다. 모든 native 제작·검사 종료 후 순차 측정했다. renderer는WebKit WebGL이며 GPU 상세/전원/전체 부하 미수집이다. 프레임 간격은 GPU시간·웹캠15fps·피드백1초·다른 노트북의 증거가 아니다.

여덟 가중치 GLB byte 해시/독립 두 뼈대/한쪽 합성 변형과 정지, 제어된503/context-loss 복구, 이탈·카메라 요청0, native 외부 차단 A-00을 실제 검사했다. wrapper 소유5182/비청취 프록시만 썼고 계정 API/DB/SMTP/카메라는 시작하지 않았다. NO_COLOR/Three.Clock/WebGL 경고·의도된503 오류가 있었다. 실패 주입 로그를 서비스의 실사용 실패0으로 바꾸어 설명하지 않는다.

## 실패·미실행·검토

- A43 전문 표면 투영: native bridge 남성 접힘338→321·편차7.826/8.713mm, 기존6mm guard/exit1 실패. 원본·보고서 생성 전 중단, GLB/전체 QA/렌더/Chrome 미실행. 실행 코드 SHA `ca6389f3143ad15ee9c63275285b00af8e975c7b2783d1e64e60b6d77f1e4c02`·정확한 코드 사본은 임시 폴더 `a43-rejected-producer.py`로 보존했다. 해당 선택 경로는 기존 제작 코드에 남기지 않았다.
- 첫 A44는 생성·보존 assertion만 실행했다. 원본 SHA `4e99de7149439b323c9e87d6307f1060e7cc63f984efdfcc2f0dab1fc2287373`·코드 `f6c6df3cdcab7ef2b9f75114d446681a4061c19ed5e41588dd2e3901319bc232`, 임시 `draft-a44-professional-neck.blend`/`a44-neck-report.json`을 보존한다. 그 원본의 전체 QA/GLB/Chrome은 미실행이며 A44b 결과로 대체하지 않는다.
- A45 GLB 초회 호출은 잘못된 인자5개로 exit1, 출력 전 실패했다. 실제 계약의 인자2개로 재실행한 결과만 위에 기록했다. 실패를 PASS로 세지 않는다.
- 현재 제작 코드의 실제 실패 대조: 기존 A44b 원본을 출력 대상으로 주면 FileExistsError/exit1, `nan/0.87` 범위는 ValueError/exit1. 원본 해시 유지·음성 대조 출력 미생성을 확인하며 예상 실패를118개 합격에 더하지 않는다.
- 후속 경로 guard: `.blend` 확장자 누락/같은 `.blend` 출력·보고서 경로를 실제 ValueError/exit1로 거부했다. 정상 `.blend`/`.json` 경로의 실제 native 사전 검사는 exit0이며 전문 파일 열기/제작/저장/전체 QA는 실행하지 않았다. 명시한 확장자와 서로 다른 resolved 경로를 요구해 native 자동 확장/보고서 덮어쓰기를 막는다.
- 기기 확인의 sandbox 초회 sysctl/ps는 권한 때문에 읽지 못했다. sysctl의 기기 모델/메모리/CPU3항목만 허용된 native 읽기로 재확인했고 일련번호는 수집하지 않았다. ps는 재실행하지 않았으며 제작 종료는 소유한 process handle의 실제 exit0으로 확인했다. 진행 중 QA JSON에 대한 초회 조회는 완료 전이라 파일이 없었고 완료된 실제 보고서를 다시 읽었다.
- `engineering:code-review`로 native 입력 guard·선택 범위·좌표/skin/손/리그 보존·실패 전 출력·가중치/전체 QA 경계를 점검했다. `engineering:documentation`에 따라 생성 당시 pending·실제 PASS·외형 반려·예상 실패·미실행을 구분한다. 제작 코드의 미해결 P1/P2는 없지만 **Story 외형 P2는 미해결**이다.

실제 사람 동작/시범/리타게팅·Gmail/Google 공급자·2단계/1~6단계·전문가 승인·출시는 미완료다. 이전 API160/Vitest133/계정/Google/production build는 이번 재실행으로 세지 않는다. 별도 승인 작업은 실행하지 않았다.

## 재현

현재 코드로 생성하는 것은 A45 경로다. A44b와 혼동하지 않는다. 저장소 루트에서 존재하지 않는 경로를 사용하며 생성에는 이미 받은 전문 번들이 필요하다. 보존된 원본 편집/QA에는 추가 donor가 필요 없다.

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a38.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/replace_neck_from_artist.py \
  -- /private/tmp/bodyguard-new-artist-neck.blend /private/tmp/bodyguard-new-artist-neck.json \
  /private/tmp/bodyguard-base-meshes/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend

/Applications/Blender.app/Contents/MacOS/Blender \
  --factory-startup --disable-autoexec \
  -b bodyguard/assets/blender/bodyguard_avatar_candidate_a45_rejected.blend \
  --python-exit-code 1 --python bodyguard/assets/blender/review_avatar.py \
  -- /private/tmp/bodyguard-new-a45-review --candidate --mannequin
```

GLB 왕복 실행은 [기존 명령](../../README.md)을 따른다. 위 원본과 별도 새 출력 경로로 내보내고 재가져온 모델에 `--candidate --mannequin --qc-only` 검사를 적용한다. 실제 후보 공급 Chrome은 backend에서 `BODYGUARD_AVATAR_QA_DIRECTORY=<이 폴더 a45/glb 절대 경로> PLAYWRIGHT_JSON_OUTPUT_FILE=<존재하지 않는 보고서 절대 경로> uv run python -m tests.run_browser avatar`로 실행한다. 새 Chrome 실행이 test-results/avatar를 정리하므로 먼저 이전 실제 화면·보고서를 보존한다.

커밋 전 native 전체 Ruff lint·새 제작 코드 format·변경 Markdown5파일의 로컬 링크113개(누락0)/새 README 제목 간격·72PNG 시그니처·원본/코드/이전 원본 SHA5파일·실제 QA484행/Chrome6개 보고서·GLB와 브라우저 공급 해시·음성 대조 출력 미생성·`git diff --check`를 실제 검사해 통과했다. 기존 전체 Markdown 구조/이전 native3파일 전체 format은 이번 PASS로 표시하지 않는다.
