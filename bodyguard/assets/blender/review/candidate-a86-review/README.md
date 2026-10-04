# A86 — native 가중 cage 경계 보완 실제 검수

2026-10-02 · S2.4/PR #9 리뷰 보완 · **외형 반려/미채택, 개발 기본 A37 유지.** 여성 무의상·남녀 동일 백색 마감/자연 곡선/관절·이전 원본/GLB/증거·전체1~6/승인 규칙은 유지한다.

## 실제 결과

전문 CC0 266점 head cage의 기존 hard selection 경계를 native CORRECTIVE_SMOOTH/LENGTH_WEIGHTED/only-smooth와 연속 artist vertex mask로 바꿨다. 36회/factor.45, zero mask63점/partial89점·위상은 **그 native 편집 단계에서** 실제 보존했다. 범위를 제한하는 것은 mask weight이며 신체 좌표를 clamp하지 않는다. 원형 체적은 .0035623891→.0030583466m³로 바뀌므로 native smoothing/후속 회전·피팅 전체의 체적/원좌표 불변을 주장하지 않는다. 이 값·artist30° orientation·20° 기술 스트레스는 의학/해부학/운동 정답이 아니다.

원본과 GLB 실제 재수입에서 각각118개/121행/실패0를 실제 확인했다. 목 ratio 원본 남2.4217522986/2.4710847312·여2.5195049620/2.4265289289, 재수입 남2.4217654398/2.4709975267·여2.5196066309/2.4265376817. 전체 최악 원본2.9439303671/재수입2.9476798033. 원래1mm 초과 rest edge의 ratio3미만 guard는 바꾸지 않았다. 새 bridge-only 이동 남3.605/여3.493mm로 기존6mm guard를 유지했다.

A60의 연속 전문 좌표에 A63의 준비 named skin만 TOPOLOGY/NAME으로 전달한 뒤 새 head에 native 대응하는 경로를 유지했다. A63 수축 좌표는 사용하지 않는다. 실제 저장 원본을 별도 재열어 남75915/여75865 기존 신체 좌표/named skin·손·각163 rest bones/행렬을 독립 대조했다. 새 head/bridge는 artist 조형 대상이며 이전 전체 head 좌표 불변을 주장하지 않는다.

실제8PNG씩/Chrome2PNG **총18PNG 생성·전부 열람**했다. 이마 단차는 줄었지만 턱 아래 옷깃형 neck 연결·뒤 목 주름과 최종 마감은 참조 품질 미달이다. **수치/브라우저 PASS가 외형 승인은 아니다. A-02 P2/PR #9 Draft 미병합, S2.4/2단계/1~6단계 미완료는 그대로다.**

## 실제 원본·미리보기

[Blender 원본](../../bodyguard_avatar_candidate_a86_rejected.blend) · [남성 GLB](bodyguard-male-candidate.glb) · [여성 GLB](bodyguard-female-candidate.glb).

- 원본: [정면](source/first-front.png), [3/4](source/first-quarter.png), 남 [측면](source/first-side-male.png)/[뒤](source/first-back-male.png)/[목](source/first-neck-male-left.png), 여 [측면](source/first-side-female.png)/[뒤](source/first-back-female.png)/[목](source/first-neck-female-left.png).
- GLB 실제 재수입: [정면](import/first-front.png), [3/4](import/first-quarter.png), 남 [측면](import/first-side-male.png)/[뒤](import/first-back-male.png)/[목](import/first-neck-male-left.png), 여 [측면](import/first-side-female.png)/[뒤](import/first-back-female.png)/[목](import/first-neck-female-left.png).
- 실제 Chrome: [남성 두 모델](browser/male-two-models.png), [여성 두 모델](browser/female-two-models.png). 이미지 합성/AI 생성 사진으로 대체하지 않았다.

## 실제 웹 환경과 한계

