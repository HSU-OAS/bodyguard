# A87 — 목 접선 국소 정제 실제 검수

2026-10-02 · S2.4/PR #9 리뷰 보완 · **외형 반려/미채택, 개발 기본 A37 유지.** 여성 의상 요구를 대체한 CEO 결정과 전체1~6단계·승인 기준을 그대로 유지한다. 의상 경계 없는 공통 백색 중성 마네킹·여성 곡선/관절을 보존한다.

## 실제 결과

A86 실제 저장 원본의 연결 링을 읽기만 한 진단에서 남성 body/head 면 방향 median40.018°/58.396°, 여성37.136°/54.046°를 확인했다. 기존 A78c의 국소 native CORRECTIVE_SMOOTH/LENGTH_WEIGHTED/only-smooth를 새 A87 base에 재사용했다. factor.15/8회/양쪽 margin30mm; 신체 좌표 clamp·전체 remesh·새 도형 생성은 없다. 최종 median 남25.653°/30.944°, 여28.171°/28.424°로 줄었지만 **뒤 목 주름·턱/목 연결·머리 실루엣은 참조 품질 미달**이다. 평균 개선은 외형 승인이나 의학·해부학·운동 정답이 아니다.

[새 base](../../bodyguard_avatar_candidate_a87_base.blend)의 제작은 A86의 C402 두 건을 dict comprehension으로 정리한 별도 maker로 실제 재실행했다. 전문266점 cage·연속 A60좌표/A63 skin 대응·고정 gap24mm와 기존 bridge6mm guard를 유지했다. base에서 남75915/여75865 원래 body좌표/named skin·손·각163 rest bones/행렬 보존을 독립 확인했다. 최종 목 편집 이후에는 **base 대비 영역 밖 남126711/여127054좌표와 전체 위상/named skin·손·각163 rest bones/행렬**이 정확히 같은지 두 저장 파일을 다시 열어 별도 대조했다. 영역 안14843/15182점은 artist 편집 대상이며 최대 이동3.160516/2.799556mm로 기존6mm guard를 지켰다. 최종 목 전체 좌표 불변을 주장하지 않는다. 링 ID는 편집 뒤 비평면인 역사 ID다.

원본/GLB 실제 재수입에서 각각 **118개/121행/실패0**를 재실행했다. 최악 ratio 원본2.9439303671/재수입2.9476798033; 목 원본 남2.509702/2.562366·여2.581909/2.473370, 재수입 남2.509580/2.562347·여2.582021/2.473600. 원래 길이1mm 초과 edge의 ratio3미만 기술 guard를 바꾸지 않았다. 20° 시험은 기술 스트레스이며 사용자 목표 범위가 아니다.

## 실제 파일과 미리보기

[최종 Blender 원본](../../bodyguard_avatar_candidate_a87_rejected.blend) · [남성 GLB](bodyguard-male-candidate.glb) · [여성 GLB](bodyguard-female-candidate.glb).

- 원본: [정면](source/first-front.png), [3/4](source/first-quarter.png), 남 [측면](source/first-side-male.png)/[뒤](source/first-back-male.png)/[목](source/first-neck-male-left.png), 여 [측면](source/first-side-female.png)/[뒤](source/first-back-female.png)/[목](source/first-neck-female-left.png).
- GLB 재수입: [정면](import/first-front.png), [3/4](import/first-quarter.png), 남 [측면](import/first-side-male.png)/[뒤](import/first-back-male.png)/[목](import/first-neck-male-left.png), 여 [측면](import/first-side-female.png)/[뒤](import/first-back-female.png)/[목](import/first-neck-female-left.png).
- 실제 Chrome: [남성 두 모델](browser/male-two-models.png), [여성 두 모델](browser/female-two-models.png).

실제16 native/2 Chrome PNG를 생성하고 **18개 모두 직접 열람**했다. AI 생성 이미지/옛 스크린샷으로 대체하지 않았다. 원본·base·GLB·48사본/16gzip decoded SHA와 이전 원본/GLB/증거를 덮어쓰지 않고 보존한다. 원본/재수입 전체34컷은 이번에 실행하지 않았다.

