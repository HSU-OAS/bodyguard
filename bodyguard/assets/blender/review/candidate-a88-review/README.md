# A88 — 최신 얼굴·목 참조와 실제 연결 비교

2026-10-02 · S2.4/PR #9 리뷰 보완 · **외형 반려/미채택.** CEO의 새 남녀 전신 사진을 얼굴·목 형태와 얼굴–목–어깨의 연속 연결 기준으로 기록했다. 이전 여성 의상 요구를 대체한다. 공통 무의상 백색 중성 표면·여성 곡선/관절·필요한 구조/리깅·전체1~6단계/승인 규칙은 유지한다.

## 변경과 실제 실패

[CEO 최신 참조](ceo-reference.png)는 모델링용이다. GLB/마케팅 재배포용이 아니며 새 사진의 흐림·과노출로 결함을 숨기지 않는다. 사진에서 보이지 않는 측면/뒤쪽 구조를 일치했다고 주장하거나 의학·운동 목표로 사용하지 않는다. SHA-256 `45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62`.

진행 중 A88 nearest-root 제작은 **finite/nondegenerate cut edge guard/exit1, 저장 전 종료**했다. 그 안전한 경계에서 최신 요구를 기존 Story/제작 계약과 A-08에 반영했다. 현재 source/GLB 재검수가 최신 참조의 외형 통과를 의미하지 않는다.

이전 A87과 연속 A60 전문 표면을 대조한 첫 읽기 전용 probe는 library load 뒤 변환 행렬 assertion/exit1로 실패했다. 새 probe에서 기존 native 제작 경로와 같은 view-layer 갱신을 한 뒤 실제 재실행/exit0했다. [진단](root-correspondence.json): body 단면은 거의 일치했지만 head 링의 최근접 거리 median 남21.541/여18.353mm였다. 아티스트 대응 수치이지 임상 정확도가 아니다. 첫 코드/실패와 새 코드/JSON을 모두 보존한다.

A88c는 설치 Blender RNA에서 확인한 TARGET_PROJECT로 하부 head만 전문 target의 보간 법선 방향에 맞췄다. 실제 cut edge 길이는 양수였지만 native SURFACE bridge 정제11.458614mm가 **기존6mm guard**에서 실패했다. 실패 원본/GLB/QA를 생성했다고 표시하지 않는다. A88d는 같은 피팅·고정 gap24mm와 native LINEAR 연결을 비교했다. bridge-only 정제 이동 남0.849066/여0.834712mm로 같은6mm guard를 유지했다. 실패를 숨기기 위한 좌표 복원·QA 변경·전신 remesh·새 도형 생성은 없다.

## 실제 보존·기술 검사

[수정 가능한 별도 원본](../../bodyguard_avatar_candidate_a88d_rejected.blend) SHA-256 `2ac97889b600c92a3519d2ae7dbc2f4834a9f350727a98a3f7706fd5d209e48b`. 원본 남144429/여144112정점. [저장 파일 독립 대조](saved-body-preservation.json)는 A81h의 retained body 남75915/여75865좌표/named skin·손·각163rest bones/행렬 동일을 실제 확인했다. **교체한 head와 새 cut/bridge의 전체 위상이 옛 모델과 동일하다는 주장은 아니다.**

전문266점 cage와 A60 좌표/A63 TOPOLOGY/NAME skin 대응을 재사용했다. 하부 head artist fit 자체의 최대 이동39.871/36.840mm는 bridge 정제6mm 예산과 별개 제작 단계이며 의학·해부학 목표가 아니다. upper head51285/51677점 불변은 해당 native 편집 단계 assertion이지 전체 저장 파일 독립 비교가 아니다.

[원본](source-deformation.json)과 [GLB 실제 재수입](roundtrip-deformation.json)은 각각 **118개/121행/실패0**를 재실행했다. 기존 원래 길이1mm초과 edge ratio3미만을 유지했다. worst 원본2.9439303671/재수입2.9476798033. 목 원본 남1.767660/1.716227·여1.623420/1.594139, 재수입 남1.908073/1.820375·여1.622858/1.593997. 20°는 기술 스트레스이지 운동 정답/권장 범위가 아니다. 공통 재질·무의상 검사는 실제 실행됐고 외형/해부학 승인으로 확대하지 않는다.

[남성 GLB](bodyguard-male-candidate.glb)12,863,512bytes / [여성 GLB](bodyguard-female-candidate.glb)12,835,880bytes. 각5meshes/1skin/163joints, images/cameras/animations0. [native 왕복](glb-roundtrip.json)은 ratio1/8weights/1µm cleanup·기존3mm envelope/0.1mm bounds를 유지한다. 남 재수입144428정점·여144112정점이며 cleanup으로 줄어든 한 점을 전체 동일 주장으로 감추지 않는다. 남1,209,933/여1,272,531 native weights 제한과 남 parent warning5개를 남긴다.

## 실제 미리보기와 외형 반려

