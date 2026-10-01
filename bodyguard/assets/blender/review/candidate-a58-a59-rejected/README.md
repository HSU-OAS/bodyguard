# A58·A59 — 연결면 방향 대조·새 연결점만 정제 / 외형 미채택

2026-10-02 · S2.4 진행 중 · FR-A-01~04/A-07. 여성 참조의 의상을 대체한 CEO 결정: 남녀 모두 별도 의상/허리선/옷단 없는 통일 백색 중성 마네킹, 자연 여성 곡선·관절 유지, 유두·생식기의 사실적 세부 없음. 기존 원본·GLB·검증 증거와 개발 A37을 보존한다. **목 외형 P2가 남아 Draft PR #9를 병합하지 않는다. 1~6단계/승인 기준은 그대로다.**

## 실제 변경과 진단

- [A57 연결면 진단](a57-cut-surface-diagnostic.json)은 전체 face smooth/연결 경계 winding 정상에서도 큰 접선 차이를 확인했다. 남성 body 경계 p95 99.78°, head 70.60°, 여성 body 89.12°, head 75.18°다. face 방향 뒤집힘만으로 설명하지 않으며 이 각도는 아티스트 표면 진단이지 임상 각도/합격 임계값이 아니다.
- A58은 [보존된 A57 코드](../candidate-a56-a57-rejected/a57/producer-at-generation.py.txt)의 native 보간·보고서 두 문자열만 LINEAR→SURFACE로 바꿨다. [생성 시점 코드](a58/producer-at-generation.py.txt)·[생성 보고서](a58/generation-report.json)·[단면 진단](a58/cut-surface-diagnostic.json)을 보존한다. 각163bones/rest·retained 신체/skin·전문 head 좌표를 유지했다.
- A58 경계 p95는 남성 body/head 28.55°/35.12°, 여성40.91°/42.22°로 낮아졌지만 작은 edge의 최대 각도는164.89~178.80°이고 실제 목 주름/앞 돌출은 남는다. 부분 수치 개선을 외형 통과로 확대하지 않는다.
- [전문 head 단면 조사](authored-head-cut-diagnostic.json)는 같은 기존 CC0 head의12/24/32/48mm 절단 단면을 native 측정했다. 이는 연결 형상을 이해하는 읽기 전용 조사이며 새 운동 기준이나 사람 신체 측정이 아니다. 원본을 저장하지 않았다.
- A59는 A58의 **새 bridge 점만** native Corrective Smooth/LENGTH_WEIGHTED/only-smooth, factor0.5/8회로 정제했다. [생성 시점 코드](a59/producer-at-generation.py.txt)·[실제 생성 보고서](a59/generation-report.json)의 남성4,854/여성4,236점, 최대 변위5.006999/4.297961mm는 기존6mm guard를 실제 통과했다. 기존 신체/머리/절단점·skin·리그는 고정했고 전신 remesh·좌표 복원/clamp·가중치 단순화·검사 기준 완화는 하지 않았다.
- [독립 native A58/A59 대조](bridge-fairing-diagnostic.json)는 named-skin을 포함한 남성137,058/여성138,790점의 동일 좌표와 전체 named-skin 영향 multiset, vertex/edge/face 수·각163bones/rest/행렬 불변을 실제 확인했다. 실제 좌표 차이는 bridge 밴드만이며 raw vertex 순서만 비교하지 않는다. [A59 단면 진단](a59/cut-surface-diagnostic.json)의 경계 p95는 A58보다 다시 커졌다. smoothing만으로 경계가 해결됐다고 주장하지 않는다.

## 실제 검수와 남은 결함

A58 [원본 초회 검사](a58/source-preflight-report.json)는118개 기술 변형·121행/실패0/exit0이고 실제 초회8PNG를 생성했다. [정면](a58/first-front.png)·[남성 측면](a58/first-side-male.png)·[여성 기울임](a58/first-neck-female-left.png)의 목 경계/주름이 미달이라 미채택한다. A58 전체34컷·GLB·왕복·Chrome은 미실행이다.

A59 [전체 원본 검사/실제34컷](a59/source/deformation-report.json)과 [GLB 왕복 변형](a59/roundtrip-deformation-report.json)은 각각118개·121행/실패0/exit0이다. 원본과 왕복의 같은118개를 새 동작 coverage로 합산하지 않는다. [실제 측면](a59/source/faceless-side-male.png)·[여성 기울임](a59/source/faceless-neck-female-left.png)에서 앞 목의 돌출과 세로 주름이 남아 미채택한다. 여성 무의상/통일 마감과 자연 곡선·관절은 유지하지만 참조 전체 외형 승인은 아니다. 다음은 고정한 연결 경계 자체와 전문 원본의 턱/목 경계 대응을 조사·조형하는 것이며 단순 smoothing 반복으로 완료 처리하지 않는다.

A59 실제 Chrome3개는42.8초/exit0으로 통과했다. [원래 browser JSON](a59/browser-report.json)·[남성 화면](a59/male-two-models.png)·[여성 화면](a59/female-two-models.png)을 보존한다. native 제작이 모두 끝난 후 Mac16,12/Apple M4/16GiB, 설치 Chrome154.0.8037.58/headless1440×1080/DPR1에서 기존5182 하네스를 실행했다. 외부 연결 차단·두 독립 뼈대/합성 변형·503/WebGL context-loss 복구·카메라 요청0은 실제이고 계정 API는401 fixture/auth·SQL·SMTP 없음이다. 사용자5173은 사용하지 않았다. GPU 상세/전원/전체 시스템 부하는 확인하지 않았다.

