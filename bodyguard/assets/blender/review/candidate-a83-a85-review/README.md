# A83~A85 — 전체 전문 머리 피팅·skin 대응 실제 검수

2026-10-02 · S2.4/PR #9 리뷰 보완 · **세 후보 모두 외형 반려/미채택. 개발 기본 A37은 바꾸지 않는다.** 여성 무의상·남녀 통일 백색 표면, 자연 곡선/관절, 이전 원본/GLB/증거, 1~6단계 완료 기준과 별도 운영 승인 경계를 유지한다.

## 결과

| 후보 | 실제 제작/검증 | 판정 |
|---|---|---|
| A83 | 완전한 전문 head를 실제 턱/정수리/두개골 범위에 피팅한 뒤 native whole-head Shrinkwrap. 저장·재열기 대조, 원본118개/121행 PASS, 실제8PNG | 기존 얼굴 면을 투영하면 겹침/접힘이 남음. 외형 반려. GLB/Chrome 미실행 |
| A84 | 전문 head 자체를 native 연결. 원래 body 남75915/여75865 좌표/named skin·손·각163 rest bones/행렬 독립 보존 대조. 118개 전부 검사/34PNG 생성 | 목3조건 실제 실패(exit1), 최악3.7833517242. 면 겹침은 제거됐으나 옷깃처럼 보이는 연결·동작 시 머리 면 늘어남. GLB/Chrome 미실행 |
| A85 | A63의 준비 named skin만 TOPOLOGY/NAME으로 연속 전문 A60 좌표에 전달한 뒤 피팅 head에 native 대응. 신체 보존 대조, 원본/실제 GLB 재수입 각각118개 PASS. 각각 실제8PNG. Chrome3개/42.321s PASS | 목 skin 대응 실패는 보완됐지만 턱 아래 경계/뒤 목 주름·이마 단차와 최종 마감 미달. 외형 반려/미채택 |

A84 목 ratio: 남 좌2.7940095233/우3.4869337755, 여 좌3.5357668094/우3.7833517242. A85 원본: 남2.0973117018/2.1385332679, 여2.4576850767/2.3534790592. A85 재수입: 남2.0973107841/2.1383873802, 여2.4579212466/2.3536081637. 원본 최악2.9439303671/재수입2.9476798033. **원래1mm 초과 rest edge/ratio3미만 및 새 연결점6mm guard를 바꾸지 않았다.** A84/A85 새 연결점 이동 남3.878/여3.609mm. 이 수치는 기술적 tearing alarm이지 운동 각도·의학·해부학 승인 기준이 아니다.

A83의 아래 목/신체/손 남75370/여75363점과 전체 skin/위상/리그는 실제 저장 재열기로 보존을 확인했다. A84/A85 머리/새 bridge는 조형 대상이라 이전 턱/머리 좌표 전체 불변을 주장하지 않는다. 기존 신체 남75915/여75865점과 named skin/손/163bones/rest/행렬은 두 저장 원본에서 각각 독립 대조했다. A63의 수축된 좌표는 쓰지 않았다. 전문 cage 조형에서 상부/뒤 원점 보존은 **그 native cage 편집 단계**의 증거이며 이후 artist scale/rotation까지 원좌표·체적 보존을 주장하지 않는다.

## 실제 파일과 미리보기

[원본 A83](../../bodyguard_avatar_candidate_a83_rejected.blend) · [원본 A84](../../bodyguard_avatar_candidate_a84_rejected.blend) · [원본 A85](../../bodyguard_avatar_candidate_a85_rejected.blend) · [남성 GLB](bodyguard-male-candidate.glb) · [여성 GLB](bodyguard-female-candidate.glb).

- A83: [정면](a83/first-front.png), [3/4](a83/first-quarter.png), 남 [측면](a83/first-side-male.png)/[뒤](a83/first-back-male.png)/[목](a83/first-neck-male-left.png), 여 [측면](a83/first-side-female.png)/[뒤](a83/first-back-female.png)/[목](a83/first-neck-female-left.png).
- A84: [정면](a84/faceless-front.png), [3/4](a84/faceless-quarter.png), 남 [측면](a84/faceless-side-male.png)/[목 좌](a84/faceless-neck-male-left.png)/[목 우](a84/faceless-neck-male-right.png), 여 [측면](a84/faceless-side-female.png)/[목 좌](a84/faceless-neck-female-left.png)/[목 우](a84/faceless-neck-female-right.png). 생성34컷 중 실제11컷을 봤으며 나머지23컷 전체 육안 검수를 완료했다고 표시하지 않는다.
- A85 원본: [정면](a85/first-front.png), [3/4](a85/first-quarter.png), 남 [측면](a85/first-side-male.png)/[뒤](a85/first-back-male.png)/[목](a85/first-neck-male-left.png), 여 [측면](a85/first-side-female.png)/[뒤](a85/first-back-female.png)/[목](a85/first-neck-female-left.png).
- A85 실제 GLB 재수입: [정면](a85-import/first-front.png), [3/4](a85-import/first-quarter.png), 남 [측면](a85-import/first-side-male.png)/[뒤](a85-import/first-back-male.png)/[목](a85-import/first-neck-male-left.png), 여 [측면](a85-import/first-side-female.png)/[뒤](a85-import/first-back-female.png)/[목](a85-import/first-neck-female-left.png).
- 실제 Chrome: [남성 두 모델](browser/male-two-models.png), [여성 두 모델](browser/female-two-models.png). 총60PNG 보존/실제37PNG 열람. 이미지 합성·생성 사진으로 대체하지 않았다.

