# 목 동작 판정 후보와 진행·결과 연결

2026-10-16 · [Story](../../stories/neck-candidate-classifier.md) · base main2ee43fe · 영상 평면의 개발 후보, 임상/출시 승인 아님.

## 이번에 구현한 것

기존 두 모델은 관찰을 표시하지만 동작별 classifier가 없었다. 이번에는 **같은 프레임의 생성 관절 → 기존 투영 계산 → 새 목 동작 후보 판정 → 기존 코칭 진행 → 결과 DTO/저장 계약**을 연결했다. 시험에서 분류 문자를 직접 주입하지 않는다. 코칭 화면에 자동 판정을 적용한 Story는 아니며 새 화면·SDK·원본/GLB·API/DB 변경은 없다. 기본 코칭 시작 비활성과 출시 목록0개를 유지한다.

판정 후보는 준비·목표 접근·유지·복귀와 좌/우를 구별한다. 공급한 영상 평면 band에 따라 반대 방향/범위 초과·어깨선·머리 위치 이탈 후보를 반환한다. 맨 처음 목표 위치에 있어도 시작으로 처리하지 않으며, 복귀는 복귀 단계에서만 `returned`가 된다. 모든 숫자는 `posture/thresholds.ts`의 **명시 입력 계약**으로만 들어오고 임상 기본값은 없다. fixture의 각도/50ms 등은 수학 시험값이며 운동 처방/출시 파라미터가 아니다.

`neckCandidateFeedback`은 현재 세션의 motion/version/세대·프레임 한계를 확인한 뒤 기존 엔진에 원래 시각/순서/인물 수와 분류만 전달한다. 이후 실제 현재 state와 일치할 때만 제한된 부위/오류 코드를 반환한다. 원시 좌표·관찰 수치·계정은 결과 DTO와 오류 목록에 없다. 자격 gate를 만들거나 true로 바꾸지 않는다. 향후 사용 시 표시할 부위는 실제 모델/coverage에 맞춰 검증해야 하며 이 시험만으로 목 분절이나 얼굴에 정확한 빨강 강조가 구현됐다고 주장하지 않는다.

## 근거와 한계

