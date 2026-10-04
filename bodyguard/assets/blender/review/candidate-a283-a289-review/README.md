# A283–A289 — 머리–목 접합부 진단과 누적 이동 제한 조형

2026-10-04 · S2.4 · FR-A-02/03/08. **새 후보는 미채택입니다. 외형 P2는 미해결이며 PR #9·2단계·1~6단계 출시는 완료되지 않았습니다.**

최신 [CEO 얼굴·목 참조](../candidate-a88-review/ceo-reference.png)를 기준으로 남녀 무의상·중성 백색 마네킹, 연속 얼굴–목, 통일된 재질·표면, 필요한 신체 구조와 리깅 정확도 보존을 유지합니다. 이전 여성 의상 요구는 대체됐습니다. 사진의 흐림·과노출은 품질 목표로 삼지 않습니다. [이전 외곽선 대조·실패 기록](../candidate-a279-a282-diagnosis/README.md)과 원본은 보존했습니다.

## 실제 실행 결과

| 검사 | 실제 결과와 한계 |
|---|---|
| A283 형상·법선·조명 분리 | 같은 A276 원본에서 실제 Cycles 렌더8장과486 ray를 실행했습니다. 남205hit/38miss·여198hit/45miss. 평면 polygon0·custom normal 없음·범프/텍스처 없는 Principled→Surface입니다. 상부 명암은 조명에 따라 달라지지만 아래 목 접합 흔적은 남습니다. 원본·리그·skin·원장 불변이며 조명 변경은 메모리에만 적용했습니다. |
| A284 접합부 연결·곡률 | 실제610 ray: 남305hit/0miss·여278hit/27miss. 각 모델은 원래 edge로 연결된 단일 메시이며 모든 hit가 같은 성분에 속합니다. 분리된 닫힌 머리 모델의 겹침이 아닙니다. 중앙 표본의 인접 면각 최대8.430°/17.980°는 국소 곡률 사실이지 의학·전체 외형 승인 수치가 아닙니다. |
| A285 최초 국소 조형 | 전문 A276의 내부 접합부에 native DISPLACE를 적용했습니다. 추가 이동은 약4mm지만 **최초 A250 대비** 누적 남4.735mm·여6.210mm로 여성6mm 보호가 실패했습니다. exit1·저장 전 중단·새원본/GLB/렌더0. A286 저장 대조와 후속 QA는 미실행입니다. |
| A287 사전 누적 제한 조형 | 원본에서 이미 이동한 XYZ 벡터와0.1mm 여유로 **조형 전에** 남녀 공통3.308148mm를 도출했습니다. per-point clamp·좌표/skin 복구·보호 완화 없이 native 한 번을 실행했습니다. 추가 변경1978/2263점·추가 최대3.305mm, 전체 원본 대비9795/9689점·최대4.207/5.900mm. 기존6mm 보호·fold76/107·tiny2/0·위상·앞면·범위 밖·손을 유지했습니다. |
| A288 독립 저장 대조 | 별도 프로세스로 실제 저장 파일을 다시 열었습니다. raw skin·139그룹·각163rest/부모·pose/world·PBR·point ledger·선택 밖과 앞면을 원래 A250과 정확히 대조했습니다. 원래좌표 그대로인 점121850/120859. A277 검증 helper의 변경 없는 사본을 재실행했고 stdout의 A277 표기를 새로운 별도 검사로 오인하지 않습니다. |
| A289 원본·GLB 변형 | 원본과 GLB 재수입 각각118개 기술 pose·121행 PASS·실패0. ratio1 별도 웹 원본/GLB8가중치와 기존 triangle-fin 정제만 적용했습니다. **qc-only** 실행이며 각 전체34렌더는 미실행입니다. 올바른 운동 시범·웹캠 사용자 리타게팅 검증이 아닙니다. |
| 실제 Chrome | 설치된 Chrome에서 새 GLB로3개 PASS·34.619s. 두 독립 뼈대·합성 기술 변형·실제 WebGL context loss/재시도와 GLB503 오류 복구를 검사했습니다. 외부 연결 차단·카메라0. 180frame의 남 평균16.67ms/p9517.1ms·여16.66ms/p9516.8ms는 **합성 렌더 간격**이며 웹캠 반응 속도가 아닙니다. |
| 보존·정적 검증 | 실제18PNG 전부 직접 열람·native8회 중7exit0/1guard exit1 전체 명령/stdout 보존. 원본/웹/재수입blend3·GLB2·PNG18·gzip34의57개 정확 사본, 보호된 이전808파일 SHA 불변. Python13helper Ruff check/format·순수 math/bookkeeping24개·Node syntax를 실행했습니다. A286 준비 코드는 정적 검사만 통과했습니다. |