## 실제 웹 환경과 한계

Blender5.1.1 native export, ratio1/여덟 가중치, 1μm cleanup/기존3mm envelope·0.1mm 왕복 bounds guard. 남12,385,584bytes/여12,476,928bytes, 각각5meshes/1skin/163joints, images/cameras/animations0. 자료·원본 참조를 GLB에 내보내지 않았다. 실제 웹용 최적화/목표 노트북 합격을 의미하지 않는다.

Mac16,12 / AppleM4 / 16GiB / Chrome154.0.8037.93 / headless1440×1080·DPR1. 남녀 독립 두 뼈대 실제180RAF, mean16.668/16.666ms·p95각16.800ms, 21draw/triangles1,128,346·1,136,634, static0/moving0.209436·0.209433. 카메라 요청0, 소유한 non-listening native proxy로 외부 연결 차단을 실제 검사했다. API/SQL/SMTP/OAuth는 실행하지 않았다. 게스트401·GLB503은 모의, WebGL-loss는 실제 확장 호출/재연결 시험이다. **RAF는 GPU render time·카메라/추정/실제 사용자 지연 시험이 아니다. 이 장치는 목표 노트북 검증으로 세지 않는다.** 모든 native actor가 terminal인 뒤 Chrome을 실행했다.

## 실패·미실행·다음 작업

A84 목3조건 실패와 A83/A85 외형 반려는 성공으로 바꾸지 않는다. 실행된 두 역사 maker에는 미사용 target_xy가 남아 Ruff E9,F가 실제 F841 두 건으로 실패했다. 실행 당시 코드 snapshot을 고쳐 과거 검증으로 주장하지 않았으며 다음 producer 정리/실제 재실행 전에 채택할 수 없다. exporter의 남성 armature-parent warning5개, Chrome의 기존 Clock/cleanup warning·예상503를 보존한다. 계측/왕복/재시도 수용 기준은 실제 결과로 판단한다.

첫 archive helper는 정규식 escaping preflight에서 복사 전 실패했다. 실패 helper와 exact allowed-path 보완 helper를 모두 보존했고 실제95파일·18gzip decoded SHA·60PNG의 독점 byte-copy를 완료했다. 기기 읽기의 sandbox 실패/승인 후 네 항목 재실행, old auditor 인자 누락/정확한 root로 재실행과 unsupported low-detail 이미지 누락도 [실행 기록](execution-record.json)에 구분했다. 누락 이미지는 열람 수에 넣지 않았다.

**미실행:** A83/A84 GLB/재수입/Chrome, A83/A85 원본 전체34컷·A85 재수입 전체34컷, A84 나머지23컷 육안 검수, 실제 운동/시범·사용자 retarget·웹캠/추정/복합 동작·실제 사람/여러 장치/목표 노트북·장시간/GPU timing·전체 서비스/API/Vitest/typecheck/build/전체 Ruff style/format 회귀, 공급자/계정/시크릿/운영DB/배포/출시. 운영 작업 승인은 별도다.

다음은 연속 원본을 쓰는 skin 대응을 유지하면서 전문 head cage의 앞면 경계/턱 하부–neck 단면의 곡면 접선을 조형하고, 새 제작 코드의 미사용 구문을 정리한 뒤 실제로 재검수하는 작업이다. 단순 전체 smoothing 강도 증가·기준 완화·신체 remesh로 통과시키지 않는다. **A-02 P2와 Draft PR #9 미병합, S2.4/2단계/전체1~6 미완료는 그대로다.** 전문가 검토만 남은 상태로 표시하지 않는다.

## 반복 확인

저장소 절대 경로를 첫 인자로 넣는다. 추가 의존성/프레임워크는 없다.

```bash
node bodyguard/assets/blender/review/candidate-a83-a85-review/evidence-check.cjs "$AVATAR_QA_ROOT"
```

무결성 검사는 실제 실패3건·원본/재수입118개·Chrome 자산SHA·판정 미채택을 함께 확인하며 외형 승인 검사가 아니다. [copy manifest](copy-manifest.json)에는 원본·GLB·report·실제60PNG와 실행 코드18개 gzip의 원본 decoded SHA가 있다. 이전 A81/A82 무결성 검사도 원래 명세대로 재실행해 통과했다. 실제 producer는 보존한 A77/A49/cage/orientation helper와 CC0 bundle, A81h/A60/A63 원본을 사용한다. maker/QA/export/browser의 당시 파일을 scripts/에서 원래 byte로 복원할 수 있다.

원본 변형은 보존된 review_avatar.py, GLB 재수입은 보존된 export_avatar_candidate.py, 브라우저는 기존 tests.run_browser avatar를 사용한다. 매 반복은 새 출력 경로여야 하며 원본/GLB/증거·사용자의 live Blender 장면을 덮어쓰지 않는다. 현재 개발 기본 자산은 교체하지 않는다.