2026-10-16에 [CUH의 목 운동 안내](https://www.cuh.nhs.uk/patient-information/neck-exercises-and-advice/)와 [NBT의 목 부상 안내](https://www.nbt.nhs.uk/our-services/a-z-services/emergency-zone/ed-miu-patient-information/neck-injuries)를 다시 확인했다. 이 자료는 수행 과정·주의점의 근거이지 웹캠 정답 band/오판정 수치의 근거가 아니다. 환자 교육의 숫자를 일반인 기본값으로 복사하지 않았다. 상세 source/version/현재 문맥은 Story에 있다.

영상 평면의 band 일치는 전체 올바른 자세나 안전성·통증/힘·경추 분절·깊이/회전·동일인 확인이 아니다. 현재 코드로 일반인의 적합 범위/보상 움직임 기준이 검증된 것이 아니다. 기준 확정/실측·전문가 검토와 실제 시범/부위 mapping 검증이 남는다. 검증 전에는 이 후보를 제품의 성공/교정으로 공개하지 않는다. 참여자 이월은 독립 소프트웨어 개발의 중단 이유가 아니지만 합성 시험을 실제 사람 검증으로 세지 않는다.

## 확인한 경로

- 생성 지표의 같은 프레임/비율/반전, 좌우의 준비→접근→목표→복귀, 목표에서 시작 거부와 어깨선/머리 위치/반대 방향/범위 오류를 확인했다.
- 누락/저신뢰/존재 신뢰도 비정상/화면 밖/복수 인물/오래된 입력은 성공으로 보지 않는다. 중복/다른 세대·역행·큰 공백·예외·종료 뒤 입력도 시험했다. 입력/기준은 복사 또는 불변으로 유지한다.
- 수학 fixture의 좌우 목표를 실제 classifier로 판별해 기존 엔진이 양쪽을 마친 뒤 `completed` 결과를 만든다. 결과의 elapsed/observed/repetition 제약을 기존 resultRecord로 검사하고, 모의 HTTP 응답으로 saveResultRecord의 제한 DTO/CSRF/응답 일치를 확인했다. 실제 서버/SQL 저장이나 소유 계정·SDK 양성 검출/사람 정확도 증거는 아니다.
- 보상 후보 입력은 오류 코드를 반환하고 해당 구간의 시간/성공을 늘리지 않는다. 가림은 현재 진행을 disarm하고 미완료 중단은 interrupted가 된다. 검증 gate가 false인 세션은 이 adapter로 시작되지 않는다. 오래되거나 조작된 state·변경된 protocol·재진입 종료·오류 및 비동기 observer도 거부한다.

```sh
# bodyguard/frontend
pnpm exec vitest run src/stretch/neckCandidateClassifier.test.ts src/coaching/neckCandidateFeedback.test.ts
pnpm test
pnpm build
pnpm check
node scripts/check-selection-production.mjs
git diff --check
```

## 실패 보존과 직접 리뷰

1. 최초 test 파일 export가 Biome에서 거부됐다. 재사용 생성기를 e2e/fixtures로 옮기는 중 테스트 시작 부분까지 복사해 parse 오류가 났고 해당 꼬리 부분을 제거했다. 이 두 Biome 실패는 당시 도구 출력만 있으며 별도 원문 파일은 없다. 없는 파일을 실행 증거로 세지 않는다.
2. 첫 unit은 화면 밖 시험 좌표를0으로 두었지만 기존 isInFrame의0은 유효 경계다. 공유 경계를 바꾸지 않고 실제 범위 밖 -0.01로 시험을 고쳤다(`unit-c.log.gz`). 다음 타입 검사는 readonly band를 강제로 mutable 배열로 변환한 시험 코드를 거부했고, 실제 mutable fixture 배열을 만든 뒤 복사본 불변을 확인하도록 고쳤다(`types-d.log.gz`).
3. exact target edge4건은 투영 삼각함수의 IEEE754 반올림 때문에 `unmet`이 됐다(`edge-a.log.gz`). 실제 생성 투영 오차가64×Number.EPSILON 이내임을 검사하고 그 산술 해상도만 비교에 반영했다. 임상 각도·검출 오차 허용값을 넓힌 것이 아니다. 해상도보다 좁은/겹치는 band를 거부하고 수학 경계보다1e-7 바깥 입력은 계속 범위 오류로 남는 것을 검사했다.
4. 직접 리뷰에서 session.getSnapshot의 wrapper는 매번 새 객체일 수 있음을 확인했다. wrapper 동일성이 아니라 **그 안의 현재 immutable state 동일성/원래 stamp**를 비교한다. 잘못된 region/프로토콜·재진입/종료·Promise observer와 raw 예외 노출도 보완했다.

코드 리뷰·문서화 스킬로 입력/기준 신뢰 경계, 수치 단위와 산술 반올림/임상 기준의 구분, 현 소유자/세대/시각·phase/side, 기존 gate 보존, 제한 DTO·원시 데이터 배제·production 후보 제외를 직접 검토했다. 현 소유자의 새 프레임 시각이 NaN/무한/음수/미래이면 후보 인스턴스를 종료해 다음 목표 입력이 그 알 수 없는 구간을 연결해 누적하지 않게 했다. 오래된 다른 세대가 현재 인스턴스를 죽이는 방식으로 바꾸지는 않았다.

실행 결과: 전체frontend2015개/119파일(`full-test-c.log.gz`), 원래 typecheck/notice 포함 build(`build-c.log.gz`), Biome exit0·기존16info(`check-c.log.gz`), 변경7파일 진단0(`scoped-final.log.gz`), production guard(`guard-c.log.gz`)가 통과했다. 이번 수학/연결 코드 Story 범위의 알려진 미해결 P1/P2는 없다. 공개 후보 승격·실제 브라우저/SDK/3D 검증·SQL/실측을 이번에 새로 수행한 것으로 세지 않는다. 원본/GLB를 수정하지 않아 Blender 재제작/내보내기도 하지 않았다. 코드·원래 실패 로그·압축 전 SHA와 무손실 복원은 [증거 목록](evidence-manifest.json)으로 대조한다.

## 남은 작업

현재 코칭 화면의 입력/아바타에 이 후보와 오류별 시범을 연결하는 단계, 출시 가능한 기준의 실제 검증, 신체 기반 추천·실제 UI 결과/저장·나머지 동작이 남는다. PR150/152의 최종 외형/성능·원래 SDK 간헐 P2는 해결되지 않았으며 Draft/병합 금지를 유지한다. 1~4/1~6 완료가 아니다. 운영 DB/시크릿·공급자/Docker·HTTPS·배포/출시·비용/계정 작업은 실행하지 않았다.
