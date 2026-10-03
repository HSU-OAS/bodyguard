# A179–A184 — 실제 머리 곡면과 목 연결 분리 검증

최신 사진의 얼굴·목 연속성, 남녀 통일 무의상 백색 마네킹과 구조/리깅 정확도 기준은 그대로다. **새 후보는 채택하지 않았다.** A-02/A-08 P2, Draft PR #9 미병합, 개발 A37 유지다.

## 실제 결과

| 대조 | 결과와 한계 |
|---|---|
| A179 head-only voxel/union | 미세 면8/7·국소 접힘29/33. 실제6PNG에서 턱 아래 돌출·목 띠·격자 표면이 남아 반려. 하부 전문 점은 정확히 유지했지만 외형 통과가 아님 |
| A180 실제 fold/shading 추적 | 접힘 전부 상부 절단 높이 근처. 전체 smooth=true/custom normals=false/sharp edge0으로 단순 hard-edge 플래그만의 문제는 아님. 새 경로로 실제 재실행 exit0; ID/순서만 제외한 나머지 JSON 정확 동일(원래 JSON byte 동일 아님) |
| A181 아래 턱 절단/미세 국소 정리 | 미세 면1/5→0/0, 접힘100/34. shading 전후 좌표·면 정확 동일, 하부 전문 점 유지. 실제6PNG의 돌출/목 띠/격자는 남아 exit1·반려 |
| A182 원래 머리/깊이축 smooth만 분리 | 원래/가공 머리 각67,586점·실제12PNG. 격자 결함은 보이지 않지만 눈 주위 띠 등 외형 미달. 머리만 렌더한 것이며 서비스 아바타/임상 검증 아님 |
| A183 직접 전문 머리 연결 | 새 연결 면에도 원래 integer 표식이 복사되어 검증기의 `assert new_faces` 실패. 남성 alignment JSON만 생성, 최종 snapshot/여성/렌더 미실행. 기하 통과 증거로 세지 않음 |
| A184 실제 면 좌표 multiset으로 lineage 보완 | 원래 입력 점/면 및 절단 밖 점 정확 유지. 닫힘/tiny/비다양체/winding0이어도 접힘255/320·표면 최대차26.990/28.667mm, 기존 추가6mm guard 실패. 실제6PNG에서 머리 격자는 사라졌으나 목 연결 함몰/선반과 fan이 남아 exit1·반려 |

A180 원래 stdout 파일은 없어 과거 요약의 terminal metadata와 기존 실제 산출물을 구분했다. 재실행의 실제 전체 chunks는 별도 보존했다. 중단된 최초 A181은 exit를 복구하지 못했고 산출물도 없어 완료 횟수에 포함하지 않는다. 새 경로의 A181 재실행만 실제 exit1이다. A182 초기 F401은 finite 좌표 assertion으로 보완 후 native 실행했고 실패 로그를 보존했다.

## 보존·재검사

77개 실제 사본(47gzip·30PNG), 이전770개 파일의 해시/decoded 해시와 원본/helper를 보존했다. 30PNG 모두 직접 열람했다. gzip 안의 실패 script/JSON/stdout도 삭제·재작성하지 않았다. 현재 아바타 전체 좌표/skin/면/group/각163 rest/행렬 완료 snapshot은 A179/A180/A181/A182/A184에서 확인했고 A183의 중간 실패에는 적용하지 않는다.

```bash
node bodyguard/assets/blender/review/candidate-a179-a184-diagnosis/evidence-check.cjs
```

새 blend/GLB/독립 재열기/원본118변형/GLB118변형/Chrome/사람 웹캠 검증은 **0**이다. native 진단 exit0·원본 보존·닫힘 검사는 외형/단계 통과가 아니다. 6mm는 기존 조형 기술 guard이며 임상 허용각이나 사용자 동작 기준이 아니다. 균일 높이/부모 행렬 배치는 해부학적 등록 확인이 아니다.

다음 작업은 실제 경계 대응에 근거한 국소 재토폴로지다. 단순 bridge twist/밀도/절단높이 반복, 전체 신체/목 remesh, 보호 기준 하향이나 검사 후 좌표 복구는 하지 않는다. 최신 참조·기존 파일/증거·전체1~6/승인 규칙을 유지하며 통과한 새 원본에서만 GLB·118변형·브라우저·외형 검수를 이어간다.

[남성 직접 머리의 미완료 목 연결](a184/direct-authored-head-native-bridge-side-male.png), [여성](a184/direct-authored-head-native-bridge-side-female.png), [남성 분리 머리](a182/depth-only-front-male.png), [여성](a182/depth-only-front-female.png). 사진 품질을 충족한 완성 미리보기가 아니라 반려/분리 진단이다.
