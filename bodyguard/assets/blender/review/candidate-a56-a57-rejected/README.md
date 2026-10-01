# A56·A57 — 머리 대응 위치·가중치 대조 / 외형 미채택

2026-10-02 · S2.4 진행 중 · FR-A-01~04/A-07. 여성 무의상·남녀 통일 백색 중성 마네킹 결정과 1~6단계/승인 기준을 유지한다. 전문 원본·이전 후보/증거·개발 기본 A37을 덮어쓰지 않았다. **외형 P2는 미해결이며 Draft PR #9를 병합하지 않는다.**

## 실제 수정과 실패

- A56은 전문 head의 절단 단면을 기존 neck02~03 리그 기준에 강체 이동으로 맞췄다. 자연 신체 구조를 지운 것이 아니며, retained 신체/skin·손·각163bones/rest를 보존했다. 이 제작 좌표는 임상 각도나 사람 측정 결과가 아니다.
- 원본의 기존118개·121행을 실제 실행했지만 목 좌우4개가 실패했다. 남성6.212984/6.259563, 여성6.452549/6.347705로 **기존 edge>1mm/비율3미만 기준을 유지하고 exit1**을 수집했다. 나머지114개는 통과했다. [실제 실패 보고서](a56/source-preflight-report.json).
- [읽기 전용 최악 edge/가중치 진단](neck-weight-diagnostic.json)은 동일4개 실패 수치를 재현했다. 최악20개 edge 모두 새 head 내부이며, 예를 들어 남성 인접점 head 영향0.361180→0.047064와 spine01 영향0.005788→0.178321/쇄골 영향이 나타났다. 이동한 머리를 옛 몸통의 최근접 표면에 대응시켜 가중치가 급변하는 경로를 확인했다. 실제 얼굴/영상/사람 좌표는 없다.
- A57은 대응 head 위치에서 기존 native POLYINTERP_NEAREST/NAME 전송을 먼저 수행하고, 준비한 skin을 그대로 유지하며 같은 리그 정렬 이동을 적용했다. 원본 좌표 복원/clamp·단일 head bone 강제 바인딩·기준 완화·전신 remesh·코드 도형 인체 생성은 없다.
- [native A56/A57 대조](correspondence-diagnostic.json)에서 남141,912/여143,026 정점의 **전체 좌표 multiset 동일**, retained body named-skin 동일, 각163bones/rest/행렬 동일을 실제 확인했다. 바뀐 것은 head/bridge 가중치다. 좌표 보존을 최종 외형/해부학/코칭 정확도로 확대하지 않는다.
- A57 [원본 초회 검사](a57/source-preflight-report.json)는118개·121행/실패0/exit0이다. 목 비율은 남1.367434/1.291865, 여1.273260/1.274069다. [전체 원본 검사/실제34컷](a57/source/deformation-report.json)에서 같은118개를 다시 실행해 통과했고, [실제 GLB 왕복](a57/roundtrip-report.json)·[왕복 변형](a57/roundtrip-deformation-report.json)의118개도 통과했다. 같은 원본의 초회/전체 재실행을 별도 동작 coverage로 더하지 않는다.

## 실제 외형 / 미충족

두 후보 각각 실제 초회8PNG를 보존했다. A56의 [기울임](a56/first-neck-female-left.png)은 피부 주름·찢김을 보인다. A57의 [정면](a57/first-preview/first-front.png)·[남성 측면](a57/first-preview/first-side-male.png)·[여성 뒤 목](a57/first-preview/first-back-female.png)·[여성 기울임](a57/first-preview/first-neck-female-left.png)에서는 과도한 skin 찢김은 줄었지만 앞 목 돌출·머리–목의 띠 같은 경계·각진 실루엣이 남는다. **남녀 동일 마감·별도 의상 없음은 유지하나 참조 외형 품질을 충족하지 못해 둘 다 미채택이다.** 다음 작업은 가중치 보완을 유지하면서 전문 목/머리 연결 단면과 국소 조형을 수정하는 것이다.

A56의 전체34컷·GLB·왕복·Chrome은 기술 실패로 미실행이다. A57의 수행자/관찰자 동작 실측·올바른 시범/사용자 리타게팅·실제 웹캠 통합 성능도 미실행이다. 외형 수치/20° 기술 스트레스/브라우저 렌더는 해당 완료 기준을 대신하지 않는다.

## 재현·보존

[실행형 증거 감사](evidence-audit.json)는 원본 bytes/SHA·A56 실패4개·A57 원본/왕복·동일 좌표/리그·Chrome 공급 GLB SHA·실제52PNG·로컬 링크를 확인한다. [감사 코드](evidence-audit.js.txt)를 별도 `.js`로 복사해 `node <code> <저장소 루트> <기존 임시 원본 폴더>`로 재실행할 수 있다. manifest는 자기 보고서만 제외한다. 문서 표를 실행 검증으로 간주하지 않는다.

