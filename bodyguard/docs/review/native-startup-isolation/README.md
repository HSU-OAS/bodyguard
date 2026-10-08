# S6.9 — 시작 지연 기준선 분리

2026-10-09(KST) · [명세](../../stories/native-startup-isolation.md) · **원인 확정/제품 보완 미완료, Draft**

실제 로그인→카메라→세 SDK→미완성 두 아바타→연속 결과의 기존 시험 흐름을 main5a1a3d8과 목 입력 Draft884700e에서 비교했다. 공개 웹 화면/코드를 확장하거나 아바타를 다시 제작하지 않았다. 새 기능은 실패 원문과 정상 재시험을 분리하는 **개발용 오프라인 분석·검증 명령**이다.

| 실제 범위 | 결과 | 의미 |
|---|---|---|
| 원래 main→current 남성 첫 시작1건씩 | 2통과 | 첫 비교 시점에 실패 미재현 |
| 순서를 바꾼 main→current→current→main 남성 첫 시작 | 4통과 | 순서만 바꾼 제한된 대조에서도 미재현 |
| 보존한 PR90 최종 필수 회귀 | 13통과/13실패 | **재실행·대체하지 않음**, Draft/시작P2 유지 |
| 동일 byte 오프라인 검증기 | 정상exit0, 누락/변조각exit1 | 원본 검증기의 예상 거부 동작. native 시험 아님 |
| 현재 소스 FE·정적/build | 1336통과·새35, 나머지exit0 | 제품 공개 JS355151/CSS31199 byte·SHA 동일 |

실제 Chrome154.0.8037.98·SDK1.0.1·Auth API·본인 격리 SQL이다. 카메라·권한 UI·메일은 시험용이며 실제 사람/물리 카메라0이다. 생성 동작·정답 gate를 실제 코칭 검증으로 세지 않는다. 모든 서비스는 종료했고 직접 만든 의존성 링크만 제거했다. 테스트 DB 데이터·GLB/원본·기존 실패/첫 비교 자료는 보존했다.

시작 수치는 카메라부터의 상대 기술 시각이다. 대조6건의 SDK 준비1660.3~1903.6ms/첫 반환3222.9~3608.0ms와 기존 실패8663.4/14915.3ms를 혼동하지 않는다. 시스템 부하·warmup·누적·GPU/CPU fallback 등 근본 원인은 미확정이며 대조 실패 미재현만으로 기존 문제가 없다고 결론 내리지 않는다.

## 원본과 재검증

- [첫 비교34개 원본/SHA](first-comparison/manifest.json): 기존 byte 보존.
- [후속99개 원본/SHA](controlled-comparison/manifest.json): 대조6건, 기존 필수4개 report, 분석 입력/출력, 실행 시 source와 최종 품질 검증.
- [분석 결과](controlled-comparison/analysis-result.json.gz): 대조와 기존 필수 실패를 각각 보존.
- [작성자 검토](author-review.json): 보안/성능/정확성/유지보수 범위. 독립 리뷰가 아님.
- [최종 오프라인 실행 원문](verification/manifest.json): 정상/누락/변조 명령·원문 및 실제 결과.

저장소 루트의 실행 당시 두 HEAD 객체가 필요하다. 없다면 원격 branch를 읽기 전용으로 fetch한 뒤 개발 폴더의 `frontend`에서 실행한다:

```bash
node scripts/verify-native-startup-isolation.mjs
```

설치·카메라·DB·외부 API를 새로 사용하지 않으며 저장된 자료/실행 git blob만 읽는다. 실행 성공은 **오프라인 원본 검증 성공**이지 새로운 native 통과나 제품/출시 게이트 통과가 아니다. 모델/영상/관절/프레임 신체값/인증정보를 이 진단에 새로 수집하지 않았다.

## 보완과 남은 일

구현 전 import 실패(개별 테스트0), 첫32건의 배열 matcher 오류4건, 후속35건의 미종료 SDK 계산 오류1건은 모두 보존했다. 마지막 오류는 보완 후 전체 FE1336과 실제 오프라인 정상/누락/변조로 재검증했다. SDK 준비의 모든 시도와 원래 실패를 빠뜨리지 않는 검증 장치이며 native 지연 자체를 고친 것이 아니다.

필수 시작P2·PR90 회귀 실패/병합 보류·실제 사람/관찰자·동작별 검증/올바른 시범·최종 남녀 외형/권리·승인 공개 구조·SDK 정책·외부/운영 및 D2/전체1~6은 그대로 남는다. 출시 적격 동작0, 출시 후보판 선언0이다. 최소 텍스트·아바타 중심 요구와 별도 승인 경계를 유지한다.

## SDK 시도·메인 스레드 진단 후속

비공개 fixture의 준비 성공·거부·미종료/요청 delegate와 bounded long-task를 구분한다. 제품 UI·개인정보/SDK 정책은 바꾸지 않는다. 로그인→두 아바타→중단/본인 기록, 가림/만료·권한 회수/새 세대가 실제 Chrome/SDK/API/격리 SQL에서 작동했다. 가짜 카메라/메일·생성 동작이며 실제 사람/올바른 자세 정확도 검증은 아니다.

- 최초 남녀24건20통과/4가입429 실패, 카메라 이전에 실패한4건만 새 시험 schema에서4통과. 기존 보안 한도와 poll5000/case60000/retry0 유지. 최초 실패/cleanup SecurityError는 보존한다.
- 두 실행의 준비32회/SDK96시도는 모두 GPU 성공, 실제 CPU 전환/거부는 미검증이다. 첫 SDK1353.1~1712.0ms/첫 반환2752.3~3290.7ms·long task 최대949ms이며 시작 실패는 미재현이다. FilesetResolver 호출이 WASM 준비 전체는 아니며 동시 관찰은 인과 입증이 아니다.
- stage로 위장한 외부 객체 보관을 단위 실패로 확인해 보완했다. 최종 FE1352/새16·정적/build/guard·공개byte 불변과 남성 첫 시작1건의 대표 연결을 실제 재검증했다. 최종 전체 native/PR90 필수26건 재검증은 미실행이다.
- 기존145개 artifact/세 manifest byte 보존. [새195개 원문/SHA·임시 compiled probe SHA](diagnostic/manifest.json), [집계/실제 범위](diagnostic/execution/diagnostic-result.json.gz), [작성자 검토](diagnostic-author-review.json). PG 정지·데이터/GLB/실패 보존. 첫 PG의 shared-memory 샌드박스 실패를 SDK 실패로 세지 않는다.

원래 시작P2·Draft·D2/전체1~6 미완료를 유지한다. 정상 반복/제한 완화로 해결 처리하지 않는다. UI 텍스트 최소화는 실패·미실행 증거를 삭제한다는 뜻이 아니다.
