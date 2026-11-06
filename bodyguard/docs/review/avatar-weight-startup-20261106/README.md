# 아바타의 여덟 관절 가중치 준비 비용 보완

2026-11-06 · 시작 main `d9b0fa93` · **전체 검사 실패 / Draft 후보**

기존 로더는 정점마다 중복 관절 검사를 위해 `Set`을 생성했다. 한 정점에 최대 8개만 확인하므로 하나의 배열을 해당 함수 호출에서 재사용하고 정점마다 유효 길이를 초기화했다. 유효하지 않은 중복, 인덱스·가중치와 정규화 거부 기준은 유지한다. 관절 수, 표면, 리깅, WebGL 셰이더와 사용자 데이터는 변경하지 않는다.

## 실제 비교

실제 Chrome 156의 로컬 남녀 후보 GLB에서 기존 함수와 변경 함수를 각 2회 예열한 뒤 순서를 번갈아 각각 8회 실행했다. 남성 131,148개, 여성 130,636개 정점에 대해 계산된 첫 4개 정규화 가중치는 **전부 완전 일치**했다. 측정의 중앙값은 남성 기존 95.85ms/변경 40.15ms, 여성 기존 102.70ms/변경 51.80ms다. [원본 측정](evidence/benchmark.json). 외부 요청은 0이며 실제 사용자 카메라는 사용하지 않았다.

이는 여덟 가중치 준비 함수만 측정한 비교다. 당시 다른 프로세스의 CPU 부하가 컸고 GPU 초기화·모델 다운로드·화면 첫 표시·웹캠 추론·다른 기기 속도는 포함하지 않는다. 첫 화면 전체 시간이나 최종 성능 P2를 해결했다고 주장하지 않는다. `executed/`에는 비교 당시 main의 원본 함수와 probe·runner를 보존한다. 로컬 probe는 원본 함수를 `src/avatar/localEightWeightBaseline.ts`로, probe를 `e2e/fixtures/`, runner를 `scripts/`로 복사해 사용하며 Vite가 동일한 PR #150 GLB를 해시 확인 후 읽는다. 임시 파일을 공개 제품에 넣지 않는다.

## 검사 결과와 미해결

- 기존/신규 가중치 결과 비교와 관련 `eightWeightSkin` 단위 검사는 통과했다. 두 정점 사이의 관절 번호 재사용, 같은 정점의 중복과 0 가중치도 별도로 확인했다.
- TypeScript·변경 파일 Biome·Vite production build·production guard가 통과했다.
- 변경된 코드와 실제 남녀 후보 GLB를 사용한 Chrome/WebGL 시험에서 두 독립 아바타의 정점/뼈 방향·전신 구도·60프레임 합성 재생이 통과했다. 외부·카메라 요청과 페이지 오류는 0이다. [실제 결과](evidence/browser-weight-change.json) · [남성](evidence/weight-change-male-after.png) · [여성](evidence/weight-change-female-after.png). 이 시험은 실제 사람 추적이나 기기 냉시작 검증이 아니다.
- 첫 전체 Vitest는 Blender 렌더 및 다른 프로세스가 동시에 실행된 상태에서 22파일/126개 실패·11 오류가 발생했다. 주로 제한 시간 초과와 비동기 화면 미표시가 기록됐다. [원본 로그](evidence/eightweight-full.log.gz).
- `--maxWorkers=2` 재실행은 129파일 중 126파일/2,166개 통과, 3파일/3개 실패였다. [원본 로그](evidence/eightweight-full-capped.log.gz). 실패한 세 화면을 `--maxWorkers=1`로 별도 실행해도 2파일/3개가 실패했다. [원본 로그](evidence/eightweight-retry-specific.log.gz). 화면 로딩 중 기대 요소를 찾지 못한 관찰이지만 이 기록만으로 부하가 유일한 원인이라고 확정하지 않는다.
- `--pool=threads --maxWorkers=1`의 재시도도 화면 테스트 시간 초과가 누적돼 직접 중단했다(exit 143). 완료된 전체 검사가 아니다. [부분 로그](evidence/eightweight-full-threads-interrupted.log.gz).
- 전체 검증 실패와 기존 아바타 외형·초기 성능 P2가 남으므로 **PR은 Draft로 유지하고 병합하지 않는다.** 실제 사람의 웹캠·자세/손 정확도는 별도 미실행이다.

브라우저 시험 당시 HEAD는 변경 전 `d9b0fa93`이지만 실행한 수정 파일의 전후 SHA-256은 모두 `66d0c7f5b9c8a3af53a3097d56db13ebe14b5eb7305ddfe836ba503ddcf3bfd5`이며 이 PR 파일과 일치한다. 실제 실행 runner는 `executed/local-avatar-weight-proof.mjs`(SHA `94fc74a58109798456f751a212cc076b5b74ad74fca7c7ace5e125a0b0a1ea40`)이고, 보고서의 기존 `scripts/test-avatar-rig-browser.mjs` 지문은 이 별도 실행 파일의 지문이 아니다. 이 구분을 유지한다.