실제 Chrome 검증3개(외부 연결 차단, 두 복제 모델/독립 변형, 503·WebGL context-loss 복구)는41.4초/exit0이며 [원래 JSON](a57/browser-report.json)과 [남성](a57/male-two-models.png)/[여성](a57/female-two-models.png) 실제 화면을 보존했다. 카메라 호출0·계정 API401 fixture·auth/SQL/SMTP 없음이고 기존5173을 사용하지 않았다. 설치 Chrome154.0.8037.58/headless1440×1080/DPR1, Mac16,12/Apple M4/16GiB에서 native 프로세스가 끝난 후 실행했다. GPU 상세/전원/전체 시스템 부하는 확인하지 않았다.

남녀 각각180samples·mean16.667ms/p95 16.800ms, draw_calls21·triangles1,151,666/1,160,306·eight_weight_meshes2·static_angle_max0·moving_angle_max0.209433/0.209439·독립 뼈대를 실제 기록했다. **requestAnimationFrame 간격이지 GPU 처리시간/추론 지연/웹캠 통합 fps 합격이 아니다.** GLB SHA는 남 `6481604d264e521e5f5504095f506d5ea1d697f419163e808073e39d6de236d1`, 여 `664ab370f1a4a715c8e8e8ed163659b3b5c9b5363f7470ee1bc0eb9ab35f9be8`이며 브라우저 attachment와 연결한다. THREE.Clock deprecated 경고, 의도한503 오류, context-loss 경고도 실제 출력됐고 오류/경고가 전혀 없었다고 주장하지 않는다.

현재 변경 관련 여덟 가중치 Vitest13개와 프로젝트 설정 Ruff check/format5파일도 실제 통과했다. API/전체 frontend suite/production 계정·Google·복구/build는 이번 후보에서 재실행하지 않았으며 기존 결과를 새 결과로 표시하지 않는다. 장치 sysctl은 첫 sandbox 실행에서 거부됐고 승인된 읽기 전용 재실행으로 실제 위 조건을 확인했다.

[A56 별도 원본](../../bodyguard_avatar_candidate_a56_rejected.blend) 26,596,227 bytes SHA256 `ef46b5dfc35bda88d96389ed8335698ac76e32fc9de29e03ac570f6d11639b79`, [A57 별도 원본](../../bodyguard_avatar_candidate_a57_rejected.blend) 26,557,793 bytes SHA256 `66e94a3eca22b7df23c0197423c96042a247a98e6033e8475ed7b3c0dd7604c6`.

제작 시점의 [A56 코드](a56/producer-at-generation.py.txt)와 [A57 코드](a57/producer-at-generation.py.txt), 각각 [A56](a56/generation-report.json)/[A57](a57/generation-report.json) native 생성 보고서를 보존했다. A56은 생성 후 assertion 줄바꿈만 정리한 [formatted 코드](a56/producer-formatted.py.txt)도 별도로 보존한다. 생성 당시 format PASS였다고 주장하지 않는다. A57의 최초 Ruff 미사용 변수 오류는 생성 전에 제거했으며 이후 check/format 모두 통과했다.

재생성할 때 `.txt`를 별도 새 폴더에 `.py`로 복사하고, 같은 폴더에 보존된 [A49 density helper](../candidate-a49-rejected/producer-at-generation.py.txt)를 `a49-density-producer.py`로 복사한다. helper SHA256 `6a96114e186b0db44a622beaef770dc58a193656344586f9f189783cc14018c4`와 기존 전문 번들 SHA256 `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`가 같아야 한다. [기존 실행법](../../README.md)의 A49 원본·새 output/report/professional 경로를 사용한다. 모든 제작 출력은 새 경로만 사용한다.

[읽기 전용 최악 edge 진단 코드](neck-weight-diagnostic.py.txt)는 A56과 새 JSON 출력만 받는다. [native 대응 대조 코드](correspondence-diagnostic.py.txt)는 A57을 열고 A56 경로·새 JSON 경로를 전달한다. 원본 저장 명령은 없고 A56의 파일 hash 불변도 검사한다. [초회 미리보기](first-preview.py.txt)는8컷만 생성하며 전체34컷 검사와 구분한다.

A57 남녀 GLB는 각각12,642,104/12,737,320 bytes·5meshes·각163bones이고 ratio1/native 최대8가중치, 이미지/카메라/조명/시범 액션0이다. 여성 web 정점은1µm cleanup으로143,026→142,992이며 원본은 변경하지 않았다. exporter의 남성 parent 경고5개를 관찰했고, 경고 없었다고 기록하지 않는다. 실제 배율/계층/변형/브라우저 검증과 함께 평가한다. [별도 웹 원본](a57/web.blend)·[왕복 원본](a57/web-roundtrip.blend)·[남성 GLB](a57/bodyguard-male-candidate.glb)·[여성 GLB](a57/bodyguard-female-candidate.glb)를 보존한다.
