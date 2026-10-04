# A266–A267 — 잔여 목 연결부·후두부 읽기 전용 대조

2026-10-04 · **모델 변경0·미채택·A-02/A-08 P2 미해결·Draft PR #9 미병합**.
최신 CEO 사진의 얼굴/목·연속 연결·남녀 무의상 공통 백색·필요 구조/리깅 정확도와 기존 1~6단계/승인 기준을 유지한다.

[실행 전 단면 계약](readonly-contract.md.txt.gz)·[법선 가설 계약](corner-normal-contract.md.txt.gz) 뒤 별도 background Blender5.1.1에서 실제 실행했다.
원본 A250/A264 파일 SHA와 전후 숫자 좌표·skin/위상/groups/rest/pose/world/material 이름의 signature를 확인했다.
사용자의 실행 중 Blender UI나 개발 기본 A37은 변경하지 않았다.

## 실제 결과와 한계

- A266: 기존 두 파일×남녀의24개 단면/1800 BVH 첫 surface ray를 실제 관측했다.
  머리 꼭대기 옆 silhouette 밖 등을 포함해 miss48을 그대로 기록했다. 관측한 첫 hit의 backfacing0은 전체 표면/임상 정상 판정이 아니다.
- 높이 .942 이상의12개 동일 앞/뒤 단면에서29샘플씩 정확히 같았다(해당 miss도 비교 포함).
  높은 머리 표면은 A264 국소 정제로 바뀌지 않았다. 일부 높은 단면은 중앙이 더 볼록한 depth라 “전체 후두부가 오목해서다”라고 단정하지 않는다.
- 잔여 뒤 목 transition의 접선 변화가 좌우에서 크게 남았다.
  남성 오른쪽 .884에서60.332→60.616°, 여성 오른쪽 .882에서57.179→57.179°;
  중앙 일부31.482→27.853°/40.875→33.582° 감소를 전체 좌우 외형 개선으로 확대하지 않는다.
  수치는 메시 단면 진단이며 스트레칭 정답 각도/의학 기준이 아니다.
- A267: 원본/후보 남녀4개 모두 custom normals=false·flat face0·sharp edge0.
  head corner 대 BMesh vertex 법선의 최대 차이는 .039565° 이하,30°초과0.
  오래된 custom normal/flat shading 가설을 배제했으며 조명만 바꿔 결함을 숨기는 보완을 하지 않았다.
- native2회 모두 exit0. A266 최초 정적 검사는 format/B9052개로 실패했다.
  길이가 같은 인접 샘플 쌍+strict zip으로 보완하고 format/default Ruff 통과 후 실제 실행했다.
  최초 정적 stdout는 잘렸으므로 완전 보존이라고 주장하지 않는다. native stdout는 모두 보존했다.
  결과 문서의 첫 patch는 헤더 문맥 불일치로 적용되지 않았고 실제 헤더를 확인한 뒤 다시 적용했다. 기존 파일/증거를 덮어쓰지 않았다.

## 보존·재검사

[사본 manifest](copy-manifest.json)는 보고서2·실행 helper2·사전 계약2·실행 요약/원시 native 출력1의7개 변경 없는 gzip 사본을 담는다.
이전690개 파일의 SHA가 그대로다. [evidence-check.cjs](evidence-check.cjs)는 사본·보호값·관측 의미만 검사한다.

`node bodyguard/assets/blender/review/candidate-a266-a267-diagnosis/evidence-check.cjs`

새 blend/GLB/PNG0, 새118변형·GLB 왕복·브라우저 검증은 미실행이다.
이전 실제 미리보기는 [A264 Blender 컷](../candidate-a260-a265-diagnosis/README.md)에 보존되어 있으며 본 진단의 새 렌더처럼 표시하지 않는다.
사람/웹캠/영상/좌표 수집·외부 계정·시크릿·운영 DB·배포·출시0.

## 다음 작업

좌우별 실제 transition과 곡면 연결을 다루는 조형 보완을 준비한다.
같은 중앙 목표 곡선·smoothing 강도 반복, whole-neck remesh/신체 단순화/skin·좌표 사후 복원/보호 완화는 하지 않는다.
외형이 충족된 새 후보에서 원본·GLB·변형·실제 브라우저·외형 검증을 모두 다시 실행한다.
[기존 Story](../../../../docs/stories/stage2-avatar-candidate.md)·[제작 명세](../../../../docs/avatar-production.md)를 유지한다.

독립 S2.5a 개발 선택 준비는 [PR #14](https://github.com/HSU-OAS/bodyguard/pull/14)로 main merge commit4a00bb2에 병합됐으며 브랜치를 보존했다.
Vitest138개·실제 Chrome5개(계정 응답 mock)·기존 가짜 카메라1개 통과, GitHub 체크 없음.
이는 실제 동작/아바타/코칭/전체2단계·1~6 완료가 아니다. 기존 goal은 계속 진행한다.
