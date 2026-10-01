# A60~A62 — 전문 머리·목 연결과 표면 정렬 대조 / 외형 미채택

2026-10-02 · S2.4 진행 중 · FR-A-01~04/A-07. 여성 탱크톱·쇼츠 요구는 CEO의 **남녀 통일 무의상 백색 중성 마네킹** 결정으로 대체한다. 자연 여성 곡선·관절, 필요한 신체 구조·리그·변형 정확도를 유지하며 사실적 유두·생식기, 의상 경계·허리선·옷단은 표현하지 않는다. 기존 파일·증거와 개발 A37은 보존한다. **외형 P2가 남아 PR #9는 병합하지 않으며 1~6단계/승인 기준을 낮추지 않는다.**

## 실제 결과

| 후보 | 원본 기술 검사 | 실제 렌더 | 외형 판단 |
|---|---|---|---|
| A60 전문 연속 머리·목 | 118개 실행/121행, 목4개 실패·exit1 | 초회8PNG | 눈·코·입·귀가 남아 반려 |
| A61 단일 전문 목 단면 정렬/SURFACE | 118개/121행·실패0·exit0 | 초회8PNG | 목의 세로 주름·앞 돌출이 남아 반려 |
| A62 같은 정렬/LINEAR만 대조 | 118개/121행·실패0·exit0 | 초회8PNG | 주름은 줄지만 목·머리 경계와 실루엣이 미달, 미채택 |

[A60 검사](a60/source-preflight-report.json)·[A61 검사](a61/source-preflight-report.json)·[A62 검사](a62/source-preflight-report.json)는 Blender 5.1.1의 실제 원본 검사다. 각 남녀 연결 성분1/non-manifold0/정규화 오류0/각163bones, 의상 없음·동일 재질 검사를 실제 실행했다. A60 목 비율은4.357/3.553/3.428/3.505로 기존3미만 기준에서 실패했다. 실패를 숨기거나 합격 임계값을 늘리지 않았다. 같은118개를 후보별 새 운동 coverage로 합산하지 않는다.20°는 엔지니어링 스트레스이며 사용자 목표 각도·올바른 운동 시범·코칭 승인 증거가 아니다.

**이번 세 후보의 전체34컷·GLB 내보내기/왕복 변형·실제 Chrome은 미실행**이다. 외형이 미달인 초회 후보를 웹 기본으로 연결하지 않는다. [이전 A59 전체 원본/GLB/Chrome](../candidate-a58-a59-rejected/README.md)와 [A37 무의상 반영/검증](../candidate-a37/README.md)은 이전 후보의 증거이며 이번 후보의 완료 증거로 대체하지 않는다. 실제 사람/검증된 시범/리타게팅/웹캠 통합 성능도 미실행이다. 다음 안전한 외형 보완에서 필요 검증을 실제 다시 실행한다.

## 원인 조사와 변경 경계

- [기존 body 단면](retained-body-cut-diagnostic.json)은 목 절단을 낮추면 폭이 넓어지는 것을 실제 확인했다. 높이만 낮춰 문제를 감추지 않는다.
- [전문 연속 머리·목 진단](authored-continuity-diagnostic.json)은 유지한 전문 목의 안쪽 단면에서 남성132/여성128개의 경계가 기존 전문 원본과 정확히 일치하고 최대 거리0m임을 확인했다. [코드](authored-continuity-diagnostic.py.txt)는 읽기 전용이며 원본을 저장하지 않았다.
- A60은 같은 전문 인체의 연결된 머리·목을 정확한 경계에서 native weld했다. 단순 도형 인체·새 연결 띠·전신 remesh 없이 기존 목/몸/손 좌표·skin·163bones/rest를 보존했다. native 머리 정제80회에서 최대10.045/10.224mm를 기록했지만 실제 얼굴 특징 제거에는 부족했다. 이 수치를 이전 bridge-only 6mm guard의 통과로 부르지 않는다. 전문 상부를 교체한 다른 조형 경로이며 남은 신체 좌표와 리그 보존을 별도 검사했다.
- [A60 목 가중치 진단](a60/neck-weight-diagnostic.json)은 가까운 턱 정점 사이에 head/neck와 clavicle/spine 영향이 갑자기 달라지는 실제 실패 원인을 확인했다. [기존 읽기 전용 코드](neck-weight-diagnostic.py.txt)를 재사용했으며 `region`은 기존 높이 밴드의 진단 라벨이다. 임상 부위 판정이 아니다.
- A61은 얼굴 특징 없는 기존 전문 head를 재사용하고 뼈 중심선 대신 실제 전문 **단일 목 단면**의 XY 중심에 맞췄다.48mm는 기존 허용 범위 내 아티스트 연결 구간이며 의료 수치가 아니다. 준비 위치에서 먼저 native 이름 대응 skin을 전송한 뒤 강체 정렬해 가중치를 유지했다. body/손·retained skin·163bones/rest/행렬 보존 assertion은 실제 실행했다. [생성 보고서](a61/generation-report.json).
- A62는 A61의 native 보간/보고서 두 문자열만 SURFACE→LINEAR로 바꿨다. [생성 보고서](a62/generation-report.json). 실제 [정면](a62/first-front.png)·[남성 측면](a62/first-side-male.png)·[여성 측면](a62/first-side-female.png)·[여성 기울임](a62/first-neck-female-left.png)을 확인했으며 전체 참조 품질로 승인하지 않았다.

