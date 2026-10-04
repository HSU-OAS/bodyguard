# S2.5b 하네스 — 실제 관찰 구간만 진행시키기

2026-10-05 · 구현 전 계약. [Story](stage2-coaching-engine.md)의 L-01~08에 대응한다.

| 기준 | 재현 | 통과 증거 |
|---|---|---|
| L-01 | 명시적인 합성 계획/중복 ID/NaN·Infinity·음수·누락/외부 계획 변이 | 무효 계획 거부·내부 계획 불변·기본 처방0 |
| L-02 | 준비 항목을 하나씩 false, idle/preparing/running/paused에서 start/resume | gate/사용자 start 전 카메라 요청0, ready 전 수행0, 요청 generation 일관 |
| L-03 | 합성 sampledAt/now/sequence, good-good·unmet·unknown·gap·tick·pause | 비교 가능한 정상 두 target의 간격만 누적·중복/지연/비관찰0 |
| L-04 | 순서 없는 target/return, 회당 유지 경계, 복수 personCount·target change | 오인 반복0·복귀에서만1회·중간 반복 폐기 |
| L-05 | 늦은 ready·지난 generation frame·stop 반복·통증/만료/이탈/자산/추론 오류 | 결과 불변·소유 generation 해제·상태 부활0 |
| L-06 | 두 방향 계획 완료와 중간 skip/stop | 단계 완료/partial/pending과 motion 결과 일관·원시/개인정보0 |
| L-07 | 기존 단위/DOM·production build 검사·기존 Chrome 선택 회귀 | 기존 UI/production 차단 유지; 코칭 runtime adapter 미연결 |
| L-08 | 결과·PR·미실행 목록 | 합성 시간/판정 라벨을 실제 사람·올바른 운동 검증으로 세지 않음 |

관절 좌표 픽스처0·실제 사람/카메라0. 입력은 합성 clock, 동작 분류 라벨과 추정 개수뿐이다.
테스트의 유지시간·간격·반복수는 대수적 경계 검사를 위한 값이며 출시 설정에 넣지 않는다.
Vitest Node 순수 시험, 기존 React/선택 회귀, Biome·typecheck·production 출력/브라우저 차단을 각각 기록한다.
새 모델 렌더·계정/API/DB·실제 Google/Gmail·웹캠·실측·시범·HTTPS·운영 DB/시크릿/배포는 본 Story 검증이 아니다.
