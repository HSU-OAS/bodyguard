# S2.5b 실제 실행·리뷰 증거

2026-10-05 · 기준 main 4a00bb2 · codex/stage2-coaching-engine. [명세](../../stories/stage2-coaching-engine.md), [하네스](../../stories/stage2-coaching-engine-harness.md).

명세와 테스트43개를 먼저 작성했다. 미구현 `./progression`으로 실제 suite1 실패·개별 시험0 실행을 확인했다.
첫 구현43개 통과 후 자체 코드 리뷰에서 전달 시점/자원 소유 경계를 추가해55개 중4개 실패를 재현·수정했다.
중단 사유 누락이 완료를 만들 수 있는 P1도60개 중1개 실패로 재현한 뒤 명시적인 종료 결과/허용 사유만 사용하도록 수정했다.
이전 실패를 최종 통과로 바꾸거나 삭제하지 않았으며 출력과 최종 소스 SHA는 `execution-record.json`에 있다.

## 최종 실제 결과

| 실행 | 실제 결과 | 증거의 한계 |
|---|---|---|
| 순수 진행 엔진 | 60개 통과, 3840개 결정적 합성 이벤트 불변성 검사 포함 | clock·판정 라벨·추정 개수는 합성. 사람의 올바른 자세를 검증하지 않음 |
| 전체 Vitest | 16파일·198개 통과, 실패/skip0 | 기존 단위/DOM과 새 엔진 회귀 |
| Biome / TypeScript | 62파일 검사 / typecheck 통과 | 수정 후 실제 실행 |
| production build/문자열 검사 | JS1개, 개발 후보·미연결 엔진/합성 계획 문자열0 | 코칭을 공개하지 않은 결과. 제품 코칭 구현 완료가 아님 |
| 실제 Chrome 선택 회귀 | 5개 통과, 계정 응답 mock, 카메라0·페이지 오류0·저장소0 | 실제 Chrome154, 자체 로컬 서버·외부 차단 proxy. 실제 인증 서버/사람/아바타 시험이 아님 |

`browser-report.json.txt.gz`는 마지막 실제 Playwright JSON이며 6개 PNG는 그 실행에서 생성된 화면 복사본이다.
새 폴더만 추가했다. 기존 선택 검증20파일은 SHA가 유지됨을 `original-selection-sha256.json`과 검증기로 확인한다.
최초 미구현 시점43개 테스트 원본은 `red-test.ts.txt.gz`로 보존했다. 이후 실패 시점별 전체 소스 스냅샷이 있다는 주장은 하지 않는다.

## 자체 리뷰와 남은 작업

- P1: 사유 누락 종료가 `completed`가 되던 경로 제거. 종료 결과는 명시하고 임의 사유는 결과에 보존하지 않음.
- P2: 현재 running의 중복 ready는 무시. 오래된 ready는 해당 generation만 해제. 무효 preparing-ready는 해제/paused.
- P2: 이 generation의 준비/재개 전에 캡처된 프레임을 지연 도착으로 시간을 더하는 경로 차단.
- 개인정보/경계: 상태·결과에 프레임/좌표/영상/계정 객체 없음. 외부 plan 메타데이터는 허용 필드만 복사. 카메라/DOM/API/저장소 import0.
- 성능: 프레임 갱신은 작은 단계 배열에 대해 O(steps); 실제 장치 코칭 성능을 측정한 것은 아님.

이번 Story 자체의 미해결 P1/P2는0이다. 작성자 자체 리뷰이지 독립 리뷰·전문가 검토가 아니다.
S2.3b 실제 촬영, S2.4 외형 P2·시범/리타게팅, S2.5 실제 자원·계정 adapters와 코칭 화면, S2.7 통합은 미완료다.
기준 아바타/사용자 모델 ready boolean을 임의로 true로 두고 공개할 수 없다. 모의 검증은 선행 게이트를 대신하지 않는다.

검증: 저장소 루트에서 `node bodyguard/docs/review/coaching-engine/evidence-check.cjs`.
원본 실행은 `execution-record.json`; 복사 SHA/크기는 `copy-manifest.json`. 실제 동작·운영 DB·배포·출시 작업0.
