# 목 접합부 위상 보완 — 실패·미채택

2026-10-10 · [Story](../../../stories/avatar-neck-integration.md) · Draft PR #108 · source main a466528

기존 전문 원본에서 국소 native 정리를 실행했으나 **남녀 전체 보호 검사를 통과하지 못했다.** 기존 파일은 불변이며 새 후보는 저장하지 않았다. 웹 화면·문구·모델·판정·카메라/운영 변경0이다. 2단계/전체1~6 완료가 아니다.

## 실제 결과와 다음 작업

입력 ce8887d 후보의 native 읽기 전용 검사에서 뒤쪽 작은 구간의 거의 반대로 접힌 면을 확인했다. 이것이 눈에 보이는 모든 patch의 원인을 입증하는 것은 아니다. 자동 collapse는 표면을 설계하는 대체물이 아니며 같은 ratio 반복을 하지 않는다. 다음은 기존 전문 메시의 접합부 국소 표면/연속 edge 흐름 재설계다. 자연스러운 신체 구조와 리깅 정확도·최종 외형 기준을 낮추지 않는다.

마지막 `repair-degenerate.json`의 male 행에서 좌표·raw skin·원래 보호 면·rest rig/PBR·손을 유지했고 닫힘0/winding0/tiny2, 국소 접힌 edge21→9를 관찰했다. 이후 **female 보호 polygon 검사에서3개 누락으로 exit1**이었다. 실제 면 연결 변경인지 FACE provenance 처리 차이인지 아직 분리하지 못했으므로 통과로 보지 않는다. report의passed=false/appearance_approved=false를 유지한다. male 부분 성공은 남녀 제작 성공이 아니다.

새 .blend 저장·독립 재열기·새 GLB 내보내기/재수입·전체118 기술변형·새렌더/Chrome·실제참여자/정확도·외형 평가·제품/운영 검증은 **미실행**이다. 저장 전 실패로 실행 순서를 중단했으며 이전 후보 검증을 이번 결과로 대신하지 않는다. 새 미리보기가 없고 기존 이미지가 후속 외형처럼 표시되지 않는다.

## 실패 보존

[Manifest](manifest.json)은37개 원시 artifact의 압축/raw SHA256을 기록한다. 초기 sandbox Blender 종료139/crash, 허용된 native 읽기 성공, 모든 저작 실행의 실제 소스·실패 보고서/로그를 보존했다. 그룹 RNA wrapper 무효화, INT point ID 보간, 보호 polygon/경계 provenance 혼동, 작은 면 증가와 최종 female 실패가 포함된다. collector의 첫 예상 개수 오류는 도구 transcript에 남아 있고 같은 소스로 재현한 `archive-count-failure.log.gz`도 보존했다. 압축파일 검사는 보존 검증이며 Blender 재실행이 아니다.

읽기 전용 native 검사에 실제 사용한[별도 실행 소스](inspection-executed.py)의SHA256은 `c9521e6275f346fdd9692d7ddae6a988650afdd594d6a9a77864aa68b9f3058a`다. 이는37개 압축 artifact와 별도로 보존한다. 신규저작기 Ruff/format, archive Biome·원시/압축37개SHA·현재실행소스2개 동일성·수정문서286개로컬링크·이전137개보존audit·`git diff --check`를 실제 통과했다. 이런 정적/보존 검사는 제작 실패나 미실행GLB/브라우저를 성공으로 바꾸지 않는다.

기존 ce8887d .blend와 이전137개 manifest는 덮어쓰지 않았다. 입력 SHA256 `ce8887d0421653774c05baf4ef3ed8d222250020cc770f63d398f6fc2c10343b`를 모든 실행 시작과 archive 전후에 확인했다. 마지막 실행은 저장 전 종료이므로 새 model byte가 없다. 원래 Draft #9의 파일/작업상태·A37 개발 기본값과 이전실패는 유지한다.

저작기는[repair_topology.py](../../../../assets/blender/integration-neck/repair_topology.py), archive는[archive_topology.mjs](../../../../assets/blender/integration-neck/archive_topology.mjs)다. native API 확인에만 [공식 API](https://docs.blender.org/api/5.0/bpy.types.DecimateModifier.html)와[Blender 원본 구현](https://github.com/blender/blender/blob/main/source/blender/bmesh/tools/bmesh_decimate_collapse.cc)을 사용했으며 전문성/의료 품질 인증으로 보지 않는다.

## 작성자 리뷰

코드/로그/원본SHA/최신diff를 security·correctness·performance·maintainability 관점에서 검토했다. 원본/기존증거 덮어쓰기와 제품 전달은 없다. 보호 구간은 원래 좌표/skin/폴리곤과 비교하고 native 재구성 점의 보간값을 원본ID로 주장하지 않는다. **P2: 남녀 보호 검사·외형 미완료. 병합 보류.** 통과하도록 false/skip/guard를 변경하지 않는다. 최소 문구 원칙은 유지한다.