## 실제 웹 검증과 한계

Blender5.1.1 ratio1/native8 export·1µm cleanup·기존3mm envelope/0.1mm bounds guard를 유지했다. 남12,610,600bytes/여12,670,792bytes, 각각5meshes/1skin/163joints, images/cameras/animations0. native export의 남1,185,660/여1,264,715 weights 제한과 남 parent warning5개는 보존한다. 기존 QA대로 native 재수입/변형/브라우저를 실제 검사했다.

Mac16,12 / AppleM4 / 16GiB / Chrome154.0.8037.93 / headless1440×1080·DPR1. 실제3PASS/41.420195s, 양쪽180RAF mean16.666111ms·p95각16.800000ms, triangles1,148,802/1,154,258·21draw. static0/moving.209432/.209438·독립 리그·eight-weight meshes2. 모든 native actor가 terminal인 뒤 실행했다. 실제 외부 프록시 차단/네이티브 WebGL loss·복구, 카메라 호출0; guest401/model503은 모의다. API/SQL/SMTP/OAuth는 실행하지 않았다. RAF는 GPU 완료·사람/카메라/추론 지연·목표 노트북 성능 승인이 아니다.

## 검사 실패·미실행·다음 작업

새 maker/fairing/base 대조/local 대조/clean probe **5파일의 기본 Ruff와 format check 실제PASS**. A86 실행 snapshot의 C402는 수정하지 않고 새 maker에서만 해결·재실행했다. 첫 읽기 전용 probe의 I001 preflight 실패에도 native 실행이 조건부로 차단되지 않았던 오류는 숨기지 않는다. 당시 코드/JSON을 보존하고 새 clean probe에서 Ruff를 통과한 후 실제 재실행해 같은 결과를 확인했다. 원래 lint 실패를 PASS로 표시하지 않는다. 기존 helpers/전체 저장소 style 회귀를 통과했다고 주장하지 않는다.

잘못 추정한 helper1개/문서2개 읽기는 missing이었다. rg로 실제 경로를 찾았다. sandbox sysctl 읽기는 거부됐고 승인된 읽기로 실제 CPU/메모리를 확인했다. Chrome color/Clock/WebGL 정리 warning과 주입503은 정상 결과와 구분한다.

**미실행:** 전체34 source/import PNG·전문가/실제 사람·시범/retarget/복합 동작·카메라/추론·여러 장치/목표 노트북/장시간/GPU timing·전체 서비스/API/Vitest/typecheck/build/저장소 style·외부 공급자/계정/시크릿/비용/운영 migration/배포/출시.

A-02 P2·PR #9 Draft 미병합·S2.4/2단계/1~6 미완료를 유지한다. 다음은 무작정 smoothing 강도를 높이는 대신 전문 head의 턱/후두부–목 단면과 연속 접선의 대응을 보완하는 것이다. 신체 구조/skin/리그·변형 기준을 낮추지 않는다. 전문가의 최종 검토만 남았다고 표시하지 않는다.

## 반복 확인

```bash
node bodyguard/assets/blender/review/candidate-a87-review/evidence-check.cjs "$AVATAR_QA_ROOT"
```

[copy manifest](copy-manifest.json) · [실행 기록](execution-record.json) · [기존 경계 진단](ring-probe.json)/[clean 재실행](ring-probe-clean.json) · [base 제작](base-generation.json)/[base 신체 보존](base-saved-source.json) · [국소 제작](generation.json)/[저장 파일 독립 대조](saved-source.json) · [원본118](source-deformation.json) · [native 왕복](glb-roundtrip.json)/[재수입118](roundtrip-deformation.json) · [Chrome](browser-report.json).

gzip은 실제 실행 코드의 원래 bytes/decoded SHA다. 재현 시 기존 CC0 bundle/A81h/A60/A63와 보존 A49/A74 도구를 사용하며 항상 새 출력 경로를 지정한다. 사용자 live Blender 장면과 이전 증거·개발 기본 모델은 변경하지 않는다. 새 의존성·프레임워크 없이 기존 도구를 재사용했다.