각180samples에서 남성 mean16.665ms/p95 17.800ms·1,151,666triangles, 여성16.667ms/18.100ms·1,160,498triangles, draw_calls21/eight_weight_meshes2·static_angle_max0·moving_angle_max0.209439/0.209437을 실제 기록했다. **RAF 간격이지 GPU 처리시간/인식/웹캠 통합 fps가 아니다.** 남성 GLB SHA `f255e018b2c6ff237f2b706e4b9a084de3cc5bdd6b6b543582c6a43846b30ac7`, 여성 `76c326b2a90ff48c6de3149c432a221b4fb58f5199deb3ff7caa9fead124a7be`는 browser attachment의 실제 공급 파일과 대응한다. NO_COLOR/THREE.Clock deprecated 경고·의도한503 오류·WebGL context-loss 복구 경고가 실제 출력됐다. 경고/오류가 전혀 없었다고 주장하지 않는다.

실제 사람 수행/관찰, 올바른 시범·사용자 리타게팅·웹캠 통합 성능·다른 노트북 사용성은 미실행이다. 기술20° 스트레스나 위 RAF 간격은 해당 완료 기준을 대신하지 않는다.

## 원본·재현·보존

[A58 원본](../../bodyguard_avatar_candidate_a58_rejected.blend) 26,591,187bytes SHA256 `6a6576439d1704e9d790a8c6dc3e094798f58bb49402ac9632d030ce1de658ea`, [A59 원본](../../bodyguard_avatar_candidate_a59_rejected.blend) 26,591,171bytes SHA256 `9b5d7177fbf71e310cd8c0e89a99349be459478faa1ff33e5c4fb7be5c7bd4ef`를 보존한다. 생성 시점 코드 SHA는 A58 `276fed44e532341333a4fb662c8698631e26b4af955bcec4f6220e4b206de1c8`, A59 `01e4231fdc472e90a550b430dce6482bb592d421e11fa651f0e506351ef4a5d8`다.

재생성 시 `.txt`를 별도 새 폴더에 `.py`로 복사하고 같은 폴더에 [동일 A49 helper](../candidate-a49-rejected/producer-at-generation.py.txt)를 `a49-density-producer.py`로 복사한다. helper SHA `6a96114e186b0db44a622beaef770dc58a193656344586f9f189783cc14018c4`, 기존 전문 번들 SHA `3c121505651140ceb4d69fd1d8923f7788ffadd81672f5be14845a5f2c75c137`를 확인한다. [기존 실행법](../../README.md)의 명시된 A49 원본을 열고 제작 코드에 새 .blend·새 .json·전문 번들 경로를 전달한다. 기본32mm artist gap을 사용했다. 기존 출력은 덮지 않는다.

[읽기 전용 경계 진단 코드](cut-surface-diagnostic.py.txt)는 해당 후보를 Blender에서 열고 generation-report.json·새 출력 JSON을 받는다. [head 단면 조사 코드](authored-head-cut-diagnostic.py.txt)는 A58을 열고 A58 generation·전문 번들·새 JSON을 받는다. [독립 정제 대조 코드](bridge-fairing-diagnostic.py.txt)는 A59를 열고 A58 .blend·새 JSON을 받는다. [초회 미리보기 코드](first-preview.py.txt)는8컷이며 전체34컷 검사와 다르다. 모든 native 진단은 원본 저장 없이 수행했다.

A59 [별도 웹 원본](a59/web.blend)·[왕복 원본](a59/web-roundtrip.blend)·[남성 GLB](a59/bodyguard-male-candidate.glb)·[여성 GLB](a59/bodyguard-female-candidate.glb)·[실제 왕복 보고서](a59/roundtrip-report.json)를 보존한다. GLB는 남12,642,104/여12,739,432bytes·각5meshes/163bones·native 최대8가중치·ratio1, 이미지/카메라/조명/시범 액션0이다. 여성 web 정점은143,026→143,016으로 기존1µm cleanup을 거쳤고 source는 불변이다. 원래3mm envelope/0.1mm 왕복 기준을 유지했다. 남성 parent 경고5개를 실제 관찰했으며 경고가 전혀 없었다고 기록하지 않는다.

관련 여덟 가중치 Vitest13개와 프로젝트 설정 Ruff check/format5파일은 실제 통과했다. API/전체 frontend/production 계정·Google·복구/build는 이번 후보에서 재실행하지 않았다. 최초 metadata 조회는 report 파일명 오타로 exit1이었고 실제 deformation-report.json 경로로 바로잡아 다시 조회했다. 파일 검색의 A54 폴더명 오타와 보호 복사 orchestration의 미정의 quoting 함수도 정정해 재실행했다. 이미 보존된 측면 파일 때문에 cp -n은 nonzero를 반환했으며 전체 출력/동일 바이트는 별도 감사로 확인한다. Chrome defaults 버전 조회는 실패했으며 실제 실행 파일 --version으로 위 버전을 다시 확인했다. 이것을 native 후보 실패나 검사 PASS로 세지 않는다.

[실행형 증거 감사](evidence-audit.json)·[감사 코드](evidence-audit.js.txt)는 별도 .js로 복사해 `node <code> <저장소 루트> <기존 임시 원본 폴더>`로 재실행한다. 원본 bytes/SHA·같은118개/스타일·실제44PNG의 동일 바이트·기존 원본 불변·보간 두 문자열 변경·native 진단·Chrome 실제 공급 GLB/로컬 링크와 manifest를 확인한다. 최초 감사는 아직 생성하지 않은 자체 보고서 링크를 실제 잡아 exit1이었다. pending/false 보고서를 먼저 생성하고 재실행한 최종 감사는289 assertions·156로컬 링크·68manifest files·44PNG/exit0이다. manifest는 자기 보고서만 제외한다. 문서 표 자체는 실제 실행 증거가 아니다.
