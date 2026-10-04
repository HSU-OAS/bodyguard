# A303–A306 — 수정 경계와 native 연산자 무변화 대조

2026-10-04 · S2.4 · FR-A-02/03/08. **새 blend/GLB/PNG0, 외형 A-02/A-08 P2 미해결, PR9 미병합, 전체1~6단계 미완료입니다.**

[최신 얼굴·목 참조](../candidate-a88-review/ceo-reference.png)의 연속 얼굴–목–어깨, 남녀 공통 무의상 백색 중성 표면·자연 곡선·관절과 리깅 정확도를 유지합니다. [이전 A300–A302](../candidate-a300-a302-diagnosis/README.md)와 기존 파일·검증 증거는 수정하지 않았습니다.

## 실제 실행

| 실행 | 실제 결과와 제한 |
|---|---|
| A303 경계 진단 | A302 실패를 byte-exact helper로 메모리 재현했습니다. 가장 큰 실제 각도40간선의 인접 원래 삼각형80개 중 경계점을 포함한 면은 남61/여74개였습니다. 대표 면에서 경계점 이동0과 안쪽196/195μm가 맞닿는 것을 확인했습니다. 경계는 잔여 사례에 관여하지만 전체 문제의 단일 원인으로 확정하지 않습니다. authored body/rig/ledger·입력 SHA 불변, 진단 exit0입니다. |
| A304 정리 후 경계 조건 | native SMOOTH .5/32회·실제 원래 단면·원래 geodesic8mm를 유지하고 **필드 정리 후** quintic compact weight를 적용한 단일 시험입니다. 순수 가중함수의 C2 조건을 메시 전체의 C2나 외형 통과로 확대하지 않습니다. 변경2504/2162점·최대1.433/0.829mm·원본X/Z/raw139skin/각163rest/손/앞면/범위 밖/위상/ledger·fold76/107 보호는 통과했습니다. 같은 전체 원래 간선의 p95남4.147→4.246°/여4.299→4.299°, max17.688→24.542°/19.409→24.419°로 **exit1·저장 전 반려**했습니다. |
| A305 실제 면 기반 native 연산자 | 원래 전문 A250에 설치된 LAPLACIANSMOOTH .05/12회/normalized/Y-only/체적 보정 없음으로 별도 단일 시험했습니다. **실제 변경0/0점**이며 모든 원본 좌표·skin/리그·마감·원래 면각은 동일했습니다. 구조 훼손이 아니라 **편집 존재성(no-op)** 조건 실패로 exit1·저장 전 중단했습니다. 같은 면각의 비악화 PASS를 개선이나 외형 승인으로 처리하지 않습니다. |
| A306 무변화 조건 대조 | A305 무변화를 실제 재현하고 같은 설치 커밋의 보존된 공식 C++를 대조했습니다. 원래 양의 mask9789/9693점 **모두** corner-area 고정 cutoff에 걸립니다. 단위128을 가정한 읽기 전용 계산에서는 해당 대상의 cutoff 동결0/0점입니다. 이는 **가상 지원 범위 계산**이며 실제 scaled native 조형·품질 QA는 미실행입니다. source/body/rig/전체 속성·입력 SHA 불변, 진단 exit0입니다. |

네 native 실행의 terminal exit는 **0/1/1/0**입니다. 실제 BVH84048ray는 재현을 포함하며 사용자 웹캠 데이터가 아닙니다. 실제 좌표계와 단위 제한의 근거는 기존 [Blender 공식 소스 사본](../candidate-a228-a236-diagnosis/official-source/MOD_laplaciansmooth.cc.txt.gz)과 [GPL 라이선스](../candidate-a228-a236-diagnosis/official-source/GPL-license.txt)에 보존됐습니다. `min_area`가 작은 corner에서 편집을 동결하는 [동일 커밋의 공식 코드](https://github.com/blender/blender/blob/b70da489d7f4/source/blender/modifiers/intern/MOD_laplaciansmooth.cc)를 기준으로 계산했습니다. 이번 원격 web 조회는 Cache miss였으며 검증 성공으로 세지 않았습니다.

## 검증·보존

`node bodyguard/assets/blender/review/candidate-a303-a306-diagnosis/evidence-check.cjs`는24개의 원문 SHA 일치 gzip 사본과 이전1042파일 SHA, 사전 계약·helper·전체 stdout·실제0/1/1/0·실패/무변화/가상 계산의 구분을 검사합니다. 증거 무결성 PASS는 후보 품질 PASS가 아닙니다. 실제 Python9파일 strict E/F/I·format, 순수 가중함수7개 시험을 통과했습니다.

초기 patch context 불일치, A304 BMesh free 이후 adjacency 배치, A305 E5011은 **native 실행 전** 소스 검토·보완·검사 재실행으로 해결했습니다. 실제 실행된 helper를 사후 수정하지 않았습니다. 잘못된 Story 경로 조회와 실제 원격 조회 실패도 기록했습니다. 문서화·리뷰 스킬로 구조 보호, 편집 존재성, 곡률 실패, 가상 계산 및 미실행을 분리했습니다.

독립 저장 재열기·새 원본/GLB118개 변형·렌더·Chrome은 저장된 후보가 없어 **미실행**입니다. 새 frontend/API/build·실제 사람/다른 장치/공급자·운동 시범·사용자 리타게팅 검증도 수행하지 않았습니다. 이전 후보의 실제 QA를 새 후보 완료 증거로 사용하지 않습니다.

다음은 전문 원본의 임시 복사본에서만 정확한 binary128 단위와 동일 native .05/12/Y-only/체적 보정 없음으로 편집을 검증하는 작업입니다. X/Z·원래 zero-support가 편집 단계부터 정확히 유지돼야 하며 사후 복구하지 않습니다. 검증된 native Y 이동량만 원래 몸체에 전달하기 전 남녀 공통 예산을 계산하고 **전체 원래 면각·기하·skin/리그 보호**를 그대로 검사합니다. 강도/횟수 반복·지표 교체·보호 완화·whole-neck remesh·원시 인체 생성은 하지 않습니다.

**새 미리보기는 없습니다.** 개발 기본 A37·외형 P2·PR9 병합 보류·전체1~6단계와 별도 승인 기준을 유지합니다.
