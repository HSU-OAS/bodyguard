# S2.5a — 동작 탐색·상세·직접 선택의 독립 준비

2026-10-04 · 최신 main 4bbb784에서 시작 · 개발 전용 구현·로컬 검증 완료, PR 병합 게이트는 별도 확인. S2.3b·S2.4·전체 S2.5/2단계는 미완료다.

## 목적과 경계

사용자가 첫 대표 동작을 찾아 안내·주의점·출처를 읽고 선택하는 흐름을 준비한다.
FR-S-01/06·FR-U-04·FR-V-02/03·NFR-08에 근거한다.
S2.3 실제 동작과 S2.4 아바타가 미완료라 후보를 제품에 노출하지 않는 [근거 계약](../motion-evidence.md)을 그대로 유지한다.
따라서 이번 화면은 **로그인 보호된 개발 검수 경로 /dev/select**에만 연결하고 production에서 컴파일 제외한다.
로그인 복귀의 기존 /start allowlist는 변경하지 않는다. 개발 시작 화면의 검수 링크를 이용한다.

- 기존 #1 목 옆으로 기울이기만 첫 대표 후보로 준비. 다른 후보/뷰티/추천·기록은 추가하지 않는다.
- 목록 검색/부위 필터, 실제 빈 상태와 초기화, 상세 직접 링크/잘못된 ID, 브라우저 뒤로와 목록 복귀.
- 내용은 기존 자료의 한글 요약. 각도·유지시간·반복수·효능·진단·시범 애니메이션은 확정하지 않는다.
- 선택은 상세 안내를 보는 상태 전이이지 운동 수행/성공/기록 생성이 아니다.
- 코칭 시작은 disabled이며 선행 검증을 준비 중이라고 설명. 개발용 진입 플래그로 카메라/코칭을 우회하지 않는다.
- 카메라·추론·3D 모델·좌표·타이머·원시 기록·저장소·API 신규0. 기존 /me만 계정 권한을 결정한다.
- 아바타 Draft PR #9와 파일/기존증거는 별도 작업트리에 보존. 본 PR에 섞지 않는다.

## 디자인 계약

기존 웹의 near-white/짙은 ink/녹색 accent·system 한국어 글꼴·48px 버튼·10/12px radius·24/48px 여백을 재사용한다.
목록은 “어떤 동작인가”, 상세는 “어떻게 준비하고 무엇을 주의하는가”를 한 화면의 주제로 둔다.
가짜 아바타/스크린샷/효과 점수/장식 아이콘0. 안내 중심의 차분한 목록과 읽기 쉬운 상세/주의점/출처를 제공한다.
폭700/1440의 노트북 창, 키보드 초점·label·읽기 순서·빈 상태를 실제 브라우저에서 확인한다.
개발 검수임을 명시한다. 전문가 승인/실제 코칭/출시 완성으로 광고하지 않는다.

## 수용 기준

| ID | Given → When → Then |
|---|---|
| C-01 | 계정 미확인/401/503 → 개발 경로 직접 진입 → 후보 내용이 보이지 않고 기존 계정 확인·로그인·재시도 상태로 닫힘 |
| C-02 | ready → 목록 → 검색/부위 filter·count·빈 상태·초기화를 실제 결과에 맞게 제공 |
| C-03 | 대표 후보 선택 → 상세 → 수행 과정·주의점·필수 촬영 범위·출처를 표시. 미검증 각도/초/효과 없음 |
| C-04 | URL 직접 선택/잘못된 ID/뒤로 → 올바른 상세 또는 복구 가능한 없는 동작 상태. query를 코드/외부 링크로 실행하지 않음 |
| C-05 | 상세의 코칭 버튼/계정 이탈 → 카메라·추론·타이머·성공·저장소·기록 API가0 |
| C-06 | production → /dev/select·/start → 후보/검수 링크/코칭 진입 없음. build JS에 후보 내용·ID·개발 화면 없음 |
| C-07 | 실제 Chrome / 넓은·좁은 노트북 창·키보드 → overflow/페이지 오류 없이 사용할 수 있음. 실제 PNG 검수 |
| C-08 | Story 완료 → 결과 → synthetic/mocked browser와 실제 API/사람/아바타/출시 검증을 명확히 분리 |

## 하네스와 미실행

[하네스 계약](stage2-motion-selection-harness.md)을 먼저 작성한다.
순수 데이터/검색 시험·React 상태 시험은 테스트 환경이다.
실제 Chrome에서는 결정적인 **계정 응답 mock**으로 UI를 검증하며 실제 HTTP/SQL 인증 통과로 세지 않는다.
production 차단은 실제 production build/preview와 출력 JS에서 확인한다.
S2.3b 사람·S2.4 원본/GLB/변형·실제 계정/Google/메일·실시간 코칭·HTTPS 배포는 본 Story 제외다.
완료해도 전체 S2.5/2단계나 1~6단계 통과가 아니다. [운영 규칙](../operating-rules.md)과 [단계 계약](../release-plan.md)을 유지한다.

## 근거 재확인

2026-10-04 [CUH Neck exercises and advice](https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/) mobility tilt 및 no-pull/dizziness 안내,
[North Bristol NHS Neck Injuries](https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries) exercise3/주의사항을 다시 읽었다.
환자 자료의 질환/치료·시간·횟수 처방을 일반 사용자 제품 기준으로 복사하지 않는다. 내용은 임상 효능이나 웹캠 관찰 정확도의 근거가 아니다.

## 실제 완료 증거·리뷰

[검증 기록·실제 PNG](../review/motion-selection/README.md), [실행 요약](../review/motion-selection/execution-record.json).
수용 기준 C-01~08을 **개발 전용 준비 범위**에서 검증했다. production에 후보를 공개하지 않았다.

- Vitest 138개/15파일 통과(신규 순수9·React9), Biome60파일·typecheck 통과.
- 실제 production build/JS1파일 후보·dev 경로 문자열0. Chrome154의 실제 dev/preview5개 통과, 계정 응답 mock.
- 700/1440 창 실제 PNG6개 직접 열람. 검색/빈 상태/복구/뒤로/초점/미확인 계정 차단·카메라/저장0 확인.
- 기존 별도 가짜 카메라 회귀1개 통과. runtime 경고·API 미기동 오류와 실제 사람/인증 미검증을 기록에서 구분했다.
- 구현 전 실패, 첫 정적 검사·Chrome 실패, cached 복귀의 제목 덮어쓰기 재현/보완을 기록에 보존했다.
- CTO 자체 리뷰로 범위·권한·compiled-out·부작용·근거 과장·하네스 분리를 확인. 발견한 제목 문제는 회귀검사와 함께 수정했다.
  현재 이 Story의 미해결 P1/P2 없음. 독립 리뷰/종합 보안·의료·실측 완료로 표시하지 않는다.

frontend-design 스킬에 따라 기존 스타일을 재사용하고 실제 창/상태 컷을 확인했다.
testing-strategy 스킬에 따라 수용 기준을 먼저 하네스에 연결하고 순수/DOM/mock Chrome/실제 production 출력 검증을 구분했다.
Git 커밋·PR·최신 main/diff/CLEAN/체크 확인·merge commit은 사전 승인 운영 규칙을 따른다. GitHub 체크가 없으면 체크 없음으로 보고한다.