## 실제 미리보기

새 파일의 실제 렌더입니다. 사진을 편집한 결과나 완성 코칭 화면이 아닙니다.

[남성 Chrome](browser/남성-two-models.png) · [여성 Chrome](browser/여성-two-models.png) · [남성 앞면](native/head-front-male.png) · [여성 앞면](native/head-front-female.png) · [남성 뒤쪽](native/head-back-male.png) · [여성 뒤쪽](native/head-back-female.png) · [여성3/4](native/head-quarter-female.png).

[여성 법선 진단](diagnostic/posterior-world_normals-female.png)은 원본 A276의 거짓색 native 렌더로, 백색 마감이나 새 A287 외형 승인 이미지가 아닙니다. 기존 조명·좌/우 단일 조명에서도 남는 접합부 흔적과 함께 해석했습니다.

## 검수 결론과 다음 작업

**수치 검증은 통과했지만 A-02/A-08 외형 P2는 유지합니다.** 내부 뒤통수 마감·측면 접합과 전체 다각도/관절 확대·웹 외형이 아직 목표 품질에 못 미칩니다. 원래부터 연결된 목의 곡률을 다룰 문제이며, 필요 외곽선을 지우거나 조명으로만 감추지 않습니다. 다음은 실제 국소 곡률과 선택 경계를 바탕으로 전문 원본의 연속 곡면 조형을 보완하는 것입니다. 강도/범위만 넓히는 반복이나 보호 기준 변경으로 통과시키지 않습니다.

A37 개발 기본 모델과 서비스 runtime은 바꾸지 않았습니다. 시범 애니메이션/사용자 리타게팅·실제 사람/웹캠·Gmail/Google·전체1~6단계는 미완료입니다. 새 후보와 실패·기존 증거는 모두 보존합니다. 중요한 범위·안전·개인정보·비용·계정·시크릿·운영 DB·배포/출시의 별도 승인 경계는 그대로입니다.

## 재검증

`node bodyguard/assets/blender/review/candidate-a283-a289-review/evidence-check.cjs`로57사본과 이전808파일 해시, 실제 ray·실패·누적 제한·저장 대조·118pose·Chrome 결과를 확인합니다. 입력 절대 경로와 실제 명령은 실행 기록에 그대로 보존하며 재검증기는 저장소 내 경로로 대조합니다. 다른 작업트리/장치에서 실행했다고 주장하지 않습니다. integrity PASS는 외형·의학/자세 정확도·출시 PASS가 아닙니다.

원본 A250 SHA `0e6243e64b65841510d2ed926f3bf315e3cc101dbfa57d41beafb8bcedc8a104`, 입력 A276 `43a0772aeb72bd2e33ab8e751e52a84d9b1ede3d139f5391d99fa17070e11539`, 새 A287 `6aa183a1fda75b03bb779401a47a198f1cbc08f6060fc80e1231630ea8479bfc`입니다. [원본](native/artist-candidate.blend)·[웹 원본](native/web-candidate.blend)·[재수입 원본](native/web-candidate-roundtrip.blend)·[남성 GLB](export/bodyguard-male-candidate.glb)·[여성 GLB](export/bodyguard-female-candidate.glb)를 별도로 보존했습니다.

2026-10-04 최종 회귀에서 frontend151개/16파일 PASS·6.67s, Biome65파일·TypeScript noEmit·변경4문서246개 로컬 링크·새/이전 evidence checker·`git diff --check`를 실제 재실행했습니다. 최신 origin/main `4a00bb2`는 시작 HEAD `7105596`에 포함됐으며 실제 PR9의 같은 head는 OPEN/Draft/CLEAN/MERGEABLE·**체크 없음**이었습니다. 외형 P2가 남아 병합하지 않습니다. 이번 production build·실제 사람/공급자·다른 장치의 QA는 미실행이고 runtime/기본A37·운영 설정은 변경하지 않았습니다. 문서화·리뷰에서 실패/미실행과 기술 수치/외형 승인을 분리했으며 새 source/runtime 결함을 고친 것으로 주장하지 않습니다.