Blender5.1.1 ratio1/native8 export·1μm cleanup/기존3mm envelope/0.1mm 왕복 bounds guard를 유지했다. 남12,610,600bytes/여12,670,616bytes, 각각5meshes/1skin/163joints, images/cameras/animations0. 남1,185,660/여1,264,715 weights 제한과 남 parent warning5개를 기록한다. 실제 웹 최적화/목표 노트북 합격이 아니다.

Mac16,12 / AppleM4 / 16GiB / 실제 Chrome154.0.8037.93 / headless1440×1080·DPR1, 3PASS/41.520054s. 남녀180RAF mean16.667778/16.668333ms·p95각16.800000ms, triangles1,148,802/1,154,242·21draw, 독립 두 리그/static0/moving.209437/.209438·eight-weight meshes2. 카메라0, 소유한 non-listening proxy의 외부 연결 차단과 native WebGL loss/복구를 실제 검사했다. 게스트401/GLB503은 모의다. API/SQL/SMTP/OAuth는 실행하지 않았다. **RAF는 GPU 완료·카메라/추론/사람 지연/성능 시험이 아니며 이 장치를 목표 노트북 합격으로 세지 않는다.** 모든 native actor가 terminal인 뒤 Chrome을 실행했다.

## 실패·미실행·다음 작업

새 producer와 저장 대조 코드의 Ruff E9/F·format check는 실제 PASS다. **기본 Ruff는 maker line516/518의 C402 두 건으로 exit1**이었다. 실행한 snapshot은 보존했으며 다음 새 producer에서 정리하고 실제 재실행하기 전 채택하지 않는다. 역사 A84/A85의 F841을 이번 결과로 통과시킨 것으로 표시하지 않는다. Chrome Clock/color/WebGL cleanup warning과 예상503도 실제 결과와 구분한다.

첫 archive helper는 trailing slash를 남긴 path.join에 separator를 다시 붙인 preflight에서 복사 전 exit1이었다. failed snapshot을 보존하고 새 path.resolve helper로 실제39사본/12gzip decoded SHA/18PNG를 독점 byte-copy 했다. 그 전 종속 이미지 열기는 missing으로 실패했으며 실제 열람 수에 넣지 않았다. 잘못 추정한 QA helper 경로 읽기4건은 실패로 남기고 rg --files로 기존 도구를 찾았다. 기존 파일·증거를 덮어쓰지 않았다.

**미실행:** 전체34 source/import PNG, 실제 시범·사용자 retarget/webcam/inference/복합 동작·실제 사람/여러 장치/목표 노트북·장시간/GPU timing·전체 서비스/API/Vitest/typecheck/build/전체 저장소 style·format 회귀, 외부 공급자/계정/시크릿/운영 DB migration/비용/배포/출시. 운영 승인은 별도다.

다음은 단순 전체 smoothing 강도 증가가 아니라 전문 cervical 단면/접선의 artist 조형과 새 producer 정리·실제 재검수다. 신체 구조·리그·변형 기준을 지워 외형만 매끈하게 만들거나 수치를 완화하지 않는다. 전문가의 최종 점검만 남은 상태로 표시하지 않는다.

## 반복 확인

```bash
node bodyguard/assets/blender/review/candidate-a86-review/evidence-check.cjs "$AVATAR_QA_ROOT"
```

[copy manifest](copy-manifest.json), [실행 기록](execution-record.json), [제작 대조](generation.json), [저장 원본 보존](saved-source.json), [원본118개](source-deformation.json), [native 왕복](glb-roundtrip.json), [재수입118개](roundtrip-deformation.json), [실제 Chrome](browser-report.json). 무결성 검사는 외형/출시 승인 검사가 아니다.

보존 scripts/의 gzip은 당시 실행 파일의 원래 bytes/decoded SHA다. A49·artist orientation·QA/export/browser helpers는 기존 것을 그대로 사용했다. 당시 maker를 복원한 재실행에는 기존 CC0 bundle/A81h/A60/A63가 필요하고 항상 새 출력 경로를 쓴다. 사용자 live Blender 장면·이전 출력·기본 아바타를 변경하지 않는다. 새로운 의존성·프레임워크는 추가하지 않았다.
