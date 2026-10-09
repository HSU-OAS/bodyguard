# S2.A1 — 최종 통합의 얼굴–목 표면 보완

2026-10-10 · 시작 main a466528 · FR-A-02/03/08 · codex/avatar-neck-integration · 이전 후보 기술 성공/추가 위상 보완 실패/외형 P2 미해결·미채택

## 순서와 범위

CEO의 10-05 지시대로 3단계 검수 목록/추천 입구, 4단계 계정·기록·데이터 관리, 5단계 준비 상태·백업 시험·라이선스, 6단계 현재 웹 통합/보안/자원 회귀의 독립 구현을 먼저 진행했다. PR #107까지 main에 포함됐다. 이제 이월한 D2-A의 국소 제작을 최종 통합·수정 구간에서 재개한다. **3~6단계 전체 통과를 선언하거나 외부 승인·실측·공개 UI 의존성을 건너뛰는 전환이 아니다.**

기존 Draft #9와 그 작업트리의 변경·삭제 상태는 건드리지 않는다. 최신 main의 별도 브랜치에서 보존된 A318 전문 메시 원본(SHA256 2eb274cfce046848eced56c12646869908259b2e6a04c6e188597959f7c48fff)을 읽고 새 후보만 만든다. 원래 A323~326의 실패/미실행과 A37 개발 기본값은 유지한다.

남녀 모두 최신 참조의 중성 백색 마네킹, 무의상, 얼굴–목 연속 연결, 자연 체형과 관절 구조를 유지한다. 앞 얼굴·쇄골·손·신체 전체·리그·가중치는 보호한다. 흐림/과노출/재질 변경으로 결함을 숨기지 않는다. 제품 UI·SDK 정책·카메라/판정·개인정보·운영 변경0이다. 웹 문구 최소화는 유지한다.

## 제작 판단과 하네스

기존 Y 방향만의 전역 곡률 풀이 반복 대신, Blender native Corrective Smooth의 길이 가중 국소 표면 정제를 전문 원본의 후두부–목 접합에만 적용한다. 전체 인체를 코드로 생성하거나 remesh하지 않는다. 기존 Y-only는 이전 후보의 구현 선택이지 출시 품질 조건이 아니었다. 이번은 마스크 안 XYZ의 작은 변위를 허용하되 기존 6mm 제작 예산·보호 영역·위상·리깅을 유지한다. 각도/시간/효과/사용자 정확도 기준을 바꾸지 않는다.

고정 제작값 factor0.3·iterations16·LENGTH_WEIGHTED·only_smooth이며 반복 sweep하지 않는다. 공식 Blender manual의 국소 vertex group/길이 가중 설명을 확인했고 실제 설치 Blender에서 API/결과를 검증한다. 최신 manual 직접 요청 실패도 기록한다. <https://docs.blender.org/manual/en/4.2/modeling/modifiers/deform/corrective_smooth.html>

1. 제작 전 입력 SHA·원래 점·면·그룹별 raw skin·각163 bone/rest/pose/world·PBR/속성·손을 기록한다. 마스크 밖 좌표 완전 동일, 마스크 안 유한 변위<6mm, 연결/닫힘과 전체 구조를 비교한다.
2. 새 원본 독립 재열기에서 입력과 같은 비교를 다시 수행한다. 기존 파일 덮어쓰기 거부도 실제 확인한다. 기존 원본과 증거 SHA는 전후 불변이어야 한다.
3. 기존 전체118 기술 변형/121행을 원본과 새 GLB 왕복본에서 실제 재실행한다. 기존 exporter/하네스는 exact 복사·해시로 구분하고 검사 완화 없이 사용한다.
4. 같은 조명·카메라의 남녀 앞/뒤/측면/기울임 실제 렌더로 대조한다. 숫자 성공만으로 외형을 통과시키지 않는다. 실제 Chrome의 GLB 로드·독립 두 rig·움직임·정리와 외형을 확인한다.
5. 실패는 원본 보고서/로그·제작 코드와 함께 보존하고 후속 검증 미실행은 명시한다. 아직 미완성인 모델을 제품에 적용하거나 최종 외형처럼 공개하지 않는다.

## 완료와 남은 의존성

이 Story는 국소 원본·GLB·변형·브라우저 보완이다. 외형 결함/새 P1/P2가 남으면 병합하지 않는다. 실제 사람·독립 관찰자·목표 노트북 정확도/부드러움·올바른 시범·웹 전체 코칭·권리/법무·외부 공급자/HTTPS·배포가 충족되지 않으면 D2-A와 전체1~6은 미완료다. 비용/계정/시크릿/운영 DB/배포/출시와 중요한 안전·개인정보 변경은 별도 승인이다.

testing-strategy로 보호/실패·기술/실제 사용 경계를 먼저 정하고, code-review로 저장·보호 영역·리소스·diff를 재검토한다. 결과는 실제 미리보기·완료 기능·남은 문제 중심으로 기록한다.

## 접합부 위상 보완 계약 — 2026-10-10

