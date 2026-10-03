# A196–A213 — 내보내기 면 분할 수정과 A211 실제 재검수

2026-10-03, S2.4. **A211은 웹 면 분할·기술 검수 통과, 외형 미통과·미채택**이다. 머리 아래/뒤 목 경계와 웹 관절 경계 마감이 남아 A-02/A-08 P2·Draft PR #9 병합 보류·개발 기본 A37을 유지한다. 2단계와 전체 1~6단계는 완료되지 않았다.

최신 사진의 얼굴·목·연속 연결, 남녀 무의상 중립 백색/통일 마감, 필요한 신체 구조·리깅 정확도 요구를 기존 Story/명세에 이어 적용한다. 참조 SHA256은 `45b313912dee5ae2218b1fe76086abb35a9b948fab9e877f1a9d2b05f832de62`이다. 사진과 픽셀 단위 동일·외형 승인·의학적 정확도를 주장하지 않는다.

## 실제 원인과 수정

A195의 native 원본·web·GLB 및 GLB binary를 대조했다. 내보내기 첫 삼각화 **뒤** 퇴화 정리가 사각형 남71/여43개를 다시 만들었고, 암묵적 최종 분할에서 tiny 삼각형 남32/여10, 그중 면적0 남11/여4가 실제 GLB에도 들어갔다. binary 법선은 유효하므로 법선을 덮어씌워 해결하지 않았다. 원본 artist의 암묵적 삼각화에도 면적0 남85/여47이 있으나 이번에 그 원본을 바꾸거나 제거하지 않았다. 기존118변형 통과는 이 면적 검사의 대체물이 아니다.

정상 면까지 FIXED/ALTERNATE로 바꾸는 진단은 새 작은 면/접힘을 만들어 제외했다. 실제 불량 parent 남31/여10만 native ALTERNATE, 나머지 남40/여33은 BEAUTY로 명시적 삼각화했다. 새 재사용 helper는 모든 좌표·numeric skin·기존 삼각형 winding을 보존하고, 새 tiny/면적0·열린 표면·잘못된 winding을 거부한다. 전체 신체/목 remesh·검사 기준 완화·적용 뒤 좌표/skin 복구는 없다.

새 GLB binary의 면적0·invalid normal·뒤 목 tiny는 남녀 모두0이다. 남성의 기존 전완/손목 tiny **1개는 비영 면적 그대로 남는다**. 전신 모든 작은 면 제거를 주장하지 않는다. native 뒤 목 긴 접힘은 진단의 넓은 영역 기준 기존2/1 유지이며, 이전 A195의 좁은 cap 검사1/0과 다른 영역이다. 둘을 임상/해부학 허용값으로 쓰지 않는다.

독립 재열기에서 신체 남131643/여130552점의 전체 좌표·numeric skin·group·행렬과 각각163 rest bone·재질·변경 밖 삼각형 winding을 이전 web 원본과 동일하게 확인했다. 관절 경계 장식 재바인딩에서는 가중치5행이 최대 `5.960464477539063e-8` 차이를 보여, 모든 장식 skin byte 동일은 아니다. A212의 strict 실패와 A213의 실제 차이를 함께 보존했다.

## 실제 재실행

- 변경하지 않은 artist 원본: 전체121행/중립 제외118변형, 실패0·실제34PNG.
- 새 명시적 web 원본: 동일118변형, 실패0·실제34PNG.
- 새 GLB native 재수입 원본: 동일118변형, 실패0·실제34PNG.
- 실제 설치 Chrome: 3개/42.277590초, 외부 연결 차단·두 복제본 독립 변형·남녀 전환·503/그래픽 연결 상실 후 복구 통과. 카메라 호출0·사람 촬영0.
- 최종 native helper 양성2개·실제 detached zero-triangle 음성2개 통과. 합성 오류 fixture이지 사람 코칭/운동 검증이 아니다.
- 최종 helper3개 default Ruff·격리 Ruff·format, frontend Biome56파일·타입 검사 실제 exit0.

내보내기는 ratio1·최대8 influences, fin 정리 각각2개이며 armature-parent 경고5개를 보존했다. 승인된 코칭 animation은0개다. 실제 Chrome 합성180프레임 p95 남18.5/여18.2ms는 렌더 간격이지 사람 추적 지연·판정 정확도·목표 노트북 집단 성능이 아니다.

native19회 중6회 exit1이 있고 A206은 exit0이어도 불충분한 tiny-count guard 때문에 채택하지 않았다. A201 stdout은 **잘렸지만** 실제 생성 JSON과 compact A202 재실행 JSON은 byte 동일했다. AST 하네스의 초기 S102, enum/선택/JSON-key 오류와 old-checker 실패를 [실행 기록](execution-record.json)에 구분했다. 최종 코드 검수와 성공 실행이 앞선 실패를 지우지 않는다.

## 원본·GLB·실제 미리보기

Artist 입력은 [보존된 A195 원본](../candidate-a193-a195-review/a195/artist-candidate.blend) 그대로이며 새 artist를 제작했다고 세지 않는다.

- [새 web 원본](web-candidate.blend), [GLB 재수입 원본](web-candidate-roundtrip.blend)
- [남성 GLB](glb/bodyguard-male-candidate.glb), [여성 GLB](glb/bodyguard-female-candidate.glb)
- [새 GLB 정면 렌더](roundtrip-review/faceless-front.png)
- [남성 잔여 목 경계](roundtrip-review/faceless-side-male.png), [여성 뒤 목](roundtrip-review/faceless-body-back-female.png)
- [실제 남성 브라우저](browser/남성-two-models.png), [실제 여성 브라우저](browser/여성-two-models.png)

실제 새 PNG104개 중 직접 열람14개만 [실행 기록](execution-record.json)에 열거했다. 모든 컷을 직접 열람했다고 표시하지 않는다. 정면은 참조에 가까우나 측면의 머리 아래 단단한 경계와 웹 장식 마감 때문에 전체 외형을 통과시키지 않았다.

## 보존·검수와 다음 작업

[Manifest](copy-manifest.json), [재현 가능한 증거 검사](evidence-check.cjs). 실제184사본/76gzip·PNG104·새blend2·GLB2다. 이전 보호 대상1066개 중1065개의 live SHA는 불변이고 **내보내기 helper1개만 의도적으로 변경**했다. 이전 exporter의 정확한 원래 bytes와 다른 authoring/helper 입력의 버전을 사본으로 보존했다. 역사 checker는 live helper의 옛 SHA를 요구해 실패했으므로 현재 코드에서 역사 checker semantics가 다시 통과했다고 말하지 않는다. 새 검사는 역사 증거/다른 입력의 실제 hashes와 해당 코드 버전 snapshot을 검사하며 이전 archive/control/검사 기준을 수정하지 않았다.

다음은 뒤 머리–목 연결의 실제 접선/edge flow와 웹 관절 경계 장식을 국소 보완한다. 이번 명시적 면 분할을 유지하며 준비된 다음 전체 후보에 필요한 원본·GLB·변형·브라우저·외형 검증을 다시 실행한다. 실제 사람/시범·리타게팅·Gmail/Google 연결·2단계 전체·이후 출시 게이트는 미완료다. CEO의 기존1~6단계 완료 기준과 사전 승인/별도 승인 경계는 그대로다.