다음 조형은 연속 전문 목의 실제 전후면 곡률과 blank-head의 하부 연결을 함께 맞추는 것이다. 뼈 중심선 정렬·단순 smoothing·절단 높이 변경만 반복해 완료 처리하지 않는다. 필요한 관절 구조를 지우거나 전체 몸통/손을 remesh하거나 skin을 단일 뼈로 바인딩하지 않는다.

## 보존·실패·재현

[A60 원본](../../bodyguard_avatar_candidate_a60_rejected.blend) 21,400,553bytes SHA256 `7751f3a4ea79ba21bbfa44b22de533fb36037e5d6a0ed5e9d97bf44948042b86`, [A61 원본](../../bodyguard_avatar_candidate_a61_rejected.blend) 26,281,032bytes `8eb9e98a7c75ad816d822e57cf2bbf3d3aedd4dae3373bea7b60d4a67a30c45f`, [A62 작업 원본](../../bodyguard_avatar_candidate_a62_review.blend) 26,243,145bytes `6bccdf59e30dd35685c5581e414cf66572bf8a97aabe344d0f894cf73ea786e4`를 새 파일로 보존한다. 외형 미채택이며 기본 제작 코드·개발 GLB를 바꾸지 않았다.

생성 시점 코드: [A60](a60/producer-at-generation.py.txt), [A61](a61/producer-at-generation.py.txt), [A62](a62/producer-at-generation.py.txt). A60은 기존 A59, A61/A62는 기존 A49 원본을 열었다. 별도 새 임시 폴더에 `.py`로 복사하고 같은 폴더에 [기존 A49 helper](../candidate-a49-rejected/producer-at-generation.py.txt)를 `a49-density-producer.py`로 복사한다. 기존 CC0 번들과 새 .blend/.json 경로를 전달하며 기존 파일은 덮지 않는다. [공통 실제 검수 실행법](../../README.md)을 따른다. [초회 미리보기 코드](first-preview.py.txt)는8컷이며 전체34컷이 아니다.

첫 A60은 modifier 적용 후 무효화된 마스크 RNA 핸들로 저장 전 exit1이었다. [실패 코드](a60/producer-first-failed.py.txt)를 보존하고 기존 이름 재조회 방식으로 수정해 실제 재실행했다. 첫 A61은 턱 높이의 복잡한 단면을 기존 strict 경계 검사에서 차단/exit1했고 원본은 생성하지 않았다. [실패 코드](a61/producer-first-failed.py.txt)를 보존한 뒤 검사 기준을 낮추지 않고 확인된 단일 목 단면을 사용했다. [실제 실행 기록](execution-record.json)은 관찰한 결과 요약이지 전체 stdout 사본이 아니다. 최초 파일 검색에서 잘못된 root AGENTS/export/producer 경로를 조회한 오류도 있었으며 실제 경로를 찾아 완전히 읽은 뒤 진행했다. 검증 PASS로 세지 않는다.

[기존 전문 에셋 이름 조사](authored-asset-catalog.json)·[코드](authored-asset-catalog.py.txt)는 기존 CC0 번들 메타데이터만 읽었다. 새 외부 에셋/연결/계정/시크릿/비용/배포, 영상·사람 좌표 저장/전송은 없다.

[실제로 통과한 실행형 감사](evidence-audit.json)·[감사 코드](evidence-audit.js.txt)는 `node <복사한 .js> <저장소 루트> <기존 임시 원본 폴더>`로 재실행한다. 원본/24PNG의 동일 바이트·3개 검사 결과·기존 파일 불변·정확한 보간 두 문자열 변경·로컬 링크를 확인한다. manifest는 자기 보고서만 제외한다. 관련 Ruff는 실제 실행했고 서비스/API/전체 frontend/build/계정 공급자 회귀는 이번 후보에서 재실행하지 않았다.