원본 **34PNG**, GLB 재수입 **8PNG**, Chrome **2PNG**를 실제 생성했다. 그중 원본16/재수입8/Chrome2 **26개를 직접 열람**했고 원본34개 전부를 열람했다고 표시하지 않는다. 실제44PNG+CEO 참조1PNG·70사본/15gzip과 decoded SHA를 보존한다. 모든 원본/이전 증거/기본 모델은 그대로다.

- 원본: [정면](source/faceless-front.png), [3/4](source/faceless-quarter.png), 남 [전신 측면](source/faceless-body-side-male.png)/[뒤](source/faceless-body-back-male.png)/[목](source/faceless-neck-male-left.png)/[손](source/faceless-hand-male.png)/[무릎](source/faceless-knee-male.png), 여 [전신 측면](source/faceless-body-side-female.png)/[뒤](source/faceless-body-back-female.png)/[목](source/faceless-neck-female-left.png)/[손](source/faceless-hand-female.png)/[무릎](source/faceless-knee-female.png).
- 재수입: [정면](import/first-front.png), [3/4](import/first-quarter.png), 남 [측면](import/first-side-male.png)/[뒤](import/first-back-male.png)/[목](import/first-neck-male-left.png), 여 [측면](import/first-side-female.png)/[뒤](import/first-back-female.png)/[목](import/first-neck-female-left.png).
- 실제 Chrome: [남성 두 모델](browser/male-two-models.png), [여성 두 모델](browser/female-two-models.png).

**턱 아래 notch/옷깃 같은 불연속과 head 실루엣은 새 사진과 불일치**한다. 기술 PASS여도 A-02/A-08 외형은 미통과다. 출시/기본 모델로 채택하거나 PR을 병합하지 않는다.

새 사진과 [기존 A37 실제 정면](../candidate-a37/faceless-front.png)·측면/목 렌더를 읽기 전용으로 대조했다. A37의 연속 얼굴–목 형태가 이번 참조에 더 가깝다. 다음 안전한 수정은 그 전문 파생 원본을 출발점으로 앞면/head/리그를 보호하며 국소 정제하는 것이다. **A37을 이번에 수정/재검증 완료했다고 주장하지 않는다.** 분리된 head graft·smoothing 강도 증가를 반복해 완료 처리하지 않는다.

## 실제 웹·미실행

모든 native actor 종료 후 설치 Chrome154.0.8037.93/Mac16,12·AppleM4·16GiB/headless1440×1080DPR1에서 [3개/42.240925s](browser-report.json) 실제PASS, skip/flaky0. 양쪽180RAF mean 남16.673889/여16.669444ms·p95 남18.400000/여18.400000ms, 21draw/triangles1,171,794·1,169,266. static0/moving.209436·.209439, 독립 리그·eight-weight meshes2. RAF는 GPU 완료·실제 카메라/추론/사람 지연·목표 노트북 성능 승인이 아니다. native 외부 프록시 차단과 WebGL loss/복구는 실제, guest401/model503은 모의다. 카메라0·API/SQL/SMTP/OAuth 없음. color/Clock/WebGL cleanup warning과 주입503을 숨기지 않는다.

새6 native 파일의 기본 Ruff/format 실제PASS, preserver syntax PASS. 기존 helpers/전체 저장소 style 회귀 완료를 주장하지 않는다. `engineering:debug`로 native 실패를 재현/구분하고 `documentation`으로 최신 참조·수용 기준·실패/미실행을 기존 명세에 반영했다. `engineering:code-review` 기준으로 경로/덮어쓰기 거부·SHA·기존 guard·retained skin/rig와 증거 정합성을 검토한다. 기존 도구/stdlib만 사용했고 새 의존성은 없다.

**미실행:** 재수입 전체34컷·전체 서비스/API/Vitest/typecheck/build/저장소 style·실제 사람/웹캠/pose/video·시범/retarget/복합 동작·여러 장치/목표 노트북/장시간/GPU timing·전문가·공급자 연결/계정/시크릿/비용/운영 migration/배포/출시. 개발 기본 A37·A-02 P2·Draft PR #9 미병합·S2.4/2단계/전체1~6 미완료를 유지한다.

## 반복 증거 확인

읽기 전용 옛 증거 확인 중 A83–85 auditor의 잘못된 파일명(MODULE_NOT_FOUND/exit1), 이후 필수 절대 root 인수 누락(AssertionError/exit1)이 발생했다. 실제 auditor를 읽고 정확한 경로·인수로 재실행해 PASS/exit0했다. A86/A87/새 A88 정합성 검사도 실제 PASS다. 옛 증거는 수정하지 않았고 이 도구 호출 오류를 native 제작 실패로 합산하지 않는다.

`node bodyguard/assets/blender/review/candidate-a88-review/evidence-check.cjs <저장소 절대경로>`

[copy manifest](copy-manifest.json) · [실행/실패 기록](execution-record.json) · [제작](generation.json) · [신체 보존](saved-body-preservation.json). gzip은 실제 실행 코드 bytes를 보존한 것이며 decoded SHA가 manifest에 있다. 재현은 기존 CC0 bundle/A81h/A60/A63와 A49/A74 도구를 사용하고 반드시 새 출력 경로를 지정한다. stateful preservation 코드를 이미 존재하는 archive에 재실행하지 않는다.