같은 Story의 미해결 P2 보완이며 처음 후보와 검증을 대체하지 않는다. 최신 main a466528/현재 Draft #108 HEAD 6acabc7을 읽기 전용 확인했다. 체크 없음·리뷰 없음·CLEAN/MERGEABLE이지만 외형 미달로 병합 불가다. 새 후보 ce8887d를 읽기 전용 검사한 결과 뒤 목 아래에 120°를 넘는 접힌 면이 존재하고, custom normals는 없었다. 첫 sandbox Blender 실행은 exit139, 별도 허용된 독립 native 실행은 exit0이었다. 실패/크래시 로그와 원본은 보존한다.

native Decimate collapse로 기존 전문 메시의 뒤쪽 국소 연결만 정리하는 후보를 만든다. 해당 vertex mask는 신장 기준 y>0, |x|<0.10, 0.82<z<0.94다. 고정 제거 예산은 해당 영역 triangle 수의30%이며 전신 ratio로 환산한다. 얼굴/앞면/손·나머지 신체의 좌표·raw skin·polygon 연결과 재질·163 rest bone/pose/world를 exact 보호하고, 원래 손 점은 삭제 없이 index만 재매핑한다. 이는 신규 단순 인체 생성이나 전체 remesh가 아니다. native 공식 구현의 zero-weight edge 보호를 확인하되 실제 설치 결과로 다시 검사한다: [Blender native 구현](https://github.com/blender/blender/blob/main/source/blender/bmesh/tools/bmesh_decimate_collapse.cc), [공식 API](https://docs.blender.org/api/5.0/bpy.types.DecimateModifier.html).

하네스는 origin point ledger의 모호함/보호 영역 삭제, 비유한 값, 기존 표면에서6mm 이상 이탈, skin 합 오차0.01 이상, 보호 polygon 변경, 열린 면/뒤집힘/작은 면 증가 또는 접힌 면 감소 없음에서 실패한다. 위상 수가 달라지므로 예전 exact 전체 vertex 수를 통과 주장하지 않는다. 그 이후 독립 재열기·기존118 기술 pose·GLB export/왕복·같은 조건 실제 렌더·Chrome를 재실행한다. 실제 외형 평가는 별도다. 필수 검사나 외형 실패 시 미채택/미완료/Draft 유지, 공개 제품/의료 판정/운영 변경0이다.

Native collapse의 INT point 속성은 index 유지가 아니라 보간이다. 첫 저장 전 검사에서 전체 ledger 중복을 발견하고 실패했다. 이를 원본 점으로 반올림하지 않는다. 보완된 저작기는 native 작업 마스크의0인 점만 exact origin ID로 검증하고 재구성 점은 -1로 명시한다. 보호점 origin의 중복/누락·좌표/skin/polygon 변경 검사는 그대로 강제한다. 재구성점의 변위는 실제 원본 표면 BVH로 검사하며 이전 실패 로그/실행 소스를 유지한다. 첫 그룹 wrapper 오류도 저장 전 실패로 보존했다.

보호 면 비교는 male의90개 원래 다각형이182개 삼각형으로 남은 native 내부 triangulation을 검출했다. 실패와 상세 차이를 보존한다. 보완은 두 인접 면의 모든 점이 보호점이고 원래 edge 집합에 없는 native 추가 diagonal만 BMesh dissolve로 제거한다. 원래 edge/점은 제거하지 않으며 원래 polygon/material/shading exact 검사를 유지한다. 결과 없이 성공으로 간주하지 않는다.

그 뒤 남은 native 추가 보호 면2개는 원래 면 집합에 없는 면만 제거했다. 작은 면적 가정으로 제거한 중간 시도는 실패했고 기록을 보존했다. 보호점/skin/원래 polygon exact는 통과했으나 첫 male의nonmanifold6/tiny3에서 저장 전 실패했다. 다음 보완은 기존 exporter와 동일한 fin 조건(삼각형·boundary2·다른 edge의face3·면적<1e-6)을 **재구성 영역 origin -1 점으로만 이루어진 면**에 제한 적용하고, 원래 보호점과닫힘·winding·작은 면 증가 방지 조건을 다시 강제한다. native added 보호 면/edge의 원본 복원과 국소 fin 제거는 전체 remesh나 임의 hole-fill이 아니다.

원래 polygon 보호는 원래 전체 보호 면의 provenance로 비교해야 한다. Collapse 후 모든 점이 보호점인 새 삼각형2개는 원래 일부 점이 편집 영역이던 경계 면에서 나온 것으로, 이를 보호 면의 추가로 오분류해 지운 중간 실행이nonmanifold6을 만들었다. 실패는 유지하고 native FACE 원본 ID를 추가해 원래 전체 보호 면은exact 복원·비교하고 경계 면은 국소 편집 범위로 구별했다. 결과nonmanifold0/winding0, 원래 보호 polygon exact였으나 tiny2→3에서 실패했다. 다음 보완은 기존 exporter의 native dissolve_degenerate를 origin -1 국소 edge에만 dist1µm로 적용한다. 작은 면 증가 guard/나머지 보호 조건은 유지한다.

### 위상 보완의 종료 결과

[실제 실패/실행 소스/검증 미실행](../review/avatar-neck-integration/topology-attempt/README.md)을 보존했다. 마지막 실행은 male의보호점/raw skin/원래 보호 면·rest rig/PBR/손 index/닫힘0/winding0/tiny2를 통과하고 접힌 edge21→9를 관찰했다. **Female 보호 면 비교에서3개 누락으로 exit1**이었다. 그 누락이 실제 연결 변경인지 native FACE provenance 처리 문제인지 아직 분리 검증하지 않았으며 임의로 정상 처리하지 않는다. 전체남녀 제작 실패·새원본 저장0·새GLB/독립재열기/전체변형/렌더/Chrome 미실행이다. 이전 ce8887d 후보의 실제 성공을 이번 통과로 복사하지 않는다.

자동 collapse/같은ratio sweep은 채택하지 않고 종료한다. 다음 보완은 참조를 기준으로 접합부의 표면과 연속 edge 흐름을 전문 도구에서 직접 재설계하는 국소 retopology다. 기존 원본을 고치는 대신 별도 원본에서 보호 영역/skin/rig·목과어깨 변형·GLB/Chrome/실제외형 검사를 다시 강제한다. 접힌 면 관찰이 전체 눈에 보이는 patch의 원인을 모두 입증한 것은 아니다. 외형 P2/전체1~6 조건과 별도 승인 경계는 그대로다.

## 국소 quad 표면 재설계 계약 — 2026-10-10

자동 collapse는 종료한 상태로 유지한다. 후속은 기존 ce8887d 전문 body/head에서 뒤 목–어깨 면만 native Grid Fill의 사각형 위주 edge 흐름으로 재구성한다. [Blender5.1 BMesh API](https://docs.blender.org/api/5.1/bmesh.ops.html)·설치된 native operator를 확인한다. 전신을 primitive로 만들거나 전체 remesh/원본 덮어쓰기를 하지 않는다. 앞면의모든점/손·patch밖 polygon/좌표/raw skin·rest rig/world/PBR를exact 보호한다. 교체되는 점의skin은 기존 전문 표면의triangle/barycentric field로 전송하고, 보호점과손은 삭제하지 않고index만 재매핑한다. 새점의역사ID는-1, 기존point ledger와history 배열은새index에 맞추되이전 원본은보존한다.

읽기 전용 경계검사는뒤쪽의모든점이범위안인면만사용했다. 남성685점의단일loop, 여성717점/719edge의두접촉점을확인했다. 접촉점주변은선택면을줄이는방식으로정리하며앞면으로확장하지않는다. 홀수loop에는native 한triangle transition을두고나머지를quad로만든다. 새regular grid를원래뒤표면에맞춘뒤고정12회의nativefairing을적용한다. 기존접힌삼각형의smooth강도/ratio를반복하지않는다.

저작하네스는불규칙/복수경계·nativefill실패·새표면의기존표면에서6mm이상이탈·sourcepoint보호누락·비유한값/skin합오류·원래외부polygon/리그/손변경·닫힘/winding/tiny악화에서실패한다. 피부전송이나숫자성공만으로해부학/외형을통과시키지않는다. 새원본독립재열기/118기술변형·GLB/왕복·동일조명실제렌더/Chrome와외형검수는후속필수다. 실패시저장전중단/미실행기록·Draft유지하며임상판정·공개웹·운영은변경하지않는다. 사진/웹캠실측/올바른시범·D2/전체1~6완료기준과별도승인경계는그대로다.

### Quad 제작의 저장 전 검사와 가중치 전송

초기 네 번의 native 실행은 모두 저장 전 실패했다. CustomData 생성 뒤의 BMesh 참조 유효성, 보호 경계 유지, Grid Fill의 명시적 span을 각각 확인했으며 이전 실패 소스와 로그는 보존했다. 명시적 span171의 남성 표면은 생성됐으나 자체 barycentric 가중치 검사에서 중단됐다. 이 실패를 통과로 바꾸거나 오차 허용치를 높이지 않는다.

후속은 Blender native Data Transfer의 POLYINTERP_NEAREST로 읽기 전용 전문 원본의139개 그룹을 새 점에만 전송한다. 임시 복제 원본과 새 점 전용 mask는 저장 전 제거한다. 기존 점의 raw skin·좌표·외부 polygon·163 rest bone·PBR exact 검사는 그대로 유지하며 새 점의 원본 표면 거리6mm와 skin 합0.01 조건도 바꾸지 않는다. 기존 자체 전송 실패를 보존하며 native 전송의 실제 결과와 후속 변형/외형 검사를 별도로 판단한다. [Blender5.1 공식 Data Transfer API](https://docs.blender.org/api/5.1/bpy.types.DataTransferModifier.html)

### Quad 실행 구간의 종료 결과

[실제 실패·소스·미실행 경계](../review/avatar-neck-integration/quad-attempt/README.md)를 보존한다. unbound fairing의6mm 이탈과 전신 Shrinkwrap 대상의 국소 거리 실패를 기록한 뒤, 기존 선택 면만 참조하는 native surface fit을 적용했다. 맞추기 전28.1mm/맞춘 후2.45µm는 다른 제작 상태이며 첫 실패나 외형을 통과 처리하지 않는다. [공식 Shrinkwrap API](https://docs.blender.org/api/main/bpy.types.ShrinkwrapModifier.html)를 확인했고5.1 직접 웹 요청의402 실패도 구별한다. 실제 설치5.1.1 실행 결과로 판단했다.

Native skin 전송의 보호점 literal0 항목 추가를 발견했다. 모든 보호점의0 아닌 값 exact를 먼저 확인한 뒤 기존에 없던0만 제거했고 최종 raw 배열 exact는 유지했다. 마지막 남성 실행은 앞면·손·외부 좌표/polygon/raw skin·rest rig/PBR와닫힘0/winding0을 확인했지만 tiny2→610으로exit1이었다. 여성 제작·새원본 저장·GLB/독립재열기/전체변형/렌더/Chrome는미실행이다. 전체 제작 실패·미채택·Draft #108/Story/D2/전체1~6 미완료다.

단일 복잡한 경계의Grid Fill은 이 구간에서 종료한다. 다음은 후두부·목·승모근 구간별edge 연결/경계 간격을 전문 도구에서 설계하는 보완이며, 자동smooth/ratio/tiny 허용치 완화로 반복하지 않는다. 작은 면 증가의 원인을 해당설계로 추정하는 것은 가설이므로 실제 형상·변형으로 확인해야 한다. 기존 모든파일/실패·실측/올바른시범/승인공개UI·SDK/외부운영과 별도승인 경계는 유지한다.

## 실제 결과

### 구간별 제작 계약 — 2026-10-10

앞선 단일 Grid Fill 실패를 보존한 뒤 구간 경계를 읽기 전용으로 검사했다. 첫 검사에서 rig-local과 body-local 좌표를 바로 비교한 배치를 사용했으나, 실제 world matrix의 남성0.974273/여성1.029914 축척 차이를 확인했다. 후속 검사는 `body.world.inverse × rig.world`로 같은 메시 공간에 옮겼다. 원본 rest bone/pose/world는 변경하지 않았다. 첫 검사도 보존하며 경계 배치나 전체 리깅 승인 증거로 사용하지 않는다.

후속 구간은 이 메시 공간의 neck01 시작점과 neck02 끝점을 제작용 기준으로 삼아 상부 연결·목·좌/우 어깨 연결을 분리한다. 이는 올바른 운동 각도나 실제 사람의 해부학 판정이 아니다. 각 구간의 경계점과 새 quad의 시작 모서리·열 수는 실제 기하에서 정하며, 기본 vertex index에서 임의로 시작하지 않는다. [Blender 공식 Grid Fill](https://docs.blender.org/manual/en/5.0/modeling/meshes/editing/face/grid_fill.html)의 모서리·span 설명과 설치5.1.1 동작을 대조한다.

구간별 새 파일은 앞선 검사를 실제 통과한 입력 SHA에만 이어서 만든다. 원본/이전 파일 덮어쓰기, 전신 생성·remesh, 접힌 원래 표면으로 재투영해 숫자를 맞추는 방식, smooth/ratio sweep은 하지 않는다. Native quad interpolation으로 만든 새 표면의 원본 거리6mm·가중치 합0.01·외부 좌표/polygon/raw skin·rest rig/PBR·손 보존과닫힘/winding/tiny 악화 방지를 그대로 강제한다. 한 구간에서 실패하면 전체 후보로 채택하지 않고 해당 실행 구간의 실패를 정리한다.

모든 구간을 통과한 뒤에만 독립 재열기·118 기술 pose·GLB/왕복·동일 조명 실제 렌더·Chrome·외형을 판단한다. 부분 원본 저장이나 하나의 구간 성공은 최종 외형/코칭/D2/전체1~6 완료가 아니다. Blender MCP addon 상태 조회는 연결 오류였으며 live 사용자 작업은 건드리지 않고 독립 native 실행을 사용한다. UI 최소 문구·실측/시범·SDK/개인정보/운영·별도 승인 경계는 유지한다.

#### 안쪽 경계 연결띠의 제작 계약

상부 연결의 첫 native curvature 실행은 원래 표면에서7.0775mm 이탈해 저장 전 실패했다. 같은 실패 상태를 중립 조명에서 실제 렌더한 결과 남성 뒤쪽에 굴곡이 남았다. 여성은 이 실행에서 편집하지 않은 비교 원본이며, 성공 후보가 아니다. 후속 simple interpolation도6.1030mm로 실패했다. 허용 거리6mm를 높이지 않았다. 모서리 검사에서 지정한4개 중2개 대신 다른 점이 native quad 모서리로 쓰였으며, 맞은편 경계의 점 수 차이를 확인했다. 실행 소스/실패/진단 렌더를 보존한다.

후속은 원래 불균등 경계를 그대로 둔 채 **새 안쪽 경계만 맞은편 점 수가 같은 구조**로 만들고 Blender native Bridge로 연결띠를 잇는다. [공식 Bridge Edge Loops](https://docs.blender.org/manual/en/5.1/modeling/meshes/editing/edge/bridge_edge_loops.html)의 서로 다른 경계 점 수 연결을 참고하되 실제 설치 결과로 판정한다. 연결띠는 원래 깨끗한 경계의 누적 길이를 따르는 새 점에만 제한하고, 안쪽 native simple grid의 모서리 표식4개가 실제 모두 일치해야 한다. 새 grid 전체를 접힌 원래 면으로 재투영하거나 smoothing으로 거리 검사를 맞추지 않는다. 보호점·6mm·skin·tiny·닫힘·리그 등 이전 조건은 그대로다. 실패하면 해당 제작 구간을 종료·보존하며 새 원본/GLB/전체 변형/Chrome 미실행을 구별한다.

#### 이 실행 구간의 종료 결과

[실제 구간별 실패·진단 렌더·보존](../review/avatar-neck-integration/segmented-attempt/README.md). 마지막 연결띠 실행은 원래 경계218점·안쪽36/55/36/55를 구성했으나 native 실제 모서리 표식0/0/1/3이 지정1/2/3/4와 달라 exit1이었다. 저장0·여성 제작/새 GLB/독립재열기/전체 변형/Chrome/이 연결띠 렌더 미실행이다. 기존 curvature 상태의 진단8컷을 새 후보의 성공/외형으로 쓰지 않는다. 거리/tiny/raw skin/rig 기준은 그대로이며 Draft #108의 외형 P2는 미해결이다.

설치5.1.1의 `bmesh.ops.grid_fill`·`bridge_loops` API를 별도 native에서 읽기 전용 확인했다. 닫힌 경계의 자동 순회 방향은 [동일 버전 native 구현](https://github.com/blender/blender/blob/v5.1.1/source/blender/editors/mesh/editmesh_tools.cc)과 대조했다. 다음은 두 열린 맞은편 경계를 직접 지정하는 제작 설계이며 이번에는 미실행이다. 같은 span/offset을 반복하거나 모서리 guard를 삭제하지 않는다. 보호·실제 외형/실측/시범·공개 UI·SDK/운영 및 전체1~6 필수 조건은 유지한다.

### 명시적 두 경계 제작 계약 — 2026-10-10

기존 구간별 실패와42개 증거는 동결한다. 별도 `author_explicit_patch.py`에서 native `grid_fill`에 맞은편의 열린 두 경계를 직접 지정한다. 자동 span/offset·선택 순회에 의존하지 않고 새 안쪽 경계의 나머지 두 면만 연결 경로여야 한다. [설치 버전의 공식 native 구현](https://github.com/blender/blender/blob/v5.1.1/source/blender/bmesh/operators/bmo_fill_grid.cc)을 GitHub API로 읽기 전용 확인했다. web 직접 요청은 cache miss였으며 성공으로 세지 않는다.

같은 네 모서리1/2/3/4·6mm·가중치 합·tiny·닫힘/winding·보호점/원래 면/손/raw skin·rest rig/PBR 조건을 유지한다. 격자 전체의 원래 접힌 표면 재투영/전체 인체 생성·remesh·스무딩 sweep은 하지 않는다. 남녀 저장 전 통과 뒤에도 독립 재열기·전체118 기술 pose·GLB 왕복·동일 조명 실제 외형/Chrome·실측/시범과 전체1~6 기준은 별도로 충족해야 한다. 실패 시 새 원본을 저장하지 않고 source/로그/JSON을 보존한다. 공개 웹/카메라·임상 판정·SDK·개인정보·운영 변경0·UI 최소 문구 원칙을 유지한다.

명시적 simple 격자는 실제 네 모서리1/2/3/4를 따랐지만 첫 거리6.031mm에서 실패했다. 저장 금지 진단 모드에서 전체 새 점을 읽은 결과 최대22.502mm·6mm 이상1416점이었고, 실제 뒤/측면 렌더에서도 후두부의 부피가 평탄화됐다. 첫 실패값은 전체 최대가 아니다. 단순 허용치 상향이나 core 재투영으로 해결하지 않는다.

후속 `author_curved_patch.py`는 경계/모서리 연결과 보호 조건을 고정한 채 native의 경계 곡률을 사용하는 보간 알고리즘을 적용한다. 공식 구현은 simple의4방향 가중 평균과 경계 단면 변환 보간을 구별한다. 실제 후두부 부피가 유지되는지는 가설이므로 별도 원본 저장 전 검사와 외형으로 확인한다. 이 bounded 알고리즘 비교는 강도/span/offset/허용치 sweep이나 이전 실패 반전이 아니다. 기존 실행 소스·진단 렌더와 모든 실패를 보존하며 최종1~6/별도 승인 기준은 유지한다.

#### 명시적 두 경계 구간의 종료

[실제 형상·실패·보존](../review/avatar-neck-integration/explicit-attempt/README.md). 곡률 실행은 남성 최대4.243mm·앞면/손/외부/raw skin/rest rig/PBR·닫힘0/winding0을 확인했으나 tiny2→3으로exit1이었다. core 면180개의 뒤틀림 관찰과 실제 뒤/측면 접합 주름도 남는다. 두 진단의 실제16PNG는 실패 상태이며 여성은 편집하지 않은 원본이다. 저장 금지 진단/원래 실패 exit1·원본 보존을 확인했고, 새 Blender 저장/여성 제작/GLB/독립재열기/118 기술 pose/Chrome는미실행이다. Draft/외형P2/Story/D2/전체1~6미완료다.

두 경계만의 simple/curvature 보간은 여기서 종료한다. 다음은 내부 단면·접선·전문 원래 형상의 표면 흐름을 기준으로 조형하기 위한 읽기 전용 확인이다. 거리 검사만으로 새 격자를 채택하거나 tiny 하나만 지워 외형을 통과시키지 않는다. 로컬 addon 연결은 실제 오류로 비차단 요청했으며 사용자 장면·비용/새 계정/시크릿/telemetry를 변경하지 않았다. 독립 작업·최소 문구·전체1~6 필수 기준과 별도 승인 경계는 유지한다.

#### 원래 전문 형상의 내부 단면 확인

[읽기 전용 실행·보존](../review/avatar-neck-integration/reference-sections/README.md). 별도 private BMesh의 native plane cut으로 남녀 각각5개 내부 단면을 검사했고 모든10개에서 하나의 닫힌 단순 loop를 확인했다. 실제 native exit0·입력 SHA 불변이며 원래 장면 되쓰기/저장·새 표면 저작0이다. 같은 메시 공간의 뒤쪽 깊이는 남성20.368~48.955mm/여성5.305~45.604mm였다. 이 원본 기하 관찰은 내부 부피를 참고하는 다음 설계의 자료이며 사용자 좌표·정상 범위·코칭 각도·외형/제작 승인이 아니다. 이전 실패/42개 manifest는 변경하지 않고 새5개 증거를 별도 보존한다. 내부 단면 기반 저작·원본/GLB/변형/Chrome·실측/시범은 여전히 미실행이고 외형 P2/전체1~6 완료 조건은 유지한다.

CEO의 최소 문구 요구도 유지한다. 제품 화면은 아바타 중심, 동작명·핵심 피드백·명확한 버튼 문구만 짧게 두고 자세한 설명은 펼쳐보기로 제공한다. 안전·카메라 권한·개인정보 고지는 생략하거나 모호하게 줄이지 않는다. 이번 저작 보완은 공개 화면을 변경하거나 미승인 화면 구성을 확장하지 않는다.

### 원본 단면 기반 표면 제작 계약 — 2026-10-10

최신 main a466528·Draft #108 HEAD48cf6f4/체크 없음·CLEAN을 재확인했다. 이전 명시적 simple/curvature 보간과 실행 소스·모든 증거는 동결한다. 새 `author_sectioned_patch.py`는 원본 내부 단면으로 부피를 안내하고 native Grid Fill은 연결 생성에만 사용한다. 상부 후두부에 한정하며 다른 목/어깨 구간은 같은 모델링 원리를 검증한 뒤 별도로 다룬다. 전체 인체를 코드로 만들거나 전문 구조를 지우지 않는다.

원래 전문 입력ce8887d의 private BMesh에만 native plane cut을 적용해 각 새 행의 실제 뒤 단면을 읽는다. 하나의 닫힌 loop·뒤 단면의 단일 단조 열린 곡선·접힌 원래 면을 가이드로 쓰지 않는 조건을 강제한다. native quad의 그래프 거리를 통해 행/열을 확인하고 각 점을 해당 원래 곡선의 깊이에 놓는다. 경계만 보간하거나 접힌 표면에 core 전체를 재투영하지 않는다. 앞면/손·보호 외부 점/polygon/raw skin·rest rig/world/PBR exact·6mm 제작 예산·가중치 합0.01·닫힘/winding/tiny 악화 방지와 **새 core의 모든 면이 뒤쪽을 향하는 조건**을 유지한다. 이 기하 조건은 의료적 판정 임계값이 아니다.

저장 금지 진단은 통과 여부와 무관하게 모델을 저장하지 않는다. 원본/이전 후보는 덮어쓰지 않는다. 남녀 부분 저작이 통과해도 전체 아바타 완성이 아니며, 독립 재열기·전체118 기술 pose·GLB/왕복·실제 외형/Chrome·실측/올바른 시범·D2와전체1~6 검증은 별도 필수다. 미완성 후보는 공개 제품에 적용하지 않는다. MCP 연결은 이번에도 실제 오류이고 live 사용자 장면/계정·비용·시크릿·telemetry 변경0이며 독립 native 제작을 진행한다. UI 최소 문구와 별도 승인 경계는 유지한다.

#### 네 모서리 대응 연결띠 보완 계약 — 2026-10-10

이전 부분 후보7481c5f와 실행 소스/30개 증거는 동결한다. 별도 `author_sectioned_ribbon.py`에서 원래 입력ce8887d를 다시 열고 기존 native 단면 부피를 유지한다. 네 모서리 대응을 고정한 네 쌍의 열린 경계를 native Bridge로 잇는다. [동일 버전 공식 구현](https://github.com/blender/blender/blob/v5.1.1/source/blender/bmesh/operators/bmo_bridge.cc)은 열린 경계와 점 수 차이를 처리하지만 닫힌 경계에는 자동 최적 회전이 적용됨을 GitHub API로 확인했다. web 직접 읽기는 cache miss였다. 실제 설치5.1.1의 별도 private mesh probe로 지원과 양끝 대응을 검증한 뒤 전문 메시에서 실행한다.

연결띠 전체의 뒤 방향·원래와 같은 X/Z2178개 표본의 추가 뒤 교차 금지 조건을 저장 전에 추가한다. 이 제작용 표본 검사는 전체 교차 없음이나 임상 정확도 증명이 아니다. 원래 보호 영역/외부 polygon/raw skin/리그/history/PBR·6mm·skin 합0.01·tiny/닫힘/winding 기준은 유지한다. 새 파일 저장/독립 재열기/실제 고정 외형·GLB/전체 변형/Chrome는 각각 실제 실행 결과로 구별한다. 실패 시 저장 전 중단·원래 실패 보존·Draft 유지이며 전체 아바타/1~6 완료로 표시하지 않는다. 공개 제품·카메라/SDK/운영 변경0·최소 UI 문구·별도 승인 경계는 유지한다.

#### 원래 투영 영역 기반 연결띠 계약

네 쌍의 native Bridge 실행은 저장 전에 남성 연결띠 방향 검사 실패(exit1·저장0)로 종료했다. 모서리 대응은 맞았지만 Y음수 면68·새 뒤 중복 교차118개가 남았다. 저장 금지 재현에서 새 점19개가 원래 교체 영역의 X/Z 다각형 밖에 있음을 확인했다. 양끝 대응만이 결함 원인의 전부는 아니다. 이 실패와 실행 소스·진단8컷은 별도 보존하며 여성은 편집하지 않은 원본 비교다.

별도 `author_sectioned_domain.py`는 원래 선택 경계가 각 행과 만나는 두 X값을 native 전문 단면의 폭에 함께 반영한다. 각 새 행은 원래 교체 영역 안으로 제한하고, 전체 연결띠는 native `triangle_fill`의 투영 영역 채움으로 만든다. 별도 private mesh probe에서 실제 내부 구멍 보존·입력 좌표 exact·면적과 뒤 방향을 확인했다. [공식 API](https://docs.blender.org/api/5.1/bmesh.ops.html#bmesh.ops.triangle_fill) 직접 요청의402 오류와 설치된5.1.1 actual doc/실행은 구별한다. 교체 영역/앞면/원래 경계/리그·6mm/skin/tiny/닫힘·추가 뒤 교차 금지와 외형/전체 변형/GLB/Chrome/실측·전체1~6 기준은 그대로다. native 연결 방식 변경이 합격이나 출시를 뜻하지 않는다.

투영 영역 시험은 원래 행이 단일 구간이라는 가정에서 exit1·저장0으로 중단했다. 별도 `author_sectioned_interior.py`는 여러 구간을 무시하거나 min/max로 합치지 않고, 원래 X/Z 다각형의 짝지은 교차 중 x=0을 포함하는 유일한 실제 내부 구간만 각 행의 폭으로 쓴다. 관찰된 모든 구간도 보고서에 남긴다. 새 점 전체와 새 면 중심의 원래 투영 내부 포함 조건을 추가한다. 이는 임계값/원본 보호를 완화하는 변경이 아니라 잘못된 단일 구간 가정 대신 실제 원래 내부를 쓰는 설계다. 기존 native 단면 단순 loop/단조/기존 접힌 면 제외·뒤 방향/교차/tiny/6mm/raw skin/rig·외형/전체 검증은 유지한다. 이전 시험과 여성 미실행은 보존한다.

읽기 전용 원본 경계 검사에서 남성의 전역 zmax 기반 마지막 행이23개 조각으로 나뉘며 중앙 내부가 없음을 확인했다. `inspect_patch_domain.py`는 남녀 원본 경계의 아래쪽 arc 최고점/위쪽 arc 최저점으로 공통 내부 높이 구간을 읽었고, 모든 새37/32개 행에 유일한 중앙 내부가 있었다. 검사 첫 실행의 lint 변수 바인딩 오류는 보완했으며 원래 보고서/실행 소스는 보존하고 별도 native 재실행을 한다. 이 원래 기하 관찰을 새 표면 합격으로 세지 않는다.

별도 `author_sectioned_clear_band.py`는 이 실제 원래 arc의 안쪽 높이를 core span으로 사용한다. 원래 교체 영역·보호 경계/원본·메시 부피/리그를 바꾸지 않고 core 주변 연결띠를 native 투영 영역 채움으로 잇는다. 원래 전문 단면·중앙 내부·새 점/면 중심 내부 포함·뒤 방향/추가 중복 교차/tiny/6mm/raw skin 등 보호 조건은 유지한다. 실패한 이전3개 저작기를 고쳐 성공으로 바꾸지 않으며 실행 결과·외형·후속 전체 검증을 따로 기록한다.

#### 연결띠 보완 구간의 실제 종료

[실제 실패 외형·원래 경계·소스/로그·미실행](../review/avatar-neck-integration/ribbon-attempt/README.md). 네 쌍 연결·투영 단일 구간·중앙 내부·공통 내부 높이의4개 저작 시험은 모두 저장 전 exit1로 종료했다. 마지막 시험은 새 점2072개 전부 내부/core1980면 뒤 방향·거리8.942µm를 관측했지만 면 중심4개가 원래 내부 밖/연결띠 Y음수12·뒤 중복 교차48개가 남았다. 실제 실패 렌더16컷을 모두 직접 검수했고 여성은 편집하지 않은 원본 비교다. 새 모델 저장0·skin/최종 보호·독립 재열기/GLB/118 pose/Chrome 미실행이며 이전 성공을 복사하지 않는다.

읽기 전용 원래 경계의 최종 native 재실행은 exit0이고 남녀37/32행의 공통 내부를 확인했다. 이 관찰과 private mesh native probe를 인체/외형 성공으로 세지 않는다. 처음 검사의 lint 변수 바인딩 오류와 첫 보고서/소스는 보존했다. MCP 연결은 이번에도 실제 오류이고 사용자 장면/계정/비용/시크릿/telemetry 변경0이다. 다음은 원래 투영 경계와 설치 native 제약 삼각분할의 보존 조건을 확인하는 설계이며 이번에는 미실행이다. 동일 허용치/원본·품질 보호·최소 UI 문구·외형 P2/전체1~6/별도 승인 경계를 유지하며 Draft 병합은 하지 않는다.

#### 단면 제작 구간의 실제 결과

[부분 원본·실제 외형·성공/실패·검증 미실행](../review/avatar-neck-integration/sectioned-attempt/README.md). 남녀 각각37/32개 native 단면 행의 부분 제작과 독립 재열기는 실제 exit0였다. 새 점의 원래 선택 표면 거리 최대1.122/1.255mm·앞면/손/외부 좌표/polygon/raw skin/history/rest rig/world/PBR exact·닫힘0/winding0/tiny2→2/0→0을 확인하고 새 부분 후보7481c5f를 저장했다. 기존 입력/모든 실패 증거는 불변이며 전체 아바타 저작 완료가 아니다.

실제 고정 조건 남녀8컷을 모두 검수한 결과 머리 부피는 유지됐으나 연결띠에 점상 접합선이 남아 외형 P2다. 읽기 전용 native 검사에서 원래 뒤 표면 중복 교차0 대비 새 남성45/여성44개·최대3회와 연결띠 Y음수 면60/66개를 관찰했다. 원래 선택 표면 거리나 닫힘만으로 접힘이 해결된 것은 아니다. 다음 보완은 네 모서리 대응을 고정한 구간별 연결띠 설계와 교차 방지 검사이며 아직 미실행이다. 원래 목·어깨 마감도 미완료이며 전체 결함의 원인을 모두 규명했다고 주장하지 않는다.

원래 입력의 후보 거부/저장된 후보 덮어쓰기 거부 음성 시험은 실제 exit1이고 바이트 불변이다. 부분 제작/재열기·8렌더·읽기 전용 검사를 GLB/왕복/전체118 pose/Chrome/실측/올바른 시범 완료로 세지 않는다. `engineering:code-review`는 연결띠 외형 P2로 Request Changes, Draft/병합 보류다. 공개 제품·임상/SDK/개인정보·운영 변경0·UI 최소 문구·전체1~6 필수 기준/별도 승인 경계는 유지한다.

[Draft PR #108](https://github.com/HSU-OAS/bodyguard/pull/108)에 source d93e0b5와 실제 검증·새 편집 원본/GLB를 기록했다. 외형 P2 때문에 병합하지 않는다. 새 worktree는 app 호출의 Not a git repository/수동 worktree 미관리 판정으로 일반 Git worktree를 사용했고, PR 앱 첨부는 기존100개 한도 때문에 실패했다. 기존 첨부를 지우거나 등록 성공으로 표시하지 않는다.

[실제 원본/GLB·미리보기·기술 성공/외형 실패·보존 증거](../review/avatar-neck-integration/README.md)에 기록했다. 원본 보호/독립 재열기·원본과 GLB 왕복 각각118 기술 pose/121행·34PNG, Chrome155 남녀 두 rig/전신 움직임/종료를 실제 실행했다. 같은 조건 전후 검수에서 뒤 목–어깨 패치/관절 마감은 미달이므로 **외형 P2·Story 미완료·새 후보 미채택·Draft PR/병합 보류**다. 모델링/리깅 정답·원본/실제 사람의 자세 정확도나 출시 완료를 증명하지 않는다.

기존 최신 참조/여성 무의상 요구를 원래 제작 계약에 기록했다. 공개 JS/CSS/문구와 운영은 unchanged, 기존 Draft #9 HEAD/1959개 작업 상태/입력 SHA를 보존했다. 미실행 API/SQL/전체 DOM/실제 사람/공급자/HTTPS·새 파일 원본의 expert 검토는 명시했다. 다음 보완은 같은 smooth 강도 반복이 아니라 실제 남은 접합·변형 결함의 전문 메시 연결/표면 설계여야 한다.
